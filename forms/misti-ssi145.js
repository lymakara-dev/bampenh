/* ==========================================================================
 * MISTI SSI145 adapter — direct Vue-data fill
 *
 * services.misti.dev's SSI145 draft application ("technical & safety
 * inspection certificate" for risk-bearing equipment) renders Khmer-only
 * labels, so the generic label-matching engine in content.js can never match
 * a profile key to a field (see docs/superpowers/specs/2026-06-23-misti-
 * ssi145-autofill-design.md for the investigation).
 *
 * Instead of driving the DOM, this file writes straight into the page's Vue
 * component state (`data.applicant`, `data.application.*`, `selectedEquipment`)
 * the same way the app's own code would. Vue's v-model bindings then update
 * every input, dropdown, date picker and equipment table on their own.
 *
 * Must run in the MAIN world (chrome.scripting.executeScript world:"MAIN")
 * so it shares a JS realm with the page's Vue instance — an isolated-world
 * content script only shares the DOM, not the component objects hanging off
 * `element.__vue__`.
 * ========================================================================== */

(() => {
  if (window.__bampenhFillSSI145) return; // already installed by an earlier injection

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // The province/district/commune/village fields are watched by the page to
  // cascade-reset the level below whenever the level above changes — setting
  // them all in one synchronous batch causes each watcher to wipe out the
  // next field we just set. Setting them in order with a settle wait between
  // each lets every watcher's reset-and-reload finish before we move on.
  const CASCADE_KEYS = ["province_id", "district_id", "commune_id", "village_id"];
  const SETTLE_MS = 300;

  const fillCascade = async (target, source) => {
    if (!target || !source) return;
    for (const key of CASCADE_KEYS) {
      if (!(key in source)) continue;
      target[key] = source[key];
      await wait(SETTLE_MS);
    }
    for (const [key, value] of Object.entries(source)) {
      if (CASCADE_KEYS.includes(key)) continue;
      target[key] = value;
    }
  };

  const SAMPLE_PDF =
    "%PDF-1.4\n" +
    "1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n" +
    "2 0 obj\n<</Type/Pages/Kids[3 0 R]/Count 1>>\nendobj\n" +
    "3 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>\nendobj\n" +
    "4 0 obj\n<</Length 55>>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Sample PDF Document - Bampenh) Tj\nET\nendstream\nendobj\n" +
    "5 0 obj\n<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>\nendobj\n" +
    "xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000372 00000 n \n" +
    "trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n462\n%%EOF";

  const PNG_B64 =
    "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";

  const b64ToBytes = (b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  const createSamplePdfFile = () =>
    new File([new Blob([SAMPLE_PDF], { type: "application/pdf" })], "sample.pdf", {
      type: "application/pdf",
    });

  const createSamplePngFile = () =>
    new File([b64ToBytes(PNG_B64)], "sample.png", {
      type: "image/png",
    });

  const isImageField = (key) => /^(?:owner_photo|representative_photo|user_photo|photo|avatar|logo)$/i.test(key || "");

  const isImageTarget = (el) => {
    if (!el) return false;
    const accept = (el.getAttribute("accept") || "").trim().toLowerCase();
    if (accept) {
      const allowsPdf = accept.includes("pdf") || accept.includes("*/*") || accept.includes("application/*");
      const requiresImage = /image\/|\.png|\.jpe?g|\.gif|\.webp|\.bmp/.test(accept);
      if (requiresImage && !allowsPdf) return true;
      if (allowsPdf) return false;
    }
    const desc = (el.name || el.id || el.getAttribute("aria-label") || "").toLowerCase();
    return /^(?:photo|owner_photo|representative_photo|avatar|profile_picture|រូបថត)$/i.test(desc) || /\b(avatar|owner_photo)\b/i.test(desc);
  };

  const cachedFiles = {};

  const uploadSampleFile = async (comp, isImage = false) => {
    const fileType = isImage ? "image" : "pdf";
    if (cachedFiles[fileType]) return cachedFiles[fileType];
    const filePayload = isImage ? createSamplePngFile() : createSamplePdfFile();
    try {
      const api =
        (comp && comp.config && comp.config.api) ||
        (comp && comp.$root && comp.$root.config && comp.$root.config.api) ||
        (window.config && window.config.api) ||
        "";
      if (api) {
        const formData = new FormData();
        formData.append("file", filePayload);
        if (comp && comp.$http) {
          const res = await comp.$http.post(api + "/user/file/upload", formData);
          if (res && res.body && res.body.status === "success" && res.body.data) {
            cachedFiles[fileType] = res.body.data;
            return cachedFiles[fileType];
          }
        } else {
          const res = await fetch(api + "/user/file/upload", {
            method: "POST",
            body: formData,
            credentials: "include",
          });
          const json = await res.json();
          if (json && json.status === "success" && json.data) {
            cachedFiles[fileType] = json.data;
            return cachedFiles[fileType];
          }
        }
      }
    } catch (e) {
      console.warn("Bampenh: Real file upload request failed, falling back", e);
    }
    const defaultObj = isImage
      ? { url: "/uploads/sample.png", filename: "sample.png" }
      : { url: "/uploads/sample.pdf", filename: "sample.pdf" };
    return defaultObj;
  };

  const triggerDomFileInputs = () => {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]')).filter((el) => !el.disabled);
    for (const input of inputs) {
      try {
        const dt = new DataTransfer();
        const file = isImageTarget(input) ? createSamplePngFile() : createSamplePdfFile();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
        input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
      } catch (_) {}
    }
  };

  // Find the SSI145 form's root Vue component. Matching by $options.name is
  // the precise signal; falling back to shape-detection guards against a
  // future rename.
  const findComponent = () => {
    const nodes = document.querySelectorAll("*");
    for (const el of nodes) {
      const v = el.__vue__;
      if (v && v.$options && v.$options.name === "GD_IND_SSI145") return v;
    }
    for (const el of nodes) {
      const v = el.__vue__;
      const d = v && v.$data && v.$data.data;
      if (d && d.applicant && d.application) return v;
    }
    return null;
  };

  // Build one fully-populated row for an equipment type using the app's OWN
  // schema — `createEmptyRow(type)` for the field set and `getFields(type)`
  // for each field's valid dropdown/unit options — instead of hand-guessing
  // per-type columns. This is what lets us cover every table the portal
  // offers (14 at last count) without hardcoding any of their shapes, and
  // keeps working if the portal adds or changes equipment types later.
  const buildEquipmentRow = (comp, type, index) => {
    const row = comp.createEmptyRow(type);
    let fields = [];
    try {
      fields = comp.getFields(type) || [];
    } catch (_) {
      fields = [];
    }

    for (const f of fields) {
      const key = f.key;
      if (key === "file") {
        row.file = { url: `/uploads/sample.pdf`, filename: `sample.pdf` };
        continue;
      }
      if (key === "made_in") {
        const countries = (comp.data_settings && comp.data_settings.country_list) || [];
        row.made_in = countries.length ? countries[0].id : 1;
        continue;
      }
      if (Array.isArray(f.dropdown_options) && f.dropdown_options.length) {
        row[key] = f.dropdown_options[0].id;
        continue;
      }
      if (Array.isArray(f.unit_options) && f.unit_options.length) {
        row[`${key}_unit`] = f.unit_options[0].id;
      }
      if (key === "model") row.model = `MODEL-${index}`;
      else if (key === "serial") row.serial = `SN-${10000 + index}`;
      else if (key === "mark") row.mark = `MARK-${index}`;
      else if (key === "year") row.year = `${2020 + (index % 5)}`;
      else if (key in row) row[key] = `${10 + index}`; // numeric spec fields: capacity, pressure, etc.
    }
    return row;
  };

  // Every named equipment type the portal currently offers, one complete row
  // each. "other" is a user-named freeform bucket with no fixed spec (its own
  // custom-table plumbing — otherTables/addOtherTable — is a separate flow),
  // so it's left out of the "fill everything" sweep.
  const buildAllEquipment = (comp) => {
    const typeList = (comp.data_settings && comp.data_settings.equipment_type_list) || [];
    const types = typeList.map((t) => t.equipment_key).filter((k) => k && k !== "other");
    const equipment_by_type = {};
    types.forEach((type, i) => {
      equipment_by_type[type] = [buildEquipmentRow(comp, type, i + 1)];
    });
    return { types, equipment_by_type };
  };

  // The bundled sample profile — shaped to mirror the component's own $data
  // exactly (applicant / application / selectedEquipment as top-level keys),
  // so a custom profile the user supplies from the popup can use this same
  // shape. Needs `comp` to read the live equipment schema (see
  // buildAllEquipment above).
  const buildSampleProfile = (comp) => {
    const { types: equipmentTypes, equipment_by_type: equipmentByType } = buildAllEquipment(comp);
    return {
      applicant: {
        type: "LEGAL",
        id: "000",
        name_km: "ក្រុមហ៊ុន សាកល្បង",
        name_en: "Test Company Co., Ltd",
        contact: "012345678",
      },
      application: {
        industry_type: "FACTORY",
        agree: "",
        other_contact: "098765432",
        brand_name_km: "ម៉ាកសាកល្បង",
        brand_name_en: "Test Brand",
        has_representative: "HAS",
        factory_location: {
          province_id: 1,
          district_id: 103,
          commune_id: 10302,
          village_id: 1030201,
          address_km: "ភ្នំពេញ",
          address_en: "Phnom Penh",
          location_lat: 11.574435,
          location_lng: 104.899216,
        },
        management: {
          owner: {
            full_name_km: "ម៉ាការា សុខ",
            full_name_en: "Makara Sok",
            gender: 1,
            nationality_id: 1,
            personal_code: "123456789",
            issue_date: "2025-01-01",
            expiry_date: "2035-01-01",
            position: "Owner",
            province_id: 1,
            district_id: 103,
            commune_id: 10302,
            village_id: 1030201,
            address: "Phnom Penh",
            email: "owner@test.com",
            telephone: "012345678",
            other_telephone: "098765432",
          },
          representative: {
            full_name_km: "ស្រី ពិសី",
            full_name_en: "Srey Pisey",
            gender: 2,
            nationality_id: 1,
            personal_code: "987654321",
            issue_date: "2025-01-01",
            expiry_date: "2035-01-01",
            position: "Representative",
            province_id: 1,
            district_id: 103,
            commune_id: 10302,
            village_id: 1030201,
            address: "Phnom Penh",
            email: "rep@test.com",
            telephone: "011223344",
            other_telephone: "099887766",
          },
        },
        attachment: {
          establishment_certificate: { url: "/uploads/sample.pdf", filename: "sample.pdf" },
          deployment_certificate: { url: "/uploads/sample.pdf", filename: "sample.pdf" },
          owner_national_id: { url: "/uploads/sample.pdf", filename: "sample.pdf" },
          representative: { url: "/uploads/sample.pdf", filename: "sample.pdf" },
        },
        technical_equipment: {
          equipment_by_type: equipmentByType,
        },
      },
      selectedEquipment: equipmentTypes,
    };
  };

  const isValidProfile = (p) => !!(p && p.applicant && p.application);

  window.__bampenhFillSSI145 = async (profileOverride, formHashHint, mode = "test") => {
    try {
      const comp = findComponent();
      if (!comp) {
        return { ok: false, error: "Couldn't find the SSI145 form component on this page." };
      }

      const profile = isValidProfile(profileOverride) ? profileOverride : buildSampleProfile(comp);
      const app = profile.application || {};
      const { factory_location, management, attachment, technical_equipment, ...topFields } = app;

      comp.data.applicant = { ...profile.applicant };
      Object.assign(comp.data.application, topFields);
      if ("agree" in comp.data.application || comp.data.application.agree === undefined) {
        comp.data.application.agree = "";
      }

      if (factory_location) {
        await fillCascade(comp.data.application.factory_location, factory_location);
      }
      if (management && management.owner) {
        await fillCascade(comp.data.application.management.owner, management.owner);
      }
      if (management && management.representative) {
        await fillCascade(comp.data.application.management.representative, management.representative);
      }
      if (attachment) {
        for (const k of Object.keys(attachment)) {
          const realFile = await uploadSampleFile(comp, isImageField(k));
          attachment[k] = { ...realFile };
        }
        Object.assign(comp.data.application.attachment, attachment);
      }

      const equipmentByType = technical_equipment && technical_equipment.equipment_by_type;
      let equipmentTypes = [];
      if (equipmentByType) {
        equipmentTypes = profile.selectedEquipment && profile.selectedEquipment.length
          ? profile.selectedEquipment.slice()
          : Object.keys(equipmentByType);
        comp.selectedEquipment = equipmentTypes;
        comp.data.application.technical_equipment.equipment_by_type = equipmentByType;
        await wait(SETTLE_MS);
      }

      // Trigger DOM file inputs with real sample.pdf payload
      triggerDomFileInputs();

      return {
        ok: true,
        filled: {
          applicant: true,
          factoryLocation: !!factory_location,
          owner: !!(management && management.owner),
          representative: !!(management && management.representative),
          attachments: attachment ? Object.keys(attachment).length : 0,
          equipmentTypes,
        },
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  true;
})();
