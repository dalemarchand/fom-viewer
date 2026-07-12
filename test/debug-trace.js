const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('./config');
(async () => {
  const b = await puppeteer.launch({ headless: true, args: config.browser.args, executablePath: config.browser.executablePath });
  const p = await b.newPage();
  p.on('pageerror', err => console.error('PAGEERROR:', err));
  await p.goto('file://' + path.resolve(__dirname, '../fom-viewer.html'), { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => document.getElementById('app'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  const fileInput = await p.$('#fileInput');
  await fileInput.uploadFile(path.join(config.test.fomDir, 'HLAstandardMIM.xml'));
  await p.waitForFunction(() => {
    const h = document.getElementById('detailHeader');
    return h && getComputedStyle(h).display === 'block';
  }, { timeout: 10000 });
  // Navigate through all tabs/subtabs as test does
  await p.click('[data-tab="objects"]');
  await p.waitForTimeout(100);
  await p.click('[data-tab="datatypes"]');
  await p.waitForTimeout(200);
  
  const subs = ['basic', 'simple', 'array', 'fixed'];
  for (const sub of subs) {
    const chip = await p.$(`.subtab[data-subtab="${sub}"]`);
    if (chip) await chip.click();
    await p.waitForTimeout(300);
    // Click first item
    const firstItem = await p.$('.datatype-list .tree-item:first-child');
    if (firstItem) await firstItem.click();
    await p.waitForTimeout(200);
  }
  
  // Check state
  const st = await p.evaluate(() => ({
    currentSubTab: window.state?.currentSubTab,
    selectedItem: window.state?.selectedItem,
    dlc: window.__dataTypeListComponent ? 'exists' : 'null'
  }));
  console.log('State before variant:', JSON.stringify(st));
  
  // Now evaluate the exact sequence
  await p.evaluate(() => {
    console.log('[TRACE] currentTab:', window.state.currentTab, 'currentSubTab:', window.state.currentSubTab);
    const items = window.state.mergedFOM?.dataTypes?.variant;
    console.log('[TRACE] variant dataTypes:', items, 'length:', items?.length);
    window.state.currentSubTab = 'variant';
    window.state.selectedItem = null;
    console.log('[TRACE] calling updateUI...');
    window.updateUI();
    console.log('[TRACE] updateUI returned');
    console.log('[TRACE] dlc after updateUI:', window.__dataTypeListComponent ? 'exists' : 'null');
  });
  await p.waitForTimeout(800);
  
  const after = await p.evaluate(() => ({
    activeSubtab: document.querySelector('#dataTypeTabs .subtab.active')?.dataset?.subtab,
    emptyState: !!document.querySelector('.datatype-list .empty-state'),
    itemCount: document.querySelectorAll('.datatype-list .tree-item').length,
    dlcItems: window.__dataTypeListComponent ? 'exists' : 'null',
    sortedItems: window.__dataTypeListComponent ? 'has setItems' : 'null'
  }));
  console.log('After variant:', JSON.stringify(after));
  
  await b.close();
})();
