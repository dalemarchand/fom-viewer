const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('./config');
(async () => {
  const b = await puppeteer.launch({ headless: true, args: config.browser.args, executablePath: config.browser.executablePath });
  const p = await b.newPage();
  await p.goto('file://' + path.resolve(__dirname, '../fom-viewer.html'), { waitUntil: 'networkidle0' });
  await p.waitForFunction(() => document.getElementById('app'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));
  // Test selectedItem serialization
  const r = await p.evaluate(() => {
    return {
      type: typeof state.selectedItem,
      value: state.selectedItem,
      isNull: state.selectedItem === null,
      json: JSON.stringify(state.selectedItem),
      keys: state.selectedItem ? Object.keys(state.selectedItem) : 'null'
    };
  });
  console.log('selectedItem before load:', JSON.stringify(r));
  
  const fileInput = await p.$('#fileInput');
  await fileInput.uploadFile(path.join(config.test.fomDir, 'HLAstandardMIM.xml'));
  await p.waitForFunction(() => {
    const h = document.getElementById('detailHeader');
    return h && getComputedStyle(h).display === 'block';
  }, { timeout: 10000 });
  
  const r2 = await p.evaluate(() => {
    return {
      type: typeof state.selectedItem,
      value: state.selectedItem,
      isNull: state.selectedItem === null,
      name: state.selectedItem?.name
    };
  });
  console.log('selectedItem after load:', JSON.stringify(r2));
  
  // After some navigation
  await p.click('[data-tab="objects"]');
  await p.waitForTimeout(200);
  const firstItem = await p.$('.tree-item');
  if (firstItem) await firstItem.click();
  await p.waitForTimeout(200);
  
  const r3 = await p.evaluate(() => {
    return {
      value: state.selectedItem,
      isNull: state.selectedItem === null,
      isObj: typeof state.selectedItem === 'object' && state.selectedItem !== null,
      keys: state.selectedItem ? Object.keys(state.selectedItem) : 'null'
    };
  });
  console.log('selectedItem after object click:', JSON.stringify(r3));
  
  // Set to null via state setter
  await p.evaluate(() => { state.selectedItem = null; });
  const r4 = await p.evaluate(() => {
    return {
      value: state.selectedItem,
      isNull: state.selectedItem === null,
      typeof: typeof state.selectedItem
    };
  });
  console.log('selectedItem after set null:', JSON.stringify(r4));
  
  await b.close();
})();
