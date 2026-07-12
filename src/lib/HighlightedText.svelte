<script>
  import { searchState } from './stores/searchStore.svelte.js';

  let { text = '', terms = null } = $props();

  let activeQuery = $derived(terms ?? searchState.query);

  let parts = $derived.by(() => {
    if (!activeQuery || !text) return [text];
    let escaped = activeQuery
      .split(/\s+/)
      .filter(t => t && t.length > 0)
      .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    if (!escaped) return [text];
    let re = new RegExp(`(${escaped})`, 'gi');
    return text.split(re);
  });
</script>

{#if parts.length === 1}
  {text}
{:else}
  {#each parts as part, i}
    {#if activeQuery.split(/\s+/).some(t => part.toLowerCase() === t.toLowerCase())}
      <mark class="highlight">{part}</mark>
    {:else}
      {part}
    {/if}
  {/each}
{/if}

<style>
  .highlight {
    background: var(--highlight-bg, #fff3a8);
    color: var(--highlight-fg, inherit);
    border-radius: 2px;
    padding: 0 1px;
  }
</style>
