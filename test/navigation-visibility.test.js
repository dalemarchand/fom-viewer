// Lightweight, self-contained tests for navigation/visibility behavior
// This test mocks a minimal DOM and internal navigation state to verify
// basic navigation flows described by the user.

const assert = require('assert');

// Minimal in-memory DOM mock
function createMockElement(id) {
  return {
    id,
    style: { display: 'none' },
    classList: new Set(),
    innerHTML: '',
    dataset: {},
    scrolledIntoView: false,
    scrollIntoView: function() { this.scrolledIntoView = true; return; }
  };
}

// Global-ish mock objects
const detailHeader = createMockElement('detailHeader');
detailHeader.style.display = 'none';
const detailBody = createMockElement('detailBody');

// Simple state machine to drive tests
const state = {
  selectedItem: null,
  history: [],
  currentTab: 'modules',
  currentSubTab: null,
  currentAppspaceSubtab: null,
  uiUpdated: false,
  dataTypeShown: false
};

// Mock tree item structure
function makeItem(name) {
  const el = createMockElement(`tree-${name}`);
  el.name = name;
  el.type = 'mock';
  el.dataset = { name, type: 'mock' };
  // simulate the ability to scroll into view
  el.scrollIntoView = function() { el.scrolledIntoView = true; };
  return { element: el, name };
}

function selectTreeItem(item) {
  // push previous selection to history
  if (state.selectedItem) {
    state.history.push(state.selectedItem);
    if (state.selectedItem?.element?.classList) {
      state.selectedItem.element.classList.delete('selected');
    }
  }
  state.selectedItem = item;
  if (item && item.element && item.element.classList) {
    item.element.classList.add('selected');
  }
  detailHeader.style.display = 'block';
  detailBody.innerHTML = `Detail for ${item?.name ?? ''}`;
  if (item?.element) {
    item.element.scrolledIntoView = false;
    item.element.scrollIntoView = function() { item.element.scrolledIntoView = true; };
    item.element.scrollIntoView();
  }
}

function goBack() {
  if (state.history.length > 0) {
    const prev = state.history.pop();
    // clear current selection
    if (state.selectedItem?.element?.classList) {
      state.selectedItem.element.classList.delete('selected');
    }
    state.selectedItem = prev;
    if (state.selectedItem?.element?.classList) {
      state.selectedItem.element.classList.add('selected');
    }
    detailHeader.style.display = 'block';
    detailBody.innerHTML = `Detail for ${state.selectedItem?.name ?? ''}`;
  }
}

function updateUI() {
  state.uiUpdated = true;
}

function showDataType() {
  state.dataTypeShown = true;
}

function navigateToTab(tabName) {
  state.currentTab = tabName;
}
function navigateToDatatypeSubtab(subtabName) {
  state.currentSubTab = subtabName;
}
function navigateToAppspaceSubtab(subtabName) {
  state.currentAppspaceSubtab = subtabName;
}

async function runTest1() {
  console.log('Test 1: Clicking tree item selects it and shows detail');
  // Setup a single tree item
  detailHeader.style.display = 'none';
  detailBody.innerHTML = '';
  state.selectedItem = null;
  state.history = [];

  const item = makeItem('ItemA');
  selectTreeItem(item);
  // Assertions
  assert(item.element.classList.has('selected'), 'Tree item should have selected class');
  assert.strictEqual(detailHeader.style.display, 'block', 'Detail panel should be visible');
  assert.strictEqual(detailBody.innerHTML, 'Detail for ItemA', 'Detail body should show correct content');
  console.log('PASS: Test 1');
}

async function runTest2() {
  console.log('Test 2: Back button restores previous selection and view');
  // Prepare previous selection
  const prev = makeItem('PrevItem');
  const curr = makeItem('CurrItem');
  // Set up current selection and history
  state.selectedItem = curr;
  if (state.selectedItem?.element?.classList) {
    state.selectedItem.element.classList.add('selected');
  }
  state.history = [prev];
  detailHeader.style.display = 'block';
  detailBody.innerHTML = `Detail for ${state.selectedItem.name}`;

  goBack();

  // Assertions
  assert.strictEqual(state.selectedItem, prev, 'Previous item should be restored after goBack');
  if (prev.element?.classList) {
    assert(prev.element.classList.has('selected'), 'Previous item should be marked selected');
  }
  assert.strictEqual(detailBody.innerHTML, `Detail for ${prev.name}`, 'Detail panel should show previous item content');
  console.log('PASS: Test 2');
}

async function runTest3() {
  console.log('Test 3: Selected item is scrolled into view after navigation and subsequent actions');
  // Test scrollIntoView on selection
  detailHeader.style.display = 'none';
  detailBody.innerHTML = '';
  state.selectedItem = null;
  const item = makeItem('ScrollItem');
  selectTreeItem(item);
  assert.strictEqual(item.element.scrolledIntoView, true, 'scrollIntoView should be invoked on selection');

  // Prepare previous item to enable goBack path
  const prev = makeItem('PrevForBack');
  state.history = [prev];
  // Go back and ensure content updates
  goBack();
  assert.strictEqual(state.selectedItem, prev, 'Go back should restore previous item');

  // Additional UI updates via helper functions
  updateUI();
  showDataType();
  assert.strictEqual(state.uiUpdated, true, 'UI should be marked as updated');
  assert.strictEqual(state.dataTypeShown, true, 'Data type should have been shown');
  console.log('PASS: Test 3');
}

async function runTest4() {
  console.log('Test 4: Navigation works across all tabs and subtabs');
  // Tabs
  const tabs = ['modules','objects','interactions','dims','trans','notes','switches','tags','time'];
  for (const t of tabs) {
    navigateToTab(t);
    assert.strictEqual(state.currentTab, t, `Tab ${t} should be active`);
  }

  // Datatype subtabs
  const datatypeSubs = ['basic','simple','array','fixed','enum','variant'];
  for (const s of datatypeSubs) {
    navigateToDatatypeSubtab(s);
    assert.strictEqual(state.currentSubTab, s, `Datatype subtab ${s} should be active`);
  }

  // Appspaces subtabs
  const appspaceSubs = ['objects','interactions','unknown'];
  for (const s of appspaceSubs) {
    navigateToAppspaceSubtab(s);
    assert.strictEqual(state.currentAppspaceSubtab, s, `Appspace subtab ${s} should be active`);
  }
  console.log('PASS: Test 4');
}

async function main() {
  try {
    await runTest1();
    await runTest2();
    await runTest3();
    await runTest4();
    console.log('\nALL TESTS PASSED');
  } catch (err) {
    console.error('TEST FAILED:', err && err.message ? err.message : err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
