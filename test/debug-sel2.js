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
  // Navigate as test does
  await p.click('[data-tab="objects"]'); await p.waitForTimeout(100);
  await p.click('[data-tab="interactions"]'); await p.waitForTimeout(100);
  await p.click('[data-tab="datatypes"]'); await p.waitForTimeout(200);
  const subs = ['basic', 'simple', 'array', 'fixed'];
  for (const sub of subs) {
    const chip = await p.$(`.subtab[data-subtab="${sub}"]`);
    if (chip) await chip.click();
    await p.waitForTimeout(300);
  }
  const fi = await p.$('[data-name="HLAinteractionSubscription"]');
  if (fi) await fi.click();
  await p.waitForTimeout(300);
  
  // Check selectedItem via Object.keys
  const selInfo = await p.evaluate(() => {
    const sel = state.selectedItem;
    const keys = sel ? Object.keys(sel) : [];
    return {
      keys: keys,
      name: sel?.name,
      type: sel?.type,
      isNull: sel === null,
      selType: typeof sel
    };
  });
  console.log('selectedItem after fixed item click:', JSON.stringify(selInfo));
  
  // Now click variant chip
  const vc = await p.$('.subtab[data-subtab="variant"]');
  await vc.click();
  await p.waitForTimeout(100);
  
  const selInfo2 = await p.evaluate(() => {
    const sel = state.selectedItem;
    const keys = sel ? Object.keys(sel) : [];
    return {
      keys: keys,
      name: sel?.name,
      type: sel?.type,
      isNull: sel === null,
      isUndefined: sel === undefined,
      selType: typeof sel
    };
  });
  console.log('selectedItem after variant click:', JSON.stringify(selInfo2));
  
  await b.close();
})();
