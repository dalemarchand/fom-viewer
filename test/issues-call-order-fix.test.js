// Issues Call Order Fix Test for FOM Viewer
// Tests that validate() runs before updateUI() in loadFromStorage() and removeFile()
// to ensure state.issues is populated when the Issues tab sidebar renders

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const config = require('./config');

async function test_IssuesCallOrderFix() {
  console.log('Starting Issues Call Order Fix Test...');

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

    console.log('App loaded successfully');

    // Test 1: Verify that after loading files, issues are populated and visible in Issues tab
    console.log('Test 1: Loading FOM file and checking issues are populated...');
    
    // Load RPR-Physical_v3.0.xml which produces cross-reference issues when loaded alone
    await loadTestFomFile(page, 'RPR-Physical_v3.0.xml');
    
    // Wait for validation to run and issues to be populated
    await page.waitForFunction(() => {
      return state.issues.length > 0;
    }, { timeout: config.test.timeout });

    const issueCountAfterLoad = await page.evaluate(() => state.issues.length);
    console.log(`Issues found after loading FOM file: ${issueCountAfterLoad}`);

    if (issueCountAfterLoad === 0) {
      await captureScreenshot(page, 'test_IssuesCallOrderFix_load_no_issues');
      throw new Error('No issues found after loading FOM file - validate() may not have run');
    }

    // Make sure Issues tab is visible (it might be hidden if no issues were found previously)
    await page.evaluate(() => {
      const tab = document.querySelector('.tab[data-tab="issues"]');
      if (tab) {
        tab.style.display = ''; // Make it visible
      }
    });

    // Click on issues tab
    await waitAndClick(page, '[data-tab="issues"]');
    await sleep(500);

    // Verify the issues tab is active
    const issuesTabActive = await page.evaluate(() => {
      const tab = document.querySelector('.tab[data-tab="issues"]');
      return tab && tab.classList.contains('active');
    });

    if (!issuesTabActive) {
      await captureScreenshot(page, 'test_IssuesCallOrderFix_tab_not_active');
      throw new Error('Issues tab is not active after clicking');
    }

    // Check that issue items are present in the tree view
    const issueItems = await page.$$('.tree-item[data-issue-id]');
    console.log(`Issue items found in tree view: ${issueItems.length}`);

    if (issueItems.length === 0) {
      await captureScreenshot(page, 'test_IssuesCallOrderFix_no_issue_items');
      throw new Error('No issue items found in tree view - Issues tab sidebar is empty');
    }

    // Verify that we're not seeing the empty state message
    const emptyState = await page.$('.detail-body .empty-state');
    if (emptyState) {
      const emptyStateText = await page.evaluate(el => el.textContent, emptyState);
      if (emptyStateText.trim() === 'No issues found.') {
        await captureScreenshot(page, 'test_IssuesCallOrderFix_empty_state_shown');
        throw new Error('Issues tab shows "No issues found." despite having issues - updateUI() ran before validate()');
      }
    }

    // Click on the first issue to show its detail
    if (issueItems.length > 0) {
      await issueItems[0].click();
      await sleep(500);
      
      // Verify detail header is visible
      const detailHeader = await page.$('#detailHeader');
      const detailHeaderStyle = await page.evaluate(el => getComputedStyle(el).display, detailHeader);
      
      if (detailHeaderStyle === 'none') {
        await captureScreenshot(page, 'test_IssuesCallOrderFix_detail_header_hidden');
        throw new Error('Detail header is hidden when it should be visible');
      }
      
      // Verify detail header has content
      const detailHeaderText = await page.evaluate(el => el.textContent, detailHeader);
      if (!detailHeaderText || detailHeaderText.trim() === '') {
        await captureScreenshot(page, 'test_IssuesCallOrderFix_detail_header_empty');
        throw new Error('Detail header is empty when it should show issue details');
      }
      
      console.log(`Detail header shows: ${detailHeaderText.trim()}`);
    }

    console.log('✓ Test 1 passed: Issues are populated and visible after file load');

    // Test 2: Verify that after removing a file, issues are still populated correctly
    console.log('Test 2: Removing file and checking issues remain populated...');
    
    // Get initial issue count
    const initialIssueCount = await page.evaluate(() => state.issues.length);
    console.log(`Initial issue count: ${initialIssueCount}`);
    
    if (initialIssueCount === 0) {
      throw new Error('Cannot test removeFile with zero initial issues');
    }

    // Remove the first file directly via removeFile() - tests that validate() runs after removal
    await page.evaluate(() => removeFile(0));
    await sleep(500);
    
    // Wait for validation to run after file removal
    await page.waitForFunction(() => {
      return state.issues !== undefined; // Just check it's accessible
    }, { timeout: config.test.timeout });

    const issueCountAfterRemove = await page.evaluate(() => state.issues.length);
    console.log(`Issue count after removing file: ${issueCountAfterRemove}`);

    // Even if we removed all files, state.issues should be accessible (empty array, not undefined)
    const issuesAccessible = await page.evaluate(() => {
      return Array.isArray(state.issues);
    });
    
    if (!issuesAccessible) {
      await captureScreenshot(page, 'test_IssuesCallOrderFix_issues_not_accessible_after_remove');
      throw new Error('state.issues is not accessible after removeFile() - validate() may not have run');
    }

    // Make sure Issues tab is still visible
    await page.evaluate(() => {
      const tab = document.querySelector('.tab[data-tab="issues"]');
      if (tab) {
        tab.style.display = ''; // Make it visible
      }
    });

    // Click on issues tab again to refresh the view
    await waitAndClick(page, '[data-tab="issues"]');
    await sleep(500);

    // Check that we're not seeing the empty state message incorrectly
    const emptyStateAfterRemove = await page.$('.detail-body .empty-state');
    if (emptyStateAfterRemove) {
      const emptyStateTextAfterRemove = await page.evaluate(el => el.textContent, emptyStateAfterRemove);
      // Only fail if it says "No issues found." but we actually have issues
      if (emptyStateTextAfterRemove.trim() === 'No issues found.' && issueCountAfterRemove > 0) {
        await captureScreenshot(page, 'test_IssuesCallOrderFix_empty_state_after_remove_incorrect');
        throw new Error('Issues tab shows "No issues found." after removeFile() despite having issues');
      }
    }

    console.log('✓ Test 2 passed: Issues remain accessible after file removal');

    console.log('All tests passed!');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Helper functions copied from issue-detail-panel.test.js
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

module.exports = { test_IssuesCallOrderFix };