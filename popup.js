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
  // Inject the content script on demand (it guards against double-loading).
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  });
}

async function sendToPage(message) {
  const tab = await activeTab();
  if (!tab || !tab.id || /^(chrome|edge|about|chrome-extension):/.test(tab.url || "")) {
    throw new Error("This page can't be filled (browser/system page).");
  }
  await ensureInjected(tab.id);
  return await chrome.tabs.sendMessage(tab.id, message);
}

function setStatus(text, kind) {
  const el = $("#status");
  el.textContent = text;
  el.className = "status" + (kind ? " " + kind : "");
}

/* ----------------------------- actions ------------------------------- */
async function doFill(mode) {
  setStatus("Working…");
  $("#scanOut").hidden = true;
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

$("#fillProfile").addEventListener("click", () => doFill("profile"));
$("#fillTest").addEventListener("click", () => doFill("test"));

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
