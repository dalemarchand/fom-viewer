<script>
import { onMount } from 'svelte';
import * as fomStore from './stores/fomStore.svelte.js';
import * as uiStore from './stores/uiStore.svelte.js';

let files = $derived(fomStore.getFiles());
let sortEnabled = $derived(uiStore.ui.sortEnabled);
let selectedItem = $derived(uiStore.ui.selectedItem);
let selectedName = $derived(selectedItem && selectedItem.type === 'module' ? selectedItem.name : '');
let filterQuery = $state('');

let sortedFiles = $derived.by(() => {
  let list = [...files];
  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    list = list.filter(f => f.name.toLowerCase().includes(q));
  }
  if (sortEnabled === 'asc') {
    return list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortEnabled === 'desc') {
    return list.sort((a, b) => b.name.localeCompare(a.name));
  }
  return list;
});

function setFiles(newFiles, sortDir) {
  // Backwards compatibility
}

function setSelected(name) {
  // Backwards compatibility
}

function handleSelect(name) {
  if (window.__selectTreeItem) window.__selectTreeItem({ name, type: 'module' });
}

onMount(() => {
  window.__moduleListComponent = { setFiles, setSelected };
  const input = document.getElementById('treeFilter');
  if (input) {
    filterQuery = input.value || '';
    const handleInput = () => {
      filterQuery = input.value || '';
    };
    input.addEventListener('input', handleInput);
    return () => input.removeEventListener('input', handleInput);
  }
});
</script>

<div class="module-list">
  {#if sortedFiles.length === 0}
    <div class="empty-state">No FOM modules loaded. Use the "Load FOM" button in the header.</div>
  {:else}
    {#each sortedFiles as file}
      <div
        class="tree-item"
        class:selected={selectedName === file.name}
        data-name={file.name}
        data-type="module"
        role="button"
        tabindex="0"
        onclick={() => handleSelect(file.name)}
        onkeydown={(e) => { if (e.key === 'Enter') handleSelect(file.name); }}
      >
        <span class="icon">📄</span>
        <span class="name" title={file.name}>{file.name}</span>
      </div>
    {/each}
  {/if}
</div>

<style>
  .module-list {
    display: flex;
    flex-direction: column;
  }
  .tree-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
    line-height: 1.4;
    border-radius: 3px;
    transition: background-color 0.1s;
  }
  .tree-item:hover {
    background: var(--bg-hover, #f0f0f0);
  }
  .tree-item.selected {
    background: var(--bg-selected, #e3f2fd) !important;
    font-weight: 500;
  }
  .icon {
    flex-shrink: 0;
    font-size: 14px;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .empty-state {
    padding: 16px 8px;
    color: var(--text-muted, #888);
    text-align: center;
    font-size: 13px;
  }
</style>
