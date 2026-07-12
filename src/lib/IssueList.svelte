<script>
import * as issueStore from './stores/issueStore.svelte.js';

let issues = $derived(issueStore.getFilteredIssues());
let selectedIssueId = $derived(issueStore.getSelectedIssueId());

const CATEGORY_ORDER = ['cross-reference', 'load-conflict', 'appspace', 'validation', 'circular-dependency'];

const CATEGORY_LABELS = {
  'cross-reference': 'Cross-Reference Issues',
  'load-conflict': 'Load Conflicts',
  'appspace': 'Appspace Warnings',
  'validation': 'Validation Issues',
  'circular-dependency': 'Circular Dependencies'
};

const CATEGORY_SEVERITY = {
  'cross-reference': 'warning',
  'load-conflict': 'warning',
  'appspace': 'warning',
  'validation': 'error',
  'circular-dependency': 'error'
};

let grouped = $derived.by(() => {
  const groups = {};
  for (const issue of issues) {
    const cat = issue.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(issue);
  }
  for (const cat of Object.keys(groups)) {
    groups[cat].sort((a, b) => (a.message || '').localeCompare(b.message || ''));
  }
  return groups;
});

let orderedCategories = $derived(() => {
  const cats = CATEGORY_ORDER.filter(c => grouped[c]);
  if (grouped['other']) cats.push('other');
  return cats;
});

function severityIcon(severity) {
  if (severity === 'error') return '\u{1F534}';
  if (severity === 'warning') return '\u{1F7E1}';
  return '\u{1F535}';
}

function handleSelect(issue) {
  const gState = window.state;
  if (gState && gState.selectedItem) {
    gState.history.push({
      tab: 'issues',
      subTab: gState.issuesFilter || 'all',
      selected: { ...gState.selectedItem },
      detail: document.getElementById('detailHeader')?.style.display || 'block'
    });
    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.style.display = 'inline-block';
  }
  issueStore.selectIssue(issue.id);
  if (window.showIssueDetail) {
    window.showIssueDetail(issue.id);
  }
}

function categoryLabel(cat) {
  return CATEGORY_LABELS[cat] || (cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : 'Other');
}
</script>

<div class="issue-list">
  {#if issues.length === 0}
    <div class="empty-state">No issues found.</div>
  {:else}
    {#each orderedCategories() as cat}
      <div class="issue-category-header">
        <span class="category-severity-dot" class:warning-dot={CATEGORY_SEVERITY[cat] === 'warning'} class:error-dot={CATEGORY_SEVERITY[cat] === 'error'}></span>
        {categoryLabel(cat)}
        <span class="category-count">{grouped[cat].length}</span>
      </div>
      {#each grouped[cat] as issue (issue.id)}
        <div
          class="tree-item issue-item grouped-item"
          class:selected={selectedIssueId === issue.id}
          data-issue-id={issue.id}
          role="button"
          tabindex="0"
          onclick={() => handleSelect(issue)}
          onkeydown={(e) => { if (e.key === 'Enter') handleSelect(issue); }}
        >
          <span class="icon">{severityIcon(issue.severity)}</span>
          <span class="name" title={issue.message || issue.name}>{issue.message || issue.name}</span>
          {#if issue.sources?.length}
            <span class="issue-sources">{issue.sources.length} source{issue.sources.length !== 1 ? 's' : ''}</span>
          {/if}
        </div>
      {/each}
    {/each}
  {/if}
</div>

<style>
  .issue-list {
    display: flex;
    flex-direction: column;
  }
  .issue-category-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #64748b);
    border-bottom: 1px solid var(--border, #cbd5e1);
    margin: 10px 0 4px;
  }
  .issue-category-header:first-of-type {
    margin-top: 0;
  }
  .category-severity-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .category-severity-dot.error-dot {
    background: var(--error, #dc2626);
  }
  .category-severity-dot.warning-dot {
    background: var(--warning, #d97706);
  }
  .category-count {
    margin-left: auto;
    font-weight: 400;
    font-size: 10px;
    background: var(--bg-secondary, #f1f5f9);
    padding: 0 5px;
    border-radius: 6px;
    color: var(--text-muted, #64748b);
    line-height: 1.6;
  }
  .tree-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 13px;
    line-height: 1.4;
    border-radius: 3px;
    transition: background-color 0.1s;
  }
  .tree-item:hover {
    background: var(--bg-hover, #f0f0f0);
  }
  .tree-item.selected {
    background: var(--bg-selected, #e3f2fd) !important;
    font-weight: 500;
  }
  .grouped-item {
    padding-left: 18px;
  }
  .icon {
    flex-shrink: 0;
    font-size: 14px;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }
  .issue-sources {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--text-muted, #888);
    background: var(--bg-secondary, #f0f0f0);
    padding: 1px 6px;
    border-radius: 8px;
  }
  .empty-state {
    padding: 16px 8px;
    color: var(--text-muted, #888);
    text-align: center;
    font-size: 13px;
  }
</style>
