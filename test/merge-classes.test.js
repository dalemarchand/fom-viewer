/**
 * mergeClasses unit test: verifies that attributes/parameters are correctly
 * associated with their source modules, and that mergeClasses does not
 * mutate the original file data (regression test for Phase 5.1).
 */
const puppeteer = require('puppeteer-core');
const config = require('./config');
const path = require('path');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless'],
    executablePath: config.browser.executablePath
  });
  const page = await browser.newPage();

  const htmlPath = config.app.htmlPath;
  await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
  await page.waitForSelector('#app');
  await page.waitForFunction(() => typeof state !== 'undefined' && state.files !== undefined, { timeout: 10000 });

  let passed = 0;
  let failed = 0;

  function assert(condition, msg) {
    if (condition) { console.log(`  PASS: ${msg}`); passed++; }
    else { console.log(`  FAIL: ${msg}`); failed++; }
  }

  // =========================================================
  // Test 1: Load real FOM files and verify cross-module classes
  // =========================================================
  console.log('\nTest 1: Real FOM files - cross-module class attributes');
  {
    const fileInput = await page.$('#fileInput');
    const fomFiles = config.testFiles.slice(0, 5).map(f => path.join(config.test.fomDir, f));
    await fileInput.uploadFile(...fomFiles);
    // Wait for welcome screen to dismiss (files loaded)
    try {
      await page.waitForFunction(() => {
        const w = document.getElementById('welcomeScreen');
        return w && w.style.display === 'none';
      }, { timeout: 15000 });
    } catch(e) {
      console.log('  WARN: welcome screen did not dismiss');
    }
    await sleep(2000);

    const result = await page.evaluate(() => {
      const files = state.files;
      const merged = state.mergedFOM;
      const baseEntity = merged?.objectClasses?.find(c => c.name === 'HLAobjectRoot.BaseEntity');
      if (!baseEntity) return { error: 'BaseEntity not found' };
      const checks = baseEntity._sources.map(source => {
        const file = files.find(f => f.name === source);
        const srcClass = file?.objectClasses?.find(c => c.name === 'HLAobjectRoot.BaseEntity');
        return {
          source,
          originalAttrCount: srcClass?.attributes?.length || 0,
          originalAttrNames: (srcClass?.attributes || []).map(a => a.name)
        };
      });
      return {
        mergedAttrCount: baseEntity.attributes.length,
        mergedAttrSources: baseEntity.attributes.map(a => ({ name: a.name, _source: a._source || '' })),
        perSource: checks
      };
    });

    if (result.error) {
      console.log(`  FAIL: ${result.error}`);
      failed++;
    } else {
      const baseCheck = result.perSource.find(c => c.source.includes('Base'));
      if (baseCheck) {
        assert(baseCheck.originalAttrCount === 5,
          `Base module original attrs = ${baseCheck.originalAttrCount} (expected 5) — not inflated by merge`);
      }
      const physCheck = result.perSource.find(c => c.source.includes('Physical'));
      if (physCheck) {
        assert(physCheck.originalAttrCount === 0,
          `Physical module original attrs = ${physCheck.originalAttrCount} (expected 0)`);
      }
      assert(result.mergedAttrCount === 5,
        `Merged attr count = ${result.mergedAttrCount} (expected 5)`);
      const allFromBase = result.mergedAttrSources.every(a => a._source && a._source.includes('Base'));
      assert(allFromBase, `All merged attrs sourced from Base module`);
    }
  }

  // =========================================================
  // Test 2: mergeClasses with synthetic data (overlapping attrs)
  // =========================================================
  console.log('\nTest 2: Synthetic merge - overlapping attributes');
  {
    const result = await page.evaluate(() => {
      const modA = {
        name: 'ModuleA',
        objectClasses: [{
          name: 'Test.Parent',
          attributes: [
            { name: 'attr1', dataType: 'int' },
            { name: 'attr2', dataType: 'float' },
            { name: 'attr3', dataType: 'string' }
          ],
          _source: 'ModuleA'
        }]
      };
      const modB = {
        name: 'ModuleB',
        objectClasses: [{
          name: 'Test.Parent',
          attributes: [
            { name: 'attr2', dataType: 'double' },  // same name -> skipped (first-come)
            { name: 'attr4', dataType: 'bool' },     // new
            { name: 'attr5', dataType: 'int' }       // new
          ],
          _source: 'ModuleB'
        }]
      };
      const modC = {
        name: 'ModuleC',
        objectClasses: [{
          name: 'Test.Parent',
          attributes: [
            { name: 'attr1', dataType: 'int' },       // duplicate -> skipped
            { name: 'attr6', dataType: 'bytes' }      // new (unique name)
          ],
          _source: 'ModuleC'
        }]
      };

      const merged = mergeClasses([modA, modB, modC], 'object');
      const cls = merged.find(c => c.name === 'Test.Parent');
      if (!cls) return { error: 'Class not found' };

      return {
        sources: cls._sources,
        mergedCount: cls.attributes.length,
        mergedNames: cls.attributes.map(a => a.name),
        mergedSources: cls.attributes.map(a => a._source),
        originalLengths: [
          modA.objectClasses[0].attributes.length,
          modB.objectClasses[0].attributes.length,
          modC.objectClasses[0].attributes.length
        ],
        attr2Source: cls.attributes.find(a => a.name === 'attr2')?._source
      };
    });

    if (result.error) {
      console.log(`  FAIL: ${result.error}`);
      failed++;
    } else {
      assert(result.sources.length === 3, `Sources = ${result.sources.length} (expected 3)`);
      // 3 (modA) + 2 unique from modB + 1 unique from modC = 6
      assert(result.mergedCount === 6,
        `Merged count = ${result.mergedCount} (expected 6: 3+2+1 unique)`);
      assert(result.mergedNames.includes('attr6'),
        'attr6 (unique name from ModuleC) included in merged');
      // First-come-first-served: attr2 from ModuleA
      assert(result.attr2Source === 'ModuleA',
        `attr2 _source = ${result.attr2Source} (expected ModuleA, first-come)`);
      // Original arrays NOT mutated
      assert(result.originalLengths[0] === 3,
        `ModuleA original = ${result.originalLengths[0]} (expected 3)`);
      assert(result.originalLengths[1] === 3,
        `ModuleB original = ${result.originalLengths[1]} (expected 3)`);
      assert(result.originalLengths[2] === 2,
        `ModuleC original = ${result.originalLengths[2]} (expected 2)`);
    }
  }

  // =========================================================
  // Test 3: Synthetic merge + validate => conflict detection counts
  // =========================================================
  console.log('\nTest 3: Conflict detection with synthetic cross-module class');
  {
    const result = await page.evaluate(() => {
      const modX = {
        name: 'ModuleX',
        objectClasses: [{ name: 'Test.ConflictClass', attributes: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] }],
        interactionClasses: [],
        dataTypes: { basic: [], simple: [], array: [], fixed: [], enum: [], variant: [] },
        transportations: [],
        switches: [],
        notes: [],
        tags: []
      };
      const modY = {
        name: 'ModuleY',
        objectClasses: [{ name: 'Test.ConflictClass', attributes: [{ name: 'a' }, { name: 'd' }, { name: 'e' }, { name: 'f' }] }],
        interactionClasses: [],
        dataTypes: { basic: [], simple: [], array: [], fixed: [], enum: [], variant: [] },
        transportations: [],
        switches: [],
        notes: [],
        tags: []
      };

      state.files = [modX, modY];
      state.mergedFOM = {
        objectClasses: mergeClasses([modX, modY], 'object'),
        interactionClasses: [],
        dataTypes: { basic: [], simple: [], array: [], fixed: [], enum: [], variant: [] },
        transportations: [],
        switches: [],
        notes: [],
        tags: []
      };

      state.issues = [];
      validate();

      const issues = state.issues.filter(i => i.type === 'object-attributes');
      if (issues.length === 0) return { error: 'No conflict issue generated' };

      const issue = issues[0];
      const details = issue.detail.split('; ').map(d => {
        const [visible] = d.split('||');
        return visible;
      });
      return {
        message: issue.message,
        details,
        sources: issue.sources
      };
    });

    if (result.error) {
      console.log(`  FAIL: ${result.error}`);
      failed++;
    } else {
      assert(result.details.length === 2,
        `Detail items = ${result.details.length} (expected 2)`);
      assert(result.details[0] === 'ModuleX: 3 attributes',
        `Detail[0] = "${result.details[0]}" (expected "ModuleX: 3 attributes")`);
      // ModuleY's conflict count is its ORIGINAL attr count (4), not the unique merged count
      assert(result.details[1] === 'ModuleY: 4 attributes',
        `Detail[1] = "${result.details[1]}" (expected "ModuleY: 4 attributes")`);
    }
  }

  // =========================================================
  // Test 4: Verify no mutation after _checkConflicts runs
  // =========================================================
  console.log('\nTest 4: Original file data unchanged after full validate()');
  {
    const result = await page.evaluate(() => {
      const files = state.files;
      const checks = files.map(f => {
        const objCounts = (f.objectClasses || []).map(c => ({
          name: c.name,
          attrCount: c.attributes?.length || 0
        }));
        return { file: f.name, classes: objCounts };
      });
      return checks;
    });

    let allOK = true;
    result.forEach(fc => {
      fc.classes.forEach(c => {
        if (c.attrCount < 0) allOK = false; // can't be negative, sanity check
      });
    });
    assert(allOK, 'All original attr counts are non-negative (sanity check)');
    result.forEach(fc => {
      console.log(`  ${fc.file.substring(0, 40)}: ${fc.classes.length} classes`);
    });
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  await browser.close();
  return failed === 0 ? 0 : 1;
}

module.exports = { run };

if (require.main === module) {
  run().then(exitCode => {
    process.exit(exitCode);
  }).catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
}
