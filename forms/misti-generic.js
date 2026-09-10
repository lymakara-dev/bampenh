/* ==========================================================================
 * MISTI generic adapter — schema-agnostic Vue-data fill with 44-form sample support
 *
 * Supports all 44 MISTI public service forms by combining:
 * 1. Pre-filled comprehensive sample data from window.__bampenhMistiSamples
 *    (harvested directly from all 44 form.js definitions and populated with
 *    valid, realistic test data).
 * 2. On-demand random conditional data generation from window.__bampenhGenerateRandomSample
 *    generating realistic branch-consistent data variations per test run.
 * 3. Automatic detection of service_form_hash from component or URL path.
 * 4. Reactive deep-merge with cascade setters for address dropdowns
 *    (province_id -> district_id -> commune_id -> village_id).
 * 5. Safety-net recursive walker that fills any remaining unpopulated leaf fields.
 *
 * Must run in the MAIN world (chrome.scripting.executeScript world: "MAIN")
 * ========================================================================== */

(() => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const SETTLE_MS = 300;
  const CASCADE_KEYS = ["province_id", "district_id", "commune_id", "village_id", "province", "district", "commune", "village"];
  const CASCADE_VALUES = {
    province_id: 1,
    district_id: 103,
    commune_id: 10302,
    village_id: 1030201,
    province: 1,
    district: 103,
    commune: 10302,
    village: "ភូមិ១"
  };
  const CONDITION_KEYS = [
    "type",
    "request_type",
    "service_option",
    "cdc",
    "current_status",
    "current_situation",
    "has_representative",
    "has_previous_branch",
    "product_type",
    "license_activity",
    "company_type",
    "license_type",
    "industry_type",
    "requested_product_type"
  ];
  const today = () => new Date().toISOString().slice(0, 10);

  // Detect Vue component responsible for the form
  const findComponent = () => {
    const nodes = document.querySelectorAll("*");
    for (const el of nodes) {
      const v = el.__vue__;
      if (!v) continue;
      if (v.service_form_hash || (v.$data && v.$data.service_form_hash)) return v;
      if (v.SERVICE_FORM_HASH) return v;
      const d = (v.$data && v.$data.data) || v.data;
      if (d && (d.applicant || d.application)) return v;
    }
    return null;
  };

  // Detect the form hash from Vue component or URL
  const detectFormHash = (comp, urlHint) => {
    if (urlHint) return urlHint;
    if (comp) {
      if (comp.service_form_hash) return comp.service_form_hash;
      if (comp.$data && comp.$data.service_form_hash) return comp.$data.service_form_hash;
      if (comp.SERVICE_FORM_HASH) return comp.SERVICE_FORM_HASH;
      if (comp.$options && comp.$options.name && comp.$options.name.startsWith("GD_")) return comp.$options.name;
      if (comp.$options && comp.$options.name && comp.$options.name.startsWith("ISC_")) return comp.$options.name;
      if (comp.$options && comp.$options.name && comp.$options.name.startsWith("NMC_")) return comp.$options.name;
      if (comp.$options && comp.$options.name && comp.$options.name.startsWith("STINL_")) return comp.$options.name;
    }
    try {
      const m = window.location.pathname.match(/\/(?:portal\/)?(?:draft_applications|applications)\/(?:new|edit)\/([^/?#]+)/) ||
                window.location.pathname.match(/\/(?:portal\/)?(?:draft_applications|applications)\/([^/?#]+)/);
      if (m) return m[1];
    } catch (_) {}
    return null;
  };

  const isPlainObject = (v) => v && typeof v === "object" && !Array.isArray(v);

  // Check if an object is an attachment pair
  const isAttachment = (obj) => {
    if (!isPlainObject(obj)) return false;
    const keys = Object.keys(obj);
    return (keys.length === 2 && "filename" in obj && "url" in obj) ||
           (keys.length === 3 && "filename" in obj && "url" in obj && "title" in obj);
  };

  const isAttachmentMap = (obj) => {
    const values = Object.values(obj);
    if (!values.length) return false;
    return values.every(
      (v) => isPlainObject(v) && "filename" in v && "url" in v && Object.keys(v).length <= 3
    );
  };

  const fillAttachmentMap = (obj) => {
    let count = 0;
    for (const [key, file] of Object.entries(obj)) {
      if (!file) {
        obj[key] = { url: `/uploads/${key}.pdf`, filename: `${key}.pdf` };
        count++;
      } else if (file.filename === "" && file.url === "") {
        file.url = `/uploads/${key}.pdf`;
        file.filename = `${key}.pdf`;
        count++;
      }
    }
    return count;
  };

  const isLocationBlock = (obj) => isPlainObject(obj) && ("province_id" in obj || "province" in obj);

  const fillCascade = async (target, source = null) => {
    for (const key of CASCADE_KEYS) {
      if (!(key in target)) continue;
      const val = source && (key in source) && source[key] !== "" && source[key] !== null
        ? source[key]
        : CASCADE_VALUES[key];
      if (target[key] === "" || target[key] === null || target[key] === undefined) {
        target[key] = val;
        await wait(SETTLE_MS);
      }
    }
  };

  // Best-effort value for any leaf property
  const classifyLeaf = (key, parentKey) => {
    const k = key.toLowerCase();
    const p = (parentKey || "").toLowerCase();

    if (/^agree$|^agreed$|^is_declaration_accepted$|^declaration_accepted$/i.test(k)) return true;
    if (/^is_fetched_from_cam_?dx$/i.test(k)) return false;
    if (/^is_domestic$/i.test(k)) return true;
    if (/^is_import$/i.test(k)) return false;
    if (/^is_individual$/i.test(k)) return false;
    if (/^training_at_institute$/i.test(k)) return true;
    if (/^top_management$|^manager$|^supervisor$|^employee$/i.test(k) && p.includes("target")) return true;
    if (/^show_product_info$|^show_equipment_info$|^showform$|^saved$/i.test(k)) return true;

    if (k === "type" && (p === "applicant" || p.includes("applicant"))) return "LEGAL";
    if (k === "cert_type" || k === "applicant_type") return "LEGAL";
    if (k === "licensee_type") return "LEGAL_ENTITY";
    if (k === "has_representative") return "HAS";
    if (k === "service_option" || k === "cdc") return "CDC";
    if (k === "gender") return 1;
    if (k === "nationality_id") return 1;
    if (k === "unit_type") return 1;
    if (k === "industry_type") return "FACTORY";
    if (k === "establishment_type") return 1;
    if (k === "consultant_type") return 1;
    if (k === "license_type") return 1;
    if (k === "company_type") return 1;
    if (k === "license_activity") return 1;
    if (k === "requested_product_type") return "ALL";
    if (k === "selection_type") return "MANUAL";
    if (k === "training_mode") return "Physical";
    if (k === "distance_type") return "NEAR";
    if (k === "request_type") return 1;
    if (k === "certificate_type") return "NEW";

    if (k === "email") return `${p || "test"}@test.com`;
    if (k === "other_telephone" || k === "other_contact") return "098765432";
    if (/telephone|^phone$|^tel$|^contact$|mobile/.test(k)) return "012345678";
    if (k === "personal_code" || k === "identity_number") return "123456789";
    if (/issue_date/.test(k)) return "2025-01-01";
    if (/expiry_date|expire_date/.test(k)) return "2035-01-01";
    if (k === "position") return p ? p[0].toUpperCase() + p.slice(1) : "Staff";
    if (k === "full_name_km" || (/_km$/.test(k) && /name/.test(k))) return "សាកល្បង";
    if (k === "full_name_en" || (/_en$/.test(k) && /name/.test(k))) return "Test User";
    if (/factory_name/.test(k)) return "Test Factory";
    if (/product_name/.test(k)) return "Test Product";
    if (/^country$/.test(k) || /import_country|export_country/.test(k)) return "Cambodia";
    if (/unit_name/.test(k)) return "កេស / Box";
    if (/experience|skill/.test(k)) return "5 years of relevant experience.";
    if (/description|situation|reason|remark|comment/.test(k)) return "គ្មាន / None";
    if (/total_production_building$/.test(k)) return "5";
    if (/address|building_number|street_number|house_number/.test(k)) return "អគារលេខ ៤៥ ផ្លូវលេខ ១២៣ ភ្នំពេញ";
    if (/industrial_park|\bsez\b/.test(k)) return "PPSEZ";
    if (k === "title") return "Test Title";
    if (/^building$|machinery_facility|office_material|other_facility|vehicle_transportation/.test(k)) return "50000";
    if (/female|male/.test(k)) return "10";
    if (/^is_|^has_/.test(k)) return true;
    if (/_no$/.test(k) || /certificate_no|declaration_no|register_no|patent_number|tin/.test(k)) return "REG-2025-0001";
    if (/date$/.test(k)) return today();
    if (/qty|quantity|amount|capacity|surface_area|count|price|cost|percent|rate|^years?_of|valume|volume/.test(k)) return "100";
    if (/standard/.test(k)) return "CS 001:2020";

    return "សាកល្បង";
  };

  // Deep recursive merge from source sample into target Vue data
  const deepMergeSample = async (target, source, stats) => {
    if (!target || !source) return;

    // First pass: Set condition keys first so Vue watchers and v-if update
    let changedCondition = false;
    for (const ck of CONDITION_KEYS) {
      if (ck in source && source[ck] !== undefined && source[ck] !== null) {
        if (target[ck] !== source[ck]) {
          target[ck] = source[ck];
          stats.fields++;
          changedCondition = true;
        }
      }
    }
    if (changedCondition) {
      await wait(60);
    }

    // Handle location blocks with cascade setter
    if (isLocationBlock(target) && isLocationBlock(source)) {
      for (const k of CASCADE_KEYS) {
        if (k in source && source[k] !== "" && source[k] !== null && source[k] !== undefined) {
          target[k] = source[k];
          stats.locations++;
          await wait(SETTLE_MS);
        }
      }
    }

    for (const [key, val] of Object.entries(source)) {
      // Condition keys and cascade keys already handled
      if (CONDITION_KEYS.includes(key)) continue;
      if (isLocationBlock(target) && CASCADE_KEYS.includes(key)) continue;

      if (val === null || val === undefined) continue;

      if (Array.isArray(val)) {
        if (!Array.isArray(target[key]) || target[key].length === 0) {
          target[key] = JSON.parse(JSON.stringify(val));
          stats.lists++;
        } else {
          // Reactively replace array elements in Vue 2
          target[key].splice(0, target[key].length, ...JSON.parse(JSON.stringify(val)));
          stats.lists++;
        }
        continue;
      }

      if (isPlainObject(val)) {
        if (isAttachment(val)) {
          target[key] = { ...val };
          stats.attachments++;
          continue;
        }
        if (!isPlainObject(target[key])) {
          target[key] = {};
        }
        await deepMergeSample(target[key], val, stats);
        continue;
      }

      // Primitive leaf
      target[key] = val;
      stats.fields++;
    }
  };

  // Generic fallback walker for any remaining unpopulated fields
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
      if (CASCADE_KEYS.includes(key)) continue;
      if (isPlainObject(value) || Array.isArray(value)) {
        await fillNode(value, key, stats);
        continue;
      }
      if (value !== "" && value !== null && value !== undefined) continue;
      const filled = classifyLeaf(key, parentKey);
      if (filled !== undefined) {
        node[key] = filled;
        stats.fields++;
      }
    }
  };

  const isValidProfile = (p) => !!(p && (p.applicant || p.application));

  window.__bampenhFillMistiGeneric = async (profileOverride, formHashHint, mode = "test") => {
    try {
      const comp = findComponent();
      if (!comp) return { ok: false, error: "Couldn't find a MISTI form component on this page." };

      const formHash = detectFormHash(comp, formHashHint);
      let sample = null;

      // In test mode or when no custom profile is supplied, generate fresh randomized sample
      if (mode === "test" || !isValidProfile(profileOverride)) {
        if (typeof window.__bampenhGenerateRandomSample === "function" && formHash) {
          try {
            sample = window.__bampenhGenerateRandomSample(formHash);
          } catch (_) {}
        }
      }

      // Fallback to pre-built sample map
      if (!sample && formHash) {
        const samplesMap = window.__bampenhMistiSamples || {};
        sample = samplesMap[formHash];
      }

      const stats = { fields: 0, attachments: 0, locations: 0, lists: 0 };

      // Ensure comp.data exists
      if (!comp.data && comp.$data && comp.$data.data) {
        comp.data = comp.$data.data;
      } else if (!comp.data && comp.$data) {
        comp.$data.data = { applicant: {}, application: {} };
        comp.data = comp.$data.data;
      }

      if (sample) {
        // Deep clone sample data
        const sampleCopy = JSON.parse(JSON.stringify(sample));

        // If custom user profile was passed in profile mode, apply overrides
        if (mode === "profile" && isValidProfile(profileOverride)) {
          if (profileOverride.applicant) {
            sampleCopy.applicant = { ...sampleCopy.applicant, ...profileOverride.applicant };
          }
          if (profileOverride.application) {
            Object.assign(sampleCopy.application, profileOverride.application);
          }
        }

        // Merge sample data into Vue component data
        if (comp.data) {
          if (!comp.data.applicant) comp.data.applicant = {};
          if (!comp.data.application) comp.data.application = {};
          await deepMergeSample(comp.data.applicant, sampleCopy.applicant, stats);
          await deepMergeSample(comp.data.application, sampleCopy.application, stats);
        }
      } else {
        // Fallback when no sample is available
        if (isValidProfile(profileOverride)) {
          comp.data.applicant = { ...comp.data.applicant, ...profileOverride.applicant };
          Object.assign(comp.data.application, profileOverride.application);
        } else {
          comp.data.applicant = {
            type: "LEGAL",
            id: "000123456789",
            name_km: "ក្រុមហ៊ុន សាកល្បង ឯ.ក",
            name_en: "Test Enterprise Co., Ltd.",
            contact: "012345678",
          };
        }
      }

      // Safety net: fill any remaining blank leaf properties
      if (comp.data && comp.data.application) {
        await fillNode(comp.data.application, "application", stats);
      }

      return {
        ok: true,
        formHash: formHash || "GENERIC",
        mode: mode || "test",
        usedSample: !!sample,
        filled: stats
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  true;
})();
