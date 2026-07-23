<script>
  import CollapsibleSection from '../CollapsibleSection.svelte';
  import UsedByTable from '../UsedByTable.svelte';
  import RelatedIssues from '../RelatedIssues.svelte';

  let { item, usages = [], issues = [] } = $props();
</script>

{#if item}
<div class="detail-section">
  <h3>Fixed Record Data Type</h3>
  <table class="property-table">
    <tbody>
    <tr><th>Name</th><td>{item.name}</td></tr>
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

{#if item.fields && item.fields.length > 0}
  <CollapsibleSection title="Fields" count={item.fields.length} threshold={0}>
  <table class="attr-table">
    <tbody>
    <tr><th>Name</th><th>Data Type</th><th>Encoding</th><th>Semantics</th><th>Notes</th></tr>
    {#each item.fields as f}
      <tr>
        <td>{f.name}</td>
        <td>{#if f.dataType}<button type="button" class="clickable-item" onclick={() => window.__showDataType(f.dataType, window.__getPreferredType(f.dataType))}>{f.dataType}</button>{/if}</td>
        <td>{f.encoding || ''}</td>
        <td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">{f.semantics || ''}</td>
        <td>
          {#if f.notes}
            <ul style="list-style:none;margin:0;padding:0;">
              {#each (f.notes || '').split(/\s+/).filter(Boolean) as note}
                <li><button type="button" class="clickable-item" onclick={() => window.__showDetail(note, 'notes', true)}>{note}</button></li>
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
{/if}
