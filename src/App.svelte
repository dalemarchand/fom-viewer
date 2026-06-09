<script>
import Header from './lib/Header.svelte';
import TabBar from './lib/TabBar.svelte';
import SubtabBar from './lib/SubtabBar.svelte';
import WelcomeScreen from './lib/WelcomeScreen.svelte';
import DetailPanel from './lib/DetailPanel.svelte';
import TreeView from './lib/TreeView.svelte';
import ModuleList from './lib/ModuleList.svelte';
import DataTypeList from './lib/DataTypeList.svelte';
import IssueList from './lib/IssueList.svelte';
import SearchPanel from './lib/SearchPanel.svelte';
import * as issueStore from './lib/stores/issueStore.svelte.js';
import * as uiStore from './lib/stores/uiStore.svelte.js';

let allIssues = $derived(issueStore.getIssues());
let issueAllCount = $derived(allIssues.length);
let issueErrorCount = $derived(allIssues.filter(i => i.severity === 'error').length);
let issueWarningCount = $derived(allIssues.filter(i => i.severity === 'warning').length);

const TAB_ORDER = [
  'modules', 'objects', 'interactions', 'datatypes',
  'appspaces', 'dims', 'trans', 'switches', 'tags', 'time',
  'notes', 'issues'
];

function handleKeydown(e) {
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    document.getElementById('globalSearch')?.focus();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    document.getElementById('globalSearch')?.focus();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    const idx = parseInt(e.key) - 1;
    if (idx < TAB_ORDER.length) {
      const tabEl = document.querySelector(`.tab[data-tab="${TAB_ORDER[idx]}"]`);
      if (tabEl && tabEl.style.display !== 'none') tabEl.click();
    }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    uiStore.setLeftRailPinned(!uiStore.ui.leftRailPinned);
    return;
  }
}
</script>

<svelte:window onkeydown={handleKeydown} />

<div id="toast" class="toast" data-testid="toast"></div>
<div id="app" data-testid="app">
  <Header />
  <TabBar />
  <div class="subtab-bar" id="dataTypeTabs">
    <SubtabBar container="dataType" tabs={[
      { id: 'basic', label: 'Basic' },
      { id: 'simple', label: 'Simple' },
      { id: 'array', label: 'Array' },
      { id: 'fixed', label: 'Fixed Record' },
      { id: 'enum', label: 'Enumerated' },
      { id: 'variant', label: 'Variant Record' }
    ]} />
  </div>
  <div class="subtab-bar" id="appspaceTabs" style="display:none">
    <SubtabBar container="appspace" tabs={[
      { id: 'objects', label: 'Objects (0)' },
      { id: 'interactions', label: 'Interactions (0)' },
      { id: 'unknown', label: 'Unknown (0)' }
    ]} />
  </div>
  <div class="subtab-bar" id="issuesTabs" style="display:none">
    <SubtabBar container="issues" tabs={[
      { id: 'all', label: `All (${issueAllCount})` },
      { id: 'error', label: `Errors (${issueErrorCount})` },
      { id: 'warning', label: `Warnings (${issueWarningCount})` }
    ]} />
  </div>
  <div class="main">
    <div class="sidebar">
      <div id="treeControls" class="tree-controls" style="display:none">
        <input type="text" id="treeFilter" class="tree-filter" placeholder="Filter items..." />
        <button id="sortBtn" class="btn-ghost btn-small sort-btn" title="Toggle sort order">Sort: A→Z</button>
      </div>
      <div class="tree-wrapper" id="treeView">
        <div id="treeViewTree" class="tree-view-panel" style="display:none"><TreeView /></div>
        <div id="treeViewModules" class="tree-view-panel" style="display:none"><ModuleList /></div>
        <div id="treeViewDataTypes" class="tree-view-panel" style="display:none"><DataTypeList /></div>
        <div id="treeViewIssues" class="tree-view-panel" style="display:none"><IssueList /></div>
      </div>
    </div>
    <div class="detail">
      <DetailPanel />
    </div>
  </div>
  <SearchPanel />
</div>
