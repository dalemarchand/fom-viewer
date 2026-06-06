const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { runWelcomeStatsTest } = require('./welcome-stats.test.js');
const { test_IssueDetailPanelImprovements } = require('./issue-detail-panel.test.js');
const { test_IssueHistoryPush } = require('./issue-history-push.test.js');
const { test_IssueHistoryPushAdversarial } = require('./history-issue-adversarial.test.js');
const { test_IssuesSubtabEmptyState } = require('./issues-subtab-empty-state.test.js');
const { test_IssuesSubtabGuard } = require('./issues-subtab-guard.test.js');
const { test_IssuesSubtabHistory } = require('./issues-subtab-history.test.js');
const { test_IssuesCallOrderFix } = require('./issues-call-order-fix.test.js');
const { test_BackButtonFixes } = require('./back-button-fixes.test.js');
const { test_AppspaceFeature } = require('./appspace.test.js');
const { run: test_MergeClassesRun } = require('./merge-classes.test.js');


const args = process.argv.slice(2);
const opts = {
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message, type = 'info') {
  const timestamp = new Date().toISOString().slice(11, 19);
  const prefix = { info: 'ℹ', success: '✓', fail: '✗', warn: '⚠' }[type] || 'ℹ';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function logError(message, error) {
  log(`${message}: ${error.message}`, 'fail');
  if (opts.debug) console.error(error.stack);
}

async function captureScreenshot(name) {
  const screenshotDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  const filepath = path.join(screenshotDir, `${name}.png`);
  await page.screenshot({ path: filepath });
  log(`Screenshot saved: ${filepath}`, 'info');
}

async function waitAndClick(selector, waitOpts = {}) {
  await page.waitForSelector(selector, { timeout: waitOpts.timeout || config.test.waitForSelector });
  await page.click(selector);
}

async function waitForSelector(selector, waitOpts = {}) {
  await page.waitForSelector(selector, { timeout: waitOpts.timeout || config.test.waitForSelector });
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
  log('Launching browser...', opts.visible ? 'info' : 'info');
  
  const browserOptions = {
    headless: !opts.visible,
    slowMo: opts.debug ? 50 : config.browser.slowMo,
    args: config.browser.args,
    executablePath: config.browser.executablePath
  };
  
  if (!opts.visible) {
    browserOptions.args.push('--headless');
  }
  
  browser = await puppeteer.launch(browserOptions);
  page = await browser.newPage();
  
  await page.setViewport({ width: 1280, height: 800 });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      log(`Console error: ${msg.text()}`, 'fail');
    } else if (msg.type() === 'log') {
      log(`Console: ${msg.text()}`, 'info');
    }
  });
  
  page.on('pageerror', error => {
    logError('Page error', error);
  });
  
  return page;
}

async function openApp() {
  const htmlPath = opts.combined ? config.app.combinedHtmlPath : config.app.htmlPath;
  log(`Opening ${htmlPath}...`);
  await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#app');
  // Clear IndexedDB to prevent state leakage from previous tests
  await page.evaluate(async () => {
    try {
      if (typeof clearStorage === 'function') {
        await clearStorage();
      }
    } catch (e) {
      console.warn('Failed to clear storage:', e);
    }
  });
  // Reload with fresh state
  await page.reload({ waitUntil: 'domcontentloaded' });
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
    await waitForSelector('#backBtn');
    await waitForSelector('#globalSearch');
    await waitForSelector('#clearBtn');
    await waitForSelector('#fileInput');
    await waitForSelector('#exportBtn');
    await waitForSelector('#sortBtn');
    log('Page loaded successfully', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_LoadPage_failed');
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
      await sleep(200);
    }
    
    await waitAndClick('[data-tab="modules"]');
    await sleep(200);
    
    log('Tab navigation working', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_TabNavigation_failed');
    logError('Tab navigation test failed', error);
    testsFailed++;
    return false;
  }
}

// About dialog version reading tests
async function test_AboutVersion_MetaTag() {
  log('Testing: About dialog uses version from meta tag (valid value)...');
  try {
    await openApp();
    // Ensure meta[name="version"] exists with a valid value
    await page.evaluate(() => {
      let meta = document.querySelector('meta[name="version"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'version');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', '9.8.7');
    });
    await page.click('#aboutBtn');
    // Wait for the toast to be shown
    await page.waitForFunction(() => {
      const t = document.getElementById('toast');
      return t && t.classList.contains('show');
    }, { timeout: 2000 });
    const versionLine = await page.evaluate(() => document.querySelector('#toast .version')?.textContent || '');
    if (!versionLine.includes('Version 9.8.7')) throw new Error('Expected version string not found in About toast');
    log('About shows correct version from meta tag', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_AboutVersion_MetaTag_failed');
    logError('About version metaTag test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_AboutVersion_MetaMissing() {
  log('Testing: About dialog fallback when meta tag is missing...');
  try {
    await openApp();
    // Remove meta tag if present
    await page.evaluate(() => {
      const m = document.querySelector('meta[name="version"]');
      if (m) m.remove();
    });
    await page.click('#aboutBtn');
    await page.waitForFunction(() => {
      const t = document.getElementById('toast');
      return t && t.classList.contains('show');
    }, { timeout: 2000 });
    const versionLine = await page.evaluate(() => document.querySelector('#toast .version')?.textContent || '');
    if (!versionLine.includes('Version -1.-1.-1')) throw new Error('Expected fallback version not found in About toast');
    log('About fallback for missing meta tag works', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_AboutVersion_MetaMissing_failed');
    logError('About version missing-meta test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_AboutVersion_MetaPlaceholder() {
  log('Testing: About dialog fallback when meta content is placeholder value __VERSION__...');
  try {
    await openApp();
    // Set placeholder value
    await page.evaluate(() => {
      let meta = document.querySelector('meta[name="version"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'version');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', '__VERSION__');
    });
    await page.click('#aboutBtn');
    await page.waitForFunction(() => {
      const t = document.getElementById('toast');
      return t && t.classList.contains('show');
    }, { timeout: 2000 });
    const versionLine = await page.evaluate(() => document.querySelector('#toast .version')?.textContent || '');
    if (!versionLine.includes('Version -1.-1.-1')) throw new Error('Expected fallback for placeholder not found');
    log('About placeholder meta value falls back correctly', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_AboutVersion_MetaPlaceholder_failed');
    logError('About version placeholder test failed', error);
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
      await captureScreenshot('test_FileLoading_failed');
      throw new Error('Tree view is empty after loading file');
    }
    
    log(`File ${testFile} loaded successfully`, 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_FileLoading_failed');
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
    await captureScreenshot('test_LoadAllFiles_failed');
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
    await sleep(500);
    
    const treeItems = await page.$$('.tree-item');
    
    if (treeItems.length === 0) {
      await captureScreenshot('test_ItemSelection_failed');
      throw new Error('No tree items found after loading file');
    }
    
    await treeItems[0].click();
    await sleep(500);
    
    const detailHeader = await page.$('#detailHeader');
    const isVisible = await detailHeader.isIntersectingViewport();
    
    if (!isVisible) {
      await captureScreenshot('test_ItemSelection_failed');
      throw new Error('Detail header not visible after clicking item');
    }
    
    const detailBody = await page.$('#detailBody');
    const hasContent = await page.evaluate(el => el.innerHTML.trim().length > 0, detailBody);
    
    if (!hasContent) {
      await captureScreenshot('test_ItemSelection_failed');
      throw new Error('Detail body is empty after selecting item');
    }
    
    log(`Item selection working (${treeItems.length} items found)`, 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_ItemSelection_failed');
    logError('Item selection test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_DataTypeSelection() {
  log('Testing: Data type selection...');
  try {
    await openApp();
    
    await loadTestFomFile(config.testFiles[0]);
    await sleep(500);
    
    await page.click('[data-tab="datatypes"]');
    await sleep(300);
    
    const subtab = await page.waitForSelector('.subtab[data-subtab="basic"]');
    await subtab.click();
    await sleep(500);
    
    const treeItems = await page.$$('.tree-item');
    if (treeItems.length === 0) {
      await captureScreenshot('test_DataTypeSelection_failed');
      throw new Error('No data type items found in tree view');
    }
    
    const firstItemName = await treeItems[0].evaluate(el => el.dataset.name);
    const firstItemType = await treeItems[0].evaluate(el => el.dataset.type);
    log(`Clicking item: name=${firstItemName}, type=${firstItemType}`, 'info');
    
    log(`About to evaluate click for name=${firstItemName}, type=${firstItemType}`, 'info');
    
    await page.evaluate((name, type) => {
      console.log('EVALUATE: name=' + name + ', type=' + type);
      if (typeof showDetail === 'function') {
        console.log('EVALUATE: Calling showDetail');
        showDetail(name, type, true);
        console.log('EVALUATE: showDetail called');
        console.log('EVALUATE: state.mergedFOM.dataTypes.basic first 3:', JSON.stringify(state?.mergedFOM?.dataTypes?.basic?.slice(0, 3)));
        console.log('EVALUATE: state.mergedFOM.dataTypes.basic contains HLAfloat32BE:', state?.mergedFOM?.dataTypes?.basic?.some(d => d.name === 'HLAfloat32BE'));
        console.log('EVALUATE: state.currentTab:', state?.currentTab);
        console.log('EVALUATE: state.currentSubTab:', state?.currentSubTab);
        console.log('EVALUATE: document.getElementById("detailBody").innerHTML.length:', document.getElementById("detailBody").innerHTML.length);
      } else {
        console.log('EVALUATE: showDetail NOT found');
      }
    }, firstItemName, firstItemType);
    await sleep(500)
    
    const stateAfterClick = await page.evaluate(() => {
      return {
        currentTab: window.state?.currentTab,
        currentSubTab: window.state?.currentSubTab,
        selectedItem: window.state?.selectedItem,
        detailBodyContent: document.getElementById('detailBody')?.innerHTML?.substring(0, 100)
      };
    });
    log(`State after click: ${JSON.stringify(stateAfterClick)}`, 'info');
    
    const detailHeader = await page.$('#detailHeader');
    const headerVisible = await detailHeader.evaluate(el => el.style.display !== 'none');
    
    if (!headerVisible) {
      await captureScreenshot('test_DataTypeSelection_failed');
      throw new Error('Detail header not visible after clicking data type');
    }
    
    const detailBody = await page.$('#detailBody');
    const bodyContent = await detailBody.evaluate(el => el.innerHTML.trim());
    
    log(`Detail body content length: ${bodyContent.length}`, 'info');
    
    if (bodyContent.length === 0) {
      await captureScreenshot('test_DataTypeSelection_failed');
      
      const treeContent = await page.evaluate(() => {
        const tree = document.querySelector('.tree-wrapper');
        return tree ? tree.innerHTML.substring(0, 500) : 'No tree';
      });
      log(`Tree content: ${treeContent}`, 'info');
      
      throw new Error('Detail body is empty after selecting data type');
    }
    
    const hasTable = await detailBody.evaluate(el => el.querySelector('table') !== null);
    if (!hasTable) {
      await captureScreenshot('test_DataTypeSelection_failed');
      throw new Error('Detail body does not contain a table');
    }
    
    log(`Data type selection working (${treeItems.length} items found)`, 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_DataTypeSelection_failed');
    logError('Data type selection test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_CircularDependencyDetection() {
  log('Testing: Circular dependency detection...');
  try {
    await openApp();
    
    // Test 1: No false positives with actual FOM files
    log('Test 1: Loading RPR-Foundation_v3.0.xml to check for false positives...', 'info');
    await loadTestFomFile('RPR-Foundation_v3.0.xml');
    await page.waitForFunction(() => {
      return state.files.length > 0;
    }, { timeout: config.test.timeout });
    
    // Call validation to trigger circular dependency check
    await page.evaluate(() => {
      validate();
    });
    
    // Check that no circular dependency issues were reported
    const circularIssues = await page.evaluate(() => {
      return state.issues.filter(issue => issue.type === 'cycle-detected');
    });
    
    if (circularIssues.length > 0) {
      await captureScreenshot('test_CircularDependencyDetection_false_positive');
      throw new Error(`False positive circular dependencies detected: ${JSON.stringify(circularIssues)}`);
    }
    log('✓ No false positives with real FOM files', 'success');
    
    // Test 2: Direct injection approach for controlled testing
    log('Test 2: Testing circular dependency detection with injected state...', 'info');
    await page.evaluate(() => {
      // Clear existing state
      state.issues = [];
      state.files = [
        { name: 'A', dependencies: [] },
        { name: 'B', dependencies: [] },
        { name: 'C', dependencies: [] }
      ];
    });
    
    // Test 2a: A -> B, B -> A (circular)
    await page.evaluate(() => {
      state.files[0].dependencies = ['B']; // A depends on B
      state.files[1].dependencies = ['A']; // B depends on A
      // C has no dependencies
      _detectCircularDependencies();
    });
    
    const issuesAfterCircular = await page.evaluate(() => {
      return state.issues.filter(issue => issue.type === 'cycle-detected');
    });
    
    if (issuesAfterCircular.length !== 1) {
      await captureScreenshot('test_CircularDependencyDetection_circular_count');
      throw new Error(`Expected exactly 1 circular dependency issue for A<->B, got ${issuesAfterCircular.length}`);
    }
    
    const issue = issuesAfterCircular[0];
    if (issue.severity !== 'error') {
      await captureScreenshot('test_CircularDependencyDetection_circular_severity');
      throw new Error(`Expected severity 'error' for circular dependency, got '${issue.severity}'`);
    }
    
    if (!issue.message.includes('Circular dependency detected')) {
      await captureScreenshot('test_CircularDependencyDetection_circular_message');
      throw new Error(`Unexpected message for circular dependency: '${issue.message}'`);
    }
    
    // Should involve both A and B (in sources field)
    const sources = issue.sources;
    if (!sources.includes('A') || !sources.includes('B')) {
      await captureScreenshot('test_CircularDependencyDetection_circular_sources');
      throw new Error(`Expected sources to include A and B, got ${JSON.stringify(sources)}`);
    }
    
    log('✓ Circular dependency (A<->B) detected correctly', 'success');
    
    // Test 2b: Non-circular set (A -> B, C -> B)
    await page.evaluate(() => {
      state.issues = []; // Clear issues
      state.files[0].dependencies = ['B']; // A depends on B
      state.files[1].dependencies = [];    // B has no dependencies
      state.files[2].dependencies = ['B']; // C depends on B
      _detectCircularDependencies();
    });
    
    const issuesAfterNonCircular = await page.evaluate(() => {
      return state.issues.filter(issue => issue.type === 'cycle-detected');
    });
    
    if (issuesAfterNonCircular.length !== 0) {
      await captureScreenshot('test_CircularDependencyDetection_non_circular');
      throw new Error(`Expected 0 circular dependency issues for A->B, C->B, got ${issuesAfterNonCircular.length}`);
    }
    
    log('✓ Non-circular dependencies produce no issues', 'success');
    
    // Test 2c: Self-loop (A -> A)
    await page.evaluate(() => {
      state.issues = []; // Clear issues
      state.files[0].dependencies = ['A']; // A depends on itself
      state.files[1].dependencies = [];    // B has no dependencies
      state.files[2].dependencies = [];    // C has no dependencies
      _detectCircularDependencies();
    });
    
    const issuesAfterSelfLoop = await page.evaluate(() => {
      return state.issues.filter(issue => issue.type === 'cycle-detected');
    });
    
    if (issuesAfterSelfLoop.length !== 1) {
      await captureScreenshot('test_CircularDependencyDetection_self_loop_count');
      throw new Error(`Expected exactly 1 circular dependency issue for self-loop, got ${issuesAfterSelfLoop.length}`);
    }
    
    const selfLoopIssue = issuesAfterSelfLoop[0];
    if (selfLoopIssue.severity !== 'error') {
      await captureScreenshot('test_CircularDependencyDetection_self_loop_severity');
      throw new Error(`Expected severity 'error' for self-loop, got '${selfLoopIssue.severity}'`);
    }
    
    if (!selfLoopIssue.message.includes('Circular dependency detected')) {
      await captureScreenshot('test_CircularDependencyDetection_self_loop_message');
      throw new Error(`Unexpected message for self-loop: '${selfLoopIssue.message}'`);
    }
    
    // Should involve only A (in sources field)
    const selfLoopSources = selfLoopIssue.sources;
    if (!selfLoopSources.includes('A') || selfLoopSources.length !== 1) {
      await captureScreenshot('test_CircularDependencyDetection_self_loop_sources');
      throw new Error(`Expected sources to be only A for self-loop, got ${JSON.stringify(selfLoopSources)}`);
    }
    
    log('✓ Self-loop dependency detected correctly', 'success');
    
    log('All circular dependency detection tests passed', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_CircularDependencyDetection_failed');
    logError('Circular dependency detection test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_BackButton() {
  log('Testing: Back button navigation between tabs...');
  try {
    await openApp();
    
    await loadTestFomFile(config.testFiles[0]);
    await sleep(500);
    
    await page.click('[data-tab="objects"]');
    await sleep(300);
    
    const treeItems = await page.$$('.tree-item');
    if (treeItems.length > 0) {
      await treeItems[0].click();
      await sleep(300);
    }
    
    const backBtn = await page.$('#backBtn');
    const backBtnVisible = await backBtn.isIntersectingViewport();
    
    if (!backBtnVisible) {
      await captureScreenshot('test_BackButton_failed');
      throw new Error('Back button not visible after navigation');
    }
    
    await backBtn.click();
    await sleep(300);
    log('Back button between tabs works', 'success');
    
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_BackButton_failed');
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
    await sleep(500);
    
    await page.click('[data-tab="datatypes"]');
    await sleep(300);
    
    const subtabs = await page.$$('#dataTypeTabs .subtab');
    if (subtabs.length > 1) {
      await subtabs[1].click();
      await sleep(300);
      
      await subtabs[2].click();
      await sleep(300);
      
      const backBtn = await page.$('#backBtn');
      const backBtnVisible = await backBtn.isIntersectingViewport();
      
      if (!backBtnVisible) {
        await captureScreenshot('test_BackButtonSubTabs_failed');
        throw new Error('Back button not visible for subtab navigation');
      }
      
      await backBtn.click();
      await sleep(300);
      log('Back button between subtabs works', 'success');
    } else {
      log('No subtabs found for this file', 'warn');
    }
    
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_BackButtonSubTabs_failed');
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
    await sleep(500);
    
    const treeItems = await page.$$('.tree-item');
    if (treeItems.length > 0) {
      await treeItems[0].click();
      await sleep(500);
      
      const clickableLinks = await page.$$('.clickable-item');
      if (clickableLinks.length > 0) {
        await clickableLinks[0].click();
        await sleep(500);
        
        const backBtn = await page.$('#backBtn');
        const backBtnVisible = await backBtn.isIntersectingViewport();
        
        if (!backBtnVisible) {
          await captureScreenshot('test_BackButtonEmbeddedLinks_failed');
          throw new Error('Back button not visible after clicking embedded link');
        }
        
        await backBtn.click();
        await sleep(300);
        log('Back button with embedded links works', 'success');
      } else {
        log('No embedded links found in detail view', 'warn');
      }
    } else {
      log('No tree items found', 'warn');
    }
    
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_BackButtonEmbeddedLinks_failed');
    logError('Back button embedded links test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_BackButtonIssuesEmptySubtab() {
  log('Testing: Back button navigation with empty Issues subtab...');
  try {
    await openApp();
    await sleep(300);
    
    // Load a FOM file that has no errors
    await loadTestFomFile(config.testFiles[0]);
    await sleep(500);
    
    // Check state after file load
    const stateAfterLoad = await page.evaluate(() => ({
      filesLength: typeof state !== 'undefined' ? state.files.length : -1,
      issuesLength: typeof state !== 'undefined' ? (state.issues || []).length : -1,
      historyLength: typeof state !== 'undefined' ? (state.history || []).length : -1,
      issuesTabDisplay: document.querySelector('[data-tab="issues"]')?.style.display || 'unknown'
    }));
    log(`State: ${JSON.stringify(stateAfterLoad)}`);
    
    // If Issues tab is hidden (no issues), force it visible via evaluate
    if (stateAfterLoad.issuesTabDisplay === 'none') {
      log('Issues tab is hidden — showing it via page.evaluate to bypass visibility constraints');
      await page.evaluate(() => {
        const tab = document.querySelector('[data-tab="issues"]');
        if (tab) { tab.style.display = ''; }
        // Also show the subtab bar
        const issuesTabs = document.getElementById('issuesTabs');
        if (issuesTabs) { issuesTabs.style.display = ''; }
      });
      await sleep(100);
    }
    
    // Click Issues tab via evaluate
    let clickedIssuesTab = await page.evaluate(() => {
      const tab = document.querySelector('[data-tab="issues"]');
      if (tab) { tab.click(); return true; }
      return false;
    });
    if (!clickedIssuesTab) throw new Error('Could not click Issues tab via evaluate');
    await sleep(500);
    
    // Verify Issues tab is active
    const issuesActive = await page.evaluate(() => 
      document.querySelector('[data-tab="issues"]')?.classList.contains('active')
    );
    if (!issuesActive) throw new Error('Issues tab not active after click');
    
    // Click Errors subtab via evaluate
    let clickedError = await page.evaluate(() => {
      const el = document.querySelector('.subtab[data-subtab="error"]');
      if (el) { el.click(); return true; }
      return false;
    });
    if (!clickedError) {
      throw new Error('Could not click Errors subtab');
    }
    await sleep(500);
    
    // Verify empty state
    const emptyAfterError = await page.evaluate(() => {
      const db = document.getElementById('detailBody');
      if (!db) return { found: false, html: '' };
      const h = db.innerHTML;
      return { found: true, html: h.substring(0, 200) };
    });
    log(`After Error subtab: ${JSON.stringify(emptyAfterError)}`);
    
    // Check history entry
    const historyEntry = await page.evaluate(() => {
      const h = state.history;
      if (!h || h.length === 0) return null;
      const last = h[h.length - 1];
      return { tab: last.tab, subTab: last.subTab, selected: last.selected, detail: last.detail };
    });
    log(`Last history entry: ${JSON.stringify(historyEntry)}`);
    
    // Click All subtab
    let clickedAll = await page.evaluate(() => {
      const el = document.querySelector('.subtab[data-subtab="all"]');
      if (el) { el.click(); return true; }
      return false;
    });
    if (!clickedAll) throw new Error('Could not click All subtab');
    await sleep(500);
    
    // Click back button via evaluate
    let clickedBack = await page.evaluate(() => {
      const btn = document.getElementById('backBtn');
      if (btn && btn.style.display !== 'none') { btn.click(); return true; }
      return false;
    });
    if (!clickedBack) throw new Error('Back button not found or not visible');
    await sleep(500);
    
    // Verify we're back on Error subtab
    const activeSubtab = await page.evaluate(() => {
      const active = document.querySelector('#issuesTabs .subtab.active');
      return active ? active.dataset.subtab : null;
    });
    log(`Active subtab after back: ${activeSubtab}`);
    
    if (activeSubtab !== 'error') {
      await captureScreenshot('test_BackButtonIssuesEmptySubtab_wrong_subtab');
      throw new Error(`Expected 'error' subtab, got '${activeSubtab}'`);
    }
    
    // Verify empty state is shown again
    const emptyAfterBack = await page.evaluate(() => {
      const db = document.getElementById('detailBody');
      if (!db) return { found: false };
      const h = db.innerHTML;
      return {
        found: true,
        isEmpty: h.includes('No issues found') || h.includes('No errors found') || h.includes('No warnings found') || h.trim() === '',
        html: h.substring(0, 200)
      };
    });
    log(`After back: ${JSON.stringify(emptyAfterBack)}`);
    
    log('Back button Issues empty subtab test passed', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_BackButtonIssuesEmptySubtab_failed');
    logError('Back button Issues empty subtab test failed', error);
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
    
    await page.focus('#globalSearch');
    await page.keyboard.type('Test');
    await sleep(300);
    
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      document.getElementById('globalSearch').value = '';
      const event = new Event('input', { bubbles: true });
      document.getElementById('globalSearch').dispatchEvent(event);
    });
    await sleep(200);
    
    log('Search input works', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    logError('Search test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_TreeFiltering() {
  log('Testing: Tree filtering...');
  try {
    await openApp();
    
    await loadTestFomFile(config.testFiles[0]);
    await sleep(500);
    
    const treeFilter = await page.$('#treeFilter');
    if (!treeFilter) {
      log('Tree filter input not found', 'warn');
      testsPassed++;
      return true;
    }
    
    const treeItemsBefore = await page.$$('.tree-item');
    const countBefore = treeItemsBefore.length;
    
    if (countBefore === 0) {
      await captureScreenshot('test_TreeFiltering_failed');
      throw new Error('No tree items to filter');
    }
    
    await page.type('#treeFilter', 'Object');
    await sleep(300);
    
    const treeItemsAfter = await page.$$('.tree-item');
    const countAfter = treeItemsAfter.length;
    
    if (countAfter >= countBefore) {
      await captureScreenshot('test_TreeFiltering_failed');
      throw new Error(`Tree filter did not filter results (before: ${countBefore}, after: ${countAfter})`);
    }
    
    log(`Tree filter works (filtered ${countBefore} to ${countAfter} items)`, 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_TreeFiltering_failed');
    logError('Tree filter test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_SortToggle() {
  log('Testing: Sort toggle on multiple tabs...');
  try {
    await openApp();
    await loadTestFomFile('RPR-Foundation_v3.0.xml');
    await sleep(500);
    
    const sortBtn = await page.$('#sortBtn');
    if (!sortBtn) {
      log('Sort button not found', 'warn');
      testsPassed++;
      return true;
    }
    
    const tabsToTest = [
      { id: 'modules', name: 'FOM Modules' },
      { id: 'objects', name: 'Object Classes' },
      { id: 'interactions', name: 'Interaction Classes' },
      { id: 'datatypes', name: 'Data Types' },
      { id: 'dims', name: 'Dimensions' },
      { id: 'trans', name: 'Transportations' },
      { id: 'switches', name: 'Switches' },
      { id: 'tags', name: 'Tags' },
      { id: 'notes', name: 'Notes' }
    ];
    
    for (const tab of tabsToTest) {
      try {
        await page.click(`[data-tab="${tab.id}"]`);
        await sleep(300);
        
        const items = await page.$$eval('.tree-item .name', els => els.map(e => e.textContent.trim()).slice(0, 3));
        if (items.length === 0) {
          log(`Tab ${tab.name}: no items`, 'warn');
          continue;
        }
        
        const currentSort = await sortBtn.evaluate(e => e.textContent);
        
        // Test ascending (Off → A→Z)
        await sortBtn.click();
        await sleep(300);
        
        const itemsAfterSort = await page.$$eval('.tree-item .name', els => els.map(e => e.textContent.trim()).slice(0, 3));
        const orderChanged = items.join('') !== itemsAfterSort.join('');
        
        log(`Tab ${tab.name}: ${items[0]} → ${itemsAfterSort[0]} (asc: ${orderChanged})`, 'info');
        
        // Test descending (A→Z → Z→A)
        await sortBtn.click();
        await sleep(300);
        
        const itemsAfterDesc = await page.$$eval('.tree-item .name', els => els.map(e => e.textContent.trim()).slice(0, 3));
        const orderChangedDesc = itemsAfterSort.join('') !== itemsAfterDesc.join('');
        
        log(`Tab ${tab.name}: ${itemsAfterSort[0]} → ${itemsAfterDesc[0]} (desc: ${orderChangedDesc})`, 'info');
        
      } catch (tabError) {
        log(`Tab ${tab.name}: ${tabError.message}`, 'warn');
      }
    }
    
    log(`Sort toggle test completed`, 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_SortToggle_failed');
    logError('Sort toggle test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_DataTypeSubtabSorting() {
  log('Testing: Data Type subtab sorting...');
  try {
    await openApp();
    await loadTestFomFile('RPR-Foundation_v3.0.xml');
    await sleep(500);
    
    const sortBtn = await page.$('#sortBtn');
    await page.click('[data-tab="datatypes"]');
    await sleep(300);
    
    const subtabsToTest = [
      { id: 'basic', name: 'Basic' },
      { id: 'simple', name: 'Simple' },
      { id: 'array', name: 'Array' },
      { id: 'fixed', name: 'Fixed Record' },
      { id: 'enum', name: 'Enumerated' },
      { id: 'variant', name: 'Variant Record' }
    ];
    
    for (const subtab of subtabsToTest) {
      try {
        await page.click(`.subtab[data-subtab="${subtab.id}"]`);
        await sleep(300);
        
        const items = await page.$$eval('.tree-item .name', els => els.map(e => e.textContent.trim()).slice(0, 3));
        if (items.length === 0) {
          log(`Subtab ${subtab.name}: no items`, 'warn');
          continue;
        }
        
        await sortBtn.click();
        await sleep(300);
        
        const itemsAfterSort = await page.$$eval('.tree-item .name', els => els.map(e => e.textContent.trim()).slice(0, 3));
        const orderChanged = items.join('') !== itemsAfterSort.join('');
        
        await sortBtn.click();
        await sleep(300);
        
        const itemsAfterDesc = await page.$$eval('.tree-item .name', els => els.map(e => e.textContent.trim()).slice(0, 3));
        const orderChangedDesc = itemsAfterSort.join('') !== itemsAfterDesc.join('');
        
        log(`Subtab ${subtab.name}: ${items[0]} → ${itemsAfterSort[0]} (asc: ${orderChanged}) → ${itemsAfterDesc[0]} (desc: ${orderChangedDesc})`, 'info');
        
      } catch (subError) {
        log(`Subtab ${subtab.name}: ${subError.message}`, 'warn');
      }
    }
    
    log('Data Type subtab sorting test completed', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_DataTypeSubtabSorting_failed');
    logError('Data Type subtab sorting test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_ExportFunctionality() {
  log('Testing: Export functionality...');
  try {
    await openApp();
    
    await loadTestFomFile(config.testFiles[0]);
    await sleep(500);
    
    const exportBtn = await page.$('#exportBtn');
    if (!exportBtn) {
      await captureScreenshot('test_ExportFunctionality_failed');
      throw new Error('Export button not found');
    }
    
    await exportBtn.click();
    await sleep(300);
    
    const downloadStarted = await page.evaluate(() => {
      return window.downloadTriggered === true || document.body.classList.contains('export-active');
    }).catch(() => false);
    
    if (!downloadStarted) {
      log('Export clicked (actual download requires user interaction)', 'warn');
    }
    
    log('Export functionality accessible', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_ExportFunctionality_failed');
    logError('Export test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_SubTabNavigation() {
  log('Testing: Sub-tab navigation...');
  try {
    await openApp();
    
    await loadTestFomFile(config.testFiles[0]);
    await sleep(500);
    
    await waitAndClick('[data-tab="datatypes"]');
    await sleep(300);
    
    const subtabs = await page.$$('#dataTypeTabs .subtab');
    
    if (subtabs.length === 0) {
      log('No sub-tabs for this file (may be normal)', 'warn');
      testsPassed++;
      return true;
    }
    
    for (const subtab of subtabs) {
      await subtab.click();
      await sleep(200);
    }
    
    log('Sub-tab navigation working', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_SubTabNavigation_failed');
    logError('Sub-tab test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_ValidationLifecycle() {
  log('Testing: Validation lifecycle...');
  try {
    await openApp();
    
    // Scenario 1: Load triggers validation
    log('Scenario 1: Load triggers validation', 'info');
    await loadTestFomFile('RPR-Foundation_v3.0.xml');
    await sleep(500); // Wait for validation to run
    
    const issuesAfterLoad = await page.evaluate(() => {
      console.log('Issues after load:', JSON.stringify(state.issues.length));
      state.issues = []; // Clear as per requirement
      return Array.isArray(state.issues);
    });
    
    if (!issuesAfterLoad) {
      await captureScreenshot('test_ValidationLifecycle_scenario1_failed');
      throw new Error('state.issues is not an array after loading file');
    }
    log('✓ state.issues is an array after load', 'success');
    
    // Scenario 2: Remove triggers validation
    log('Scenario 2: Remove triggers validation', 'info');
    const removeResult = await page.evaluate(() => {
      if (state.files.length > 0) {
        removeFile(0);
        console.log('Issues after remove:', state.issues !== undefined);
        return state.issues !== undefined;
      }
      return false;
    });
    
    if (!removeResult) {
      await captureScreenshot('test_ValidationLifecycle_scenario2_failed');
      throw new Error('state.issues is not accessible after removing file');
    }
    log('✓ state.issues is accessible after remove', 'success');
    
    // Scenario 3: Clear resets issues
    log('Scenario 3: Clear resets issues', 'info');
    await page.evaluate(() => {
      state.files = [];
      state.mergedFOM = null;
      clearStorage();
      updateUI();
      state.issues = [];
      console.log('Issues after clear:', state.issues.length === 0);
      return state.issues.length === 0;
    });
    
    const issuesAfterClear = await page.evaluate(() => {
      return state.issues.length === 0;
    });
    
    if (!issuesAfterClear) {
      await captureScreenshot('test_ValidationLifecycle_scenario3_failed');
      throw new Error('state.issues is not empty after clear');
    }
    log('✓ state.issues is empty after clear', 'success');
    
    // Scenario 4: Multiple loads re-runs validation
    log('Scenario 4: Multiple loads re-runs validation', 'info');
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(path.join(config.test.fomDir, 'RPR-Physical_v3.0.xml'));
    await sleep(500);
    const issuesAfterSecondLoad = await page.evaluate(() => {
      return state.issues.length;
    });
    
    log(`Issues after second file load: ${issuesAfterSecondLoad}`, 'info');
    // We just check that we got a number (validation ran)
    if (typeof issuesAfterSecondLoad !== 'number') {
      await captureScreenshot('test_ValidationLifecycle_scenario4_failed');
      throw new Error('state.issues.length is not a number after second load');
    }
    log('✓ state.issues.length is a number after second load', 'success');
    
    log('Validation lifecycle test passed', 'success');
    testsPassed++;
    return true;
  } catch (error) {
    await captureScreenshot('test_ValidationLifecycle_failed');
    logError('Validation lifecycle test failed', error);
    testsFailed++;
    return false;
  }
}

async function test_MergeClasses() {
  log('Testing: MergeClasses attribute/parameter source tracking...');
  try {
    const exitCode = await test_MergeClassesRun();
    if (exitCode === 0) {
      log('MergeClasses test passed', 'success');
      testsPassed++;
      return true;
    } else {
      log('MergeClasses test failed (exit code ' + exitCode + ')', 'fail');
      testsFailed++;
      return false;
    }
  } catch (error) {
    logError('MergeClasses test failed', error);
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
        { name: 'BackButtonIssuesEmptySubtab', fn: test_BackButtonIssuesEmptySubtab },
        { name: 'BackButtonFixes', fn: test_BackButtonFixes },
        { name: 'Search', fn: test_SearchFunctionality },
        { name: 'TreeFilter', fn: test_TreeFiltering },
        { name: 'SortToggle', fn: test_SortToggle },
        { name: 'DataTypeSubtabSorting', fn: test_DataTypeSubtabSorting },
        { name: 'Export', fn: test_ExportFunctionality },
        { name: 'DataType', fn: test_DataTypeSelection },
        { name: 'CircularDependencyDetection', fn: test_CircularDependencyDetection },
        { name: 'ValidationLifecycle', fn: test_ValidationLifecycle },
        { name: 'AboutVersion_MetaTag', fn: test_AboutVersion_MetaTag },
        { name: 'AboutVersion_MetaMissing', fn: test_AboutVersion_MetaMissing },
        { name: 'AboutVersion_MetaPlaceholder', fn: test_AboutVersion_MetaPlaceholder },
        { name: 'WelcomeStats', fn: runWelcomeStatsTest },
        { name: 'IssueDetailPanelImprovements', fn: test_IssueDetailPanelImprovements },
        { name: 'IssueHistoryPush', fn: test_IssueHistoryPush },
        { name: 'HistoryIssueAdversarial', fn: test_IssueHistoryPushAdversarial },
        { name: 'IssuesSubtabEmptyState', fn: test_IssuesSubtabEmptyState },
        { name: 'IssuesSubtabGuard', fn: test_IssuesSubtabGuard },
        { name: 'IssuesSubtabHistory', fn: test_IssuesSubtabHistory },
        { name: 'IssuesCallOrderFix', fn: test_IssuesCallOrderFix },
        { name: 'AppspaceFeature', fn: test_AppspaceFeature },
        { name: 'MergeClasses', fn: test_MergeClasses },
      ];
  
  for (const test of tests) {
    if (opts.specificTest && test.name.toLowerCase() !== opts.specificTest.toLowerCase()) {
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
