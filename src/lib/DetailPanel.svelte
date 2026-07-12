<script>
import * as fomStore from './stores/fomStore.svelte.js';
import * as uiStore from './stores/uiStore.svelte.js';
import * as issueStore from './stores/issueStore.svelte.js';
import * as appspaceStore from './stores/appspaceStore.svelte.js';
import OverviewDashboard from './OverviewDashboard.svelte';
import ObjectClassRenderer from './TypeRenderer/ObjectClass.svelte';
import InteractionClassRenderer from './TypeRenderer/InteractionClass.svelte';
import BasicTypeRenderer from './TypeRenderer/BasicType.svelte';
import SimpleTypeRenderer from './TypeRenderer/SimpleType.svelte';
import ArrayTypeRenderer from './TypeRenderer/ArrayType.svelte';
import FixedRecordRenderer from './TypeRenderer/FixedRecord.svelte';
import EnumeratedRenderer from './TypeRenderer/Enumerated.svelte';
import VariantRecordRenderer from './TypeRenderer/VariantRecord.svelte';
import DimensionRenderer from './TypeRenderer/Dimension.svelte';
import TransportationRenderer from './TypeRenderer/Transportation.svelte';
import SwitchRenderer from './TypeRenderer/Switch.svelte';
import TagRenderer from './TypeRenderer/Tag.svelte';
import TimeConfigRenderer from './TypeRenderer/TimeConfig.svelte';
import NoteRenderer from './TypeRenderer/Note.svelte';
import IssueRenderer from './TypeRenderer/Issue.svelte';

  let selectedItem = $derived(uiStore.ui.selectedItem);
  let currentTab = $derived(uiStore.ui.currentTab);
  let mergedFOM = $derived(fomStore.getMergedFOM());
  let allFiles = $derived(fomStore.getFiles());
  let detailData = $derived(computeDetailData(selectedItem, mergedFOM, allFiles));
  let moduleHtml = $state('');
  let appspaceHtml = $state('');

  $effect(() => {
    if (selectedItem?.type === 'module') {
      moduleHtml = window.__moduleBodyHtml || '';
    } else {
      moduleHtml = '';
    }
  });

  $effect(() => {
    if (selectedItem?.type === 'appspace' || selectedItem?.type?.startsWith('appspace_')) {
      appspaceHtml = window.__appspaceBodyHtml || '';
    } else {
      appspaceHtml = '';
    }
  });

  function computeDetailData(item, fom, allFiles) {
    if (!item || !item.name) return null;
    console.log('[DetailPanel] computeDetailData item=', item?.name, item?.type, 'fom.dataTypes keys=', fom?.dataTypes ? Object.keys(fom.dataTypes).join(',') : 'NO');
    let data = null;
    let source = '';

    if (item.type === 'object') {
      data = fom?.objectClasses?.find(c => c.name === item.name);
      source = data?._source || '';
    } else if (item.type === 'interaction') {
      data = fom?.interactionClasses?.find(c => c.name === item.name);
      source = data?._source || '';
    } else if (item.type === 'ident' || item.type === 'module') {
      const file = allFiles.find(f => f.name === item.name);
      data = file?.identification ? { ...file.identification } : null;
      source = item.name;
    } else if (item.type === 'dims') {
      for (const f of allFiles) {
        if (f.dimensions) {
          data = f.dimensions.find(d => d.name === item.name);
          if (data) { source = f.name; break; }
        }
      }
    } else if (item.type === 'trans') {
      if (fom?.transportations) data = fom.transportations.find(t => t.name.trim() === item.name.trim());
      if (!data) {
        for (const f of allFiles) {
          if (f.transportations) {
            data = f.transportations.find(t => t.name.trim() === item.name.trim());
            if (data) break;
          }
        }
      }
      source = item.name;
    } else if (item.type === 'notes') {
      for (const f of allFiles) {
        if (f.notes) {
          data = f.notes.find(n => (typeof n === 'string' ? n : n.name) === item.name);
          if (data) { source = f.name; break; }
        }
      }
    } else if (item.type === 'switches') {
      if (fom?.switches) data = fom.switches.find(s => s.name.trim() === item.name.trim());
      if (!data) {
        for (const f of allFiles) {
          if (f.switches) {
            data = f.switches.find(s => s.name.trim() === item.name.trim());
            if (data) break;
          }
        }
      }
      source = item.name;
    } else if (item.type === 'tags') {
      if (fom?.tags) data = fom.tags.find(t => t.name.trim() === item.name.trim());
      if (!data) {
        for (const f of allFiles) {
          if (f.tags) {
            data = f.tags.find(t => t.name.trim() === item.name.trim());
            if (data) break;
          }
        }
      }
      source = item.name;
    } else if (item.type === 'time') {
      data = { ...fom?.time } || {};
      source = 'Time Configuration';
    } else if (['basic', 'simple', 'array', 'fixed', 'enum', 'variant'].includes(item.type)) {
      const raw = fom?.dataTypes?.[item.type]?.find(d => d.name === item.name);
      data = raw ? { ...raw } : null;
      source = raw?._source || '';
      console.log('[DetailPanel] basic type lookup:', 'type=', item.type, 'name=', item.name, 'found=', !!raw, 'fom.dataTypes[basic]=', fom?.dataTypes?.basic?.length);
    }

    console.log('[DetailPanel] RETURN data=', !!data, 'source=', source);
    return { data, source };
  }

  function getParents(type) {
    if (!mergedFOM || !detailData?.data) return [];
    if (type !== 'object' && type !== 'interaction') return [];
    const key = type === 'object' ? 'objectClasses' : 'interactionClasses';
    const classes = mergedFOM[key];
    if (!classes) return [];
    const chain = [];
    let current = detailData.data;
    while (current && current.parent) {
      const p = classes.find(c => c.name === current.parent);
      if (p) { chain.push(p); current = p; }
      else break;
    }
    chain.reverse();
    return chain;
  }

  function getUsages(type) {
    if (!detailData?.data?.name) return [];
    if (type === 'notes') {
      return window.__findNoteUsages?.(detailData.data.name) || [];
    }
    return window.__findDataTypeUsages?.(detailData.data.name)?.filter(u => {
      if (type === 'object') return u.location.startsWith('Object:');
      if (type === 'interaction') return u.location.startsWith('Interaction:');
      return true;
    }) || [];
  }

  function getIssues(type) {
    if (!detailData?.data?.name) return [];
    return issueStore.findIssuesForItem(detailData.data.name, type);
  }

  let parents = $derived(getParents(selectedItem?.type));
  let usages = $derived(getUsages(selectedItem?.type));
  let issues = $derived(getIssues(selectedItem?.type));
  let classAppspaceName = $derived.by(() => {
    if (!detailData?.data?.name) return null;
    const apps = appspaceStore.getAppsForClass(detailData.data.name);
    if (apps.length === 0) return null;
    return apps.map(a => a.appName).join(', ');
  });
  let widgetBadges = $derived.by(() => {
    if (!mergedFOM || selectedItem?.type === 'object') {
      const map = {};
      const classes = mergedFOM?.objectClasses || [];
      for (const p of parents) {
        map[p.name] = p.attributes?.filter(a => a && typeof a === 'object')?.length || 0;
      }
      if (detailData?.data) {
        map[detailData.data.name] = detailData.data.attributes?.filter(a => a && typeof a === 'object')?.length || 0;
      }
      return map;
    }
    if (selectedItem?.type === 'interaction') {
      const map = {};
      const classes = mergedFOM?.interactionClasses || [];
      for (const p of parents) {
        map[p.name] = p.parameters?.filter(a => a && typeof a === 'object')?.length || 0;
      }
      if (detailData?.data) {
        map[detailData.data.name] = detailData.data.parameters?.filter(a => a && typeof a === 'object')?.length || 0;
      }
      return map;
    }
    return {};
  });

  let typeLabel = $derived.by(() => {
    const map = {
      object: 'Object Class', interaction: 'Interaction Class',
      basic: 'Basic Data Type', simple: 'Simple Data Type',
      array: 'Array Data Type', fixed: 'Fixed Record Data Type',
      enum: 'Enumerated Data Type', variant: 'Variant Record Data Type',
      dims: 'Dimension', trans: 'Transportation',
      switches: 'Switch', tags: 'Tag',
      time: 'Time Configuration', notes: 'Note', module: 'Module',
      ident: 'Module Identification',
    };
    return map[selectedItem?.type] || '';
  });

  let subDetail = $derived.by(() => {
    if (selectedItem?.type === 'object') {
      const n = detailData?.data?.attributes?.filter(a => a && typeof a === 'object')?.length ?? 0;
      return `${n} attribute${n !== 1 ? 's' : ''}`;
    }
    if (selectedItem?.type === 'interaction') {
      const n = detailData?.data?.parameters?.filter(a => a && typeof a === 'object')?.length ?? 0;
      return `${n} parameter${n !== 1 ? 's' : ''}`;
    }
    if (selectedItem?.type === 'basic') return 'Basic type';
    if (selectedItem?.type === 'simple') return 'Simple type';
    if (selectedItem?.type === 'array') {
      const dt = detailData?.data?.dataType || '';
      return `Array of ${dt}`;
    }
    if (selectedItem?.type === 'fixed') {
      const n = detailData?.data?.fields?.length ?? 0;
      return `${n} field${n !== 1 ? 's' : ''}`;
    }
    if (selectedItem?.type === 'enum') {
      const n = detailData?.data?.values?.length ?? 0;
      return `${n} enumerator${n !== 1 ? 's' : ''}`;
    }
    if (selectedItem?.type === 'variant') {
      const n = detailData?.data?.alternatives?.length ?? 0;
      return `${n} alternative${n !== 1 ? 's' : ''}`;
    }
    return '';
  });
</script>

<div class="detail-header" id="detailHeader" style:display={!selectedItem || (!detailData && selectedItem?.type !== 'issue' && selectedItem?.type !== 'appspace' && !selectedItem?.type?.startsWith('appspace_')) ? 'none' : 'block'}>
  <h2 class="detail-title" id="detailTitle"><span>{selectedItem?.type === 'issue' ? selectedItem?.message ?? selectedItem?.name ?? '' : selectedItem?.name ?? ''}</span></h2>
  {#if selectedItem?.type !== 'issue'}
    <div class="detail-subtitle" id="detailMeta">
      <span class="detail-type">{typeLabel}</span>
      {#if subDetail}
        <span class="detail-sep">·</span>
        <span class="detail-sub-detail">{subDetail}</span>
      {/if}
      {#if detailData?.source}
        <span class="module-badge">{detailData.source}</span>
      {/if}
      {#if usages.length > 0}
        <span class="usage-badge">Referenced by {usages.length}</span>
      {/if}
    </div>
  {:else}
    <div class="detail-subtitle" id="detailMeta">
      <span class="detail-type">Issue</span>
      <span class="detail-sep">·</span>
      <span class="detail-sub-detail">{selectedItem?.severity?.toUpperCase() ?? ''}</span>
    </div>
  {/if}
</div>
<div class="detail-body" id="detailBody" data-seltype={selectedItem?.type} data-dd={typeof detailData} data-dddata={String(!!detailData?.data)}>
  {#if selectedItem?.type === 'module'}
    {@html moduleHtml}
  {:else if selectedItem?.type === 'appspace' || selectedItem?.type?.startsWith('appspace_')}
    {@html appspaceHtml}
  {:else if detailData?.data}
    {#if selectedItem?.type === 'object'}
      <ObjectClassRenderer item={detailData.data} parents={parents} usages={usages} issues={issues} mergedFOM={mergedFOM} widgetBadges={widgetBadges} appspaceName={classAppspaceName} />
    {:else if selectedItem?.type === 'interaction'}
      <InteractionClassRenderer item={detailData.data} parents={parents} usages={usages} issues={issues} mergedFOM={mergedFOM} widgetBadges={widgetBadges} appspaceName={classAppspaceName} />
    {:else if selectedItem?.type === 'basic'}
      <BasicTypeRenderer item={detailData.data} usages={usages} issues={issues} />
    {:else if selectedItem?.type === 'simple'}
      <SimpleTypeRenderer item={detailData.data} usages={usages} issues={issues} />
    {:else if selectedItem?.type === 'array'}
      <ArrayTypeRenderer item={detailData.data} usages={usages} issues={issues} />
    {:else if selectedItem?.type === 'fixed'}
      <FixedRecordRenderer item={detailData.data} usages={usages} issues={issues} />
    {:else if selectedItem?.type === 'enum'}
      <EnumeratedRenderer item={detailData.data} usages={usages} issues={issues} />
    {:else if selectedItem?.type === 'variant'}
      <VariantRecordRenderer item={detailData.data} usages={usages} issues={issues} mergedFOM={mergedFOM} />
    {:else if selectedItem?.type === 'dims'}
      <DimensionRenderer item={detailData.data} issues={issues} />
    {:else if selectedItem?.type === 'trans'}
      <TransportationRenderer item={detailData.data} issues={issues} />
    {:else if selectedItem?.type === 'switches'}
      <SwitchRenderer item={detailData.data} issues={issues} />
    {:else if selectedItem?.type === 'tags'}
      <TagRenderer item={detailData.data} issues={issues} />
    {:else if selectedItem?.type === 'time'}
      <TimeConfigRenderer item={detailData.data} issues={issues} />
    {:else if selectedItem?.type === 'notes'}
      <NoteRenderer item={detailData.data} usages={usages} issues={issues} />
    {:else}
      <table class="detail-table">
        <tbody>
          {#each Object.entries(detailData.data) as [key, value]}
            {#if typeof value !== 'object'}
              <tr><td><strong>{key}</strong></td><td>{value}</td></tr>
            {/if}
          {/each}
        </tbody>
      </table>
    {/if}
  {:else if selectedItem?.type === 'issue'}
    <IssueRenderer item={selectedItem} issues={issues} />
  {:else if selectedItem}
    <p>No data available for this selection.</p>
  {/if}
</div>
<div style:display={selectedItem?.type === 'issue' || currentTab === 'appspaces' ? 'none' : (!selectedItem || !detailData ? '' : 'none')}>
  <OverviewDashboard />
</div>
