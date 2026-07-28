# MISTI SSI145 Autofill Adapter — Design

**Date:** 2026-06-23
**Status:** Superseded — see note below
**Target form:** `https://services.misti.dev/portal/draft_applications/new/GD_IND_SSI145?service_code=7`

> **2026-07-28 update:** The DOM-driving approach below (label-map, `.csel`
> widget driver, calendar clicking) was replaced before implementation. Poking
> around the live page found the form is a single Vue 2 component
> (`$options.name === "GD_IND_SSI145"`) reachable from any DOM node's
> `.__vue__`, whose `$data` shape exactly matches `{ applicant, application:
> {factory_location, management:{owner,representative}, attachment,
> technical_equipment}, selectedEquipment }`. Writing straight into that
> reactive state (in the page's MAIN world, since content scripts share the
> DOM but not page-realm objects) makes every v-model'd input, dropdown,
> vue-datetime picker and equipment table update itself — no label matching,
> `.csel` driving, or calendar-click simulation needed. The only wrinkle:
> `province_id`/`district_id`/`commune_id`/`village_id` are watched and
> cascade-reset the level below on change, so those four must be set in
> order with a settle wait between each (implemented as `fillCascade`), or a
> later field wipes out the one before it. Implemented in
> `forms/misti-ssi145.js`, wired up from `popup.js`. The sections below are
> kept for historical context on the investigation but no longer describe
> the shipped implementation.

(Cambodia MISTI — "Technical & safety inspection certificate" application for risk-bearing equipment.)

## 1. Goal

Make the Bampenh extension's "Fill from your data" fully complete this specific MISTI
application — every section including the repeating equipment list — from the saved
profile (`sample-data.json`), driving the page's Vue widgets correctly.

## 2. Why the generic engine fails here (root cause, verified on the live form)

The current `content.js` matcher decides what to put in a field by fuzzy-matching English
profile keys against the field's text clues. Verified against the live page:

- Field labels are **Khmer**, held in `.form-input-container > .form-title > label`.
- `normalize(label)` strips all non-`[a-z0-9]` characters → **every Khmer label becomes `""`**.
- `scoreMatch(key, ["" ...])` therefore scores **0 for every field** → no key is ever
  selected → the field is left blank.

This is why "the phone / ID field never fills": not an integer/masking problem. A
non-destructive sweep of all 21 text-like inputs confirmed the fill **mechanism**
(`setNativeValue` + `InputEvent` + `change/blur`) works on every text and numeric input,
including the phone field (which ran its own digit-only sanitizer) and the equipment value
cells. The only inputs that don't accept a typed value are the two vue-datetime pickers
(readonly, calendar-driven) — handled separately below.

**Conclusion:** the form needs an explicit, deterministic, Khmer-aware adapter. The generic
engine stays unchanged as the fallback for all other sites.

## 3. Approach

A dedicated **form adapter** activated only on host `services.misti.dev`. It maps each known
field to a data path by matching the **raw Khmer (or bilingual) label text** — never routing
Khmer through `normalize()`. The equipment section is driven by an explicit table engine.

Decisions captured during brainstorming:
- Trigger: via the existing extension's "Fill from your data" button.
- Scope: fill everything, including the full equipment list.
- Missing owner/contact data: user will add it to the JSON (see data contract).
- Equipment attachments: drop a generated placeholder file into each row's attachment cell.
- Forklift family mapping: Forklift 1–8 (incl. Electric Stacker) → **Forklift**;
  Pallet Movers (9–11) → **Mobile Lift Platform**.

## 4. Architecture

- **`content.js`** — refactor so the low-level helpers (`setNativeValue`, `fireEvents`,
  `simulateClick`, `pressKey`, `fillCustomDropdown`, vue-datetime drivers, `fillFileInput`,
  `wait`) are reachable by the adapter. On message `fill`, detect
  `location.host === "services.misti.dev"`; if so, delegate to the adapter and return its
  result. Otherwise run the existing generic flow untouched.
- **`forms/misti-ssi145.js`** (new) — the adapter: the section 1–3/5 label→path map, the
  equipment table engine, type grouping/mapping, and row creation. Shares the helpers above.
- **`.csel` widget support** (new) — a small driver for the custom unit/select widget
  (`.csel-wrapper`/`.csel-trigger`, `allowcustom="true"`): open, match an option by text, or
  type a custom value when no option matches.
- **`manifest.json` / `popup.js`** — inject `forms/misti-ssi145.js` alongside `content.js`
  (ordered so helpers exist first), via `web_accessible_resources`/`executeScript` files.

Reusing closure-scoped helpers across two injected files requires either (a) exposing a
helpers object on a page-world global, or (b) keeping the adapter in the same injected IIFE.
Chosen: **(a)** — `content.js` attaches an internal helpers namespace that the adapter reads,
keeping the adapter in its own file for clarity. (Implementation plan will finalize the exact
seam.)

## 5. Data contract (`sample-data.json`)

Keep existing keys: `company_name`, `company_name_khmer`, `address`, `address_khmer`,
`inspection_site*`, `reference_letter_date`, `authority*`, `inspected_equipments[]`.

**Add** the following (★ = form-required). Values are illustrative; user supplies real data.

```jsonc
{
  "industry_type": "factory",            // ★ one of: factory | sme | crafts
  "company_phone": "012345678",          // ★
  "company_phone_alt": "",

  "factory_name_khmer": "...",           // ★ defaults to company_name_khmer if omitted
  "factory_name": "...",                 // ★ defaults to company_name if omitted
  "province": "កណ្តាល",                  // ★ must match a province option (Khmer)
  "district": "គៀនស្វាយ",                // ★ cascades from province
  "commune": "ឈើទាល",                    //   text input
  "village": "ឫស្សីស្រុក",               //   text input
  // detailed address ← address_khmer / address (existing)

  "has_representative": "no",            // មាន/មិនមាន → yes | no
  "owner_name_khmer": "...",             // ★
  "owner_name": "...",                   // ★
  "owner_gender": "ប្រុស",               // ★ vue-select (Male/Female option text)
  "owner_nationality": "ខ្មែរ",          // ★ vue-select
  "owner_id_number": "...",              // ★
  "owner_id_issue_date": "2020-01-15",   // ★ ISO; set via calendar
  "owner_id_expiry_date": "2030-01-14",  // ★ ISO; set via calendar
  "owner_role": "...",                   // ★ តួនាទី
  "owner_province": "...",               // ★ vue-select
  "owner_district": "...",               // ★ vue-select (cascades)
  "owner_commune": "...",                // ★ vue-select (cascades)
  "owner_village": "...",                //   vue-select (cascades)
  "owner_street": "...",                 //   លេខផ្លូវ លេខផ្ទះ
  "owner_phone": "...",                  // ★
  "owner_phone_alt": "",
  "owner_email": "..."
}
```

The implementation plan will include a step where the user fills these in before a full run.

## 6. Field map — sections 1–3 & 5

Match by Khmer label substring within each `.form-input-container`; drive by control type.

| Section | Label (Khmer) | Control | Data path |
|---|---|---|---|
| Applicant | រោងចក្រ / សហគ្រាស… / សិប្បកម្ម | radio `industry_type` | `industry_type` |
| 1 | ឈ្មោះក្រុមហ៊ុនជាភាសាខ្មែរ | text | `company_name_khmer` |
| 1 | ឈ្មោះក្រុមហ៊ុនជាអក្សរឡាតាំង | text | `company_name` |
| 1 | លេខទូរស័ព្ទអាចទំនាក់ទំនងបាន | text | `company_phone` |
| 1 | លេខទំនាក់ទំនងផ្សេងទៀត | text | `company_phone_alt` |
| 2 | ឈ្មោះ…រោងចក្រ…ខ្មែរ | text | `factory_name_khmer` |
| 2 | ឈ្មោះ…រោងចក្រ…ឡាតាំង | text | `factory_name` |
| 2 | ខេត្ត/រាជធានី | vue-select | `province` |
| 2 | ក្រុង/ស្រុក/ខណ្ឌ | vue-select (cascades) | `district` |
| 2 | ឃុំ/សង្កាត់ | text | `commune` |
| 2 | ភូមិ | text | `village` |
| 2 | អាសយដ្ឋានលម្អិត…ខ្មែរ | text | `address_khmer` |
| 2 | អាសយដ្ឋានលម្អិត…អង់គ្លេស | text | `address` |
| 3 | មាន / មិនមាន | radio | `has_representative` |
| 3 | គោត្តនាម និងនាម…ខ្មែរ | text | `owner_name_khmer` |
| 3 | គោត្តនាម និងនាម…ឡាតាំង | text | `owner_name` |
| 3 | ភេទ | vue-select | `owner_gender` |
| 3 | សញ្ជាតិ | vue-select | `owner_nationality` |
| 3 | លេខអត្តសញ្ញាណប័ណ្ណ… | text | `owner_id_number` |
| 3 | កាលបរិច្ឆេទចេញ… | vue-datetime | `owner_id_issue_date` |
| 3 | កាលបរិច្ឆេទផុតសុពលភាព… | vue-datetime | `owner_id_expiry_date` |
| 3 | តួនាទី | text | `owner_role` |
| 3 | ខេត្ត/រាជធានី (owner) | vue-select | `owner_province` |
| 3 | ក្រុង/ស្រុក/ខណ្ឌ (owner) | vue-select | `owner_district` |
| 3 | ឃុំ/សង្កាត់ (owner) | vue-select | `owner_commune` |
| 3 | ភូមិ (owner) | vue-select | `owner_village` |
| 3 | លេខផ្លូវ លេខផ្ទះ | text | `owner_street` |
| 3 | លេខទូរស័ព្ទ | text | `owner_phone` |
| 3 | លេខទំនាក់ទំនងផ្សេងទៀត (owner) | text | `owner_phone_alt` |
| 3 | អ៊ីម៉ែល | text | `owner_email` |
| 5 | ខ្ញុំបានអាន…ឯកភាព… | checkbox | always check |

Cascading vue-selects (province→district[→commune→village]) are filled in order with a
settle wait between each so dependent option lists load.

File-upload buttons (3 on page) receive a generated placeholder file.

## 7. Equipment engine — section 4

1. **Group** `inspected_equipments` by form type. Base type derived by stripping `"(n)"` and
   trailing `"/ …"` qualifiers, then mapped:

   | Data base type | Form option (Khmer/English) |
   |---|---|
   | Forklift (1–8, incl. Electric Stacker) | ឧបករណ៍លើកដាក់/Forklift |
   | Forklift (9–11) / Pallet Mover | ឧបករណ៍យោងចល័ត/Mobile Lift Platform |
   | Generator | ម៉ាស៊ីនភ្លើង/Generator |
   | Air Compressor | ម៉ាស៊ីនបណ្ណែនខ្យល់/Air Compressor |
   | Steam Boiler | ឡចំហាយ/Steam Boiler |
   | Freight Elevator | ជណ្តើរយោង/Freight Elevator |

2. **Select** each needed type in the vs9 vue-select multiselect (checkbox options). Each tick
   reveals a `.application-table` for that type with one empty row.
3. **Add rows**: click `addបន្ថែម` until the table has one row per unit in that group.
4. **Fill each row** by reading the table's header cells at runtime and matching each column to
   a spec key (below). Value+unit columns (header row 2 = `តួលេខ` value, `ខ្នាត` unit) split
   the data string `"500 kW"` → `500` into the value text cell and `kW` into the unit `.csel`.
   Non-matching columns (e.g. Generator "Frequency" vs data `rated_speed`) are left blank.
   Drop a placeholder file into each row's attachment cell.

**Per-type column → spec-key map** (columns confirmed live; runtime header matching is the
source of truth, this is the intent):

- **Generator**: Model←`model`/`type`/`frame_core`; Serial←`serial_no`; Active Power←`active_power`;
  Apparent Power←`apparent_power`; Frequency←(none); Fuel←`type_of_fuel`; Mark←`mark`;
  Year←`year_of_manufacturing`; Made in←`made_in`.
- **Air Compressor**: Model; Serial; Type←`type_of_air_compressor`; Capacity←`rated_speed_capacity`(capacity part);
  Max Working Pressure←`max_working_pressure`; Motor Power←`motor`; Mark; Year; Made in.
- **Steam Boiler**: Model; Serial←`product_no`; Type←`type_of_steam_boiler`; Steam Capacity←`steam_capacity`;
  Max Working Pressure←`max_working_pressure`; Energy Source←`type_of_fuel`; Mark; Year; Made in.
- **Forklift**: Model←`model`/`model/type`; Serial←`serial_no`/`frame_no`; Type←`type_of_forklift`;
  Rated Capacity←`rated_capacity`; Max Lifting Height←`lifting_height`; Energy Source←(none/`type_of_forklift`);
  Mark; Year; Made in. (`load_center` has no column → dropped.)
- **Freight Elevator**: Model; Serial←`serial_no`; Type←`type_of_freight_elevator`; Rated Capacity←`rated_capacity`;
  Lifting Speed←`lifting_speed`; Motor Power←`motor`; Mark; Year; Made in.
- **Mobile Lift Platform**: Model; Serial←`serial_no`; Type←`type_of_equipment`; Rated Capacity←`rated_capacity`;
  Max Lifting Height←`lifting_height`; Lifting Speed←(none); Mark; Year; Made in.

## 8. `.csel` custom-select widget

Used for unit pickers (kW, kVA, kg, mm, …) and some Type/Mark/Made-in cells. `allowcustom="true"`.
Driver: click `.csel-trigger` to open; if an option matches the value text, click it; otherwise
(allowcustom) type the value into the widget's input and confirm. Always close after.

## 9. Edge cases & risks

- **Unit normalization**: split on the first space; if the data value isn't `"<number> <unit>"`
  (e.g. `"3000 r/min / 12.5 m³/min"`), put the leading numeric token in the value cell and the
  remainder in the unit csel (or leave unit blank). Confirm per-column during implementation.
- **Cascading selects** may load slowly; use condition-based waits, not fixed sleeps.
- **vue-datetime** ID dates are set via the existing calendar driver (ISO date in data).
- **Duplicate serials** exist in source data (e.g. two `080157BD241`) — filled as given.
- **Province/district option text** must exactly match the portal's option list (Khmer). If a
  value doesn't match, that select is left unset and reported.
- **Idempotency**: respect the "overwrite" toggle; skip rows already present on re-runs where
  feasible.

## 10. Out of scope

- The generic engine's behavior on other sites (unchanged).
- Submitting the form (the user clicks "Next"/"Save & exit").
- OCR/real attachment evidence — placeholders only.
- Other MISTI service forms (this adapter targets SSI145 only; structure may generalize later).

## 11. Testing

- Unit-level: pure functions (type grouping/mapping, `"500 kW"` splitting, header→spec-key
  matching) tested in isolation.
- Integration: drive the live form via the Chrome DevTools (CDP) harness already in use; after
  a run, read back field values and assert section 1–3/5 fields and a sample of equipment rows
  are populated. Non-destructive verification where possible.
