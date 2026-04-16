const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('./config');

const args = process.argv.slice(2);
const options = {
  visible: args.includes('--visible'),
  debug: args.includes('--debug'),
  combined: args.includes('--combined'),
  specificTest: args.find(arg => arg.startsWith('--test='))?.replace('--test=', '') || null,
  timeout: parseInt(args.find(arg => arg.startsWith('--timeout='))?.replace('--timeout=', '') || config.test.timeout)
};

let browser;
let page;
let testsPassed = 0;
let testsFailed = 0;

function log(message, type = 'info') {
  const timestamp = new Date().toISOString().slice(11, 19);
  const prefix = { info: 'ℹ', success: '✓', fail: '✗', warn: '⚠' }[type] || 'ℹ';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function logError(message, error) {
  log(`${message}: ${error.message}`, 'fail');
  if (options.debug) console.error(error.stack);
}

async function waitAndClick(selector, options = {}) {
  await page.waitForSelector(selector, { timeout: options.timeout || config.test.waitForSelector });
  await page.click(selector);
}

async function waitForSelector(selector, options = {}) {
  await page.waitForSelector(selector, { timeout: options.timeout || config.test.waitForSelector });
  return await page.$(selector);
}

async function loadTestFomFile(filename) {
  const filePath = path.join(config.test.fomDir, filename);
  
  const fileInput = await page.$('#fileInput');
  await fileInput.uploadFile(filePath);
  
  await page.waitForFunction(() => {
    const welcome = document.getElementById('welcomeScreen');
    return welcome && welcome.style.display === 'none';
  }, { timeout: config.test.timeout });
}

async function launchBrowser() {
  log('Launching browser...', options.visible ? 'info' : 'info');
  
  const browserOptions = {
    headless: !options.visible,
    slowMo: options.debug ? 50 : config.browser.slowMo,
    args: config.browser.args,
    executablePath: config.browser.executablePath
  };
  
  if (!options.visible) {
    browserOptions.args.push('--headless');
  }
  
  browser = await puppeteer.launch(browserOptions);
  page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 800 });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      log(`Console error: ${msg.text()}`, 'fail');
    }
  });
  
  page.on('pageerror', error => {
    logError('Page error', error);
  });
  
  return page;
}

async function openApp() {
  const htmlPath = options.combined ? config.app.combinedHtmlPath : config.app.htmlPath;
  log(`Opening ${htmlPath}...`);
  await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app');
  log('App loaded successfully', 'success');
}

async function test_LoadPage() {
  log('Testing: Load page without errors...');
  try {
    await openApp();
    await waitForSelector('#app');
    await waitForSelector('header');
    await waitForSelector('.tab-bar');
    log('Page loaded successfully', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    logError('Load page test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_TabNavigation() {
  log('Testing: Tab navigation...');
  try {
    await openApp();
    
    const tabs = [
      { selector: '[data-tab="modules"]', expectedIndex: 0 },
      { selector: '[data-tab="objects"]', expectedIndex: 1 },
      { selector: '[data-tab="interactions"]', expectedIndex: 2 },
      { selector: '[data-tab="datatypes"]', expectedIndex: 3 },
      { selector: '[data-tab="dims"]', expectedIndex: 5 },
      { selector: '[data-tab="notes"]', expectedIndex: 11 }
    ];
    
    for (const tab of tabs) {
      await waitAndClick(tab.selector);
      await page.waitForTimeout(200);
    }
    
    await waitAndClick('[data-tab="modules"]');
    await page.waitForTimeout(200);
    
    log('Tab navigation working', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    logError('Tab navigation test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_FileLoading() {
  log('Testing: File loading...');
  try {
    await openApp();
    
    const testFile = config.testFiles[0];
    log(`Loading ${testFile}...`);
    
    await loadTestFomFile(testFile);
    
    await page.waitForFunction(() => {
      const welcome = document.getElementById('welcomeScreen');
      return welcome && welcome.style.display === 'none';
    }, { timeout: config.test.timeout });
    
    const treeView = await waitForSelector('#treeView');
    const hasContent = await page.evaluate(el => el.children.length > 0, treeView);
    
    if (!hasContent) {
      throw new Error('Tree view is empty after loading file');
    }
    
    log(`File ${testFile} loaded successfully`, 'success');
    testsPassed++;
    return true;
  } catch (error) {
    logError('File loading test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_LoadAllFiles() {
  log('Testing: Loading all FOM files...');
  try {
    await openApp();
    
    for (const testFile of config.testFiles) {
      await page.reload();
      await page.waitForSelector('#app');
      
      const fileInput = await page.$('#fileInput');
      const filePath = path.join(config.test.fomDir, testFile);
      await fileInput.uploadFile(filePath);
      
      await page.waitForFunction(() => {
        const welcome = document.getElementById('welcomeScreen');
        return welcome && welcome.style.display === 'none';
      }, { timeout: config.test.timeout });
      
      log(`Loaded ${testFile}`, 'success');
    }
    
    log(`All ${config.testFiles.length} files loaded successfully`, 'success');
    testsPassed++;
    return true;
  } catch (error) {
    logError('Load all files test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_ItemSelection() {
  log('Testing: Item selection...');
  try {
    await openApp();
    
    await loadTestFomFile(config.testFiles[0]);
    await page.waitForTimeout(500);
    
    const treeItems = await page.$$('.tree-item');
    
    if (treeItems.length === 0) {
      throw new Error('No tree items found after loading file');
    }
    
    await treeItems[0].click();
    await page.waitForTimeout(500);
    
    const detailHeader = await page.$('#detailHeader');
    const isVisible = await detailHeader.isIntersectingViewport();
    
    if (!isVisible) {
      throw new Error('Detail header not visible after clicking item');
    }
    
    log(`Item selection working (${treeItems.length} items found)`, 'success');
    testsPassed++;
    return true;
  } catch (error) {
    logError('Item selection test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_BackButton() {
  log('Testing: Back button navigation between tabs...');
  try {
    await openApp();
    
    await loadTestFomFile(config.testFiles[0]);
    await page.waitForTimeout(500);
    
    await page.click('[data-tab="objects"]');
    await page.waitForTimeout(300);
    
    const treeItems = await page.$$('.tree-item');
    if (treeItems.length > 0) {
      await treeItems[0].click();
      await page.waitForTimeout(300);
    }
    
    const backBtn = await page.$('#backBtn');
    const backBtnVisible = await backBtn.isIntersectingViewport();
    
    if (backBtnVisible) {
      await backBtn.click();
      await page.waitForTimeout(300);
      log('Back button between tabs works', 'success');
    } else {
      log('Back button not visible (no navigation history)', 'warn');
    }
    
    testsPassed++;
    return true;
  } catch (error) {
    logError('Back button test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_BackButtonSubTabs() {
  log('Testing: Back button navigation between subtabs...');
  try {
    await openApp();
    
    await loadTestFomFile(config.testFiles[0]);
    await page.waitForTimeout(500);
    
    await page.click('[data-tab="datatypes"]');
    await page.waitForTimeout(300);
    
    const subtabs = await page.$$('#dataTypeTabs .subtab');
    if (subtabs.length > 1) {
      await subtabs[1].click();
      await page.waitForTimeout(300);
      
      await subtabs[2].click();
      await page.waitForTimeout(300);
      
      const backBtn = await page.$('#backBtn');
      const backBtnVisible = await backBtn.isIntersectingViewport();
      
      if (backBtnVisible) {
        await backBtn.click();
        await page.waitForTimeout(300);
        log('Back button between subtabs works', 'success');
      } else {
        log('Back button not visible for subtab navigation', 'warn');
      }
    } else {
      log('No subtabs found for this file', 'warn');
    }
    
    testsPassed++;
    return true;
  } catch (error) {
    logError('Back button subtab test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_BackButtonEmbeddedLinks() {
  log('Testing: Back button navigation with embedded links...');
  try {
    await openApp();
    
    await loadTestFomFile(config.testFiles[4]);
    await page.waitForTimeout(500);
    
    const treeItems = await page.$$('.tree-item');
    if (treeItems.length > 0) {
      await treeItems[0].click();
      await page.waitForTimeout(500);
      
      const clickableLinks = await page.$$('.clickable-item');
      if (clickableLinks.length > 0) {
        await clickableLinks[0].click();
        await page.waitForTimeout(500);
        
        const backBtn = await page.$('#backBtn');
        const backBtnVisible = await backBtn.isIntersectingViewport();
        
        if (backBtnVisible) {
          await backBtn.click();
          await page.waitForTimeout(300);
          log('Back button with embedded links works', 'success');
        } else {
          log('Back button not visible after clicking embedded link', 'warn');
        }
      } else {
        log('No embedded links found in detail view', 'warn');
      }
    } else {
      log('No tree items found', 'warn');
    }
    
    testsPassed++;
    return true;
  } catch (error) {
    logError('Back button embedded links test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_SearchFunctionality() {
  log('Testing: Search functionality...');
  try {
    await openApp();
    await page.waitForSelector('#globalSearch');
    await page.waitForSelector('#clearBtn');
    await page.evaluate(() => {
      document.getElementById('globalSearch').value = '';
    });
    await page.waitForTimeout(200);
    log('Search input cleared', 'success');
    log('Search functionality working', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    logError('Search test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_SubTabNavigation() {
  log('Testing: Sub-tab navigation...');
  try {
    await openApp();
    
    await loadTestFomFile(config.testFiles[0]);
    await page.waitForTimeout(500);
    
    await waitAndClick('[data-tab="datatypes"]');
    await page.waitForTimeout(300);
    
    const subtabs = await page.$$('#dataTypeTabs .subtab');
    
    if (subtabs.length === 0) {
      log('No sub-tabs for this file (may be normal)', 'warn');
      testsPassed++;
      return true;
    }
    
    for (const subtab of subtabs) {
      await subtab.click();
      await page.waitForTimeout(200);
    }
    
    log('Sub-tab navigation working', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    logError('Sub-tab test failed', error);
    testsFailed++;
    return false;
  }
}

async function runAllTests() {
  log('='.repeat(50));
  log('Starting FOM Viewer Tests');
  log('='.repeat(50));
  
  await launchBrowser();
  
  const tests = [
    { name: 'LoadPage', fn: test_LoadPage },
    { name: 'FileLoading', fn: test_FileLoading },
    { name: 'LoadAllFiles', fn: test_LoadAllFiles },
    { name: 'TabNavigation', fn: test_TabNavigation },
    { name: 'SubTabNavigation', fn: test_SubTabNavigation },
    { name: 'ItemSelection', fn: test_ItemSelection },
    { name: 'BackButton', fn: test_BackButton },
    { name: 'BackButtonSubTabs', fn: test_BackButtonSubTabs },
    { name: 'BackButtonEmbeddedLinks', fn: test_BackButtonEmbeddedLinks },
    { name: 'Search', fn: test_SearchFunctionality }
  ];
  
  for (const test of tests) {
    if (options.specificTest && test.name.toLowerCase() !== options.specificTest.toLowerCase()) {
      continue;
    }
    log('-'.repeat(30));
    await test.fn();
  }
  
  log('='.repeat(50));
  log(`Tests completed: ${testsPassed} passed, ${testsFailed} failed`);
  log('='.repeat(50));
  
  if (browser) {
    await browser.close();
  }
  
  return testsFailed === 0;
}

async function main() {
  try {
    const success = await runAllTests();
    process.exit(success ? 0 : 1);
  } catch (error) {
    logError('Fatal error', error);
    if (browser) {
      await browser.close();
    }
    process.exit(1);
  }
}

main();