<header data-testid="app-header">
  <h1>FOM Viewer</h1>
  <div class="header-controls">
    <button class="btn header-btn" id="backBtn" data-testid="backBtn" style="display:none">← Back</button>
    <input type="text" id="globalSearch" data-testid="globalSearch" class="global-search" placeholder="Search all..." />
    <div class="header-separator"></div>
    <button class="btn header-btn" id="clearBtn" data-testid="clearBtn">Clear</button>
    <label class="btn header-btn" data-testid="loadFomLabel">Load FOM<input type="file" id="fileInput" data-testid="fileInput" multiple accept=".xml" style="display:none" /></label>
    <button class="btn header-btn" id="exportBtn" data-testid="exportBtn">Export</button>
    <div class="header-separator" id="exportAppspaceSeparator" data-testid="exportAppspaceSeparator"></div>
    <button class="btn header-btn" id="loadAppspaceBtn" data-testid="loadAppspaceBtn">Load Appspace</button>
    <button class="btn header-btn" id="clearAppspaceBtn" data-testid="clearAppspaceBtn" style="display:none">Clear Appspace</button>
    <div class="header-separator" id="appspaceSeparator" data-testid="appspaceSeparator"></div>
    <button class="theme-toggle" id="themeToggle" data-testid="themeToggle" title="Toggle light/dark theme">☀️</button>
    <button class="theme-toggle" id="aboutBtn" data-testid="aboutBtn" title="About FOM Viewer">?</button>
  </div>
</header>
