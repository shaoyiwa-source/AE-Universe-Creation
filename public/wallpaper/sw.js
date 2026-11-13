// AE動態桌布 — 離線快取（網路優先，失敗時用快取）
const CACHE = 'ae-wallpaper-v3';
const SHELL = [
  '/wallpaper/', '/wallpaper/style.css?v=3', '/wallpaper/js/app.js?v=3', '/wallpaper/js/scene.js',
  '/wallpaper/js/effects.js', '/wallpaper/js/sound.js', '/wallpaper/js/store.js',
  '/wallpaper/manifest.webmanifest', '/wallpaper/icons/ae-rings.webp',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && (e.request.url.startsWith(self.location.origin) || e.request.url.includes('fonts.g'))) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' }))
  );
});
