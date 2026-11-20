// AE動態桌布 — 本機儲存（IndexedDB：作品與收藏；localStorage：設定）
const DB_NAME = 'ae-wallpaper';
const DB_VER = 1;
let dbp = null;

function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        if (!d.objectStoreNames.contains('gallery')) d.createObjectStore('gallery', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

function tx(store, mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
    t.onerror = () => reject(t.error);
  }));
}

export const kvGet = (key) => tx('kv', 'readonly', (s) => s.get(key)).catch(() => null);
export const kvSet = (key, val) => tx('kv', 'readwrite', (s) => s.put(val, key)).catch(() => null);
export const galleryAll = () => tx('gallery', 'readonly', (s) => s.getAll())
  .then((list) => (list || []).sort((a, b) => a.created - b.created)).catch(() => []);
export const galleryPut = (item) => tx('gallery', 'readwrite', (s) => s.put(item));
export const galleryDel = (id) => tx('gallery', 'readwrite', (s) => s.delete(id));

const SETTINGS_KEY = 'ae-wallpaper-settings';
export const DEFAULT_SETTINGS = {
  touchFx: true,          // 觸碰畫面時噴出星星
  componentTap: true,     // 點元件會動＋發聲
  showFab: true,          // 互動模式中的 AE 互動按鈕
  showClock: true,        // 互動模式顯示鎖定畫面時鐘
  sfxVolume: 0.7,
  musicVolume: 0.8,
  rotateOn: false,        // 依頻率自動更換桌布
  rotateEvery: 1,
  rotateUnit: 'day',      // 'hour' | 'day'
  rotateAnchor: 0,
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch (e) { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}
