<script>
  let { item = null } = $props();

  let severityLabel = $derived(item?.severity || 'info');
  let severityIcon = $derived(severityLabel === 'error' ? '\u26A0\uFE0F' : severityLabel === 'warning' ? '\u26A0\uFE0F' : '\u2139\uFE0F');

  function navigateToLocation(loc) {
    if (window.navigateToLocation) {
      window.navigateToLocation(loc);
    }
  }
</script>

<div class="detail-section">
  <div class="issue-severity-bar severity-{severityLabel}">
    <span class="severity-icon">{severityIcon}</span>
    <span class="severity-label">{severityLabel.charAt(0).toUpperCase() + severityLabel.slice(1)}</span>
  </div>

  <h3 class="issue-message">{item?.message || 'No details available'}</h3>

  <table class="property-table">
    <tbody>
      {#if item?.category}
        <tr><th>Category</th><td>{item.category}</td></tr>
      {/if}
      {#if item?.issueType}
        <tr><th>Type</th><td>{item.issueType}</td></tr>
      {/if}
      <tr><th>ID</th><td>{item?.name || ''}</td></tr>
    </tbody>
  </table>

  {#if item?.detail}
    <h4>Detail</h4>
    <div class="issue-detail-text">{item.detail}</div>
  {/if}

  {#if item?.sources?.length}
    <h4>Sources</h4>
    <table class="property-table">
      <tbody>
        {#each item.sources as source}
          <tr>
            <td>
              <span class="clickable-item" onclick={() => window.__switchToModule?.(source)}>{source}</span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  {#if item?.locations?.length}
    <h4>Locations</h4>
    <table class="property-table">
      <tbody>
        {#each item.locations as loc}
          <tr>
            <td>
              {#if loc.tab && loc.itemName}
                <span class="clickable-item" onclick={() => navigateToLocation(loc)}>
                  {loc.file || ''}{#if loc.tab} &mdash; {loc.tab}{/if}{#if loc.item}: {loc.item}{/if}
                </span>
              {:else}
                <span>{loc.file || ''}{#if loc.tab} &mdash; {loc.tab}{/if}{#if loc.item}: {loc.item}{/if}</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .issue-severity-bar {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .issue-severity-bar.severity-error {
    background: rgba(220, 38, 38, 0.12);
    color: #dc2626;
  }
  .issue-severity-bar.severity-warning {
    background: rgba(217, 119, 6, 0.12);
    color: #d97706;
  }
  .issue-severity-bar.severity-info {
    background: rgba(37, 99, 235, 0.12);
    color: #2563eb;
  }
  .severity-icon {
    font-size: 16px;
  }
  .issue-message {
    margin: 0 0 12px;
    font-size: 15px;
    line-height: 1.5;
    color: var(--text-primary, #1e293b);
  }
  .issue-detail-text {
    max-width: 600px;
    word-wrap: break-word;
    white-space: pre-wrap;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-secondary, #475569);
    margin-bottom: 16px;
  }
  h4 {
    margin: 16px 0 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary, #1e293b);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
</style>
