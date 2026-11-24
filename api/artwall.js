// /api/artwall — 藝術電視牆 Art TV Wall: Owner-added works (the 27 original Selected Works are static and never stored here).
// GET  (public)            → list of Owner-added works (read-only for visitors)
// GET  ?img=<id>           → streams that work's image
// GET  ?whoami=1 (+key)    → {owner:true|false}
// POST / PUT ?id= / DELETE ?id=  → Owner only (header x-ae-owner-key). Visitors get 401.
// Storage: the project's existing Vercel Blob store (private), prefix artwall/. Owner key: AE_ARTWALL_OWNER_KEY if set, else the existing FEEL_ADMIN_KEY.
'use strict';
const crypto = require('node:crypto');

const INDEX = 'artwall/index.json';
const MAX_ITEMS = 1000, MAX_IMG_BYTES = 3.2 * 1024 * 1024;
const LIM = { title: 80, intro: 600 };
const dev = { items: [], imgs: new Map() }; // local dev only (AE_ARTWALL_DEV_MEMORY=1), never used on Vercel

function blobReady() { return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)); }
function devMemory() { return !process.env.VERCEL && process.env.AE_ARTWALL_DEV_MEMORY === '1'; }
function storageName() { return blobReady() ? 'blob' : (devMemory() ? 'dev-memory' : 'none'); }
function ownerKey() { return process.env.AE_ARTWALL_OWNER_KEY || process.env.FEEL_ADMIN_KEY || ''; }
function keySource() { return process.env.AE_ARTWALL_OWNER_KEY ? 'AE_ARTWALL_OWNER_KEY' : (process.env.FEEL_ADMIN_KEY ? 'FEEL_ADMIN_KEY' : 'none'); }
function safeEq(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
function isOwner(req) {
  const key = ownerKey();
  if (!key || key.length < 16) return false;
  const given = req.headers['x-ae-owner-key'] || '';
  return given ? safeEq(given, key) : false;
}
function send(res, status, body, cache) {
  // v2476.88: public list is CDN-cached briefly so page views stop costing one uncached Blob read each.
  res.setHeader('Cache-Control', cache || 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status; res.end(JSON.stringify(body));
}
function clean(s, max) {
  return String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/[<>]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > 4.4 * 1024 * 1024) throw Object.assign(new Error('too large'), { status: 413 }); chunks.push(c); }
  const t = Buffer.concat(chunks).toString('utf8');
  return t ? JSON.parse(t) : {};
}
async function readIndex(fresh) {
  if (blobReady()) {
    const { get } = await import('@vercel/blob');
    try {
      const r = await get(INDEX, fresh ? { access: 'private', useCache: false } : { access: 'private' });
      if (!r || r.statusCode !== 200 || !r.stream) return [];
      const j = JSON.parse(await new Response(r.stream).text());
      return Array.isArray(j.items) ? j.items : [];
    } catch (e) { if (/not.?found|404/i.test(String(e && (e.name + e.message)))) return []; throw e; }
  }
  if (devMemory()) return dev.items.slice();
  return [];
}
async function writeIndex(items) {
  const body = JSON.stringify({ v: 1, updatedAt: new Date().toISOString(), items });
  if (blobReady()) {
    const { put } = await import('@vercel/blob');
    await put(INDEX, body, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 });
    return;
  }
  dev.items = items.slice();
}
function parseImage(dataUrl) {
  const m = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw Object.assign(new Error('image must be a JPEG/PNG/WebP data URL'), { status: 400 });
  const buf = Buffer.from(m[3], 'base64');
  if (!buf.length || buf.length > MAX_IMG_BYTES) throw Object.assign(new Error('image too large'), { status: 413 });
  return { buf, type: m[1], ext: m[2] === 'jpeg' ? 'jpg' : m[2] };
}
async function putImage(id, img) {
  const path = `artwall/img/${id}-${Date.now().toString(36)}.${img.ext}`;
  if (blobReady()) {
    const { put } = await import('@vercel/blob');
    await put(path, img.buf, { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: img.type });
  } else dev.imgs.set(path, img);
  return path;
}
async function delImage(path) {
  if (!path) return;
  try { if (blobReady()) { const { del } = await import('@vercel/blob'); await del(path); } else dev.imgs.delete(path); } catch (e) {}
}
function publicItem(it) {
  return { id: it.id, title_en: it.title_en, title_zh: it.title_zh, intro_en: it.intro_en, intro_zh: it.intro_zh, w: it.w || 0, h: it.h || 0,
    img: `/api/artwall?img=${encodeURIComponent(it.id)}&v=${encodeURIComponent(it.updatedAt || '')}`, createdAt: it.createdAt, updatedAt: it.updatedAt };
}
function fields(b, it) {
  for (const k of ['title_en', 'title_zh']) if (k in b) it[k] = clean(b[k], LIM.title);
  for (const k of ['intro_en', 'intro_zh']) if (k in b) it[k] = clean(b[k], LIM.intro);
  for (const k of ['w', 'h']) if (k in b) it[k] = Math.max(0, Math.min(20000, parseInt(b[k], 10) || 0));
  return it;
}

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const q = Object.fromEntries(url.searchParams);
    const method = req.method || 'GET';
    if (method === 'GET' && q.img) {
      const items = await readIndex();
      const it = items.find(x => x.id === q.img);
      if (!it) return send(res, 404, { ok: false, error: 'not found' });
      if (blobReady()) {
        const { get } = await import('@vercel/blob');
        const r = await get(it.path, { access: 'private' }); // image paths are immutable (new path per upload) → Blob cache is safe
        if (!r || r.statusCode !== 200) return send(res, 404, { ok: false, error: 'not found' });
        res.statusCode = 200;
        res.setHeader('Content-Type', (r.blob && r.blob.contentType) || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400');
        return res.end(Buffer.from(await new Response(r.stream).arrayBuffer()));
      }
      const img = dev.imgs.get(it.path); if (!img) return send(res, 404, { ok: false });
      res.statusCode = 200; res.setHeader('Content-Type', img.type); return res.end(img.buf);
    }
    if (method === 'GET') {
      const owner = isOwner(req);
      if (q.whoami) return send(res, 200, { ok: true, owner, storage: storageName(), keyConfigured: ownerKey().length >= 16, keySource: owner ? keySource() : undefined });
      const fresh = Boolean(q.fresh);
      const items = storageName() === 'none' ? [] : await readIndex(fresh);
      return send(res, 200, { ok: true, storage: storageName(), writable: storageName() !== 'none' && ownerKey().length >= 16, items: items.map(publicItem) },
        fresh ? 'no-store' : 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
    }
    if (!['POST', 'PUT', 'DELETE'].includes(method)) return send(res, 405, { ok: false, error: 'method not allowed' });
    if (!isOwner(req)) return send(res, 401, { ok: false, error: 'owner only' });
    if (storageName() === 'none') return send(res, 503, { ok: false, error: 'storage not configured' });
    const items = await readIndex(true);
    if (method === 'DELETE') {
      const id = String(q.id || '');
      if (/^o\d+$/.test(id)) return send(res, 403, { ok: false, error: 'original Selected Works cannot be changed here' });
      const i = items.findIndex(x => x.id === id);
      if (i < 0) return send(res, 404, { ok: false, error: 'not found' });
      const [gone] = items.splice(i, 1);
      await writeIndex(items); await delImage(gone.path);
      return send(res, 200, { ok: true, deleted: id, count: items.length });
    }
    const b = await readBody(req);
    const now = new Date().toISOString();
    if (method === 'POST') {
      if (items.length >= MAX_ITEMS) return send(res, 400, { ok: false, error: 'too many items' });
      const img = parseImage(b.image);
      const id = 'w' + crypto.randomBytes(6).toString('hex');
      const it = fields(b, { id, title_en: '', title_zh: '', intro_en: '', intro_zh: '', createdAt: now, updatedAt: now });
      it.path = await putImage(id, img);
      items.push(it); await writeIndex(items);
      return send(res, 201, { ok: true, item: publicItem(it), count: items.length });
    }
    // PUT
    const id = String(q.id || b.id || '');
    if (/^o\d+$/.test(id)) return send(res, 403, { ok: false, error: 'original Selected Works cannot be changed here' });
    const it = items.find(x => x.id === id);
    if (!it) return send(res, 404, { ok: false, error: 'not found' });
    fields(b, it); it.updatedAt = now;
    if (b.image) { const old = it.path; it.path = await putImage(id, parseImage(b.image)); await writeIndex(items); await delImage(old); }
    else await writeIndex(items);
    return send(res, 200, { ok: true, item: publicItem(it) });
  } catch (e) {
    return send(res, e.status || 500, { ok: false, error: e.status ? e.message : 'server error' });
  }
};
