const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const config = require('./config');

async function test_MobileLayout() {
  console.log('Starting Mobile Layout E2E Tests...');

  const browserOptions = {
    headless: true,
    slowMo: config.browser.slowMo,
    args: config.browser.args,
    executablePath: config.browser.executablePath
  };

  const browser = await puppeteer.launch(browserOptions);
  const page = await browser.newPage();
  
  // Set viewport to mobile phone size
  await page.setViewport({ width: 375, height: 667 });

  try {
    await page.goto('file://' + path.resolve(__dirname, '../fom-viewer.html'), { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.getElementById('app') !== null, { timeout: 10000 });
    await page.waitForTimeout(500);

    // 1. Verify drawer toggle button is present on mobile
    const toggleExists = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="drawerToggle"]');
      return btn !== null && window.getComputedStyle(btn).display !== 'none';
    });
    console.log('  Drawer toggle button visible on mobile:', toggleExists);
    if (!toggleExists) throw new Error('Expected drawer toggle button to be visible on mobile viewport');

    // 2. Verify drawer starts closed
    let isDrawerOpen = await page.evaluate(() => {
      return document.querySelector('.app-body').classList.contains('drawer-open');
    });
    console.log('  Drawer open initially:', isDrawerOpen);
    if (isDrawerOpen) throw new Error('Expected drawer to start closed');

    // 3. Toggle drawer open
    await page.click('[data-testid="drawerToggle"]');
    await page.waitForTimeout(300);
    isDrawerOpen = await page.evaluate(() => {
      return document.querySelector('.app-body').classList.contains('drawer-open');
    });
    console.log('  Drawer open after toggle click:', isDrawerOpen);
    if (!isDrawerOpen) throw new Error('Expected drawer to open after toggle button click');

    // 4. Click backdrop to close drawer
    await page.click('.drawer-backdrop');
    await page.waitForTimeout(300);
    isDrawerOpen = await page.evaluate(() => {
      return document.querySelector('.app-body').classList.contains('drawer-open');
    });
    console.log('  Drawer open after backdrop click:', isDrawerOpen);
    if (isDrawerOpen) throw new Error('Expected drawer to close after backdrop overlay click');

    // 5. Load a FOM file to check list/detail switching
    const fileInput = await page.$('#fileInput');
    await fileInput.uploadFile(path.join(__dirname, 'fom', 'HLAstandardMIM.xml'));
    await page.waitForTimeout(1000);

    // Verify view is in 'detail' state (due to selection auto-trigger)
    let viewState = await page.evaluate(() => {
      const area = document.querySelector('.content-area');
      return {
        isList: area.classList.contains('mobile-view-list'),
        isDetail: area.classList.contains('mobile-view-detail')
      };
    });
    console.log('  Viewport classes after file load:', viewState);
    if (!viewState.isDetail) throw new Error('Expected viewport to switch to details view after selection');

    // 6. Click Back to List button
    const backBtnExists = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="detailBackBtn"]');
      return btn !== null && window.getComputedStyle(btn).display !== 'none';
    });
    console.log('  Back to List button visible in detail view:', backBtnExists);
    if (!backBtnExists) throw new Error('Expected Back to List button to be visible in mobile details view');

    await page.click('[data-testid="detailBackBtn"]');
    await page.waitForTimeout(500);

    viewState = await page.evaluate(() => {
      const area = document.querySelector('.content-area');
      return {
        isList: area.classList.contains('mobile-view-list'),
        isDetail: area.classList.contains('mobile-view-detail')
      };
    });
    console.log('  Viewport classes after clicking Back to List:', viewState);
    if (!viewState.isList) throw new Error('Expected viewport to return to list view after clicking Back to List');

    console.log('\n✓ Mobile layout test cases passed!');
    return true;
  } catch (error) {
    console.error('Mobile Layout Test failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { test_MobileLayout };
