const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('./config');
(async () => {
  const b = await puppeteer.launch({ headless: true, args: config.browser.args, executablePath: config.browser.executablePath });
  const p = await b.newPage();
  const errors = [];
  p.on('pageerror', err => errors.push(err.message));
  await p.goto('file://' + path.resolve(__dirname, '../fom-viewer.html'), { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => document.getElementById('app'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  const fileInput = await p.$('#fileInput');
  await fileInput.uploadFile(path.join(config.test.fomDir, 'HLAstandardMIM.xml'));
  await p.waitForFunction(() => {
    const h = document.getElementById('detailHeader');
    return h && getComputedStyle(h).display === 'block';
  }, { timeout: 10000 });
  // Navigate exactly as the test
  await p.click('[data-tab="objects"]'); await p.waitForTimeout(100);
  await p.click('[data-tab="interactions"]'); await p.waitForTimeout(100);
  await p.click('[data-tab="datatypes"]'); await p.waitForTimeout(200);
  
  const subs = ['basic', 'simple', 'array', 'fixed'];
  for (const sub of subs) {
    const chip = await p.$(`.subtab[data-subtab="${sub}"]`);
    if (chip) await chip.click();
    await p.waitForTimeout(300);
  }
  // Click fixed item HLAinteractionSubscription
  const fixedItem = await p.$('[data-name="HLAinteractionSubscription"]');
  if (fixedItem) await fixedItem.click();
  await p.waitForTimeout(300);
  
  // NOW: trace each step of clicking variant
  const trace = await p.evaluate(() => {
    const steps = [];
    steps.push({ step: 'pre', subTab: state.currentSubTab, sel: state.selectedItem?.name, tab: state.currentTab });
    // Find variant chip
    const vc = document.querySelector('.subtab[data-subtab="variant"]');
    steps.push({ step: 'chip-found', exists: !!vc });
    if (!vc) return steps;
    // Simulate the click handler
    const prevShowing = document.getElementById('detailHeader')?.style.display !== 'none';
    if (state.currentSubTab !== 'variant') {
      if (prevShowing) {
        // push history
      }
    }
    document.querySelectorAll('#dataTypeTabs .subtab').forEach(t => t.classList.remove('active'));
    vc.classList.add('active');
    state.currentSubTab = 'variant';
    state.selectedItem = null;
    steps.push({ step: 'post-state', subTab: state.currentSubTab, sel: state.selectedItem, tab: state.currentTab });
    updateUI();
    steps.push({ step: 'post-ui', subTab: state.currentSubTab, sel: state.selectedItem, tab: state.currentTab });
    const dl = document.querySelector('.datatype-list');
    steps.push({ step: 'post-dom', dlExists: !!dl });
    if (dl) {
      const es = dl.querySelector('.empty-state');
      steps.push({ step: 'post-dom-empty', empty: !!es });
      steps.push({ step: 'post-dom-items', count: dl.querySelectorAll('.tree-item').length });
    }
    return steps;
  });
  console.log('Trace:', JSON.stringify(trace, null, 2));
  console.log('Page errors:', errors);
  await b.close();
})();
