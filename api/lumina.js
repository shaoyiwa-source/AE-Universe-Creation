// AE Lumina Wall — cloud library API (single Vercel function; routes by ?a=)
//
// Environment (Vercel → Project → Settings → Environment Variables):
//   LUMINA_STUDIO_PASSWORD   AE Studio password (required for any curator action)
//   LUMINA_SESSION_SECRET    optional; signing secret for studio sessions (defaults to a hash of the password)
//   BLOB_READ_WRITE_TOKEN    the project's (private) Vercel Blob store — already used by the shop
//   LUMINA_FS_DIR            local development only: store everything in this folder instead of Blob
//
// Public:  GET  ?a=catalog            → works (visible only), exhibitions, tracks
//          GET  ?a=media&p=media/x    → streams a stored file (supports Range for video/audio)
//          POST ?a=login {password}   → { token, exp }
// Studio (Authorization: Bearer <token>):
//          GET  ?a=catalog            → includes hidden works
//          POST ?a=upload&kind=work|thumb|track&type=<mime>[&id=][&name=]   raw body (octet-stream, ≤ 4.3 MB)
//          POST ?a=update {id, patch} · ?a=reorder {ids} · ?a=delete {id} · ?a=track-delete {id}
//          POST ?a=exhibition-save {exhibition} · ?a=exhibition-delete {id}
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = 'ae-lumina';
const CATALOG = `${ROOT}/catalog.json`;
const MAX_UPLOAD = Math.floor(4.3 * 1024 * 1024);
const MODES = ['gallery', 'healing', 'hotel', 'residence', 'party', 'kids', 'online', 'cinema'];
const TRANSITIONS = ['random', 'innerbloom', 'dissolve', 'bloom', 'rings', 'ink', 'silk', 'stardust', 'bubbles'];
const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', wav: 'audio/wav',
};
const EXT_BY_MIME = Object.fromEntries(Object.entries(MIME).map(([k, v]) => [v, k]));
EXT_BY_MIME['image/jpeg'] = 'jpg'; EXT_BY_MIME['audio/x-m4a'] = 'm4a'; EXT_BY_MIME['audio/mp3'] = 'mp3'; EXT_BY_MIME['audio/x-wav'] = 'wav';

const BUILTIN = [
  ['Eternal Sun', '盛明', 'assets/4e0991885a9649ea.webp'], ['Infinity Core', '', 'assets/b46ca2328e93f1f4.webp'],
  ['Universe Heart Bloom', '', 'assets/bb5c9cf38f67af5b.webp'], ['Infinite Love', '', 'assets/2ee9aa3b017652d9.webp'],
  ['Life Energy Field', '', 'assets/52116e7d3550cdf1.webp'], ['Life Bloom', '', 'assets/6c165bd1deb30988.webp'],
  ['Joyful World', '', 'assets/85b757c169e7afd6.webp'], ['Universe Abundance', '', 'assets/cfda3a3a0f7fa43d.webp'],
  ['Heart Fly', '', 'assets/selected-works-v2/heart-fly.webp'], ['Heart Recovery', '', 'assets/selected-works-v2/heart-recovery.webp'],
  ['Love Embrace', '', 'assets/selected-works-v2/love-embrace.webp'], ['Love Energy Field', '', 'assets/selected-works-v2/love-energy-field.webp'],
  ['Colorful Flow', '', 'assets/selected-works-v2/colorful-flow.webp'], ['Nature’s Strength', '', 'assets/selected-works-v2/natures-strength.webp'],
  ['Fun Universe', '', 'assets/selected-works-v2/fun-universe.webp'], ['Marvellous Energy World', '', 'assets/selected-works-v2/marvellous-energy-world.webp'],
  ['', '', 'assets/selected-works-v2/selected-17.webp'], ['Expansion', '', 'assets/selected-works-v2/expansion.webp'],
  ['Heart Rebuild', '', 'assets/selected-works-v2/heart-rebuild.webp'], ['Flower Heart Bloom', '', 'assets/selected-works-v2/flower-heart-bloom.webp'],
  ['Heart Energy', '', 'assets/selected-works-v2/heart-energy.webp'], ['Infinite Love Strength', '', 'assets/selected-works-v2/infinite-love-strength.webp'],
  ['', '', 'assets/selected-works-v2/selected-23.webp'], ['', '', 'assets/selected-works-v2/selected-24.webp'],
  ['', '', 'assets/selected-works-v2/selected-25.webp'], ['', '', 'assets/selected-works-v2/selected-26.webp'],
  ['', '', 'assets/selected-works-v2/selected-27.webp'],
];

function seedCatalog() {
  return {
    v: 1, updatedAt: 0,
    works: BUILTIN.map(([en, zh, src], i) => ({
      id: 'ae' + String(i + 1).padStart(2, '0'), no: i + 1, builtin: true, type: 'image', src, thumb: src,
      title: { en, zh }, year: '', medium: '', size: '', statement: { en: '', zh: '' }, hidden: false,
    })),
    exhibitions: [],
    tracks: [],
  };
}

// ---------- storage ----------
function fsStore(dir) {
  const full = (p) => path.join(dir, p);
  return {
    kind: 'fs',
    async get(p) { try { return fs.readFileSync(full(p)); } catch { return null; } },
    async put(p, buf) { fs.mkdirSync(path.dirname(full(p)), { recursive: true }); fs.writeFileSync(full(p), buf); },
    async del(p) { try { fs.unlinkSync(full(p)); } catch { /* ignore */ } },
  };
}
function blobStore() {
  const sdk = () => import('@vercel/blob');
  return {
    kind: 'blob',
    async get(p) {
      try {
        const { get } = await sdk();
        const r = await get(p, { access: 'private', useCache: false });
        if (!r || r.statusCode !== 200) return null;
        return Buffer.from(await new Response(r.stream).arrayBuffer());
      } catch { return null; }
    },
    async put(p, buf, contentType) {
      const { put } = await sdk();
      await put(p, buf, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType });
    },
    async del(p) { try { const { del } = await sdk(); await del(p); } catch { /* ignore */ } },
  };
}
function storage() {
  if (process.env.LUMINA_FS_DIR) return fsStore(process.env.LUMINA_FS_DIR);
  if (process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)) return blobStore();
  return null;
}

async function readCatalog(store) {
  if (!store) return seedCatalog();
  const buf = await store.get(CATALOG);
  if (!buf) return seedCatalog();
  try {
    const c = JSON.parse(buf.toString('utf8'));
    c.works = Array.isArray(c.works) ? c.works : []; c.exhibitions = Array.isArray(c.exhibitions) ? c.exhibitions : []; c.tracks = Array.isArray(c.tracks) ? c.tracks : [];
    return c;
  } catch { return seedCatalog(); }
}
async function writeCatalog(store, c) {
  c.updatedAt = Date.now();
  await store.put(CATALOG, Buffer.from(JSON.stringify(c)), 'application/json');
}

// ---------- auth ----------
function password() { return String(process.env.LUMINA_STUDIO_PASSWORD || ''); }
function secret() { return process.env.LUMINA_SESSION_SECRET || crypto.createHash('sha256').update('ae-lumina-session:' + password()).digest(); }
function signToken(hours = 12) {
  const exp = Date.now() + hours * 3600e3;
  const body = Buffer.from(JSON.stringify({ exp, n: crypto.randomBytes(6).toString('hex') })).toString('base64url');
  const mac = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return { token: `${body}.${mac}`, exp };
}
function verifyToken(token) {
  if (!password() || !token) return false;
  const [body, mac] = String(token).split('.');
  if (!body || !mac) return false;
  const want = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return false;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}
function isStudio(req) {
  const h = String(req.headers.authorization || '');
  return verifyToken(h.startsWith('Bearer ') ? h.slice(7) : '');
}
function samePassword(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

// ---------- helpers ----------
function jsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  if (Buffer.isBuffer(req.body)) { try { return JSON.parse(req.body.toString('utf8')); } catch { return {}; } }
  return {};
}
async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'binary');
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > MAX_UPLOAD) { const e = new Error('too large'); e.code = 'TOO_LARGE'; throw e; } chunks.push(c); }
  return Buffer.concat(chunks);
}
const rid = (p) => p + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
const str = (v, max = 200) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const bi = (v, max) => ({ en: str(v && v.en, max), zh: str(v && v.zh, max) });
const mediaPath = (p) => /^media\/[a-z0-9-]+\.(jpg|jpeg|png|webp|gif|avif|mp4|webm|mov|mp3|m4a|aac|ogg|wav)$/.test(p) ? `${ROOT}/${p}` : null;
const mediaUrl = (rel) => `/api/lumina?a=media&p=${encodeURIComponent(rel)}`;
function relOf(url) { const m = /[?&]p=([^&]+)/.exec(String(url || '')); return m ? decodeURIComponent(m[1]) : null; }

function publicView(c, studio) {
  return {
    v: c.v, updatedAt: c.updatedAt,
    works: studio ? c.works : c.works.filter(w => !w.hidden),
    exhibitions: c.exhibitions.map(e => ({ ...e, items: e.items.filter(it => studio || c.works.some(w => w.id === it.id && !w.hidden)) })),
    tracks: c.tracks,
  };
}

function sanitizeExhibition(e, c) {
  const ids = new Set(c.works.map(w => w.id));
  const items = (Array.isArray(e.items) ? e.items : []).filter(it => it && ids.has(it.id)).slice(0, 500).map(it => {
    const o = { id: it.id };
    const d = Number(it.duration);
    if (Number.isFinite(d) && d >= 3 && d <= 3600) o.duration = Math.round(d);
    if (TRANSITIONS.includes(it.transition) && it.transition !== 'random') o.transition = it.transition;
    return o;
  });
  return {
    id: /^x[a-z0-9]+$/.test(String(e.id || '')) ? e.id : rid('x'),
    title: bi(e.title, 80),
    note: bi(e.note, 600),
    mode: MODES.includes(e.mode) ? e.mode : 'online',
    items,
  };
}

// ---------- handler ----------
module.exports = async function handler(req, res) {
  const a = String((req.query && req.query.a) || '');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (a === 'media') return await media(req, res);
    if (a === 'catalog') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
      const store = storage();
      const studio = isStudio(req);
      const c = await readCatalog(store);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ...publicView(c, studio), studio, storage: store ? store.kind : 'none' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    res.setHeader('Cache-Control', 'no-store');

    if (a === 'login') {
      if (!password()) return res.status(503).json({ error: 'STUDIO_NOT_CONFIGURED' });
      const { password: pw } = jsonBody(req);
      if (!pw || !samePassword(pw, password())) {
        await new Promise(r => setTimeout(r, 600)); // slow down guessing
        return res.status(401).json({ error: 'WRONG_PASSWORD' });
      }
      return res.status(200).json(signToken());
    }

    if (!isStudio(req)) return res.status(401).json({ error: 'STUDIO_ONLY' });
    const store = storage();
    if (!store) return res.status(503).json({ error: 'STORAGE_NOT_READY' });
    const c = await readCatalog(store);

    if (a === 'upload') {
      const kind = String(req.query.kind || 'work');
      // The client sends the bytes as application/octet-stream (so Vercel hands us a Buffer) and the real type in ?type=
      const ctype = String(req.query.type || req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const ext = EXT_BY_MIME[ctype];
      if (!ext) return res.status(415).json({ error: 'UNSUPPORTED_TYPE' });
      const buf = await rawBody(req);
      if (!buf.length) return res.status(400).json({ error: 'EMPTY' });
      if (buf.length > MAX_UPLOAD) return res.status(413).json({ error: 'TOO_LARGE' });
      const name = str(req.query.name, 80);
      if (kind === 'work') {
        if (!/^(image|video)\//.test(ctype)) return res.status(415).json({ error: 'UNSUPPORTED_TYPE' });
        const id = rid('w');
        const rel = `media/${id}.${ext}`;
        await store.put(`${ROOT}/${rel}`, buf, ctype);
        const w = { id, builtin: false, type: ctype.startsWith('video/') ? 'video' : 'image', src: mediaUrl(rel), thumb: ctype.startsWith('video/') ? '' : mediaUrl(rel),
          title: { en: name, zh: '' }, year: '', medium: '', size: '', statement: { en: '', zh: '' }, hidden: false, added: Date.now() };
        c.works.push(w);
        await writeCatalog(store, c);
        return res.status(200).json({ work: w });
      }
      if (kind === 'thumb') {
        const w = c.works.find(x => x.id === req.query.id && !x.builtin);
        if (!w || !ctype.startsWith('image/')) return res.status(404).json({ error: 'NOT_FOUND' });
        const rel = `media/${w.id}-thumb.${ext}`;
        await store.put(`${ROOT}/${rel}`, buf, ctype);
        w.thumb = mediaUrl(rel);
        await writeCatalog(store, c);
        return res.status(200).json({ work: w });
      }
      if (kind === 'track') {
        if (!ctype.startsWith('audio/')) return res.status(415).json({ error: 'UNSUPPORTED_TYPE' });
        const id = rid('t');
        const rel = `media/${id}.${ext}`;
        await store.put(`${ROOT}/${rel}`, buf, ctype);
        const t = { id, name: name || 'AE track', src: mediaUrl(rel) };
        c.tracks.push(t);
        await writeCatalog(store, c);
        return res.status(200).json({ track: t });
      }
      return res.status(400).json({ error: 'BAD_KIND' });
    }

    const body = jsonBody(req);
    if (a === 'update') {
      const w = c.works.find(x => x.id === body.id);
      if (!w) return res.status(404).json({ error: 'NOT_FOUND' });
      const p = body.patch || {};
      if (p.title) w.title = bi(p.title, 120);
      if (p.statement) w.statement = bi(p.statement, 1200);
      for (const k of ['year', 'medium', 'size']) if (k in p) w[k] = str(p[k], 120);
      if ('hidden' in p) w.hidden = !!p.hidden;
      await writeCatalog(store, c);
      return res.status(200).json({ work: w });
    }
    if (a === 'reorder') {
      const order = Array.isArray(body.ids) ? body.ids : [];
      const pos = new Map(order.map((id, i) => [id, i]));
      c.works.sort((x, y) => (pos.has(x.id) ? pos.get(x.id) : 1e6) - (pos.has(y.id) ? pos.get(y.id) : 1e6));
      await writeCatalog(store, c);
      return res.status(200).json({ ok: true });
    }
    if (a === 'delete') {
      const w = c.works.find(x => x.id === body.id);
      if (!w) return res.status(404).json({ error: 'NOT_FOUND' });
      if (w.builtin) { w.hidden = true; } // site artworks live in /assets; hide instead of deleting
      else {
        for (const u of [w.src, w.thumb]) { const r = relOf(u); const p = r && mediaPath(r); if (p) await store.del(p); }
        c.works = c.works.filter(x => x.id !== w.id);
        for (const e of c.exhibitions) e.items = e.items.filter(it => it.id !== w.id);
      }
      await writeCatalog(store, c);
      return res.status(200).json({ ok: true, hidden: !!w.builtin });
    }
    if (a === 'track-delete') {
      const t = c.tracks.find(x => x.id === body.id);
      if (!t) return res.status(404).json({ error: 'NOT_FOUND' });
      const r = relOf(t.src); const p = r && mediaPath(r); if (p) await store.del(p);
      c.tracks = c.tracks.filter(x => x.id !== t.id);
      await writeCatalog(store, c);
      return res.status(200).json({ ok: true });
    }
    if (a === 'exhibition-save') {
      const e = sanitizeExhibition(body.exhibition || {}, c);
      const i = c.exhibitions.findIndex(x => x.id === e.id);
      if (i >= 0) c.exhibitions[i] = e; else c.exhibitions.push(e);
      await writeCatalog(store, c);
      return res.status(200).json({ exhibition: e });
    }
    if (a === 'exhibition-delete') {
      c.exhibitions = c.exhibitions.filter(x => x.id !== body.id);
      await writeCatalog(store, c);
      return res.status(200).json({ ok: true });
    }
    return res.status(404).json({ error: 'UNKNOWN_ACTION' });
  } catch (err) {
    if (err && err.code === 'TOO_LARGE') return res.status(413).json({ error: 'TOO_LARGE' });
    console.error('lumina api error', err && err.message);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
};

async function media(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(405).send('Method Not Allowed');
  const rel = String(req.query.p || '');
  const p = mediaPath(rel);
  const store = storage();
  if (!p || !store) return res.status(404).send('Not found');
  const buf = await store.get(p);
  if (!buf) return res.status(404).send('Not found');
  const ext = rel.split('.').pop();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  // R3: works are public art previews; R4 (membership) will gate this behind an entitlement check.
  res.setHeader('Cache-Control', 'public, max-age=86400');
  const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  if (range) {
    let start = range[1] === '' ? buf.length - Number(range[2]) : Number(range[1]);
    let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : buf.length - 1;
    start = Math.max(0, start); end = Math.min(buf.length - 1, end);
    if (start > end) { res.setHeader('Content-Range', `bytes */${buf.length}`); return res.status(416).end(); }
    res.setHeader('Content-Range', `bytes ${start}-${end}/${buf.length}`);
    res.setHeader('Content-Length', String(end - start + 1));
    res.statusCode = 206;
    return res.end(req.method === 'HEAD' ? undefined : buf.subarray(start, end + 1));
  }
  res.setHeader('Content-Length', String(buf.length));
  res.statusCode = 200;
  return res.end(req.method === 'HEAD' ? undefined : buf);
}

