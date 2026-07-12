# Test Coverage Audit

## Overview
47 test functions across 20 files. Full catalog and gap analysis.

## Priority Gaps to Fill

| Priority | Area | Gap Description |
|----------|------|-----------------|
| P0 | ScrollIntoView | Not tested in browser (only mock) for goBack/updateUI/showDataType/showDetail |
| P0 | History reset | No browser test for history reset on appspace load/clear/file clear |
| P1 | Issues tab hidden | No explicit assertion Issues tab is hidden when state.issues is empty |
| P1 | Tree auto-select | No test for auto-selecting first tree item on file load |
| P1 | Empty tree filter | Filter with no matches not tested |
| P1 | Export disabled state | No test exportBtn is hidden/disabled when no FOM loaded |
| P1 | Toast behavior | No test for toast show/hide animation or auto-dismiss |
| P2 | Tab scroll buttons | updateTabScrollButtons and setupTabScroll not tested |
| P2 | Sort persistence | Sort state across tab switches not tested |
| P2 | Issues sort | Sort on issues list not tested |
| P2 | Search across appspace/issues/modules | Only object/interaction class names searched |
| P2 | Data type rendering detail | 5/6 data type renderers lack assertions |
| P2 | Interaction detail rendering | Only existence check, no content verification |
| P2 | Module detail rendering | Not tested at all |
| P3 | Export content (JSON/CSV/Print) | Only click, not content |
| P3 | Merge functions (non-object) | Transportations, switches, tags, time, data types not tested |
| P3 | Validation conflict types | Fixed-record, enum-values, variant-alternatives not tested |
| P3 | Storage/clearStorage | No assertion storage actually cleared |
| P3 | Overview dashboard sub-components | Only existence, no content verification |
| P3 | Web Worker path/fallback | Not tested |
| P3 | FOMParser unit tests | Only integration tests exist |
