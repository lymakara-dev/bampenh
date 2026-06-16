# Universal Form Autofill

A Chrome (Manifest V3) extension that fills almost any web form, with either
your own saved data or generated test data. It works on plain HTML forms and on
React/Vue/Angular forms (like the MISTI portal forms) because it sets values
through the native setter and fires the same events a real keystroke would.

## What it handles

- Text-like inputs: text, email, tel, url, number, password, search, date,
  datetime-local, month, week, time, color
- Textareas and `contenteditable` regions
- `<select>` dropdowns (matches by option text **or** value, fuzzily)
- Radio button groups (matches the right option by value/label)
- Checkboxes (truthy values check the box)
- Framework-controlled inputs that ignore plain `el.value = ...`

## Install (load unpacked)

1. Open `chrome://extensions` in Chrome (or `edge://extensions` in Edge).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `autofill-extension` folder.
4. Pin the extension from the puzzle-piece menu so it's easy to reach.

## Use

1. Open the form you want to fill.
2. Click the extension icon.
3. **Your data** tab → edit the JSON (or click *Load sample*) → **Save**.
4. **Fill** tab → **Fill from your data**.
   - Or **Fill with test data** to drop sensible dummy values into every field
     (handy for QA without setting up a profile).
   - **Scan form** lists every field the extension can see and the label it
     matched on — useful when a field won't fill and you want to know its name.

By default it won't overwrite fields that already have a value; tick the
checkbox to force it.

## How matching works

Each form field is described by its label text, `name`, `id`, `placeholder`,
`aria-label`, `autocomplete`, and nearby text. Your data keys are scored against
those clues (with a synonym table, so `email` matches "E-mail address", `zip`
matches "Postal code", `firstName` matches "Given name", etc.). The best match
above a confidence threshold gets filled.

## Stubborn fields: pin an exact selector

If a field has no usable label (common in custom portals), map a CSS selector to
a value with a `__selectors__` block in your data. These run first and always
win:

```json
{
  "email": "me@example.com",
  "__selectors__": {
    "#national_id": "012345678",
    "select[name='province']": "Phnom Penh",
    "input[data-field='passport_no']": "N1234567"
  }
}
```

Use **Scan form** to discover the right `name`/`id` to target.

## Notes & limits

- Data is stored with `chrome.storage.local` — it stays in your browser only.
- The extension only touches a page when you click it (`activeTab`), and never
  submits forms; it just fills them.
- It can't run on browser system pages (`chrome://`, the Web Store, etc.).
- Multi-step wizards that mount fields as you advance: open the popup and fill
  again on each step.
- Fields inside cross-origin `<iframe>`s can't be reached from the page's
  content script — those would need extra `host_permissions` and per-frame
  injection.
- Don't use it to enter false information into systems where that matters
  (government portals, etc.); the test-data mode is for filling out *your own*
  test forms.
