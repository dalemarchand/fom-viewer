<script>
let files = $state([]);
let sortEnabled = $state('asc');
let selectedName = $state('');

let sortedFiles = $derived.by(() => {
  if (sortEnabled === 'asc') {
    return [...files].sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortEnabled === 'desc') {
    return [...files].sort((a, b) => b.name.localeCompare(a.name));
  }
  return [...files];
});

function setFiles(newFiles, sortDir) {
  files = newFiles || [];
  sortEnabled = sortDir || 'asc';
}

function setSelected(name) {
  selectedName = name || '';
}

function handleSelect(name) {
  selectedName = name;
  if (window.__selectTreeItem) window.__selectTreeItem({ name, type: 'module' });
}

import { onMount } from 'svelte';
onMount(() => {
  window.__moduleListComponent = { setFiles, setSelected };
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
