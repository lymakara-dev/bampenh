/* ==========================================================================
 * MISTI generic adapter — schema-agnostic Vue-data fill
 *
 * services.misti.dev/portal/home/GD_IND_SERVICES lists 10 services backed by
 * 8 distinct form components (SSI145, handled precisely by
 * forms/misti-ssi145.js, plus 7 others: factory establishment/branch/change/
 * registration/operation-permit variants and an industrial-waste permit).
 * Each has its own `data.applicant` / `data.application` shape — hand-mapping
 * all of them like SSI145 would take one investigation-and-build pass per
 * form. Instead this adapter walks whatever shape it finds and fills it by
 * structural pattern + key-name heuristics, the same idea as content.js's
 * clue-based matching but applied to Vue data-property names instead of DOM
 * labels (data keys are consistent English identifiers, so name matching is
 * actually more reliable here than it is against free-form page text).
 *
 * Trade-off: broad coverage across every GD_IND_* form (including ones added
 * later) instead of SSI145-level precision on any single one. Fields we
 * don't recognize are left blank rather than guessed at random.
 *
 * Must run in the MAIN world — see forms/misti-ssi145.js for why.
 * ========================================================================== */

(() => {
  if (window.__bampenhFillMistiGeneric) return; // already installed

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const SETTLE_MS = 300;
  const CASCADE_KEYS = ["province_id", "district_id", "commune_id", "village_id"];
  const CASCADE_VALUES = { province_id: 1, district_id: 103, commune_id: 10302, village_id: 1030201 };
  const today = () => new Date().toISOString().slice(0, 10);

  // Any Vue component whose $data.data looks like { applicant, application }
  // — the shape every GD_IND_* form shares, regardless of component name.
  const findComponent = () => {
    const nodes = document.querySelectorAll("*");
    for (const el of nodes) {
      const v = el.__vue__;
      const d = v && v.$data && v.$data.data;
      if (d && d.applicant && d.application) return v;
    }
    return null;
  };

  // Never touch the legal-acknowledgment control — the user should tick that
  // themselves. It shows up as a bare "agree" string field or an "agreed"
  // boolean nested under a "declaration" object, depending on the form.
  // Exact match only: several forms also have legitimate fields like
  // "declaration_no"/"declaration_date" (a factory declaration document's
  // reference number/date) that must NOT be caught by this.
  const isConsentKey = (key) => /^agreed?$|^consent$/i.test(key);

  // Best-effort value for one field by its property name. Returns undefined
  // for anything not recognized — callers leave those blank rather than
  // guess, since an arbitrary string in a strict dropdown/enum field is worse
  // than leaving it for the user.
  const classifyLeaf = (key, parentKey) => {
    if (isConsentKey(key)) return undefined;
    const k = key.toLowerCase();
    const p = (parentKey || "").toLowerCase();

    if (k === "email") return `${p || "test"}@test.com`;
    if (k === "other_telephone") return "098765432";
    if (/telephone|^phone$|^tel$|^contact$/.test(k)) return "012345678";
    if (k === "gender") return 1;
    if (k === "nationality_id") return 1;
    if (k === "personal_code") return "123456789";
    if (/issue_date/.test(k)) return "2025-01-01";
    if (/expiry_date/.test(k)) return "2035-01-01";
    if (k === "position") return p ? p[0].toUpperCase() + p.slice(1) : "Staff";
    if (k === "full_name_km" || (/_km$/.test(k) && /name/.test(k))) return "សាកល្បង";
    if (k === "full_name_en" || (/_en$/.test(k) && /name/.test(k))) return "Test User";
    if (/factory_name/.test(k)) return "Test Factory";
    if (/product_name/.test(k)) return "Test Product";
    if (/^country$/.test(k) || /import_country|export_country/.test(k)) return "Cambodia";
    if (/unit_name/.test(k)) return "unit";
    if (/experience|skill/.test(k)) return "5 years of relevant experience.";
    if (/description|situation|reason|remark/.test(k)) return "N/A";
    if (/total_production_building$/.test(k)) return "5"; // building count, not free text
    if (/address|building_number|street_number/.test(k)) return "Phnom Penh";
    if (/industrial_park|\bsez\b/.test(k)) return "N/A";
    if (k === "title") return "N/A";
    if (/^building$|machinery_facility|office_material|other_facility|vehicle_transportation/.test(k)) return "N/A";
    if (/female/.test(k)) return "5";
    if (/^is_|^has_/.test(k)) return true;
    if (/_no$/.test(k) || /certificate_no|declaration_no/.test(k)) return "N/A-0001";
    if (/date$/.test(k)) return today();
    if (/qty|quantity|amount|capacity|surface_area|count|price|cost|percent|rate|^years?_of|valume|volume/.test(k))
      return "10";
    return undefined;
  };

  const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);

  // An attachment map: every value is a {filename,url} pair. Detected by
  // shape, not by name, since these appear at any depth under any key
  // (top-level `attachment`, but also nested ones like `waste.gas_waste.*`).
  const isAttachmentMap = (obj) => {
    const values = Object.values(obj);
    if (!values.length) return false;
    return values.every(
      (v) => isPlainObject(v) && "filename" in v && "url" in v && Object.keys(v).length === 2
    );
  };

  const fillAttachmentMap = (obj) => {
    let count = 0;
    for (const [key, file] of Object.entries(obj)) {
      if (file.filename === "" && file.url === "") {
        file.url = `/uploads/${key}.pdf`;
        file.filename = `${key}.pdf`;
        count++;
      }
    }
    return count;
  };

  const isLocationBlock = (obj) => "province_id" in obj && "district_id" in obj;

  const fillCascade = async (obj) => {
    for (const key of CASCADE_KEYS) {
      if (!(key in obj)) continue;
      if (obj[key] === "" || obj[key] === null) obj[key] = CASCADE_VALUES[key];
      await wait(SETTLE_MS);
    }
  };

  // Recursively fill one node. `parentKey` is the enclosing object's own key
  // (used to vary generated values, e.g. "owner" vs "manager" email/position).
  const fillNode = async (node, parentKey, stats) => {
    if (Array.isArray(node)) {
      if (/_list$/i.test(parentKey || "") && node.length) {
        const template = JSON.parse(JSON.stringify(node[0]));
        await fillNode(template, parentKey, stats);
        node.splice(0, node.length, template);
        stats.lists++;
      }
      return;
    }
    if (!isPlainObject(node)) return;

    if (isAttachmentMap(node)) {
      stats.attachments += fillAttachmentMap(node);
      return;
    }

    if (isLocationBlock(node)) {
      await fillCascade(node);
      stats.locations++;
    }

    for (const [key, value] of Object.entries(node)) {
      if (CASCADE_KEYS.includes(key)) continue; // handled by fillCascade above
      if (isPlainObject(value) || Array.isArray(value)) {
        await fillNode(value, key, stats);
        continue;
      }
      if (value !== "" && value !== null) continue; // already has a value — leave it
      const filled = classifyLeaf(key, parentKey);
      if (filled !== undefined) {
        node[key] = filled;
        stats.fields++;
      }
    }
  };

  const isValidProfile = (p) => !!(p && p.applicant && p.application);

  window.__bampenhFillMistiGeneric = async (profileOverride) => {
    try {
      const comp = findComponent();
      if (!comp) return { ok: false, error: "Couldn't find a MISTI form component on this page." };

      if (isValidProfile(profileOverride)) {
        // Custom profile: same shape as the live $data ({ applicant, application,
        // [selectedEquipment] }) — merge it in directly, same convention as the
        // SSI145 adapter, then let the generic walker fill anything the caller
        // left blank.
        comp.data.applicant = { ...comp.data.applicant, ...profileOverride.applicant };
        Object.assign(comp.data.application, profileOverride.application);
      } else {
        comp.data.applicant = {
          type: "LEGAL",
          id: "000",
          name_km: "ក្រុមហ៊ុន សាកល្បង",
          name_en: "Test Company Co., Ltd",
          contact: "012345678",
        };
      }

      const stats = { fields: 0, attachments: 0, locations: 0, lists: 0 };
      await fillNode(comp.data.application, "application", stats);

      return { ok: true, filled: stats };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  true;
})();
