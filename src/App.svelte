<script>
import { onMount } from 'svelte';
import Header from './lib/Header.svelte';
import LeftRail from './lib/LeftRail.svelte';
import FilterChips from './lib/FilterChips.svelte';
import DetailPanel from './lib/DetailPanel.svelte';
import TreeView from './lib/TreeView.svelte';
import ModuleList from './lib/ModuleList.svelte';
import DataTypeList from './lib/DataTypeList.svelte';
import IssueList from './lib/IssueList.svelte';
import SearchPanel from './lib/SearchPanel.svelte';
import OverviewDashboard from './lib/OverviewDashboard.svelte';
import * as uiStore from './lib/stores/uiStore.svelte.js';
import * as fomStore from './lib/stores/fomStore.svelte.js';
import * as issueStore from './lib/stores/issueStore.svelte.js';

  window.__setSortBtnVisible = uiStore.setSortBtnVisible;
  window.__getSortBtnVisible = uiStore.getSortBtnVisible;
  window.__setVariantHighlight = (enumTypeName, enumeratorName) => {
    uiStore.variantHighlight.enumTypeName = enumTypeName;
    uiStore.variantHighlight.enumeratorName = enumeratorName;
  };

let files = $derived(fomStore.getFiles());
let mergedFOM = $derived(fomStore.getMergedFOM());
let currentTab = $derived(uiStore.ui.currentTab);
let sidebarVisible = $derived(currentTab !== 'appspaces');

let sidebarTitle = $derived.by(() => {
  const map = {
    modules: 'Modules', objects: 'Object Classes', interactions: 'Interaction Classes',
    datatypes: 'Data Types', appspaces: 'Appspaces', dims: 'Dimensions',
    trans: 'Transportations', switches: 'Switches', tags: 'Tags',
    time: 'Time', notes: 'Notes', issues: 'Issues',
  };
  return map[currentTab] || '';
});

let sidebarCount = $derived.by(() => {
  switch (currentTab) {
    case 'modules': return files.length;
    case 'objects': return mergedFOM?.objectClasses?.length ?? 0;
    case 'interactions': return mergedFOM?.interactionClasses?.length ?? 0;
    case 'datatypes': return mergedFOM?.dataTypes ? Object.values(mergedFOM.dataTypes).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0) : 0;
    case 'dims': return files.reduce((s, f) => s + (f.dimensions?.length ?? 0), 0);
    case 'trans': return files.reduce((s, f) => s + (f.transportations?.length ?? 0), 0);
    case 'switches': return files.reduce((s, f) => s + (f.switches?.length ?? 0), 0);
    case 'tags': return files.reduce((s, f) => s + (f.tags?.length ?? 0), 0);
    case 'time': return mergedFOM?.time ? 1 : 0;
    case 'notes': return files.reduce((s, f) => s + (f.notes?.length ?? 0), 0);
    case 'issues': return issueStore.getIssues().length;
    default: return 0;
  }
});

const TAB_ORDER = [
  'modules', 'objects', 'interactions', 'datatypes',
  'appspaces', 'dims', 'trans', 'switches', 'tags', 'time',
  'notes', 'issues'
];

const MIN_SIDEBAR = 180;
const MAX_SIDEBAR = 600;

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

  if (e.key === 'Escape') {
    const searchInput = document.getElementById('globalSearch');
    if (document.activeElement === searchInput) {
      e.preventDefault();
      searchInput.blur();
      return;
    }
    const searchPanel = document.getElementById('searchPanel');
    if (searchPanel && searchPanel.style.display !== 'none') {
      e.preventDefault();
      window.__closeSearch?.();
      return;
    }
    return;
  }

  if (e.key === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    document.getElementById('sortBtn')?.click();
    return;
  }

  if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    const sel = document.querySelector('.tree-item.selected');
    const next = sel?.nextElementSibling ?? document.querySelector('.tree-item');
    if (next) { next.click(); next.scrollIntoView({ block: 'nearest' }); }
    return;
  }

  if (e.key === 'p' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    const sel = document.querySelector('.tree-item.selected');
    const prev = sel?.previousElementSibling ?? document.querySelector('.tree-item:last-child');
    if (prev) { prev.click(); prev.scrollIntoView({ block: 'nearest' }); }
    return;
  }

  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const sel = document.querySelector('.tree-item.selected');
    if (sel) { sel.click(); return; }
    return;
  }

  if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    document.getElementById('aboutBtn')?.click();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
    e.preventDefault();
    document.getElementById('treeFilter')?.focus();
    return;
  }
}

let isResizing = $state(false);

function startResize(e) {
  isResizing = true;
  e.preventDefault();
  document.body.classList.add('resizing');
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
}

function onResize(e) {
  if (!isResizing) return;
  const contentArea = document.querySelector('.content-area');
  if (!contentArea) return;
  const rect = contentArea.getBoundingClientRect();
  let newWidth = e.clientX - rect.left;
  newWidth = Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, newWidth));
  uiStore.setSidebarWidth(newWidth);
}

function stopResize() {
  isResizing = false;
  document.body.classList.remove('resizing');
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
  localStorage.setItem('fom-viewer-sidebar-width', String(uiStore.ui.sidebarWidth));
}

function handleResizeKeydown(e) {
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    const newWidth = Math.max(MIN_SIDEBAR, uiStore.ui.sidebarWidth - 20);
    uiStore.setSidebarWidth(newWidth);
    localStorage.setItem('fom-viewer-sidebar-width', String(uiStore.ui.sidebarWidth));
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    const newWidth = Math.min(MAX_SIDEBAR, uiStore.ui.sidebarWidth + 20);
    uiStore.setSidebarWidth(newWidth);
    localStorage.setItem('fom-viewer-sidebar-width', String(uiStore.ui.sidebarWidth));
  }
}

if (typeof localStorage !== 'undefined') {
  const saved = localStorage.getItem('fom-viewer-sidebar-width');
  if (saved) {
    const w = parseInt(saved, 10);
    if (w >= MIN_SIDEBAR && w <= MAX_SIDEBAR) {
      uiStore.setSidebarWidth(w);
    }
  }
}

function handleTreeFilterInput(e) {
  const q = e.target.value;
  if (typeof window.__handleTreeFilter === 'function') {
    window.__handleTreeFilter(q);
  }
}

onMount(() => {
  window.addEventListener('keydown', handleKeydown);
  return () => {
    window.removeEventListener('keydown', handleKeydown);
  };
});
</script>

<div id="toast" class="toast" data-testid="toast"></div>
<div id="app" data-testid="app">
  <Header />
  <div class="app-body">
    <LeftRail />
    <div class="content-area" class:pinned={uiStore.ui.leftRailPinned}>
      {#if currentTab === 'overview'}
        <OverviewDashboard />
      {:else}
        <div class="sidebar" style="width: {uiStore.ui.sidebarWidth}px" style:display={sidebarVisible ? '' : 'none'}>
          <!-- svelte-ignore a11y_no_noninteractive_tabindex a11y_no_noninteractive_element_interactions -->
          <div
            class="resize-handle"
            onmousedown={startResize}
            role="separator"
            tabindex="0"
            onkeydown={handleResizeKeydown}
            aria-label="Resize sidebar"
          ></div>
          <div class="sidebar-header">
            <span class="sidebar-title">{sidebarTitle}</span>
            <span class="sidebar-count">{sidebarCount}</span>
          </div>
          <FilterChips />
          <div id="treeControls" class="tree-controls" style="display:none">
            <input type="text" id="treeFilter" class="tree-filter" placeholder="Filter items..." oninput={handleTreeFilterInput} />
          </div>
          <div class="tree-wrapper" id="treeView">
            {#if !mergedFOM && currentTab !== 'modules' && currentTab !== 'overview'}
              <div class="empty-state">Load FOM files to begin. Use the "Load FOM" button in the header.</div>
            {/if}
            <div id="treeViewTree" class="tree-view-panel" style="display:none"><TreeView /></div>
            <div id="treeViewModules" class="tree-view-panel" style="display:none"><ModuleList /></div>
            <div id="treeViewDataTypes" class="tree-view-panel" style="display:none"><DataTypeList /></div>
            <div id="treeViewIssues" class="tree-view-panel" style="display:none"><IssueList /></div>
          </div>
        </div>
        <div class="detail">
          <DetailPanel />
        </div>
      {/if}
    </div>
  </div>
  <SearchPanel />
</div>
