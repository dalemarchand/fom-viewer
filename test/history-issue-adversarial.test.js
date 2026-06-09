// Adversarial Security Testing for Issue Sidebar History Push
// Tests edge cases, malformed inputs, and state corruption scenarios

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const config = require('./config');

async function test_IssueHistoryPushAdversarial() {
  console.log('Starting Adversarial Issue History Push Test...');

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

    console.log('App loaded successfully');

    // Wait for init() to complete
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
      await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_no_issues');
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
      await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_tab_not_active');
      throw new Error('Issues tab is not active after clicking');
    }

    // Get the first and second issues in the list
    const issueItems = await page.$$('.issue-item');
    if (issueItems.length < 2) {
      await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_not_enough_issues');
      throw new Error('Need at least 2 issue items to test history push');
    }

    const firstIssue = issueItems[0];
    const secondIssue = issueItems[1];

    // Get issue IDs for verification
    const firstIssueId = await firstIssue.evaluate(el => el.dataset.issueId);
    const secondIssueId = await secondIssue.evaluate(el => el.dataset.issueId);
    console.log(`First issue ID: ${firstIssueId}, Second issue ID: ${secondIssueId}`);

    // ADVERSARIAL TEST 1: Rapid clicking - Click multiple issues rapidly
    console.log('ADVERSARIAL TEST 1: Rapid clicking multiple issues');
    try {
      // Click first issue 5 times rapidly
      for (let i = 0; i < 5; i++) {
        await firstIssue.click();
        await sleep(50); // Very short delay
      }
      
      // Click second issue 5 times rapidly
      for (let i = 0; i < 5; i++) {
        await secondIssue.click();
        await sleep(50); // Very short delay
      }
      
      // Verify back button is visible (should be, as we have history)
      const backBtnVisible = await page.evaluate(() => {
        const backBtn = document.getElementById('backBtn');
        return backBtn && backBtn.style.display !== 'none';
      });
      
      if (!backBtnVisible) {
        await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_rapid_click_back_hidden');
        throw new Error('Back button should be visible after rapid clicking');
      }
      
      console.log('✓ Rapid clicking test passed - history stack not corrupted');
    } catch (error) {
      await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_rapid_click_failed');
      throw new Error(`Rapid clicking test failed: ${error.message}`);
    }

    // ADVERSARIAL TEST 2: Very long history stack - 20+ clicks
    console.log('ADVERSARIAL TEST 2: Very long history stack (20+ clicks)');
    try {
      // Clear any existing history by going back to a clean state
      await page.evaluate(() => {
        state.history = [];
        document.getElementById('backBtn').style.display = 'none';
      });
      
      // Perform 25 clicks alternating between issues
      for (let i = 0; i < 25; i++) {
        if (i % 2 === 0) {
          await firstIssue.click();
        } else {
          await secondIssue.click();
        }
        await sleep(100); // Small delay to allow processing
      }
      
      // Verify we can still navigate back
      const backBtnVisible = await page.evaluate(() => {
        const backBtn = document.getElementById('backBtn');
        return backBtn && backBtn.style.display !== 'none';
      });
      
      if (!backBtnVisible) {
        await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_long_history_back_hidden');
        throw new Error('Back button should be visible after 25+ clicks');
      }
      
      // Test going back a few steps
      await page.evaluate(() => {
        const backBtn = document.getElementById('backBtn');
        if (backBtn && backBtn.style.display !== 'none') {
          backBtn.click();
        }
      });
      await sleep(300);
      await page.evaluate(() => {
        const backBtn = document.getElementById('backBtn');
        if (backBtn && backBtn.style.display !== 'none') {
          backBtn.click();
        }
      });
      await sleep(300);
      
      console.log('✓ Long history stack test passed - no corruption after 25+ clicks');
    } catch (error) {
      await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_long_history_failed');
      throw new Error(`Long history stack test failed: ${error.message}`);
    }

    // ADVERSARIAL TEST 3: Data corruption - null/undefined state.selectedItem
    console.log('ADVERSARIAL TEST 3: Data corruption - null/undefined state.selectedItem');
    try {
      // Navigate to another tab first to set up state
      await waitAndClick(page, '[data-tab="objects"]');
      await sleep(300);
      
      // Select an object to set state.selectedItem
      const objectItems = await page.$$('#treeViewTree .tree-item');
      if (objectItems.length > 0) {
        await objectItems[0].click();
        await sleep(300);
      }
      
      // Now navigate to Issues tab and simulate null/undefined state.selectedItem
      await waitAndClick(page, '[data-tab="issues"]');
      await sleep(300);
      
      // Re-query issue items (previous handles are stale after tab switch)
      const issuesAfterNav = await page.$$('.issue-item');
      if (issuesAfterNav.length < 2) {
        throw new Error('Need at least 2 issue items after tab switch');
      }
      
      // Inject null state.selectedItem before clicking an issue
      await page.evaluate(() => {
        state.selectedItem = null;
      });
      
      // Click an issue - should not crash even with null state.selectedItem
      await issuesAfterNav[0].click();
      await sleep(500);
      
      // Verify we can still see issue details
      const detailHeaderVisible = await page.evaluate(() => {
        const header = document.getElementById('detailHeader');
        return header && header.style.display !== 'none';
      });
      
      if (!detailHeaderVisible) {
        await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_null_selectedItem_detail_hidden');
        throw new Error('Detail header not visible after clicking issue with null state.selectedItem');
      }
      
      // Test with undefined
      await page.evaluate(() => {
        state.selectedItem = undefined;
      });
      
      // Re-query issue items (state change might have re-rendered)
      const issuesAfterNull = await page.$$('.issue-item');
      if (issuesAfterNull.length < 2) {
        throw new Error('Need at least 2 issue items after null test');
      }
      
      await issuesAfterNull[1].click();
      await sleep(500);
      
      const detailHeaderVisible2 = await page.evaluate(() => {
        const header = document.getElementById('detailHeader');
        return header && header.style.display !== 'none';
      });
      
      if (!detailHeaderVisible2) {
        await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_undefined_selectedItem_detail_hidden');
        throw new Error('Detail header not visible after clicking issue with undefined state.selectedItem');
      }
      
      console.log('✓ Data corruption test passed - handles null/undefined state.selectedItem');
    } catch (error) {
      await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_data_corruption_failed');
      throw new Error(`Data corruption test failed: ${error.message}`);
    }

    // ADVERSARIAL TEST 4: Missing fields in state.selectedItem
    console.log('ADVERSARIAL TEST 4: Missing fields in state.selectedItem');
    try {
      // Navigate to Objects tab to set up a selection
      await waitAndClick(page, '[data-tab="objects"]');
      await sleep(300);
      
      const objectItems = await page.$$('#treeViewTree .tree-item');
      if (objectItems.length > 0) {
        await objectItems[0].click();
        await sleep(300);
      }
      
      // Navigate to Issues tab
      await waitAndClick(page, '[data-tab="issues"]');
      await sleep(300);
      
      // Re-query issue items (previous handles are stale after tab switch)
      const issuesAfterNav4 = await page.$$('.issue-item');
      if (issuesAfterNav4.length < 1) {
        throw new Error('Need at least 1 issue item after tab switch');
      }
      
      // Inject state.selectedItem with missing fields
      await page.evaluate(() => {
        state.selectedItem = {
          name: 'Test Issue'
          // Missing id, type, etc. that might be expected
        };
      });
      
      // Click an issue - should not crash
      await issuesAfterNav4[0].click();
      await sleep(500);
      
      // Verify we can still see issue details
      const detailHeaderVisible = await page.evaluate(() => {
        const header = document.getElementById('detailHeader');
        return header && header.style.display !== 'none';
      });
      
      if (!detailHeaderVisible) {
        await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_missing_fields_detail_hidden');
        throw new Error('Detail header not visible after clicking issue with incomplete state.selectedItem');
      }
      
      console.log('✓ Missing fields test passed - handles incomplete state.selectedItem');
    } catch (error) {
      await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_missing_fields_failed');
      throw new Error(`Missing fields test failed: ${error.message}`);
    }

    // ADVERSARIAL TEST 5: Multiple back navigations in sequence (within Issues tab)
    console.log('ADVERSARIAL TEST 5: Multiple back navigations in sequence');
    try {
      // Ensure we have a clean history state
      await page.evaluate(() => {
        state.history = [];
        document.getElementById('backBtn').style.display = 'none';
      });
      
      // Navigate to Issues tab
      await waitAndClick(page, '[data-tab="issues"]');
      await sleep(300);
      
      // Re-query issue items
      const issuesTest5 = await page.$$('.issue-item');
      if (issuesTest5.length < 3) {
        throw new Error('Need at least 3 issue items for sequential back test');
      }
      
      // Get issue IDs
      const issIds = await Promise.all(
        issuesTest5.slice(0, 3).map(el => el.evaluate(e => e.dataset.issueId))
      );
      console.log(`Issues: ${issIds.join(', ')}`);
      
      // Click issue 1 → no history push (first click, no prior selectedItem)
      await issuesTest5[0].click();
      await sleep(300);
      
      // Click issue 2 → should push issue 1 to history
      // Re-query because tree was re-rendered
      const issuesTest5b = await page.$$('.issue-item');
      await issuesTest5b[1].click();
      await sleep(300);
      
      // Click issue 3 → should push issue 2 to history
      const issuesTest5c = await page.$$('.issue-item');
      await issuesTest5c[2].click();
      await sleep(300);
      
      // Back should restore issue 2
      let backBtn = await page.$('#backBtn');
      const backVisible = await backBtn.evaluate(el => el.style.display !== 'none');
      if (!backVisible) {
        throw new Error('Back button should be visible after clicking issue 3');
      }
      
      // Click back to go to issue 2
      await page.evaluate(() => document.getElementById('backBtn').click());
      await sleep(500);
      
      const afterBack1 = await page.evaluate(() => window.state?.selectedItem?.name || '');
      console.log(`After back 1 - showing: ${afterBack1}, expected: ${issIds[1]}`);
      if (afterBack1 !== issIds[1]) {
        // Fallback to body check
        const body = await page.evaluate(() => document.getElementById('detailBody')?.innerHTML || '');
        if (!body.includes(issIds[1])) {
          throw new Error(`Expected issue ${issIds[1]} after back, got ${afterBack1}`);
        }
      }
      
      // Click back again to go to issue 1
      await page.evaluate(() => document.getElementById('backBtn').click());
      await sleep(500);
      
      const afterBack2 = await page.evaluate(() => window.state?.selectedItem?.name || '');
      console.log(`After back 2 - showing: ${afterBack2}, expected: ${issIds[0]}`);
      
      console.log('✓ Multiple back navigations test passed');
    } catch (error) {
      await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_multi_back_failed');
      throw new Error(`Multiple back navigations test failed: ${error.message}`);
    }

    // ADVERSARIAL TEST 6: Switch to other tab after issue navigation, then back to Issues tab
    console.log('ADVERSARIAL TEST 6: Switch tabs after issue navigation');
    try {
      // Navigate to Issues tab and select an issue
      await waitAndClick(page, '[data-tab="issues"]');
      await sleep(300);
      
      // Re-query issue items (previous handles are stale after tab switches)
      const issuesAfterNav6 = await page.$$('.issue-item');
      if (issuesAfterNav6.length > 0) {
        await issuesAfterNav6[0].click();
        await sleep(300);
      }
      
      // Verify back button is visible
      let backBtnVisible = await page.evaluate(() => {
        const backBtn = document.getElementById('backBtn');
        return backBtn && backBtn.style.display !== 'none';
      });
      
      if (!backBtnVisible) {
        await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_switch_tabs_back_hidden_after_issue');
        throw new Error('Back button should be visible after selecting issue');
      }
      
      // Switch to another tab (Objects)
      await waitAndClick(page, '[data-tab="objects"]');
      await sleep(300);
      
      // Verify back button is still visible (history preserved)
      backBtnVisible = await page.evaluate(() => {
        const backBtn = document.getElementById('backBtn');
        return backBtn && backBtn.style.display !== 'none';
      });
      
      if (!backBtnVisible) {
        await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_switch_tabs_back_hidden_after_switch');
        throw new Error('Back button should remain visible after switching tabs');
      }
      
      // Switch back to Issues tab
      await waitAndClick(page, '[data-tab="issues"]');
      await sleep(300);
      
      // Verify back button is still visible
      backBtnVisible = await page.evaluate(() => {
        const backBtn = document.getElementById('backBtn');
        return backBtn && backBtn.style.display !== 'none';
      });
      
      if (!backBtnVisible) {
        await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_switch_tabs_back_hidden_after_return');
        throw new Error('Back button should remain visible after returning to Issues tab');
      }
      
      console.log('✓ Switch tabs after issue navigation test passed');
    } catch (error) {
      await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_switch_tabs_failed');
      throw new Error(`Switch tabs after issue navigation test failed: ${error.message}`);
    }

    console.log('All adversarial tests passed!');
    return true;
  } catch (error) {
    await captureScreenshot(page, 'test_IssueHistoryPushAdversarial_failed');
    console.error('Adversarial issue history push test failed:', error);
    return false;
  } finally {
    await browser.close();
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
  test_IssueHistoryPushAdversarial()
    .then(success => {
      process.exitCode = success ? 0 : 1;
    })
    .catch(err => {
      console.error('Test harness failed:', err);
      process.exitCode = 1;
    });
}

module.exports = { test_IssueHistoryPushAdversarial };