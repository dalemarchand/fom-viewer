<script>
  let { issues = [] } = $props();
</script>

{#if issues.length > 0}
  <div class="detail-section">
    <h4 style="margin-bottom:8px;color:var(--text-muted);font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">
      Related Issues ({issues.length})
    </h4>
    {#each issues as issue}
      <div
        class="related-issue"
        data-tab="issues"
        data-issue-id={issue.id}
        style="cursor:pointer;padding:4px 8px;margin:2px 0;background:var(--bg-tertiary);border-radius:4px;font-size:13px;display:flex;align-items:center;gap:6px;"
        onclick={() => {
          const el = document.querySelector(`.related-issue[data-issue-id="${issue.id}"]`);
          if (el) el.click();
        }}
      >
        <span>{issue.severity === 'error' ? '❗' : '⚠️'}</span>
        <span>{issue.message}</span>
      </div>
    {/each}
  </div>
{/if}
