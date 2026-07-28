import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set up lightweight IndexedDB mock before importing stores
const mockObjectStore = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  getAll: vi.fn()
};

const mockDB = {
  transaction: vi.fn().mockImplementation(() => {
    const tx = {
      objectStore: () => mockObjectStore
    };
    let oncompleteCallback = null;
    Object.defineProperty(tx, 'oncomplete', {
      get() { return oncompleteCallback; },
      set(cb) {
        oncompleteCallback = cb;
        if (cb) {
          setTimeout(() => cb(), 0);
        }
      }
    });
    return tx;
  }),
  objectStoreNames: {
    contains: () => true
  }
};

function createMockRequest(result) {
  const req = { result };
  let callback = null;
  Object.defineProperty(req, 'onsuccess', {
    get() { return callback; },
    set(cb) {
      callback = cb;
      if (cb) {
        setTimeout(() => cb({ target: { result } }), 0);
      }
    }
  });
  return req;
}

globalThis.indexedDB = {
  open: vi.fn().mockImplementation(() => createMockRequest(mockDB))
};

// Now import the stores
import { ui, getCurrentTab, setCurrentTab, resetUI, getSortEnabled, setSortEnabled, getAppspaceSubTab, setAppspaceSubTab } from '../src/lib/stores/uiStore.svelte.js';
import { getIssues, addIssue, clearIssues, getFilteredIssues, getFilteredCount, findIssuesForItem } from '../src/lib/stores/issueStore.svelte.js';
import { getRecentFiles, addRecentFile, clearRecentFiles, initRecentFiles } from '../src/lib/stores/recentFilesStore.svelte.js';
import { getAppspace, setAppspace, getTotalCount, hasAppspace } from '../src/lib/stores/appspaceStore.svelte.js';
import { getFiles, setFiles, getMergedFOM, setMergedFOM, clearFiles } from '../src/lib/stores/fomStore.svelte.js';
import { getHistory, pushHistory, popHistory, clearHistory } from '../src/lib/stores/historyStore.svelte.js';
import { searchState, showSearchPanel, hideSearchPanel } from '../src/lib/stores/searchStore.svelte.js';

describe('uiStore', () => {
  beforeEach(() => {
    resetUI();
  });

  it('handles tab, sorting, and appspace subtab state mutations correctly', () => {
    expect(getCurrentTab()).toBe('modules');
    setCurrentTab('objects');
    expect(getCurrentTab()).toBe('objects');

    expect(getSortEnabled()).toBe('asc');
    setSortEnabled('desc');
    expect(getSortEnabled()).toBe('desc');

    expect(getAppspaceSubTab()).toBe('objects');
    setAppspaceSubTab('interactions');
    expect(getAppspaceSubTab()).toBe('interactions');

    resetUI();
    expect(getCurrentTab()).toBe('modules');
    expect(getSortEnabled()).toBe('asc');
    expect(getAppspaceSubTab()).toBe('objects');
  });
});

describe('issueStore', () => {
  beforeEach(() => {
    clearIssues();
  });

  it('stores and filters issues correctly', () => {
    expect(getIssues()).toHaveLength(0);

    addIssue({ severity: 'error', type: 'cycle', detail: 'circle' });
    addIssue({ severity: 'warning', type: 'missing', detail: 'missing' });

    expect(getIssues()).toHaveLength(2);
    expect(getFilteredIssues()).toHaveLength(2);
    expect(getFilteredCount()).toBe(2);

    clearIssues();
    expect(getIssues()).toHaveLength(0);
  });

  it('finds issues for specific items', () => {
    addIssue({
      severity: 'warning',
      locations: [{ tab: 'objects', itemName: 'HLAobjectRoot.HLAmanager' }]
    });

    const matches = findIssuesForItem('HLAobjectRoot.HLAmanager', 'object');
    expect(matches).toHaveLength(1);

    const noMatches = findIssuesForItem('HLAobjectRoot.HLAmanager', 'interaction');
    expect(noMatches).toHaveLength(0);
  });
});

describe('appspaceStore', () => {
  it('updates appspace state and calculates counts', () => {
    expect(getAppspace()).toBeNull();
    expect(hasAppspace()).toBe(false);

    setAppspace({ fileName: 'test.appspace', entries: [{ name: 'a' }], interactions: [], unknown: [] });
    expect(getAppspace().fileName).toBe('test.appspace');
    expect(hasAppspace()).toBe(true);

    const count = getTotalCount();
    expect(count).toBe(1);
  });
});

describe('fomStore', () => {
  beforeEach(() => {
    clearFiles();
  });

  it('stores files and merged FOM', () => {
    expect(getFiles()).toHaveLength(0);
    setFiles([{ name: 'test.xml' }]);
    expect(getFiles()).toHaveLength(1);

    expect(getMergedFOM()).toBeNull();
    setMergedFOM({ objectClasses: [] });
    expect(getMergedFOM()).not.toBeNull();

    clearFiles();
    expect(getFiles()).toHaveLength(0);
    expect(getMergedFOM()).toBeNull();
  });
});

describe('historyStore', () => {
  beforeEach(() => {
    clearHistory();
  });

  it('manages navigation history stack', () => {
    expect(getHistory()).toHaveLength(0);
    pushHistory({ tab: 'objects', subTab: 'basic' });
    pushHistory({ tab: 'interactions', subTab: 'basic' });

    expect(getHistory()).toHaveLength(2);
    const popped = popHistory();
    expect(popped.tab).toBe('interactions');
    expect(getHistory()).toHaveLength(1);

    clearHistory();
    expect(getHistory()).toHaveLength(0);
  });
});

describe('searchStore', () => {
  it('manages search state visibility and query', () => {
    expect(searchState.visible).toBe(false);
    expect(searchState.query).toBe('');

    showSearchPanel([{ name: 'result1' }], 'HLAmanager');
    expect(searchState.query).toBe('HLAmanager');
    expect(searchState.results).toHaveLength(1);
    expect(searchState.visible).toBe(true);

    hideSearchPanel();
    expect(searchState.visible).toBe(false);
    expect(searchState.query).toBe('');
    expect(searchState.results).toHaveLength(0);
  });
});

describe('recentFilesStore (IndexedDB Integration)', () => {
  beforeEach(() => {
    mockObjectStore.get.mockReset();
    mockObjectStore.put.mockReset();
    mockObjectStore.clear.mockReset();
  });

  it('fetches and updates recent files list', async () => {
    mockObjectStore.get.mockImplementation(() => createMockRequest({ entries: [{ name: 'cached.xml', timestamp: 123 }] }));
    mockObjectStore.put.mockImplementation(() => createMockRequest(null));

    await initRecentFiles();
    expect(getRecentFiles()).toHaveLength(1);
    expect(getRecentFiles()[0].name).toBe('cached.xml');
  });
});
