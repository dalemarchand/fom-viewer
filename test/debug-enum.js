const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('./config');
(async () => {
  const b = await puppeteer.launch({ headless: true, args: config.browser.args, executablePath: config.browser.executablePath });
  const p = await b.newPage();
  p.on('console', msg => { if (msg.type() === 'error') console.error('ERR:', msg.text()); });
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
  await p.click('[data-tab="datatypes"]');
  await new Promise(r => setTimeout(r, 400));
  const ec = await p.$('.subtab[data-subtab="enum"]');
  console.log('enum chip found:', !!ec);
  if (ec) {
    await ec.click();
    await new Promise(r => setTimeout(r, 600));
    const items = await p.$$('.datatype-list .tree-item');
    console.log('enum items count:', items.length);
    const names = await p.$$eval('.datatype-list [data-name]', els => els.map(e => e.getAttribute('data-name')));
    console.log('data-names in datatype-list:', names);
    const hb = await p.$('[data-name="HLAboolean"]');
    console.log('HLAboolean found globally:', !!hb);
  }
  await new Promise(r => setTimeout(r, 300));
  const vc = await p.$('.subtab[data-subtab="variant"]');
  if (vc) {
    await vc.click();
    await new Promise(r => setTimeout(r, 600));
    const es = await p.$('.datatype-list .empty-state');
    console.log('variant empty state found:', !!es);
    if (es) {
      const t = await es.evaluate(el => el.textContent);
      console.log('empty text:', JSON.stringify(t));
    }
    const vitems = await p.$$('.datatype-list .tree-item');
    console.log('variant items count:', vitems.length);
  }
  await b.close();
})();
