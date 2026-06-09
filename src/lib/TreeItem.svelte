<script>
let {
  item = {},
  type = 'object',
  expanded = true,
  selectedName = ''
} = $props();

let isExpanded = $state(expanded);
$effect(() => {
  isExpanded = expanded;
});

function toggle(e) {
  e.stopPropagation();
  isExpanded = !isExpanded;
}

</script>

<div
  class="tree-item"
  class:tree-item-selected={selectedName === item.name}
  data-name={item.name}
  data-type={type}
  style:padding-left="{(item.depth || 0) * 20 + 8}px"
  role="button"
  tabindex="0"
  onclick={() => window.__selectTreeItem?.({ name: item.name, type })}
  onkeydown={(e) => { if (e.key === 'Enter') window.__selectTreeItem?.({ name: item.name, type }); }}
>
  {#if item.children && item.children.length > 0}
    <span
      class="tree-toggle"
      data-expanded={isExpanded}
      role="button"
      tabindex="0"
      aria-label="Toggle {item.name}"
      onclick={toggle}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(); }}
    >{isExpanded ? '▼' : '▶'}</span>
  {:else}
    <span class="tree-toggle-placeholder"></span>
  {/if}
  <span class="icon">{item.icon || (type === 'object' ? '📦' : '📡')}</span>
  <span class="name" title={item.fullName || item.name}>{item.name.split('.').pop()}</span>
</div>

{#if item.children && item.children.length > 0 && isExpanded}
  <div class="tree-children" class:collapsed={!isExpanded}>
    {#each item.children as child}
      <svelte:self
        item={child}
        type={type}
        selectedName={selectedName}
      />
    {/each}
  </div>
{/if}

<style>
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
  .tree-item-selected {
    background: var(--bg-selected, #e3f2fd) !important;
    font-weight: 500;
  }
  .tree-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    cursor: pointer;
    font-size: 10px;
    user-select: none;
  }
  .tree-toggle-placeholder {
    display: inline-block;
    width: 16px;
    flex-shrink: 0;
  }
  .icon {
    flex-shrink: 0;
    font-size: 14px;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tree-children {
    /* children container — no visual boundary needed */
  }
  .tree-children.collapsed {
    display: none;
  }
</style>
