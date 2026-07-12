const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('./config');
(async () => {
  const b = await puppeteer.launch({ headless: true, args: config.browser.args, executablePath: config.browser.executablePath });
  const p = await b.newPage();
  p.on('console', msg => console.log('CONSOLE:', msg.text()));
  p.on('pageerror', err => console.error('PAGEERROR:', err));
  await p.goto('file://' + path.resolve(__dirname, '../fom-viewer.html'), { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => document.getElementById('app'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  const fi = await p.$('#fileInput');
  await fi.uploadFile(path.join(config.test.fomDir, 'HLAstandardMIM.xml'));
  await p.waitForFunction(() => {
    const h = document.getElementById('detailHeader');
    return h && getComputedStyle(h).display === 'block';
  }, { timeout: 10000 });
  // Simulate test sequence: go to datatypes, basic, simple, array, fixed, variant
  await p.click('[data-tab="datatypes"]');
  await p.waitForTimeout(200);
  // Click through each subtab
  for (const sub of ['basic', 'simple', 'array', 'fixed']) {
    const chip = await p.$(`.subtab[data-subtab="${sub}"]`);
    await chip.click();
    await p.waitForTimeout(300);
    const cnt = await p.$$eval('.datatype-list .tree-item', els => els.length);
    console.log(`After ${sub}: ${cnt} items`);
  }
  // Now try variant
  const vc = await p.$('.subtab[data-subtab="variant"]');
  console.log('variant chip class:', await vc.evaluate(el => el.className));
  await vc.click();
  await p.waitForTimeout(600);
  const es = await p.$('.datatype-list .empty-state');
  console.log('variant empty state:', !!es);
  if (es) {
    const t = await es.evaluate(el => el.textContent);
    console.log('empty text:', JSON.stringify(t));
  } else {
    const cnt = await p.$$eval('.datatype-list .tree-item', els => els.length);
    console.log('variant items (no empty state):', cnt);
    const names = await p.$$eval('.datatype-list .tree-item', els => els.map(e => e.textContent));
    console.log('names:', names);
  }
  await b.close();
})();
