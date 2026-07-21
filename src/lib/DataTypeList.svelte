<script>
import { onMount } from 'svelte';
import VirtualList from './VirtualList.svelte';

let items = $state([]);
let type = $state('basic');
let sortEnabled = $state('asc');

let selectedName = $state('');

let containerEl = $state(null);
let containerHeight = $state(600);

const ITEM_SIZE = 30;

let sortedItems = $derived.by(() => {
  if (sortEnabled === 'asc') {
    return [...items].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sortEnabled === 'desc') {
    return [...items].sort((a, b) => (b.name || '').localeCompare(a.name || ''));
  }
  return [...items];
});

function setItems(newItems, dataType, sortDir) {
  items = newItems || [];
  type = dataType || 'basic';
  sortEnabled = sortDir || 'asc';
}

function setSelected(name) {
  selectedName = name || '';
}

function handleSelect(name) {
  selectedName = name;
  if (window.__selectTreeItem) window.__selectTreeItem({ name, type });
}

onMount(() => {
  window.__dataTypeListComponent = { setItems, setSelected };
  if (typeof window.updateUI === 'function') window.updateUI();
  if (containerEl) {
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerHeight = entry.contentRect.height;
      }
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  }
});
</script>

<div class="datatype-list" bind:this={containerEl}>
  {#if sortedItems.length === 0}
    <div class="empty-state">No {type} data types found.</div>
  {:else if sortedItems.length > 50}
    <VirtualList
      height={containerHeight}
      width="100%"
      itemCount={sortedItems.length}
      itemSize={ITEM_SIZE}
      overscanCount={10}
    >
      {#snippet children({ items: listItems })}
        {#each listItems as { style, index }}
          {@const item = sortedItems[index]}
          <div
            class="tree-item virtual-item"
            class:selected={selectedName === item.name}
            data-name={item.name}
            data-type={type}
            {style}
            role="button"
            tabindex="0"
            onclick={() => handleSelect(item.name)}
            onkeydown={(e) => { if (e.key === 'Enter') handleSelect(item.name); }}
          >
            <span class="icon">{item.icon || '📐'}</span>
            <span class="name" title={item.fullName || item.name}>{item.name}</span>
          </div>
        {/each}
      {/snippet}
    </VirtualList>
  {:else}
    {#each sortedItems as item}
      <div
        class="tree-item"
        class:selected={selectedName === item.name}
        data-name={item.name}
        data-type={type}
        role="button"
        tabindex="0"
        onclick={() => handleSelect(item.name)}
        onkeydown={(e) => { if (e.key === 'Enter') handleSelect(item.name); }}
      >
        <span class="icon">{item.icon || '📐'}</span>
        <span class="name" title={item.fullName || item.name}>{item.name}</span>
      </div>
    {/each}
  {/if}
</div>

<style>
  .datatype-list {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
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
  .virtual-item {
    box-sizing: border-box;
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
