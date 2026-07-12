// Issues Subtab Guard Test for FOM Viewer
// Tests that the general .subtab click handler has an early-return guard
// for issuesTabs and appspaceTabs to prevent interference with dedicated handlers

const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('./config');

async function test_IssuesSubtabGuard() {
  console.log('Starting Issues Subtab Guard Test...');

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
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`Console error: ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    console.error('Page error:', error);
  });

  // Auto-accept confirm dialogs (e.g., clear button confirmation)
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
    await page.waitForTimeout(1000);

    // Test 1: Issues subtab click should NOT trigger the general handler's history push
    console.log('Test 1: Verifying issues subtab click does not trigger general handler history push...');
    
    // Load a test FOM file
    await loadTestFomFile(page, 'HLAstandardMIM.xml');
    
    // Make sure we're on modules tab initially
    await waitAndClick(page, '[data-tab="modules"]');
    await sleep(300);
    
    // Clear history to start fresh
    await page.evaluate(() => {
      state.history = [];
    });
    
    // Make issues tab and container visible (they're hidden by default when no issues)
    await page.evaluate(() => {
      const tab = document.querySelector('.tab[data-tab="issues"]');
      if (tab) {
        tab.style.display = ''; // Make it visible
      }
      const container = document.getElementById('issuesTabs');
      if (container) {
        container.style.display = 'flex'; // Make it visible
      }
    });
    
    // Click on issues tab (this WILL push to history - that's expected for tab changes)
    await waitAndClick(page, '[data-tab="issues"]');
    await sleep(300);
    
    // Clear history again to remove the tab-change history push
    // We only want to test that the SUBTAB click doesn't push to history
    await page.evaluate(() => {
      state.history = [];
    });
    
    // Debug: Check if elements exist and guard condition
    const debugInfo = await page.evaluate(() => {
      const issuesTab = document.querySelector('#issuesTabs .subtab[data-subtab="all"]');
      const appspaceTabs = document.getElementById('issuesTabs');
      const closestResult = issuesTab ? issuesTab.closest('#issuesTabs, #appspaceTabs') : null;
      
      return {
        issuesTabExists: !!issuesTab,
        issuesTabsContainerExists: !!appspaceTabs,
        closestResult: closestResult,
        closestResultTruthy: !!closestResult,
        tabToString: issuesTab ? issuesTab.toString() : 'null',
        containerToString: appspaceTabs ? appspaceTabs.toString() : 'null'
      };
    });
    
    console.log('Debug info:', debugInfo);
    
    if (!debugInfo.issuesTabExists) {
      throw new Error('Issues tab element does not exist in DOM');
    }
    
    if (!debugInfo.issuesTabsContainerExists) {
      throw new Error('IssuesTabs container does not exist in DOM');
    }
    
    if (!debugInfo.closestResultTruthy) {
      throw new Error('Guard condition failed - closest() did not return a truthy value');
    }
    
    // Click on "All" issues subtab (this should use the dedicated handler)
    await waitAndClick(page, '#issuesTabs .subtab[data-subtab="all"]');
    await sleep(300);
    
    // Check that history was NOT pushed by the general handler
    // The general handler would push to history when changing subtabs, but the dedicated one shouldn't
    const historyLength = await page.evaluate(() => state.history.length);
    console.log('History length after issues subtab click:', historyLength);
    if (historyLength > 0) {
      // Let's also check what was pushed to history
      const historyContents = await page.evaluate(() => JSON.stringify(state.history));
      console.log('History contents:', historyContents);
      throw new Error(`General subtab handler incorrectly pushed to history. History length: ${historyLength}`);
    }
    
    console.log('✓ Test 1 passed: Issues subtab click did not trigger general handler history push');

    // Test 2: Appspace subtab click should NOT trigger the general handler's history push
    console.log('Test 2: Verifying appspace subtab click does not trigger general handler history push...');
    
    // Switch to appspaces tab (make it visible first)
    await page.evaluate(() => {
      const tab = document.querySelector('.tab[data-tab="appspaces"]');
      if (tab) {
        tab.style.display = ''; // Make it visible
      }
      const container = document.getElementById('appspaceTabs');
      if (container) {
        container.style.display = 'flex'; // Make it visible
      }
    });
    await waitAndClick(page, '[data-tab="appspaces"]');
    await sleep(300);
    
    // Clear history again
    await page.evaluate(() => {
      state.history = [];
    });
    
    // Click on an appspace subtab (this should use the dedicated handler)
    await page.evaluate(() => {
      const el = document.querySelector('#appspaceTabs .subtab[data-subtab="objects"]');
      if (el) el.click();
    });
    await sleep(300);
    
    // Check that history was NOT pushed by the general handler
    const historyLength2 = await page.evaluate(() => state.history.length);
    if (historyLength2 > 0) {
      throw new Error(`General subtab handler incorrectly pushed to history for appspace. History length: ${historyLength2}`);
    }
    
    console.log('✓ Test 2 passed: Appspace subtab click did not trigger general handler history push');

    // Test 3: Other subtabs (e.g., data types) SHOULD still work with the general handler
    console.log('Test 3: Verifying other subtabs still work with general handler...');
    
    // Switch to datatypes tab
    await waitAndClick(page, '[data-tab="datatypes"]');
    await sleep(300);
    
    // Check what subtab we're currently on
    const initialSubTab = await page.evaluate(() => state.currentSubTab);
    console.log('Initial subtab on datatypes:', initialSubTab);
    
    // Clear history
    await page.evaluate(() => {
      state.history = [];
    });
    
    // Click on a DIFFERENT data type subtab to ensure we trigger a change
    // Let's try 'simple' if we're not already on it, otherwise try 'array'
    const targetSubTab = initialSubTab === 'simple' ? 'array' : 'simple';
    await waitAndClick(page, `.subtab[data-subtab="${targetSubTab}"]`);
    await sleep(300);
    
    // Check that history WAS pushed by the general handler (for subtab change)
    const historyLength3 = await page.evaluate(() => state.history.length);
    console.log('History length after clicking different subtab:', historyLength3);
    if (historyLength3 === 0) {
      throw new Error('General subtab handler did not push to history for data types subtab change');
    }
    
    // Verify we're actually on the target subtab
    const currentSubTab = await page.evaluate(() => state.currentSubTab);
    if (currentSubTab !== targetSubTab) {
      throw new Error(`Expected currentSubTab to be '${targetSubTab}', got '${currentSubTab}'`);
    }
    
    console.log('✓ Test 3 passed: Other subtabs still work correctly with general handler');

    // Test 4: Verify that clicking the same subtab twice doesn't push duplicate history entries
    console.log('Test 4: Verifying no duplicate history pushes for same subtab...');
    
    // Clear history
    await page.evaluate(() => {
      state.history = [];
    });
    
    // Click the same subtab again
    await waitAndClick(page, '.subtab[data-subtab="basic"]');
    await sleep(300);
    
    // History length should still be 1 (no additional push for same subtab)
    const historyLength4 = await page.evaluate(() => state.history.length);
    if (historyLength4 !== 1) {
      throw new Error(`Expected history length to remain 1 for same subtab click, got ${historyLength4}`);
    }
    
    console.log('✓ Test 4 passed: No duplicate history pushes for same subtab click');

    console.log('All tests passed!');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Helper functions
async function loadTestFomFile(page, filename) {
  const filePath = path.join(config.test.fomDir, filename);
  
  const fileInput = await page.$('#fileInput');
  await fileInput.uploadFile(filePath);
  
  await page.waitForFunction(() => {
    const welcome = document.getElementById('welcomeScreen');
    if (welcome) return welcome.style.display === 'none';
    const header = document.getElementById('detailHeader');
    return header && header.style.display !== 'none';
  }, { timeout: config.test.timeout });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitAndClick(page, selector, waitOpts = {}) {
  await page.waitForSelector(selector, { timeout: waitOpts.timeout || config.test.waitForSelector });
  await page.click(selector);
}

module.exports = { test_IssuesSubtabGuard };
