<script>
  import CollapsibleSection from '../CollapsibleSection.svelte';
  import RelatedIssues from '../RelatedIssues.svelte';

  let { item, parents = [], issues = [], widgetBadges = {}, appspaceName = '' } = $props();
  let safeParams = $derived(item?.parameters?.filter(p => p && typeof p === 'object') || []);

  function transportLink(transportation) {
    if (!transportation) return '';
    const merged = window.__mergedFOM;
    const exists = merged?.transportations?.some(t => t.name.trim() === transportation.trim());
    if (exists) {
      return `<button type="button" class="clickable-item" onclick="window.__showDetail('${transportation.replace(/'/g, "\\'")}', 'trans', true)">${transportation}</button>`;
    }
    return `<span style="color:red;">${transportation}</span>`;
  }

  function dimsHtml(dimensions) {
    if (!dimensions || dimensions.length === 0) return '';
    let html = '<ul style="list-style:none;margin:0;padding:0;">';
    for (const d of dimensions) {
      const exists = window.__findDimensionByName(d);
      if (exists) {
        html += `<li><button type="button" class="clickable-item" onclick="window.__showDetail('${d.replace(/'/g, "\\'")}', 'dims', true)">${d}</button></li>`;
      } else {
        html += `<li><span style="color:red;">${d}</span></li>`;
      }
    }
    html += '</ul>';
    return html;
  }

  function shortName(str) {
    if (!str) return '';
    return str.split('.').pop();
  }
</script>

{#if item}
<div class="detail-section">
  {#if parents.length > 0}
    <div class="breadcrumb">
      {#each parents as p, idx}
        <button type="button" class="breadcrumb-item clickable-item" onclick={() => window.__showDetail(p.name, 'interaction', true)}>{shortName(p.name)}<span class="widget-badge">{widgetBadges[p.name] ?? '?'}</span></button>
        {#if idx < parents.length - 1}<span class="breadcrumb-sep"> &gt; </span>{/if}
      {/each}
      <span class="breadcrumb-sep"> &gt; </span>
      <span class="breadcrumb-current">{shortName(item.name)}<span class="widget-badge">{widgetBadges[item.name] ?? safeParams.length}</span></span>
    </div>
  {/if}

  <h3>Interaction Class</h3>
  <table class="property-table">
    <tbody>
    <tr><th>Name</th><td>{shortName(item.name)}</td></tr>
    {#if item.sharing}<tr><th>Sharing</th><td>{item.sharing}</td></tr>{/if}
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
    {#if item.parent}
      <tr><th>Parent</th><td><button type="button" class="clickable-item" onclick={() => window.__showDetail(item.parent, 'interaction', true)}>{shortName(item.parent)}</button></td></tr>
    {/if}
    {#if item.order}
      <tr><th>Order</th><td>{item.order}</td></tr>
    {/if}
    {#if item.transportation}
      <tr><th>Transportation</th><td>{@html transportLink(item.transportation)}</td></tr>
    {/if}
    {#if item.dimensions && item.dimensions.length > 0}
      <tr><th>Dimensions</th><td>{@html dimsHtml(item.dimensions)}</td></tr>
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
    {#if appspaceName}
      <tr>
        <th>Appspace</th>
        <td><button type="button" class="clickable-item" onclick={() => window.__showDetail(item.name, 'appspace_interaction', true)}>{appspaceName}</button></td>
      </tr>
    {/if}
    </tbody>
  </table>
</div>

{#if safeParams.length > 0}
  <CollapsibleSection title="Parameters" count={safeParams.length} threshold={0}>
  <table class="attr-table">
    <tbody>
    <tr>
      <th>Name</th><th>Data Type</th><th>Sharing</th><th>Semantics</th>
      <th>Order</th><th>Notes</th>
    </tr>
    {#each safeParams as p}
      <tr>
        <td>{p?.name ?? ''}</td>
        <td>{#if p?.dataType}<button type="button" class="clickable-item" onclick={() => window.__showDataType(p.dataType, window.__getPreferredType(p.dataType))}>{p.dataType}</button>{/if}</td>
        <td>{p?.sharing ?? ''}</td>
        <td style="max-width:300px;word-wrap:break-word;white-space:pre-wrap;">{p?.semantics ?? ''}</td>
        <td>{p?.order ?? ''}</td>
        <td>
          {#if p?.notes}
            <ul style="list-style:none;margin:0;padding:0;">
              {#each (p.notes || '').split(/\s+/).filter(Boolean) as note}
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

<CollapsibleSection title="Related Issues" count={issues.length} orange={issues.length > 0} threshold={0}>
<RelatedIssues issues={issues} />
</CollapsibleSection>
{/if}
