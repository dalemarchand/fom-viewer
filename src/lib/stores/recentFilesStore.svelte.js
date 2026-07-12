const DB_NAME = 'FOMViewerDB';
const STORE_NAME = 'fomFiles';
const KEY = '__recentFiles__';
const MAX_ENTRIES = 10;

let recentFiles = $state([]);

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };
  });
}

async function load() {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(KEY);
    return new Promise((resolve) => {
      request.onsuccess = () => {
        recentFiles = request.result?.entries || [];
        resolve();
      };
      request.onerror = () => resolve();
    });
  } catch (e) {
    console.warn('Failed to load recent files:', e);
  }
}

async function persist() {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put({ name: KEY, entries: JSON.parse(JSON.stringify(recentFiles)) });
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (e) {
    console.warn('Failed to save recent files:', e);
  }
}

export function getRecentFiles() {
  return recentFiles;
}

export async function addRecentFile(name, stats = {}) {
  const entry = {
    name,
    timestamp: Date.now(),
    stats: { objects: stats.objects || 0, interactions: stats.interactions || 0, dataTypes: stats.dataTypes || 0 }
  };
  recentFiles = [entry, ...recentFiles.filter(f => f.name !== name)].slice(0, MAX_ENTRIES);
  await persist();
}

export async function removeRecentFile(name) {
  recentFiles = recentFiles.filter(f => f.name !== name);
  await persist();
}

export async function clearRecentFiles() {
  recentFiles = [];
  await persist();
}

export async function initRecentFiles() {
  await load();
  if (recentFiles.length > 0) return;
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    await new Promise((resolve) => {
      request.onsuccess = () => {
        const all = request.result || [];
        const cached = all.filter(f => f.name && !f.name.startsWith('__') && f.xml);
        for (const f of cached) {
          const dup = recentFiles.find(r => r.name === f.name);
          if (!dup) {
            recentFiles.push({ name: f.name, timestamp: Date.now(), stats: f.stats || {} });
          }
        }
        if (cached.length > 0) persist();
        resolve();
      };
      request.onerror = () => resolve();
    });
  } catch (e) {
    console.warn('Failed to seed recent files from cache:', e);
  }
}

export function getRecentFileCount() {
  return recentFiles.length;
}
