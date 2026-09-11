# Bampenh (បំពេញ) — Universal Form Autofill

[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)](manifest.json)
[![Version](https://img.shields.io/badge/version-2.2.0-indigo.svg)](manifest.json)
[![Platform](https://img.shields.io/badge/platform-Chromium_|_Chrome_|_Edge_|_Brave-blue.svg)](#installation)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license)

**Bampenh** (*Khmer: បំពេញ — "to fill" or "to complete"*) is a high-precision, framework-aware Chrome extension designed to streamline form filling and end-to-end testing across modern web applications. 

Unlike standard autofill tools that rely on plain DOM assignments (`el.value = ...`), Bampenh operates across prototype value setters and synthetic event pipelines, ensuring full compatibility with reactive front-end frameworks like **React**, **Vue 2/3**, and **Angular**. Additionally, Bampenh ships with comprehensive, schema-verified integration for **all 45 public service portal forms** within the Ministry of Industry, Science, Technology & Innovation (MISTI) system.

---

## Key Capabilities

- **Universal Framework Support**: Safely drives React, Vue, and Angular forms by invoking native prototype property descriptors and triggering full input event lifecycles (`keydown`, `InputEvent` with `insertText`, `change`, and `click`).
- **Semantic Field Matching**: Heuristic scoring engine that evaluates field labels, placeholders, input types, `name`, `id`, `aria-label`, autocomplete attributes, nearby context, and semantic synonyms to map profile keys accurately.
- **Visa & Payment Card Autofill**: Intelligent credit/debit card form detection (card number, expiration date, separate month/year selects, CVV/CVC, cardholder name, and brand selector) with support for standard, masked, 4-box split, and iframe-embedded payment forms. Includes a dedicated one-click **Fill Visa Card** action.
- **Deep MISTI Portal Integration**: Dedicated adapters covering all 45 public service forms (`GD_IND_*`, `GD_SMEH_*`, `GD_WAT_*`, `ISC_*`, `NMC_*`, `STINL_*`, `GD_AC_*`) with reactive state injection in the page's `MAIN` world.
- **Cascading Address Resolution**: Automated hierarchical settlement for administrative divisions (`province_id` → `district_id` → `commune_id` → `village_id`) with watcher debounce settling.
- **Dynamic Complex Tables**: Full schema-driven table generation (such as equipment lists in `GD_IND_SSI145` and multi-factory registries in `NMC_FORM_CAV168`).
- **Form Inspection & Diagnostics**: Built-in "Scan Form" analyzer to inspect all detectable fields, scoring signals, and targetable CSS selectors.
- **Smart Test Data Generator**: Generates realistic, branch-consistent test variations on demand.
- **Agreement Safety Policy**: By default, declaration and consent checkboxes (`agree`) are left empty (`""`) and unchecked, ensuring human verification prior to submission.
- **Zero Tracking & Privacy-First**: 100% client-side operation using `chrome.storage.local`. Never transmits data externally and operates strictly on user demand via `activeTab`.

---

## Architecture & How It Works

```
                     ┌────────────────────────┐
                     │   Bampenh Extension    │
                     │  Popup UI (popup.html) │
                     └───────────┬────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
        [Standard Web Forms]            [MISTI Portal Forms]
                 │                               │
                 ▼                               ▼
    ┌───────────────────────────┐   ┌───────────────────────────┐
    │  Content Script (Isolated)│   │ Main World Adapters (MAIN)│
    │        content.js         │   │ misti-generic.js / ssi145 │
    ├───────────────────────────┤   ├───────────────────────────┤
    │ • Multi-pass DOM scanning │   │ • Direct Vue 2 state sync │
    │ • Heuristic fuzzy matcher │   │ • 45-form schema library  │
    │ • Native descriptor setter│   │ • Cascading select settle │
    │ • Synthetic Event pipeline│   │ • Synthetic attachments   │
    └───────────────────────────┘   └───────────────────────────┘
```

### 1. Isolated Content Script (`content.js`)
For general web forms, Bampenh injects an isolated content script on demand. Modern SPA libraries override standard HTML input setters; Bampenh queries `Object.getOwnPropertyDescriptor` from the element's prototype, sets values directly, and dispatches native events so internal state models synchronize instantly.

### 2. Main World Reactive Adapters (`forms/misti-*.js`)
Enterprise portals such as MISTI draft applications feature dynamic Khmer-language forms, complex multi-step state machines, and watched cascade resets. Bampenh injects lightweight adapters directly into Chrome's `MAIN` world to communicate directly with root Vue components (`comp.data.application` and `comp.data.applicant`), guaranteeing 100% fill fidelity without brittle DOM queries.

---

## Supported Controls

| Control Type | Supported Elements | Matching & Filling Mechanism |
| :--- | :--- | :--- |
| **Textual Inputs** | `text`, `email`, `tel`, `url`, `number`, `password`, `search` | Prototype setter + `InputEvent` dispatch |
| **Multiline Text** | `<textarea>`, `[contenteditable="true"]` | Textarea setter / Range insertion |
| **Dropdowns** | Standard `<select>`, custom comboboxes, `.csel` | Fuzzy matching against option text and values |
| **Selections** | `checkbox`, `radio` groups | Boolean parsing and radio-group resolution |
| **Payment Cards** | `cardnumber`, `ccexp`, `expmonth`, `expyear`, `cvv`, `cardholder`, brand | Card number (single/spaced/split), expiration formats, CVV, and brand resolution |
| **Date & Time** | `date`, `datetime-local`, `month`, `week`, `time` | ISO standard formatting & date-picker integration |
| **Attachments** | Standard file inputs (`<input type="file">`), upload widgets | Synthetic valid PDF/PNG data payloads |
| **Hierarchies** | Khmer administrative address cascades | Sequential async cascading with watcher settling |
| **Dynamic Lists**| Repeated tables, dynamic equipment cards, factory lists | Schema discovery using component factory methods |

---

## Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/lymakara-dev/bampenh.git
   ```
2. Open your Chromium-based browser (Google Chrome, Microsoft Edge, Brave, etc.) and navigate to:
   ```text
   chrome://extensions
   ```
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** in the top-left toolbar.
5. Select the `bampenh` directory.
6. Pin the extension to your browser toolbar for quick access.

---

## User Guide

### 1. Quick Test Fill
1. Open any web form or MISTI portal draft application.
2. Click the **Bampenh** extension icon.
3. On the **Fill** tab, click **Fill with test data**.
4. The extension will automatically populate all required fields, locations, and attachments with realistic sample values.

### 2. Custom Profile Fill
1. Navigate to the **Your data** tab in the extension popup.
2. Enter your custom JSON configuration (or click **Load sample** to start with a template).
3. Click **Save**.
4. Return to the **Fill** tab and click **Fill from your data**.

### 3. Visa Card Autofill
1. Open any payment, checkout, or billing form.
2. Click the **Bampenh** extension icon.
3. On the **Fill** tab, click the dedicated **Fill Visa Card** button.
4. The extension automatically detects and fills the Visa test credentials:
   - **Card Number**: `4286 0900 0000 0206` (or `4286090000000206` / 4-split inputs)
   - **Expiration**: `04/30` (or `04/2030`, `0430`, or separate Month `04` and Year `2030` selects/inputs)
   - **Security Code (CVV)**: `777`
   - **Cardholder Name**: `Visa Card`
   - **Card Brand**: Selects `Visa` if a brand dropdown or radio group is present.
5. Card fields are also automatically filled when using **Fill with test data** or **Fill from your data** whenever card forms are encountered.

### 4. Page Analysis & Field Suggestions
1. Switch to the **Suggest** tab.
2. Click **Analyze this page**.
3. Bampenh will inspect every fillable element in the current DOM and present proposed values for review.
4. Adjust any field value inline and click **Apply all**.

### 5. Overwrite Protection
By default, Bampenh does not overwrite fields that already contain values. Check the **"Overwrite fields that already have a value"** checkbox if you wish to force a complete re-fill.

---

## Advanced Configuration: Precise CSS Selectors

For custom web forms where inputs lack semantic labels, IDs, or accessibility tags, you can pin explicit CSS selectors inside your profile using the `__selectors__` block:

```json
{
  "email": "contact@example.com",
  "phone": "012345678",
  "__selectors__": {
    "#custom_applicant_id": "010123456",
    "select[name='custom_province']": "Phnom Penh",
    "input[data-qa='passport_no']": "N1234567"
  }
}
```

Selectors specified under `__selectors__` execute with highest priority before fuzzy matching runs. Use the **Scan form** button on the **Fill** tab to inspect any field's exact selector and metadata.

---

## MISTI Public Services Coverage

Bampenh includes complete sample definitions, conditional rules, and adapters for **all 45 official service forms** across the following directorates:

| Directorate | Acronym | Description | Forms Covered |
| :--- | :--- | :--- | :--- |
| **General Department of Industry** | `GD_IND` | Industrial operations, permits, expansions, inspections | `GD_IND_SSI145`, `GD_IND_FORM_OPT193`, `GD_IND_FORM_BRH482`, `GD_IND_SWI385`, `GD_IND_CLF021`, `GD_IND_FORM_REG483`, `GD_IND_FORM_SOR005`, `GD_IND_FORM_TRN095`, `GD_IND_FORM_JKQ284`, `GD_IND_FORM_KQL581` |
| **Institute of Standards of Cambodia** | `ISC` | Product certifications, safety marks, licenses | `ISC_FORM_CBP160`, `ISC_FORM_CFS143`, `ISC_FORM_AEM152`, `ISC_FORM_AAH158`, `ISC_FORM_HOT143`, `ISC_FORM_KOI145`, `ISC_FORM_LIC147`, `ISC_FORM_COM140`, `ISC_FORM_DEK126`, `ISC_FORM_RCL146`, `ISC_FORM_RVC153`, `ISC_FORM_ASM284`, etc. |
| **National Metrology Center** | `NMC` | Verification, calibration, instrument patterns | `NMC_FORM_CAV168`, `NMC_FORM_CCV888`, `NMC_FORM_KMQ279`, `NMC_FORM_REG332`, `NMC_FORM_SSP228`, `NMC_FORM_SSP337` |
| **Department of Potable Water** | `GD_WAT` | Water supply licensing, expansions | `GD_WAT_FORM_SLP235`, `GD_WAT_FORM_WBL605`, `GD_WAT_FORM_WOC630` |
| **SME & Handicraft Department** | `GD_SMEH` | SME registrations, craft modifications | `GD_SMEH_FORM_JKG168`, `GD_SMEH_FORM_KQP429`, `GD_SMEH_FORM_BHG197`, `GD_SMEH_FORM_RRB826` |
| **Science, Technology & Innovation** | `STINL` | Laboratory testing, technical assessments | `STINL_FORM_KJL428`, `GD_AC_FORM_JGH097` |

---

## Project Structure

```text
bampenh/
├── manifest.json              # Chrome Extension Manifest (V3)
├── background.js              # Extension service worker
├── content.js                 # Universal DOM autofill & fuzzy scoring engine
├── popup.html                 # Extension popup interface
├── popup.css                  # Modern instrument-panel styling
├── popup.js                   # Popup UI controller & injection orchestrator
├── sample-data.json           # Default reference data profile
├── build-sample-data.js       # Utility script to build sample data mappings
├── forms/
│   ├── misti-generic.js       # Schema-agnostic Vue-state adapter (44 forms)
│   ├── misti-ssi145.js        # Specialized adapter for GD_IND_SSI145
│   ├── misti-form-samples.js  # Compiled standalone sample library & generator
│   └── misti-form-samples.json# Reference pre-filled JSON schemas
├── scripts/
│   └── harvest-forms.mjs      # Engine harvesting form definitions & test branches
└── icons/                     # Extension icons (16, 32, 512px)
```

---

## Security & Privacy

- **Local Storage Only**: All profile data is saved strictly to your local browser using `chrome.storage.local`.
- **No Background Telemetry**: Bampenh contains zero analytics, tracking pixels, or remote logging.
- **On-Demand Execution**: Scripts are injected only when the extension popup is explicitly triggered by the user (`activeTab`).
- **No Automatic Submissions**: Bampenh never submits forms automatically. It populates fields and leaves submission to the user's manual confirmation.

---

## License

This project is licensed under the [MIT License](LICENSE).
