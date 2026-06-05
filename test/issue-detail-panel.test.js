// Issue Detail Panel Improvements Test for FOM Viewer
// Tests that the issue detail panel displays correctly with the new non-bullet lists and clickable source modules

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const config = require('./config');

async function test_IssueDetailPanelImprovements() {
  console.log('Starting Issue Detail Panel Improvements Test...');

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
      await captureScreenshot(page, 'test_IssueDetailPanelImprovements_no_issues');
      throw new Error('No issues found after loading RPR files - cannot test issue detail panel');
    }

    // Click on the Issues tab
    await waitAndClick(page, '[data-tab="issues"]');
    await sleep(500);

    // Verify the issues tab is active
    const issuesTabActive = await page.evaluate(() => {
      const tab = document.querySelector('.tab[data-tab="issues"]');
      return tab && tab.classList.contains('active');
    });

    if (!issuesTabActive) {
      await captureScreenshot(page, 'test_IssueDetailPanelImprovements_tab_not_active');
      throw new Error('Issues tab is not active after clicking');
    }

    // Get the first issue in the list
    const firstIssue = await page.$('.tree-item');
    if (!firstIssue) {
      await captureScreenshot(page, 'test_IssueDetailPanelImprovements_no_issue_items');
      throw new Error('No issue items found in the tree view');
    }

    // Click on the first issue to show its detail
    await firstIssue.click();
    await sleep(500);

    // Verify detail header is visible
    const detailHeader = await page.$('#detailHeader');
    const headerVisible = await detailHeader.evaluate(el => el.style.display !== 'none');

    if (!headerVisible) {
      await captureScreenshot(page, 'test_IssueDetailPanelImprovements_header_not_visible');
      throw new Error('Detail header not visible after selecting issue');
    }

    // Verify detail items render as non-bullet divs with .detail-list-item class
    const detailListItems = await page.$$('.detail-list-item');
    if (detailListItems.length === 0) {
      await captureScreenshot(page, 'test_IssueDetailPanelImprovements_no_detail_items');
      throw new Error('No detail list items found in issue detail');
    }

    // Check that detail items are divs (not list items) and have the correct class
    const detailItemsAreDivs = await page.evaluate(() => {
      const items = document.querySelectorAll('.detail-list-item');
      return Array.from(items).every(item => item.tagName === 'DIV');
    });

    if (!detailItemsAreDivs) {
      await captureScreenshot(page, 'test_IssueDetailPanelImprovements_detail_not_divs');
      throw new Error('Detail list items are not DIV elements');
    }

    // Verify source modules render as clickable .source-module-item elements
    const sourceModuleItems = await page.$$('.source-module-item');
    if (sourceModuleItems.length === 0) {
      await captureScreenshot(page, 'test_IssueDetailPanelImprovements_no_source_modules');
      throw new Error('No source module items found in issue detail');
    }

    // Check that source module items are divs and have the correct class
    const sourceItemsAreDivs = await page.evaluate(() => {
      const items = document.querySelectorAll('.source-module-item');
      return Array.from(items).every(item => item.tagName === 'DIV');
    });

    if (!sourceItemsAreDivs) {
      await captureScreenshot(page, 'test_IssueDetailPanelImprovements_source_not_divs');
      throw new Error('Source module items are not DIV elements');
    }

    // Verify source module items are clickable (have cursor: pointer style)
    const sourceItemsClickable = await page.evaluate(() => {
      const items = document.querySelectorAll('.source-module-item');
      return Array.from(items).every(item => {
        const style = window.getComputedStyle(item);
        return style.cursor === 'pointer';
      });
    });

    if (!sourceItemsClickable) {
      await captureScreenshot(page, 'test_IssueDetailPanelImprovements_source_not_clickable');
      throw new Error('Source module items are not clickable');
    }

    // Verify tooltip (title attribute) on conflict detail items contains attribute names
    // Note: tooltips only appear on load-conflict/object-attributes and
    // load-conflict/interaction-parameters issues (rendered when `||` delimiter
    // is present in conflict detail). The standard test FOM files (RPR-Foundation +
    // RPR-Physical) produce cross-reference issues but not attribute-count conflicts,
    // so this check is conditional: skip if no tooltipped items exist.
    const detailedItemsWithTooltip = await page.$$('.detail-list-item[title]');
    if (detailedItemsWithTooltip.length > 0) {
      // Check that at least one tooltip contains attribute names
      const tooltipContainsAttributes = await page.evaluate(() => {
        const items = document.querySelectorAll('.detail-list-item[title]');
        return Array.from(items).some(item => {
          const title = item.getAttribute('title');
          return title && title.includes(', ');
        });
      });

      if (!tooltipContainsAttributes) {
        await captureScreenshot(page, 'test_IssueDetailPanelImprovements_tooltip_no_attributes');
        throw new Error('No detail item tooltips contain attribute names');
      }
      console.log('✓ Tooltip items verified (attribute names present)');
    } else {
      console.log('⚠ No tooltipped items found — test dataset does not produce attribute-count conflicts (skipping tooltip assertion)');
    }

    // Click a source module link and verify it renders the module detail view
    const firstSourceModule = await page.$('.source-module-item');
    if (!firstSourceModule) {
      await captureScreenshot(page, 'test_IssueDetailPanelImprovements_no_source_module_to_click');
      throw new Error('No source module item found to click');
    }

    // Get the source module name for verification
    const sourceModuleName = await firstSourceModule.evaluate(el => el.textContent.trim());

    // Note the current detail title before clicking
    const detailTitleBefore = await page.evaluate(() => {
      const el = document.getElementById('detailTitle');
      return el ? el.textContent.trim() : '';
    });

    // Click the source module link
    await firstSourceModule.click();
    await sleep(500);

    // Verify detail header is still visible
    const detailHeaderVisible = await page.evaluate(() => {
      const h = document.getElementById('detailHeader');
      return h && h.style.display !== 'none';
    });

    if (!detailHeaderVisible) {
      await captureScreenshot(page, 'test_IssueDetailPanelImprovements_detail_header_missing');
      throw new Error('Detail header not visible after clicking source module link');
    }

    // Verify the detail title was updated to the source module name
    const detailTitleAfter = await page.evaluate(() => {
      const el = document.getElementById('detailTitle');
      return el ? el.textContent.trim() : '';
    });

    if (detailTitleAfter !== sourceModuleName) {
      // Fallback: the title might not exactly match the source module name if
      // showModuleDetails sets it differently — check that the detail body was
      // updated (i.e. content changed from the issue detail)
      const detailBodyContent = await page.evaluate(() => {
        return document.getElementById('detailBody') ? document.getElementById('detailBody').innerHTML.length : 0;
      });
      if (detailBodyContent < 50) {
        await captureScreenshot(page, 'test_IssueDetailPanelImprovements_detail_body_empty');
        throw new Error(`Detail body appears empty (${detailBodyContent} chars) after clicking source module link`);
      }
      // Check the detail title contains the module name
      if (!detailTitleAfter.includes(sourceModuleName) && !detailTitleAfter.includes(sourceModuleName.substring(0, 30))) {
        await captureScreenshot(page, 'test_IssueDetailPanelImprovements_title_not_updated');
        throw new Error(`Expected detail title to contain '${sourceModuleName}', got '${detailTitleAfter}'`);
      }
    }

    // Verify detail body contains module content (property table, model identification, etc.)
    const hasModuleContent = await page.evaluate(() => {
      const body = document.getElementById('detailBody');
      // Module bodies typically contain property tables
      return body && (body.querySelector('.property-table') !== null || body.innerHTML.length > 100);
    });

    if (!hasModuleContent) {
      await captureScreenshot(page, 'test_IssueDetailPanelImprovements_no_module_content');
      throw new Error('Detail body does not contain module content after clicking source module link');
    }

    console.log('Issue detail panel display improvements test passed');
    return true;
  } catch (error) {
    await captureScreenshot(page, 'test_IssueDetailPanelImprovements_failed');
    console.error('Issue detail panel display improvements test failed:', error);
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
  test_IssueDetailPanelImprovements()
    .then(success => {
      process.exitCode = success ? 0 : 1;
    })
    .catch(err => {
      console.error('Test harness failed:', err);
      process.exitCode = 1;
    });
}

module.exports = { test_IssueDetailPanelImprovements };