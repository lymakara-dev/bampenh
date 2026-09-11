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
  // Guard against duplicate event listeners, but allow re-injection to refresh functions
  const alreadyLoaded = !!window.__UNIVERSAL_AUTOFILL_LOADED__;
  window.__UNIVERSAL_AUTOFILL_LOADED__ = true;

  /* ----------------------------- utilities ------------------------------ */

  // Lowercase + strip everything that isn't a letter or number.
  const normalize = (s) => (s || "").toString().toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

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
    let setter = null;
    const win = element.ownerDocument?.defaultView || window;
    if (typeof win.HTMLInputElement !== "undefined" && element instanceof win.HTMLInputElement) {
      setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")?.set;
    } else if (typeof win.HTMLTextAreaElement !== "undefined" && element instanceof win.HTMLTextAreaElement) {
      setter = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")?.set;
    } else if (typeof win.HTMLSelectElement !== "undefined" && element instanceof win.HTMLSelectElement) {
      setter = Object.getOwnPropertyDescriptor(win.HTMLSelectElement.prototype, "value")?.set;
    }
    if (setter) {
      setter.call(element, value);
    } else {
      const proto = Object.getPrototypeOf(element);
      const ownDesc = Object.getOwnPropertyDescriptor(element, "value");
      const protoDesc = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
      const ownSetter = ownDesc && ownDesc.set;
      const protoSetter = protoDesc && protoDesc.set;
      if (protoSetter && ownSetter !== protoSetter) {
        protoSetter.call(element, value);
      } else if (ownSetter) {
        ownSetter.call(element, value);
      } else {
        element.value = value;
      }
    }
  };

  // Fire the sequence of events that frameworks and validators listen for.
  // "input" goes out as a real InputEvent — many validators ignore a plain
  // Event and only react to InputEvent with an inputType.
  const fireEvents = (el, types) => {
    types.forEach((type) => {
      let evt;
      if (type === "input") {
        try {
          evt = new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: typeof el.value === "string" ? el.value : null,
          });
        } catch (_) {
          evt = new Event("input", { bubbles: true, cancelable: true });
        }
      } else {
        evt = new Event(type, { bubbles: true, cancelable: true });
      }
      el.dispatchEvent(evt);
    });
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // scrollIntoView isn't implemented everywhere (and not in test DOMs); never
  // let it abort a fill.
  const safeScrollIntoView = (el, opts) => {
    try {
      if (el && typeof el.scrollIntoView === "function") el.scrollIntoView(opts);
    } catch (_) {
      /* ignore */
    }
  };

  // Custom dropdowns open/close on real pointer+mouse sequences, not just a
  // bare .click(). Dispatch the full sequence so libraries react.
  const simulateClick = (el) => {
    const opts = { bubbles: true, cancelable: true, view: window };
    ["pointerdown", "mousedown", "mouseup", "click"].forEach((type) => {
      try {
        el.dispatchEvent(new MouseEvent(type, opts));
      } catch (_) {
        /* MouseEvent unsupported for type — ignore */
      }
    });
  };

  // Dispatch a full key press. Set both `key` and the legacy keyCode/which so
  // libraries that read either (e.g. vue-select) respond.
  const pressKey = (el, key, keyCode) => {
    const opts = { bubbles: true, cancelable: true, key, keyCode, which: keyCode, view: window };
    ["keydown", "keypress", "keyup"].forEach((type) => {
      try {
        el.dispatchEvent(new KeyboardEvent(type, opts));
      } catch (_) {
        /* ignore */
      }
    });
  };

  /* --------------------- describing a field ----------------------------- */

  // Collect every text clue we can find about what a field is "for".
  const describeField = (el) => {
    const clues = [];
    const push = (v) => v && clues.push(v.toString());

    push(el.name);
    push(el.id);
    push(el.className);
    push(el.getAttribute("placeholder"));
    push(el.getAttribute("aria-label"));
    push(el.getAttribute("aria-placeholder"));
    push(el.getAttribute("autocomplete"));
    push(el.getAttribute("title"));
    push(el.getAttribute("data-maska"));

    const container = el.closest('.form-input-container');
    if (container) {
      const lbl = container.querySelector('.form-title label');
      if (lbl) push(lbl.textContent);
    }

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
    cardnumber: [
      "cardnumber",
      "card_number",
      "cardno",
      "card_no",
      "cardnum",
      "card_num",
      "creditcard",
      "creditcardnumber",
      "credit_card",
      "credit_card_number",
      "debitcard",
      "visacard",
      "ccnumber",
      "cc_number",
      "ccnum",
      "cc_num",
      "cclast4",
      "pan",
      "accountnumber",
      "account_number",
      "input-card-number",
      "លេខកាត",
      "លេខប័ណ្ណ",
      "កាតឥណទាន",
      "កាតឥណពន្ធ",
      "កាត",
    ],
    cardexp: [
      "cardexp",
      "card_exp",
      "ccexp",
      "cc_exp",
      "expiry",
      "expiration",
      "expdate",
      "exp_date",
      "expirationdate",
      "expiration_date",
      "validthru",
      "valid_thru",
      "mmyy",
      "input-card-expired",
      "កាលបរិច្ឆេទផុតកំណត់",
      "ថ្ងៃផុតកំណត់",
      "ផុតកំណត់",
    ],
    cardmonth: [
      "cardmonth",
      "card_month",
      "expmonth",
      "exp_month",
      "expirymonth",
      "expiry_month",
      "ccmonth",
      "cc_month",
      "ccexpmonth",
      "ccexpmo",
      "expiremonth",
      "expire_month",
      "ខែផុតកំណត់",
    ],
    cardyear: [
      "cardyear",
      "card_year",
      "expyear",
      "exp_year",
      "expiryyear",
      "expiry_year",
      "ccyear",
      "cc_year",
      "ccexpyear",
      "ccexpyr",
      "expireyear",
      "expire_year",
      "ឆ្នាំផុតកំណត់",
    ],
    cardcvv: [
      "cardcvv",
      "card_cvv",
      "cvv",
      "cvc",
      "csc",
      "cid",
      "cvv2",
      "cvc2",
      "securitycode",
      "security_code",
      "verificationcode",
      "verification_code",
      "cardcode",
      "card_code",
      "cccvv",
      "cc_cvv",
      "cccvc",
      "cc_cvc",
      "input-card-cvv",
      "កូដសុវត្ថិភាព",
      "លេខសម្ងាត់កាត",
      "លេខកូដសម្ងាត់",
    ],
    cardholder: [
      "cardholder",
      "card_holder",
      "cardholdername",
      "cardholder_name",
      "nameoncard",
      "name_on_card",
      "cardname",
      "card_name",
      "ccname",
      "cc_name",
      "cardowner",
      "card_owner",
      "ឈ្មោះម្ចាស់កាត",
      "ឈ្មោះលើកាត",
      "ឈ្មោះម្ចាស់ប័ណ្ណ",
    ],
    cardtype: [
      "cardtype",
      "card_type",
      "cardbrand",
      "card_brand",
      "cctype",
      "cc_type",
      "paymenttype",
      "paymentmethod",
      "paymentoption",
      "payment_option",
      "វិធីសាស្ត្រទូទាត់",
      "ជម្រើសបង់ប្រាក់",
      "ប្រភេទកាត",
    ],
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

  /* --------------------------- visa card support ----------------------- */

  const VISA_CARD = {
    holder: "Visa Card",
    numberSpaced: "4286 0900 0000 0206",
    numberClean: "4286090000000206",
    exp: "04/30",
    expClean: "0430",
    expSpaced: "04 / 30",
    expFullYear: "04/2030",
    month: "04",
    monthNum: "4",
    year: "30",
    yearFull: "2030",
    cvv: "777",
    brand: "Visa",
  };

  const getCardNumberPartIndex = (el) => {
    if (!el) return -1;
    const raw = [el.name, el.id, el.getAttribute("data-index")].filter(Boolean).join(" ").toLowerCase();
    const m = raw.match(/(?:card|cc|pan|num).*?(?:[_\-[\]\s]*([1-4]|[0-3]))$/i) ||
              raw.match(/(?:part|box|chunk)[_\-[\]\s]*([1-4]|[0-3])/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 4) return n - 1;
      if (n >= 0 && n <= 3) return n;
    }
    const parent = el.closest(".card-number, .card_number, .cc-number, fieldset, .form-group, div");
    if (parent) {
      const inputs = Array.from(parent.querySelectorAll('input:not([type="hidden"])'));
      if (inputs.length === 4 && inputs.every((inp) => inp.maxLength === 4 || inp.size === 4)) {
        return inputs.indexOf(el);
      }
    }
    return -1;
  };

  const classifyCardField = (el) => {
    if (!el) return null;
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute("type") || el.type || "").toLowerCase();
    if (["hidden", "submit", "reset", "button", "image", "file"].includes(type)) return null;

    const autocomplete = (el.getAttribute("autocomplete") || "").toLowerCase();
    if (autocomplete === "cc-number") return "cardnumber";
    if (autocomplete === "cc-exp") return "cardexp";
    if (autocomplete === "cc-exp-month") return "cardmonth";
    if (autocomplete === "cc-exp-year") return "cardyear";
    if (autocomplete === "cc-csc" || autocomplete === "cc-cvv") return "cardcvv";
    if (autocomplete === "cc-name") return "cardholder";
    if (autocomplete === "cc-type") return "cardtype";

    const clues = describeField(el);
    const raw = clues.join(" ").toLowerCase();

    // 1. CVV / CVC / Security code (check first to avoid card number matching "card security code")
    if (
      /(?:\b|^)(?:cvv|cvc|csc|cid|cvv2|cvc2)(?:\b|$)/i.test(raw) ||
      /(?:security|verification|cvv|cvc|csc)[\s_-]*code/i.test(raw) ||
      /card[\s_-]*verification/i.test(raw) ||
      /card[\s_-]*code/i.test(raw) ||
      /security[\s_-]*number/i.test(raw) ||
      /(?:input-card-cvv|card-cvv|pw-input-card-cvv)/i.test(raw) ||
      /(?:កូដសុវត្ថិភាព|លេខសម្ងាត់កាត|លេខកូដសម្ងាត់)/i.test(raw)
    ) {
      return "cardcvv";
    }

    // 2. Cardholder Name (check before card number and generic name)
    if (
      /card[\s_-]*holder/i.test(raw) ||
      /name[\s_-]*on[\s_-]*card/i.test(raw) ||
      /card[\s_-]*name/i.test(raw) ||
      /cc[\s_-]*name/i.test(raw) ||
      /card[\s_-]*owner/i.test(raw) ||
      (/owner[\s_-]*name/i.test(raw) && /card|credit|payment/i.test(raw)) ||
      /(?:ឈ្មោះម្ចាស់កាត|ឈ្មោះលើកាត|ឈ្មោះម្ចាស់ប័ណ្ណ)/i.test(raw)
    ) {
      return "cardholder";
    }

    // 3. Card Type / Brand (select or radio)
    if (tag === "select" || type === "radio" || (typeof isCustomDropdown === "function" && isCustomDropdown(el))) {
      if (
        /card[\s_-]*(?:type|brand)|credit[\s_-]*card[\s_-]*type|payment[\s_-]*(?:method|type|option)/i.test(raw) ||
        /(?:វិធីសាស្ត្រទូទាត់|ជម្រើសបង់ប្រាក់|ប្រភេទកាត)/i.test(raw)
      ) {
        return "cardtype";
      }
    }

    // 4. Expiration Date (combined Month & Year)
    if (
      autocomplete === "cc-exp" ||
      /mm\s*[\/\-]\s*yy/i.test(raw) ||
      /\bmmyy\b/i.test(raw) ||
      /\b(?:validthru|valid_thru|valid-thru|ccexp|cardexp|card_exp|card-exp|expdate|expiry_date)\b/i.test(raw) ||
      /(?:input-card-expired|card-expired|pw-input-card-expired)/i.test(raw) ||
      (/(?:exp|expiry|expiration)[\s_-]*date/i.test(raw) && !/(?:month|year)/i.test(raw)) ||
      (/(?:exp|expiry|expiration)/i.test(raw) && !/(?:month|year)/i.test(raw) && tag !== "select") ||
      /(?:កាលបរិច្ឆេទផុតកំណត់|ថ្ងៃផុតកំណត់|ផុតកំណត់)/i.test(raw)
    ) {
      return "cardexp";
    }

    // 5. Expiration Month
    if (
      autocomplete === "cc-exp-month" ||
      /(?:exp|expiry|expiration)[\s_-]*month/i.test(raw) ||
      /\b(?:expmonth|exp_month|exp-month|ccexpmonth|ccexpmo|cardmonth|expiry_month)\b/i.test(raw) ||
      ((/\bmonth\b/i.test(raw) || (/\bmm\b/i.test(raw) && !/\byy\b/i.test(raw))) &&
        /(?:card|cc|credit|debit|payment|exp|expiry)/i.test(raw) &&
        !/(?:year|yy)/i.test(raw))
    ) {
      return "cardmonth";
    }

    // 6. Expiration Year
    if (
      autocomplete === "cc-exp-year" ||
      /(?:exp|expiry|expiration)[\s_-]*year/i.test(raw) ||
      /\b(?:expyear|exp_year|exp-year|ccexpyear|ccexpyr|cardyear|expiry_year)\b/i.test(raw) ||
      ((/\byear\b/i.test(raw) || /\byyyy\b/i.test(raw) || (/\byy\b/i.test(raw) && !/\bmm\b/i.test(raw))) &&
        /(?:card|cc|credit|debit|payment|exp|expiry)/i.test(raw) &&
        !/(?:month|mm)/i.test(raw))
    ) {
      return "cardyear";
    }

    // 7. Card Number
    const isExcluded =
      /(?:gift|reward|member|identity|national|student|loyalty|id[\s_-]*card|id_number|nid)/i.test(raw) &&
      !/(?:credit|debit|visa|mastercard|cc)/i.test(raw);

    if (!isExcluded) {
      if (getCardNumberPartIndex(el) !== -1) return "cardnumber";
      if (
        /(?:credit|debit|payment|visa|mastercard)[\s_-]*card[\s_-]*(?:number|no|num|#)?/i.test(raw) ||
        /card[\s_-]*(?:number|no|num|#|digits)/i.test(raw) ||
        /\b(?:cardnumber|cardno|cardnum|ccnumber|ccnum|cclast4|pan)\b/i.test(raw) ||
        /credit[\s_-]*card/i.test(raw) ||
        /\b(?:cc[\s_-]*num|cc[\s_-]*no)\b/i.test(raw) ||
        /(?:input-card-number|card-number|pw-input-card-number)/i.test(raw) ||
        /(?:លេខកាត|លេខប័ណ្ណ|កាតឥណទាន|កាតឥណពន្ធ)/i.test(raw)
      ) {
        return "cardnumber";
      }
      const ph = (el.getAttribute("placeholder") || "").toLowerCase();
      if (/••••|0000[\s\-]*0000|1234[\s\-]*5678|4286/.test(ph)) {
        return "cardnumber";
      }
    }

    return null;
  };

  const getVisaCardValue = (cardField, el) => {
    const tag = el ? el.tagName.toLowerCase() : "";
    const type = el ? (el.type || "").toLowerCase() : "";
    const maxLen = el && el.maxLength > 0 ? el.maxLength : 0;
    const ph = el ? (el.getAttribute("placeholder") || "").toLowerCase() : "";
    const maska = el ? (el.getAttribute("data-maska") || "").toLowerCase() : "";

    switch (cardField) {
      case "cardnumber": {
        const partIdx = getCardNumberPartIndex(el);
        if (partIdx !== -1) {
          const parts = ["4286", "0900", "0000", "0206"];
          return parts[partIdx];
        }
        if (type === "number" || (maxLen > 0 && maxLen < 19)) {
          return VISA_CARD.numberClean;
        }
        return VISA_CARD.numberSpaced;
      }
      case "cardexp": {
        if (maxLen === 4 || /mmyy/i.test(ph)) {
          return VISA_CARD.expClean;
        }
        if (/yyyy/i.test(ph) || (maxLen === 7 && /yyyy/i.test(ph))) {
          return VISA_CARD.expFullYear;
        }
        if (/mm\s*\/\s*yy/i.test(ph) || /##\s*\/\s*##/.test(maska) || maska.includes(" / ") || ph.includes(" / ")) {
          return VISA_CARD.expSpaced;
        }
        return VISA_CARD.exp;
      }
      case "cardmonth": {
        if (tag === "select") return VISA_CARD.month;
        if (maxLen === 1) return VISA_CARD.monthNum;
        return VISA_CARD.month;
      }
      case "cardyear": {
        if (tag === "select") return VISA_CARD.yearFull;
        if (maxLen === 4 || /yyyy/i.test(ph)) return VISA_CARD.yearFull;
        return VISA_CARD.year;
      }
      case "cardcvv":
        return VISA_CARD.cvv;
      case "cardholder":
        return VISA_CARD.holder;
      case "cardtype":
        return VISA_CARD.brand;
      default:
        return null;
    }
  };

  /* --------------------------- test data -------------------------------- */

  const SAMPLE = {
    text: "123",
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
    const cardCat = classifyCardField(el);
    if (cardCat) return getVisaCardValue(cardCat, el);

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

  /* --------------------- analyze + suggest values ----------------------- */

  // Classify a field into a semantic category from its clues + type. This is
  // what powers the "analyze the page and suggest a value" feature: we read
  // every clue the field exposes and decide what kind of data it wants.
  const classifyField = (el) => {
    const cardCat = classifyCardField(el);
    if (cardCat) return cardCat;

    const type = (el.type || "").toLowerCase();
    const tag = el.tagName.toLowerCase();
    if (type === "email") return "email";
    if (type === "tel") return "phone";
    if (type === "url") return "url";
    if (type === "password") return "password";
    if (type === "number" || type === "range") return "number";
    if (type === "date") return "date";
    if (type === "datetime-local") return "datetime";
    if (type === "month") return "month";
    if (type === "week") return "week";
    if (type === "time") return "time";
    if (type === "color") return "color";

    const text = describeField(el).map(normalize).join(" ");
    // Order matters: more specific patterns first.
    if (/\bemail|\bmail\b/.test(text)) return "email";
    if (/firstname|givenname|forename/.test(text) || /\bfirst\b/.test(text)) return "firstname";
    if (/lastname|surname|familyname/.test(text) || /\blast\b/.test(text)) return "lastname";
    if (/middlename/.test(text)) return "middlename";
    if (/username|userid|login|handle/.test(text)) return "username";
    if (/fullname|yourname|applicantname|contactname/.test(text) || /\bname\b/.test(text)) return "fullname";
    if (/phone|mobile|telephone|\btel\b|cell|contactnumber/.test(text)) return "phone";
    if (/company|organi[sz]ation|employer|business/.test(text)) return "company";
    if (/occupation|jobtitle|profession|position|\brole\b/.test(text)) return "occupation";
    if (/addressline2|address2|\bapt\b|suite|\bunit\b/.test(text)) return "address2";
    if (/address|street|addressline/.test(text)) return "address";
    if (/city|town|municipality/.test(text)) return "city";
    if (/province|\bstate\b|region/.test(text)) return "state";
    if (/zip|postal|postcode/.test(text)) return "zip";
    if (/country|nation/.test(text)) return "country";
    if (/dateofbirth|birthdate|birthday|\bdob\b/.test(text)) return "dob";
    if (/\bdate\b|calendar/.test(text)) return "date";
    if (/gender|\bsex\b/.test(text)) return "gender";
    if (/nationalid|\bssn\b|\bnid\b|idnumber|identitynumber/.test(text)) return "nationalid";
    if (/passport/.test(text)) return "passport";
    if (/website|homepage|\burl\b|\bweb\b/.test(text)) return "url";
    if (/\bage\b/.test(text)) return "age";
    if (/\bzipcode\b|\bcode\b|\botp\b|\bpin\b/.test(text)) return "code";
    if (/quantity|\bqty\b|amount|\bnumber\b/.test(text)) return "number";
    if (/comment|message|description|\bbio\b|about|note|feedback|remark/.test(text)) return "paragraph";
    if (/title|salutation|prefix/.test(text)) return "title";
    if (/search|query/.test(text)) return "search";

    if (tag === "textarea") return "paragraph";
    if (tag === "select") return "select";
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    return "text";
  };

  // A realistic sample value for each semantic category.
  const SAMPLES_BY_CATEGORY = {
    cardnumber: VISA_CARD.numberSpaced,
    cardexp: VISA_CARD.exp,
    cardmonth: VISA_CARD.month,
    cardyear: VISA_CARD.year,
    cardcvv: VISA_CARD.cvv,
    cardholder: VISA_CARD.holder,
    cardtype: VISA_CARD.brand,
    email: "test.user@example.com",
    firstname: "Alex",
    lastname: "Morgan",
    middlename: "Lee",
    fullname: "Alex Morgan",
    username: "alex.morgan",
    phone: "+1 555 123 4567",
    company: "Example Co.",
    occupation: "Software Engineer",
    address: "123 Main Street",
    address2: "Apt 4B",
    city: "Phnom Penh",
    state: "Phnom Penh",
    zip: "12000",
    country: "Cambodia",
    dob: "1990-05-14",
    gender: "Male",
    nationalid: "012345678",
    passport: "A1234567",
    url: "https://example.com",
    age: "30",
    code: "123456",
    number: "42",
    paragraph: "This is a sample message used to fill out the field for testing.",
    title: "Mr",
    search: "sample query",
    password: "Passw0rd!23",
    date: new Date().toISOString().slice(0, 10),
    datetime: new Date().toISOString().slice(0, 16),
    month: new Date().toISOString().slice(0, 7),
    week: "2026-W24",
    time: "09:30",
    color: "#3366ff",
    text: "Sample Text",
  };

  const isAgreeField = (el) => {
    const name = (el.name || "").toLowerCase();
    const id = (el.id || "").toLowerCase();
    if (/^agree$|^agreed$|^terms$|^agreement$/.test(name) || /^agree$|^agreed$|^terms$|^agreement$/.test(id)) return true;
    const clues = describeField(el).map(normalize).join(" ");
    return /agree|termsandconditions|iagree|agreement|យល់ព្រម/.test(clues);
  };

  // Produce a human-readable suggestion for a control, including selects/radios
  // whose suggestion is one of the options actually on the page.
  const suggestForControl = (el) => {
    const category = classifyField(el);
    const tag = el.tagName.toLowerCase();
    const type = (el.type || "").toLowerCase();

    if (isCustomDropdown(el)) {
      // Probe for already-rendered options (some widgets keep them in the DOM
      // hidden). If found, suggest the first; otherwise leave blank for the
      // user to type the option text they want.
      const opts = findDropdownOptions(el, true);
      const first = opts.find((o) => normalize(o.textContent));
      const text = first ? first.textContent.replace(/\s+/g, " ").trim() : "";
      return { category: "dropdown", value: text, raw: text };
    }
    if (tag === "select") {
      const opt = Array.from(el.options).find((o) => o.value && !o.disabled);
      return { category: "select", value: opt ? (opt.textContent || opt.value).trim() : "", raw: opt ? opt.value : "" };
    }
    if (type === "radio") {
      const group = el.name
        ? Array.from(document.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`))
        : [el];
      const pick = group[0];
      const label = (describeField(pick)[0] || pick.value || "option").trim();
      return { category: "radio", value: label, raw: pick.value || "on" };
    }
    if (type === "checkbox") {
      if (isAgreeField(el)) return { category: "checkbox", value: "Unchecked", raw: false };
      return { category: "checkbox", value: "Checked", raw: true };
    }

    const value = SAMPLES_BY_CATEGORY[category] || SAMPLES_BY_CATEGORY.text;
    return { category, value, raw: value };
  };

  /* ------------------------ filling each type --------------------------- */

  const fillTextLike = (el, value) => {
    el.focus();
    const strVal = String(value);
    const win = el.ownerDocument?.defaultView || window;
    const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value")?.set;

    // For masked fields (e.g. Maska v2 / PayWay card inputs), simulate progressive typing
    const isMasked = el.hasAttribute("data-maska") || (el.className && /card|mask/i.test(el.className));
    if (isMasked && strVal.length > 1) {
      let curr = "";
      for (let i = 0; i < strVal.length; i++) {
        const ch = strVal[i];
        curr += ch;
        try { el.dispatchEvent(new win.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: ch })); } catch (_) {}
        try { el.dispatchEvent(new win.InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: ch })); } catch (_) {}
        if (setter) setter.call(el, curr);
        else el.value = curr;
        try { el.dispatchEvent(new win.InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: ch })); } catch (_) {
          el.dispatchEvent(new win.Event("input", { bubbles: true }));
        }
        try { el.dispatchEvent(new win.KeyboardEvent("keyup", { bubbles: true, cancelable: true, key: ch })); } catch (_) {}
      }
    }

    const lastChar = strVal.slice(-1);
    try {
      el.dispatchEvent(new win.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: lastChar }));
    } catch (_) {}
    try {
      el.dispatchEvent(new win.InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: strVal,
      }));
    } catch (_) {}
    setNativeValue(el, strVal);
    fireEvents(el, ["input"]);
    try {
      el.dispatchEvent(new win.KeyboardEvent("keyup", { bubbles: true, cancelable: true, key: lastChar }));
    } catch (_) {}
    fireEvents(el, ["change", "blur"]);
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

  /* --------------------------- file uploads ----------------------------- */

  // We can't read a file off the user's disk, so we synthesize a tiny, valid
  // placeholder and hand it to the input. The upload widgets in these portals
  // (form-file) wrap a real <input type="file"> and run their upload-to-server
  // handler on `change`, so assigning .files + firing change drives the same
  // flow a manual pick would.

  // 1x1 transparent PNG.
  const PNG_1PX_B64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  // Smallest practical single-page PDF.
  const MINIMAL_PDF =
    "%PDF-1.1\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 300]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF";

  const b64ToBytes = (b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  // A short, unguessable token used to make every synthesized file unique, so
  // we never hand the same bytes/name to the server twice.
  const randToken = () =>
    (Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 12);

  // Build a placeholder File whose type/extension respects the input's `accept`
  // and whose name is derived from the field's label so it's recognizable. Both
  // the name and the bytes carry a random token so no two uploads are identical
  // — portals that dedupe by filename or content hash see a fresh file each time.
  const makeSampleFile = (el) => {
    const accept = (el.getAttribute("accept") || "").toLowerCase();
    const wantsImage = /image\/|\.png|\.jpe?g|\.gif|\.webp|\.bmp/.test(accept);
    const token = randToken();
    const base =
      (describeField(el)[0] || el.name || el.id || "sample")
        .toString()
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^\w.-]/g, "")
        .slice(0, 40) || "sample";
    if (wantsImage) {
      // Append the token after IEND; decoders stop at IEND so the image stays
      // valid while the file's bytes (and hash) differ every time.
      const png = b64ToBytes(PNG_1PX_B64);
      const tag = new TextEncoder().encode(`\n${token}`);
      const bytes = new Uint8Array(png.length + tag.length);
      bytes.set(png, 0);
      bytes.set(tag, png.length);
      return new File([bytes], `${base}_${token}.png`, { type: "image/png" });
    }
    // PDF comments (lines starting with %) are ignored by readers, so the token
    // is a valid, invisible payload that still changes the bytes.
    const pdf = MINIMAL_PDF.replace("%%EOF", `%${token}\n%%EOF`);
    return new File([new Blob([pdf])], `${base}_${token}.pdf`, { type: "application/pdf" });
  };

  const fillFileInput = (el) => {
    if (el.disabled) return false;
    let dt;
    try {
      dt = new DataTransfer();
      dt.items.add(makeSampleFile(el));
    } catch (_) {
      return false; // DataTransfer unsupported (e.g. test DOM) — can't fill files
    }
    try {
      el.files = dt.files;
    } catch (_) {
      return false; // some environments make .files read-only
    }
    if (typeof el.focus === "function") el.focus();
    fireEvents(el, ["input", "change"]);
    return true;
  };

  // File inputs are usually hidden inside an upload widget and are deliberately
  // excluded from collectFields(), so gather them on their own — ignoring
  // visibility, which would otherwise reject the hidden native input.
  const collectFileInputs = () =>
    Array.from(document.querySelectorAll('input[type="file"]')).filter((el) => !el.disabled);

  /* --------------------------- date fields ------------------------------ */

  const pad2 = (n) => String(n).padStart(2, "0");

  const DATE_INPUT_TYPES = new Set(["date", "datetime-local", "month", "week", "time"]);

  // Parse a date string into { year, month, day } (month/day 1-based), trying
  // ISO first, then dd/mm/yyyy or mm/dd/yyyy, then the browser's own parser.
  const parseDateParts = (value) => {
    if (value == null) return null;
    const s = value.toString().trim();
    if (!s) return null;

    // ISO-ish: yyyy-mm-dd (the canonical form native inputs use)
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return { year: +m[1], month: +m[2], day: +m[3] };

    // dd/mm/yyyy or mm/dd/yyyy — ambiguous, so use the obvious tell (a part
    // over 12 must be the day); otherwise assume month-first.
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (m) {
      const a = +m[1];
      const b = +m[2];
      const year = +m[3];
      let month;
      let day;
      if (a > 12) {
        day = a;
        month = b;
      } else if (b > 12) {
        month = a;
        day = b;
      } else {
        month = a;
        day = b;
      }
      return { year, month, day };
    }

    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    }
    return null;
  };

  const parseTimePart = (value) => {
    const m = (value || "").toString().match(/(\d{1,2}):(\d{2})/);
    return m ? `${pad2(+m[1])}:${m[2]}` : null;
  };

  // Read the date order a text field wants from its placeholder, e.g.
  // "DD/MM/YYYY" -> { pattern: "dd/mm/yyyy", sep: "/" }.
  const detectDatePattern = (el) => {
    const sources = [el.getAttribute("placeholder"), el.getAttribute("data-format"), el.getAttribute("title")];
    for (const src of sources) {
      const m = (src || "").match(/[dmy]{1,4}([^dmy\s])[dmy]{1,4}\1[dmy]{1,4}/i);
      if (m) return { pattern: m[0].toLowerCase(), sep: m[1] };
    }
    return null;
  };

  // Render parsed parts into a target pattern (token-by-token so we never trip
  // over mm-vs-m or yyyy-vs-yy ambiguity).
  const formatDateForPattern = (parts, pattern, sep) =>
    pattern
      .split(sep)
      .map((tok) => {
        const t = tok.toLowerCase();
        if (t.startsWith("y")) return t.length <= 2 ? pad2(parts.year % 100) : String(parts.year);
        if (t.startsWith("m")) return t.length >= 2 ? pad2(parts.month) : String(parts.month);
        if (t.startsWith("d")) return t.length >= 2 ? pad2(parts.day) : String(parts.day);
        return tok;
      })
      .join(sep);

  // Is this a date/time control we should handle specially? Covers native
  // date-family inputs and plain text inputs that are really date pickers.
  const isVueDatetime = (el) =>
    (el.classList && el.classList.contains("vdatetime-input")) ||
    (typeof el.closest === "function" && !!el.closest(".vdatetime"));

  const isDateField = (el) => {
    const type = (el.type || "").toLowerCase();
    if (DATE_INPUT_TYPES.has(type)) return true;
    if (el.tagName.toLowerCase() !== "input") return false;
    if (classifyCardField(el) === "cardexp") return false;
    const text = describeField(el).map(normalize).join(" ");
    if (/\b(?:exp|expiry|expiration|ccexp|cardexp|ផុតកំណត់)\b/.test(text)) return false;
    if (isVueDatetime(el)) return true; // vue-datetime: readonly .vdatetime-input
    if (type && type !== "text" && type !== "search") return false;
    if (detectDatePattern(el)) return true;
    return /\bdate\b|\bdob\b|dateofbirth|birthdate|birthday|calendar/.test(text);
  };

  // Month names (and 3-letter prefixes) for reading/setting calendar headers.
  const MONTHS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];

  // Find a day cell for the exact date in an open calendar popup. Matches by
  // aria-label / title / data-* that parse to the same Y/M/D — the reliable
  // signal across libraries (the visible grid only shows one month).
  const findDayCell = (parts) => {
    const sel =
      '[role="gridcell"], td[role], td, [class*="day" i], [class*="cell" i], [aria-label]';
    const cells = Array.from(document.querySelectorAll(sel)).filter(isVisible);
    for (const c of cells) {
      if (c.getAttribute("aria-disabled") === "true") continue;
      const cls = (c.className || "").toString().toLowerCase();
      if (/disabled|outside|other-?month|muted/.test(cls)) continue;
      const label =
        c.getAttribute("aria-label") ||
        c.getAttribute("title") ||
        c.getAttribute("data-date") ||
        c.getAttribute("data-day") ||
        c.getAttribute("data-value") ||
        "";
      if (!label) continue;
      const d = new Date(label);
      if (
        !isNaN(d.getTime()) &&
        d.getFullYear() === parts.year &&
        d.getMonth() === parts.month - 1 &&
        d.getDate() === parts.day
      ) {
        return c;
      }
    }
    return null;
  };

  // Best-effort: steer an open calendar to the target month/year using whatever
  // controls it exposes — year/month <select>s, or prev/next buttons.
  const navigateCalendar = async (parts) => {
    // 1) Year & month <select> elements that appeared in the popup.
    const selects = Array.from(document.querySelectorAll("select")).filter(isVisible);
    for (const s of selects) {
      const opts = Array.from(s.options);
      const yearOpt = opts.find((o) => +o.value === parts.year || o.textContent.trim() === String(parts.year));
      const looksLikeYears = opts.filter((o) => /^\d{4}$/.test(o.textContent.trim())).length >= 3;
      if (yearOpt && looksLikeYears) {
        setNativeValue(s, yearOpt.value);
        fireEvents(s, ["input", "change"]);
        await wait(80);
      }
      const monthOpt = opts.find((o) => {
        const t = o.textContent.trim().toLowerCase();
        return t === MONTHS[parts.month - 1] || t === MONTHS[parts.month - 1].slice(0, 3) || +o.value === parts.month - 1 || +o.value === parts.month;
      });
      const looksLikeMonths = opts.some((o) => MONTHS.includes(o.textContent.trim().toLowerCase()));
      if (monthOpt && looksLikeMonths) {
        setNativeValue(s, monthOpt.value);
        fireEvents(s, ["input", "change"]);
        await wait(80);
      }
    }
    if (findDayCell(parts)) return true;

    // 2) Prev/next buttons — read the shown month/year and step toward target.
    const target = parts.year * 12 + (parts.month - 1);
    const readShown = () => {
      const nodes = Array.from(
        document.querySelectorAll('[class*="header" i],[class*="title" i],[class*="caption" i],[class*="label" i],[aria-live]')
      ).filter(isVisible);
      for (const n of nodes) {
        const t = n.textContent.toLowerCase();
        const m = t.match(/([a-z]{3,})\s*,?\s*(\d{4})/);
        if (m) {
          const mi = MONTHS.findIndex((mn) => mn.startsWith(m[1].slice(0, 3)));
          if (mi >= 0) return +m[2] * 12 + mi;
        }
      }
      return null;
    };
    const btn = (dir) =>
      Array.from(document.querySelectorAll('button,[role="button"],[class*="' + dir + '" i],[aria-label*="' + dir + '" i],[title*="' + dir + '" i]'))
        .filter(isVisible)
        .find((b) => {
          const s = ((b.getAttribute("aria-label") || "") + " " + (b.getAttribute("title") || "") + " " + (b.className || "")).toLowerCase();
          return s.includes(dir);
        });
    for (let i = 0; i < 30; i++) {
      const shown = readShown();
      if (shown == null) break;
      if (shown === target) break;
      const b = btn(shown < target ? "next" : "prev");
      if (!b) break;
      simulateClick(b);
      await wait(70);
    }
    return !!findDayCell(parts);
  };

  // Open a calendar picker and click the target day. Used for readonly /
  // calendar-only date fields where typing a value isn't possible.
  const fillViaCalendar = async (el, parts) => {
    safeScrollIntoView(el, { block: "center", inline: "nearest" });
    simulateClick(el);
    // Some widgets open from an adjacent icon/button rather than the input.
    const sibTrigger =
      el.parentElement &&
      el.parentElement.querySelector(
        'button,[class*="icon" i],[class*="calendar" i],[aria-label*="calendar" i],[aria-label*="date" i]'
      );
    if (sibTrigger && sibTrigger !== el) simulateClick(sibTrigger);

    let cell = null;
    for (let attempt = 0; attempt < 5 && !cell; attempt++) {
      await wait(120);
      cell = findDayCell(parts);
    }
    if (!cell) {
      await navigateCalendar(parts);
      cell = findDayCell(parts);
    }
    if (cell) {
      safeScrollIntoView(cell, { block: "nearest" });
      simulateClick(cell);
      await wait(40);
      return true;
    }
    return false;
  };

  // Drive a vue-datetime picker: open it, set the year via the year picker,
  // step months with the prev/next arrows, then click the day. The wrapper uses
  // the `auto` prop, so clicking a day commits without an OK button.
  const fillVueDatetime = async (el, parts) => {
    safeScrollIntoView(el, { block: "center", inline: "nearest" });
    simulateClick(el);
    let popup = null;
    for (let i = 0; i < 5 && !popup; i++) {
      await wait(150);
      popup = document.querySelector(".vdatetime-popup");
    }
    if (!popup) return false;

    // 1) Year — click the year header to open the year list, then the target.
    const yearHeader = popup.querySelector(".vdatetime-popup__year");
    if (yearHeader && yearHeader.textContent.trim() !== String(parts.year)) {
      simulateClick(yearHeader);
      await wait(150);
      const yearItem = Array.from(document.querySelectorAll(".vdatetime-year-picker__item, .vdatetime-popup__list-picker-item")).find(
        (it) => it.textContent.trim() === String(parts.year)
      );
      if (yearItem) {
        safeScrollIntoView(yearItem, { block: "center" });
        simulateClick(yearItem);
        await wait(180);
      }
    }

    // 2) Month — read the header (locale month name + year) and step toward it.
    const readHeader = () => {
      const h = document.querySelector(".vdatetime-calendar__current--month");
      if (!h) return null;
      const t = h.textContent.toLowerCase();
      const monthIdx = MONTHS.findIndex((m) => t.includes(m.slice(0, 3)));
      const ym = t.match(/(\d{4})/);
      return { monthIdx, year: ym ? +ym[1] : null };
    };
    const targetAbs = parts.year * 12 + (parts.month - 1);
    for (let i = 0; i < 36; i++) {
      const cur = readHeader();
      if (!cur || cur.monthIdx < 0) break;
      const curAbs = (cur.year != null ? cur.year : parts.year) * 12 + cur.monthIdx;
      if (curAbs === targetAbs) break;
      const dir = curAbs < targetAbs ? "next" : "previous";
      const navBtn = document.querySelector(`.vdatetime-calendar__navigation--${dir}`);
      if (!navBtn) break;
      simulateClick(navBtn);
      await wait(110);
    }

    // 3) Day — match the cell number; `auto` commits on click.
    const days = Array.from(document.querySelectorAll(".vdatetime-calendar__month__day")).filter(isVisible);
    const dayCell = days.find(
      (d) => !/disabled/.test(d.className) && d.textContent.trim() === String(parts.day)
    );
    if (dayCell) {
      simulateClick(dayCell);
      await wait(120);
      // In case `auto` is off, confirm.
      const ok = document.querySelector(".vdatetime-popup__actions__button--confirm");
      if (ok && isVisible(ok)) simulateClick(ok);
      return true;
    }
    return false;
  };

  const fillDateLike = async (el, value) => {
    const type = (el.type || "").toLowerCase();
    const parts = parseDateParts(value);
    if (typeof el.focus === "function") el.focus();

    // vue-datetime: a readonly input backed by a calendar popup.
    if (isVueDatetime(el)) {
      if (!parts) return false;
      return await fillVueDatetime(el, parts);
    }

    // Native inputs only accept their canonical format; an invalid string is
    // silently rejected (value stays ""), which we report as a non-fill.
    if (type === "date") {
      if (!parts) return false;
      setNativeValue(el, `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`);
      fireEvents(el, ["input", "change", "blur"]);
      return el.value !== "";
    }
    if (type === "datetime-local") {
      if (!parts) return false;
      const time = parseTimePart(value) || "00:00";
      setNativeValue(el, `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${time}`);
      fireEvents(el, ["input", "change", "blur"]);
      return el.value !== "";
    }
    if (type === "month") {
      if (!parts) return false;
      setNativeValue(el, `${parts.year}-${pad2(parts.month)}`);
      fireEvents(el, ["input", "change", "blur"]);
      return el.value !== "";
    }
    if (type === "week") {
      setNativeValue(el, value);
      fireEvents(el, ["input", "change", "blur"]);
      return el.value !== "";
    }
    if (type === "time") {
      setNativeValue(el, parseTimePart(value) || value);
      fireEvents(el, ["input", "change", "blur"]);
      return el.value !== "";
    }

    // Text-based date picker. Reformat to the field's pattern when we can read
    // one, else fall back to ISO (the most widely accepted default).
    const det = detectDatePattern(el);
    let out = value;
    if (parts && det) out = formatDateForPattern(parts, det.pattern, det.sep);
    else if (parts) out = `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;

    // Try typing — temporarily lifting readonly, which calendar-only pickers
    // set to block manual entry even though the value is still the form's data.
    const wasReadonly = el.readOnly;
    if (wasReadonly) {
      try {
        el.readOnly = false;
      } catch (_) {
        /* ignore */
      }
    }
    fillTextLike(el, out);
    if (wasReadonly) {
      try {
        el.readOnly = true;
      } catch (_) {
        /* ignore */
      }
    }

    // If the value didn't stick (controlled/calendar-only widget), drive the
    // calendar UI: open it and click the day cell.
    if (!el.value && parts) {
      const ok = await fillViaCalendar(el, parts);
      if (ok) return true;
    }
    return !!el.value;
  };

  /* ----------------------- custom dropdowns ----------------------------- */

  // A non-native dropdown: ARIA combobox/listbox widgets, or anything that
  // pops a listbox/menu (React-Select, MUI Select, Ant Design, etc.).
  const isCustomDropdown = (el) => {
    if (el.tagName.toLowerCase() === "select") return false; // native handled elsewhere
    if (isDateField(el)) return false; // date pickers sometimes use role=combobox
    const role = (el.getAttribute("role") || "").toLowerCase();
    if (role === "combobox" || role === "listbox") return true;
    const haspopup = (el.getAttribute("aria-haspopup") || "").toLowerCase();
    if (haspopup === "listbox" || haspopup === "menu" || haspopup === "true") return true;
    // Library selects: vue-select (.v-select) and Vue Material (.md-select).
    if (typeof el.closest === "function" && el.closest(".v-select, .md-select, .md-field.md-menu, .csel-wrapper, .csel-trigger")) {
      return true;
    }
    return false;
  };

  // Find the option elements for an (open) dropdown. Prefers the listbox the
  // trigger explicitly points at via aria-controls/aria-owns, then any visible
  // listbox/menu, then any role=option on the page as a last resort.
  const findDropdownOptions = (trigger, includeHidden = false) => {
    const out = [];
    const ids = [trigger.getAttribute("aria-controls"), trigger.getAttribute("aria-owns")]
      .filter(Boolean)
      .join(" ")
      .split(/\s+/)
      .filter(Boolean);

    let containers = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (!containers.length) {
      containers = Array.from(
        document.querySelectorAll(
          '[role="listbox"], [role="menu"], .vs__dropdown-menu, .md-menu-content, .md-select-menu, .csel-panel, .country-dropdown'
        )
      ).filter((c) => includeHidden || isVisible(c));
    }
    containers.forEach((c) =>
      out.push(
        ...c.querySelectorAll(
          '[role="option"], [role="menuitem"], li, .vs__dropdown-option, .md-list-item, [class*="option"], .country-item'
        )
      )
    );
    if (!out.length) {
      out.push(...document.querySelectorAll('[role="option"], .vs__dropdown-option, .md-list-item'));
    }

    const seen = new Set();
    return out.filter((o) => {
      if (seen.has(o)) return false;
      seen.add(o);
      if (!o.textContent || !o.textContent.trim()) return false;
      return includeHidden || isVisible(o);
    });
  };

  // Open the dropdown, find the option matching `value`, and click it.
  // With opts.first, just pick the first real option (used for test data).
  const fillCustomDropdown = async (el, value, opts = {}) => {
    const wantFirst = !!opts.first;
    const want = normalize(value);
    if (!want && !wantFirst) return false;

    safeScrollIntoView(el, { block: "center", inline: "nearest" });

    const innerInput =
      el.tagName.toLowerCase() === "input" ? el : el.querySelector('input:not([type="hidden"])');
    const typeTarget = innerInput && !innerInput.readOnly ? innerInput : null;

    // Open the menu. Libraries like vue-select open on the search input's FOCUS
    // (not a bare mousedown), so focus the typeable input; readonly widgets
    // (Vue Material md-select) are click-to-open.
    if (typeTarget) {
      typeTarget.focus();
      fireEvents(typeTarget, ["focus"]);
      if (!wantFirst) {
        // Type to filter the option list.
        setNativeValue(typeTarget, value);
        fireEvents(typeTarget, ["input", "keyup"]);
      } else {
        // Open without filtering and highlight the first option.
        pressKey(typeTarget, "ArrowDown", 40);
      }
    } else {
      simulateClick(el);
    }

    // Whatever happens below, never leave the menu open — a stuck-open dropdown
    // blocks every field after it.
    const closeMenu = () => {
      const tgt = typeTarget || el;
      pressKey(tgt, "Escape", 27);
      try {
        if (typeof tgt.blur === "function") tgt.blur();
      } catch (_) {
        /* ignore */
      }
      // An outside click dismisses menus that close on document click.
      try {
        if (document.body) simulateClick(document.body);
      } catch (_) {
        /* ignore */
      }
    };
    const stillOpen = () => findDropdownOptions(el).length > 0;

    // Options usually render asynchronously — poll briefly for them.
    let options = [];
    for (let attempt = 0; attempt < 6 && options.length === 0; attempt++) {
      await wait(120);
      options = findDropdownOptions(el);
    }
    if (!options.length) {
      closeMenu();
      return false;
    }

    let chosen = null;
    if (wantFirst) {
      chosen = options[0];
    } else {
      let bestScore = 0;
      const wantTokens = new Set(tokenize(value));
      for (const opt of options) {
        const cn = normalize(opt.textContent);
        if (!cn) continue;
        let s = 0;
        if (cn === want) s = 100;
        else if (cn.includes(want) || want.includes(cn)) s = 60;
        else {
          const ct = new Set(tokenize(opt.textContent));
          let ov = 0;
          wantTokens.forEach((t) => ct.has(t) && (ov += 1));
          if (ov) s = 30 + ov * 10;
        }
        if (s > bestScore) {
          bestScore = s;
          chosen = opt;
        }
      }
      if (bestScore < 30) chosen = null;
    }

    if (!chosen) {
      closeMenu();
      return false;
    }

    // 1) Click the option. Most libraries select on mousedown/click.
    safeScrollIntoView(chosen, { block: "nearest" });
    simulateClick(chosen);
    await wait(90);

    // 2) If the menu is still open, the click didn't register as a selection
    // (common with vue-select's blur-to-close timing) — fall back to keyboard.
    if (stillOpen()) {
      const kb = typeTarget || el;
      if (kb && typeof kb.focus === "function") kb.focus();
      if (typeTarget) {
        // Filter to the exact option text, then confirm the highlighted match.
        setNativeValue(typeTarget, chosen.textContent.replace(/\s+/g, " ").trim());
        fireEvents(typeTarget, ["input", "keyup"]);
        await wait(130);
        pressKey(kb, "Enter", 13);
      } else {
        // No typeable input: arrow down to the chosen option, then Enter.
        const cur = findDropdownOptions(el);
        const idx = Math.max(0, cur.indexOf(chosen));
        for (let i = 0; i <= idx; i++) {
          pressKey(kb, "ArrowDown", 40);
          await wait(25);
        }
        pressKey(kb, "Enter", 13);
      }
      await wait(110);
    }

    // 3) Guarantee it's closed before we move on.
    if (stillOpen()) closeMenu();
    return true;
  };

  /* --------------------------- main fill -------------------------------- */

  const collectFields = () => {
    const nodes = Array.from(
      document.querySelectorAll(
        "input, textarea, select, [contenteditable=''], [contenteditable='true']," +
          "[role='combobox'], [role='listbox'], [aria-haspopup='listbox'], .csel-trigger"
      )
    );
    return nodes.filter((el) => {
      if (el.disabled) return false;
      // Readonly fields are normally skipped, except date pickers (readonly to
      // force calendar use) and custom dropdowns (e.g. Vue Material md-select,
      // whose input is readonly) — both of which we fill by clicking.
      if (el.readOnly && !isDateField(el) && !isCustomDropdown(el)) return false;
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (["hidden", "submit", "reset", "button", "image", "file"].includes(type)) return false;
      // Composite widgets (e.g. vue-select) put role=combobox on both a wrapper
      // and the inner search input — keep the input, drop the wrapper. Also drop
      // a listbox that holds the options themselves (it's a menu, not a control).
      const role = (el.getAttribute("role") || "").toLowerCase();
      if (
        (role === "combobox" || role === "listbox") &&
        el.querySelector('input:not([type="hidden"]), [role="option"], li')
      ) {
        return false;
      }
      return isVisible(el);
    });
  };

  /* ------------------------------ clear --------------------------------- */

  // Reset a custom dropdown by clicking its built-in clear ("x") control, if
  // it has one. We can't reliably blank arbitrary widgets otherwise.
  const clearCustomDropdown = (el) => {
    const clearBtn = el.querySelector(
      '[aria-label*="clear" i], [class*="clear" i], [title*="clear" i], [data-icon="close"]'
    );
    if (clearBtn) {
      simulateClick(clearBtn);
      return true;
    }
    return false;
  };

  // Empty a single control, returning true only if it actually changed.
  const clearControl = (el) => {
    const tag = el.tagName.toLowerCase();
    const type = (el.type || "").toLowerCase();

    if (el.isContentEditable && !isCustomDropdown(el)) {
      if (!el.textContent.trim()) return false;
      el.focus();
      el.textContent = "";
      fireEvents(el, ["input", "change", "blur"]);
      return true;
    }
    if (isCustomDropdown(el)) return clearCustomDropdown(el);
    if (tag === "select") {
      // Prefer an explicit empty/placeholder option, else fall back to first.
      const emptyIdx = Array.from(el.options).findIndex((o) => o.value === "");
      const targetIdx = emptyIdx >= 0 ? emptyIdx : 0;
      if (el.selectedIndex === targetIdx) return false;
      el.selectedIndex = targetIdx;
      fireEvents(el, ["input", "change"]);
      return true;
    }
    if (type === "checkbox" || type === "radio") {
      if (!el.checked) return false;
      el.focus();
      el.checked = false;
      fireEvents(el, ["input", "change", "click"]);
      return true;
    }
    if (!el.value) return false;
    el.focus();
    setNativeValue(el, "");
    fireEvents(el, ["input", "change", "blur"]);
    return true;
  };

  const clearAll = () => {
    let cleared = 0;
    for (const el of collectFields()) {
      try {
        if (clearControl(el)) cleared++;
      } catch (_) {
        /* skip controls that throw */
      }
    }
    return { cleared };
  };

  // After changing a control that can reveal/alter other fields (selects,
  // dropdowns, radios, checkboxes), pause so the framework re-renders dependent
  // option lists and conditionally-shown sections before we continue. Kept short
  // because the multi-pass loop below re-scans the DOM and recovers anything that
  // wasn't ready yet — so an occasional under-wait just costs one cheap extra pass
  // rather than a missed field.
  const SETTLE_MS = 120;

  const run = async ({ profile, mode, overwrite }) => {
    const result = { filled: 0, skipped: 0, details: [] };
    const handledRadioGroups = new Set();
    const handled = new WeakSet(); // elements already acted on (across passes)
    const profileEntries = Object.entries(profile || {}).filter(([k]) => k !== "__selectors__");

    // Explicit selector overrides take top priority: profile["__selectors__"]
    // is { "css selector": "value" }.
    const selectorMap = (profile && profile.__selectors__) || {};
    for (const [sel, value] of Object.entries(selectorMap)) {
      let matches;
      try {
        matches = document.querySelectorAll(sel);
      } catch (e) {
        continue; // invalid selector, ignore
      }
      for (const el of matches) {
        if (await applyValue(el, value, overwrite, handledRadioGroups)) {
          result.filled++;
          handled.add(el);
        }
      }
    }

    // Fill one control; returns true if it actually changed something.
    const fillField = async (el) => {
      const cardCat = classifyCardField(el);
      const tag = el.tagName.toLowerCase();
      const type = (el.type || "").toLowerCase();

      if (mode === "test") {
        if (cardCat) {
          if (cardCat === "cardmonth" && (tag === "select" || isCustomDropdown(el))) {
            return fillCardMonthControl(el);
          }
          if (cardCat === "cardyear" && (tag === "select" || isCustomDropdown(el))) {
            return fillCardYearControl(el);
          }
          if (cardCat === "cardtype") {
            if (tag === "select") return fillSelect(el, VISA_CARD.brand);
            if (type === "radio" && el.name) {
              const group = Array.from(document.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`));
              let ok = fillRadioGroup(group, VISA_CARD.brand);
              if (!ok) {
                const cardKeywords = ["cards", "card", "credit", "creditcard", "cc", "visa"];
                for (const kw of cardKeywords) {
                  ok = fillRadioGroup(group, kw);
                  if (ok) break;
                }
              }
              if (ok) handledRadioGroups.add(el.name);
              return ok;
            }
            return fillTextLike(el, VISA_CARD.brand);
          }
          if (cardCat === "cardexp" || cardCat === "cardnumber" || cardCat === "cardcvv" || cardCat === "cardholder") {
            const val = getVisaCardValue(cardCat, el);
            return val !== null && val !== undefined ? fillTextLike(el, val) : false;
          }
          return await fillByType(el, getVisaCardValue(cardCat, el), handledRadioGroups);
        }
        return isCustomDropdown(el)
          ? await fillCustomDropdown(el, null, { first: true })
          : await fillByType(el, guessTestValueForControl(el), handledRadioGroups);
      }
      // profile mode: best-matching key by label/name/etc.
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
        const ok = await applyValue(el, profile[bestKey], overwrite, handledRadioGroups);
        if (ok) result.details.push({ field: clues[0] || el.name || el.id, key: bestKey, score: bestScore });
        return ok;
      }
      // Auto-fill with Visa Card if meeting a card field not defined in profile
      if (cardCat) {
        let ok = false;
        if (cardCat === "cardmonth" && (tag === "select" || isCustomDropdown(el))) {
          ok = fillCardMonthControl(el);
        } else if (cardCat === "cardyear" && (tag === "select" || isCustomDropdown(el))) {
          ok = fillCardYearControl(el);
        } else if (cardCat === "cardtype") {
          if (tag === "select") ok = fillSelect(el, VISA_CARD.brand);
          else if (type === "radio" && el.name) {
            const group = Array.from(document.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`));
            ok = fillRadioGroup(group, VISA_CARD.brand);
            if (!ok) {
              const cardKeywords = ["cards", "card", "credit", "creditcard", "cc", "visa"];
              for (const kw of cardKeywords) {
                ok = fillRadioGroup(group, kw);
                if (ok) break;
              }
            }
            if (ok) handledRadioGroups.add(el.name);
          } else ok = fillTextLike(el, VISA_CARD.brand);
        } else if (cardCat === "cardexp" || cardCat === "cardnumber" || cardCat === "cardcvv" || cardCat === "cardholder") {
          const val = getVisaCardValue(cardCat, el);
          if (val !== null && val !== undefined) {
            ok = fillTextLike(el, val);
          }
        } else {
          const val = getVisaCardValue(cardCat, el);
          if (val !== null && val !== undefined) {
            ok = await applyValue(el, val, overwrite, handledRadioGroups);
          }
        }
        if (ok) {
          result.details.push({ field: clues[0] || el.name || el.id, key: `visa_${cardCat}`, score: 100 });
          return ok;
        }
      }
      return false;
    };

    // Multiple passes: each pass re-scans the DOM, so fields revealed by a
    // previous pass (conditional sections, e.g. v-if) and freshly-loaded
    // cascading options get picked up. Stops once a pass changes nothing.
    const MAX_PASSES = 6;
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let progressed = false;
      const fields = collectFields();
      for (let i = 0; i < fields.length; i++) {
        const el = fields[i];
        if (handled.has(el)) continue;
        const tag = el.tagName.toLowerCase();
        const type = (el.type || "").toLowerCase();

        if (type === "radio" && el.name && handledRadioGroups.has(el.name)) {
          handled.add(el);
          continue;
        }

        // Already has a value and we're not overwriting.
        const hasValue =
          (tag === "select" && el.value) ||
          (type === "checkbox" || type === "radio" ? false : el.value) ||
          (el.isContentEditable && el.textContent.trim());
        if (hasValue && !overwrite) {
          handled.add(el);
          result.skipped++;
          continue;
        }

        // Controls whose value can reveal or repopulate other fields. After
        // filling one we settle so the next dependent field is ready.
        const mayCascade =
          tag === "select" || isCustomDropdown(el) || type === "radio" || type === "checkbox";

        const ok = await fillField(el);
        handled.add(el);
        if (ok) {
          result.filled++;
          progressed = true;
          // Only settle if a later field in this pass could still consume the
          // re-render (new options / revealed sections). No point waiting after
          // the last fillable control.
          const moreToFill = mayCascade && fields.slice(i + 1).some((f) => !handled.has(f));
          if (moreToFill) await wait(SETTLE_MS);
        } else {
          result.skipped++;
        }
      }
      if (!progressed) break; // stable — no new fields became fillable
    }

    // File uploads: hidden inside upload widgets and excluded from the field
    // scan above, so handle them in a final pass. Assigning a placeholder file
    // drives the widget's real upload handler. Runs in both profile and test
    // modes — a form isn't "filled" until its required attachments are present.
    for (const el of collectFileInputs()) {
      if (handled.has(el)) continue;
      handled.add(el);
      // Respect a file the user already picked unless overwriting.
      if (el.files && el.files.length && !overwrite) {
        result.skipped++;
        continue;
      }
      if (fillFileInput(el)) result.filled++;
      else result.skipped++;
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
    if (type === "checkbox") {
      if (isAgreeField(el)) return false;
      return true;
    }
    if (type === "radio") return el.value || "on";
    if (isDateField(el)) {
      if (type === "time") return "09:30";
      if (type === "month") return new Date().toISOString().slice(0, 7);
      if (type === "week") return SAMPLE.week;
      if (type === "datetime-local") return new Date().toISOString().slice(0, 16);
      return new Date().toISOString().slice(0, 10); // type=date and text pickers
    }
    return guessTestValue(el);
  };

  // Route a value to the correct fill routine based on the control type.
  const applyValue = (el, value, overwrite, handledRadioGroups) =>
    fillByType(el, value, handledRadioGroups);

  const fillByType = (el, value, handledRadioGroups) => {
    const tag = el.tagName.toLowerCase();
    const type = (el.type || "").toLowerCase();

    if (type === "file") return fillFileInput(el);
    if (el.isContentEditable && !isCustomDropdown(el)) return fillContentEditable(el, value);
    if (isDateField(el)) return fillDateLike(el, value); // before dropdown: date pickers may be role=combobox
    if (isCustomDropdown(el)) return fillCustomDropdown(el, value);
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

  /* ----------------------- visa card filling ---------------------------- */

  const fillCardMonthControl = (el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "select") {
      const targets = ["04", "4", "april", "apr"];
      for (const opt of el.options) {
        const v = normalize(opt.value);
        const t = normalize(opt.textContent);
        if (targets.some((want) => v === want || t === want || t.startsWith("04") || t.startsWith("4-") || t.startsWith("4 "))) {
          el.focus();
          setNativeValue(el, opt.value);
          fireEvents(el, ["input", "change", "blur"]);
          return true;
        }
      }
      return fillSelect(el, "04");
    }
    if (isCustomDropdown(el)) {
      return fillCustomDropdown(el, "04") || fillCustomDropdown(el, "April");
    }
    return fillTextLike(el, "04");
  };

  const fillCardYearControl = (el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "select") {
      const targets = ["2030", "30"];
      for (const opt of el.options) {
        const v = normalize(opt.value);
        const t = normalize(opt.textContent);
        if (targets.some((want) => v === want || t === want || t.includes("2030") || t.endsWith("30"))) {
          el.focus();
          setNativeValue(el, opt.value);
          fireEvents(el, ["input", "change", "blur"]);
          return true;
        }
      }
      return fillSelect(el, "2030") || fillSelect(el, "30");
    }
    if (isCustomDropdown(el)) {
      return fillCustomDropdown(el, "2030") || fillCustomDropdown(el, "30");
    }
    return fillTextLike(el, "30");
  };

  const formatCardFieldName = (cat) => {
    switch (cat) {
      case "cardnumber": return "Card Number";
      case "cardexp": return "Expiration Date";
      case "cardmonth": return "Exp Month";
      case "cardyear": return "Exp Year";
      case "cardcvv": return "CVV";
      case "cardholder": return "Cardholder Name";
      case "cardtype": return "Card Type";
      default: return cat;
    }
  };

  const fillVisaCard = async (overwrite = false) => {
    const result = { filled: 0, skipped: 0, details: [] };
    const handledRadioGroups = new Set();
    const handled = new WeakSet();

    let fields = collectFields();
    // Explicitly add specific card inputs in case isVisible filtered them out during layout/animation
    const specificCardInputs = Array.from(document.querySelectorAll(
      '#cardNumber, [name="cardNumber"], .input-card-number, #cardExp, [name="cardExp"], .input-card-expired, #cvv2, [name="cvv2"], #cvv, [name="cvv"], .input-card-cvv, #cardHolder, [name="cardHolder"], input[data-maska], input[autocomplete*="cc-"]'
    ));
    for (const cinp of specificCardInputs) {
      if (!fields.includes(cinp)) fields.push(cinp);
    }

    let hasCard = fields.some((el) => classifyCardField(el) || getCardNumberPartIndex(el) !== -1);
    if (!hasCard) {
      await wait(300);
      fields = collectFields();
      for (const cinp of specificCardInputs) {
        if (!fields.includes(cinp)) fields.push(cinp);
      }
    }

    // Check for 4-part split card number inputs
    let splitCardInputs = [];
    for (const el of fields) {
      const idx = getCardNumberPartIndex(el);
      if (idx !== -1) {
        splitCardInputs[idx] = el;
      }
    }
    if (splitCardInputs.length === 4 && splitCardInputs.every(Boolean)) {
      const parts = ["4286", "0900", "0000", "0206"];
      for (let i = 0; i < 4; i++) {
        const el = splitCardInputs[i];
        if (handled.has(el)) continue;
        if (fillTextLike(el, parts[i])) {
          handled.add(el);
          result.filled++;
        }
      }
      if (result.filled > 0) {
        result.details.push("Card Number");
      }
    }

    for (const el of fields) {
      if (handled.has(el)) continue;

      const cardCat = classifyCardField(el);
      if (!cardCat) continue;

      const tag = el.tagName.toLowerCase();
      const type = (el.type || "").toLowerCase();

      if (type === "radio" && el.name && handledRadioGroups.has(el.name)) {
        handled.add(el);
        continue;
      }

      const hasValue =
        (tag === "select" && el.value) ||
        (type === "checkbox" || type === "radio" ? false : el.value) ||
        (el.isContentEditable && el.textContent.trim());

      const isCardInput = cardCat === "cardnumber" || cardCat === "cardexp" || cardCat === "cardcvv" || cardCat === "cardholder";
      if (hasValue && !overwrite && !isCardInput) {
        handled.add(el);
        result.skipped++;
        continue;
      }

      let ok = false;

      if (cardCat === "cardmonth" && (tag === "select" || isCustomDropdown(el))) {
        ok = fillCardMonthControl(el);
      } else if (cardCat === "cardyear" && (tag === "select" || isCustomDropdown(el))) {
        ok = fillCardYearControl(el);
      } else if (cardCat === "cardtype") {
        if (tag === "select") {
          ok = fillSelect(el, VISA_CARD.brand);
        } else if (type === "radio" && el.name) {
          const group = Array.from(document.querySelectorAll(`input[type=radio][name="${CSS.escape(el.name)}"]`));
          ok = fillRadioGroup(group, VISA_CARD.brand);
          if (!ok) {
            const cardKeywords = ["cards", "card", "credit", "creditcard", "cc", "visa"];
            for (const kw of cardKeywords) {
              ok = fillRadioGroup(group, kw);
              if (ok) break;
            }
          }
          if (ok) handledRadioGroups.add(el.name);
        } else {
          ok = fillTextLike(el, VISA_CARD.brand);
        }
      } else if (cardCat === "cardexp" || cardCat === "cardnumber" || cardCat === "cardcvv" || cardCat === "cardholder") {
        const val = getVisaCardValue(cardCat, el);
        if (val !== null && val !== undefined) {
          ok = fillTextLike(el, val);
        }
      } else {
        const val = getVisaCardValue(cardCat, el);
        if (val !== null && val !== undefined) {
          ok = await applyValue(el, val, overwrite, handledRadioGroups);
        }
      }

      handled.add(el);
      if (ok) {
        result.filled++;
        result.details.push(formatCardFieldName(cardCat));
      } else {
        result.skipped++;
      }
    }

    result.details = Array.from(new Set(result.details));
    return result;
  };

  /* --------------------------- messaging -------------------------------- */

  if (!alreadyLoaded && typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    // Work is async (custom dropdowns need to open and wait for options), so
    // run it in an IIFE and return true synchronously to keep the channel open.
    (async () => {
      if (msg && msg.action === "fill") {
        try {
          const result = await run({
            profile: msg.profile || {},
            mode: msg.mode || "profile",
            overwrite: !!msg.overwrite,
          });
          sendResponse({ ok: true, ...result });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
      } else if (msg && msg.action === "fillVisa") {
        try {
          const result = await fillVisaCard(!!msg.overwrite);
          sendResponse({ ok: true, ...result });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
      } else if (msg && msg.action === "scan") {
        // Report what we'd target, without filling — useful for debugging.
        const fields = collectFields().map((el) => ({
          tag: el.tagName.toLowerCase(),
          type: el.type || "",
          name: el.name || "",
          id: el.id || "",
          clues: describeField(el).slice(0, 4),
        }));
        sendResponse({ ok: true, count: fields.length, fields });
      } else if (msg && msg.action === "suggest") {
        try {
          // Read the page, analyze each input, and propose a sample value.
          // Tag every field with a stable id so the popup can later ask us to
          // apply specific suggestions back to the exact same elements.
          const handledGroups = new Set();
          const fields = [];
          collectFields().forEach((el, i) => {
            const type = (el.type || "").toLowerCase();
            if (type === "radio" && el.name) {
              if (handledGroups.has(el.name)) return;
              handledGroups.add(el.name);
            }
            const uid = "bp" + i;
            el.setAttribute("data-bampenh-uid", uid);
            const suggestion = suggestForControl(el);
            fields.push({
              uid,
              label: (describeField(el)[0] || el.name || el.id || "(unlabeled)").slice(0, 60),
              tag: el.tagName.toLowerCase(),
              type: el.type || "",
              category: suggestion.category,
              value: suggestion.value,
            });
          });
          sendResponse({ ok: true, count: fields.length, fields });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
      } else if (msg && msg.action === "applySuggestions") {
        try {
          // msg.values is { uid: editedValue }. Apply each to its tagged field.
          const handledRadioGroups = new Set();
          let filled = 0;
          let skipped = 0;
          for (const [uid, value] of Object.entries(msg.values || {})) {
            const el = document.querySelector(`[data-bampenh-uid="${uid}"]`);
            if (!el || value === "" || value == null) {
              skipped++;
              continue;
            }
            if (await fillByType(el, value, handledRadioGroups)) filled++;
            else skipped++;
          }
          sendResponse({ ok: true, filled, skipped });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
      } else if (msg && msg.action === "clear") {
        try {
          const { cleared } = clearAll();
          sendResponse({ ok: true, cleared });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
      }
    })();
    return true; // keep the message channel open for the async response
    });
  }

  window.__bampenhHandleMessage = async (msg) => {
    if (!msg) return null;
    if (msg.action === "fill") {
      const res = await run({
        profile: msg.profile || {},
        mode: msg.mode || "profile",
        overwrite: !!msg.overwrite,
      });
      return { ok: true, ...res };
    } else if (msg.action === "fillVisa") {
      const res = await fillVisaCard(!!msg.overwrite);
      return { ok: true, ...res };
    } else if (msg.action === "scan") {
      const fields = collectFields().map((el) => ({
        tag: el.tagName.toLowerCase(),
        type: el.type || "",
        name: el.name || "",
        id: el.id || "",
        clues: describeField(el).slice(0, 4),
      }));
      return { ok: true, count: fields.length, fields };
    } else if (msg.action === "suggest") {
      const handledGroups = new Set();
      const fields = [];
      collectFields().forEach((el, i) => {
        const type = (el.type || "").toLowerCase();
        if (type === "radio" && el.name) {
          if (handledGroups.has(el.name)) return;
          handledGroups.add(el.name);
        }
        const uid = "bp" + i;
        el.setAttribute("data-bampenh-uid", uid);
        const suggestion = suggestForControl(el);
        fields.push({
          uid,
          label: (describeField(el)[0] || el.name || el.id || "(unlabeled)").slice(0, 60),
          tag: el.tagName.toLowerCase(),
          type: el.type || "",
          category: suggestion.category,
          value: suggestion.value,
        });
      });
      return { ok: true, count: fields.length, fields };
    } else if (msg.action === "applySuggestions") {
      const handledRadioGroups = new Set();
      let filled = 0;
      let skipped = 0;
      for (const [uid, value] of Object.entries(msg.values || {})) {
        const el = document.querySelector(`[data-bampenh-uid="${uid}"]`);
        if (!el || value === "" || value == null) {
          skipped++;
          continue;
        }
        if (await fillByType(el, value, handledRadioGroups)) filled++;
        else skipped++;
      }
      return { ok: true, filled, skipped };
    } else if (msg.action === "clear") {
      const res = clearAll();
      return { ok: true, ...res };
    }
    return null;
  };
})();
