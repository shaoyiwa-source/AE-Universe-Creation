// AE Lumina Wall — offline copy for licensed screens. Registered only by a licensed player (/gallery?license=…).
// The program, the works and the music are kept on this machine, so a restart without internet still plays.
// - the page, scripts and styles: network first (updates arrive as soon as there is internet), the saved copy when offline
// - works and media: the saved copy first (they never change under the same address)
// - licence checks and every other API call: always the network (the player itself decides what to do when offline)
const CACHE = 'lumina-offline-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const isMedia = (url) => (url.pathname === '/api/lumina' && url.searchParams.get('a') === 'media') || /\.(webp|jpe?g|png|gif|avif|mp4|webm|mov|mp3|m4a|aac|ogg|wav|woff2?)$/i.test(url.pathname);
const isApi = (url) => url.pathname === '/api/lumina' && url.searchParams.get('a') !== 'media';
const keyOf = (req) => { const u = new URL(req.url); if (u.pathname === '/gallery' || u.pathname === '/gallery.html') return u.origin + '/gallery.html'; return req.url; };

async function save(key, res) { if (res && res.ok && res.status === 200) { const c = await caches.open(CACHE); await c.put(key, res); } }

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type !== 'precache' || !Array.isArray(d.urls)) return;
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    for (const u of d.urls.slice(0, 400)) {
      try {
        const url = new URL(u); if (url.origin !== self.location.origin || isApi(url)) continue;
        const key = keyOf(new Request(u));
        if (isMedia(url) && await c.match(key)) continue; // media never changes under the same address
        const r = await fetch(u, { cache: 'no-cache' }); await save(key, r);
      } catch { /* offline right now: next time */ }
    }
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== self.location.origin || isApi(url)) return;
  const key = keyOf(req);
  if (isMedia(url)) {
    e.respondWith((async () => {
      const hit = await caches.match(key);
      if (hit) {
        const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.get('range') || '');
        if (!range) return hit;
        const buf = await hit.arrayBuffer(), start = Number(range[1]), end = range[2] ? Math.min(buf.byteLength - 1, Number(range[2])) : buf.byteLength - 1;
        return new Response(buf.slice(start, end + 1), { status: 206, headers: { 'Content-Type': hit.headers.get('Content-Type') || 'application/octet-stream', 'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
      }
      const r = await fetch(req);
      if (!req.headers.get('range')) e.waitUntil(save(key, r.clone()));
      return r;
    })());
    return;
  }
  // the program: network first, the saved copy when offline
  e.respondWith((async () => {
    try { const r = await fetch(req); e.waitUntil(save(key, r.clone())); return r; }
    catch (err) { const hit = await caches.match(key, { ignoreSearch: key.endsWith('/gallery.html') }); if (hit) return hit; throw err; }
  })());
});
