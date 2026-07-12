<script>
  import CollapsibleSection from '../CollapsibleSection.svelte';
  import UsedByTable from '../UsedByTable.svelte';
  import RelatedIssues from '../RelatedIssues.svelte';

  let { item, usages = [], issues = [] } = $props();
</script>

<div class="detail-section">
  <h3>Note</h3>
  <table class="property-table">
    <tbody>
    <tr><th>Label</th><td>{item.name}</td></tr>
    {#if item.semantics}<tr><th>Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">{item.semantics}</td></tr>{/if}
    {#if item.rows && item.rows.length > 0}
      {#each item.rows as r}
        <tr>
          <th>{r.key}</th>
          <td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">{r.value}</td>
        </tr>
      {/each}
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
