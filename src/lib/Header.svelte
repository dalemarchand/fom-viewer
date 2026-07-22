<script>
  import OverflowMenu from './OverflowMenu.svelte';
  import customConfig from '../custom-config.json';
  import * as fomStore from './stores/fomStore.svelte.js';
  import * as appspaceStore from './stores/appspaceStore.svelte.js';

  let isMobile = $state(false);

  $effect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    isMobile = mq.matches;
    const handler = () => isMobile = mq.matches;
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  let activeFiles = $derived(fomStore.getFiles());
  let activeAppspace = $derived(appspaceStore.getAppspace());

  let isModified = $derived.by(() => {
    if (!customConfig.bundleId) return false;
    const preloadedFiles = customConfig.preloadedFiles || [];
    if (activeFiles.length !== preloadedFiles.length) return true;
    
    // Check if filenames and content hashes match
    const preloadedMap = new Map(preloadedFiles.map(f => [f.name, f.hash]));
    for (const f of activeFiles) {
      if (!preloadedMap.has(f.name)) return true;
      const activeHash = window.hashCode ? window.hashCode(f.xml) : '';
      if (preloadedMap.get(f.name) !== activeHash) return true;
    }
    
    // Compare appspace
    const preloadedAppspace = customConfig.preloadedAppspace;
    if (!preloadedAppspace && activeAppspace) return true;
    if (preloadedAppspace && !activeAppspace) return true;
    if (preloadedAppspace && activeAppspace) {
      if (activeAppspace.fileName !== preloadedAppspace.fileName) return true;
      if (activeAppspace.rawContent !== preloadedAppspace.content) return true;
    }
    
    return false;
  });
</script>

<header data-testid="app-header">
  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
    {#if customConfig.badgeImage}
      <img class="custom-badge-img" src={customConfig.badgeImage} alt="badge" />
    {:else if customConfig.badgeText}
      <span class="custom-badge" style="background: {customConfig.badgeColor || 'rgba(255,255,255,0.2)'}; color: {customConfig.badgeTextColor || 'white'}">
        {customConfig.badgeText}
      </span>
    {/if}
    
    <h1>{customConfig.title || 'FOM Viewer'}</h1>

    {#if customConfig.bundleId}
      {#if customConfig.mode === 'strict'}
        <span class="bundle-mode-badge strict-mode" title="This viewer is running in read-only bundle mode. Loading or removing files is disabled.">🔒 Read-Only Bundle</span>
      {:else}
        {#if isModified}
          <div style="display: flex; align-items: center;">
            <span class="bundle-mode-badge flexible-mode modified" title="You have modified the preloaded files. Click 'Restore Defaults' to revert.">
              ✏️ Flexible Bundle (Modified)
            </span>
            <button class="btn-restore-inline" id="restoreBundleBtnInline" onclick={() => document.getElementById('restoreBundleBtn')?.click()}>[Restore Defaults]</button>
          </div>
        {:else}
          <span class="bundle-mode-badge flexible-mode" title="This viewer is running in flexible bundle mode. You can add or remove files.">📦 Flexible Bundle</span>
        {/if}
      {/if}
    {/if}
  </div>
  
  <div class="search-box">
    <input type="text" id="globalSearch" data-testid="globalSearch" class="global-search" placeholder="Search all..." />
    <span class="kbd">/</span>
  </div>
  <div class="header-controls">
    <button class="btn header-btn" id="backBtn" data-testid="backBtn" style="display:none">← Back</button>
    <input type="file" id="fileInput" data-testid="fileInput" multiple accept=".xml" style="display:none" />
    <OverflowMenu>
      <div class="overflow-item">
        <select id="overflowThemeSelect" onchange={(e) => window.applyTheme(e.target.value)} style="width:100%;background:transparent;color:inherit;border:none;padding:8px;font-size:13px">
          <option value="light">☀️ Light</option>
          <option value="dark">🌙 Dark</option>
          <option value="system">💻 System</option>
        </select>
      </div>
      <div class="header-separator" style="margin:4px 0"></div>
      {#if customConfig.mode !== 'strict'}
        <button class="overflow-item" id="clearBtn" data-testid="clearBtn">Clear</button>
      {/if}
      <button class="overflow-item" id="exportBtn" data-testid="exportBtn">Export</button>
      {#if customConfig.mode !== 'strict'}
        <div class="header-separator" style="margin:4px 0"></div>
        <button class="overflow-item" id="loadAppspaceBtn" data-testid="loadAppspaceBtn">Load Appspace</button>
        <button class="overflow-item" id="clearAppspaceBtn" data-testid="clearAppspaceBtn" style="display:none">Clear Appspace</button>
      {/if}
      <button class="overflow-item" id="appspaceInfoItem">Appspace Info</button>
      {#if customConfig.bundleId && customConfig.mode !== 'strict'}
        <div class="header-separator" style="margin:4px 0"></div>
        <button class="overflow-item" id="restoreBundleBtn" data-testid="restoreBundleBtn">Restore Bundle</button>
      {/if}
      <div class="header-separator" style="margin:4px 0"></div>
      <button class="overflow-item" id="aboutBtn" data-testid="aboutBtn">About</button>
    </OverflowMenu>
  </div>
</header>

