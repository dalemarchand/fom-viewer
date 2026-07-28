import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set up lightweight IndexedDB mock
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

// Now import storage
import { saveFiles, saveUiState, saveAppspace, loadUiState, loadAppspace, loadAllFiles, clearAll, clearAppspace, saveBundleId, loadBundleId, saveAll } from '../src/lib/storage.js';

describe('storage helper', () => {
  beforeEach(() => {
    mockObjectStore.get.mockReset();
    mockObjectStore.put.mockReset();
    mockObjectStore.delete.mockReset();
    mockObjectStore.clear.mockReset();
    mockObjectStore.getAll.mockReset();
  });

  it('saveFiles puts each file to the store', async () => {
    mockObjectStore.put.mockImplementation(() => createMockRequest(null));

    await saveFiles([{ name: 'f1.xml', xml: '<xml>' }]);
    expect(mockObjectStore.put).toHaveBeenCalledWith({ name: 'f1.xml', xml: '<xml>' });
  });

  it('saveUiState puts uiState to the store', async () => {
    mockObjectStore.put.mockImplementation(() => createMockRequest(null));

    await saveUiState({ tab: 'objects' });
    expect(mockObjectStore.put).toHaveBeenCalledWith({ name: '__uiState__', uiState: { tab: 'objects' } });
  });

  it('loadUiState fetches the uiState entry', async () => {
    mockObjectStore.get.mockImplementation(() => createMockRequest({ name: '__uiState__', uiState: { tab: 'modules' } }));

    const res = await loadUiState();
    expect(res).toEqual({ tab: 'modules' });
    expect(mockObjectStore.get).toHaveBeenCalledWith('__uiState__');
  });

  it('loadAllFiles filters out administrative double-underscore keys', async () => {
    mockObjectStore.getAll.mockImplementation(() => createMockRequest([
      { name: '__uiState__', uiState: {} },
      { name: 'user_file.xml', xml: '<fom>' }
    ]));

    const res = await loadAllFiles();
    expect(res).toHaveLength(1);
    expect(res[0].name).toBe('user_file.xml');
  });

  it('clearAll clears the store', async () => {
    mockObjectStore.clear.mockImplementation(() => createMockRequest(null));

    await clearAll();
    expect(mockObjectStore.clear).toHaveBeenCalled();
  });

  it('saveAll clears the store and updates all files, uiState, and appspace while preserving config meta keys', async () => {
    // get mock for preserving recentFiles and bundleId
    mockObjectStore.get.mockImplementation((key) => {
      if (key === '__recentFiles__') return createMockRequest({ name: '__recentFiles__', entries: [] });
      if (key === '__bundleId__') return createMockRequest({ name: '__bundleId__', bundleId: 'b123' });
      return createMockRequest(null);
    });
    mockObjectStore.clear.mockImplementation(() => createMockRequest(null));
    mockObjectStore.put.mockImplementation(() => createMockRequest(null));

    await saveAll([{ name: 'f1.xml', xml: '<xml>' }], { tab: 'objects' }, { entries: [] }, 'objects');
    
    expect(mockObjectStore.clear).toHaveBeenCalled();
    expect(mockObjectStore.put).toHaveBeenCalledWith({ name: 'f1.xml', xml: '<xml>' });
    expect(mockObjectStore.put).toHaveBeenCalledWith({ name: '__uiState__', uiState: { tab: 'objects' } });
    expect(mockObjectStore.put).toHaveBeenCalledWith({ name: '__appspace__', data: { entries: [] }, subTab: 'objects' });
  });
});
