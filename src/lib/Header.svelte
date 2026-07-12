<script>
  import OverflowMenu from './OverflowMenu.svelte';

  let isMobile = $state(false);

  $effect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    isMobile = mq.matches;
    const handler = () => isMobile = mq.matches;
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

</script>

<header data-testid="app-header">
  <h1>FOM Viewer</h1>
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
      <button class="overflow-item" id="clearBtn" data-testid="clearBtn">Clear</button>
      <button class="overflow-item" id="exportBtn" data-testid="exportBtn">Export</button>
      <div class="header-separator" style="margin:4px 0"></div>
      <button class="overflow-item" id="loadAppspaceBtn" data-testid="loadAppspaceBtn">Load Appspace</button>
      <button class="overflow-item" id="clearAppspaceBtn" data-testid="clearAppspaceBtn" style="display:none">Clear Appspace</button>
      <button class="overflow-item" id="appspaceInfoItem">Appspace Info</button>
      <div class="header-separator" style="margin:4px 0"></div>
      <button class="overflow-item" id="aboutBtn" data-testid="aboutBtn">About</button>
    </OverflowMenu>
  </div>
</header>
