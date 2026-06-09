<script>
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

<UsedByTable usages={usages} />
<RelatedIssues issues={issues} />
