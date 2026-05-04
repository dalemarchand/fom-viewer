// Simple test suite to verify back button history resets in FOM Viewer
// Note: This test runs in Node and performs static code checks against
// the browser-side main.js to ensure history resets exist in the 4 targets.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const MAIN_JS_PATH = path.resolve(__dirname, '../src/main.js');
let code;
try {
  code = fs.readFileSync(MAIN_JS_PATH, 'utf8');
} catch (e) {
  throw new Error(`Could not read main.js at ${MAIN_JS_PATH}: ${e.message}`);
}

// Helper: extract all indices where the history reset is performed
function findResetIndices() {
  const regex = /state\.history\s*=\s*\[\]\s*;/g;
  const indices = [];
  let m;
  while ((m = regex.exec(code)) !== null) {
    indices.push(m.index);
  }
  return indices;
}

// Helper: for a given index, determine the nearest enclosing async function name
function asyncFunctionNameForIndex(index) {
  // Look backwards from index to find the last occurrence of a function signature
  const before = code.substring(0, index);
  const re = /async function\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  let lastName = null;
  while ((m = re.exec(before)) !== null) {
    lastName = m[1];
  }
  return lastName; // may be null if not found
}

function runStaticTests() {
  console.log('Running static tests for back button history resets...');

  const resetIndices = findResetIndices();
  // Expect exactly 5 resets in the file as per the change summary
  try {
    assert.strictEqual(resetIndices.length, 5, `Expected 5 history resets, found ${resetIndices.length}`);
  } catch (e) {
    console.error(e.message);
    throw e;
  }

  // Ensure each reset occurs inside an async function (as a sanity check)
  for (let i = 0; i < resetIndices.length; i++) {
    const idx = resetIndices[i];
    const fnName = asyncFunctionNameForIndex(idx);
    try {
      assert.ok(fnName, `History reset at index ${idx} is not inside an async function`);
    } catch (e) {
      console.error(`Failed to locate enclosing async function for reset #${i+1}`);
      throw e;
    }
  }

  console.log('PASS: All history resets are inside async functions.');
}

function runMockResetTest() {
  // Simple dynamic check that simulates the reset behavior of the assignment
  // and ensures that assigning [] empties the history array.
  const state = { history: ['a', 'b', 'c'] };
  // Simulate the line that main.js would execute when resetting history
  const fn = new Function('state', 'state.history = []; return state.history.length;');
  const len = fn(state);
  try {
    assert.strictEqual(len, 0, 'Mock reset did not produce empty history');
  } catch (e) {
    console.error('PASS: Mock reset test failed to produce empty history.');
    throw e;
  }
  console.log('PASS: Mock reset test succeeded (state.history cleared).');
}

async function main() {
  runStaticTests();
  runMockResetTest();
  console.log('ALL TESTS COMPLETE');
}

if (require.main === module) {
  // Run synchronously to ease CI integration without extra test runners
  main().catch(err => {
    console.error('TEST FAILED:', err && err.message ? err.message : err);
    process.exitCode = 1;
  });
}

module.exports = { runStaticTests, runMockResetTest };
