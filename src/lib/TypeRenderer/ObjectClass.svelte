<script>
  import CollapsibleSection from '../CollapsibleSection.svelte';
  import RelatedIssues from '../RelatedIssues.svelte';

  let { item, type = 'object', parents = [], usages = [], issues = [], mergedFOM = null, widgetBadges = {}, appspaceName = '' } = $props();
  let safeAttrs = $derived(item?.attributes?.filter(a => a && typeof a === 'object') || []);
  let attrLevels = $derived.by(() => {
    const list = [];
    if (safeAttrs.length > 0) {
      list.push({ class: item, attrs: [...safeAttrs].sort((a, b) => (a.name || '').localeCompare(b.name || '')), isCurrent: true });
    }
    for (let i = parents.length - 1; i >= 0; i--) {
      const p = parents[i];
      const pAttrs = p.attributes?.filter(a => a && typeof a === 'object') || [];
      if (pAttrs.length > 0) {
        list.push({ class: p, attrs: [...pAttrs].sort((a, b) => (a.name || '').localeCompare(b.name || '')), isCurrent: false });
      }
    }
    return list;
  });
  let totalAttrs = $derived(attrLevels.reduce((sum, lvl) => sum + lvl.attrs.length, 0));

  let activeColumns = $derived.by(() => {
    let hasSharing = false, hasModule = false, hasUpdateType = false, hasUpdateCond = false;
    let hasNotes = false, hasOwnership = false, hasTransport = false, hasDims = false, hasOrder = false;
    for (const lvl of attrLevels) {
      for (const p of lvl.attrs) {
        if (p.sharing) hasSharing = true;
        if (p._source) hasModule = true;
        if (p.updateType) hasUpdateType = true;
        if (p.updateCondition || p.updateConditionNotes) hasUpdateCond = true;
        if (p.notes) hasNotes = true;
        if (p.ownership) hasOwnership = true;
        if (p.transportation) hasTransport = true;
        if (p.dimensions) hasDims = true;
        if (p.order) hasOrder = true;
      }
    }
    return {
      sharing: hasSharing, module: hasModule, updateType: hasUpdateType,
      updateCondition: hasUpdateCond, notes: hasNotes, ownership: hasOwnership,
      transportation: hasTransport, dimensions: hasDims, order: hasOrder
    };
  });

  let colsConfig = $derived.by(() => {
    const list = [
      { width: 12, name: 'Name', show: true },
      { width: 12, name: 'Data Type', show: true },
      { width: 5, name: 'Sharing', show: activeColumns.sharing },
      { width: 20, name: 'Semantics', show: true },
      { width: 8, name: 'Module', show: activeColumns.module },
      { width: 8, name: 'Update Type', show: activeColumns.updateType },
      { width: 10, name: 'Update Condition', show: activeColumns.updateCondition },
      { width: 5, name: 'Notes', show: activeColumns.notes },
      { width: 5, name: 'Ownership', show: activeColumns.ownership },
      { width: 5, name: 'Transportation', show: activeColumns.transportation },
      { width: 5, name: 'Dimensions', show: activeColumns.dimensions },
      { width: 5, name: 'Order', show: activeColumns.order }
    ];
    const active = list.filter(c => c.show);
    const totalW = active.reduce((s, c) => s + c.width, 0);
    for (const c of active) c.computedWidth = c.width * (100 / totalW);
    return active;
  });

  let omittedCols = $derived.by(() => {
    let omitted = [];
    if (!activeColumns.sharing) omitted.push('Sharing');
    if (!activeColumns.module) omitted.push('Module');
    if (!activeColumns.updateType) omitted.push('Update Type');
    if (!activeColumns.updateCondition) omitted.push('Update Condition');
    if (!activeColumns.notes) omitted.push('Notes');
    if (!activeColumns.ownership) omitted.push('Ownership');
    if (!activeColumns.transportation) omitted.push('Transportation');
    if (!activeColumns.dimensions) omitted.push('Dimensions');
    if (!activeColumns.order) omitted.push('Order');
    return omitted;
  });

  function transportLink(transportation) {
    if (!transportation) return '';
    const merged = window.__mergedFOM;
    const exists = merged?.transportations?.some(t => t.name.trim() === transportation.trim());
    if (exists) {
      return `<button type="button" class="clickable-item" onclick="window.__showDetail('${transportation.replace(/'/g, "\\'")}', 'trans', true)">${transportation}</button>`;
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
        html += `<li><button type="button" class="clickable-item" onclick="window.__showDetail('${safeNote}', 'notes', true)">${note}</button></li>`;
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
        <button type="button" class="breadcrumb-item clickable-item" onclick={() => window.__showDetail(p.name, type, true)}>{shortName(p.name)}<span class="widget-badge">{widgetBadges[p.name] ?? '?'}</span></button>
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
              <li><button type="button" class="clickable-item" onclick={() => window.__showDetail(note, 'notes', true)}>{note}</button></li>
            {/each}
          </ul>
        </td>
      </tr>
    {/if}
    {#if item.parent}
      <tr><th>Parent</th><td><button type="button" class="clickable-item" onclick={() => window.__showDetail(item.parent, type, true)}>{shortName(item.parent)}</button></td></tr>
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
        <td><button type="button" class="clickable-item" onclick={() => window.__showDetail(item.name, 'appspace_object', true)}>{appspaceName}</button></td>
      </tr>
    {/if}
    </tbody>
  </table>
</div>

{#if totalAttrs > 0}
  <CollapsibleSection title="Attributes" count={totalAttrs} threshold={0}>
  <table class="attr-table">
    <colgroup>
      {#each colsConfig as c}
        <col style="width: {c.computedWidth}%;">
      {/each}
    </colgroup>
    <tbody>
    <tr>
      <th>Name</th>
      <th>Data Type</th>
      {#if activeColumns.sharing}<th>Sharing</th>{/if}
      <th>Semantics</th>
      {#if activeColumns.module}<th>Module</th>{/if}
      {#if activeColumns.updateType}<th>Update Type</th>{/if}
      {#if activeColumns.updateCondition}<th>Update Condition</th>{/if}
      {#if activeColumns.notes}<th>Notes</th>{/if}
      {#if activeColumns.ownership}<th>Ownership</th>{/if}
      {#if activeColumns.transportation}<th>Transportation</th>{/if}
      {#if activeColumns.dimensions}<th>Dimensions</th>{/if}
      {#if activeColumns.order}<th>Order</th>{/if}
    </tr>
    {#each attrLevels as level}
      <tr class="level-header">
        <th colspan={colsConfig.length} style="background: var(--bg-secondary, rgba(0,0,0,0.03)); text-transform: none; font-size: 13px; font-weight: 600; color: var(--foreground); border-bottom: 1px solid var(--border); padding: 6px 10px;">
          {#if level.isCurrent}
            Current Class: <span style="font-weight: bold;">{level.class.name}</span>
          {:else}
            Inherited from <span style="color: var(--muted-foreground); font-weight: normal;">{level.class.name}</span>
          {/if}
        </th>
      </tr>
      {#each level.attrs as p}
        <tr>
          <td>{p?.name ?? ''}</td>
          <td>{#if p?.dataType}<button type="button" class="clickable-item" onclick={() => window.__showDataType(p.dataType, window.__getPreferredType(p.dataType))}>{p.dataType}</button>{/if}</td>
          {#if activeColumns.sharing}<td>{p?.sharing ?? ''}</td>{/if}
          <td style="max-width:300px;word-wrap:break-word;white-space:pre-wrap;">{p?.semantics ?? ''}</td>
          {#if activeColumns.module}<td>{#if p?._source}<button type="button" class="clickable-item" onclick={() => window.__switchToModule(p._source)}>{p._source}</button>{/if}</td>{/if}
          {#if activeColumns.updateType}<td>{p?.updateType ?? ''}</td>{/if}
          {#if activeColumns.updateCondition}<td>{@html updateConditionHtml(p?.updateCondition, p?.updateConditionNotes)}</td>{/if}
          {#if activeColumns.notes}
          <td>
            {#if p?.notes}
              <ul style="list-style:none;margin:0;padding:0;">
                {#each (p.notes || '').split(/\s+/).filter(Boolean) as note}
                  <li><button type="button" class="clickable-item" onclick={() => window.__showDetail(note, 'notes', true)}>{note}</button></li>
                {/each}
              </ul>
            {/if}
          </td>
          {/if}
          {#if activeColumns.ownership}<td>{p?.ownership ?? ''}</td>{/if}
          {#if activeColumns.transportation}<td>{@html transportLink(p?.transportation)}</td>{/if}
          {#if activeColumns.dimensions}<td>{@html dimsHtml(p?.dimensions)}</td>{/if}
          {#if activeColumns.order}<td>{p?.order ?? ''}</td>{/if}
        </tr>
      {/each}
    {/each}
    </tbody>
  </table>
  {#if omittedCols.length > 0}
    <div style="font-size: 12px; color: var(--text-muted); margin-top: 8px; padding-left: 4px;">
      Empty columns omitted: {omittedCols.join(', ')}
    </div>
  {/if}
  </CollapsibleSection>
{/if}

<CollapsibleSection title="Related Issues" count={issues.length} orange={issues.length > 0} threshold={0}>
<RelatedIssues issues={issues} />
</CollapsibleSection>
{/if}

<style>
  .attr-table {
    table-layout: fixed;
  }
  .attr-table td {
    word-break: normal;
    overflow-wrap: anywhere;
  }
</style>
