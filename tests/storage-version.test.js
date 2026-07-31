import { describe, it, expect, vi, beforeEach } from 'vitest';

// Lightweight IndexedDB mock matching tests/storage.test.js
const storeData = new Map();

const mockObjectStore = {
  get: vi.fn().mockImplementation((key) => {
    return createMockRequest(storeData.get(key));
  }),
  put: vi.fn().mockImplementation((val) => {
    storeData.set(val.name, val);
    return createMockRequest(val);
  }),
  delete: vi.fn().mockImplementation((key) => {
    storeData.delete(key);
    return createMockRequest(undefined);
  }),
  clear: vi.fn().mockImplementation(() => {
    storeData.clear();
    return createMockRequest(undefined);
  }),
  getAll: vi.fn().mockImplementation(() => {
    return createMockRequest(Array.from(storeData.values()));
  })
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
        setTimeout(() => cb(), 0);
      }
    }
  });
  return req;
}

const mockIndexedDB = {
  open: vi.fn().mockImplementation(() => {
    const req = { result: mockDB };
    setTimeout(() => {
      if (req.onsuccess) req.onsuccess();
    }, 0);
    return req;
  })
};

vi.stubGlobal('indexedDB', mockIndexedDB);

import { saveAppVersion, loadAppVersion, saveAll, clearAll } from '../src/lib/storage.js';

describe('Storage App Version Tracking', () => {
  beforeEach(async () => {
    storeData.clear();
    vi.clearAllMocks();
  });

  it('saves and loads app version correctly', async () => {
    let version = await loadAppVersion();
    expect(version).toBeNull();

    await saveAppVersion('3.1.9');
    version = await loadAppVersion();
    expect(version).toBe('3.1.9');
  });

  it('initializes default __appVersion__ during saveAll if not present', async () => {
    await saveAll(
      [{ name: 'Test.xml', xml: '<fom></fom>' }],
      { currentTab: 'overview', currentSubTab: 'basic' },
      null,
      'objects'
    );

    const version = await loadAppVersion();
    expect(version).toBe('__VERSION__');
  });

  it('preserves existing __appVersion__ during saveAll', async () => {
    await saveAppVersion('3.0.0');
    await saveAll(
      [{ name: 'Test.xml', xml: '<fom></fom>' }],
      { currentTab: 'overview', currentSubTab: 'basic' },
      null,
      'objects'
    );

    const version = await loadAppVersion();
    expect(version).toBe('3.0.0');
  });
});
