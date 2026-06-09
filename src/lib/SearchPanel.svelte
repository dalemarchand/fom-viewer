<script>
import { searchState } from './stores/searchStore.svelte.js';
import { onMount } from 'svelte';

const TYPE_ICONS = {
  object: '\u{1F4E6}', interaction: '\u{1F4AC}', basic: '\u{1F524}', simple: '\u{1F4DD}',
  array: '\u{1F4CB}', fixed: '\u{1F4D1}', enum: '\u{1F522}', variant: '\u{1F500}',
  trans: '\u{1F69A}', switches: '\u{1F518}', tags: '\u{1F3F7}\uFE0F', dims: '\u{1F4D0}',
  notes: '\u{1F4DD}', time: '\u{23F1}\uFE0F',
  appspace_object: '\u{1F4E6}', appspace_interaction: '\u{1F4AC}', appspace_unknown: '\u{2753}',
  module: '\u{1F4C1}', attribute: '\u{1F4C4}', parameter: '\u{1F4C4}',
  enumerator: '\u{1F522}', field: '\u{1F4CB}', alternative: '\u{1F500}',
  appspace_app: '\u{1F4E6}'
};

const GROUP_LABELS = {
  object: 'Object Classes', interaction: 'Interaction Classes',
  basic: 'Basic Data Types', simple: 'Simple Data Types',
  array: 'Array Data Types', fixed: 'Fixed Record Data Types',
  enum: 'Enumerated Data Types', variant: 'Variant Record Data Types',
  trans: 'Transportations', switches: 'Switches',
  tags: 'Tags', dims: 'Dimensions',
  notes: 'Notes', time: 'Time',
  appspace_object: 'Appspace Objects', appspace_interaction: 'Appspace Interactions', appspace_unknown: 'Appspace Unknown',
  module: 'FOM Modules', attribute: 'Object Attributes', parameter: 'Interaction Parameters',
  enumerator: 'Enumerators', field: 'Fixed Record Fields', alternative: 'Variant Alternatives',
  appspace_app: 'Appspace Applications'
};

const GROUP_ORDER = ['module', 'object', 'interaction', 'basic', 'simple', 'array', 'fixed', 'enum', 'variant', 'attribute', 'parameter', 'enumerator', 'field', 'alternative', 'trans', 'switches', 'tags', 'dims', 'notes', 'time', 'appspace_object', 'appspace_interaction', 'appspace_unknown', 'appspace_app'];

let tooltipText = $state('');
let tooltipX = $state(0);
let tooltipY = $state(0);
let tooltipVisible = $state(false);
let selectedIndex = $state(-1);
let panelEl = $state(null);

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function highlightText(text, query) {
  if (!query || !text) return escapeHtml(text || '');
  const escaped = escapeHtml(text);
  const q = escapeHtml(query);
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return escaped.replace(re, '<mark>$1</mark>');
}

function handleMouseEnter(e, snippet) {
  if (!snippet) return;
  tooltipText = snippet;
  tooltipVisible = true;
  tooltipX = e.clientX + 14;
  tooltipY = e.clientY + 14;
}

function handleMouseMove(e) {
  if (!tooltipVisible) return;
  tooltipX = e.clientX + 14;
  tooltipY = e.clientY + 14;
}

function handleMouseLeave() {
  tooltipVisible = false;
  tooltipText = '';
}

function handleItemClick(item) {
  if (window.__onSearchItemClick) {
    window.__onSearchItemClick(item);
  }
}

function handleKeyDown(e) {
  if (!searchState.visible) return;
  const count = searchState.results.length;
  if (count === 0) return;
  if (e.key === 'Escape') {
    searchState.visible = false;
    document.getElementById('globalSearch')?.blur();
    e.preventDefault();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex = Math.min(selectedIndex + 1, count - 1);
    scrollSelectedIntoView();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex = Math.max(selectedIndex - 1, 0);
    scrollSelectedIntoView();
  } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < count) {
    e.preventDefault();
    handleItemClick(searchState.results[selectedIndex]);
  }
}

function scrollSelectedIntoView() {
  if (!panelEl) return;
  const items = panelEl.querySelectorAll('.search-panel-item');
  if (items[selectedIndex]) {
    items[selectedIndex].scrollIntoView({ block: 'nearest' });
  }
}

function handleOutsideClick(e) {
  if (!searchState.visible) return;
  const panel = document.getElementById('searchPanel');
  if (panel && !panel.contains(e.target) && e.target.id !== 'globalSearch') {
    searchState.visible = false;
  }
}

onMount(() => {
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('click', handleOutsideClick, true);
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('click', handleOutsideClick, true);
  };
});

let groups = $derived.by(() => {
  const g = {};
  const results = searchState.results;
  if (!results) return [];
  results.forEach(r => {
    if (!g[r.type]) g[r.type] = [];
    g[r.type].push(r);
  });
  const ordered = [];
  GROUP_ORDER.forEach(type => {
    if (g[type] && g[type].length > 0) {
      ordered.push({ type, label: GROUP_LABELS[type] || type, icon: TYPE_ICONS[type] || '', items: g[type] });
    }
  });
  return ordered;
});

let flatItems = $derived(searchState.results);

$effect(() => {
  if (searchState.visible) {
    selectedIndex = -1;
  }
});

function closePanel() {
  searchState.visible = false;
}
</script>

{#if searchState.visible}
  <div id="searchPanel" class="search-panel" role="listbox" bind:this={panelEl}>
    <div class="search-panel-header">
      Results for "<strong>{escapeHtml(searchState.query)}</strong>"
      <span class="search-panel-count">{searchState.results.length} match{searchState.results.length !== 1 ? 'es' : ''}</span>
    </div>
    <div class="search-panel-body">
      {#if groups.length === 0}
        <div class="search-panel-empty">No results found. Try a different search term.</div>
      {:else}
        {#each groups as group}
          <div class="search-panel-group" role="group" aria-label={group.label}>
            <div class="search-panel-group-header">{group.icon} {group.label} ({group.items.length})</div>
            {#each group.items as item, i}
              <div
                class="search-panel-item"
                class:selected={flatItems.indexOf(item) === selectedIndex}
                data-name={item.name}
                data-type={item.type}
                data-snippet={item.snippet || ''}
                data-parent={item.parentName || ''}
                data-parent-type={item.parentType || ''}
                role="option"
                aria-selected={flatItems.indexOf(item) === selectedIndex}
                tabindex="-1"
                onmouseenter={(e) => handleMouseEnter(e, item.snippet)}
                onmousemove={handleMouseMove}
                onmouseleave={handleMouseLeave}
                onclick={() => handleItemClick(item)}
              >
                <span class="search-panel-item-icon">{TYPE_ICONS[item.type] || ''}</span>
                <span class="search-panel-item-name">{@html highlightText(item.name, searchState.query)}</span>
              </div>
            {/each}
          </div>
        {/each}
      {/if}
    </div>
  </div>
{/if}

{#if tooltipVisible}
  <div class="search-tooltip" style="left: {tooltipX}px; top: {tooltipY}px">{tooltipText}</div>
{/if}
