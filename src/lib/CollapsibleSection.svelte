<script>
  let { title, defaultOpen = true, threshold = 6, children } = $props();
  let open = $state(defaultOpen);
  let childCount = $state(0);
  let wrapperEl = $state(null);

  $effect(() => {
    if (wrapperEl) {
      childCount = wrapperEl.children.length;
    }
  });

  let skip = $derived(threshold > 0 && childCount < threshold);
</script>

{#if skip}
  <div class="collapsible-section flat">
    {#if title}
      <h4 class="section-title">{title}</h4>
    {/if}
    <div class="section-content">
      {@render children()}
    </div>
  </div>
{:else}
  <div class="collapsible-section">
    <button class="section-toggle" onclick={() => open = !open} aria-expanded={open}>
      <span class="chevron">{open ? '▾' : '▸'}</span>
      <span class="section-title">{title}</span>
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
    margin: 0 0 4px 0;
  }
  .collapsible-section.flat {
    padding: 0;
  }
  .section-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 8px;
    border: none;
    background: none;
    cursor: pointer;
    font: inherit;
    font-size: 0.95em;
    color: var(--text-secondary, #666);
    text-align: left;
    border-radius: 4px;
  }
  .section-toggle:hover {
    background: var(--bg-hover, rgba(128,128,128,0.08));
  }
  .chevron {
    font-size: 0.75em;
    width: 12px;
    flex-shrink: 0;
  }
  .section-title {
    font-weight: 600;
    font-size: 0.9em;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary, #666);
  }
  .section-content {
    padding: 2px 0 2px 20px;
  }
  .flat .section-title {
    padding: 6px 8px 2px 8px;
    display: block;
  }
  .flat .section-content {
    padding: 2px 8px 2px 8px;
  }
</style>
