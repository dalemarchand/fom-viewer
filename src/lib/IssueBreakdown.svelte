<script>
  import * as issueStore from './stores/issueStore.svelte.js';

  let allIssues = $derived(issueStore.getIssues());

  let byCategory = $derived.by(() => {
    const map = {};
    for (const issue of allIssues) {
      const cat = issue.category || 'other';
      if (!map[cat]) map[cat] = { count: 0, severity: issue.severity || 'error' };
      map[cat].count++;
    }
    return map;
  });

  let maxCount = $derived(Math.max(1, ...Object.values(byCategory).map(g => g.count)));

  const CATEGORY_LABELS = {
    'cross-reference': 'Cross-Reference',
    'load-conflict': 'Load Conflict',
    'appspace': 'Appspace Warnings',
    validation: 'Validation',
    'circular-dependency': 'Circular Dependency',
    other: 'Other'
  };

  const CATEGORY_COLORS = {
    'cross-reference': 'var(--warning, #d97706)',
    'load-conflict': 'var(--warning, #d97706)',
    'appspace': 'var(--warning, #d97706)',
    validation: 'var(--error, #dc2626)',
    'circular-dependency': 'var(--error, #dc2626)',
    other: 'var(--text-muted, #64748b)'
  };

  let ordered = $derived(
    Object.entries(byCategory).sort((a, b) => b[1].count - a[1].count)
  );

  function handleViewAll() {
    const tab = document.querySelector('.tab[data-tab="issues"]');
    if (tab) tab.click();
  }
</script>

{#if allIssues.length > 0}
  <div class="breakdown-panel">
    <div class="breakdown-panel-header">
      <h4 class="breakdown-title">Issue Summary</h4>
      <span class="breakdown-header-right">
        <span class="breakdown-total">{allIssues.length} total</span>
        <button class="view-all-link" onclick={handleViewAll}>View all</button>
      </span>
    </div>
    <div class="issue-breakdown">
      {#each ordered as [cat, info]}
        <div class="breakdown-row">
          <span class="breakdown-label">{CATEGORY_LABELS[cat] || cat}</span>
          <span class="breakdown-count">{info.count}</span>
          <span class="breakdown-pct">{Math.round((info.count / allIssues.length) * 100)}%</span>
          <div class="breakdown-bar-track">
            <div
              class="breakdown-bar-fill"
              style="width: {(info.count / maxCount) * 100}%; background: {CATEGORY_COLORS[cat] || 'var(--text-muted)'}"
            ></div>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .breakdown-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 14px;
  }
  .breakdown-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .breakdown-total {
    font-size: 12px;
    color: var(--text-muted);
  }
  .issue-breakdown {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .breakdown-title {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }
  .breakdown-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .breakdown-label {
    width: 130px;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .breakdown-count {
    width: 28px;
    text-align: right;
    font-weight: 600;
    color: var(--text-primary);
    flex-shrink: 0;
  }
  .breakdown-pct {
    width: 32px;
    text-align: right;
    font-size: 11px;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .breakdown-bar-track {
    flex: 1;
    height: 8px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    overflow: hidden;
  }
  .breakdown-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s;
  }
  .breakdown-header-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .view-all-link {
    font-size: 12px;
    color: var(--accent);
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    transition: opacity 0.15s;
  }
  .view-all-link:hover {
    opacity: 0.8;
    text-decoration: underline;
  }
</style>
