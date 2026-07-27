// Drag-and-Drop Test for FOM Viewer
// Verifies drag-and-drop file loading works in normal/flexible modes and is disabled/hidden in strict mode.

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const config = require('./config');

async function test_DragAndDrop() {
  console.log('Starting Drag and Drop E2E Tests...');

  const configPath = path.join(__dirname, '../src/custom-config.json');
  const backupConfigPath = path.join(__dirname, '../src/custom-config.json.bak');

  // Back up original custom-config.json
  if (fs.existsSync(configPath)) {
    fs.copyFileSync(configPath, backupConfigPath);
  }

  const browserOptions = {
    headless: true,
    slowMo: config.browser.slowMo,
    args: config.browser.args,
    executablePath: config.browser.executablePath
  };

  const browser = await puppeteer.launch(browserOptions);
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`[Browser Error]: ${msg.text()}`);
    }
  });
  page.on('pageerror', err => {
    console.error('[Browser PageError]:', err);
  });
  page.on('dialog', async dialog => { await dialog.accept(); });

  const mimFilePath = path.join(__dirname, 'fom', 'HLAstandardMIM.xml');
  const mimContent = fs.readFileSync(mimFilePath, 'utf8');

  try {
    // =========================================================================
    // Scenario 1: Normal Mode (mode default)
    // =========================================================================
    console.log('\n--- Scenario 1: Normal Mode ---');
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
    execSync('npm run build', { cwd: path.join(__dirname, '..') });

    await page.goto(`file://${path.resolve(__dirname, '../fom-viewer.html')}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.getElementById('app') !== null, { timeout: config.test.timeout });
    await page.waitForTimeout(1000);

    // Verify drop zone exists and is visible
    const dropZoneVisible = await page.evaluate(() => {
      const el = document.getElementById('dropZone');
      return el && window.getComputedStyle(el).display !== 'none';
    });
    console.log('  Drop Zone visible in Normal Mode:', dropZoneVisible);
    if (!dropZoneVisible) throw new Error('Expected dropZone to be visible in Normal Mode');

    // Clear files first if any loaded from previous sessions
    await page.evaluate(async () => {
      if (typeof window.clearAppspace === 'function') window.clearAppspace();
      if (typeof window.state !== 'undefined') {
        const state = window.state;
        state.files = [];
        state.mergedFOM = null;
        state.issues = [];
        state.history = [];
        if (typeof updateUI === 'function') updateUI();
      }
    });
    await page.waitForTimeout(200);

    // Simulate drop event
    console.log('  Simulating file drop...');
    await page.evaluate(async (xmlText) => {
      const file = new File([xmlText], 'HLAstandardMIM.xml', { type: 'text/xml' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const dropZone = document.getElementById('dropZone');
      const dragOverEvent = new DragEvent('dragover', { dataTransfer, bubbles: true });
      dropZone.dispatchEvent(dragOverEvent);

      const dropEvent = new DragEvent('drop', { dataTransfer, bubbles: true });
      dropZone.dispatchEvent(dropEvent);
    }, mimContent);

    // Wait for the file to be processed
    await page.waitForFunction(() => {
      return window.state && window.state.files && window.state.files.length === 1;
    }, { timeout: config.test.timeout });

    console.log('  ✓ File loaded successfully via Drag-and-Drop in Normal Mode');

    // =========================================================================
    // Scenario 2: Flexible Mode (mode: flexible)
    // =========================================================================
    console.log('\n--- Scenario 2: Flexible Mode ---');
    fs.writeFileSync(configPath, JSON.stringify({ mode: 'flexible' }, null, 2));
    execSync('npm run build', { cwd: path.join(__dirname, '..') });

    await page.goto(`file://${path.resolve(__dirname, '../fom-viewer.html')}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.getElementById('app') !== null, { timeout: config.test.timeout });
    await page.waitForTimeout(1000);

    // Verify drop zone exists and is visible
    const dropZoneVisibleFlex = await page.evaluate(() => {
      const el = document.getElementById('dropZone');
      return el && window.getComputedStyle(el).display !== 'none';
    });
    console.log('  Drop Zone visible in Flexible Mode:', dropZoneVisibleFlex);
    if (!dropZoneVisibleFlex) throw new Error('Expected dropZone to be visible in Flexible Mode');

    // Clear files
    await page.evaluate(async () => {
      if (typeof window.state !== 'undefined') {
        const state = window.state;
        state.files = [];
        state.mergedFOM = null;
        state.issues = [];
        state.history = [];
        if (typeof updateUI === 'function') updateUI();
      }
    });
    await page.waitForTimeout(200);

    // Simulate drop event
    console.log('  Simulating file drop...');
    await page.evaluate(async (xmlText) => {
      const file = new File([xmlText], 'HLAstandardMIM.xml', { type: 'text/xml' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const dropZone = document.getElementById('dropZone');
      const dropEvent = new DragEvent('drop', { dataTransfer, bubbles: true });
      dropZone.dispatchEvent(dropEvent);
    }, mimContent);

    // Wait for the file to be processed
    await page.waitForFunction(() => {
      return window.state && window.state.files && window.state.files.length === 1;
    }, { timeout: config.test.timeout });

    console.log('  ✓ File loaded successfully via Drag-and-Drop in Flexible Mode');

    // =========================================================================
    // Scenario 3: Strict Mode (mode: strict)
    // =========================================================================
    console.log('\n--- Scenario 3: Strict Mode ---');
    fs.writeFileSync(configPath, JSON.stringify({ mode: 'strict' }, null, 2));
    execSync('npm run build', { cwd: path.join(__dirname, '..') });

    await page.goto(`file://${path.resolve(__dirname, '../fom-viewer.html')}`, { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.getElementById('app') !== null, { timeout: config.test.timeout });
    await page.waitForTimeout(1000);

    // Verify drop zone is completely hidden/absent in strict mode
    const dropZoneVisibleStrict = await page.evaluate(() => {
      const el = document.getElementById('dropZone');
      return el && window.getComputedStyle(el).display !== 'none';
    });
    console.log('  Drop Zone visible in Strict Mode:', !!dropZoneVisibleStrict);
    if (dropZoneVisibleStrict) throw new Error('Expected dropZone to be hidden/absent in Strict Mode');

    // Verify dropping a file on the window does not trigger loading
    console.log('  Simulating global file drop in Strict Mode (should do nothing)...');
    const strictState = await page.evaluate(async (xmlText) => {
      // Clear files
      if (typeof window.state !== 'undefined') {
        window.state.files = [];
      }

      const file = new File([xmlText], 'HLAstandardMIM.xml', { type: 'text/xml' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const dragOverEvent = new DragEvent('dragover', { dataTransfer, bubbles: true });
      window.dispatchEvent(dragOverEvent);

      const dropEvent = new DragEvent('drop', { dataTransfer, bubbles: true });
      window.dispatchEvent(dropEvent);

      await new Promise(r => setTimeout(r, 500));
      return window.state ? window.state.files.length : 0;
    }, mimContent);

    console.log('  Files count after drop in Strict Mode:', strictState);
    if (strictState !== 0) throw new Error('Expected files count to be 0 in Strict Mode after drop');
    console.log('  ✓ Drag-and-Drop completely disabled in Strict Mode');

    console.log('\n✓ All drag-and-drop test cases passed!');
    return true;
  } catch (error) {
    console.error('Drag and Drop Test failed:', error);
    throw error;
  } finally {
    await browser.close();

    // Restore backup config
    if (fs.existsSync(backupConfigPath)) {
      fs.copyFileSync(backupConfigPath, configPath);
      fs.unlinkSync(backupConfigPath);
    } else {
      fs.writeFileSync(configPath, '{}');
    }
    execSync('npm run build', { cwd: path.join(__dirname, '..') });
  }
}

module.exports = { test_DragAndDrop };
