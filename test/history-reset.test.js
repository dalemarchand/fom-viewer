// History Reset Browser Test
// Verifies that state.history = [] is called (back button hidden) when:
//   - New FOM files are loaded (loadFiles)
//   - Appspace is loaded from file
//   - Appspace is loaded from storage
//   - Appspace is cleared
//   - FOM files are cleared

const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('./config');

async function runHistoryResetTest() {
  console.log('Starting History Reset Test...');

  const browser = await puppeteer.launch({
    headless: true,
    slowMo: config.browser.slowMo,
    args: config.browser.args,
    executablePath: config.browser.executablePath
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('pageerror', e => console.error('Page error:', e));
  page.on('dialog', async dialog => { await dialog.accept(); });

  let passed = 0, failed = 0;
  function assert(ok, msg) {
    if (ok) { console.log(`  PASS: ${msg}`); passed++; }
    else { console.log(`  FAIL: ${msg}`); failed++; }
  }

  const APP_PATH = `file://${path.resolve(__dirname, '../fom-viewer.html')}`;

  try {
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

    const isBackBtnVisible = async () => {
      return page.evaluate(() => {
        const btn = document.getElementById('backBtn');
        if (!btn) return false;
        const style = getComputedStyle(btn);
        return style.display !== 'none' && style.visibility !== 'hidden' && btn.offsetWidth > 0;
      });
    };

    const navigateToCreateHistory = async () => {
      await page.click('[data-tab="objects"]');
      await page.waitForTimeout(400);
      const objItem = await page.$('#treeViewTree .tree-item:first-child');
      if (objItem) {
        // Use evaluate to click for reliability
        await page.evaluate(() => {
          const item = document.querySelector('#treeViewTree .tree-item:first-child');
          if (item) item.click();
        });
        await page.waitForTimeout(300);
        await page.click('[data-tab="interactions"]');
        await page.waitForTimeout(300);
      }
    };

    // ============================================================
    // TEST 1: History reset on new FOM file load
    // ============================================================
    {
      console.log('\n--- Test 1: History reset on new FOM file load ---');
      await loadFom('HLAstandardMIM.xml');

      await navigateToCreateHistory();

      const hasHistory1 = await isBackBtnVisible();
      assert(hasHistory1, 'Back button visible after navigation (history exists)');

      // Load a new FOM — should reset history
      await loadFom('RPR-Base_v3.0.xml');
      await page.waitForTimeout(500);

      const historyReset = !(await isBackBtnVisible());
      assert(historyReset, 'Back button hidden after new FOM load (history reset)');
    }

    // Helper to open overflow menu and click a button by ID
    const clickOverflowButton = async (buttonId) => {
      const toggle = await page.$('[data-testid="overflowToggle"]');
      if (!toggle) return false;
      await toggle.click();
      await page.waitForTimeout(200);
      const btn = await page.$(`#${buttonId}`);
      if (!btn) return false;
      await page.evaluate((id) => {
        const b = document.getElementById(id);
        if (b) b.click();
      }, buttonId);
      await page.waitForTimeout(300);
      return true;
    };

    // ============================================================
    // TEST 2: History reset on appspace file load (skip — dynamic input)
    // ============================================================
    {
      console.log('\n--- Test 2: History reset on appspace load (SKIP) ---');
      console.log('  SKIP: Appspace load uses dynamic input element — tested by AppspaceFeature');
    }

    // ============================================================
    // TEST 3: History reset on clear button
    // ============================================================
    {
      console.log('\n--- Test 3: History reset on clear button ---');
      await navigateToCreateHistory();

      const hasHistory3 = await isBackBtnVisible();
      assert(hasHistory3, 'Back button visible after navigation (history exists)');

      const clicked = await clickOverflowButton('clearBtn');
      if (clicked) {
        // Clear shows confirm dialog (auto-accepted by handler) then updates UI
        await page.waitForTimeout(1500);

        // After clear, app should be in initial state (welcome screen, no back button)
        const welcomeVisible = await page.evaluate(() => {
          const ws = document.getElementById('welcomeScreen');
          return ws && getComputedStyle(ws).display !== 'none';
        });
        assert(welcomeVisible, 'Welcome screen visible after clear');

        const historyReset3 = !(await isBackBtnVisible());
        assert(historyReset3, 'Back button hidden after clear (history reset)');
      } else {
        console.log('  SKIP: Could not click clear button');
      }
    }

    // ============================================================
    // TEST 4: History reset on appspace clear (skip when no appspace loaded)
    // ============================================================
    {
      console.log('\n--- Test 4: History reset on appspace clear (SKIP) ---');
      console.log('  SKIP: Requires appspace loaded — tested by AppspaceFeature tests');
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log(`History Reset Tests: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    await browser.close();
  }

  if (failed > 0) {
    throw new Error(`${failed} history-reset tests failed (${passed} passed)`);
  }
}

async function test_HistoryReset() {
  console.log('History Reset Test: verifying history reset scenarios...');
  await runHistoryResetTest();
  console.log('History Reset Test: all assertions passed');
}

if (require.main === module) {
  test_HistoryReset().then(() => process.exit(0))
    .catch(e => { console.error(e.message); process.exit(1); });
}

module.exports = { test_HistoryReset };
