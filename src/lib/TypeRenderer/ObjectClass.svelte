<script>
  import CollapsibleSection from '../CollapsibleSection.svelte';
  import RelatedIssues from '../RelatedIssues.svelte';

  let { item, type = 'object', parents = [], issues = [], widgetBadges = {}, appspaceName = '' } = $props();
  let safeAttrs = $derived(item?.attributes?.filter(a => a && typeof a === 'object') || []);

  function transportLink(transportation) {
    if (!transportation) return '';
    const merged = window.__mergedFOM;
    const exists = merged?.transportations?.some(t => t.name.trim() === transportation.trim());
    if (exists) {
      return `<span class="clickable-item" onclick="window.__showDetail('${transportation.replace(/'/g, "\\'")}', 'trans', true)">${transportation}</span>`;
    }
    return `<span style="color:red;">${transportation}</span>`;
  }

  function updateConditionHtml(value, notes) {
    if (!value && !notes) return '';

    let html = '';

    if (value) {
      html += value;
    }

    const noteList = (notes || '').split(/\s+/).filter(Boolean);
    if (noteList.length > 0) {
      if (value) {
        html += ' ';
      }
      html += '<ul style="list-style:none;margin:0;padding:0;">';
      for (const note of noteList) {
        const safeNote = note.replace(/'/g, "\\'");
        html += `<li><span class="clickable-item" onclick="window.__showDetail('${safeNote}', 'notes', true)">${note}</span></li>`;
      }
      html += '</ul>';
    }

    return html;
  }

  function dimsHtml(dimensions) {
    if (!dimensions || dimensions.length === 0) return '';
    let html = '<ul style="list-style:none;margin:0;padding:0;">';
    for (const d of dimensions) {
      const exists = window.__findDimensionByName(d);
      if (exists) {
        html += `<li><span class="clickable-item" onclick="window.__showDetail('${d.replace(/'/g, "\\'")}', 'dims', true)">${d}</span></li>`;
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
        <span class="breadcrumb-item clickable-item" onclick={() => window.__showDetail(p.name, type, true)}>{shortName(p.name)}<span class="widget-badge">{widgetBadges[p.name] ?? '?'}</span></span>
        {#if idx < parents.length - 1}<span class="breadcrumb-sep"> &gt; </span>{/if}
      {/each}
      <span class="breadcrumb-sep"> &gt; </span>
      <span class="breadcrumb-current">{shortName(item.name)}<span class="widget-badge">{widgetBadges[item.name] ?? safeAttrs.length}</span></span>
    </div>
  {/if}

  <h3>Class Information</h3>
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
              <li><span class="clickable-item" onclick={() => window.__showDetail(note, 'notes', true)}>{note}</span></li>
            {/each}
          </ul>
        </td>
      </tr>
    {/if}
    {#if item.parent}
      <tr><th>Parent</th><td><span class="clickable-item" onclick={() => window.__showDetail(item.parent, type, true)}>{shortName(item.parent)}</span></td></tr>
    {/if}
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
    {#if appspaceName}
      <tr>
        <th>Appspace</th>
        <td><span class="clickable-item" onclick={() => window.__showDetail(item.name, 'appspace_object', true)}>{appspaceName}</span></td>
      </tr>
    {/if}
    </tbody>
  </table>
</div>

{#if safeAttrs.length > 0}
  <CollapsibleSection title="Attributes" count={safeAttrs.length} threshold={0}>
  <table class="attr-table">
    <tbody>
    <tr>
      <th>Name</th><th>Data Type</th><th>Sharing</th><th>Semantics</th><th>Module</th>
      <th>Update Type</th><th>Update Condition</th><th>Notes</th><th>Ownership</th>
      <th>Transportation</th><th>Dimensions</th><th>Order</th>
    </tr>
    {#each safeAttrs as p}
      <tr>
        <td>{p?.name ?? ''}</td>
        <td>{#if p?.dataType}<span class="clickable-item" onclick={() => window.__showDataType(p.dataType, window.__getPreferredType(p.dataType))}>{p.dataType}</span>{/if}</td>
        <td>{p?.sharing ?? ''}</td>
        <td style="max-width:300px;word-wrap:break-word;white-space:pre-wrap;">{p?.semantics ?? ''}</td>
        <td>{#if p?._source}<span class="clickable-item" onclick={() => window.__switchToModule(p._source)}>{p._source}</span>{/if}</td>
        <td>{p?.updateType ?? ''}</td><td>{@html updateConditionHtml(p?.updateCondition, p?.updateConditionNotes)}</td>
        <td>
          {#if p?.notes}
            <ul style="list-style:none;margin:0;padding:0;">
              {#each (p.notes || '').split(/\s+/).filter(Boolean) as note}
                <li><span class="clickable-item" onclick={() => window.__showDetail(note, 'notes', true)}>{note}</span></li>
              {/each}
            </ul>
          {/if}
        </td>
        <td>{p?.ownership ?? ''}</td>
        <td>{@html transportLink(p?.transportation)}</td>
        <td>{@html dimsHtml(p?.dimensions)}</td>
        <td>{p?.order ?? ''}</td>
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
