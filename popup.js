/* Universal Form Autofill — popup controller */

const SAMPLE_PROFILE = {
  title: "Mr",
  firstName: "Alex",
  lastName: "Morgan",
  fullName: "Alex Morgan",
  email: "alex.morgan@example.com",
  phone: "+15551234567",
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
  nationalId: "012345678",
  website: "https://example.com",
};

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
  $("#profileJson").value = JSON.stringify(profile || SAMPLE_PROFILE, null, 2);
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

$("#loadSample").addEventListener("click", () => {
  $("#profileJson").value = JSON.stringify(SAMPLE_PROFILE, null, 2);
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

/* ------------------------------ init --------------------------------- */
loadProfile();
