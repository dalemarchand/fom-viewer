<script>
  let { objects = 0, interactions = 0, dataTypes = 0, modules = 0, issues = 0, rootClasses = 0, derivedClasses = 0, rootInteractions = 0, derivedInteractions = 0, basicCount = 0, simpleCount = 0, arrayCount = 0, fixedCount = 0, enumCount = 0, variantCount = 0, errorCount = 0, warningCount = 0 } = $props();

  let STAT_CARDS = $derived.by(() => {
    const cards = [
      { icon: '📦', value: objects, label: 'Object Classes', sub: `${rootClasses} root, ${derivedClasses} derived`, cls: 'cyan' },
      { icon: '💬', value: interactions, label: 'Interactions', sub: `${derivedInteractions > 0 ? `${rootInteractions} root, ${derivedInteractions} derived` : 'Interaction classes'}`, cls: 'green' },
      { icon: '📊', value: dataTypes, label: 'Data Types', sub: `${basicCount} basic, ${simpleCount} simple, ${arrayCount} array, ${fixedCount} fixed, ${enumCount} enum, ${variantCount} variant`, cls: 'purple' },
      { icon: '📁', value: modules, label: 'Modules', sub: 'Loaded modules', cls: 'orange' },
    ];
    if (issues > 0) {
      cards.push({ icon: '⚠️', value: issues, label: 'Issues', sub: `${errorCount} errors, ${warningCount} warnings`, cls: 'red' });
    }
    return cards;
  });
</script>

<div class="stats-grid">
  {#each STAT_CARDS as card}
    <div class="stat-item {card.cls}">
      <span class="stat-icon">{card.icon}</span>
      <span class="stat-value">{card.value}</span>
      <span class="stat-label">{card.label}</span>
      <span class="stat-sub">{card.sub}</span>
    </div>
  {/each}
</div>

<style>
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 10px;
  }
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 14px 10px;
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
  }
  .stat-icon {
    font-size: 20px;
    margin-bottom: 2px;
  }
  .stat-value {
    font-size: 26px;
    font-weight: 700;
    color: var(--accent);
    line-height: 1;
  }
  .stat-label {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .stat-sub {
    font-size: 10px;
    color: var(--text-muted);
    opacity: 0.7;
    text-align: center;
  }
</style>
