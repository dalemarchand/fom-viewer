<script>
  import RelatedIssues from '../RelatedIssues.svelte';

  let { item, issues = [] } = $props();
</script>

<div class="detail-section">
  <h3>Dimension</h3>
  <table class="property-table">
    <tbody>
    <tr><th>Name</th><td>{item.name}</td></tr>
    {#if item.isComplex && item.rows && item.rows.length > 0}
      {#each item.rows as r}
        <tr>
          <th>{r.key}</th>
          <td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">
            {#if r.key === 'dataType' && r.value}
              <span class="clickable-item" onclick={() => window.__showDataType(r.value, window.__getPreferredType(r.value))}>{r.value}</span>
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

<RelatedIssues issues={issues} />
