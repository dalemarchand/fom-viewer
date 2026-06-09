<script>
  import RelatedIssues from '../RelatedIssues.svelte';

  let { item, issues = [] } = $props();
</script>

<div class="detail-section">
  <h3>Tag</h3>
  <table class="property-table">
    <tbody>
    <tr><th>Name</th><td>{item.name}</td></tr>
    {#if item.dataType}<tr><th>Data Type</th><td>{item.dataType}</td></tr>{/if}
    {#if item.semantics}<tr><th>Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">{item.semantics}</td></tr>{/if}
    </tbody>
  </table>
</div>

<RelatedIssues issues={issues} />
