<script>
  import CollapsibleSection from '../CollapsibleSection.svelte';
  import RelatedIssues from '../RelatedIssues.svelte';

  let { item, parents = [], usages = [], issues = [], mergedFOM = null, widgetBadges = {}, appspaceName = '' } = $props();
  let safeParams = $derived(item?.parameters?.filter(p => p && typeof p === 'object') || []);
  let paramLevels = $derived.by(() => {
    const list = [];
    if (safeParams.length > 0) {
      list.push({ class: item, params: [...safeParams].sort((a, b) => (a.name || '').localeCompare(b.name || '')), isCurrent: true });
    }
    for (let i = parents.length - 1; i >= 0; i--) {
      const p = parents[i];
      const pParams = p.parameters?.filter(a => a && typeof a === 'object') || [];
      if (pParams.length > 0) {
        list.push({ class: p, params: [...pParams].sort((a, b) => (a.name || '').localeCompare(b.name || '')), isCurrent: false });
      }
    }
    return list;
  });
  let totalParams = $derived(paramLevels.reduce((sum, lvl) => sum + lvl.params.length, 0));

  let activeColumns = $derived.by(() => {
    let hasSharing = false, hasModule = false, hasOrder = false, hasNotes = false;
    for (const lvl of paramLevels) {
      for (const p of lvl.params) {
        if (p.sharing) hasSharing = true;
        if (p._source) hasModule = true;
        if (p.order) hasOrder = true;
        if (p.notes) hasNotes = true;
      }
    }
    return { sharing: hasSharing, module: hasModule, order: hasOrder, notes: hasNotes };
  });

  let colsConfig = $derived.by(() => {
    const list = [
      { width: 22, name: 'Name', show: true },
      { width: 20, name: 'Data Type', show: true },
      { width: 10, name: 'Sharing', show: activeColumns.sharing },
      { width: 28, name: 'Semantics', show: true },
      { width: 10, name: 'Module', show: activeColumns.module },
      { width: 5, name: 'Order', show: activeColumns.order },
      { width: 5, name: 'Notes', show: activeColumns.notes }
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
    if (!activeColumns.order) omitted.push('Order');
    if (!activeColumns.notes) omitted.push('Notes');
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

{#if totalParams > 0}
  <CollapsibleSection title="Parameters" count={totalParams} threshold={0}>
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
      {#if activeColumns.order}<th>Order</th>{/if}
      {#if activeColumns.notes}<th>Notes</th>{/if}
    </tr>
    {#each paramLevels as level}
      <tr class="level-header">
        <th colspan={colsConfig.length} style="background: var(--bg-secondary, rgba(0,0,0,0.03)); text-transform: none; font-size: 13px; font-weight: 600; color: var(--foreground); border-bottom: 1px solid var(--border); padding: 6px 10px;">
          {#if level.isCurrent}
            Current Class: <span style="font-weight: bold;">{level.class.name}</span>
          {:else}
            Inherited from <span style="color: var(--muted-foreground); font-weight: normal;">{level.class.name}</span>
          {/if}
        </th>
      </tr>
      {#each level.params as p}
        <tr>
          <td>{p?.name ?? ''}</td>
          <td>{#if p?.dataType}<button type="button" class="clickable-item" onclick={() => window.__showDataType(p.dataType, window.__getPreferredType(p.dataType))}>{p.dataType}</button>{/if}</td>
          {#if activeColumns.sharing}<td>{p?.sharing ?? ''}</td>{/if}
          <td style="max-width:300px;word-wrap:break-word;white-space:pre-wrap;">{p?.semantics ?? ''}</td>
          {#if activeColumns.module}<td>{#if p?._source}<button type="button" class="clickable-item" onclick={() => window.__switchToModule(p._source)}>{p._source}</button>{/if}</td>{/if}
          {#if activeColumns.order}<td>{p?.order ?? ''}</td>{/if}
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
