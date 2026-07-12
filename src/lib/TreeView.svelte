<script>
import { onMount } from 'svelte';
import VirtualList from './VirtualList.svelte';
import TreeItem from './TreeItem.svelte';

let {
  items = [],
  type = 'flat',
  selectedItem = null
} = $props();

let flatItems = $state(items);
let listType = $state(type);
let selectedName = $state('');
let listRef = $state(null);
let containerEl = $state(null);
let containerWidth = $state(300);
let containerHeight = $state(600);
let allExpanded = $state(true);

const ITEM_SIZE = 30;

let treeItems = $derived.by(() => {
  if (listType !== 'tree') return [];
  return buildTree(flatItems);
});

function buildTree(flatList) {
  const map = new Map();
  const roots = [];
  for (const item of flatList) {
    map.set(item.name, { ...item, children: [], depth: 0 });
  }
  for (const item of flatList) {
    const node = map.get(item.name);
    if (item.parent && map.has(item.parent)) {
      const parent = map.get(item.parent);
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function flattenTree(nodes, acc = []) {
  for (const node of nodes) {
    acc.push(node);
    if (node.children && node.children.length > 0) {
      flattenTree(node.children, acc);
    }
  }
  return acc;
}

let flattenedTree = $derived(flattenTree(treeItems));

function setItems(newItems, newType) {
  flatItems = newItems || [];
  listType = newType || 'flat';
}

function getSelectedItem() {
  return selectedItem;
}

function setSelected(name) {
  selectedName = name || '';
}

function scrollToItem(name) {
  if (!containerEl) return;
  const el = containerEl.querySelector(`.tree-item[data-name="${CSS.escape(name)}"]`);
  if (el) {
    el.scrollIntoView({ block: 'nearest' });
  }
}

function handleItemClick(name, itemType) {
  selectedItem = { name, type: itemType };
  selectedName = name;
  if (window.__selectTreeItem) window.__selectTreeItem({ name, type: itemType });
}

function toggleAllExpand() {
  allExpanded = !allExpanded;
}

onMount(() => {
  window.__treeViewComponent = { setItems, getSelectedItem, scrollToItem, setSelected };

  if (containerEl) {
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        containerWidth = entry.contentRect.width;
        containerHeight = entry.contentRect.height;
      }
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  }
});
</script>

<div id="treeView" class="tree-container" bind:this={containerEl}>
  {#if listType === 'tree'}
    <div class="tree-header">
      <button class="btn btn-small" onclick={toggleAllExpand}>
        {allExpanded ? '⬆ Collapse All' : '⬇ Expand All'}
      </button>
    </div>
    <div class="tree-scroll-area">
      {#each treeItems as rootItem}
        <TreeItem
          item={rootItem}
          type="object"
          selectedName={selectedName}
          expanded={allExpanded}
        />
      {/each}
    </div>

  {:else if listType === 'modules'}
    <div class="tree-scroll-area">
      {#each flatItems as item}
        <div
          class="tree-item"
          class:selected={selectedName === item.name}
          data-name={item.name}
          data-type="module"
          role="button"
          tabindex="0"
          onclick={() => handleItemClick(item.name, 'module')}
          onkeydown={(e) => { if (e.key === 'Enter') handleItemClick(item.name, 'module'); }}
        >
          <span class="icon">📄</span>
          <span class="name" title={item.name}>{item.name}</span>
        </div>
      {/each}
    </div>

  {:else}
    <!-- Flat list with virtual scrolling -->
    {#if flatItems.length > 0}
      <VirtualList
        height={containerHeight}
        width={containerWidth || '100%'}
        itemCount={flatItems.length}
        itemSize={ITEM_SIZE}
        overscanCount={10}
      >
        {#snippet children({ items: listItems })}
          {#each listItems as { style, index }}
            {@const item = flatItems[index]}
            <div
              class="tree-item virtual-item"
              class:selected={selectedName === item.name}
              data-name={item.name}
              data-type={item.type || listType}
              {style}
              role="button"
              tabindex="0"
              onclick={() => handleItemClick(item.name, item.type || listType)}
              onkeydown={(e) => { if (e.key === 'Enter') handleItemClick(item.name, item.type || listType); }}
            >
              <span class="icon">{item.icon || '📄'}</span>
              <span class="name" title={item.fullName || item.name}>{item.name.split('.').pop()}</span>
              {#if item.usageCount !== undefined && item.usageCount > 0}
                <span class="usages">{item.usageCount} refs</span>
              {/if}
            </div>
          {/each}
        {/snippet}
      </VirtualList>
    {:else}
      <div class="empty-state">No items to display.</div>
    {/if}
  {/if}
</div>

<style>
  .tree-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  .tree-header {
    display: flex;
    gap: 6px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border-color, #e0e0e0);
    flex-shrink: 0;
  }
  .tree-scroll-area {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
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
  .usages {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-muted, #888);
    background: var(--bg-tertiary, #f0f0f0);
    padding: 1px 6px;
    border-radius: 8px;
    flex-shrink: 0;
  }
  .empty-state {
    padding: 16px 8px;
    color: var(--text-muted, #888);
    text-align: center;
    font-size: 13px;
  }
</style>
