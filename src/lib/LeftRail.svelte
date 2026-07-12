<script>
import { ui } from './stores/uiStore.svelte.js';
import { ICONS, TAB_ICONS } from './icons.js';
import * as fomStore from './stores/fomStore.svelte.js';
import * as issueStore from './stores/issueStore.svelte.js';
import * as appspaceStore from './stores/appspaceStore.svelte.js';

let files = $derived(fomStore.getFiles());
let mergedFOM = $derived(fomStore.getMergedFOM());

let counts = $derived({
  overview: 0,
  modules: files.length,
  objects: mergedFOM?.objectClasses?.length ?? 0,
  interactions: mergedFOM?.interactionClasses?.length ?? 0,
  datatypes: mergedFOM?.dataTypes ? Object.values(mergedFOM.dataTypes).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0) : 0,
  dims: files.reduce((sum, f) => sum + (f.dimensions?.length ?? 0), 0),
  trans: files.reduce((sum, f) => sum + (f.transportations?.length ?? 0), 0),
  switches: files.reduce((sum, f) => sum + (f.switches?.length ?? 0), 0),
  tags: files.reduce((sum, f) => sum + (f.tags?.length ?? 0), 0),
  time: mergedFOM?.time ? 1 : 0,
  notes: files.reduce((sum, f) => sum + (f.notes?.length ?? 0), 0),
  appspaces: appspaceStore.getTotalCount(),
});

let issueCount = $derived(issueStore.getIssues().length);

// Reactive hidden state per tab id (overrides static hidden in SECTIONS)
let tabHidden = $derived({});

const SECTIONS = [
  {
    label: 'Home',
    tabs: [
      { id: 'overview', label: 'Overview', icon: TAB_ICONS.overview },
    ],
  },
  {
    label: 'Data Model',
    tabs: [
      { id: 'modules', label: 'Modules', icon: TAB_ICONS.modules },
      { id: 'objects', label: 'Object Classes', icon: TAB_ICONS.objects },
      { id: 'interactions', label: 'Interaction Classes', icon: TAB_ICONS.interactions },
      { id: 'datatypes', label: 'Data Types', icon: TAB_ICONS.datatypes },
      { id: 'appspaces', label: 'Appspaces', icon: TAB_ICONS.appspaces },
    ],
  },
  {
    label: 'Infrastructure',
    tabs: [
      { id: 'dims', label: 'Dimensions', icon: TAB_ICONS.dims },
      { id: 'trans', label: 'Transportations', icon: TAB_ICONS.trans },
      { id: 'switches', label: 'Switches', icon: TAB_ICONS.switches },
      { id: 'tags', label: 'Tags', icon: TAB_ICONS.tags },
      { id: 'time', label: 'Time', icon: TAB_ICONS.time },
    ],
  },
  {
    label: 'Documentation',
    tabs: [
      { id: 'notes', label: 'Notes', icon: TAB_ICONS.notes },
      { id: 'issues', label: 'Issues', icon: TAB_ICONS.issues, hidden: true },
    ],
  },
];
</script>

<div class="left-rail" class:pinned={ui.leftRailPinned} data-testid="leftRail">
  <div class="sidebar-toolbar" class:visible={ui.sortBtnVisible}>
    <button id="sortBtn" class="btn-ghost btn-small sort-btn sidebar-tool" title="Toggle sort order">Sort: A→Z</button>
  </div>
  {#each SECTIONS as section}
    <div class="rail-section">
      <div class="rail-section-label">{section.label}</div>
      {#each section.tabs as tabItem}
        {#if (tabHidden[tabItem.id] ?? tabItem.hidden)}
          <button
            class="rail-item tab"
            class:active={ui.currentTab === tabItem.id}
            data-tab={tabItem.id}
            style="display:none"
            title={tabItem.label}
          >
            {@html ICONS[tabItem.icon]}
            <span class="rail-label">{tabItem.label}</span>
            {#if tabItem.id === 'issues' && issueCount > 0}
              <span class="rail-badge">{issueCount}</span>
            {:else if counts[tabItem.id] > 0}
              <span class="rail-count">{counts[tabItem.id]}</span>
            {/if}
          </button>
        {:else}
          <button
            class="rail-item tab"
            class:active={ui.currentTab === tabItem.id}
            data-tab={tabItem.id}
            title={tabItem.label}
          >
            {@html ICONS[tabItem.icon]}
            <span class="rail-label">{tabItem.label}</span>
            {#if tabItem.id === 'issues' && issueCount > 0}
              <span class="rail-badge">{issueCount}</span>
            {:else if counts[tabItem.id] > 0}
              <span class="rail-count">{counts[tabItem.id]}</span>
            {/if}
          </button>
        {/if}
      {/each}
    </div>
    {#if section !== SECTIONS[SECTIONS.length - 1]}
      <div class="rail-sep"></div>
    {/if}
  {/each}

  <div class="rail-spacer"></div>

  <button
    class="rail-item rail-bottom-btn"
    title={ui.leftRailPinned ? 'Unpin sidebar' : 'Pin sidebar'}
    onclick={() => ui.leftRailPinned = !ui.leftRailPinned}
  >
    {@html ICONS.pin}
  </button>
</div>
