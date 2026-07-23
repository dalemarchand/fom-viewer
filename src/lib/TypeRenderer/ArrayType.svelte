<script>
  import CollapsibleSection from '../CollapsibleSection.svelte';
  import UsedByTable from '../UsedByTable.svelte';
  import RelatedIssues from '../RelatedIssues.svelte';

  let { item, usages = [], issues = [] } = $props();
</script>

{#if item}
<div class="detail-section">
  <h3>Array Data Type</h3>
  <table class="property-table">
    <tbody>
    <tr><th>Name</th><td>{item.name}</td></tr>
    {#if item.dataType}
      <tr>
        <th>Data Type</th>
        <td><button type="button" class="clickable-item" onclick={() => window.__showDataType(item.dataType, window.__getPreferredType(item.dataType))}>{item.dataType}</button></td>
      </tr>
    {/if}
    {#if item.cardinality}<tr><th>Cardinality</th><td>{item.cardinality}</td></tr>{/if}
    {#if item.encoding}<tr><th>Encoding</th><td>{item.encoding}</td></tr>{/if}
    {#if item.semantics}<tr><th>Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">{item.semantics}</td></tr>{/if}
    {#if item.notes}
      <tr>
        <th>Notes</th>
        <td>
          <ul style="list-style:none;margin:0;padding:0;">
            {#each (item.notes || '').split(/\s+/).filter(Boolean) as note}
              <li><button type="button" class="clickable-item" onclick={() => window.__showDetail(note, 'notes', true)}>{note}</button></li>
            {/each}
          </ul>
        </td>
      </tr>
    {/if}
    {#if item._sources || item._source}
      <tr>
        <th>Module{(item._sources?.length || 1) > 1 ? 's' : ''}</th>
        <td>
          <ul style="list-style:none;margin:0;padding:0;">
            {#each (item._sources || (item._source ? [item._source] : [])) as s}
              <li><button type="button" class="clickable-item" onclick={() => window.__switchToModule(s)}>{s}</button></li>
            {/each}
          </ul>
        </td>
      </tr>
    {/if}
    </tbody>
  </table>
</div>

<CollapsibleSection title="Used By" count={usages.length} threshold={0}>
<UsedByTable usages={usages} />
</CollapsibleSection>
<CollapsibleSection title="Related Issues" count={issues.length} orange={issues.length > 0} threshold={0}>
<RelatedIssues issues={issues} />
</CollapsibleSection>
{/if}
