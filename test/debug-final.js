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
  // Click through all tabs just like the test does
  const tabIds = ['objects','interactions','datatypes','appspaces','dims','trans','switches','tags','notes'];
  for (const tid of tabIds) {
    const tab = await p.$(`[data-tab="${tid}"]`);
    if (tab) await tab.click();
    await p.waitForTimeout(80);
  }
  // Back to datatypes
  await p.click('[data-tab="datatypes"]');
  await p.waitForTimeout(200);
  // basic subtab click
  await (await p.$('.subtab[data-subtab="basic"]')).click();
  await p.waitForTimeout(150);
  // simple
  await (await p.$('.subtab[data-subtab="simple"]')).click();
  await p.waitForTimeout(150);
  // array
  await (await p.$('.subtab[data-subtab="array"]')).click();
  await p.waitForTimeout(150);
  // fixed
  await (await p.$('.subtab[data-subtab="fixed"]')).click();
  await p.waitForTimeout(150);
  // Click HLAinteractionSubscription in fixed items
  const fi = await p.$('[data-name="HLAinteractionSubscription"]');
  if (fi) await fi.click();
  await p.waitForTimeout(200);
  
  // Now test variant - extract AND click
  const trace = await p.evaluate(() => {
    const r = {};
    r.activeSubBefore = document.querySelector('#dataTypeTabs .subtab.active')?.dataset?.subtab;
    r.stateSubBefore = state.currentSubTab;
    // Count items in datatype-list
    r.itemsBefore = document.querySelectorAll('.datatype-list .tree-item').length;
    return r;
  });
  console.log('Before variant click:', JSON.stringify(trace));
  
  // Click variant chip
  const vc = await p.$('.subtab[data-subtab="variant"]');
  console.log('Variant chip found:', !!vc, 'classes:', await vc.evaluate(el => el.className));
  await vc.click();
  await p.waitForTimeout(100);
  
  const after = await p.evaluate(() => {
    return {
      activeSub: document.querySelector('#dataTypeTabs .subtab.active')?.dataset?.subtab,
      stateSub: state.currentSubTab,
      selected: state.selectedItem,
      items: document.querySelectorAll('.datatype-list .tree-item').length,
      empty: !!document.querySelector('.datatype-list .empty-state'),
      dtl: document.querySelector('.datatype-list')?.querySelectorAll('*').length || 0
    };
  });
  console.log('After variant click (100ms):', JSON.stringify(after));
  
  await p.waitForTimeout(1500);
  const after2 = await p.evaluate(() => ({
    items: document.querySelectorAll('.datatype-list .tree-item').length,
    empty: !!document.querySelector('.datatype-list .empty-state'),
    html: document.querySelector('.datatype-list')?.innerHTML?.substring(0, 200)
  }));
  console.log('After variant click (1.5s):', JSON.stringify(after2));
  
  await b.close();
})();
