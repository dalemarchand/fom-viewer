# Changelog

All notable changes to **fom-viewer** will be documented in this file.

## [3.1.13] - 2026-08-03

### Fixed
- **Desktop Detail Navigation**: Fixed an issue where the `"← Back to List"` button was visible on desktop viewports (`>= 768px`) and blanked out the detail panel when clicked. Added default `.detail-back-btn { display: none; }` styling for desktop screens while keeping single-pane navigation on mobile viewports (`< 768px`). Resolves [#85](https://github.com/dalemarchand/fom-viewer/issues/85).
- **Test Suite Expansion**: Added explicit desktop and mobile viewport visibility assertions for `.detail-back-btn` in Puppeteer integration tests (`test/mobile-layout.test.js`).

## [3.1.12] - 2026-08-03

### Fixed
- **Appspace Subtabs Visibility**: Resolved issue where Appspaces subtabs (`Objects`, `Interactions`, `Unknown`) were rendered inside `.sidebar` and hidden when navigating to the Appspaces tab. Conditionally renders `<FilterChips />` inside `.detail` when `currentTab === 'appspaces'`.
- **Appspace Dynamic Counts**: Updated `FilterChips.svelte` to derive appspace chip label counts dynamically from `appspaceStore`.
