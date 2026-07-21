<script>
  import * as fomStore from './stores/fomStore.svelte.js';
  import * as issueStore from './stores/issueStore.svelte.js';
  import StatsGrid from './StatsGrid.svelte';
  import IssueBreakdown from './IssueBreakdown.svelte';
  import RecentFilesList from './RecentFilesList.svelte';
  import customConfig from '../custom-config.json';

  let files = $derived(fomStore.getFiles());
  let merged = $derived(fomStore.getMergedFOM());
  let issues = $derived(issueStore.getIssues());

  let objCount = $derived(merged?.objectClasses?.length ?? 0);
  let intCount = $derived(merged?.interactionClasses?.length ?? 0);
  let dtCount = $derived(
    !merged?.dataTypes ? 0
      : Object.values(merged.dataTypes).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)
  );
  let modCount = $derived(files.length);
  let issueCount = $derived(issues.length);
  let hasData = $derived(files.length > 0);

  let rootClasses = $derived(merged?.objectClasses?.filter(c => !c.parent)?.length ?? 0);
  let derivedClasses = $derived(objCount - rootClasses);
  let rootInteractions = $derived(merged?.interactionClasses?.filter(c => !c.parent)?.length ?? 0);
  let derivedInteractions = $derived(intCount - rootInteractions);
  let basicCount = $derived(merged?.dataTypes?.basic?.length ?? 0);
  let simpleCount = $derived(merged?.dataTypes?.simple?.length ?? 0);
  let arrayCount = $derived(merged?.dataTypes?.array?.length ?? 0);
  let fixedCount = $derived(merged?.dataTypes?.fixed?.length ?? 0);
  let enumCount = $derived(merged?.dataTypes?.enum?.length ?? 0);
  let variantCount = $derived(merged?.dataTypes?.variant?.length ?? 0);
  let errorCount = $derived(issues.filter(i => i.severity === 'error').length);
  let warningCount = $derived(issues.filter(i => i.severity === 'warning').length);

  function handleLoadFOM() {
    document.getElementById('fileInput')?.click();
  }

  function handleLoadAppspace() {
    document.getElementById('loadAppspaceBtn')?.click();
  }

  function handleLoadRecent() {
    const recents = document.querySelectorAll('.recent-file-item');
    if (recents.length > 0) recents[0].click();
  }
</script>

<div id="welcomeScreen" class="overview-placeholder dashboard" data-testid="welcomeScreen">
  {#if hasData}
    <h2>Welcome back</h2>
    <p class="welcome-sub"><span class="highlight">{modCount} module{modCount > 1 ? 's' : ''}</span> loaded &middot; Last session shows in recent files</p>
  {:else}
    <h2>{customConfig.title || 'FOM Viewer'}</h2>
    {#if customConfig.mode === 'strict'}
      <p class="welcome-sub">Explore the preloaded simulation object models</p>
    {:else}
      <p class="welcome-sub">Load FOM XML files to explore your federation object models</p>
    {/if}
  {/if}

  {#if hasData}
    <StatsGrid
      objects={objCount}
      interactions={intCount}
      dataTypes={dtCount}
      modules={modCount}
      issues={issueCount}
      rootClasses={rootClasses}
      derivedClasses={derivedClasses}
      rootInteractions={rootInteractions}
      derivedInteractions={derivedInteractions}
      basicCount={basicCount}
      simpleCount={simpleCount}
      arrayCount={arrayCount}
      fixedCount={fixedCount}
      enumCount={enumCount}
      variantCount={variantCount}
      errorCount={errorCount}
      warningCount={warningCount}
    />
    <div class="dashboard-panels">
      <RecentFilesList />
      <IssueBreakdown />
    </div>
  {:else}
    <div id="welcomeStats" style="display:none" data-testid="welcomeStats"></div>
  {/if}

  {#if customConfig.mode !== 'strict'}
    <!-- Quick Actions -->
    <div class="quick-actions">
      <button class="quick-action primary" onclick={handleLoadFOM}>
        <div class="qa-icon">📂</div>
        <div class="qa-label">Open FOM File</div>
        <div class="qa-sub">Load XML files to get started</div>
      </button>
      <button class="quick-action" onclick={handleLoadRecent} disabled={!hasData}>
        <div class="qa-icon">🔄</div>
        <div class="qa-label">Load Last Session</div>
        <div class="qa-sub">Restore previously loaded modules</div>
      </button>
      <button class="quick-action" onclick={handleLoadAppspace}>
        <div class="qa-icon">📋</div>
        <div class="qa-label">Load Appspace</div>
        <div class="qa-sub">Load appspace classification data</div>
      </button>
    </div>

    <!-- Drop Zone — click to open file dialog -->
    <div id="dropZone" data-testid="dropZone" onclick={handleLoadFOM} role="button" tabindex="0" onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleLoadFOM())}>
      Drop FOM files here or click to browse
    </div>
  {/if}
</div>

