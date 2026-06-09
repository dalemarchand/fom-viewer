<script>
  import UsedByTable from '../UsedByTable.svelte';
  import RelatedIssues from '../RelatedIssues.svelte';

  let { item, usages = [], issues = [] } = $props();
</script>

<div class="detail-section">
  <h3>Fixed Record Data Type</h3>
  <table class="property-table">
    <tbody>
    <tr><th>Name</th><td>{item.name}</td></tr>
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

{#if item.fields && item.fields.length > 0}
  <h4 style="margin:12px 0 8px">Fields (original order)</h4>
  <table class="property-table">
    <tbody>
    <tr><th>Name</th><th>Data Type</th><th>Encoding</th><th>Semantics</th></tr>
    {#each item.fields as f}
      <tr>
        <td>{f.name}</td>
        <td>{#if f.dataType}<span class="clickable-item" onclick={() => window.__showDataType(f.dataType, window.__getPreferredType(f.dataType))}>{f.dataType}</span>{/if}</td>
        <td>{f.encoding || ''}</td>
        <td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">{f.semantics || ''}</td>
      </tr>
    {/each}
    </tbody>
  </table>
{/if}

<UsedByTable usages={usages} />
<RelatedIssues issues={issues} />
