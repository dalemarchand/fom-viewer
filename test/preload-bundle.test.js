// Preloaded Bundle and Custom Branding Tests for FOM Viewer
// Tests strict/flexible modes, custom titles, badges, modification flags, and restoration.

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const config = require('./config');

function getHashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

async function test_PreloadBundle() {
  console.log('Starting Preload Bundle and Branding Tests...');
  
  const configPath = path.join(__dirname, '../src/custom-config.json');
  const backupConfigPath = path.join(__dirname, '../src/custom-config.json.bak');
  
  // 1. Back up original custom-config.json
  if (fs.existsSync(configPath)) {
    fs.copyFileSync(configPath, backupConfigPath);
  }
  
  const mimFilePath = path.join(__dirname, 'fom', 'HLAstandardMIM.xml');
  const mimContent = fs.readFileSync(mimFilePath, 'utf8');
  const mimHash = getHashCode(mimContent);

  const appspaceContent = `Class,Apps
HLAobjectRoot.HLAmanager,TestApp1,TestApp2
HLAobjectRoot.HLAmanager.HLAfederate,PlatformViewer,TestApp1
HLAobjectRoot.HLAmanager.HLAfederation,"PlatformViewer"
HLAobjectRoot,EntityViewer`;

  const testConfig = {
    title: "Preload Test Viewer",
    badgeText: "Test Badge",
    badgeColor: "#ff4757",
    badgeTextColor: "#ffffff",
    badgeImage: "",
    preloadedFiles: [
      {
        name: "HLAstandardMIM.xml",
        xml: mimContent,
        hash: mimHash
      }
    ],
    preloadedAppspace: {
      fileName: "test-appspace-objects.csv",
      content: appspaceContent
    },
    bundleId: "test-bundle-id-12345",
    mode: "flexible"
  };

  const browserOptions = {
    headless: true,
    slowMo: config.browser.slowMo,
    args: config.browser.args,
    executablePath: config.browser.executablePath
  };

  let browser;
  
  try {
    // =========================================================================
    // PART 1: Flexible Preloaded Mode
    // =========================================================================
    console.log('Part 1: Writing flexible test config and rebuilding...');
    fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
    
    // Rebuild with custom bundle
    execSync('npm run build', { cwd: path.join(__dirname, '..') });
    
    browser = await puppeteer.launch(browserOptions);
    let page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    page.on('console', msg => {
      console.log(`[Browser Console - Part 1]: ${msg.text()}`);
    });

    // Auto-accept confirm dialogs
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    console.log('Opening page in flexible preloaded mode...');
    await page.goto(`file://${path.resolve(__dirname, '../fom-viewer.html')}`, {
      waitUntil: 'networkidle0'
    });
    
    await page.waitForFunction(() => {
      return document.getElementById('app') !== null;
    }, { timeout: config.test.timeout });
    
    // Give IndexedDB parsing time to settle
    await page.waitForTimeout(2000);
    
    // Validate branding and preloaded data
    const flexInitialState = await page.evaluate(() => {
      const headerTitle = document.querySelector('header h1')?.textContent;
      const customBadge = document.querySelector('.custom-badge')?.textContent?.trim();
      const statusBadge = document.querySelector('.bundle-mode-badge')?.textContent?.trim();
      const filesCount = state.files.length;
      const appspaceExists = state.appspace !== null;
      const appspaceCount = state.appspace?.entries?.length || 0;
      
      return {
        documentTitle: document.title,
        headerTitle,
        customBadge,
        statusBadge,
        filesCount,
        appspaceExists,
        appspaceCount
      };
    });
    
    console.log('  Initial Document Title:', flexInitialState.documentTitle);
    console.log('  Initial Header Title:', flexInitialState.headerTitle);
    console.log('  Custom Badge:', flexInitialState.customBadge);
    console.log('  Status Badge:', flexInitialState.statusBadge);
    console.log('  Preloaded Files Count:', flexInitialState.filesCount);
    console.log('  Appspace Loaded:', flexInitialState.appspaceExists);
    console.log('  Appspace Entries Count:', flexInitialState.appspaceCount);
    
    if (flexInitialState.documentTitle !== "Preload Test Viewer") {
      throw new Error(`Expected document title 'Preload Test Viewer', got '${flexInitialState.documentTitle}'`);
    }
    if (flexInitialState.headerTitle !== "Preload Test Viewer") {
      throw new Error(`Expected header title 'Preload Test Viewer', got '${flexInitialState.headerTitle}'`);
    }
    if (flexInitialState.customBadge !== "Test Badge") {
      throw new Error(`Expected custom badge 'Test Badge', got '${flexInitialState.customBadge}'`);
    }
    if (!flexInitialState.statusBadge.includes("Flexible Bundle")) {
      throw new Error(`Expected status badge containing 'Flexible Bundle', got '${flexInitialState.statusBadge}'`);
    }
    if (flexInitialState.filesCount !== 1) {
      throw new Error(`Expected 1 preloaded file, got ${flexInitialState.filesCount}`);
    }
    if (!flexInitialState.appspaceExists || flexInitialState.appspaceCount !== 4) {
      throw new Error(`Expected appspace to be preloaded with 4 entries, got ${flexInitialState.appspaceCount}`);
    }
    console.log('  ✓ Flexible mode initial validation passed');

    // Trigger Modification
    console.log('Loading additional FOM file to trigger modified state...');
    await loadTestFomFile(page, 'RPR-Base_v3.0.xml', 2);
    
    const flexModifiedState = await page.evaluate(() => {
      const statusBadge = document.querySelector('.bundle-mode-badge')?.textContent?.trim();
      const restoreBtnExists = document.getElementById('restoreBundleBtnInline') !== null;
      return { statusBadge, restoreBtnExists };
    });
    
    console.log('  Modified Status Badge:', flexModifiedState.statusBadge);
    console.log('  Inline Restore Button Exists:', flexModifiedState.restoreBtnExists);
    
    if (!flexModifiedState.statusBadge.includes("Modified")) {
      throw new Error(`Expected status badge to show 'Modified', got '${flexModifiedState.statusBadge}'`);
    }
    if (!flexModifiedState.restoreBtnExists) {
      throw new Error('Expected inline restore button to be visible when bundle is modified');
    }
    console.log('  ✓ Modification detection passed');

    // Trigger Restore Defaults
    console.log('Clicking Restore Defaults...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: 10000 }).catch(() => {
        console.log('  [Warning] page.waitForNavigation timed out or resolved early, continuing...');
      }),
      page.click('#restoreBundleBtnInline')
    ]);
    
    await page.waitForFunction(() => {
      return document.getElementById('app') !== null;
    }, { timeout: config.test.timeout });
    
    await page.waitForTimeout(2000);
    
    const flexRestoredState = await page.evaluate(() => {
      const statusBadge = document.querySelector('.bundle-mode-badge')?.textContent?.trim();
      const filesCount = state.files.length;
      return { statusBadge, filesCount };
    });
    
    console.log('  Restored Status Badge:', flexRestoredState.statusBadge);
    console.log('  Restored Files Count:', flexRestoredState.filesCount);
    
    if (flexRestoredState.filesCount !== 1) {
      throw new Error(`Expected files count to reset to 1, got ${flexRestoredState.filesCount}`);
    }
    if (flexRestoredState.statusBadge.includes("Modified")) {
      throw new Error('Expected status badge to revert to unmodified state');
    }
    console.log('  ✓ Restore bundle default settings passed');
    
    await browser.close();

    // =========================================================================
    // PART 2: Strict Preloaded Mode
    // =========================================================================
    console.log('Part 2: Writing strict test config and rebuilding...');
    testConfig.mode = "strict";
    testConfig.bundleId = "test-bundle-id-strict-5678";
    fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
    
    execSync('npm run build', { cwd: path.join(__dirname, '..') });
    
    browser = await puppeteer.launch(browserOptions);
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    page.on('console', msg => {
      console.log(`[Browser Console - Part 2]: ${msg.text()}`);
    });

    console.log('Opening page in strict preloaded mode...');
    await page.goto(`file://${path.resolve(__dirname, '../fom-viewer.html')}`, {
      waitUntil: 'networkidle0'
    });
    
    await page.waitForFunction(() => {
      return document.getElementById('app') !== null;
    }, { timeout: config.test.timeout });
    
    await page.waitForTimeout(2000);

    const strictState = await page.evaluate(() => {
      const statusBadge = document.querySelector('.bundle-mode-badge')?.textContent?.trim();
      const fileInputVisible = document.getElementById('fileInput')?.style.display !== 'none';
      const loadBtn = document.getElementById('loadAppspaceBtn');
      const clearBtn = document.getElementById('clearBtn');
      
      return {
        statusBadge,
        fileInputVisible,
        loadAppspaceBtnExists: loadBtn !== null && window.getComputedStyle(loadBtn).display !== 'none',
        clearBtnExists: clearBtn !== null && window.getComputedStyle(clearBtn).display !== 'none'
      };
    });
    
    console.log('  Strict Status Badge:', strictState.statusBadge);
    console.log('  Load Appspace Button Exists & Visible:', strictState.loadAppspaceBtnExists);
    console.log('  Clear Workspace Button Exists & Visible:', strictState.clearBtnExists);
    
    if (!strictState.statusBadge.includes("Read-Only Bundle")) {
      throw new Error(`Expected status badge to contain 'Read-Only Bundle', got '${strictState.statusBadge}'`);
    }
    if (strictState.loadAppspaceBtnExists) {
      throw new Error('Load Appspace button should not be visible/interactable in strict mode');
    }
    if (strictState.clearBtnExists) {
      throw new Error('Clear button should not be visible/interactable in strict mode');
    }
    console.log('  ✓ Strict mode UI visibility restrictions passed');
    
    await browser.close();
    console.log('✓ ALL PRELOAD BUNDLE TESTS PASSED');
    return true;
    
  } catch (e) {
    console.error('Test failed with error:', e);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
    // Restore original custom-config.json
    if (fs.existsSync(backupConfigPath)) {
      fs.copyFileSync(backupConfigPath, configPath);
      fs.unlinkSync(backupConfigPath);
    } else {
      fs.unlinkSync(configPath);
    }
    // Rebuild to clean up test config
    execSync('npm run build', { cwd: path.join(__dirname, '..') });
  }
}

// Helper: Load a FOM test file via #fileInput
async function loadTestFomFile(page, filename, expectedCount) {
  const filePath = path.join(config.test.fomDir, filename);
  const fileInput = await page.$('#fileInput');
  await fileInput.uploadFile(filePath);
  
  await page.waitForFunction((count) => {
    return state.files && state.files.length >= count;
  }, { timeout: config.test.timeout }, expectedCount);
  
  await sleep(500);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (require.main === module) {
  test_PreloadBundle()
    .then(success => {
      process.exitCode = success ? 0 : 1;
    })
    .catch(err => {
      console.error('Test harness failed:', err);
      process.exitCode = 1;
    });
}

module.exports = { test_PreloadBundle };
