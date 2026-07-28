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
        row.file = { url: `/uploads/file-${index}.pdf`, filename: `file-${index}.pdf` };
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
          establishment_certificate: { url: "/uploads/establishment.pdf", filename: "establishment.pdf" },
          deployment_certificate: { url: "/uploads/deployment.pdf", filename: "deployment.pdf" },
          owner_national_id: { url: "/uploads/owner-id.jpg", filename: "owner-id.jpg" },
          representative: { url: "/uploads/representative-id.jpg", filename: "representative-id.jpg" },
        },
        technical_equipment: {
          equipment_by_type: equipmentByType,
        },
      },
      selectedEquipment: equipmentTypes,
    };
  };

  const isValidProfile = (p) => !!(p && p.applicant && p.application);

  window.__bampenhFillSSI145 = async (profileOverride) => {
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
