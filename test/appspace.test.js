// Appspace Feature Test for FOM Viewer
// Tests the full appspace lifecycle: load, classify, subtabs, clear, persistence

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const config = require('./config');

async function test_AppspaceFeature() {
  console.log('Starting Appspace Feature Test...');

  const browserOptions = {
    headless: true,
    slowMo: config.browser.slowMo,
    args: config.browser.args,
    executablePath: config.browser.executablePath
  };

  const browser = await puppeteer.launch(browserOptions);
  const page = await browser.newPage();

  await page.setViewport({ width: 1280, height: 800 });

  // Capture console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`Console error: ${msg.text()}`);
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    console.error('Page error:', error);
    consoleErrors.push(error.message);
  });

  // Auto-accept confirm dialogs
  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  try {
    // Navigate to the app
    await page.goto(`file://${path.resolve(__dirname, '../fom-viewer.html')}`, {
      waitUntil: 'networkidle0'
    });

    // Wait for app to load
    await page.waitForFunction(() => {
      return document.getElementById('app') !== null;
    }, { timeout: config.test.timeout });

    // Wait for init() to complete (async storage load, etc.)
    await page.waitForTimeout(1500);

    // =========================================================================
    // Test 1: Load all 8 FOM files to populate object/interaction classes
    // =========================================================================
    console.log('Test 1: Loading all 8 FOM files...');

    for (const filename of config.testFiles) {
      await loadTestFomFile(page, filename);
    }

    // Verify files are loaded and merged FOM has data
    const afterFilesLoad = await page.evaluate(() => {
      return {
        filesCount: state.files.length,
        hasMergedFOM: state.mergedFOM !== null,
        objectClassCount: state.mergedFOM?.objectClasses?.length || 0,
        interactionClassCount: state.mergedFOM?.interactionClasses?.length || 0
      };
    });

    console.log('  Files loaded:', afterFilesLoad.filesCount);
    console.log('  Object classes:', afterFilesLoad.objectClassCount);
    console.log('  Interaction classes:', afterFilesLoad.interactionClassCount);

    if (afterFilesLoad.filesCount < 8) {
      throw new Error(`Expected at least 8 files loaded, got ${afterFilesLoad.filesCount}`);
    }
    if (afterFilesLoad.objectClassCount === 0) {
      throw new Error('Expected object classes to be populated after loading FOM files');
    }
    if (afterFilesLoad.interactionClassCount === 0) {
      throw new Error('Expected interaction classes to be populated after loading FOM files');
    }

    console.log('  ✓ Test 1 passed: FOM files loaded successfully');

    // =========================================================================
    // Test 2: Load appspace file with object matches
    // =========================================================================
    console.log('Test 2: Loading appspace with object matches...');

    const objectsContent = fs.readFileSync(
      path.join(config.test.fomDir, 'test-appspace-objects.appspace'),
      'utf-8'
    );

    // Set up appspace via page.evaluate (Option A: direct state manipulation)
    await page.evaluate((content) => {
      const entries = parseAppspaceFile(content);
      const objectClasses = state.mergedFOM?.objectClasses || [];
      const interactionClasses = state.mergedFOM?.interactionClasses || [];
      const classified = classifyAppspaceEntries(entries, objectClasses, interactionClasses);

      state.appspace = {
        fileName: 'test-appspace-objects.appspace',
        entries: classified.objects,
        interactions: classified.interactions,
        unknown: classified.unknown
      };
      state.appspaceSubTab = 'objects';
      state.history = [];

      // Show appspace tab
      const appspaceTab = document.querySelector('.tab[data-tab="appspaces"]');
      if (appspaceTab) appspaceTab.style.display = 'block';
      updateAppspaceTabCount();

      // Switch to appspaces tab
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      if (appspaceTab) appspaceTab.classList.add('active');
      state.currentTab = 'appspaces';
      state.selectedItem = null;

      // Update load/clear button state
      const loadBtn = document.getElementById('loadAppspaceBtn');
      const clearBtn = document.getElementById('clearAppspaceBtn');
      if (loadBtn) { loadBtn.textContent = 'Change Appspace'; loadBtn.style.display = 'inline-block'; }
      if (clearBtn) clearBtn.style.display = 'inline-block';

      updateUI();
      renderAppspacesPanel();
    }, objectsContent);

    await sleep(500);

    // Verify appspace state
    const afterObjectLoad = await page.evaluate(() => {
      return {
        appspaceExists: state.appspace !== null,
        objectCount: state.appspace?.entries?.length || 0,
        interactionCount: state.appspace?.interactions?.length || 0,
        unknownCount: state.appspace?.unknown?.length || 0,
        currentTab: state.currentTab,
        subTab: state.appspaceSubTab,
        appspaceTabVisible: document.querySelector('.tab[data-tab="appspaces"]')?.style.display !== 'none'
      };
    });

    console.log('  Object entries:', afterObjectLoad.objectCount);
    console.log('  Interaction entries:', afterObjectLoad.interactionCount);
    console.log('  Unknown entries:', afterObjectLoad.unknownCount);
    console.log('  Current tab:', afterObjectLoad.currentTab);
    console.log('  Subtab:', afterObjectLoad.subTab);

    if (!afterObjectLoad.appspaceExists) {
      throw new Error('Appspace should exist after loading');
    }
    if (afterObjectLoad.objectCount !== 6) {
      throw new Error(`Expected 6 object entries, got ${afterObjectLoad.objectCount}`);
    }
    if (afterObjectLoad.interactionCount !== 0) {
      throw new Error(`Expected 0 interaction entries, got ${afterObjectLoad.interactionCount}`);
    }
    if (afterObjectLoad.unknownCount !== 0) {
      throw new Error(`Expected 0 unknown entries, got ${afterObjectLoad.unknownCount}`);
    }
    if (afterObjectLoad.currentTab !== 'appspaces') {
      throw new Error(`Expected currentTab to be 'appspaces', got '${afterObjectLoad.currentTab}'`);
    }
    if (!afterObjectLoad.appspaceTabVisible) {
      throw new Error('Appspaces tab should be visible');
    }

    // Verify Objects subtab is active and shows entries
    const objectsActive = await page.evaluate(() => {
      const activeTab = document.querySelector('#appspaceTabs .subtab.active');
      return activeTab?.dataset.subtab || null;
    });
    if (objectsActive !== 'objects') {
      throw new Error(`Expected Objects subtab to be active, got '${objectsActive}'`);
    }

    // Verify the table contains expected class names
    const objectEntries = await page.evaluate(() => {
      const rows = document.querySelectorAll('.appspace-table tr');
      const classNames = [];
      rows.forEach(row => {
        const nameCell = row.querySelector('td:first-child');
        if (nameCell) {
          // Get full text content (concatenating all span texts)
          classNames.push(nameCell.textContent.replace(/\s+/g, ''));
        }
      });
      return classNames.filter(c => c && c !== 'Class'); // filter header
    });

    console.log('  Object entries in table:', objectEntries.length);

    // Check that key entries appear (table displays entry.className, which is the short entry name)
    const expectedMatchedNames = [
      'Aircraft',
      'Platform',
      'PhysicalEntity.Platform.AmphibiousVehicle',
      'GroundVehicle',
      'BaseEntity.PhysicalEntity'
    ];

    for (const expectedName of expectedMatchedNames) {
      const found = objectEntries.some(entry => entry.includes(expectedName));
      if (!found) {
        console.log('  Available entries:', objectEntries);
        throw new Error(`Expected matched class name containing "${expectedName}" not found in table`);
      }
    }

    // Verify apps appear
    const apps = await page.evaluate(() => {
      const items = document.querySelectorAll('.apps-list li');
      return Array.from(items).map(li => li.textContent);
    });

    console.log('  Apps listed:', apps);

    const expectedApps = ['TestApp1', 'TestApp2', 'PlatformViewer', 'AmphibiousMonitor', 'GroundTracker', 'AircraftMonitor', 'EntityViewer'];
    for (const app of expectedApps) {
      if (!apps.includes(app)) {
        throw new Error(`Expected app "${app}" not found in apps list`);
      }
    }

    // Verify subtab counts
    const subtabCounts = await page.evaluate(() => {
      const objTab = document.querySelector('#appspaceTabs .subtab[data-subtab="objects"]');
      const intTab = document.querySelector('#appspaceTabs .subtab[data-subtab="interactions"]');
      const unkTab = document.querySelector('#appspaceTabs .subtab[data-subtab="unknown"]');
      return {
        objects: objTab?.textContent || '',
        interactions: intTab?.textContent || '',
        unknown: unkTab?.textContent || ''
      };
    });

    console.log('  Subtab texts:', subtabCounts);

    if (!subtabCounts.objects.includes('6')) {
      throw new Error(`Objects subtab should show count 6, got "${subtabCounts.objects}"`);
    }
    if (!subtabCounts.interactions.includes('0')) {
      throw new Error(`Interactions subtab should show count 0, got "${subtabCounts.interactions}"`);
    }
    if (!subtabCounts.unknown.includes('0')) {
      throw new Error(`Unknown subtab should show count 0, got "${subtabCounts.unknown}"`);
    }

    // Verify tab count in the main tab bar
    const tabText = await page.evaluate(() => {
      const tab = document.querySelector('.tab[data-tab="appspaces"]');
      return tab?.textContent || '';
    });
    if (!tabText.includes('6')) {
      throw new Error(`Appspaces tab should show total count 6, got "${tabText}"`);
    }

    console.log('  ✓ Test 2 passed: Object matches loaded correctly');

    // =========================================================================
    // Test 3: Load appspace with mixed entries (objects, interactions, unknown)
    // =========================================================================
    console.log('Test 3: Loading appspace with mixed entries...');

    const mixedContent = fs.readFileSync(
      path.join(config.test.fomDir, 'test-appspace-mixed.appspace'),
      'utf-8'
    );

    await page.evaluate((content) => {
      const entries = parseAppspaceFile(content);
      const objectClasses = state.mergedFOM?.objectClasses || [];
      const interactionClasses = state.mergedFOM?.interactionClasses || [];
      const classified = classifyAppspaceEntries(entries, objectClasses, interactionClasses);

      state.appspace = {
        fileName: 'test-appspace-mixed.appspace',
        entries: classified.objects,
        interactions: classified.interactions,
        unknown: classified.unknown
      };
      state.appspaceSubTab = 'objects';

      updateAppspaceTabCount();
      state.currentTab = 'appspaces';
      updateUI();
      renderAppspacesPanel();
    }, mixedContent);

    await sleep(500);

    // Verify mixed classification
    const mixedState = await page.evaluate(() => {
      return {
        objectCount: state.appspace?.entries?.length || 0,
        interactionCount: state.appspace?.interactions?.length || 0,
        unknownCount: state.appspace?.unknown?.length || 0,
        total: (state.appspace?.entries?.length || 0) +
               (state.appspace?.interactions?.length || 0) +
               (state.appspace?.unknown?.length || 0)
      };
    });

    console.log('  Mixed state:', mixedState);

    // The mixed file has:
    // Objects: Aircraft, Platform, PhysicalEntity.Platform.AmphibiousVehicle = 3
    // Interactions: Collision, RadioSignal, IFFEmission = 3
    // Unknown: CustomClass.SomeObject, TotallyFake.ClassName = 2
    if (mixedState.objectCount !== 3) {
      throw new Error(`Expected 3 object entries in mixed, got ${mixedState.objectCount}`);
    }
    if (mixedState.interactionCount !== 3) {
      throw new Error(`Expected 3 interaction entries in mixed, got ${mixedState.interactionCount}`);
    }
    if (mixedState.unknownCount !== 2) {
      throw new Error(`Expected 2 unknown entries in mixed, got ${mixedState.unknownCount}`);
    }

    // Verify Objects subtab content
    const mixedObjectEntries = await page.evaluate(() => {
      const rows = document.querySelectorAll('.appspace-table tr');
      const entries = [];
      rows.forEach(row => {
        const nameCell = row.querySelector('td:first-child');
        if (nameCell && !nameCell.textContent.includes('Class')) {
          entries.push(nameCell.textContent.replace(/\s+/g, ''));
        }
      });
      return entries;
    });

    console.log('  Mixed object entries:', mixedObjectEntries.length);

    const expectedMixedObjects = [
      'Aircraft',
      'Platform',
      'PhysicalEntity.Platform.AmphibiousVehicle'
    ];
    for (const name of expectedMixedObjects) {
      if (!mixedObjectEntries.some(e => e.includes(name))) {
        throw new Error(`Expected object class "${name}" in Objects subtab`);
      }
    }

    // Switch to Interactions subtab
    await page.evaluate(() => {
      state.appspaceSubTab = 'interactions';
      state.history.push({ tab: 'appspaces', subTab: 'objects', selected: null, detail: 'block' });
      document.querySelectorAll('#appspaceTabs .subtab').forEach(t => t.classList.remove('active'));
      document.querySelector('#appspaceTabs .subtab[data-subtab="interactions"]')?.classList.add('active');
      document.getElementById('detailHeader').style.display = 'none';
      state.selectedItem = null;
      updateUI();
      renderAppspacesPanel();
    });
    await sleep(500);

    const activeIntTab = await page.evaluate(() => {
      const active = document.querySelector('#appspaceTabs .subtab.active');
      return active?.dataset.subtab || null;
    });
    if (activeIntTab !== 'interactions') {
      throw new Error(`Expected Interactions subtab to be active, got '${activeIntTab}'`);
    }

    const interactionEntries = await page.evaluate(() => {
      const rows = document.querySelectorAll('.appspace-table tr');
      const entries = [];
      rows.forEach(row => {
        const nameCell = row.querySelector('td:first-child');
        if (nameCell && !nameCell.textContent.includes('Class')) {
          entries.push(nameCell.textContent.replace(/\s+/g, ''));
        }
      });
      return entries;
    });

    console.log('  Interaction entries:', interactionEntries.length);

    const expectedInteractions = [
      'Collision',
      'RadioSignal',
      'IFFEmission'
    ];
    for (const name of expectedInteractions) {
      if (!interactionEntries.some(e => e.includes(name))) {
        throw new Error(`Expected interaction class "${name}" in Interactions subtab`);
      }
    }

    // Verify interaction apps
    const interactionApps = await page.evaluate(() => {
      const items = document.querySelectorAll('.apps-list li');
      return Array.from(items).map(li => li.textContent);
    });

    const expectedIntApps = ['CollisionLogger', 'RadioMonitor', 'IFFTracker'];
    for (const app of expectedIntApps) {
      if (!interactionApps.includes(app)) {
        throw new Error(`Expected interaction app "${app}" not found`);
      }
    }

    // Switch to Unknown subtab
    await page.evaluate(() => {
      state.appspaceSubTab = 'unknown';
      state.history.push({ tab: 'appspaces', subTab: 'interactions', selected: null, detail: 'block' });
      document.querySelectorAll('#appspaceTabs .subtab').forEach(t => t.classList.remove('active'));
      document.querySelector('#appspaceTabs .subtab[data-subtab="unknown"]')?.classList.add('active');
      document.getElementById('detailHeader').style.display = 'none';
      state.selectedItem = null;
      updateUI();
      renderAppspacesPanel();
    });
    await sleep(500);

    const activeUnkTab = await page.evaluate(() => {
      const active = document.querySelector('#appspaceTabs .subtab.active');
      return active?.dataset.subtab || null;
    });
    if (activeUnkTab !== 'unknown') {
      throw new Error(`Expected Unknown subtab to be active, got '${activeUnkTab}'`);
    }

    // Verify unknown entries have 'unmatched' class
    const unknownEntries = await page.evaluate(() => {
      const rows = document.querySelectorAll('.appspace-table tr.unmatched');
      const entries = [];
      rows.forEach(row => {
        const nameCell = row.querySelector('td:first-child');
        if (nameCell) {
          entries.push(nameCell.textContent.replace(/\s+/g, ''));
        }
      });
      return entries;
    });

    console.log('  Unknown entries:', unknownEntries.length);

    if (unknownEntries.length !== 2) {
      throw new Error(`Expected 2 unknown entries with 'unmatched' class, got ${unknownEntries.length}`);
    }

    const expectedUnknown = ['CustomClass.SomeObject', 'TotallyFake.ClassName'];
    for (const name of expectedUnknown) {
      if (!unknownEntries.some(e => e.includes(name))) {
        throw new Error(`Expected unknown entry "${name}" not found`);
      }
    }

    // Verify subtab count badges
    const mixedSubtabCounts = await page.evaluate(() => {
      const objTab = document.querySelector('#appspaceTabs .subtab[data-subtab="objects"]');
      const intTab = document.querySelector('#appspaceTabs .subtab[data-subtab="interactions"]');
      const unkTab = document.querySelector('#appspaceTabs .subtab[data-subtab="unknown"]');
      return {
        objects: objTab?.textContent || '',
        interactions: intTab?.textContent || '',
        unknown: unkTab?.textContent || ''
      };
    });

    if (!mixedSubtabCounts.objects.includes('3')) {
      throw new Error(`Objects subtab should show count 3, got "${mixedSubtabCounts.objects}"`);
    }
    if (!mixedSubtabCounts.interactions.includes('3')) {
      throw new Error(`Interactions subtab should show count 3, got "${mixedSubtabCounts.interactions}"`);
    }
    if (!mixedSubtabCounts.unknown.includes('2')) {
      throw new Error(`Unknown subtab should show count 2, got "${mixedSubtabCounts.unknown}"`);
    }

    // Verify total tab count
    const mixedTabText = await page.evaluate(() => {
      const tab = document.querySelector('.tab[data-tab="appspaces"]');
      return tab?.textContent || '';
    });
    if (!mixedTabText.includes('8')) {
      throw new Error(`Appspaces tab should show total count 8, got "${mixedTabText}"`);
    }

    console.log('  ✓ Test 3 passed: Mixed entries classified correctly');

    // =========================================================================
    // Test 4: Load appspace with all unknown entries
    // =========================================================================
    console.log('Test 4: Loading appspace with all unknown entries...');

    const unknownContent = fs.readFileSync(
      path.join(config.test.fomDir, 'test-appspace-unknown.appspace'),
      'utf-8'
    );

    await page.evaluate((content) => {
      const entries = parseAppspaceFile(content);
      const objectClasses = state.mergedFOM?.objectClasses || [];
      const interactionClasses = state.mergedFOM?.interactionClasses || [];
      const classified = classifyAppspaceEntries(entries, objectClasses, interactionClasses);

      state.appspace = {
        fileName: 'test-appspace-unknown.appspace',
        entries: classified.objects,
        interactions: classified.interactions,
        unknown: classified.unknown
      };
      state.appspaceSubTab = 'unknown';

      updateAppspaceTabCount();
      state.currentTab = 'appspaces';
      updateUI();
      renderAppspacesPanel();
    }, unknownContent);

    await sleep(500);

    // Verify all unknown
    const unknownOnlyState = await page.evaluate(() => {
      return {
        objectCount: state.appspace?.entries?.length || 0,
        interactionCount: state.appspace?.interactions?.length || 0,
        unknownCount: state.appspace?.unknown?.length || 0,
        currentTab: state.currentTab,
        subTab: state.appspaceSubTab
      };
    });

    console.log('  Unknown-only state:', unknownOnlyState);

    if (unknownOnlyState.objectCount !== 0) {
      throw new Error(`Expected 0 object entries, got ${unknownOnlyState.objectCount}`);
    }
    if (unknownOnlyState.interactionCount !== 0) {
      throw new Error(`Expected 0 interaction entries, got ${unknownOnlyState.interactionCount}`);
    }
    if (unknownOnlyState.unknownCount !== 3) {
      throw new Error(`Expected 3 unknown entries, got ${unknownOnlyState.unknownCount}`);
    }

    // Verify Unknown subtab is active
    if (unknownOnlyState.subTab !== 'unknown') {
      throw new Error(`Expected subtab to be 'unknown', got '${unknownOnlyState.subTab}'`);
    }

    // Verify Unknown subtab shows entries
    const unknownOnlyEntries = await page.evaluate(() => {
      const rows = document.querySelectorAll('.appspace-table tr.unmatched');
      return rows.length;
    });
    if (unknownOnlyEntries !== 3) {
      throw new Error(`Expected 3 unmatched rows, got ${unknownOnlyEntries}`);
    }

    // Switch to Objects subtab — should show empty state
    await page.evaluate(() => {
      state.appspaceSubTab = 'objects';
      document.querySelectorAll('#appspaceTabs .subtab').forEach(t => t.classList.remove('active'));
      document.querySelector('#appspaceTabs .subtab[data-subtab="objects"]')?.classList.add('active');
      document.getElementById('detailHeader').style.display = 'none';
      state.selectedItem = null;
      updateUI();
      renderAppspacesPanel();
    });
    await sleep(500);

    const objectsEmptyState = await page.evaluate(() => {
      const emptyState = document.querySelector('.detail-body .empty-state');
      return emptyState?.textContent?.trim() || null;
    });

    if (objectsEmptyState !== 'No matched objects found.') {
      throw new Error(`Expected "No matched objects found." empty state, got "${objectsEmptyState}"`);
    }

    // Switch to Interactions subtab — should show empty state
    await page.evaluate(() => {
      state.appspaceSubTab = 'interactions';
      document.querySelectorAll('#appspaceTabs .subtab').forEach(t => t.classList.remove('active'));
      document.querySelector('#appspaceTabs .subtab[data-subtab="interactions"]')?.classList.add('active');
      document.getElementById('detailHeader').style.display = 'none';
      state.selectedItem = null;
      updateUI();
      renderAppspacesPanel();
    });
    await sleep(500);

    const interactionsEmptyState = await page.evaluate(() => {
      const emptyState = document.querySelector('.detail-body .empty-state');
      return emptyState?.textContent?.trim() || null;
    });

    if (interactionsEmptyState !== 'No matched interactions found.') {
      throw new Error(`Expected "No matched interactions found." empty state, got "${interactionsEmptyState}"`);
    }

    console.log('  ✓ Test 4 passed: All unknown entries handled correctly');

    // =========================================================================
    // Test 5: Clear appspace
    // =========================================================================
    console.log('Test 5: Clearing appspace...');

    // Click clear button (inside overflow menu)
    await page.click('[data-testid="overflowToggle"]');
    await sleep(200);
    await waitAndClick(page, '#clearAppspaceBtn');
    await sleep(500);

    // Verify appspace is cleared
    const afterClear = await page.evaluate(() => {
      return {
        appspaceExists: state.appspace !== null,
        appspaceTabDisplay: document.querySelector('.tab[data-tab="appspaces"]')?.style.display || 'visible',
        currentTab: state.currentTab,
        clearBtnDisplay: document.getElementById('clearAppspaceBtn')?.style.display || 'visible',
        loadBtnText: document.getElementById('loadAppspaceBtn')?.textContent || ''
      };
    });

    console.log('  After clear state:', afterClear);

    if (afterClear.appspaceExists) {
      throw new Error('Appspace should be null after clear');
    }
    if (afterClear.clearBtnDisplay !== 'none') {
      throw new Error('Clear button should be hidden after clear');
    }
    if (afterClear.loadBtnText !== 'Load Appspace') {
      throw new Error(`Load button text should revert to "Load Appspace", got "${afterClear.loadBtnText}"`);
    }
    if (afterClear.currentTab !== 'appspaces') {
      throw new Error(`Current tab should stay on 'appspaces' after clear, got '${afterClear.currentTab}'`);
    }

    console.log('  ✓ Test 5 passed: Appspace cleared successfully');

    // =========================================================================
    // Test 6: Persistence round-trip (reload from IndexedDB)
    // =========================================================================
    console.log('Test 6: Testing persistence round-trip...');

    // Load appspace again
    await page.evaluate((content) => {
      const entries = parseAppspaceFile(content);
      const objectClasses = state.mergedFOM?.objectClasses || [];
      const interactionClasses = state.mergedFOM?.interactionClasses || [];
      const classified = classifyAppspaceEntries(entries, objectClasses, interactionClasses);

      state.appspace = {
        fileName: 'test-appspace-objects.appspace',
        entries: classified.objects,
        interactions: classified.interactions,
        unknown: classified.unknown
      };
      state.appspaceSubTab = 'objects';
      state.history = [];

      const appspaceTab = document.querySelector('.tab[data-tab="appspaces"]');
      if (appspaceTab) appspaceTab.style.display = 'block';
      updateAppspaceTabCount();

      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      if (appspaceTab) appspaceTab.classList.add('active');
      state.currentTab = 'appspaces';
      state.selectedItem = null;

      const loadBtn = document.getElementById('loadAppspaceBtn');
      const clearBtn = document.getElementById('clearAppspaceBtn');
      if (loadBtn) { loadBtn.textContent = 'Change Appspace'; loadBtn.style.display = 'inline-block'; }
      if (clearBtn) clearBtn.style.display = 'inline-block';

      updateUI();
      saveAppspaceToStorage();
    }, objectsContent);

    await sleep(500);

    // Verify appspace is loaded
    const preRefresh = await page.evaluate(() => {
      return {
        appspaceExists: state.appspace !== null,
        objectCount: state.appspace?.entries?.length || 0,
        subTab: state.appspaceSubTab
      };
    });
    console.log('  Pre-refresh state:', preRefresh);

    if (!preRefresh.appspaceExists || preRefresh.objectCount !== 6) {
      throw new Error('Appspace not properly loaded before refresh');
    }

    // Refresh the page
    await page.goto(`file://${path.resolve(__dirname, '../fom-viewer.html')}`, {
      waitUntil: 'networkidle0'
    });

    // Wait for init to complete
    await page.waitForFunction(() => {
      return document.getElementById('app') !== null;
    }, { timeout: config.test.timeout });

    // Wait for IndexedDB load to complete (init is async)
    await page.waitForTimeout(2000);

    // Reload FOM files from storage (they should be persisted too)
    // Wait for state to be restored
    await page.waitForFunction(() => {
      return state.files && state.files.length > 0;
    }, { timeout: config.test.timeout });

    // Verify appspace is restored from IndexedDB
    const postRefresh = await page.evaluate(() => {
      return {
        appspaceExists: state.appspace !== null,
        objectCount: state.appspace?.entries?.length || 0,
        interactionCount: state.appspace?.interactions?.length || 0,
        unknownCount: state.appspace?.unknown?.length || 0,
        fileName: state.appspace?.fileName || '',
        subTab: state.appspaceSubTab,
        appspaceTabVisible: document.querySelector('.tab[data-tab="appspaces"]')?.style.display !== 'none',
        currentTab: state.currentTab,
        loadBtnText: document.getElementById('loadAppspaceBtn')?.textContent || '',
        clearBtnVisible: document.getElementById('clearAppspaceBtn')?.style.display !== 'none'
      };
    });

    console.log('  Post-refresh state:', postRefresh);

    if (!postRefresh.appspaceExists) {
      throw new Error('Appspace should be restored from IndexedDB after refresh');
    }
    if (postRefresh.objectCount !== 6) {
      throw new Error(`Expected 6 object entries after refresh, got ${postRefresh.objectCount}`);
    }
    if (postRefresh.interactionCount !== 0) {
      throw new Error(`Expected 0 interaction entries after refresh, got ${postRefresh.interactionCount}`);
    }
    if (postRefresh.unknownCount !== 0) {
      throw new Error(`Expected 0 unknown entries after refresh, got ${postRefresh.unknownCount}`);
    }
    if (postRefresh.fileName !== 'test-appspace-objects.appspace') {
      throw new Error(`Expected fileName "test-appspace-objects.appspace", got "${postRefresh.fileName}"`);
    }
    if (!postRefresh.appspaceTabVisible) {
      throw new Error('Appspaces tab should be visible after refresh');
    }
    if (postRefresh.loadBtnText !== 'Change Appspace') {
      throw new Error(`Load button should say "Change Appspace" after refresh, got "${postRefresh.loadBtnText}"`);
    }
    if (!postRefresh.clearBtnVisible) {
      throw new Error('Clear button should be visible after refresh');
    }

    console.log('  ✓ Test 6 passed: Persistence round-trip successful');

    // =========================================================================
    // Test 7: Subtab persistence
    // =========================================================================
    console.log('Test 7: Testing subtab persistence...');

    // Switch to Unknown subtab
    await page.evaluate(() => {
      state.appspaceSubTab = 'unknown';
      document.querySelectorAll('#appspaceTabs .subtab').forEach(t => t.classList.remove('active'));
      document.querySelector('#appspaceTabs .subtab[data-subtab="unknown"]')?.classList.add('active');
      document.getElementById('detailHeader').style.display = 'none';
      state.selectedItem = null;
      updateUI();
      renderAppspacesPanel();
    });

    await sleep(500);

    // Verify Unknown subtab is active
    const beforeSubtabRefresh = await page.evaluate(() => {
      const active = document.querySelector('#appspaceTabs .subtab.active');
      return active?.dataset.subtab || null;
    });

    if (beforeSubtabRefresh !== 'unknown') {
      throw new Error(`Expected Unknown subtab active before refresh, got '${beforeSubtabRefresh}'`);
    }

    // Refresh the page
    await page.goto(`file://${path.resolve(__dirname, '../fom-viewer.html')}`, {
      waitUntil: 'networkidle0'
    });

    // Wait for init to complete
    await page.waitForFunction(() => {
      return document.getElementById('app') !== null;
    }, { timeout: config.test.timeout });

    // Wait for IndexedDB load to complete
    await page.waitForTimeout(2000);

    // Wait for state to be restored
    await page.waitForFunction(() => {
      return state.files && state.files.length > 0;
    }, { timeout: config.test.timeout });

    // Verify subtab is restored
    const afterSubtabRefresh = await page.evaluate(() => {
      return {
        appspaceSubTab: state.appspaceSubTab,
        currentTab: state.currentTab
      };
    });

    console.log('  After subtab refresh:', afterSubtabRefresh);

    if (afterSubtabRefresh.appspaceSubTab !== 'unknown') {
      throw new Error(`Expected appspaceSubTab to be 'unknown' after refresh, got '${afterSubtabRefresh.appspaceSubTab}'`);
    }

    // Note: We do NOT check DOM active subtab class here because after a refresh,
    // state.currentTab defaults to 'modules'. The appspace subtab active class
    // is only restored when the user navigates to the appspaces tab.
    // The state.appspaceSubTab value IS correctly persisted via saveAppspaceToStorage().

    console.log('  ✓ Test 7 passed: Subtab persistence works correctly');

    console.log('All appspace tests passed!');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Helper: Load a FOM test file via #fileInput
let _fomFileCount = 0;
async function loadTestFomFile(page, filename) {
  const filePath = path.join(config.test.fomDir, filename);

  const fileInput = await page.$('#fileInput');
  await fileInput.uploadFile(filePath);

  _fomFileCount++;
  await page.waitForFunction((expectedCount) => {
    return state.files && state.files.length >= expectedCount;
  }, { timeout: config.test.timeout }, _fomFileCount);

  // Small extra settle time after async merge
  await sleep(200);
}

// Helper: Promise-based delay
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Wait for selector then click
async function waitAndClick(page, selector, waitOpts = {}) {
  await page.waitForSelector(selector, { timeout: waitOpts.timeout || config.test.waitForSelector });
  await page.click(selector);
}

module.exports = { test_AppspaceFeature };
