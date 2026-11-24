// AE Shinity — offline copy for licensed screens. Registered only by a licensed player (/gallery?license=…).
// The program, the works and the music are kept on this machine, so a restart without internet still plays.
// It only ever answers the gallery player (its pages and what they load); every other page of the site goes to the
// network untouched.
// - the page, scripts and styles: network first (updates arrive as soon as there is internet), the saved copy when
//   offline or when the host answers with an error
// - works and media: the saved copy first (they never change under the same address)
// - licence checks and every other API call: always the network (the player decides what to do when offline)
// - anything the server marks no-store is never saved
const CACHE = 'shinity-offline-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if ((k.startsWith('shinity-offline') || k.startsWith('lumina-offline')) && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

const isMedia = (url) => (url.pathname === '/api/shinity' && url.searchParams.get('a') === 'media') || /\.(webp|jpe?g|png|gif|avif|mp4|webm|mov|mp3|m4a|aac|ogg|wav|woff2?)$/i.test(url.pathname);
const isApi = (url) => url.pathname === '/api/shinity' && url.searchParams.get('a') !== 'media';
const isGalleryPage = (u) => { try { const p = new URL(u).pathname; return p === '/gallery' || p === '/gallery.html'; } catch { return false; } };
const keyOf = (req) => { const u = new URL(req.url); if (u.pathname === '/gallery' || u.pathname === '/gallery.html') return u.origin + '/gallery.html'; return req.url; };
const storable = (res) => res && res.ok && res.status === 200 && !/no-store/i.test(res.headers.get('Cache-Control') || '');

async function save(key, res) { if (storable(res)) { const c = await caches.open(CACHE); await c.put(key, res); } }

self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type !== 'precache' || !Array.isArray(d.urls)) return;
  e.waitUntil((async () => {
    const c = await caches.open(CACHE), want = new Set();
    for (const u of d.urls.slice(0, 400)) {
      try {
        const url = new URL(u); if (url.origin !== self.location.origin || isApi(url)) continue;
        const key = keyOf(new Request(u)); want.add(key);
        if (isMedia(url) && await c.match(key)) continue; // media never changes under the same address
        const r = await fetch(u, { cache: 'no-cache' }); await save(key, r);
      } catch { /* offline right now: next time */ }
    }
    // works no longer in the licence leave the machine
    for (const req of await c.keys()) { const url = new URL(req.url); if (isMedia(url) && !want.has(req.url)) await c.delete(req); }
  })());
});

async function fromGallery(e) {
  if (e.request.mode === 'navigate') return isGalleryPage(e.request.url);
  if (!e.clientId) return false;
  const cl = await self.clients.get(e.clientId);
  return !!cl && isGalleryPage(cl.url);
}

function rangeOf(buf, header, type) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header || ''); if (!m || (m[1] === '' && m[2] === '')) return null;
  const size = buf.byteLength;
  const start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  const end = m[1] !== '' && m[2] !== '' ? Math.min(size - 1, Number(m[2])) : size - 1;
  if (start > end || start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(buf.slice(start, end + 1), { status: 206, headers: { 'Content-Type': type || 'application/octet-stream', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}

self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== self.location.origin || isApi(url)) return;
  e.respondWith((async () => {
    if (!(await fromGallery(e))) return fetch(req); // the rest of the site: untouched
    const key = keyOf(req);
    if (isMedia(url)) {
      const hit = await caches.match(key);
      if (hit) {
        if (!req.headers.get('range')) return hit;
        return rangeOf(await hit.arrayBuffer(), req.headers.get('range'), hit.headers.get('Content-Type')) || hit;
      }
      const r = await fetch(req);
      if (!req.headers.get('range')) e.waitUntil(save(key, r.clone()));
      return r;
    }
    // the program: network first; the saved copy when offline or when the host answers with an error
    try {
      const r = await fetch(req);
      if (r.status >= 500) { const hit = await caches.match(key, { ignoreSearch: key.endsWith('/gallery.html') }); if (hit) return hit; }
      e.waitUntil(save(key, r.clone())); return r;
    } catch (err) { const hit = await caches.match(key, { ignoreSearch: key.endsWith('/gallery.html') }); if (hit) return hit; throw err; }
  })());
});
