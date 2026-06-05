// Issues Subtab Empty State Test for FOM Viewer
// Tests that the issues subtab click handler shows appropriate empty-state messages
// instead of the welcome screen when files are loaded

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const config = require('./config');

async function test_IssuesSubtabEmptyState() {
  console.log('Starting Issues Subtab Empty State Test...');

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

    // Test 1: With FOM files loaded that have no issues, clicking an issues subtab shows "No issues found."
    console.log('Test 1: Loading FOM file and checking issues subtab empty state...');
    
    // Load a test FOM file (HLAstandardMIM.xml)
    await loadTestFomFile(page, 'HLAstandardMIM.xml');
    
    // Debug: Check state after file load
    const stateAfterLoad = await page.evaluate(() => {
      return {
        filesLength: state.files.length,
        issuesLength: state.issues.length,
        issuesFilter: state.issuesFilter,
        currentTab: state.currentTab
      };
    });
    console.log('State after loading HLAstandardMIM.xml:', stateAfterLoad);
    
    // Force the issues tab to be visible for testing (normally hidden when issues.length === 0)
    await page.evaluate(() => {
      const tab = document.querySelector('.tab[data-tab="issues"]');
      if (tab) {
        tab.style.display = ''; // Make it visible
      }
    });
    
    // Click on issues tab
    await waitAndClick(page, '[data-tab="issues"]');
    await sleep(500);
    
    // Click on "All" issues subtab
    await waitAndClick(page, '#issuesTabs .subtab[data-subtab="all"]');
    await sleep(500);
    
    // Check that welcome screen is hidden
    const welcomeScreen = await page.$('#welcomeScreen');
    const welcomeScreenStyle = await page.evaluate(el => getComputedStyle(el).display, welcomeScreen);
    if (welcomeScreenStyle !== 'none') {
      throw new Error('Welcome screen should be hidden when files are loaded');
    }
    
    // Check that detail header is hidden
    const detailHeader = await page.$('#detailHeader');
    const detailHeaderStyle = await page.evaluate(el => getComputedStyle(el).display, detailHeader);
    if (detailHeaderStyle !== 'none') {
      throw new Error('Detail header should be hidden when showing empty state');
    }
    
    // Check that empty state message is present
    const emptyState = await page.$('.detail-body .empty-state');
    if (!emptyState) {
      throw new Error('Empty state message should be present in detail body');
    }
    
    const emptyStateText = await page.evaluate(el => el.textContent, emptyState);
    if (emptyStateText.trim() !== 'No issues found.') {
      throw new Error(`Expected "No issues found." but got "${emptyStateText.trim()}"`);
    }
    
    console.log('✓ Test 1 passed: No issues found message displayed correctly');

    // Test 2: With FOM files loaded that have specific issues, switching to "Errors" subtab with no errors shows "No errors found."
    console.log('Test 2: Checking errors subtab empty state...');
    
    // Force the issues tab to be visible for testing (normally hidden when issues.length === 0)
    await page.evaluate(() => {
      const tab = document.querySelector('.tab[data-tab="issues"]');
      if (tab) {
        tab.style.display = ''; // Make it visible
      }
    });
    
    // Click on "Errors" issues subtab
    await waitAndClick(page, '#issuesTabs .subtab[data-subtab="error"]');
    await sleep(500);
    
    // Check that empty state message is present and correct for errors
    const emptyStateError = await page.$('.detail-body .empty-state');
    if (!emptyStateError) {
      throw new Error('Empty state message should be present in detail body for errors subtab');
    }
    
    const emptyStateErrorText = await page.evaluate(el => el.textContent, emptyStateError);
    if (emptyStateErrorText.trim() !== 'No errors found.') {
      throw new Error(`Expected "No errors found." but got "${emptyStateErrorText.trim()}"`);
    }
    
    console.log('✓ Test 2 passed: No errors found message displayed correctly');

    // Test 3: With no files loaded, clicking issues subtab still shows the welcome screen
    console.log('Test 3: Checking welcome screen shows when no files loaded...');
    
    // Clear files
    await waitAndClick(page, '#clearBtn');
    await sleep(500);
    
    // Wait for files to be cleared
    await page.waitForFunction(() => {
      return !document.querySelectorAll('.tree-item').length;
    }, { timeout: config.test.timeout });
    
    // Make tabs visible so we can interact
    await page.evaluate(() => {
      const tab = document.querySelector('.tab[data-tab="issues"]');
      if (tab) tab.style.display = '';
      const subtabs = document.getElementById('issuesTabs');
      if (subtabs) subtabs.style.display = '';
    });
    
    // Click on issues tab
    await waitAndClick(page, '[data-tab="issues"]');
    await sleep(500);
    
    // Click on "All" issues subtab
    await waitAndClick(page, '#issuesTabs .subtab[data-subtab="all"]');
    await sleep(500);
    
    // Check that welcome screen is visible
    const welcomeScreenAfterClear = await page.$('#welcomeScreen');
    const welcomeScreenStyleAfterClear = await page.evaluate(el => getComputedStyle(el).display, welcomeScreenAfterClear);
    if (welcomeScreenStyleAfterClear !== 'flex') {
      throw new Error('Welcome screen should be visible when no files are loaded');
    }
    
    // Check that detail header is hidden
    const detailHeaderAfterClear = await page.$('#detailHeader');
    const detailHeaderStyleAfterClear = await page.evaluate(el => getComputedStyle(el).display, detailHeaderAfterClear);
    if (detailHeaderStyleAfterClear !== 'none') {
      throw new Error('Detail header should be hidden when showing welcome screen');
    }
    
    console.log('✓ Test 3 passed: Welcome screen displayed correctly when no files loaded');

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
    return welcome && welcome.style.display === 'none';
  }, { timeout: config.test.timeout });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitAndClick(page, selector, waitOpts = {}) {
  await page.waitForSelector(selector, { timeout: waitOpts.timeout || config.test.waitForSelector });
  await page.click(selector);
}

module.exports = { test_IssuesSubtabEmptyState };