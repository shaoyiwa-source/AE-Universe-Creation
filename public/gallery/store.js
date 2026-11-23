// AE Shinity — local persistence (IndexedDB for blobs, localStorage for settings)
const DB_NAME = 'ae-lumina';
const DB_VER = 1;
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      if (!('indexedDB' in window)) throw new Error('IndexedDB unavailable');
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('works')) db.createObjectStore('works', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('media')) db.createObjectStore('media', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    } catch (e) { reject(e); }
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function run(storeName, mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const req = fn(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('aborted'));
  }));
}

export const db = {
  available: () => openDb().then(() => true, () => false),
  all: (s) => run(s, 'readonly', st => st.getAll()),
  get: (s, id) => run(s, 'readonly', st => st.get(id)),
  put: (s, v) => run(s, 'readwrite', st => st.put(v)),
  del: (s, id) => run(s, 'readwrite', st => st.delete(id)),
};

const SETTINGS_KEY = 'ae-lumina-settings';
export function loadSettings(defaults, key = SETTINGS_KEY) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { saved = {}; }
  const out = structuredClone(defaults);
  for (const k of Object.keys(defaults)) {
    if (!(k in saved)) continue;
    if (defaults[k] && typeof defaults[k] === 'object' && !Array.isArray(defaults[k])) {
      for (const kk of Object.keys(defaults[k])) if (kk in (saved[k] || {})) out[k][kk] = saved[k][kk];
    } else if (typeof saved[k] === typeof defaults[k] && Array.isArray(defaults[k]) === Array.isArray(saved[k])) {
      out[k] = saved[k];
    }
  }
  return out;
}
export function saveSettings(s, key = SETTINGS_KEY) {
  try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* private mode: ignore */ }
}
export function lsGet(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }
export function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
