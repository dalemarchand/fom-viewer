<script>
  import UsedByTable from '../UsedByTable.svelte';
  import RelatedIssues from '../RelatedIssues.svelte';

  let { item, usages = [], issues = [] } = $props();
</script>

<div class="detail-section">
  <h3>Array Data Type</h3>
  <table class="property-table">
    <tbody>
    <tr><th>Name</th><td>{item.name}</td></tr>
    {#if item.dataType}
      <tr>
        <th>Data Type</th>
        <td><span class="clickable-item" onclick={() => window.__showDataType(item.dataType, window.__getPreferredType(item.dataType))}>{item.dataType}</span></td>
      </tr>
    {/if}
    {#if item.cardinality}<tr><th>Cardinality</th><td>{item.cardinality}</td></tr>{/if}
    {#if item.encoding}<tr><th>Encoding</th><td>{item.encoding}</td></tr>{/if}
    {#if item.semantics}<tr><th>Semantics</th><td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">{item.semantics}</td></tr>{/if}
    {#if item._sources || item._source}
      <tr>
        <th>Module{(item._sources?.length || 1) > 1 ? 's' : ''}</th>
        <td>
          <ul style="list-style:none;margin:0;padding:0;">
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

<UsedByTable usages={usages} />
<RelatedIssues issues={issues} />
