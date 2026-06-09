<script>
  import RelatedIssues from '../RelatedIssues.svelte';

  let { item, issues = [] } = $props();
</script>

<div class="detail-section">
  <h3>Time Configuration</h3>
  <table class="property-table">
    <tbody>
    {#if item.timeStamp}
      <tr><th>Time Stamp Data Type</th><td>{item.timeStamp.dataType || ''}</td></tr>
      {#if item.timeStamp.semantics}
        <tr><th>Time Stamp Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">{item.timeStamp.semantics}</td></tr>
      {/if}
    {/if}
    {#if item.lookahead}
      <tr><th>Lookahead Data Type</th><td>{item.lookahead.dataType || ''}</td></tr>
      {#if item.lookahead.semantics}
        <tr><th>Lookahead Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">{item.lookahead.semantics}</td></tr>
      {/if}
    {/if}
    </tbody>
  </table>
</div>

<RelatedIssues issues={issues} />
