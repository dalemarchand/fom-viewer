const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('./config');
(async () => {
  const b = await puppeteer.launch({ headless: true, args: config.browser.args, executablePath: config.browser.executablePath });
  const p = await b.newPage();
  await p.goto('file://' + path.resolve(__dirname, '../fom-viewer.html'), { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => document.getElementById('app'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  const fileInput = await p.$('#fileInput');
  await fileInput.uploadFile(path.join(config.test.fomDir, 'HLAstandardMIM.xml'));
  await p.waitForFunction(() => {
    const h = document.getElementById('detailHeader');
    return h && getComputedStyle(h).display === 'block';
  }, { timeout: 10000 });
  await p.click('[data-tab="objects"]'); await p.waitForTimeout(100);
  await p.click('[data-tab="datatypes"]'); await p.waitForTimeout(200);
  const subs = ['basic', 'simple', 'array', 'fixed'];
  for (const sub of subs) {
    const chip = await p.$(`.subtab[data-subtab="${sub}"]`);
    if (chip) await chip.click();
    await p.waitForTimeout(300);
  }
  const fixedItem = await p.$('[data-name="HLAinteractionSubscription"]');
  if (fixedItem) await fixedItem.click();
  await p.waitForTimeout(300);
  
  // Check state BEFORE clicking variant
  const stateBefore = await p.evaluate(() => ({
    subTab: state.currentSubTab,
    sel: state.selectedItem?.name
  }));
  console.log('State before:', JSON.stringify(stateBefore));
  
  // Click variant chip
  const vc = await p.$('.subtab[data-subtab="variant"]');
  await vc.click();
  
  // Check state AFTER in same microtask
  const stateAfter = await p.evaluate(() => ({
    subTab: state.currentSubTab,
    sel: state.selectedItem,
    dlc: !!window.__dataTypeListComponent
  }));
  console.log('State after click:', JSON.stringify(stateAfter));
  
  // Wait and check DOM
  await p.waitForTimeout(100);
  const dom100 = await p.evaluate(() => ({
    empty: !!document.querySelector('.datatype-list .empty-state'),
    items: document.querySelectorAll('.datatype-list .tree-item').length
  }));
  console.log('DOM after 100ms:', JSON.stringify(dom100));
  
  await p.waitForTimeout(500);
  const dom600 = await p.evaluate(() => ({
    empty: !!document.querySelector('.datatype-list .empty-state'),
    items: document.querySelectorAll('.datatype-list .tree-item').length
  }));
  console.log('DOM after 600ms:', JSON.stringify(dom600));
  
  await p.waitForTimeout(1000);
  const dom1600 = await p.evaluate(() => ({
    empty: !!document.querySelector('.datatype-list .empty-state'),
    items: document.querySelectorAll('.datatype-list .tree-item').length
  }));
  console.log('DOM after 1600ms:', JSON.stringify(dom1600));
  
  await b.close();
})();
