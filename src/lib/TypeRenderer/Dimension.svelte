<script>
  import CollapsibleSection from '../CollapsibleSection.svelte';
  import RelatedIssues from '../RelatedIssues.svelte';

  let { item, issues = [] } = $props();
</script>

<div class="detail-section">
  <h3>Dimension</h3>
  <table class="property-table">
    <tbody>
    <tr><th>Name</th><td>{item.name}</td></tr>
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
    {#if item.isComplex && item.rows && item.rows.length > 0}
      {#each item.rows as r}
        <tr>
          <th>{r.key}</th>
          <td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">
            {#if r.key === 'dataType' && r.value}
              <button type="button" class="clickable-item" onclick={() => window.__showDataType(r.value, window.__getPreferredType(r.value))}>{r.value}</button>
            {:else}
              {r.value}
            {/if}
          </td>
        </tr>
      {/each}
    {/if}
    </tbody>
  </table>
</div>

<CollapsibleSection title="Related Issues" count={issues.length} orange={issues.length > 0} threshold={0}>
<RelatedIssues issues={issues} />
</CollapsibleSection>
