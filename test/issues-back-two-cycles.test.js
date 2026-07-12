// Test: Back button two-cycle navigation pattern
// User scenario: After exhausting history in one cycle, second cycle
// should properly track history through subtab switches + item clicks

async function runTest(browser, config) {
  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('  [page error]', msg.text());
  });

  await page.goto('file://' + config.app.htmlPath, { waitUntil: 'networkidle0' });
  await page.waitForTimeout(1000);

  // Helper to wait for the issues list to render
  async function waitForIssues() {
    await page.waitForSelector('#treeView .tree-item', { timeout: 5000 });
  }

  // Load FOM files
  const fomDir = config.test.fomDir;
  const fileInput = await page.$('#fileInput');
  await fileInput.uploadFile(
    fomDir + '/RPR-Foundation_v3.0.xml',
    fomDir + '/HLAstandardMIM.xml'
  );
  await page.waitForTimeout(2000);

  // Click Issues tab
  await page.click('.tab[data-tab="issues"]');
  await page.waitForTimeout(500);

  // ---- Cycle 1 ----
  // Verify default selection on All subtab
  await waitForIssues();
  const allItems = await page.$$('#treeView .tree-item');
  const defaultItemText = await allItems[0].evaluate(el => el.textContent);
  console.log(`  Default item: ${defaultItemText.trim().substring(0, 40)}`);

  // Click a different item on All subtab
  if (allItems.length > 1) {
    await allItems[1].click();
    await page.waitForTimeout(300);
  }

  // Click Warnings subtab
  await page.click('#issuesTabs .subtab[data-subtab="warning"]');
  await page.waitForTimeout(500);
  await waitForIssues();

  // Click a different item on Warnings subtab
  const warningItems = await page.$$('#treeView .tree-item');
  if (warningItems.length > 1) {
    await warningItems[1].click();
    await page.waitForTimeout(300);
  }

  // Back 3 times - should exhaust history
  for (let i = 0; i < 3; i++) {
    const backBtn = await page.$('#backBtn');
    const beforeStyle = await backBtn.evaluate(el => el.style.display);
    console.log(`  Back ${i+1}: before click, backBtn=${beforeStyle}`);
    await backBtn.click();
    await page.waitForTimeout(300);
    const afterStyle = await backBtn.evaluate(el => el.style.display);
    console.log(`  Back ${i+1}: after click, backBtn=${afterStyle}`);
  }

  const backBtnAfterCycle1 = await page.$eval('#backBtn', el => el.style.display);
  console.log(`  After Cycle 1: backBtn=${backBtnAfterCycle1}`);

  // ---- Cycle 2 ----
  // Click a different item on current subtab (All)
  await waitForIssues();
  const allItems2 = await page.$$('#treeView .tree-item');
  if (allItems2.length > 2) {
    await allItems2[2].click();
    await page.waitForTimeout(300);
  } else if (allItems2.length > 1) {
    await allItems2[1].click();
    await page.waitForTimeout(300);
  }

  // Click Warnings subtab
  await page.click('#issuesTabs .subtab[data-subtab="warning"]');
  await page.waitForTimeout(500);
  await waitForIssues();

  // Click a different item on Warnings subtab
  const warningItems2 = await page.$$('#treeView .tree-item');
  if (warningItems2.length > 1) {
    await warningItems2[1].click();
    await page.waitForTimeout(300);
  }

  // Back twice: first restores default warning item, second restores All subtab item
  for (let i = 0; i < 2; i++) {
    const backBtn = await page.$('#backBtn');
    const beforeStyle = await backBtn.evaluate(el => el.style.display);
    console.log(`  Cycle 2 Back ${i+1}: before click, backBtn=${beforeStyle}`);

    if (beforeStyle !== 'inline-block' && beforeStyle !== 'block') {
      console.log(`  ❌ FAIL: backBtn is ${beforeStyle} - should be visible!`);
      return { passed: false, reason: `Back button not visible at Cycle 2 step ${i+1}` };
    }

    await backBtn.click();
    await page.waitForTimeout(300);
  }

  // Verify back button is still visible (should be, there's the auto-selected default from Cycle 1)
  const finalBackBtn = await page.$eval('#backBtn', el => el.style.display);
  console.log(`  After Cycle 2: backBtn=${finalBackBtn}`);

  if (finalBackBtn !== 'inline-block' && finalBackBtn !== 'block') {
    console.log(`  ❌ FAIL: Back button should still be visible! Got: ${finalBackBtn}`);
    console.log(`  Expected: inline-block (there should be history entries remaining)`);
    return { passed: false, reason: `Back button disappeared in second cycle: ${finalBackBtn}` };
  }

  console.log(`  ✅ PASS: Back button persists through second cycle`);
  return { passed: true };
}

module.exports = { runTest };
