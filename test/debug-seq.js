const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('./config');
(async () => {
  const b = await puppeteer.launch({ headless: true, args: config.browser.args, executablePath: config.browser.executablePath });
  const p = await b.newPage();
  p.on('console', msg => {
    const t = msg.text();
    if (t.includes('[TRACE]') || t.includes('PAGEERROR')) console.log(t);
  });
  p.on('pageerror', err => console.error('PAGEERROR:', err));
  await p.goto('file://' + path.resolve(__dirname, '../fom-viewer.html'), { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => document.getElementById('app'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  // Instrument the subtab click handler
  await p.evaluate(() => {
    const origAdd = document.addEventListener;
    document.addEventListener = function(type, fn, opts) {
      if (type === 'click') {
        const wrapped = function(e) {
          const tab = e.target.closest('#dataTypeTabs .subtab');
          if (tab) {
            console.log('[TRACE] dataType subtab clicked:', tab.dataset.subtab);
            console.log('[TRACE] currentSubTab before handler:', window.state?.currentSubTab);
          }
          return fn.call(this, e);
        };
        return origAdd.call(document, type, wrapped, opts);
      }
      return origAdd.call(document, type, fn, opts);
    };
  });
  const fi = await p.$('#fileInput');
  await fi.uploadFile(path.join(config.test.fomDir, 'HLAstandardMIM.xml'));
  await p.waitForFunction(() => {
    const h = document.getElementById('detailHeader');
    return h && getComputedStyle(h).display === 'block';
  }, { timeout: 10000 });
  // Go through tabs as the test does
  await p.click('[data-tab="datatypes"]');
  await p.waitForTimeout(200);
  for (const sub of ['basic', 'simple', 'array', 'fixed']) {
    const chip = await p.$(`.subtab[data-subtab="${sub}"]`);
    if (chip) await chip.click();
    await p.waitForTimeout(300);
  }
  // Now try variant
  console.log('[TRACE] About to click variant');
  const vc = await p.$('.subtab[data-subtab="variant"]');
  console.log('[TRACE] variant class:', await vc.evaluate(el => el.className));
  await vc.click();
  await p.waitForTimeout(600);
  const es = await p.$('.datatype-list .empty-state');
  console.log('[TRACE] variant empty state:', !!es);
  if (!es) {
    const cnt = await p.$$eval('.datatype-list .tree-item', els => els.length);
    console.log('[TRACE] items count:', cnt);
    const names = await p.$$eval('.datatype-list .tree-item', els => els.map(e => e.textContent));
    console.log('[TRACE] items:', names);
  } else {
    console.log('[TRACE] empty text:', await es.evaluate(el => el.textContent));
  }
  await b.close();
})();
