/* ==========================================================================
 * Universal Form Autofill — content script
 *
 * Injected on demand into the active tab. Listens for a single "fill" message
 * from the popup, scans the page for fillable fields, and fills each one either
 * from the user's saved profile (fuzzy-matched by label/name/etc.) or with
 * generated test data.
 *
 * The hard part of "fill any form" is that modern forms (React, Vue, Angular,
 * the portal apps in the brief) track their own state. Setting `el.value = x`
 * is invisible to them. So we use the native value setter + dispatch the same
 * events a real keystroke would, which makes frameworks pick up the change.
 * ========================================================================== */

(() => {
  // Guard against double-injection (popup may inject more than once).
  if (window.__UNIVERSAL_AUTOFILL_LOADED__) return;
  window.__UNIVERSAL_AUTOFILL_LOADED__ = true;

  /* ----------------------------- utilities ------------------------------ */

  // Lowercase + strip everything that isn't a letter or number.
  const normalize = (s) => (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");

  // Split a string into word tokens, breaking camelCase / snake_case / kebab.
  const tokenize = (s) =>
    (s || "")
      .toString()
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_\-./]+/g, " ")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

  const isVisible = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
      return false;
    }
    const rect = el.getBoundingClientRect();
    // Allow zero-size only for inputs deliberately covered by a styled label
    // (common with custom checkboxes/radios), otherwise require some footprint.
    if (rect.width === 0 && rect.height === 0) {
      return el.type === "checkbox" || el.type === "radio";
    }
    return true;
  };

  // React/Vue-safe value setter.
  const setNativeValue = (element, value) => {
    const proto = Object.getPrototypeOf(element);
    const ownDesc = Object.getOwnPropertyDescriptor(element, "value");
    const protoDesc = Object.getOwnPropertyDescriptor(proto, "value");
    const ownSetter = ownDesc && ownDesc.set;
    const protoSetter = protoDesc && protoDesc.set;
    if (protoSetter && ownSetter !== protoSetter) {
      protoSetter.call(element, value);
    } else if (ownSetter) {
      ownSetter.call(element, value);
    } else {
      element.value = value;
    }
  };

  // Fire the sequence of events that frameworks and validators listen for.
  const fireEvents = (el, types) => {
    types.forEach((type) => {
      const Ctor = type === "input" || type === "change" ? Event : Event;
      const evt = new Ctor(type, { bubbles: true, cancelable: true });
      el.dispatchEvent(evt);
    });
  };

  /* --------------------- describing a field ----------------------------- */

  // Collect every text clue we can find about what a field is "for".
  const describeField = (el) => {
    const clues = [];
    const push = (v) => v && clues.push(v.toString());

    push(el.name);
    push(el.id);
    push(el.getAttribute("placeholder"));
    push(el.getAttribute("aria-label"));
    push(el.getAttribute("autocomplete"));
    push(el.getAttribute("title"));

    // data-* attributes often carry the real field name in custom apps.
    for (const attr of el.attributes) {
      if (attr.name.startsWith("data-")) push(attr.value), push(attr.name.slice(5));
    }

    // <label for="id">
    if (el.id) {
      document.querySelectorAll(`label[for="${CSS.escape(el.id)}"]`).forEach((l) =>
        push(l.textContent)
      );
    }
    // wrapping <label>
    const wrapping = el.closest("label");
    if (wrapping) push(wrapping.textContent);

    // aria-labelledby -> referenced element text
    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      labelledby.split(/\s+/).forEach((rid) => {
        const ref = document.getElementById(rid);
        if (ref) push(ref.textContent);
      });
    }

    // Nearby text: a preceding label-like sibling or the parent's leading text.
    const parent = el.parentElement;
    if (parent) {
      const prev = el.previousElementSibling;
      if (prev && /label|span|div|p|strong/i.test(prev.tagName) && prev.textContent.length < 60) {
        push(prev.textContent);
      }
    }

    return clues.map((c) => c.replace(/\s+/g, " ").trim()).filter(Boolean);
  };

  /* ----------------------- matching profile -> field -------------------- */

  // Synonyms let "email" match a field labelled "e-mail address", etc.
  const SYNONYMS = {
    firstname: ["first", "fname", "givenname", "forename", "given"],
    lastname: ["last", "lname", "surname", "familyname", "family"],
    fullname: ["name", "fullname", "yourname", "applicantname"],
    email: ["email", "emailaddress", "mail", "email"],
    phone: ["phone", "telephone", "tel", "mobile", "cell", "contactnumber", "phonenumber"],
    address: ["address", "street", "addressline", "addr"],
    address2: ["address2", "addressline2", "apt", "suite", "unit"],
    city: ["city", "town", "municipality"],
    state: ["state", "province", "region"],
    zip: ["zip", "zipcode", "postal", "postalcode", "postcode"],
    country: ["country", "nation"],
    company: ["company", "organization", "organisation", "employer", "business"],
    dob: ["dob", "dateofbirth", "birthdate", "birthday"],
    nationalid: ["nationalid", "ssn", "nid", "idnumber", "nationalidnumber", "identitynumber"],
    passport: ["passport", "passportnumber"],
    gender: ["gender", "sex"],
    title: ["title", "salutation", "prefix"],
    website: ["website", "url", "homepage", "web"],
    occupation: ["occupation", "job", "jobtitle", "profession", "position"],
  };

  // Build a flat lookup of every synonym token -> canonical key.
  const synonymTokens = (key) => {
    const nk = normalize(key);
    const out = new Set([nk, ...tokenize(key)]);
    for (const [canon, list] of Object.entries(SYNONYMS)) {
      if (canon === nk || list.includes(nk) || list.some((s) => nk.includes(s))) {
        out.add(canon);
        list.forEach((s) => out.add(s));
      }
    }
    return out;
  };

  // Score how well a profile key matches a field's clues. 0 = no match.
  const scoreMatch = (key, clues) => {
    const keyTokens = synonymTokens(key);
    const keyNorm = normalize(key);
    let best = 0;

    for (const clue of clues) {
      const clueNorm = normalize(clue);
      const clueTokens = new Set(tokenize(clue));
      let score = 0;

      // Exact normalized equality is the strongest signal.
      if (clueNorm === keyNorm) score = Math.max(score, 100);

      // Whole key contained in clue (or vice versa).
      if (clueNorm.includes(keyNorm) && keyNorm.length >= 3) score = Math.max(score, 70);
      if (keyNorm.includes(clueNorm) && clueNorm.length >= 3) score = Math.max(score, 55);

      // Token overlap, including synonyms.
      let overlap = 0;
      for (const t of keyTokens) {
        if (t.length < 2) continue;
        if (clueTokens.has(t)) overlap += 2;
        else if (clueNorm.includes(t)) overlap += 1;
      }
      if (overlap) score = Math.max(score, Math.min(60, 25 + overlap * 8));

      best = Math.max(best, score);
    }
    return best;
  };

  /* --------------------------- test data -------------------------------- */

  const SAMPLE = {
    text: "Sample Text",
    email: "test.user@example.com",
    tel: "+15551234567",
    url: "https://example.com",
    number: "42",
    search: "sample",
    password: "Passw0rd!23",
    date: new Date().toISOString().slice(0, 10),
    "datetime-local": new Date().toISOString().slice(0, 16),
    month: new Date().toISOString().slice(0, 7),
    week: "2026-W24",
    time: "09:30",
    color: "#3366ff",
    range: null, // handled specially
  };

  const guessTestValue = (el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "textarea") return "This is sample test content for the field.";
    const type = (el.type || "text").toLowerCase();
    if (type in SAMPLE && SAMPLE[type] !== null) {
      // Refine by clue when type is generic "text".
      if (type === "text") {
        const clues = describeField(el).map(normalize).join(" ");
        if (/email/.test(clues)) return SAMPLE.email;
        if (/phone|tel|mobile/.test(clues)) return SAMPLE.tel;
        if (/zip|postal/.test(clues)) return "10001";
        if (/city/.test(clues)) return "Springfield";
        if (/first/.test(clues)) return "Alex";
        if (/last|surname/.test(clues)) return "Morgan";
        if (/name/.test(clues)) return "Alex Morgan";
        if (/address|street/.test(clues)) return "123 Main Street";
      }
      return SAMPLE[type];
    }
    return "Sample";
  };

  /* ------------------------ filling each type --------------------------- */

  const fillTextLike = (el, value) => {
    el.focus();
    setNativeValue(el, value);
    fireEvents(el, ["input", "change", "blur"]);
    return true;
  };

  const fillContentEditable = (el, value) => {
    el.focus();
    el.textContent = value;
    fireEvents(el, ["input", "change", "blur"]);
    return true;
  };

  const fillSelect = (el, value) => {
    const want = normalize(value);
    const wantTokens = new Set(tokenize(value));
    let chosen = null;
    let bestScore = 0;
    for (const opt of el.options) {
      const candidates = [opt.value, opt.textContent, opt.label];
      for (const c of candidates) {
        const cn = normalize(c);
        if (!cn) continue;
        let s = 0;
        if (cn === want) s = 100;
        else if (cn.includes(want) || want.includes(cn)) s = 60;
        else {
          const ct = new Set(tokenize(c));
          let ov = 0;
          wantTokens.forEach((t) => ct.has(t) && (ov += 1));
          if (ov) s = 30 + ov * 10;
        }
        if (s > bestScore) {
          bestScore = s;
          chosen = opt;
        }
      }
    }
    if (chosen && bestScore >= 30) {
      el.focus();
      setNativeValue(el, chosen.value);
      fireEvents(el, ["input", "change", "blur"]);
      return true;
    }
    return false;
  };

  const fillRadioGroup = (radios, value) => {
    const want = normalize(value);
    for (const r of radios) {
      const clues = [r.value, ...describeField(r)].map(normalize);
      if (clues.some((c) => c === want || (c && (c.includes(want) || want.includes(c))))) {
        r.focus();
        r.checked = true;
        fireEvents(r, ["input", "change", "click"]);
        return true;
      }
    }
    return false;
  };

  const truthy = (v) => {
    const s = normalize(v);
    return s === "true" || s === "yes" || s === "1" || s === "on" || s === "checked";
  };

  const fillCheckbox = (el, value) => {
    const shouldCheck = value === true || truthy(value);
    if (el.checked !== shouldCheck) {
      el.focus();
      el.checked = shouldCheck;
      fireEvents(el, ["input", "change", "click"]);
    }
    return true;
  };

  /* --------------------------- main fill -------------------------------- */

  const collectFields = () => {
    const nodes = Array.from(
      document.querySelectorAll(
        "input, textarea, select, [contenteditable=''], [contenteditable='true']"
      )
    );
    return nodes.filter((el) => {
      if (el.disabled || el.readOnly) return false;
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (["hidden", "submit", "reset", "button", "image", "file"].includes(type)) return false;
      return isVisible(el);
    });
  };

  const run = ({ profile, mode, overwrite }) => {
    const result = { filled: 0, skipped: 0, details: [] };
    const fields = collectFields();

    // Radio groups are handled once per name, not per element.
    const handledRadioGroups = new Set();

    // Explicit selector overrides take top priority: profile["__selectors__"]
    // is { "css selector": "value" }.
    const selectorMap = (profile && profile.__selectors__) || {};
    for (const [sel, value] of Object.entries(selectorMap)) {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          if (applyValue(el, value, overwrite, handledRadioGroups)) result.filled++;
        });
      } catch (e) {
        /* invalid selector, ignore */
      }
    }

    const profileEntries = Object.entries(profile || {}).filter(([k]) => k !== "__selectors__");

    for (const el of fields) {
      const tag = el.tagName.toLowerCase();
      const type = (el.type || "").toLowerCase();

      // Skip radios whose group was already filled.
      if (type === "radio" && el.name && handledRadioGroups.has(el.name)) continue;

      // Already has a value and we're not overwriting.
      const hasValue =
        (tag === "select" && el.value) ||
        (type === "checkbox" || type === "radio" ? false : el.value) ||
        (el.isContentEditable && el.textContent.trim());
      if (hasValue && !overwrite) {
        result.skipped++;
        continue;
      }

      if (mode === "test") {
        if (fillByType(el, guessTestValueForControl(el), handledRadioGroups)) result.filled++;
        else result.skipped++;
        continue;
      }

      // mode === "profile": find the best-matching profile key.
      const clues = describeField(el);
      let bestKey = null;
      let bestScore = 0;
      for (const [key, value] of profileEntries) {
        if (value === "" || value === null || value === undefined) continue;
        const s = scoreMatch(key, clues);
        if (s > bestScore) {
          bestScore = s;
          bestKey = key;
        }
      }
      if (bestKey && bestScore >= 25) {
        if (applyValue(el, profile[bestKey], overwrite, handledRadioGroups)) {
          result.filled++;
          result.details.push({ field: clues[0] || el.name || el.id, key: bestKey, score: bestScore });
        } else {
          result.skipped++;
        }
      } else {
        result.skipped++;
      }
    }
    return result;
  };

  // Pick a sensible test value for a control, including selects/radios.
  const guessTestValueForControl = (el) => {
    const tag = el.tagName.toLowerCase();
    const type = (el.type || "").toLowerCase();
    if (tag === "select") {
      const real = Array.from(el.options).find((o) => o.value && !o.disabled);
      return real ? real.value : "";
    }
    if (type === "checkbox") return true;
    if (type === "radio") return el.value || "on";
    return guessTestValue(el);
  };

  // Route a value to the correct fill routine based on the control type.
  const applyValue = (el, value, overwrite, handledRadioGroups) =>
    fillByType(el, value, handledRadioGroups);

  const fillByType = (el, value, handledRadioGroups) => {
    const tag = el.tagName.toLowerCase();
    const type = (el.type || "").toLowerCase();

    if (el.isContentEditable) return fillContentEditable(el, value);
    if (tag === "select") return fillSelect(el, value);
    if (type === "checkbox") return fillCheckbox(el, value);
    if (type === "radio") {
      if (!el.name) {
        el.checked = true;
        fireEvents(el, ["input", "change", "click"]);
        return true;
      }
      const group = Array.from(document.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`));
      const ok = fillRadioGroup(group, value);
      if (ok) handledRadioGroups.add(el.name);
      return ok;
    }
    return fillTextLike(el, value);
  };

  /* --------------------------- messaging -------------------------------- */

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.action === "fill") {
      try {
        const result = run({
          profile: msg.profile || {},
          mode: msg.mode || "profile",
          overwrite: !!msg.overwrite,
        });
        sendResponse({ ok: true, ...result });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    } else if (msg && msg.action === "scan") {
      // Report what we'd target, without filling — useful for debugging a form.
      const fields = collectFields().map((el) => ({
        tag: el.tagName.toLowerCase(),
        type: el.type || "",
        name: el.name || "",
        id: el.id || "",
        clues: describeField(el).slice(0, 4),
      }));
      sendResponse({ ok: true, count: fields.length, fields });
    }
    return true; // keep the message channel open for the async response
  });
})();
