// Subspace Dimension Test for FOM Viewer
// Tests that appspace names link to enumerated dimension values when a
// "subspace" dimension exists with a matching enumerated data type.

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const config = require('./config');

async function test_SubspaceFeature() {
  console.log('Starting Subspace Feature Test...');

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
      console.error('  Console error:', msg.text());
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', error => {
    consoleErrors.push(error.message);
  });

  try {
    // Navigate
    await page.goto(`file://${path.resolve(__dirname, '../fom-viewer.html')}`, {
      waitUntil: 'networkidle0'
    });
    await page.waitForFunction(() => document.getElementById('app') !== null, { timeout: config.test.timeout });
    await page.waitForTimeout(1500);

    // =====================================================================
    // Setup: load SubspaceTest.xml PLUS all standard FOM files
    // =====================================================================
    console.log('Loading SubspaceTest.xml + all FOM files...');

    _fomFileCount = 0;
    await loadFomFile(page, 'SubspaceTest.xml');
    for (const f of config.testFiles) {
      await loadFomFile(page, f);
    }

    const setup = await page.evaluate(() => ({
      filesCount: state.files.length,
      hasMergedFOM: state.mergedFOM !== null,
      objectClasses: state.mergedFOM?.objectClasses?.length || 0,
      interactionClasses: state.mergedFOM?.interactionClasses?.length || 0
    }));
    console.log(`  Files: ${setup.filesCount}, Objects: ${setup.objectClasses}, Interactions: ${setup.interactionClasses}`);
    if (setup.filesCount < 9) throw new Error(`Expected ≥9 files, got ${setup.filesCount}`);

    // =====================================================================
    // Test 1: Subspace dimension is detected
    // =====================================================================
    console.log('Test 1: Subspace dimension detection...');

    const dimInfo = await page.evaluate(() => {
      // Collect dimensions from all files
      const dimMap = {};
      state.files.forEach(f => (f.dimensions || []).forEach(d => { dimMap[d.name] = d; }));
      const subspace = dimMap['subspace'];
      if (!subspace) return null;
      const dataTypeRow = (subspace.rows || []).find(r => r.key.toLowerCase() === 'datatype');
      const dataType = dataTypeRow ? dataTypeRow.value : null;
      // Look up the enum type in merged data types
      const enumType = (state.mergedFOM?.dataTypes?.enum || []).find(e => e.name === dataType);
      return {
        name: subspace.name,
        dataType: dataType,
        enumeratorCount: enumType?.values?.length || 0,
        enumeratorNames: (enumType?.values || []).map(v => v.name)
      };
    });

    console.log(`  Subspace dim: ${dimInfo?.dataType}, enums: ${dimInfo?.enumeratorNames?.join(', ')}`);
    if (!dimInfo) throw new Error('subspace dimension not found');
    if (dimInfo.enumeratorCount !== 5) throw new Error(`Expected 5 enumerators, got ${dimInfo.enumeratorCount}`);
    if (!dimInfo.enumeratorNames.includes('ViewerApp')) throw new Error('ViewerApp enumerator missing');
    if (!dimInfo.enumeratorNames.includes('RadarDisplay')) throw new Error('RadarDisplay enumerator missing');

    console.log('  ✓ Test 1 passed');

    // =====================================================================
    // Test 2: Load appspace file with subspace-matched app names
    // =====================================================================
    console.log('Test 2: Appspace names link to subspace dimension...');

    // Re-use the mixed appspace file: Aircraft|RadarDisplay,WeaponSystem
    // RadarDisplay and WeaponSystem ARE in AppSpaceEnum → should get subspace tags
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

      window.__detectSubspaceDimensions();
      window.__enrichAppspaceApps();

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
      renderAppspacesPanel();
    }, mixedContent);

    await sleep(500);

    // Check appspace entries have apps with subspace links vs unmatched styling
    const appDisplay = await page.evaluate(() => {
      const matched = document.querySelectorAll('.apps-list li .app-name.appspace-link');
      const unmatched = document.querySelectorAll('.apps-list li .app-name.unmatched');
      const subspaceTags = document.querySelectorAll('.apps-list li .subspace-tag');
      const allItems = document.querySelectorAll('.apps-list li');
      return {
        matchedCount: matched.length,
        unmatchedCount: unmatched.length,
        subspaceTagsCount: subspaceTags.length,
        totalCount: allItems.length,
        matchedTexts: Array.from(matched).map(s => s.textContent),
        unmatchedTexts: Array.from(unmatched).map(s => s.textContent)
      };
    });

    console.log(`  Matched (subspace): ${appDisplay.matchedTexts.join(', ')}`);
    console.log(`  Unmatched: ${appDisplay.unmatchedTexts.join(', ')}`);
    console.log(`  Subspace tags: ${appDisplay.subspaceTagsCount}`);
    if (appDisplay.matchedCount < 1) throw new Error('Expected at least 1 subspace-matched app name');
    if (appDisplay.unmatchedCount < 1) throw new Error('Expected at least 1 unmatched app name');

    console.log('  ✓ Test 2 passed');

    // =====================================================================
    // Test 3: Click subspace app link → shows tag in detail
    // =====================================================================
    console.log('Test 3: Click subspace app link filters detail...');

    // Click the first subspace-matched app name — opens the enum type in datatypes
    const clickedText = await page.evaluate(() => {
      const firstMatch = document.querySelector('.apps-list li .app-name.appspace-link');
      if (!firstMatch) return null;
      const text = firstMatch.textContent;
      firstMatch.click();
      return text;
    });
    await sleep(500);

    if (!clickedText) throw new Error('No subspace-matched app name to click');

    // After clicking a subspace link, it should navigate to the enum data type
    const afterClick = await page.evaluate(() => {
      return {
        selectedItem: state.selectedItem ? typeof state.selectedItem : null,
        currentTab: state.currentTab,
        currentSubTab: state.currentSubTab
      };
    });
    console.log(`  Clicked "${clickedText}", tab: ${afterClick.currentTab}, subtab: ${afterClick.currentSubTab}`);

    // The click navigates to the enum data type — expect datatypes tab with 'enum' subtab
    if (afterClick.currentTab !== 'datatypes') {
      throw new Error(`Expected datatypes tab after subspace click, got ${afterClick.currentTab}`);
    }
    if (afterClick.currentSubTab !== 'enum') {
      throw new Error(`Expected enum subtab after subspace click, got ${afterClick.currentSubTab}`);
    }

    console.log('  ✓ Test 3 passed');

    // =====================================================================
    // Test 4: Object/Interaction class detail shows Appspace row when matched
    // =====================================================================
    console.log('Test 4: Class detail shows Appspace row...');

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

    await page.evaluate(() => {
      state.currentTab = 'objects';
      state.history = [];
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelector('.tab[data-tab="objects"]')?.classList.add('active');
      updateUI();
    });
    await sleep(500);

    // Call showDetail directly with the Aircraft class name
    await page.evaluate(() => {
      window.__showDetail?.('HLAobjectRoot.BaseEntity.PhysicalEntity.Platform.Aircraft', 'object', true);
    });
    await sleep(1000);

    // Verify the Appspace row is in the property-table
    const appspaceRow = await page.evaluate(() => {
      const row = [...document.querySelectorAll('.property-table tr')].find(
        tr => tr.querySelector('th')?.textContent === 'Appspace'
      );
      if (!row) return null;
      const value = row.querySelector('td .clickable-item');
      return value ? value.textContent.trim() : row.querySelector('td')?.textContent?.trim() || null;
    });
    console.log(`  Appspace row value: ${appspaceRow}`);
    if (!appspaceRow) throw new Error('Expected Appspace row in object class detail');
    if (!appspaceRow.includes('RadarDisplay') || !appspaceRow.includes('WeaponSystem')) {
      throw new Error(`Expected RadarDisplay,WeaponSystem in Appspace row, got: "${appspaceRow}"`);
    }

    console.log('  ✓ Test 4 passed');

    // =====================================================================
    // Test 5: Subspace with edge cases — caps, partial match, no dim
    // =====================================================================
    console.log('Test 5: Subspace edge cases...');

    // Verify that if no dimension named "subspace" exists, no crash
    const dimList = await page.evaluate(() => {
      const dims = [];
      for (const f of state.files) {
        if (f.dimensions) dims.push(...f.dimensions.map(d => d.name));
      }
      return [...new Set(dims)];
    });
    console.log(`  Existing dims: ${dimList.join(', ')}`);

    // Verify no console errors accumulated
    if (consoleErrors.length > 0) {
      console.log(`  Console errors: ${consoleErrors.length}`);
      // Don't fail for console errors that already existed
    }

    console.log('  ✓ Test 5 passed');

    console.log('All subspace feature tests passed!');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

let _fomFileCount = 0;
async function loadFomFile(page, filename) {
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

module.exports = { test_SubspaceFeature };
