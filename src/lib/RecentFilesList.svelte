<script>
  import * as recentFiles from './stores/recentFilesStore.svelte.js';
  import * as fomStore from './stores/fomStore.svelte.js';

  let files = $derived(recentFiles.getRecentFiles());
  let loadedNames = $derived(new Set(fomStore.getFiles().map(f => f.name)));

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function handleClick(name) {
    if (loadedNames.has(name)) {
      window.__switchToModule?.(name);
    }
  }

  function handleClear() {
    recentFiles.clearRecentFiles();
  }
</script>

{#if files.length > 0}
  <div class="recent-files">
    <div class="recent-header">
      <h4 class="recent-title">Recent Files</h4>
      <button class="recent-action" onclick={handleClear} data-testid="clearHistoryBtn">Clear history</button>
    </div>
    {#each files as file (file.name)}
      <button
        class="recent-file-item"
        class:loaded={loadedNames.has(file.name)}
        onclick={() => handleClick(file.name)}
      >
        <div class="recent-file-name">
          <span class="recent-file-icon">📄</span>
          <span class="recent-file-label">{file.name}</span>
          {#if loadedNames.has(file.name)}
            <span class="recent-loaded-badge active">Active</span>
          {/if}
        </div>
        <div class="recent-file-meta">
          <span class="recent-time">🕐 {formatTime(file.timestamp)}</span>
          <span class="recent-stats-sep">·</span>
          <span class="recent-stat">📦 {file.stats.objects ?? 0} classes</span>
          <span class="recent-stats-sep">·</span>
          <span class="recent-stat">📊 {file.stats.dataTypes ?? 0} types</span>
        </div>
      </button>
    {/each}
  </div>
{/if}

<style>
  .recent-files {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .recent-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .recent-title {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }
  .recent-action {
    font-size: 12px;
    color: var(--accent);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }
  .recent-action:hover {
    text-decoration: underline;
  }
  .recent-file-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 10px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background 0.15s;
    text-align: left;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    width: 100%;
  }
  .recent-file-item:hover {
    background: var(--bg-tertiary);
  }
  .recent-file-item.loaded {
    border-left: 3px solid var(--accent);
  }
  .recent-file-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 6px;
    word-break: break-all;
  }
  .recent-file-icon {
    font-size: 16px;
    flex-shrink: 0;
  }
  .recent-file-label {
    flex: 1;
    word-break: break-all;
  }
  .recent-loaded-badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--accent);
    text-transform: uppercase;
    flex-shrink: 0;
  }
  .recent-loaded-badge.active {
    background: var(--accent-light);
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 9px;
  }
  .recent-file-meta {
    display: flex;
    gap: 4px;
    font-size: 11px;
    color: var(--text-muted);
    align-items: center;
  }
  .recent-time {
    flex-shrink: 0;
  }
  .recent-stats-sep {
    color: var(--border);
  }
  .recent-stat {
    color: var(--text-muted);
  }
</style>
