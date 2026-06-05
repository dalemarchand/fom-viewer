// Issue History Push Test for FOM Viewer
// Tests that clicking issues in sidebar properly pushes to history for back button navigation

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const config = require('./config');

async function test_IssueHistoryPush() {
  console.log('Starting Issue History Push Test...');

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

    console.log('App loaded successfully');

    // Wait for init() to complete (async storage load, etc.)
    await page.waitForTimeout(1000);

    // Load multiple RPR files that should produce attribute count conflicts
    await loadTestFomFile(page, 'RPR-Foundation_v3.0.xml');
    await loadTestFomFile(page, 'RPR-Physical_v3.0.xml');

    // Wait for validation to run and issues to be populated
    await page.waitForFunction(() => {
      return state.issues.length > 0;
    }, { timeout: config.test.timeout });

    const issueCount = await page.evaluate(() => state.issues.length);
    console.log(`Found ${issueCount} issues after loading files`);

    if (issueCount === 0) {
      await captureScreenshot(page, 'test_IssueHistoryPush_no_issues');
      throw new Error('No issues found after loading RPR files - cannot test issue history push');
    }

    // Navigate to Issues tab
    await waitAndClick(page, '[data-tab="issues"]');
    await sleep(500);

    // Verify the issues tab is active
    const issuesTabActive = await page.evaluate(() => {
      const tab = document.querySelector('.tab[data-tab="issues"]');
      return tab && tab.classList.contains('active');
    });

    if (!issuesTabActive) {
      await captureScreenshot(page, 'test_IssueHistoryPush_tab_not_active');
      throw new Error('Issues tab is not active after clicking');
    }

    // Get the first and second issues in the list
    const issueItems = await page.$$('.tree-item');
    if (issueItems.length < 2) {
      await captureScreenshot(page, 'test_IssueHistoryPush_not_enough_issues');
      throw new Error('Need at least 2 issue items to test history push');
    }

    const firstIssue = issueItems[0];
    const secondIssue = issueItems[1];

    // Get issue IDs for verification
    const firstIssueId = await firstIssue.evaluate(el => el.dataset.issueId);
    const secondIssueId = await secondIssue.evaluate(el => el.dataset.issueId);
    console.log(`First issue ID: ${firstIssueId}, Second issue ID: ${secondIssueId}`);

    // TEST 1: First click on issue (after coming from another tab with a prior selection)
    // should save the previous tab's selection to history and show the back button
    console.log('Test 1: First issue click should push to history (prior selection exists from previous tab)');
    await firstIssue.click();
    await sleep(500);

    // Check that back button IS visible — the guard state.selectedItem is truthy because
    // we navigated from Objects/Modules tab where a tree item was already selected
    const backBtnAfterFirstClick = await page.$('#backBtn');
    const backBtnVisibleAfterFirstClick = await backBtnAfterFirstClick.evaluate(el => el.style.display !== 'none');
    
    if (!backBtnVisibleAfterFirstClick) {
      await captureScreenshot(page, 'test_IssueHistoryPush_first_click_back_hidden');
      throw new Error('Back button should be visible after first issue click (prior selection exists from previous tab)');
    }
    console.log('✓ Back button correctly visible after first issue click');

    // Verify we're seeing the first issue details
    const detailHeaderAfterFirstClick = await page.$('#detailHeader');
    const headerVisibleAfterFirstClick = await detailHeaderAfterFirstClick.evaluate(el => el.style.display !== 'none');
    
    if (!headerVisibleAfterFirstClick) {
      await captureScreenshot(page, 'test_IssueHistoryPush_first_click_detail_hidden');
      throw new Error('Detail header not visible after first issue click');
    }
    console.log('✓ First issue details correctly displayed');

    // TEST 2: Clicking second issue should save current selection to history and show back button
    console.log('Test 2: Second click should push to history and show back button');
    await secondIssue.click();
    await sleep(500);

    // Back button should still be visible (new history entry added)
    const backBtnAfterSecondClick = await page.$('#backBtn');
    const backBtnVisibleAfterSecondClick = await backBtnAfterSecondClick.evaluate(el => el.style.display !== 'none');
    
    if (!backBtnVisibleAfterSecondClick) {
      await captureScreenshot(page, 'test_IssueHistoryPush_second_click_back_hidden');
      throw new Error('Back button should be visible after second issue click');
    }
    console.log('✓ Back button correctly visible after second issue click');

    // Verify we're seeing the second issue details
    const detailHeaderAfterSecondClick = await page.$('#detailHeader');
    const headerVisibleAfterSecondClick = await detailHeaderAfterSecondClick.evaluate(el => el.style.display !== 'none');
    
    if (!headerVisibleAfterSecondClick) {
      await captureScreenshot(page, 'test_IssueHistoryPush_second_click_detail_hidden');
      throw new Error('Detail header not visible after second issue click');
    }
    
    // Verify the currently displayed issue is the second one
    // Issues use state.selectedItem.name (not issueId) — see showIssueDetail line 1973
    const displayedIssueNameAfterSecondClick = await page.evaluate(() => {
      return window.state?.selectedItem?.name || '';
    });
    
    if (displayedIssueNameAfterSecondClick !== secondIssueId) {
      // Alternative: check if we can find the issue ID in the detail body
      const detailBodyContent = await page.evaluate(() => {
        const body = document.getElementById('detailBody');
        return body ? body.innerHTML : '';
      });
      
      if (!detailBodyContent.includes(secondIssueId)) {
        await captureScreenshot(page, 'test_IssueHistoryPush_wrong_issue_displayed');
        throw new Error(`Expected to see issue ${secondIssueId} but got different issue`);
      }
    }
    console.log('✓ Second issue details correctly displayed');

    // TEST 3: Clicking Back should restore the previous issue selection (first issue)
    console.log('Test 3: Back button should restore first issue selection');
    const backBtn = await page.$('#backBtn');
    
    // Verify state.selectedItem currently points to the second issue
    const currentIssueBeforeBack = await page.evaluate(() => window.state?.selectedItem?.name || '');
    console.log(`Currently showing issue: ${currentIssueBeforeBack}, expected to restore to: ${firstIssueId}`);
    
    await backBtn.click();
    await sleep(500);

    // Check that we're back to seeing the first issue details
    const detailHeaderAfterBack = await page.$('#detailHeader');
    const headerVisibleAfterBack = await detailHeaderAfterBack.evaluate(el => el.style.display !== 'none');
    
    if (!headerVisibleAfterBack) {
      await captureScreenshot(page, 'test_IssueHistoryPush_back_click_detail_hidden');
      throw new Error('Detail header not visible after clicking back button');
    }
    
    // Verify we're seeing the first issue details again
    // Issues use state.selectedItem.name (not issueId)
    const displayedIssueNameAfterBack = await page.evaluate(() => {
      return window.state?.selectedItem?.name || '';
    });
    
    if (displayedIssueNameAfterBack !== firstIssueId) {
      // Alternative check via detail body content
      const detailBodyContentAfterBack = await page.evaluate(() => {
        const body = document.getElementById('detailBody');
        return body ? body.innerHTML : '';
      });
      
      if (!detailBodyContentAfterBack.includes(firstIssueId)) {
        await captureScreenshot(page, 'test_IssueHistoryPush_back_did_not_restore_first');
        throw new Error(`Expected to see issue ${firstIssueId} after back but got ${displayedIssueIdAfterBack}`);
      }
    }
    console.log('✓ Back button correctly restored first issue selection');

    // TEST 4: After navigating back, clicking a different issue should save current state
    // Note: Element handles are stale after goBack() re-renders the tree, so re-query them
    console.log('Test 4: After back, clicking different issue should save state');
    
    // Re-query the second issue after back navigation (tree was re-rendered)
    const issueItemsAfterBack = await page.$$('.tree-item');
    if (issueItemsAfterBack.length < 2) {
      throw new Error('Need at least 2 issue items after back to test history push');
    }
    const secondIssueAfterBack = issueItemsAfterBack[1];
    
    await secondIssueAfterBack.click();
    await sleep(500);

    // Back button should be visible again
    const backBtnAfterThirdClick = await page.$('#backBtn');
    const backBtnVisibleAfterThirdClick = await backBtnAfterThirdClick.evaluate(el => el.style.display !== 'none');
    
    if (!backBtnVisibleAfterThirdClick) {
      await captureScreenshot(page, 'test_IssueHistoryPush_third_click_back_hidden');
      throw new Error('Back button should be visible after clicking issue when back history exists');
    }
    console.log('✓ Back button correctly visible after clicking issue with existing back history');

    // Verify we're seeing the second issue details again
    const detailHeaderAfterThirdClick = await page.$('#detailHeader');
    const headerVisibleAfterThirdClick = await detailHeaderAfterThirdClick.evaluate(el => el.style.display !== 'none');
    
    if (!headerVisibleAfterThirdClick) {
      await captureScreenshot(page, 'test_IssueHistoryPush_third_click_detail_hidden');
      throw new Error('Detail header not visible after third issue click');
    }
    
    const displayedIssueNameAfterThirdClick = await page.evaluate(() => {
      return window.state?.selectedItem?.name || '';
    });
    
    if (displayedIssueNameAfterThirdClick !== secondIssueId) {
      const detailBodyContentAfterThirdClick = await page.evaluate(() => {
        const body = document.getElementById('detailBody');
        return body ? body.innerHTML : '';
      });
      
      if (!detailBodyContentAfterThirdClick.includes(secondIssueId)) {
        await captureScreenshot(page, 'test_IssueHistoryPush_third_click_wrong_issue');
        throw new Error(`Expected to see issue ${secondIssueId} after third click`);
      }
    }
    console.log('✓ Third click correctly shows second issue details');

    console.log('Issue history push test passed');
    return true;
  } catch (error) {
    await captureScreenshot(page, 'test_IssueHistoryPush_failed');
    console.error('Issue history push test failed:', error);
    return false;
  } finally {
    await browser.close();
  }

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

  async function captureScreenshot(page, name) {
    const screenshotDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    const filepath = path.join(screenshotDir, `${name}.png`);
    await page.screenshot({ path: filepath });
    console.log(`Screenshot saved: ${filepath}`);
  }
}

// Run the test
if (require.main === module) {
  test_IssueHistoryPush()
    .then(success => {
      process.exitCode = success ? 0 : 1;
    })
    .catch(err => {
      console.error('Test harness failed:', err);
      process.exitCode = 1;
    });
}

module.exports = { test_IssueHistoryPush };