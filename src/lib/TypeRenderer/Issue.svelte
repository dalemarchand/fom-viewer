<script>
  import * as issueStore from '../stores/issueStore.svelte.js';

  let { item, issues = [] } = $props();

  let allIssues = $derived(issueStore.getIssues());
  let issue = $derived(item ? allIssues.find(i => i.id === item.name) : null);

  let expandedRows = $state({});

  function toggleRow(index) {
    expandedRows[index] = !expandedRows[index];
  }

  function parseDetailItems(detail) {
    if (!detail) return [];
    return detail.split('; ').map(item => {
      const parts = item.split('||');
      return { visibleText: parts[0], tooltipText: parts[1] || '' };
    });
  }

  let detailItems = $derived(parseDetailItems(issue?.detail));
  let hasConflictTable = $derived(issue?.type === 'object-attributes' || issue?.type === 'interaction-parameters');

  function locationClick(loc) {
    window.__showDataType?.(loc.itemName, loc.subTab || loc.tab);
  }
</script>

{#if issue}
  <div class="detail-section">
    <h3 class="issue-header" class:issue-error={issue.severity === 'error'} class:issue-warning={issue.severity === 'warning'}>
      {issue.severity === 'error' ? '❗ Error' : '⚠️ Warning'}: {issue.message}
    </h3>

    {#if issue.detail && hasConflictTable}
      <table class="conflict-table">
        <thead><tr><th>Module</th><th>Count</th><th></th></tr></thead>
        <tbody>
        {#each detailItems as di, i}
          {@const match = di.visibleText.match(/^(.+?):\s*(\d+)\s*(?:attribute|parameter)s?/)}
          {#if match}
            <tr class="conflict-row" onclick={() => di.tooltipText && toggleRow(i)}>
              <td>{match[1]}</td>
              <td>
                <span class="count-badge" class:same={match[2] === '0'} class:different={match[2] !== '0'}>{match[2]}</span>
              </td>
              <td>{#if di.tooltipText}<span class="arrow" class:expanded={expandedRows[i]}>▶</span>{/if}</td>
            </tr>
            {#if di.tooltipText}
              <tr class="conflict-detail-row" style:display={expandedRows[i] ? '' : 'none'}>
                <td colspan="3">{di.tooltipText}</td>
              </tr>
            {/if}
          {:else}
            <tr><td colspan="3">{di.visibleText}</td></tr>
          {/if}
        {/each}
        </tbody>
      </table>
    {:else if issue.detail}
      <div class="detail-list">
        {#each detailItems as di}
          <div class="detail-list-item" title={di.tooltipText}>{di.visibleText}</div>
        {/each}
      </div>
    {/if}

    {#if issue.sources?.length}
      <div class="source-module-list">
        <p class="source-module-heading"><strong>Source Modules:</strong></p>
        {#each issue.sources as s}
          <div class="source-module-item" data-source={s}>{s}</div>
        {/each}
      </div>
    {/if}

    {#if issue.category || issue.type}
      <p class="issue-meta"><strong>Category:</strong> {issue.category} / {issue.type}</p>
    {/if}

    {#if issue.locations?.length}
      <div class="locations-section">
        <h4>Navigation Targets</h4>
        {#each issue.locations as loc}
          {@const targetTab = loc.subTab ? `${loc.tab}:${loc.subTab}` : loc.tab}
          <div
            class="location-item"
            onclick={() => locationClick(loc)}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && locationClick(loc)}
          >
            <span class="location-icon">📍</span>
            <span class="location-name">{loc.itemName}</span>
            <span class="location-tab">{targetTab}</span>
          </div>
        {/each}
      </div>
    {/if}

    <p class="issue-id">Issue ID: {issue.id}</p>
  </div>
{/if}

<style>
  .issue-header {
    margin-bottom: 8px;
  }
  .issue-error {
    color: var(--error, #dc2626);
  }
  .issue-warning {
    color: var(--warning, #f59e0b);
  }
  .issue-meta {
    margin-bottom: 4px;
    color: var(--text-muted, #6b7280);
    font-size: 12px;
  }
  .issue-id {
    margin-top: 16px;
    color: var(--text-muted, #6b7280);
    font-size: 11px;
    border-top: 1px solid var(--border, #e5e7eb);
    padding-top: 8px;
  }
  .detail-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .detail-list-item {
    padding: 4px 8px;
    background: var(--bg-secondary, #f3f4f6);
    border-radius: 4px;
    font-size: 13px;
    border: 1px solid var(--border, #e5e7eb);
  }
  .source-module-list {
    margin-top: 12px;
  }
  .source-module-heading {
    margin-bottom: 4px;
    font-size: 13px;
  }
  .source-module-item {
    padding: 4px 8px;
    margin: 2px 0;
    background: var(--bg-secondary, #f3f4f6);
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
  }
  .source-module-item:hover {
    background: var(--accent-bg, #e0e7ff);
  }
  .conflict-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  .conflict-table th {
    text-align: left;
    padding: 6px 8px;
    background: var(--bg-secondary, #f3f4f6);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #6b7280);
  }
  .conflict-row {
    cursor: pointer;
  }
  .conflict-row td {
    padding: 6px 8px;
    border-top: 1px solid var(--border, #e5e7eb);
    font-size: 13px;
  }
  .conflict-detail-row td {
    padding: 8px 12px;
    background: var(--bg-secondary, #f3f4f6);
    font-size: 12px;
    white-space: pre-wrap;
  }
  .count-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 600;
  }
  .same {
    background: #d1fae5;
    color: #065f46;
  }
  .different {
    background: #fee2e2;
    color: #991b1b;
  }
  .arrow {
    font-size: 10px;
    display: inline-block;
    transition: transform 0.15s;
  }
  .arrow.expanded {
    transform: rotate(90deg);
  }
  .locations-section {
    margin-top: 16px;
  }
  .locations-section h4 {
    margin-bottom: 8px;
    color: var(--text-muted, #6b7280);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .location-item {
    padding: 6px 10px;
    margin: 2px 0;
    background: var(--bg-secondary, #f3f4f6);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .location-item:hover {
    background: var(--accent-bg, #e0e7ff);
  }
  .location-icon {
    font-size: 12px;
  }
  .location-name {
    flex: 1;
  }
  .location-tab {
    color: var(--text-muted, #6b7280);
    font-size: 11px;
  }
</style>
