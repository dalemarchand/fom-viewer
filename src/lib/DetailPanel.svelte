<script>
import * as fomStore from './stores/fomStore.svelte.js';
import * as uiStore from './stores/uiStore.svelte.js';
import * as issueStore from './stores/issueStore.svelte.js';
import WelcomeScreen from './WelcomeScreen.svelte';
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
  let mergedFOM = $derived(fomStore.getMergedFOM());
  let allFiles = $derived(fomStore.getFiles());
  let detailData = $derived(computeDetailData(selectedItem, mergedFOM, allFiles));
  let moduleHtml = $state('');

  $effect(() => {
    if (selectedItem?.type === 'module') {
      moduleHtml = window.__moduleBodyHtml || '';
    } else {
      moduleHtml = '';
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
</script>

<div class="detail-header" id="detailHeader" style:display={!selectedItem || (!detailData && selectedItem?.type !== 'issue') ? 'none' : 'block'}>
  <h2 id="detailTitle">{selectedItem?.type === 'issue' ? selectedItem?.message ?? selectedItem?.name ?? '' : selectedItem?.name ?? ''}</h2>
  <div class="meta" id="detailMeta">{selectedItem?.type === 'issue' ? selectedItem?.severity?.toUpperCase() ?? '' : detailData?.source ?? ''}</div>
</div>
<div class="detail-body" id="detailBody" data-seltype={selectedItem?.type} data-dd={typeof detailData} data-dddata={String(!!detailData?.data)}>
  {#if selectedItem?.type === 'module'}
    {@html moduleHtml}
  {:else if detailData?.data}
    {#if selectedItem?.type === 'object'}
      <ObjectClassRenderer item={detailData.data} parents={parents} usages={usages} issues={issues} mergedFOM={mergedFOM} />
    {:else if selectedItem?.type === 'interaction'}
      <InteractionClassRenderer item={detailData.data} parents={parents} usages={usages} issues={issues} mergedFOM={mergedFOM} />
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
  {:else}
    <p>No data available for this selection.</p>
  {/if}
</div>
<div style:display={selectedItem?.type === 'issue' ? 'none' : (!selectedItem || !detailData ? '' : 'none')}>
  <WelcomeScreen />
</div>
