const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('./config');
(async () => {
  const browser = await puppeteer.launch({
    headless: true, args: config.browser.args,
    executablePath: config.browser.executablePath
  });
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  const htmlPath = path.resolve(__dirname, '../fom-viewer.html');
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.getElementById('app'), { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1500));
  const fi = await page.$('#fileInput');
  await fi.uploadFile(path.join(config.test.fomDir, 'SubspaceTest.xml'));
  await page.waitForFunction(() => state.files && state.files.length >= 1, { timeout: 10000 });
  await new Promise(r => setTimeout(r, 500));
  const info = await page.evaluate(() => ({
    dims: state.files.map(f => ({ name: f.name || f.fileName, dims: (f.dimensions||[]).map(d => ({ n: d.name, r: d.rows, c: d.isComplex })) })),
    enums: (state.mergedFOM?.dataTypes?.enum || []).map(e => e.name),
    subspaceDims: JSON.parse(JSON.stringify(state.subspaceDimensions)),
  }));
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
