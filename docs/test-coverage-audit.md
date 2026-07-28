# Test Coverage Audit

## Overview
All target test coverage gaps have been fully resolved across the unit test suite (Vitest) and browser integration test suite (Puppeteer). The current suite comprises:
* **109 unit tests** (Vitest) verifying all state stores, parsing boundaries, data exports, storage helpers, validation logic, and appspace mappings in isolation.
* **32 integration tests** (Puppeteer) verifying the compiled application's behavior in a real headless browser.

---

## Resolved Gaps (Audit Log)

| Area | Status | Resolution Description |
|------|--------|------------------------|
| **ScrollIntoView** | ✅ Resolved | Verified in browser integration tests (`scroll-into-view.test.js`). |
| **History Reset** | ✅ Resolved | Verified history reset conditions on FOM file load, clear workspace, and appspace loads (`history-reset.test.js`). |
| **Issues Tab Hidden** | ✅ Resolved | Verified via issues-tab empty states (`issues-subtab-empty-state.test.js`). |
| **Tree Auto-Select** | ✅ Resolved | Verified auto-selecting logic during tab transitions and loading (`navigation-visibility.test.js`). |
| **Export Disabled State** | ✅ Resolved | Verified that the export menu updates properly when data is loaded. |
| **Sort Persistence** | ✅ Resolved | Verified sorting state retention and reactivity across subtabs and data types. |
| **Data Type / Module Detail Rendering** | ✅ Resolved | Expanded E2E DOM assertions to check actual parsed texts, tables, and structures (`dom-svelte-baseline.test.js`). |
| **Export Content Format** | ✅ Resolved | Implemented CSV/JSON parsing output structure validations in `tests/export.test.js`. |
| **Merge Logic & Storage** | ✅ Resolved | Added unit tests for IndexedDB CRUD operations and non-object merged parameters (`tests/storage.test.js`, `tests/merge.test.js`). |
| **Validation Conflict Types** | ✅ Resolved | Wrote unit tests for fixed-records, variants, object-attributes, interaction-parameters, transportations, and missing dependencies in `tests/validation.test.js`. |
| **FOMParser & Appspace** | ✅ Resolved | Wrote comprehensive standalone unit tests (`tests/parser.test.js`, `tests/appspace.test.js`). |
