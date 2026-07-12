<script>
  let { title, count = null, defaultOpen = true, threshold = 6, orange = false, children } = $props();
  let open = $state(defaultOpen);
  let childCount = $state(0);
  let wrapperEl = $state(null);

  $effect(() => {
    if (wrapperEl) {
      childCount = wrapperEl.children.length;
    }
  });

  let skip = $derived(threshold > 0 && childCount < threshold);
  let hasCount = $derived(count !== null && count > 0);
</script>

{#if skip}
  <div class="collapsible-section flat" class:orange>
    {#if title}
      <h4 class="section-title">{title}{#if hasCount}<span class="section-count">{count}</span>{/if}</h4>
    {/if}
    <div class="section-content">
      {@render children()}
    </div>
  </div>
{:else}
  <div class="collapsible-section" class:orange>
    <button class="section-toggle" onclick={() => open = !open} aria-expanded={open}>
      <span class="chevron">{open ? '▾' : '▸'}</span>
      <span class="section-title">{title}</span>
      {#if hasCount}
        <span class="section-count">{count}</span>
      {/if}
    </button>
    {#if open}
      <div class="section-content" bind:this={wrapperEl}>
        {@render children()}
      </div>
    {/if}
  </div>
{/if}

<style>
  .collapsible-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    margin-bottom: 12px;
    overflow: hidden;
    box-shadow: var(--card-shadow, 0 1px 3px rgba(0,0,0,0.05));
  }
  .collapsible-section.flat {
    background: none;
    border: none;
    border-radius: 0;
    margin-bottom: 4px;
    box-shadow: none;
    padding: 0;
  }
  .collapsible-section.orange {
    border-color: var(--warning, #f59e0b);
  }
  .collapsible-section.orange .section-toggle:hover {
    background: color-mix(in srgb, var(--warning, #f59e0b) 10%, transparent);
  }
  .section-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: none;
    cursor: pointer;
    font: inherit;
    font-size: 0.95em;
    color: var(--text-primary);
    text-align: left;
    border-bottom: 1px solid var(--border);
  }
  .collapsible-section.flat .section-toggle {
    border-bottom: none;
  }
  .section-toggle:hover {
    background: var(--bg-hover, rgba(128,128,128,0.05));
  }
  .collapsible-section.flat .section-toggle {
    padding: 6px 8px;
  }
  .chevron {
    font-size: 0.75em;
    width: 12px;
    flex-shrink: 0;
    color: var(--text-muted);
  }
  .section-title {
    font-weight: 600;
    font-size: 0.9em;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary);
  }
  .section-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
    color: var(--text-muted);
    font-size: 10px;
    font-weight: 600;
    min-width: 18px;
    height: 16px;
    border-radius: 8px;
    padding: 0 5px;
    margin-left: auto;
  }
  .collapsible-section.orange .section-count {
    background: color-mix(in srgb, var(--warning, #f59e0b) 20%, transparent);
    color: var(--warning, #f59e0b);
  }
  .section-content {
    padding: 8px 12px 12px;
  }
  .flat .section-title {
    padding: 6px 8px 2px 8px;
    display: block;
    gap: 6px;
    align-items: center;
  }
  .flat .section-content {
    padding: 2px 8px 2px 8px;
  }
</style>
