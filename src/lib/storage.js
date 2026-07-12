const DB_NAME = 'FOMViewerDB';
const DB_VERSION = 1;
const STORE_NAME = 'fomFiles';

let db = null;

function initDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };
  });
}

export async function saveFiles(files) {
  await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  for (const file of files) {
    store.put({ name: file.name, xml: file.xml });
  }
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveUiState(uiState) {
  await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  store.put({ name: '__uiState__', uiState });
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveAppspace(data, subTab) {
  await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  store.put({ name: '__appspace__', data, subTab });
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function loadUiState() {
  await initDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.get('__uiState__');
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result?.uiState || null);
    request.onerror = () => resolve(null);
  });
}

export async function loadAppspace() {
  await initDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.get('__appspace__');
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

export async function loadAllFiles() {
  await initDB();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();
  return new Promise((resolve) => {
    request.onsuccess = () => {
      const all = request.result || [];
      resolve(all.filter(f => f.name && !f.name.startsWith('__')));
    };
    request.onerror = () => resolve([]);
  });
}

export async function clearAll() {
  await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  store.clear();
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearAppspace() {
  await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  store.delete('__appspace__');
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveAll(files, uiState, appspaceData, appspaceSubTab) {
  await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  // Preserve __recentFiles__ before clearing
  const recentFilesReq = store.get('__recentFiles__');
  const recentFiles = await new Promise((resolve) => {
    recentFilesReq.onsuccess = () => resolve(recentFilesReq.result || null);
    recentFilesReq.onerror = () => resolve(null);
  });
  store.clear();
  for (const file of files) {
    store.put({ name: file.name, xml: file.xml });
  }
  store.put({ name: '__uiState__', uiState });
  if (recentFiles) {
    store.put(recentFiles);
  }
  if (appspaceData) {
    store.put({ name: '__appspace__', data: appspaceData, subTab: appspaceSubTab });
  }
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
