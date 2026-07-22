<script>
  import CollapsibleSection from '../CollapsibleSection.svelte';
  import UsedByTable from '../UsedByTable.svelte';
  import RelatedIssues from '../RelatedIssues.svelte';
  import * as uiStore from '../stores/uiStore.svelte.js';

  let { item, usages = [], issues = [], mergedFOM = null } = $props();

  let enumType = $derived(
    mergedFOM?.dataTypes?.enum?.find(e => e.name === item.dataType) || null
  );

  let discriminantMissing = $derived(item.dataType && !enumType);

  function enumeratorExists(enumType, enumerator) {
    return enumType && enumType.values && enumType.values.some(v => v.name === enumerator);
  }

  function showEnumType() {
    if (!item.dataType) return;
    uiStore.variantHighlight.enumTypeName = item.dataType;
    uiStore.variantHighlight.enumeratorName = null;
    window.__showDataType(item.dataType, 'enum');
  }

  function showEnumTypeAndHighlight(enumerator) {
    if (!item.dataType) return;
    uiStore.variantHighlight.enumTypeName = item.dataType;
    uiStore.variantHighlight.enumeratorName = enumerator;
    window.__showDataType(item.dataType, 'enum');
  }
</script>

{#if item}
<div class="detail-section">
  <h3>Variant Record Data Type</h3>
  <table class="property-table">
    <tbody>
    <tr><th>Name</th><td>{item.name}</td></tr>
    {#if item.discriminant}<tr><th>Discriminant</th><td>{item.discriminant}</td></tr>{/if}
    {#if item.dataType}
      <tr>
        <th>Discriminant Type</th>
        <td>
          {#if discriminantMissing}
            <span style="color:var(--error)">{item.dataType}</span>
          {:else}
            <span class="clickable-item" onclick={showEnumType}>{item.dataType}</span>
          {/if}
        </td>
      </tr>
    {/if}
    {#if item.encoding}<tr><th>Encoding</th><td>{item.encoding}</td></tr>{/if}
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

{#if item.alternatives && item.alternatives.length > 0}
  <CollapsibleSection title="Alternatives" count={item.alternatives.length} threshold={0}>
  <table class="attr-table">
    <tbody>
    <tr><th>Name</th><th>Enumerator</th><th>Data Type</th><th>Semantics</th><th>Notes</th></tr>
    {#each item.alternatives as a}
      <tr>
        <td>{a.label}</td>
        <td>
          {#if a.enumerators && a.enumerators.length > 0}
            {#each a.enumerators as enumerator, i}
              {#if i > 0}, {/if}
              {#if enumType && enumeratorExists(enumType, enumerator)}
                <span class="clickable-item" onclick={() => showEnumTypeAndHighlight(enumerator)}>{enumerator}</span>
              {:else}
                <span style="color:var(--error)">{enumerator}</span>
              {/if}
            {/each}
          {/if}
        </td>
        <td>{#if a.dataType}<span class="clickable-item" onclick={() => window.__showDataType(a.dataType, window.__getPreferredType(a.dataType))}>{a.dataType}</span>{/if}</td>
        <td style="max-width:600px;word-wrap:break-word;white-space:pre-wrap;">{a.semantics || ''}</td>
        <td>
          {#if a.notes}
            <ul style="list-style:none;margin:0;padding:0;">
              {#each (a.notes || '').split(/\s+/).filter(Boolean) as note}
                <li><span class="clickable-item" onclick={() => window.__showDetail(note, 'notes', true)}>{note}</span></li>
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
