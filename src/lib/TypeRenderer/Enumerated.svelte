<script>
  import CollapsibleSection from '../CollapsibleSection.svelte';
  import UsedByTable from '../UsedByTable.svelte';
  import RelatedIssues from '../RelatedIssues.svelte';
  import * as uiStore from '../stores/uiStore.svelte.js';

  let { item, usages = [], issues = [] } = $props();
  let highlight = $derived(uiStore.variantHighlight);

  let sortMode = $state('default');
  let tableEl = $state(null);

  let sortedValues = $derived.by(() => {
    const vals = item.values || [];
    if (sortMode === 'name') {
      return [...vals].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    if (sortMode === 'value') {
      return [...vals].sort((a, b) => (Number(a.value) || 0) - (Number(b.value) || 0));
    }
    return vals;
  });

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
    {#if item.notes}
      <tr>
        <th>Notes</th>
        <td>
          <ul style="list-style:none;margin:0;padding:0;">
            {#each (item.notes || '').split(/\s+/).filter(Boolean) as note}
              <li><span class="clickable-item" onclick={() => window.__showDetail(note, 'notes', true)}>{note}</span></li>
            {/each}
          </ul>
        </td>
      </tr>
    {/if}
    {#if item.representationNotes}
      <tr>
        <th>Representation Notes</th>
        <td>
          <ul style="list-style:none;margin:0;padding:0;">
            {#each (item.representationNotes || '').split(/\s+/).filter(Boolean) as note}
              <li><span class="clickable-item" onclick={() => window.__showDetail(note, 'notes', true)}>{note}</span></li>
            {/each}
          </ul>
        </td>
      </tr>
    {/if}
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
  <CollapsibleSection title="Enumerators" count={item.values.length} threshold={0}>
  <div class="sort-controls">
    <span class="sort-label">Sort:</span>
    <span class="sort-option" class:active={sortMode === 'default'} onclick={() => sortMode = 'default'}>Default</span>
    <span class="sort-option" class:active={sortMode === 'name'} onclick={() => sortMode = 'name'}>Name</span>
    <span class="sort-option" class:active={sortMode === 'value'} onclick={() => sortMode = 'value'}>Value</span>
  </div>
  <table class="attr-table" bind:this={tableEl}>
    <tbody>
    <tr><th>Name</th><th>Value</th><th>Notes</th></tr>
    {#each sortedValues as v}
      <tr>
        <td>{v.name}</td>
        <td>{v.value}</td>
        <td>
          {#if v.notes}
            <ul style="list-style:none;margin:0;padding:0;">
              {#each (v.notes || '').split(/\s+/).filter(Boolean) as note}
                <li><span class="clickable-item" onclick={() => window.__showDetail(note, 'notes', true)}>{note}</span></li>
              {/each}
            </ul>
          {/if}
        </td>
      </tr>
    {/each}
    </tbody>
  </table>
  </CollapsibleSection>
{/if}

<CollapsibleSection title="Used By" count={usages.length} threshold={0}>
<UsedByTable usages={usages} />
</CollapsibleSection>
<CollapsibleSection title="Related Issues" count={issues.length} orange={issues.length > 0} threshold={0}>
<RelatedIssues issues={issues} />
</CollapsibleSection>
