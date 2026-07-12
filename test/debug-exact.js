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
  // Load file
  const fileInput = await p.$('#fileInput');
  await fileInput.uploadFile(path.join(config.test.fomDir, 'HLAstandardMIM.xml'));
  await p.waitForFunction(() => {
    const h = document.getElementById('detailHeader');
    return h && getComputedStyle(h).display === 'block';
  }, { timeout: 10000 });
  // Simulate: objects tab click
  await p.click('[data-tab="objects"]');
  await p.waitForTimeout(100);
  await p.click('[data-tab="datatypes"]');
  await p.waitForTimeout(200);
  // basic
  const basicChip = await p.$('.subtab[data-subtab="basic"]');
  await basicChip.click(); await p.waitForTimeout(300);
  // simple
  const simpleChip = await p.$('.subtab[data-subtab="simple"]');
  await simpleChip.click(); await p.waitForTimeout(300);
  // array
  const arrayChip = await p.$('.subtab[data-subtab="array"]');
  await arrayChip.click(); await p.waitForTimeout(300);
  // fixed
  const fixedChip = await p.$('.subtab[data-subtab="fixed"]');
  await fixedChip.click(); await p.waitForTimeout(300);
  
  // Now click first fixed item
  const firstFixed = await p.$('.datatype-list .tree-item:first-child');
  if (firstFixed) await firstFixed.click();
  await p.waitForTimeout(300);
  
  // ===== NOW SIMULATE TEST 26 =====
  console.log('Current subtab active:', await p.$eval('#dataTypeTabs .subtab.active', el => el.dataset.subtab));
  const activeCount = await p.$$eval('#dataTypeTabs .subtab.active', els => els.length);
  console.log('Active chips count:', activeCount);
  const hasDtypeFilter = await p.$('#dataTypeFilter');
  console.log('dataTypeFilter exists:', !!hasDtypeFilter);
  if (hasDtypeFilter) {
    const fv = await hasDtypeFilter.evaluate(el => el.value);
    console.log('dataTypeFilter value:', JSON.stringify(fv));
    if (fv) {
      // Clear the filter
      await hasDtypeFilter.evaluate(el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await p.waitForTimeout(300);
    }
  }
  
  // Click variant
  const variantChip = await p.$('.subtab[data-subtab="variant"]');
  console.log('variant chip found:', !!variantChip);
  if (variantChip) {
    await variantChip.click();
    await p.waitForTimeout(600);
    const activeAfter = await p.$eval('#dataTypeTabs .subtab.active', el => el.dataset.subtab);
    console.log('active subtab after variant click:', activeAfter);
    const es = await p.$('.datatype-list .empty-state');
    console.log('empty state:', !!es);
    if (!es) {
      const cnt = await p.$$eval('.datatype-list .tree-item', els => els.length);
      console.log('items count:', cnt);
    }
    const dlc = await p.evaluate(() => {
      return window.__dataTypeListComponent ? 'exists' : 'null';
    });
    console.log('dataTypeListComponent:', dlc);
  }
  await b.close();
})();
