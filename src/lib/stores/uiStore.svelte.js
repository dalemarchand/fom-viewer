// Svelte 5 rune: export a single mutable object so callers can import $derived directly.
// Internal functions for callers that need to set values from non-run mode (*.js files).
export const ui = $state({
  currentTab: 'modules',
  currentSubTab: 'basic',
  selectedItem: null,
  sortEnabled: 'asc',
  appspaceSubTab: 'objects',
  leftRailPinned: false,
  sidebarWidth: 300,
  activeTheme: 'system',
  sortBtnVisible: true
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
export function getLeftRailPinned() { return ui.leftRailPinned; }
export function setLeftRailPinned(v) { ui.leftRailPinned = v; }
export function getSidebarWidth() { return ui.sidebarWidth; }
export function setSidebarWidth(v) { ui.sidebarWidth = v; }
export function getActiveTheme() { return ui.activeTheme; }
export function setActiveTheme(v) { ui.activeTheme = v; }
export function getSortBtnVisible() { return ui.sortBtnVisible; }
export function setSortBtnVisible(v) { ui.sortBtnVisible = v; }
export function resetUI() {
  ui.currentTab = 'modules'; ui.currentSubTab = 'basic';
  ui.selectedItem = null; ui.sortEnabled = 'asc'; ui.appspaceSubTab = 'objects';
  ui.leftRailPinned = false; ui.sidebarWidth = 300; ui.activeTheme = 'system';
  ui.sortBtnVisible = true;
}
