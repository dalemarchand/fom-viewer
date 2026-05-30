// Welcome Screen Stats Test for FOM Viewer
// Tests that the welcome screen stats display correctly after file loading and clearing.

// NOTE: On initial page load, init() immediately hides welcomeScreen (display:none).
// The welcomeScreen only becomes visible after explicitly clearing files.
// welcomeStats starts hidden and only appears when FOM files are loaded.

const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('./config');

async function runWelcomeStatsTest() {
  console.log('Starting Welcome Screen Stats Test...');

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

    // ============================================================
    // STEP 1: Initial state — welcomeScreen hidden by init(),
    //         welcomeStats hidden (inline style)
    // ============================================================
    const initialState = await page.evaluate(() => {
      const welcomeScreen = document.getElementById('welcomeScreen');
      const welcomeStats = document.getElementById('welcomeStats');
      if (!welcomeScreen || !welcomeStats) {
        return { error: 'Missing DOM elements' };
      }
      const welcomeDisplay = window.getComputedStyle(welcomeScreen).display;
      const statsDisplay = window.getComputedStyle(welcomeStats).display;
      return { welcomeDisplay, statsDisplay };
    });

    console.log(`Initial state — welcomeScreen: "${initialState.welcomeDisplay}", welcomeStats: "${initialState.statsDisplay}"`);

    if (initialState.error) {
      throw new Error(`Initial DOM elements missing: ${initialState.error}`);
    }

    // welcomeStats should always start hidden
    if (initialState.statsDisplay !== 'none') {
      throw new Error(`Expected welcomeStats to be hidden initially, but display was "${initialState.statsDisplay}"`);
    }
    console.log('✓ welcomeStats starts hidden');

    // ============================================================
    // STEP 2: After loading FOM file
    // ============================================================
    console.log('Loading FOM file...');

    const fileInput = await page.$('#fileInput');
    const testFilePath = path.join(__dirname, 'fom', 'HLAstandardMIM.xml');
    await fileInput.uploadFile(testFilePath);

    // Wait for welcomeStats to be populated with 4 stat items
    // This properly synchronizes with loadFiles() → updateUI() → updateWelcomeStats()
    await page.waitForFunction(() => {
      const stats = document.getElementById('welcomeStats');
      if (!stats || window.getComputedStyle(stats).display === 'none') return false;
      return stats.querySelectorAll('.stat-item').length === 4;
    }, { timeout: config.test.timeout });

    console.log('FOM file loaded and stats displayed');

    const afterLoadState = await page.evaluate(() => {
      const welcomeScreen = document.getElementById('welcomeScreen');
      const welcomeStats = document.getElementById('welcomeStats');
      if (!welcomeScreen || !welcomeStats) {
        return { error: 'Missing DOM elements' };
      }
      const welcomeDisplay = window.getComputedStyle(welcomeScreen).display;
      const statsDisplay = window.getComputedStyle(welcomeStats).display;
      const statItems = welcomeStats.querySelectorAll('.stat-item');
      const statValues = Array.from(welcomeStats.querySelectorAll('.stat-value')).map(el => el.textContent.trim());
      const statLabels = Array.from(welcomeStats.querySelectorAll('.stat-label')).map(el => el.textContent.trim());
      return {
        welcomeDisplay,
        statsDisplay,
        statItemCount: statItems.length,
        statValues,
        statLabels
      };
    });

    console.log(`After load — welcomeScreen: "${afterLoadState.welcomeDisplay}", welcomeStats: "${afterLoadState.statsDisplay}"`);

    if (afterLoadState.error) {
      throw new Error(`DOM elements missing after load: ${afterLoadState.error}`);
    }

    console.log(`After load — stat items: ${afterLoadState.statItemCount}`);
    console.log(`After load — values: ${JSON.stringify(afterLoadState.statValues)}`);
    console.log(`After load — labels: ${JSON.stringify(afterLoadState.statLabels)}`);

    // welcomeScreen should stay hidden after loading files
    if (afterLoadState.welcomeDisplay !== 'none') {
      throw new Error(`Expected welcomeScreen to be hidden after file load, but display was "${afterLoadState.welcomeDisplay}"`);
    }
    console.log('✓ welcomeScreen hidden after file load');

    // welcomeStats should be visible (flex) with stat items
    if (afterLoadState.statsDisplay !== 'flex') {
      throw new Error(`Expected welcomeStats display to be "flex" after loading, but was "${afterLoadState.statsDisplay}"`);
    }
    console.log('✓ welcomeStats visible after file load');

    if (afterLoadState.statItemCount !== 4) {
      throw new Error(`Expected 4 stat-item elements, but found ${afterLoadState.statItemCount}`);
    }
    console.log('✓ 4 stat items present');

    // Verify expected labels
    const expectedLabels = ['Modules', 'Objects', 'Interactions', 'Data Types'];
    for (let i = 0; i < expectedLabels.length; i++) {
      if (afterLoadState.statLabels[i] !== expectedLabels[i]) {
        throw new Error(`Expected stat-label[${i}] to be "${expectedLabels[i]}", but was "${afterLoadState.statLabels[i]}"`);
      }
    }
    console.log('✓ Labels match');

    // Verify each stat-value has numeric content > 0 (HLAstandardMIM.xml has real data)
    for (let i = 0; i < afterLoadState.statValues.length; i++) {
      const value = parseInt(afterLoadState.statValues[i], 10);
      if (isNaN(value) || value <= 0) {
        throw new Error(`Expected stat-value[${i}] to be > 0, but was "${afterLoadState.statValues[i]}"`);
      }
    }
    console.log('✓ All stat values > 0');

    // ============================================================
    // STEP 3: After clearing files
    // ============================================================
    console.log('Clearing files...');

    // Find the Clear button in the header and click it
    const clearBtnSelector = '#clearBtn';
    await page.waitForSelector(clearBtnSelector, { timeout: config.test.timeout });
    await page.click(clearBtnSelector);

    // Wait for confirm dialog to be accepted (handled by dialog listener)
    await page.waitForTimeout(500);

    // Wait for welcomeScreen to be visible again
    await page.waitForFunction(() => {
      const welcome = document.getElementById('welcomeScreen');
      return welcome && window.getComputedStyle(welcome).display !== 'none';
    }, { timeout: config.test.timeout });

    console.log('Files cleared, welcomeScreen is now visible');

    const afterClearState = await page.evaluate(() => {
      const welcomeScreen = document.getElementById('welcomeScreen');
      if (!welcomeScreen) {
        return { error: 'Missing welcomeScreen element' };
      }
      const welcomeDisplay = window.getComputedStyle(welcomeScreen).display;
      return { welcomeDisplay };
    });

    console.log(`After clear — welcomeScreen: "${afterClearState.welcomeDisplay}"`);

    if (afterClearState.error) {
      throw new Error(`DOM elements missing after clear: ${afterClearState.error}`);
    }

    const welcomeVisibleAfterClear = afterClearState.welcomeDisplay !== 'none';
    if (!welcomeVisibleAfterClear) {
      throw new Error(`Expected welcomeScreen to be visible after clear, but display was "${afterClearState.welcomeDisplay}"`);
    }
    console.log('✓ welcomeScreen visible after clear');

    // ============================================================
    // Summary
    // ============================================================
    console.log('\n=== Welcome Screen Stats Test Summary ===');
    console.log(`Step 1 — Initial state:                welcomeStats hidden ✓`);
    console.log(`Step 2 — After loading:                welcomeStats="flex", 4 items, >0 ✓`);
    console.log(`Step 3 — After clearing:               welcomeScreen visible ✓`);

    console.log('\n✓ WELCOME SCREEN STATS TEST PASSED');
    return true;

  } catch (error) {
    console.error('Test failed with error:', error);
    return false;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  runWelcomeStatsTest()
    .then(success => {
      process.exitCode = success ? 0 : 1;
    })
    .catch(err => {
      console.error('Test harness failed:', err);
      process.exitCode = 1;
    });
}

module.exports = { runWelcomeStatsTest };
