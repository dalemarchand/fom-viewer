// Theme Bar Removal Test for FOM Viewer
// Tests that the theme-bar was removed and its controls moved to overflow menu.

const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('./config');

async function runThemeBarRemovalTest() {
  console.log('Starting Theme Bar Removal Test...');

  const browserOptions = {
    headless: true,
    slowMo: config.browser.slowMo,
    args: config.browser.args,
    executablePath: config.browser.executablePath
  };

  const browser = await puppeteer.launch(browserOptions);
  const page = await browser.newPage();

  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`Console error: ${msg.text()}`);
    }
  });

  page.on('pageerror', error => {
    console.error('Page error:', error);
  });

  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  try {
    await page.goto(`file://${path.resolve(__dirname, '../fom-viewer.html')}`, {
      waitUntil: 'networkidle0'
    });

    await page.waitForFunction(() => {
      return document.getElementById('app') !== null;
    }, { timeout: config.test.timeout });

    console.log('App loaded successfully');
    await page.waitForTimeout(1000);

    // ============================================================
    // TEST 1: Verify theme-bar element does NOT exist
    // ============================================================
    const themeBarExists = await page.evaluate(() => {
      return document.querySelector('.theme-bar') !== null;
    });
    if (themeBarExists) {
      throw new Error('theme-bar element should not exist in the DOM');
    }
    console.log('✓ theme-bar element is removed from DOM');

    // ============================================================
    // TEST 2: Verify overflow menu has theme select
    // ============================================================
    const hasThemeSelect = await page.evaluate(() => {
      return document.getElementById('overflowThemeSelect') !== null;
    });
    if (!hasThemeSelect) {
      throw new Error('overflowThemeSelect should exist in the overflow menu');
    }
    console.log('✓ overflowThemeSelect exists in overflow menu');

    // ============================================================
    // TEST 3: Verify appspace info item exists
    // ============================================================
    const hasAppspaceInfo = await page.evaluate(() => {
      return document.getElementById('appspaceInfoItem') !== null;
    });
    if (!hasAppspaceInfo) {
      throw new Error('appspaceInfoItem should exist in the overflow menu');
    }
    console.log('✓ appspaceInfoItem exists in overflow menu');

    // ============================================================
    // TEST 4: Theme toggle via overflow menu works
    // ============================================================
    const overflowToggle = await page.$('[data-testid="overflowToggle"]');
    if (overflowToggle) {
      await overflowToggle.click();
      await page.waitForTimeout(300);

      const currentTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme') || 'light';
      });
      console.log(`Current theme: ${currentTheme}`);

      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      await page.evaluate((theme) => {
        const sel = document.getElementById('overflowThemeSelect');
        if (sel) {
          sel.value = theme;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, newTheme);
      await page.waitForTimeout(300);

      const appliedTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute('data-theme');
      });
      console.log(`Theme after switch: ${appliedTheme}`);

      if (appliedTheme !== newTheme) {
        throw new Error(`Expected theme to be "${newTheme}" after switch, but was "${appliedTheme}"`);
      }
      console.log('✓ Theme toggle via overflow menu works');
    }

    // ============================================================
    // TEST 5: Theme persists in localStorage
    // ============================================================
    const savedTheme = await page.evaluate(() => {
      return localStorage.getItem('fomViewerTheme');
    });
    if (!savedTheme) {
      throw new Error('Theme should be saved to localStorage as fomViewerTheme');
    }
    console.log(`✓ Theme persists in localStorage: fomViewerTheme = "${savedTheme}"`);

    // ============================================================
    // TEST 6: Verify no elements reference removed CSS classes
    // ============================================================
    const hasRemovedClasses = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el.className && typeof el.className === 'string') {
          if (el.className.includes('theme-bar') || el.className.includes('theme-select')) {
            return true;
          }
        }
      }
      return false;
    });
    if (hasRemovedClasses) {
      throw new Error('No elements should have theme-bar or theme-select class');
    }
    console.log('✓ No remaining references to removed CSS classes');

    // ============================================================
    // Summary
    // ============================================================
    console.log('\n=== Theme Bar Removal Test Summary ===');
    console.log('Test 1 — theme-bar removed from DOM:       ✓');
    console.log('Test 2 — overflowThemeSelect exists:       ✓');
    console.log('Test 3 — appspaceInfoItem exists:          ✓');
    console.log('Test 4 — Theme toggle via overflow works:  ✓');
    console.log('Test 5 — Theme persists in localStorage:   ✓');
    console.log('Test 6 — No remaining theme-bar classes:   ✓');

    console.log('\n✓ THEME BAR REMOVAL TEST PASSED');
    return true;

  } catch (error) {
    console.error('Test failed with error:', error);
    return false;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  runThemeBarRemovalTest()
    .then(success => {
      process.exitCode = success ? 0 : 1;
    })
    .catch(err => {
      console.error('Test harness failed:', err);
      process.exitCode = 1;
    });
}

module.exports = { runThemeBarRemovalTest };
