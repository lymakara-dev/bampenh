/* Universal Form Autofill — popup controller */

// The sample profile is loaded from the packaged sample-data.json so that file
// is the single source of truth. Fetched once from the extension bundle (the
// popup is an extension page, so it can read its own packaged files) and cached.
let sampleProfileCache = null;
async function getSampleProfile() {
  if (sampleProfileCache) return sampleProfileCache;
  try {
    const res = await fetch(chrome.runtime.getURL("sample-data.json"));
    sampleProfileCache = await res.json();
  } catch (_) {
    sampleProfileCache = {}; // missing/invalid file — fall back to empty sample
  }
  return sampleProfileCache;
}

const $ = (sel) => document.querySelector(sel);

try {
  const ver = chrome.runtime?.getManifest?.()?.version;
  if (ver && $(".ver")) $(".ver").textContent = `v${ver}`;
} catch (_) {}

// Auto-reload unpacked extension if new permissions in manifest need activation
try {
  if (!chrome.webNavigation && typeof chrome.runtime?.reload === "function") {
    if (!sessionStorage.getItem("bampenh_manifest_reloaded")) {
      sessionStorage.setItem("bampenh_manifest_reloaded", "1");
      chrome.runtime.reload();
    }
  }
} catch (_) {}

/* ---------------------------- tabs ----------------------------------- */
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("is-active"));
    tab.classList.add("is-active");
    document.querySelector(`.panel[data-panel="${tab.dataset.tab}"]`).classList.add("is-active");
  });
});

/* ------------------------- data storage ------------------------------ */
async function loadProfile() {
  const { profile } = await chrome.storage.local.get("profile");
  $("#profileJson").value = JSON.stringify(profile || (await getSampleProfile()), null, 2);
}

$("#saveData").addEventListener("click", async () => {
  const out = $("#dataStatus");
  try {
    const parsed = JSON.parse($("#profileJson").value || "{}");
    await chrome.storage.local.set({ profile: parsed });
    out.textContent = "Saved.";
    out.className = "status good";
  } catch (e) {
    out.textContent = "Not valid JSON: " + e.message;
    out.className = "status bad";
  }
});

$("#loadSample").addEventListener("click", async () => {
  $("#profileJson").value = JSON.stringify(await getSampleProfile(), null, 2);
  $("#dataStatus").textContent = "Sample loaded — edit, then Save.";
  $("#dataStatus").className = "status";
});

/* --------------------- inject + message helpers ---------------------- */
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureInjected(tabId) {
  // Inject the content script on demand into all reachable frames.
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content.js"],
    });
  } catch (_) {
    // If allFrames fails (e.g. sandboxed iframe), inject into main frame first
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
    } catch (_) {}

    // Then inject into each subframe individually if webNavigation is available
    if (chrome.webNavigation && chrome.webNavigation.getAllFrames) {
      try {
        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        for (const frame of frames) {
          if (frame.frameId === 0) continue;
          try {
            await chrome.scripting.executeScript({
              target: { tabId, frameIds: [frame.frameId] },
              files: ["content.js"],
            });
          } catch (_) {}
        }
      } catch (_) {}
    }
  }
}

async function executeOnAllFrames(tabId, message) {
  let frameResults = [];

  const directFrameExecutor = async (m) => {
    // 1. If content script is active and has the handler, try it
    if (typeof window.__bampenhHandleMessage === "function") {
      try {
        const res = await window.__bampenhHandleMessage(m);
        if (res && res.filled > 0) return res;
      } catch (_) {}
    }

    // 2. Direct DOM fallback for Visa card and payment options
    const isVisa = m && (m.action === "fillVisa" || (m.action === "fill" && m.mode === "test"));
    if (isVisa) {
      const doc = document;
      const win = window;
      const result = { ok: true, filled: 0, skipped: 0, details: [] };

      const fillInput = (el, val) => {
        if (!el) return false;
        el.focus();
        const docView = el.ownerDocument?.defaultView || win;
        const setter = Object.getOwnPropertyDescriptor(docView.HTMLInputElement.prototype, "value")?.set;

        // Progressive keystroke typing simulation for masks (Maska v2)
        const str = String(val);
        let curr = "";
        for (let i = 0; i < str.length; i++) {
          const ch = str[i];
          curr += ch;
          try { el.dispatchEvent(new docView.KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: ch })); } catch (_) {}
          try { el.dispatchEvent(new docView.InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: ch })); } catch (_) {}
          if (setter) setter.call(el, curr);
          else el.value = curr;
          try { el.dispatchEvent(new docView.InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: ch })); } catch (_) {
            el.dispatchEvent(new docView.Event("input", { bubbles: true }));
          }
          try { el.dispatchEvent(new docView.KeyboardEvent("keyup", { bubbles: true, cancelable: true, key: ch })); } catch (_) {}
        }
        if (setter) setter.call(el, str);
        else el.value = str;
        el.dispatchEvent(new docView.Event("input", { bubbles: true }));
        el.dispatchEvent(new docView.Event("change", { bubbles: true }));
        el.dispatchEvent(new docView.Event("blur", { bubbles: true }));
        return true;
      };

      // Card Number
      const numInput = doc.querySelector(
        '#cardNumber, input[name="cardNumber"], input.input-card-number, input[data-maska*="#### ####"], input[autocomplete="cc-number"], input[placeholder*="0000 0000"]'
      ) || Array.from(doc.querySelectorAll('input:not([type="hidden"])')).find((el) => {
        const s = `${el.id} ${el.name} ${el.className} ${el.placeholder || ""}`.toLowerCase();
        return /card.*(?:number|no|num|digits)|លេខកាត/i.test(s) && !/cvv|cvc|exp|month|year/i.test(s);
      });
      if (numInput) {
        if (fillInput(numInput, "4286 0900 0000 0206")) {
          result.filled++;
          result.details.push("Card Number");
        }
      }

      // Expiration Date
      const expInput = doc.querySelector(
        '#cardExp, input[name="cardExp"], input.input-card-expired, input[data-maska*="## / ##"], input[data-maska*="##/##"], input[autocomplete="cc-exp"], input[placeholder*="MM / YY" i], input[placeholder*="MM/YY" i]'
      ) || Array.from(doc.querySelectorAll('input:not([type="hidden"])')).find((el) => {
        const s = `${el.id} ${el.name} ${el.className} ${el.placeholder || ""}`.toLowerCase();
        return /card.*exp|expiry|expiration|ផុតកំណត់/i.test(s) && !/cvv|cvc|number/i.test(s);
      });
      if (expInput) {
        const maska = (expInput.getAttribute("data-maska") || "").toLowerCase();
        const ph = (expInput.getAttribute("placeholder") || "").toLowerCase();
        const expVal = (maska.includes(" / ") || ph.includes(" / ") || maska.includes("## / ##")) ? "04 / 30" : "04/30";
        if (fillInput(expInput, expVal)) {
          result.filled++;
          result.details.push("Expiration Date");
        }
      }

      // CVV / CVC
      const cvvInput = doc.querySelector(
        '#cvv2, input[name="cvv2"], #cvv, input[name="cvv"], #cvc, input[name="cvc"], input.input-card-cvv, input[autocomplete="cc-csc"], input[autocomplete="cc-cvv"]'
      ) || Array.from(doc.querySelectorAll('input:not([type="hidden"])')).find((el) => {
        const s = `${el.id} ${el.name} ${el.className} ${el.placeholder || ""}`.toLowerCase();
        return /cvv|cvc|csc|security.*code|កូដសុវត្ថិភាព/i.test(s);
      });
      if (cvvInput) {
        if (fillInput(cvvInput, "777")) {
          result.filled++;
          result.details.push("CVV");
        }
      }

      // Cardholder
      const holderInput = doc.querySelector(
        '#cardHolder, input[name="cardHolder"], #cardName, input[name="cardName"], input[autocomplete="cc-name"]'
      );
      if (holderInput) {
        if (fillInput(holderInput, "Visa Card")) {
          result.filled++;
          result.details.push("Cardholder Name");
        }
      }

      // Payment Option (Cards radio)
      const cardRadio = doc.querySelector(
        'input[type="radio"][value="cards"], input[type="radio"]#cards, input[type="radio"][name="aba_checkout_payment_option"][value="cards"], input[type="radio"][name="payment_option"][value="cards"]'
      ) || Array.from(doc.querySelectorAll('input[type="radio"]')).find((r) => /cards|credit|visa/i.test(`${r.name} ${r.value} ${r.id}`));
      if (cardRadio && !cardRadio.checked) {
        cardRadio.checked = true;
        cardRadio.dispatchEvent(new win.Event("change", { bubbles: true }));
        cardRadio.dispatchEvent(new win.Event("click", { bubbles: true }));
        result.filled++;
        result.details.push("Payment Option (Cards)");
      }

      if (result.filled > 0) return result;
    }

    return null;
  };

  // Step 1: Query all frame IDs if webNavigation is available
  let frameIds = [0];
  if (chrome.webNavigation && chrome.webNavigation.getAllFrames) {
    try {
      const frames = await chrome.webNavigation.getAllFrames({ tabId });
      if (frames && frames.length) {
        frameIds = frames.map((f) => f.frameId);
      }
    } catch (_) {}
  }

  // Step 2: Execute directFrameExecutor frame by frame (protects against sandboxed frame errors)
  for (const fid of frameIds) {
    try {
      const [execRes] = await chrome.scripting.executeScript({
        target: { tabId, frameIds: [fid] },
        func: directFrameExecutor,
        args: [message],
      });
      if (execRes && execRes.result) {
        frameResults.push(execRes.result);
      }
    } catch (_) {
      // Sandboxed or restricted frame — skip safely
    }
  }

  // Step 3: If no frame results found, attempt allFrames: true as fallback
  if (!frameResults.length) {
    try {
      const raw = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: directFrameExecutor,
        args: [message],
      });
      if (raw && raw.length) {
        frameResults = raw.map((r) => r.result).filter(Boolean);
      }
    } catch (_) {}
  }

  // Step 4: Fallback to chrome.tabs.sendMessage if executeScript returned no results
  if (!frameResults.length) {
    try {
      const msgRes = await chrome.tabs.sendMessage(tabId, message);
      if (msgRes) frameResults.push(msgRes);
    } catch (_) {}
  }

  return frameResults;
}

async function sendToPage(message) {
  const tab = await activeTab();
  if (!tab || !tab.id || /^(chrome|edge|about|chrome-extension):/.test(tab.url || "")) {
    throw new Error("This page can't be filled (browser/system page).");
  }
  await ensureInjected(tab.id);

  const frameResults = await executeOnAllFrames(tab.id, message);
  if (!frameResults || !frameResults.length) {
    throw new Error("No response from page.");
  }

  if (message.action === "fill" || message.action === "fillVisa") {
    let totalFilled = 0;
    let totalSkipped = 0;
    let details = [];
    for (const r of frameResults) {
      if (r && (r.filled !== undefined || r.ok)) {
        totalFilled += r.filled || 0;
        totalSkipped += r.skipped || 0;
        if (Array.isArray(r.details)) {
          details.push(...r.details);
        }
      }
    }
    if (details.length && typeof details[0] === "string") {
      details = Array.from(new Set(details));
    }
    return { ok: true, filled: totalFilled, skipped: totalSkipped, details };
  }

  if (message.action === "scan" || message.action === "suggest") {
    let totalCount = 0;
    let allFields = [];
    for (const r of frameResults) {
      if (r && r.fields) {
        totalCount += r.count || r.fields.length;
        allFields.push(...r.fields);
      }
    }
    return { ok: true, count: totalCount, fields: allFields };
  }

  if (message.action === "applySuggestions") {
    let totalFilled = 0;
    let totalSkipped = 0;
    for (const r of frameResults) {
      if (r && r.filled !== undefined) {
        totalFilled += r.filled || 0;
        totalSkipped += r.skipped || 0;
      }
    }
    return { ok: true, filled: totalFilled, skipped: totalSkipped };
  }

  if (message.action === "clear") {
    let totalCleared = 0;
    for (const r of frameResults) {
      if (r && r.cleared !== undefined) {
        totalCleared += r.cleared || 0;
      }
    }
    return { ok: true, cleared: totalCleared };
  }

  return frameResults[0];
}

function setStatus(text, kind) {
  const el = $("#status");
  el.textContent = text;
  el.className = "status" + (kind ? " " + kind : "");
}

/* ------------------- MISTI form adapters (special-cased) --------------- */
// MISTI's draft-application forms render Khmer-only labels with no stable
// name/id attributes, so the generic label-matching engine in content.js can
// never score a match. Instead we inject an adapter that writes straight
// into the page's Vue component state. GD_IND_SSI145 gets a hand-mapped
// adapter (forms/misti-ssi145.js); every other GD_IND_* form (there are 7,
// listed under services.misti.dev/portal/home/GD_IND_SERVICES) is covered by
// a schema-agnostic one (forms/misti-generic.js) that fills whatever shape
// it finds by structural pattern + key-name heuristics.
const MISTI_HOSTNAMES = new Set(["services.misti.dev", "services.misti.gov.kh", "localhost", "127.0.0.1"]);

function isMistiUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return MISTI_HOSTNAMES.has(u.hostname) || u.hostname.endsWith(".misti.dev") || u.hostname.endsWith(".misti.gov.kh");
  } catch (_) {
    return false;
  }
}

function mistiFormHash(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!isMistiUrl(url)) return null;
    const m = u.pathname.match(/\/(?:portal\/)?(?:draft_applications|applications)\/(?:new|edit)\/([^/?#]+)/) ||
              u.pathname.match(/\/(?:portal\/)?(?:draft_applications|applications)\/([^/?#]+)/);
    return m ? m[1] : null;
  } catch (_) {
    return null;
  }
}

async function fillMistiForm(tab, mode, file, fnName, formHash) {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    files: ["forms/misti-form-samples.js", file],
  });

  let profileArg = null;
  if (mode === "profile") {
    try {
      const { profile } = await chrome.storage.local.get("profile");
      if (profile && (profile.applicant || profile.application)) profileArg = profile;
    } catch (_) {}
  }

  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: (name, p, hash, m) => window[name](p, hash, m),
    args: [fnName, profileArg, formHash, mode],
  });
  return result;
}

/* ----------------------------- actions ------------------------------- */
async function doFill(mode) {
  setStatus("Working…");
  $("#scanOut").hidden = true;

  const tab = await activeTab();
  const formHash = mistiFormHash(tab && tab.url);
  const isMisti = isMistiUrl(tab && tab.url);

  if (formHash || isMisti) {
    const isSSI145 = formHash === "GD_IND_SSI145";
    const file = isSSI145 ? "forms/misti-ssi145.js" : "forms/misti-generic.js";
    const fnName = isSSI145 ? "__bampenhFillSSI145" : "__bampenhFillMistiGeneric";
    try {
      const res = await fillMistiForm(tab, mode, file, fnName, formHash);
      if (res && res.ok) {
        let msg = "";
        if (isSSI145) {
          const eq = (res.filled && res.filled.equipmentTypes) ? res.filled.equipmentTypes.length : 0;
          msg = `Filled applicant, location, owner/representative, attachments${eq ? `, and ${eq} equipment type(s)` : ""}.`;
        } else {
          const { fields = 0, attachments = 0, locations = 0, lists = 0 } = (res && res.filled) || {};
          const formName = res && res.formHash ? ` [${res.formHash}]` : "";
          msg = `Filled${formName} ${fields} field(s), ${attachments} attachment(s), ${locations} location block(s), ${lists} list row(s).`;
        }

        // If a card modal or payment iframe is also open on the page, fill that too
        try {
          const cardRes = await sendToPage({
            action: "fillVisa",
            overwrite: $("#overwrite").checked,
          });
          if (cardRes && cardRes.filled > 0) {
            msg += ` + ${cardRes.filled} card field(s).`;
          }
        } catch (_) {}

        setStatus(msg, "good");
        return;
      }
    } catch (e) {
      console.warn("MISTI form adapter skipped, falling back to universal autofill:", e);
    }
  }

  let profile = {};
  try {
    const { profile: saved } = await chrome.storage.local.get("profile");
    profile = saved || {};
  } catch (_) {}

  if (mode === "profile" && Object.keys(profile).length === 0) {
    setStatus("No saved data yet — open the “Your data” tab first.", "bad");
    return;
  }

  try {
    const res = await sendToPage({
      action: "fill",
      mode,
      profile,
      overwrite: $("#overwrite").checked,
    });
    if (!res || !res.ok) throw new Error((res && res.error) || "No response from page.");
    const tag = mode === "test" ? "test data" : "your data";
    setStatus(`Filled ${res.filled} field(s) with ${tag}. Skipped ${res.skipped}.`, "good");
  } catch (e) {
    setStatus(e.message, "bad");
  }
}

async function doFillVisa() {
  setStatus("Filling Visa card…");
  $("#scanOut").hidden = true;

  try {
    let res = await sendToPage({
      action: "fillVisa",
      overwrite: $("#overwrite").checked,
    });

    // Check if actual card inputs (number, exp, cvv) were filled.
    // If only a radio button was selected (e.g. payment_option='cards') or 0 fields were filled,
    // the ABA PayWay iframe may still be mounting. Wait 500ms and retry.
    const hasActualCardDetails = res && res.details && res.details.some((d) =>
      /number|exp|cvv/i.test(typeof d === "string" ? d : d.field || "")
    );

    if (!hasActualCardDetails) {
      await new Promise((r) => setTimeout(r, 750));
      const retryRes = await sendToPage({
        action: "fillVisa",
        overwrite: $("#overwrite").checked,
      });
      if (retryRes && retryRes.filled > 0) {
        res = {
          ok: true,
          filled: (res && res.filled ? res.filled : 0) + (retryRes.filled || 0),
          skipped: retryRes.skipped || 0,
          details: Array.from(new Set([...((res && res.details) || []), ...((retryRes && retryRes.details) || [])])),
        };
      }
    }

    if (!res || !res.ok) throw new Error((res && res.error) || "No response from page.");
    if (!res.filled) {
      setStatus("No Visa / card form fields found on this page.", "bad");
    } else {
      const details = res.details && res.details.length ? ` (${res.details.join(", ")})` : "";
      setStatus(`Filled ${res.filled} Visa card field(s)${details}.`, "good");
    }
  } catch (e) {
    setStatus(e.message, "bad");
  }
}

$("#fillProfile").addEventListener("click", () => doFill("profile"));
$("#fillTest").addEventListener("click", () => doFill("test"));
$("#fillVisa").addEventListener("click", () => doFillVisa());

$("#clear").addEventListener("click", async () => {
  setStatus("Clearing…");
  $("#scanOut").hidden = true;
  try {
    const res = await sendToPage({ action: "clear" });
    if (!res || !res.ok) throw new Error((res && res.error) || "No response from page.");
    setStatus(`Cleared ${res.cleared} field(s).`, "good");
  } catch (e) {
    setStatus(e.message, "bad");
  }
});

$("#scan").addEventListener("click", async () => {
  setStatus("Scanning…");
  try {
    const res = await sendToPage({ action: "scan" });
    if (!res || !res.ok) throw new Error((res && res.error) || "No response.");
    setStatus(`Found ${res.count} fillable field(s).`, "good");
    const out = $("#scanOut");
    out.hidden = false;
    out.textContent = res.fields
      .map((f, i) => {
        const id = [f.tag, f.type].filter(Boolean).join(":");
        const ref = f.name || f.id || "(no name)";
        const clue = (f.clues[0] || "").slice(0, 40);
        return `${String(i + 1).padStart(2, " ")}. ${id}  ${ref}\n     ↳ ${clue}`;
      })
      .join("\n");
  } catch (e) {
    setStatus(e.message, "bad");
  }
});

/* --------------------------- suggest flow ---------------------------- */
// Tracks the analyzed fields so "Apply all" can read each row's (edited) value.
let suggestedFields = [];

function setSuggestStatus(text, kind) {
  const el = $("#suggestStatus");
  el.textContent = text;
  el.className = "status" + (kind ? " " + kind : "");
}

function renderSuggestions(fields) {
  suggestedFields = fields;
  const list = $("#suggestList");
  list.innerHTML = "";

  if (!fields.length) {
    list.hidden = true;
    $("#suggestApplyBar").hidden = true;
    return;
  }

  for (const f of fields) {
    const row = document.createElement("div");
    row.className = "sg-row";

    const head = document.createElement("div");
    head.className = "sg-head";
    head.innerHTML = `<span class="sg-label"></span><span class="sg-tag">${
      f.category || f.type || f.tag
    }</span>`;
    head.querySelector(".sg-label").textContent = f.label;

    const input = document.createElement("input");
    input.className = "sg-input";
    input.type = "text";
    input.value = f.value;
    input.dataset.uid = f.uid;

    row.appendChild(head);
    row.appendChild(input);
    list.appendChild(row);
  }
  list.hidden = false;
  $("#suggestApplyBar").hidden = false;
}

async function analyzePage() {
  setSuggestStatus("Reading page…");
  $("#suggestList").hidden = true;
  $("#suggestApplyBar").hidden = true;
  try {
    const res = await sendToPage({ action: "suggest" });
    if (!res || !res.ok) throw new Error((res && res.error) || "No response from page.");
    if (!res.count) {
      setSuggestStatus("No fillable fields found on this page.", "bad");
      renderSuggestions([]);
      return;
    }
    setSuggestStatus(`Analyzed ${res.count} field(s). Review and apply.`, "good");
    renderSuggestions(res.fields);
  } catch (e) {
    setSuggestStatus(e.message, "bad");
  }
}

async function applySuggestions() {
  const inputs = document.querySelectorAll("#suggestList .sg-input");
  const values = {};
  inputs.forEach((inp) => {
    values[inp.dataset.uid] = inp.value;
  });
  setSuggestStatus("Applying…");
  try {
    const res = await sendToPage({ action: "applySuggestions", values });
    if (!res || !res.ok) throw new Error((res && res.error) || "No response from page.");
    setSuggestStatus(`Filled ${res.filled} field(s). Skipped ${res.skipped}.`, "good");
  } catch (e) {
    setSuggestStatus(e.message, "bad");
  }
}

$("#analyze").addEventListener("click", analyzePage);
$("#reanalyze").addEventListener("click", analyzePage);
$("#applySuggestions").addEventListener("click", applySuggestions);

/* ------------------------------ init --------------------------------- */
loadProfile();
