// Quick baseline check: verify all core elements exist and basic navigation works
const puppeteer = require('puppeteer-core');
const path = require('path');
const config = require('./config');

async function checkBaseline() {
  const browser = await puppeteer.launch({
    headless: true,
    slowMo: config.browser.slowMo,
    args: config.browser.args,
    executablePath: config.browser.executablePath
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', e => consoleErrors.push(e.message));

  await page.goto('file://' + path.resolve(__dirname, '../fom-viewer.html'), { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.getElementById('app') !== null, { timeout: 10000 });
  await page.waitForTimeout(1000);

  let passed = 0, failed = 0;

  // Check core elements exist
  const elements = [
    '#app', '#backBtn', '#fileInput', '#globalSearch', '#detailHeader', '#detailBody',
    '#detailTitle', '#detailMeta', '#sortBtn', '#toast', '#welcomeScreen', '#treeControls',
    '#dataTypeTabs', '#appspaceTabs', '#issuesTabs', '#treeView', '#exportBtn', '#clearBtn',
    '#loadAppspaceBtn', '#clearAppspaceBtn', '#aboutBtn', '#overflowThemeSelect',
  ];

  for (const sel of elements) {
    const el = await page.$(sel);
    if (el) passed++;
    else { console.log('  MISSING: ' + sel); failed++; }
  }

  // Load FOM and verify detailHeader
  const fileInput = await page.$('#fileInput');
  await fileInput.uploadFile(path.join(config.test.fomDir, 'HLAstandardMIM.xml'));
  await page.waitForFunction(() => {
    const h = document.getElementById('detailHeader');
    return h && getComputedStyle(h).display === 'block';
  }, { timeout: 10000 });

  const dhDisplay = await page.$eval('#detailHeader', el => getComputedStyle(el).display);
  if (dhDisplay === 'block') passed++;
  else { console.log('  FAIL: detailHeader not block after FOM load'); failed++; }

  // Verify tab switching creates active class
  const tabs = ['objects', 'interactions', 'datatypes', 'dims', 'trans', 'switches', 'tags', 'time', 'notes'];
  for (const tab of tabs) {
    const tabEl = await page.$('[data-tab="' + tab + '"]');
    if (!tabEl) continue;
    const display = await page.evaluate(el => getComputedStyle(el).display, tabEl);
    if (display === 'none') continue;
    await tabEl.click();
    await page.waitForTimeout(200);
    const active = await page.$eval('[data-tab="' + tab + '"]', el => el.classList.contains('active'));
    if (active) passed++;
    else { console.log('  FAIL: tab ' + tab + ' not active after click'); failed++; }
  }

  // Verify detail panel shows after selecting tree item
  await page.click('[data-tab="objects"]');
  await page.waitForTimeout(500);
  const treePanel = await page.$('#treeViewTree');
  if (treePanel) {
    const panelDisplay = await page.evaluate(el => getComputedStyle(el).display, treePanel);
    if (panelDisplay !== 'none') {
      const firstItem = await page.$('#treeViewTree .tree-item:first-child');
      if (firstItem) {
        await firstItem.click();
        await page.waitForTimeout(300);
        const dhAfter = await page.$eval('#detailHeader', el => getComputedStyle(el).display);
        if (dhAfter === 'block') passed++;
        else { console.log('  FAIL: detailHeader not block after tree item click'); failed++; }

        const title = await page.$eval('#detailTitle', el => el.textContent);
        if (title && title.length > 0 && title !== 'Appspaces') passed++;
        else { console.log('  FAIL: detailTitle is "' + title + '"'); failed++; }
      }
    }
  }

  // Verify search opens
  await page.focus('#globalSearch');
  await page.keyboard.type('HLAobjectRoot');
  await page.waitForTimeout(500);
  const searchPanel = await page.$('#searchPanel');
  if (searchPanel) {
    const searchDisplay = await page.evaluate(el => getComputedStyle(el).display, searchPanel);
    if (searchDisplay !== 'none') passed++;
    else { console.log('  FAIL: search panel not visible'); failed++; }
  }

  console.log('Baseline check complete: ' + passed + ' passed, ' + failed + ' failed, ' + consoleErrors.length + ' console errors');
  await browser.close();
  return failed === 0;
}

checkBaseline().then(ok => process.exit(ok ? 0 : 1));
