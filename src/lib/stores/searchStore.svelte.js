export const searchState = $state({
  visible: false,
  results: [],
  query: '',
  selectedIndex: -1
});

export function showSearchPanel(results, query) {
  searchState.results = results;
  searchState.query = query;
  searchState.selectedIndex = -1;
  searchState.visible = true;
}

export function hideSearchPanel() {
  searchState.visible = false;
  searchState.results = [];
  searchState.query = '';
  searchState.selectedIndex = -1;
}
