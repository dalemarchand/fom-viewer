// Svelte 5 rune: export a single mutable object so callers can import $derived directly.
// Internal functions for callers that need to set values from non-run mode (*.js files).
export const ui = $state({
  currentTab: 'modules',
  currentSubTab: 'basic',
  selectedItem: null,
  sortEnabled: 'asc',
  appspaceSubTab: 'objects'
});

export const variantHighlight = $state({
  enumTypeName: null,
  enumeratorName: null
});

export function getCurrentTab() { return ui.currentTab; }
export function setCurrentTab(v) { ui.currentTab = v; }
export function getCurrentSubTab() { return ui.currentSubTab; }
export function setCurrentSubTab(v) { ui.currentSubTab = v; }
export function getSelectedItem() { return ui.selectedItem; }
export function setSelectedItem(v) { ui.selectedItem = v; }
export function getSortEnabled() { return ui.sortEnabled; }
export function setSortEnabled(v) { ui.sortEnabled = v; }
export function getAppspaceSubTab() { return ui.appspaceSubTab; }
export function setAppspaceSubTab(v) { ui.appspaceSubTab = v; }
export function resetUI() {
  ui.currentTab = 'modules'; ui.currentSubTab = 'basic';
  ui.selectedItem = null; ui.sortEnabled = 'asc'; ui.appspaceSubTab = 'objects';
}
