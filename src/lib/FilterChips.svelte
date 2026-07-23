<script>
import { ui } from './stores/uiStore.svelte.js';
import * as issueStore from './stores/issueStore.svelte.js';
import * as fomStore from './stores/fomStore.svelte.js';

let allIssues = $derived(issueStore.getIssues());
let issueAllCount = $derived(allIssues.length);
let issueErrorCount = $derived(allIssues.filter(i => i.severity === 'error').length);
let issueWarningCount = $derived(allIssues.filter(i => i.severity === 'warning').length);

let mergedFOM = $derived(fomStore.getMergedFOM());

let dtCounts = $derived({
  basic: mergedFOM?.dataTypes?.basic?.length ?? 0,
  simple: mergedFOM?.dataTypes?.simple?.length ?? 0,
  array: mergedFOM?.dataTypes?.array?.length ?? 0,
  fixed: mergedFOM?.dataTypes?.fixed?.length ?? 0,
  enum: mergedFOM?.dataTypes?.enum?.length ?? 0,
  variant: mergedFOM?.dataTypes?.variant?.length ?? 0,
});

const DATA_TYPE_CHIPS = [
  { id: 'basic', get label() { return `Basic (${dtCounts.basic})`; } },
  { id: 'simple', get label() { return `Simple (${dtCounts.simple})`; } },
  { id: 'array', get label() { return `Array (${dtCounts.array})`; } },
  { id: 'fixed', get label() { return `Fixed Record (${dtCounts.fixed})`; } },
  { id: 'enum', get label() { return `Enumerated (${dtCounts.enum})`; } },
  { id: 'variant', get label() { return `Variant Record (${dtCounts.variant})`; } },
];

const APPSPACE_CHIPS = [
  { id: 'objects', label: 'Objects (0)' },
  { id: 'interactions', label: 'Interactions (0)' },
  { id: 'unknown', label: 'Unknown (0)' },
];

const ISSUE_CHIPS = [
  { id: 'all', get label() { return `All (${issueAllCount})`; } },
  { id: 'error', get label() { return `Errors (${issueErrorCount})`; } },
  { id: 'warning', get label() { return `Warnings (${issueWarningCount})`; } },
];

export function updateAppspaceChipLabels(counts) {
  const root = document.querySelector('.filter-chips[data-container="appspace"]');
  if (!root) return;
  const chips = root.querySelectorAll('.chip');
  if (chips.length >= 3) {
    chips[0].textContent = `Objects (${counts.objects || 0})`;
    chips[1].textContent = `Interactions (${counts.interactions || 0})`;
    chips[2].textContent = `Unknown (${counts.unknown || 0})`;
  }
}

export function updateIssueChipLabels(allCount, errorCount, warningCount) {
  const root = document.querySelector('.filter-chips[data-container="issues"]');
  if (!root) return;
  const chips = root.querySelectorAll('.chip');
  if (chips.length >= 3) {
    chips[0].textContent = `All (${allCount})`;
    chips[1].textContent = `Errors (${errorCount})`;
    chips[2].textContent = `Warnings (${warningCount})`;
  }
}
  $effect(() => {
    const _ = ui.currentTab;
    document.querySelectorAll('#dataTypeTabs .subtab').forEach(chip => {
      chip.classList.toggle('active', ui.currentSubTab === chip.dataset.subtab);
    });
  });

  $effect(() => {
    const _ = ui.currentTab;
    document.querySelectorAll('#appspaceTabs .subtab').forEach(chip => {
      chip.classList.toggle('active', ui.appspaceSubTab === chip.dataset.subtab);
    });
  });

  $effect(() => {
    const _ = ui.currentTab;
    document.querySelectorAll('#issuesTabs .subtab').forEach(chip => {
      chip.classList.toggle('active', issueStore.getIssuesFilter() === chip.dataset.subtab);
    });
  });
</script>

<div class="filter-chips" id="dataTypeTabs" data-container="datatypes" style:display={ui.currentTab === 'datatypes' ? 'flex' : 'none'}>
  {#each DATA_TYPE_CHIPS as chip}
    <div
      class="chip subtab"
      class:active={ui.currentSubTab === chip.id}
      data-subtab={chip.id}
      data-testid="subtab-datatype-{chip.id}"
      role="tab"
    >{chip.label}</div>
  {/each}
</div>

<div class="filter-chips" id="appspaceTabs" data-container="appspace" style:display={ui.currentTab === 'appspaces' ? 'flex' : 'none'}>
  {#each APPSPACE_CHIPS as chip}
    <div
      class="chip subtab"
      class:active={ui.appspaceSubTab === chip.id}
      data-subtab={chip.id}
      data-testid="subtab-appspace-{chip.id}"
      role="tab"
    >{chip.label}</div>
  {/each}
</div>

<div class="filter-chips" id="issuesTabs" data-container="issues" style:display={ui.currentTab === 'issues' ? 'flex' : 'none'}>
  {#each ISSUE_CHIPS as chip}
    <div
      class="chip subtab"
      class:active={issueStore.getIssuesFilter() === chip.id}
      data-subtab={chip.id}
      data-testid="subtab-issues-{chip.id}"
      role="tab"
    >{chip.label}</div>
  {/each}
</div>
