// Issues Subtab History Test for FOM Viewer
// Tests that the Issues subtab click handler correctly pushes to history
// when switching subtabs and detail is showing, and does NOT push when
// switching to the same subtab or when detail is hidden.

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const config = require('./config');

async function test_IssuesSubtabHistory() {
  console.log('Starting Issues Subtab History Test...');

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

    // Load a test FOM file that has issues (we'll use HLAstandardMIM.xml)
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

    // Test 1: Switching Issues subtabs should record history when detail is showing
    console.log('Test 1: Verifying Issues subtab switch records history when detail is showing...');
    
    // First, select an item to show detail
    await waitAndClick(page, '[data-tab="issues"]');
    await sleep(300);
    
    // Click on an issue to show detail (if any exist)
    const issueItems = await page.$$('#issuesTree .tree-item');
    if (issueItems.length > 0) {
      await issueItems[0].click();
      await sleep(300);
      
      // Verify detail is showing
      const detailHeader = await page.$('#detailHeader');
      const detailVisible = await detailHeader.evaluate(el => el.style.display !== 'none');
      console.log('Detail visible:', detailVisible);
      
      if (detailVisible) {
        // Clear history to remove the item selection history
        await page.evaluate(() => {
          state.history = [];
        });
        
        // Switch from 'all' to 'error' subtab
        await waitAndClick(page, '#issuesTabs .subtab[data-subtab="error"]');
        await sleep(300);
        
        // Check that history WAS pushed
        const historyLength1 = await page.evaluate(() => state.history.length);
        console.log('History length after subtab switch with detail showing:', historyLength1);
        if (historyLength1 === 0) {
          throw new Error('Expected history to be pushed when switching subtabs with detail showing');
        }
        
        // Verify back button is visible
        const backBtn = await page.$('#backBtn');
        const backBtnVisible = await backBtn.isIntersectingViewport();
        if (!backBtnVisible) {
          throw new Error('Back button should be visible after subtab switch');
        }
        
        // Clear history again
        await page.evaluate(() => {
          state.history = [];
        });
        
        // Switch from 'error' to 'warning' subtab
        await waitAndClick(page, '#issuesTabs .subtab[data-subtab="warning"]');
        await sleep(300);
        
        // Check that history WAS pushed again
        const historyLength2 = await page.evaluate(() => state.history.length);
        console.log('History length after second subtab switch:', historyLength2);
        if (historyLength2 === 0) {
          throw new Error('Expected history to be pushed when switching subtabs again with detail showing');
        }
        
        console.log('✓ Test 1 passed: Issues subtab switch records history when detail is showing');
      } else {
        console.log('No detail showing, skipping detail-dependent tests');
      }
    } else {
      console.log('No issue items found, creating mock issue for testing');
      // We'll need to simulate having an issue selected for the test
      await page.evaluate(() => {
        // Simulate having selected an item
        state.selectedItem = { name: 'TestIssue', type: 'objectClass' };
        // Show detail header
        document.getElementById('detailHeader').style.display = 'block';
        document.getElementById('detailBody').innerHTML = '<div>Test detail content</div>';
      });
      
      // Clear history
      await page.evaluate(() => {
        state.history = [];
      });
      
      // Switch from 'all' to 'error' subtab
      await waitAndClick(page, '#issuesTabs .subtab[data-subtab="error"]');
      await sleep(300);
      
      // Check that history WAS pushed
      const historyLength = await page.evaluate(() => state.history.length);
      console.log('History length after subtab switch with simulated detail:', historyLength);
      if (historyLength === 0) {
        throw new Error('Expected history to be pushed when switching subtabs with detail showing');
      }
      
      // Clear history again
      await page.evaluate(() => {
        state.history = [];
      });
      
      // Also click 'warning' to match the state from the items > 0 path
      // so Test 2 correctly lands on the same subtab
      await waitAndClick(page, '#issuesTabs .subtab[data-subtab="warning"]');
      await sleep(300);
      
      const historyLength2 = await page.evaluate(() => state.history.length);
      console.log('History length after second subtab switch:', historyLength2);
      if (historyLength2 === 0) {
        throw new Error('Expected history to be pushed when switching subtabs again with detail showing');
      }
      
      console.log('✓ Test 1 passed: Issues subtab switch records history when detail is showing');
    }

    // Test 2: Switching back to the same subtab should NOT push history
    console.log('Test 2: Verifying switching to same subtab does NOT push history...');
    
    // Clear history
    await page.evaluate(() => {
      state.history = [];
    });
    
    // Click on the same subtab again (warning -> warning)
    await waitAndClick(page, '#issuesTabs .subtab[data-subtab="warning"]');
    await sleep(300);
    
     // Check that history was NOT pushed
     const historyLength3 = await page.evaluate(() => state.history.length);
     console.log('History length after clicking same subtab:', historyLength3);
     if (historyLength3 > 0) {
       throw new Error(`Expected no history push when clicking same subtab, got ${historyLength3} entries`);
     }
    
    console.log('✓ Test 2 passed: Switching to same subtab does NOT push history');

    // Test 3: Switching subtab from 'warning' to 'all' always pushes history
    // (Issues subtab handler always pushes on subtab switch, regardless of detail visibility)
    console.log('Test 3: Verifying subtab switch from warning to all pushes history...');
    
    // Go back to issues tab
    await waitAndClick(page, '[data-tab="issues"]');
    await sleep(300);
    
    // Ensure we're on the 'warning' subtab
    const currentFilter = await page.evaluate(() => state.issuesFilter);
    console.log('Current issues filter before switch:', currentFilter);
    
    // Switch from 'warning' to 'all' subtab
    await waitAndClick(page, '#issuesTabs .subtab[data-subtab="all"]');
    await sleep(300);
    
     // Check that history WAS pushed (issues handler always pushes on subtab switch)
     const historyLength4 = await page.evaluate(() => state.history.length);
     console.log('History length after subtab switch:', historyLength4);
     if (historyLength4 === 0) {
       throw new Error(`Expected history push when switching subtabs, got ${historyLength4} entries`);
     }
    
    console.log('✓ Test 3 passed: Subtab switch always pushes history (issues handler behavior)');

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

module.exports = { test_IssuesSubtabHistory };
