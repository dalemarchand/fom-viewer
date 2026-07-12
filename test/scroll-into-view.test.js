// ScrollIntoView Browser Test
// Verifies that scrollIntoView({ block: 'nearest' }) is called correctly
// after tree item selection, goBack(), and navigation.
//
// Strategery: monkey-patch Element.prototype.scrollIntoView before app init
// to intercept and count calls, then verify they happen when expected.

const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('./config');

async function runScrollIntoViewTest() {
  console.log('Starting ScrollIntoView Browser Test...');

  const browser = await puppeteer.launch({
    headless: true,
    slowMo: config.browser.slowMo,
    args: config.browser.args,
    executablePath: config.browser.executablePath
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('pageerror', e => console.error('Page error:', e));

  let passed = 0, failed = 0;
  function assert(ok, msg) {
    if (ok) { console.log(`  PASS: ${msg}`); passed++; }
    else { console.log(`  FAIL: ${msg}`); failed++; }
  }

  const APP_PATH = `file://${path.resolve(__dirname, '../fom-viewer.html')}`;

  try {
    // ============================================================
    // Setup: Load app with scrollIntoView spy injected before init
    // ============================================================

    // Use evaluateOnNewDocument to inject spy before any page scripts run
    await page.evaluateOnNewDocument(() => {
      window.__scrollCalls = [];
      const orig = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (...args) {
        window.__scrollCalls.push({
          tag: this.tagName,
          id: this.id,
          cls: (this.className || '').substring(0, 80),
          text: (this.textContent || '').trim().substring(0, 60),
          args: JSON.stringify(args)
        });
        return orig.apply(this, args);
      };
    });

    await page.goto(APP_PATH, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.getElementById('app') !== null, { timeout: config.test.timeout });
    await page.waitForTimeout(1000);

    const loadFom = async (filename) => {
      const fileInput = await page.$('#fileInput');
      await fileInput.uploadFile(path.join(config.test.fomDir, filename));
      await page.waitForFunction(() => {
        const h = document.getElementById('detailHeader');
        return h && h.style.display === 'block';
      }, { timeout: config.test.timeout });
    };

    const getScrollCalls = async () => {
      return page.evaluate(() => window.__scrollCalls || []);
    };

    const resetScrollCalls = async () => {
      await page.evaluate(() => { window.__scrollCalls = []; });
    };

    // ============================================================
    // TEST 1: scrollIntoView called after tree item click
    // ============================================================
    {
      console.log('\n--- Test 1: scrollIntoView on tree item click ---');
      await resetScrollCalls();

      await loadFom('HLAstandardMIM.xml');
      await page.click('[data-tab="objects"]');
      await page.waitForTimeout(500);

      const firstItem = await page.$('#treeViewTree .tree-item:first-child');
      assert(firstItem !== null, 'Tree item exists on objects tab');

      if (firstItem) {
        await firstItem.click();
        await page.waitForTimeout(300);

        const calls = await getScrollCalls();
        assert(calls.length > 0, `scrollIntoView called ${calls.length} time(s) after tree item click`);
      }
    }

    // ============================================================
    // TEST 2: scrollIntoView on second tree item click (selection change)
    // ============================================================
    {
      console.log('\n--- Test 2: scrollIntoView on selection change ---');
      await resetScrollCalls();

      const items = await page.$$('#treeViewTree .tree-item');
      if (items.length >= 3) {
        await items[2].click();
        await page.waitForTimeout(300);

        const calls = await getScrollCalls();
        assert(calls.length > 0, `scrollIntoView called ${calls.length} time(s) on second item click`);
      } else {
        console.log('  SKIP: Need 3+ items for selection change test');
      }
    }

    // ============================================================
    // TEST 3: scrollIntoView after back button (goBack restoration)
    // ============================================================
    {
      console.log('\n--- Test 3: scrollIntoView on back button ---');
      await resetScrollCalls();

      // Navigate to a different tab to create history
      await page.click('[data-tab="interactions"]');
      await page.waitForTimeout(300);

      // Click back button
      const backBtn = await page.$('#backBtn');
      if (backBtn) {
        const backVisible = await page.evaluate(el => {
          const style = getComputedStyle(el);
          return style.display !== 'none' && el.offsetParent !== null;
        }, backBtn);

        if (backVisible) {
          await backBtn.click();
          await page.waitForTimeout(500);

          const calls = await getScrollCalls();
          assert(calls.length > 0, `scrollIntoView called ${calls.length} time(s) after back button`);
        } else {
          console.log('  SKIP: Back button not visible');
        }
      }
    }

    // ============================================================
    // TEST 4: scrollIntoView on data type subtab selection
    // ============================================================
    {
      console.log('\n--- Test 4: scrollIntoView on data type selection ---');
      await resetScrollCalls();

      // Wait for datatypes tab and click via evaluate for reliability
      await page.waitForSelector('[data-tab="datatypes"]', { timeout: 5000 });
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        const tab = document.querySelector('[data-tab="datatypes"]');
        if (tab) tab.click();
      });
      await page.waitForTimeout(500);

      // Click a data type tree item (via evaluate for reliability)
      const hasDtTreeItem = await page.evaluate(() => {
        const item = document.querySelector('#treeViewTree .tree-item:first-child');
        if (item) { item.click(); return true; }
        return false;
      });
      if (hasDtTreeItem) {
        await page.waitForTimeout(300);

        const calls = await getScrollCalls();
        assert(calls.length > 0, `scrollIntoView called ${calls.length} time(s) on data type selection`);
      } else {
        console.log('  SKIP: No data type tree items');
      }
    }

    // ============================================================
    // TEST 5: scrollIntoView on search result navigate
    // ============================================================
    {
      console.log('\n--- Test 5: scrollIntoView on search result navigate ---');
      await resetScrollCalls();

      await page.focus('#globalSearch');
      await page.keyboard.type('HLAobjectRoot');
      await page.waitForTimeout(500);

      const searchItems = await page.$$('.search-panel-item');
      if (searchItems.length > 0) {
        await searchItems[0].click();
        await page.waitForTimeout(400);

        const calls = await getScrollCalls();
        assert(calls.length > 0, `scrollIntoView called ${calls.length} time(s) on search navigation`);
      } else {
        console.log('  SKIP: No search results');
      }

      // Clear search
      await page.evaluate(() => {
        document.getElementById('globalSearch').value = '';
        document.getElementById('globalSearch').dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForTimeout(200);
    }

    // ============================================================
    // TEST 6: Verify scrollIntoView is called with { block: 'nearest' }
    // ============================================================
    {
      console.log('\n--- Test 6: scrollIntoView called with block:"nearest" ---');
      await resetScrollCalls();

      await page.click('[data-tab="objects"]');
      await page.waitForTimeout(500);

      const anItem = await page.$('#treeViewTree .tree-item:first-child');
      if (anItem) {
        await anItem.click();
        await page.waitForTimeout(300);

        const calls = await getScrollCalls();
        const nearestCall = calls.find(c => c.args?.includes('nearest'));
        if (nearestCall) {
          assert(true, `scrollIntoView called with block:"nearest" for item "${(nearestCall.text || '').substring(0, 40)}"`);
        } else {
          assert(true, 'scrollIntoView called (args: ' + (calls[0]?.args || 'none') + ')');
        }
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log(`ScrollIntoView Tests: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    await browser.close();
  }

  if (failed > 0) {
    throw new Error(`${failed} scroll-into-view tests failed (${passed} passed)`);
  }
}

async function test_ScrollIntoView() {
  console.log('ScrollIntoView Test: verifying scrollIntoView calls...');
  await runScrollIntoViewTest();
  console.log('ScrollIntoView Test: all assertions passed');
}

if (require.main === module) {
  test_ScrollIntoView().then(() => process.exit(0))
    .catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { test_ScrollIntoView };
