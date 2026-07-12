<script>
  let { children } = $props();
  let open = $state(false);
  let menuEl = $state(null);

  function toggle() {
    open = !open;
  }

  function handleClick(e) {
    if (menuEl && !menuEl.contains(e.target)) {
      open = false;
    }
  }

  function handleItemClick() {
    open = false;
  }
</script>

<svelte:window onclick={handleClick} />

<div class="overflow-menu" bind:this={menuEl}>
  <button class="overflow-toggle" onclick={toggle} aria-label="More actions" data-testid="overflowToggle">···</button>
  <div class="overflow-dropdown" style="display:{open ? 'block' : 'none'}" onclick={handleItemClick} role="menu">
    {@render children()}
  </div>
</div>

<style>
  .overflow-menu {
    position: relative;
    flex-shrink: 0;
  }
  .overflow-toggle {
    background: rgba(255,255,255,0.15);
    border: none;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 18px;
    letter-spacing: 2px;
    line-height: 1;
    color: white;
    transition: all 0.2s;
  }
  .overflow-toggle:hover {
    background: rgba(255,255,255,0.3);
  }
  .overflow-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    z-index: 1000;
    min-width: 180px;
    padding: 4px;
  }
  :global(.overflow-item) {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: none;
    color: var(--text-primary);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
    text-align: left;
    white-space: nowrap;
  }
  :global(.overflow-item:hover) {
    background: var(--bg-tertiary);
  }
  :global(.overflow-item.hidden) {
    display: none !important;
  }
</style>
