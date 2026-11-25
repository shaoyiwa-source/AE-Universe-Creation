// AE Shinity — cloud library API (single Vercel function; routes by ?a=)
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
const MODES = ['gallery', 'healing', 'hotel', 'residence', 'party', 'dream', 'kids', 'online', 'cinema'];
const TRANSITIONS = ['random', 'innerbloom', 'dissolve', 'bloom', 'rings', 'ink', 'silk', 'stardust', 'bubbles'];
const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', js: 'text/javascript',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', wav: 'audio/wav',
};
const EXT_BY_MIME = Object.fromEntries(Object.entries(MIME).map(([k, v]) => [v, k]));
EXT_BY_MIME['application/javascript'] = 'js'; EXT_BY_MIME['image/jpeg'] = 'jpg'; EXT_BY_MIME['audio/x-m4a'] = 'm4a'; EXT_BY_MIME['audio/mp3'] = 'mp3'; EXT_BY_MIME['audio/x-wav'] = 'wav';

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
      title: { en, zh }, year: '', medium: '', size: '', statement: { en: '', zh: '' }, hidden: !en, // unnamed works stay hidden until AE names them
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
    async get(p) {
      if (fs.existsSync(path.join(dir, '.down'))) throw storageDown('simulated outage'); // tests: simulate a suspended store
      try { return fs.readFileSync(full(p)); } catch { return null; }
    },
    async put(p, buf) { fs.mkdirSync(path.dirname(full(p)), { recursive: true }); fs.writeFileSync(full(p), buf); },
    async del(p) { try { fs.unlinkSync(full(p)); } catch { /* ignore */ } },
    async list(prefix) { // every stored path starting with prefix
      if (fs.existsSync(path.join(dir, '.down'))) throw storageDown('simulated outage');
      const base = path.dirname(full(prefix + 'x')), out = [];
      const walk = (d) => { let es = []; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { return; } for (const e of es) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else { const rel = path.relative(dir, f).split(path.sep).join('/'); if (rel.startsWith(prefix)) out.push(rel); } } };
      walk(base); return out;
    },
  };
}
function storageDown(why) { const e = new Error('STORAGE_DOWN: ' + (why || '')); e.code = 'STORAGE_DOWN'; return e; }
function blobStore() {
  const sdk = () => import('@vercel/blob');
  return {
    kind: 'blob',
    async get(p) {
      try {
        const { get } = await sdk();
        const r = await get(p, { access: 'private', useCache: false });
        if (!r || r.statusCode === 404) return null;
        if (r.statusCode !== 200) throw storageDown(`status ${r.statusCode}`);
        return Buffer.from(await new Response(r.stream).arrayBuffer());
      } catch (e) {
        // "not found" is a normal answer; anything else (suspended store, quota, network) must never look like an empty library
        if (e && (e.code === 'STORAGE_DOWN')) throw e;
        if (e && /not.?found/i.test(String(e.name || '') + ' ' + String(e.message || ''))) return null;
        throw storageDown(e && e.message);
      }
    },
    async put(p, buf, contentType) {
      const { put } = await sdk();
      await put(p, buf, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType });
    },
    async del(p) { try { const { del } = await sdk(); await del(p); } catch { /* ignore */ } },
    async list(prefix) {
      try {
        const { list } = await sdk(); const out = []; let cursor;
        do { const r = await list({ prefix, cursor, limit: 1000 }); for (const b of r.blobs) out.push(b.pathname); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
        return out;
      } catch (e) { throw storageDown(e && e.message); }
    },
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
  } catch { throw storageDown('catalog unreadable'); }
}
let catCache = null;
async function readCatalogCached(store) { // licensed players' minute checks share one recent copy (≤ 20 s old)
  if (catCache && Date.now() - catCache.at < 20000) return catCache.c;
  const c = await readCatalog(store); catCache = { at: Date.now(), c }; return c;
}
async function writeCatalog(store, c) {
  catCache = null;
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
const mediaPath = (p) => /^media\/[a-z0-9-]+\.(jpg|jpeg|png|webp|gif|avif|mp4|webm|mov|mp3|m4a|aac|ogg|wav|js)$/.test(p) ? `${ROOT}/${p}` : null;
const mediaUrl = (rel) => `/api/lumina?a=media&p=${encodeURIComponent(rel)}`;
function relOf(url) { const m = /[?&]p=([^&]+)/.exec(String(url || '')); return m ? decodeURIComponent(m[1]) : null; }

function publicView(c, studio) {
  return {
    v: c.v, updatedAt: c.updatedAt,
    works: studio ? c.works : c.works.filter(w => !w.hidden && !w.private),
    exhibitions: studio ? c.exhibitions : c.exhibitions.filter(e => !e.private).map(e => ({ ...e, items: e.items.filter(it => c.works.some(w => w.id === it.id && !w.hidden && !w.private)) })),
    tracks: c.tracks,
    packs: Array.isArray(c.packs) ? c.packs : [],
  };
}

function sanitizeExhibition(e, c) {
  const ids = new Set(c.works.map(w => w.id));
  const items = (Array.isArray(e.items) ? e.items : []).filter(it => it && ids.has(it.id)).slice(0, 500).map(it => {
    const o = { id: it.id };
    const d = Number(it.duration);
    if (Number.isFinite(d) && d >= 3 && d <= 3600) o.duration = Math.round(d);
    if (TRANSITIONS.includes(it.transition) && it.transition !== 'random') o.transition = it.transition;
    // God mode choreography: effect packages and the transition package into this work (ids + plain parameters)
    const pack = (x) => {
      if (!x || !/^[a-z0-9-]{1,40}$/.test(String(x.id || ''))) return null;
      const p = {};
      for (const [k, v] of Object.entries(x.p && typeof x.p === 'object' ? x.p : {}).slice(0, 24)) {
        if (!/^[a-zA-Z0-9_-]{1,32}$/.test(k)) continue;
        if (typeof v === 'number' && Number.isFinite(v)) p[k] = v;
        else if (typeof v === 'boolean') p[k] = v;
        else if (typeof v === 'string' && v.length <= 40) p[k] = v;
      }
      return { id: x.id, p };
    };
    if (Array.isArray(it.fx)) { const fx = it.fx.map(pack).filter(Boolean).slice(0, 4); if (fx.length) o.fx = fx; }
    const tr = pack(it.tr); if (tr) o.tr = tr;
    const cam = pack(it.cam); if (cam) o.cam = cam;
    return o;
  });
  return {
    id: /^x[a-z0-9]+$/.test(String(e.id || '')) ? e.id : rid('x'),
    title: bi(e.title, 80),
    note: bi(e.note, 600),
    mode: MODES.includes(e.mode) ? e.mode : 'online',
    private: !!e.private, // made for one client: not on the public wall
    items,
  };
}

// ---------- handler ----------
// ---------- licences (R11): one licence = one client, one screen, one arranged exhibition ----------
// One file per licence (so two screens activating at the same moment never overwrite each other) plus a small
// index (activation code → licence). Players' minute checks read only their own licence, from a 20 s in-memory copy;
// writes happen only when a licence is created / changed / activated, or a device was last seen > 30 min ago.
const LIC_DIR = `${ROOT}/licenses`;
const LIC_INDEX = `${LIC_DIR}/index.json`;
const CONTROLS = ['modes', 'intensity', 'volume', 'music', 'advance', 'listen', 'record'];
const licCache = new Map();
const licPath = (id) => /^l[a-z0-9]{6,40}$/.test(id) ? `${LIC_DIR}/${id}.json` : null;
// three kinds of small files, so nothing is ever overwritten by a different writer:
//   licenses/<id>.json          what AE decides (status, period, modes…) — written only by AE Studio
//   licenses/devices/<id>.json  the screen bound to it (device, running session) — written only by that screen's checks
//   licenses/codes/<CODE>.json  activation code → licence id — written once when the licence is created
const devPath = (id) => /^l[a-z0-9]{6,40}$/.test(id) ? `${LIC_DIR}/devices/${id}.json` : null;
const codePath = (code) => /^[A-Z0-9]{12}$/.test(code) ? `${LIC_DIR}/codes/${code}.json` : null;
const devCache = new Map();
async function readDev(store, l, fresh = false) { // the bound screen, or null; a record from before the last "reset device" does not count
  if (!l) return null;
  const c = devCache.get(l.id); let d;
  if (!fresh && c && Date.now() - c.at < 20000) d = c.d;
  else { d = await readJson(store, devPath(l.id), null); devCache.set(l.id, { at: Date.now(), d }); }
  if (!d && l.device && l.device.id) d = { ...l.device, gen: l.transfers || 0 }; // stored the older way (inside the licence)
  return d && d.id && (d.gen || 0) === (l.transfers || 0) ? d : null;
}
async function writeDev(store, l, d) { d.gen = l.transfers || 0; await store.put(devPath(l.id), Buffer.from(JSON.stringify(d)), 'application/json'); devCache.set(l.id, { at: Date.now(), d }); }
async function licIdForCode(store, code) {
  const n = normCode(code), p = codePath(n); if (!p) return null;
  const x = await readJson(store, p, null); if (x && x.id) return x.id;
  return (await readIndex(store)).codes[n] || null; // licences created before code files
}
async function listLicIds(store) {
  const ids = new Set((await store.list(`${LIC_DIR}/l`)).map(p => (/^.*\/licenses\/(l[a-z0-9]{6,40})\.json$/.exec(p) || [])[1]).filter(Boolean));
  for (const id of Object.values((await readIndex(store)).codes)) ids.add(id);
  return [...ids];
}
async function readJson(store, p, empty) {
  const buf = await store.get(p);
  if (!buf) return empty;
  try { return JSON.parse(buf.toString('utf8')); } catch { throw storageDown('unreadable ' + p); }
}
async function readIndex(store) { const x = await readJson(store, LIC_INDEX, { v: 1, codes: {} }); if (!x.codes) x.codes = {}; return x; }
async function writeIndex(store, x) { await store.put(LIC_INDEX, Buffer.from(JSON.stringify(x)), 'application/json'); }
async function readLic(store, id, fresh = false) {
  const p = licPath(String(id || '')); if (!p) return null;
  const c = licCache.get(id);
  if (!fresh && c && Date.now() - c.at < 20000) return c.l;
  const l = await readJson(store, p, null);
  licCache.set(id, { at: Date.now(), l }); return l;
}
async function writeLic(store, l) { await store.put(licPath(l.id), Buffer.from(JSON.stringify(l)), 'application/json'); licCache.set(l.id, { at: Date.now(), l }); }
const CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
function newCode() { const b = crypto.randomBytes(12); let s = ''; for (let i = 0; i < 12; i++) s += CODE_ALPHA[b[i] % CODE_ALPHA.length]; return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`; }
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const dayOk = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
function sanitizeLicense(x, old, c) {
  const l = old ? { ...old } : { id: rid('l'), code: newCode(), created: Date.now(), status: 'active', device: null, transfers: 0 };
  if (x.customer) l.customer = { name: str(x.customer.name, 80), email: str(x.customer.email, 120), venue: str(x.customer.venue, 120) };
  if ('exhibitionId' in x) l.exhibitionId = c.exhibitions.some(e => e.id === x.exhibitionId) ? x.exhibitionId : null;
  if (Array.isArray(x.modes)) l.modes = x.modes.filter(m => MODES.includes(m)).slice(0, 9);
  if (!l.modes || !l.modes.length) l.modes = ['online'];
  if ('defaultMode' in x) l.defaultMode = MODES.includes(x.defaultMode) ? x.defaultMode : null;
  if (!l.modes.includes(l.defaultMode)) l.defaultMode = l.modes[0];
  if (Array.isArray(x.controls)) l.controls = x.controls.filter(k => CONTROLS.includes(k));
  if (!l.controls) l.controls = ['modes', 'intensity', 'volume'];
  if ('starts' in x) l.starts = dayOk(x.starts) ? x.starts : null;
  if ('expires' in x) l.expires = dayOk(x.expires) ? x.expires : null;
  if ('plan' in x) l.plan = str(x.plan, 40);
  if ('note' in x) l.note = str(x.note, 400);
  if ('offlineDays' in x) l.offlineDays = [1, 3, 7, 14, 30].includes(Number(x.offlineDays)) ? Number(x.offlineDays) : 3; // how long a screen may play without internet
  if (!l.offlineDays) l.offlineDays = 3;
  if ('status' in x && ['active', 'paused', 'revoked'].includes(x.status)) l.status = x.status;
  l.updated = Date.now();
  return l;
}
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // Taipei date
function licenceState(l) {
  if (!l) return 'NOT_FOUND';
  if (l.status === 'revoked') return 'REVOKED';
  if (l.status === 'paused') return 'PAUSED';
  if (l.starts && today() < l.starts) return 'NOT_STARTED';
  if (l.expires && today() > l.expires) return 'EXPIRED';
  return 'OK';
}
// device tokens use their own key when LUMINA_LICENSE_SECRET is set, so changing the studio password never stops venue screens
const licSecret = () => process.env.LUMINA_LICENSE_SECRET || secret();
function signDevice(lid, did) { const body = Buffer.from(JSON.stringify({ l: lid, d: did })).toString('base64url'); return `${body}.${crypto.createHmac('sha256', licSecret()).update('lic:' + body).digest('base64url')}`; }
function readDevice(tok) {
  const [body, mac] = String(tok || '').split('.'); if (!body || !mac) return null;
  const want = crypto.createHmac('sha256', licSecret()).update('lic:' + body).digest('base64url');
  if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
}
// what a licensed player receives: the arranged exhibition and only the works in it (including the client's own)
function licenceConfig(l, c) {
  const e = c.exhibitions.find(x => x.id === l.exhibitionId) || null;
  const ids = new Set(e ? e.items.map(it => it.id) : []);
  const works = c.works.filter(w => ids.has(w.id) && !w.hidden);
  const items = e ? e.items.filter(it => works.some(w => w.id === it.id)) : [];
  return {
    id: l.id, state: licenceState(l), customer: { name: (l.customer && l.customer.name) || '', venue: (l.customer && l.customer.venue) || '' },
    modes: l.modes, defaultMode: l.defaultMode, controls: l.controls, expires: l.expires || null, offlineDays: l.offlineDays || 3,
    exhibition: e ? { id: e.id, title: e.title, note: e.note, mode: e.mode, items } : null, works, packs: Array.isArray(c.packs) ? c.packs : [],
    version: Math.max(l.updated || 0, c.updatedAt || 0),
  };
}

module.exports = async function handler(req, res) {
  const a = String((req.query && req.query.a) || '');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    if (a === 'media') return await media(req, res);
    if (a === 'catalog') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
      const store = storage();
      const studio = isStudio(req);
      let c, kind = store ? store.kind : 'none';
      try { c = await readCatalog(store); } catch (e) {
        if (e.code !== 'STORAGE_DOWN') throw e;
        c = seedCatalog(); kind = 'degraded'; // the cloud library is unreachable: keep the wall playing with the built-in works
      }
      // visitors share one copy cached at the edge for a minute, so page views do not each read the cloud library;
      // AE Studio always reads fresh (separate URL + authorization)
      // browsers always ask again (no stale copies on screen); only Vercel's edge keeps the shared copy
      const studioUrl = req.query && req.query.studio === '1'; // the studio's address is never cached at the edge, even for a visitor who calls it
      res.setHeader('Cache-Control', studio || studioUrl ? 'private, no-store' : 'public, max-age=0, must-revalidate');
      if (!studio && !studioUrl) res.setHeader('Vercel-CDN-Cache-Control', kind === 'degraded' ? 'max-age=30' : 'max-age=60, stale-while-revalidate=86400, stale-if-error=86400');
      return res.status(200).json({ ...publicView(c, studio), studio, storage: kind });
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

    // ---- licensed players (public, but every answer depends on the activation code or a device token) ----
    if (a === 'license-activate' || a === 'license-config') {
      const st = storage(); if (!st) return res.status(503).json({ error: 'STORAGE_NOT_READY' });
      const b = jsonBody(req);
      const did = str(b.device, 64);
      // one running copy at a time: every launch has its own session id; the newest launch plays, an older copy stops
      // (a cloned computer carries the same device id, but not the same running session)
      const sid = /^[a-f0-9]{16,32}$/.test(String(b.sid || '')) ? String(b.sid) : '';
      if (!/^[a-f0-9]{32}$/.test(did)) return res.status(400).json({ error: 'BAD_DEVICE' });
      try {
      const C = await readCatalogCached(st);
      if (!sid) return res.status(400).json({ error: 'BAD_SID' }); // every running copy must say which launch it is
      if (a === 'license-activate') {
        const id = await licIdForCode(st, b.code);
        const l = id && (!b.license || b.license === id) ? await readLic(st, id, true) : null;
        if (!l) { await new Promise(r => setTimeout(r, 700)); return res.status(404).json({ error: 'WRONG_CODE' }); }
        const state = licenceState(l); if (state !== 'OK') return res.status(403).json({ error: state });
        const d = await readDev(st, l, true);
        if (d && d.id !== did) return res.status(409).json({ error: 'DEVICE_TAKEN' }); // one licence, one screen
        const nd = d ? { ...d, sid, sidAt: Date.now(), last: Date.now(), switches: (d.switches || 0) + (d.sid && d.sid !== sid ? 1 : 0) }
          : { id: did, at: Date.now(), last: Date.now(), ua: str(req.headers['user-agent'], 160), sid, sidAt: Date.now(), switches: 0 };
        await writeDev(st, l, nd);
        return res.status(200).json({ token: signDevice(l.id, did), config: licenceConfig(l, C) });
      }
      const t = readDevice(b.token);
      if (!t || t.d !== did) return res.status(401).json({ error: 'BAD_TOKEN' });
      const l = await readLic(st, t.l);
      if (!l) return res.status(404).json({ error: 'NOT_FOUND' });
      let d = await readDev(st, l);
      if (!d || d.id !== did) { d = await readDev(st, l, true); if (!d || d.id !== did) return res.status(409).json({ error: 'DEVICE_CHANGED' }); }
      const state = licenceState(l); if (state !== 'OK') return res.status(403).json({ error: state });
      if (d.sid !== sid) {
        const f = await readDev(st, l, true); // decide on fresh data (another server instance may hold an older copy)
        if (!f || f.id !== did) return res.status(409).json({ error: 'DEVICE_CHANGED' });
        if (f.sid !== sid) {
          if (!b.claim && f.sid) return res.status(409).json({ error: 'SUPERSEDED' }); // a newer launch (or a copy) is playing
          await writeDev(st, l, { ...f, sid, sidAt: Date.now(), last: Date.now(), switches: (f.switches || 0) + (f.sid ? 1 : 0) });
          return res.status(200).json({ config: licenceConfig(l, C) });
        }
        d = f;
      }
      if (Date.now() - (d.last || 0) > 30 * 60e3) { try { await writeDev(st, l, { ...d, last: Date.now() }); } catch { /* last-seen is best effort */ } }
      return res.status(200).json({ config: licenceConfig(l, C) });
      } catch (e) { if (e.code === 'STORAGE_DOWN') return res.status(503).json({ error: 'STORAGE_DOWN' }); throw e; }
    }

    if (!isStudio(req)) return res.status(401).json({ error: 'STUDIO_ONLY' });
    const store = storage();
    if (!store) return res.status(503).json({ error: 'STORAGE_NOT_READY' });
    let c;
    try { c = await readCatalog(store); } catch (e) {
      if (e.code === 'STORAGE_DOWN') return res.status(503).json({ error: 'STORAGE_DOWN' }); // never overwrite the library from a failed read
      throw e;
    }

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
        const rel = `media/${w.id}-thumb-${rid('v')}.${ext}`; // a new name per upload, so cached copies never go stale
        await store.put(`${ROOT}/${rel}`, buf, ctype);
        const old = relOf(w.thumb), oldP = old && old !== relOf(w.src) && mediaPath(old);
        w.thumb = mediaUrl(rel);
        if (oldP) await store.del(oldP);
        await writeCatalog(store, c);
        return res.status(200).json({ work: w });
      }
      if (kind === 'pack') {
        // God mode package (AE's own code, AE Studio only): one file per package id; a newer version replaces it
        if (!/^(text|application)\/javascript$/.test(ctype) || buf.length > 200 * 1024) return res.status(415).json({ error: 'UNSUPPORTED_TYPE' });
        const id = String(req.query.id || ''), type = String(req.query.ptype || ''), version = Math.max(1, Math.min(9999, Math.floor(Number(req.query.version) || 1)));
        if (!/^[a-z0-9-]{1,40}$/.test(id) || !['effect', 'transition', 'camera', 'burst'].includes(type)) return res.status(400).json({ error: 'BAD_PACKAGE' });
        const rel = `media/pack-${id}-v${version}-${rid('p')}.js`;
        await store.put(`${ROOT}/${rel}`, buf, 'text/javascript');
        c.packs = Array.isArray(c.packs) ? c.packs : [];
        const old = c.packs.find(x => x.id === id);
        const pk = { id, type, version, name: bi((() => { try { return JSON.parse(String(req.query.name || '{}')); } catch { return {}; } })(), 60), src: mediaUrl(rel), added: Date.now() };
        c.packs = c.packs.filter(x => x.id !== id).concat(pk);
        if (old) { const r = relOf(old.src); const p = r && mediaPath(r); if (p) await store.del(p); }
        await writeCatalog(store, c);
        return res.status(200).json({ pack: pk });
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
      if ('private' in p) w.private = !!p.private; // a client's own work: never public, only in their licence
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
    if (a === 'license-list') {
      const ls = (await Promise.all((await listLicIds(store)).map(async (id) => { const l = await readLic(store, id, true); if (!l) return null; const d = await readDev(store, l, true); return { ...l, device: d ? { id: d.id, at: d.at, last: d.last, ua: d.ua, switches: d.switches || 0 } : null }; }))).filter(Boolean);
      return res.status(200).json({ licenses: ls });
    }
    if (a === 'license-save') {
      const x = body.license || {};
      const old = x.id ? await readLic(store, x.id, true) : null;
      if (x.id && !old) return res.status(404).json({ error: 'NOT_FOUND' });
      const l = sanitizeLicense(x, old, c);
      if (!old) await store.put(codePath(normCode(l.code)), Buffer.from(JSON.stringify({ id: l.id })), 'application/json'); // the code first: a licence is never unreachable
      if (old && old.device && old.device.id && !(await readJson(store, devPath(old.id), null))) await writeDev(store, old, { ...old.device }); // move a screen stored the older way
      delete l.device; // the bound screen lives in its own file
      await writeLic(store, l);
      const d = await readDev(store, l, true);
      return res.status(200).json({ license: { ...l, device: d ? { id: d.id, at: d.at, last: d.last, ua: d.ua, switches: d.switches || 0 } : null } });
    }
    if (a === 'license-reset-device') { // the client moves to another screen: the old one stops at its next check
      const l = await readLic(store, body.id, true); if (!l) return res.status(404).json({ error: 'NOT_FOUND' });
      delete l.device; l.transfers = (l.transfers || 0) + 1; l.updated = Date.now(); // older device records no longer count
      await writeLic(store, l); await store.del(devPath(l.id)); devCache.delete(l.id);
      return res.status(200).json({ license: { ...l, device: null } });
    }
    if (a === 'pack-delete') {
      c.packs = Array.isArray(c.packs) ? c.packs : [];
      const pk = c.packs.find(x => x.id === body.id);
      if (!pk) return res.status(404).json({ error: 'NOT_FOUND' });
      const r = relOf(pk.src); const p = r && mediaPath(r); if (p) await store.del(p);
      c.packs = c.packs.filter(x => x.id !== pk.id);
      await writeCatalog(store, c);
      return res.status(200).json({ ok: true });
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
  let buf;
  try { buf = await store.get(p); } catch (e) { if (e.code === 'STORAGE_DOWN') { res.setHeader('Cache-Control', 'no-store'); return res.status(503).send('Storage unavailable'); } throw e; }
  if (!buf) { res.setHeader('Cache-Control', 'no-store'); return res.status(404).send('Not found'); }
  const ext = rel.split('.').pop();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  // R3: works are public art previews; R4 (membership) will gate this behind an entitlement check.
  // every media file has a unique, never-reused name: cache it for a year at the edge and in the browser (one cloud read per file)
  res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
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

