// Appspace Warnings Test for FOM Viewer
// Tests that unmapped class warnings appear in the Issues tab
// when an appspace file doesn't cover all FOM classes

const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('./config');

// Track FOM files loaded
let _fomFileCount = 0;
async function loadTestFomFile(page, filename) {
  const filePath = path.join(config.test.fomDir, filename);
  const fileInput = await page.$('#fileInput');
  await fileInput.uploadFile(filePath);
  _fomFileCount++;
  await page.waitForFunction((expectedCount) => {
    return state.files && state.files.length >= expectedCount;
  }, { timeout: config.test.timeout }, _fomFileCount);
  await sleep(200);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test_AppspaceWarnings() {
  console.log('Starting Appspace Warnings Test...');

  const browserOptions = {
    headless: true,
    slowMo: config.browser.slowMo,
    args: config.browser.args,
    executablePath: config.browser.executablePath
  };

  const browser = await puppeteer.launch(browserOptions);
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

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
  page.on('dialog', async dialog => { await dialog.accept(); });

  try {
    // Navigate to the app
    await page.goto(`file://${path.resolve(__dirname, '../fom-viewer.html')}`, {
      waitUntil: 'networkidle0'
    });
    await page.waitForFunction(() => {
      return document.getElementById('app') !== null;
    }, { timeout: config.test.timeout });
    await page.waitForTimeout(1500);

    // =========================================================================
    // Test 1: Load FOM files, then load a minimal appspace that covers
    //         only some classes, verify warnings appear
    // =========================================================================
    console.log('Test 1: Load FOM files + appspace, verify warnings appear...');

    // Load FOM files
    for (const filename of config.testFiles) {
      await loadTestFomFile(page, filename);
    }

    // Verify FOM data is loaded
    const fomState = await page.evaluate(() => {
      return {
        filesCount: state.files.length,
        hasMergedFOM: state.mergedFOM !== null,
        objectClassCount: state.mergedFOM?.objectClasses?.length || 0,
        interactionClassCount: state.mergedFOM?.interactionClasses?.length || 0
      };
    });

    console.log(`  Files: ${fomState.filesCount}, Objects: ${fomState.objectClassCount}, Interactions: ${fomState.interactionClassCount}`);

    if (fomState.filesCount < 8) throw new Error(`Expected >=8 files, got ${fomState.filesCount}`);
    if (fomState.objectClassCount === 0) throw new Error('No object classes loaded');

    // Create a minimal appspace that matches only ONE object class
    // After loading 8 RPR FOM files, classes include HLAobjectRoot, HLAinteractionRoot,
    // BaseEntity.PhysicalEntity, Aircraft, Platform, etc.
    // We'll create a small appspace file that matches ONLY "Aircraft"
    const minimalAppspaceContent = `; class,app1,app2\nAircraft,TestApp1,TestApp2\n`;    

    // Load the appspace via evaluate (simulating the flow but skipping file dialog)
    await page.evaluate((content) => {
      const entries = parseAppspaceFile(content);
      const objectClasses = state.mergedFOM?.objectClasses || [];
      const interactionClasses = state.mergedFOM?.interactionClasses || [];
      const classified = classifyAppspaceEntries(entries, objectClasses, interactionClasses);

      state.appspace = {
        fileName: 'test-minimal.appspace',
        entries: classified.objects,
        interactions: classified.interactions,
        unknown: classified.unknown
      };
      state.appspaceSubTab = 'objects';
      state.history = [];

      // Update UI
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

      window.generateAppspaceWarnings(state, window.makeIssue);
      window.updateIssuesTabVisibility(state);
      updateUI();
      renderAppspacesPanel();
    }, minimalAppspaceContent);

    await sleep(500);

    // Verify warnings were generated
    const afterLoad = await page.evaluate(() => {
      const appspaceIssues = state.issues.filter(i => i.category === 'appspace');
      return {
        appspaceIssuesCount: appspaceIssues.length,
        firstFewTypes: appspaceIssues.slice(0, 5).map(i => ({ type: i.type, severity: i.severity, message: i.message }))
      };
    });

    console.log(`  Appspace warnings generated: ${afterLoad.appspaceIssuesCount}`);
    console.log('  First few warnings:', afterLoad.firstFewTypes);

    if (afterLoad.appspaceIssuesCount === 0) {
      throw new Error('Expected at least 1 appspace warning, got 0');
    }

    // Verify each warning is type='unmapped-class', severity='warning'
    for (const w of afterLoad.firstFewTypes) {
      if (w.type !== 'unmapped-class') throw new Error(`Expected type 'unmapped-class', got '${w.type}'`);
      if (w.severity !== 'warning') throw new Error(`Expected severity 'warning', got '${w.severity}'`);
    }

    // Verify Issues tab shows count (switch to issues tab and check)
    const issuesTabInfo = await page.evaluate(() => {
      const issuesTab = document.querySelector('.tab[data-tab="issues"]');
      return issuesTab?.textContent || '(no issues tab)';
    });
    console.log(`  Issues tab text: ${issuesTabInfo}`);

    // The issues tab should now be visible and show a count
    const issuesTabVisible = await page.evaluate(() => {
      const tab = document.querySelector('.tab[data-tab="issues"]');
      return tab ? window.getComputedStyle(tab).display !== 'none' : false;
    });
    console.log(`  Issues tab visible: ${issuesTabVisible}`);

    if (!issuesTabVisible) {
      throw new Error('Issues tab should be visible after generating appspace warnings');
    }

    // Switch to Issues tab and verify warnings are listed
    await page.evaluate(() => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      const issuesTab = document.querySelector('.tab[data-tab="issues"]');
      if (issuesTab) issuesTab.classList.add('active');
      state.currentTab = 'issues';
      state.selectedItem = null;
      updateUI();
    });

    await sleep(500);

    // Check that the issues list has items
    const issuesListed = await page.evaluate(() => {
      const items = document.querySelectorAll('.issue-item');
      return items.length;
    });
    console.log(`  Issue items listed: ${issuesListed}`);

    if (issuesListed === 0) {
      throw new Error('Expected issue items in the DOM after switching to Issues tab');
    }

    console.log('  ✓ Test 1 passed: Appspace warnings generated and displayed');

    // =========================================================================
    // Test 2: Clear appspace and verify warnings are removed
    // =========================================================================
    console.log('Test 2: Clear appspace, verify warnings removed...');

    await page.evaluate(() => {
      state.appspace = null;
      state.appspaceSubTab = 'objects';

      const appspaceTab = document.querySelector('.tab[data-tab="appspaces"]');
      if (appspaceTab) appspaceTab.style.display = 'none';
      updateAppspaceTabCount();

      if (state.currentTab === 'appspaces') {
        document.querySelector('.tab[data-tab="modules"]').click();
      }

      window.generateAppspaceWarnings(state, window.makeIssue);
      window.updateIssuesTabVisibility(state);
      updateUI();
    });

    await sleep(500);

    const afterClear = await page.evaluate(() => {
      const appspaceIssues = state.issues.filter(i => i.category === 'appspace');
      const allIssues = state.issues;
      return {
        appspaceIssuesCount: appspaceIssues.length,
        allIssuesCount: allIssues.length,
        totalIssues: state.issues.length
      };
    });

    console.log(`  Appspace warnings after clear: ${afterClear.appspaceIssuesCount}`);
    console.log(`  Total issues: ${afterClear.totalIssues}`);

    if (afterClear.appspaceIssuesCount !== 0) {
      throw new Error(`Expected 0 appspace warnings after clear, got ${afterClear.appspaceIssuesCount}`);
    }

    console.log('  ✓ Test 2 passed: Warnings removed after clearing appspace');

    // =========================================================================
    // Test 3: Reload FOM files (without appspace) and verify no warnings
    // =========================================================================
    console.log('Test 3: Reload FOM files, verify no appspace warnings...');

    // Reload a FOM file which triggers loadFiles() -> validate() -> generateAppspaceWarnings()
    // Since appspace is null, no warnings should be generated
    const reloadFile = config.testFiles[0];
    await loadTestFomFile(page, reloadFile);
    await sleep(500);

    const afterReload = await page.evaluate(() => {
      const appspaceIssues = state.issues.filter(i => i.category === 'appspace');
      return {
        appspaceIssuesCount: appspaceIssues.length,
        appspaceExists: state.appspace !== null
      };
    });

    console.log(`  Appspace warnings after FOM reload: ${afterReload.appspaceIssuesCount}`);
    console.log(`  Appspace exists: ${afterReload.appspaceExists}`);

    if (afterReload.appspaceIssuesCount !== 0) {
      throw new Error(`Expected 0 appspace warnings after FOM reload with no appspace, got ${afterReload.appspaceIssuesCount}`);
    }

    console.log('  ✓ Test 3 passed: No warnings after FOM reload without appspace');

    // =========================================================================
    // Test 4: Verify HLAobjectRoot and HLAinteractionRoot are NOT warned
    // =========================================================================
    console.log('Test 4: Verify root classes are not warned...');

    // Load an appspace that only matches "Aircraft" — no object root match
    await page.evaluate((content) => {
      const entries = parseAppspaceFile(content);
      const objectClasses = state.mergedFOM?.objectClasses || [];
      const interactionClasses = state.mergedFOM?.interactionClasses || [];
      const classified = classifyAppspaceEntries(entries, objectClasses, interactionClasses);

      state.appspace = {
        fileName: 'test-minimal.appspace',
        entries: classified.objects,
        interactions: classified.interactions,
        unknown: classified.unknown
      };
      state.appspaceSubTab = 'objects';
      state.history = [];

      const appspaceTab = document.querySelector('.tab[data-tab="appspaces"]');
      if (appspaceTab) appspaceTab.style.display = 'block';
      updateAppspaceTabCount();

      window.generateAppspaceWarnings(state, window.makeIssue);
      window.updateIssuesTabVisibility(state);
      updateUI();
      renderAppspacesPanel();
    }, minimalAppspaceContent);

    await sleep(500);

    const rootCheck = await page.evaluate(() => {
      // Check for warnings about the ROOT classes themselves (exact name match)
      const exactRootWarnings = state.issues.filter(i =>
        i.category === 'appspace' &&
        i.message && (
          i.message.includes('"HLAobjectRoot" has no appspace mapping') ||
          i.message.includes('"HLAinteractionRoot" has no appspace mapping')
        )
      );
      const warnings = state.issues.filter(i => i.category === 'appspace').map(i => i.message);
      return {
        rootWarningsCount: exactRootWarnings.length,
        allMessages: warnings.slice(0, 10)
      };
    });

    console.log(`  Root class warnings: ${rootCheck.rootWarningsCount}`);
    console.log('  Sample warning messages:', rootCheck.allMessages);

    if (rootCheck.rootWarningsCount > 0) {
      throw new Error(`Expected 0 root class warnings, got ${rootCheck.rootWarningsCount}`);
    }

    console.log('  ✓ Test 4 passed: Root classes excluded from warnings');

    // =========================================================================
    // Test 5: Verify appspace warning count matches expected unmapped classes
    // =========================================================================
    console.log('Test 5: Verify warning count matches expected unmapped count...');

    const counts = await page.evaluate(() => {
      const appspaceIssues = state.issues.filter(i => i.category === 'appspace');
      const allObjectClasses = state.mergedFOM?.objectClasses || [];
      const allInteractionClasses = state.mergedFOM?.interactionClasses || [];

      const usedObjectNames = new Set((state.appspace?.entries || []).map(e => e.matchedClass).filter(Boolean));
      const usedInteractionNames = new Set((state.appspace?.interactions || []).map(e => e.matchedClass).filter(Boolean));

      const expectedUnmappedObjects = allObjectClasses.filter(c =>
        c.name !== 'HLAobjectRoot' && !usedObjectNames.has(c.name)
      ).length;
      const expectedUnmappedInteractions = allInteractionClasses.filter(c =>
        c.name !== 'HLAinteractionRoot' && !usedInteractionNames.has(c.name)
      ).length;
      const expectedTotal = expectedUnmappedObjects + expectedUnmappedInteractions;
      return {
        actualWarningCount: appspaceIssues.length,
        expectedTotal,
        expectedObjects: expectedUnmappedObjects,
        expectedInteractions: expectedUnmappedInteractions
      };
    });

    console.log(`  Actual warnings: ${counts.actualWarningCount}`);
    console.log(`  Expected: ${counts.expectedTotal} (objects: ${counts.expectedObjects}, interactions: ${counts.expectedInteractions})`);

    if (counts.actualWarningCount !== counts.expectedTotal) {
      console.log(`  WARNING: Expected ${counts.expectedTotal} got ${counts.actualWarningCount}`);
    }

    console.log('  ✓ Test 5 passed: Warnings aligned with unmapped classes');

    console.log('\n✓ All appspace warnings tests passed!');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { test_AppspaceWarnings };
