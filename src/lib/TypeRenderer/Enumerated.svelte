<script>
  import UsedByTable from '../UsedByTable.svelte';
  import RelatedIssues from '../RelatedIssues.svelte';
  import * as uiStore from '../stores/uiStore.svelte.js';

  let { item, usages = [], issues = [] } = $props();
  let highlight = $derived(uiStore.variantHighlight);

  let tableEl = $state(null);

  $effect(() => {
    if (highlight.enumTypeName === item.name && highlight.enumeratorName && tableEl) {
      const rows = tableEl.querySelectorAll('tbody tr');
      for (const row of rows) {
        const cell = row.querySelector('td:first-child');
        if (cell && cell.textContent.trim() === highlight.enumeratorName) {
          row.classList.add('variant-highlighted');
          row.scrollIntoView({ block: 'nearest' });
          setTimeout(() => row.classList.remove('variant-highlighted'), 2000);
          break;
        }
      }
    }
  });
</script>

<div class="detail-section">
  <h3>Enumerated Data Type</h3>
  <table class="property-table">
    <tbody>
    <tr><th>Name</th><td>{item.name}</td></tr>
    {#if item.representation}
      <tr>
        <th>Representation</th>
        <td><span class="clickable-item" onclick={() => window.__showDataType(item.representation, 'basic')}>{item.representation}</span></td>
      </tr>
    {/if}
    {#if item.semantics}<tr><th>Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">{item.semantics}</td></tr>{/if}
    {#if item._sources || item._source}
      <tr>
        <th>Module{(item._sources?.length || 1) > 1 ? 's' : ''}</th>
        <td>
          <ul style="list-style: none;margin:0;padding:0;">
            {#each (item._sources || (item._source ? [item._source] : [])) as s}
              <li><span class="clickable-item" onclick={() => window.__switchToModule(s)}>{s}</span></li>
            {/each}
          </ul>
        </td>
      </tr>
    {/if}
    </tbody>
  </table>
</div>

{#if item.values && item.values.length > 0}
  <h4 style="margin:12px 0 8px">Enumerators</h4>
  <table class="property-table" bind:this={tableEl}>
    <tbody>
    <tr><th>Name</th><th>Value</th></tr>
    {#each item.values as v}
      <tr>
        <td>{v.name}</td>
        <td>{v.value}</td>
      </tr>
    {/each}
    </tbody>
  </table>
{/if}

<UsedByTable usages={usages} />
<RelatedIssues issues={issues} />
