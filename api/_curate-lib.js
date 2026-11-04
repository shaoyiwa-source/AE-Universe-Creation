// AE 策展平台 V1 — shared storage / auth helpers (not a route: files starting with _ are not functions).
// Storage adapter: Vercel Blob (private) under prefix curate/. Local dev only: in-memory when CURATE_DEV_MEMORY=1 and not on Vercel.
// Secrets: CURATE_SESSION_SECRET (cookie signing), CURATE_ADMIN_PASSWORD (Owner admin). Never logged, never returned.
'use strict';
const crypto = require('node:crypto');

const P = 'curate/';
const mem = new Map();
const LIMITS = { name: 60, email: 120, intro: 800, username: 24, title: 80, curatorIntro: 800, description: 3000, workTitle: 80, story: 1500, url: 600 };
const MAX_IMG = 3 * 1024 * 1024;
const MAX_WORKS = 40;

function blobReady() { return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID)); }
function devMemory() { return !process.env.VERCEL && process.env.CURATE_DEV_MEMORY === '1'; }
function storageName() { return blobReady() ? 'vercel-blob' : (devMemory() ? 'dev-memory' : 'none'); }

async function getJSON(key) {
  key = P + key;
  if (blobReady()) {
    const { get } = await import('@vercel/blob');
    try {
      const r = await get(key, { access: 'private', useCache: false });
      if (!r || r.statusCode !== 200 || !r.stream) return null;
      return JSON.parse(await new Response(r.stream).text());
    } catch (e) { if (/not.?found|404/i.test(String(e && (e.name + e.message)))) return null; throw e; }
  }
  if (devMemory()) { const v = mem.get(key); return v ? JSON.parse(v) : null; }
  throw Object.assign(new Error('storage not configured'), { status: 503 });
}
async function putJSON(key, obj) {
  key = P + key;
  const body = JSON.stringify(obj);
  if (blobReady()) {
    const { put } = await import('@vercel/blob');
    await put(key, body, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 60 });
    return;
  }
  if (devMemory()) { mem.set(key, body); return; }
  throw Object.assign(new Error('storage not configured'), { status: 503 });
}
async function listKeys(prefix) {
  prefix = P + prefix;
  if (blobReady()) {
    const { list } = await import('@vercel/blob');
    const out = []; let cursor;
    do { const r = await list({ prefix, cursor, limit: 1000 }); for (const b of r.blobs) out.push(b.pathname.slice(P.length)); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
    return out;
  }
  if (devMemory()) return [...mem.keys()].filter(k => k.startsWith(prefix)).map(k => k.slice(P.length));
  throw Object.assign(new Error('storage not configured'), { status: 503 });
}
async function listJSON(prefix) {
  const keys = (await listKeys(prefix)).filter(k => k.endsWith('.json'));
  const vals = await Promise.all(keys.map(k => getJSON(k).catch(() => null)));
  return vals.filter(Boolean);
}
async function putImage(id, buf, type) {
  const key = P + 'img/' + id;
  if (blobReady()) { const { put } = await import('@vercel/blob'); await put(key, buf, { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: type }); return; }
  if (devMemory()) { mem.set(key, { buf, type }); return; }
  throw Object.assign(new Error('storage not configured'), { status: 503 });
}
async function getImage(id) {
  const key = P + 'img/' + id;
  if (blobReady()) {
    const { get } = await import('@vercel/blob');
    try { const r = await get(key, { access: 'private' }); if (!r || r.statusCode !== 200 || !r.stream) return null; return { stream: r.stream, type: (r.blob && r.blob.contentType) || 'image/jpeg' }; }
    catch (e) { return null; }
  }
  if (devMemory()) { const v = mem.get(key); return v ? { buf: v.buf, type: v.type } : null; }
  return null;
}

// ---- crypto helpers ----
function token(bytes) { return crypto.randomBytes(bytes || 16).toString('base64url'); }
function safeEq(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 });
  return 'scrypt$16384$' + salt.toString('base64') + '$' + h.toString('base64');
}
function verifyPassword(pw, stored) {
  try {
    const [alg, n, s, h] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const want = Buffer.from(h, 'base64');
    const got = crypto.scryptSync(String(pw), Buffer.from(s, 'base64'), want.length, { N: Number(n), r: 8, p: 1 });
    return crypto.timingSafeEqual(want, got);
  } catch (e) { return false; }
}
function tempPassword() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const b = crypto.randomBytes(14); let s = '';
  for (const x of b) s += A[x % A.length];
  return s.slice(0, 4) + '-' + s.slice(4, 9) + '-' + s.slice(9);
}
function secret() { const s = process.env.CURATE_SESSION_SECRET || ''; return s.length >= 32 ? s : ''; }
function sign(payload) {
  const s = secret(); if (!s) return '';
  const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return b + '.' + crypto.createHmac('sha256', s).update(b).digest('base64url');
}
function unsign(v) {
  const s = secret(); if (!s || !v) return null;
  const [b, mac] = String(v).split('.');
  if (!b || !mac) return null;
  const want = crypto.createHmac('sha256', s).update(b).digest('base64url');
  if (!safeEq(want, mac)) return null;
  try { const p = JSON.parse(Buffer.from(b, 'base64url').toString('utf8')); return p.exp > Date.now() ? p : null; } catch (e) { return null; }
}
function cookies(req) {
  const out = {}; const h = req.headers.cookie || '';
  for (const part of h.split(';')) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  return out;
}
function secureFlag(req) { return (process.env.VERCEL || String(req.headers['x-forwarded-proto'] || '').includes('https')) ? '; Secure' : ''; }
function setCookie(res, req, name, val, maxAgeSec) {
  const c = `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secureFlag(req)}`;
  const prev = res.getHeader('Set-Cookie'); res.setHeader('Set-Cookie', prev ? [].concat(prev, c) : c);
}
const SESSION = 'ae_curate', ADMIN = 'ae_curate_admin';

async function currentUser(req) {
  const p = unsign(cookies(req)[SESSION]);
  if (!p || p.t !== 'u') return null;
  const u = await getJSON('users/' + p.u + '.json');
  if (!u || u.disabled || u.pwv !== p.v) return null;
  return u;
}
function isAdmin(req) {
  if (!adminConfigured()) return false;
  const p = unsign(cookies(req)[ADMIN]);
  return Boolean(p && p.t === 'a');
}
function adminConfigured() { return Boolean((process.env.CURATE_ADMIN_PASSWORD || '').length >= 8 && secret()); }

function clean(s, max) {
  return String(s == null ? '' : s).replace(/[<>]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status; res.end(JSON.stringify(body));
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > 4.4 * 1024 * 1024) throw Object.assign(new Error('too large'), { status: 413 }); chunks.push(c); }
  const t = Buffer.concat(chunks).toString('utf8');
  return t ? JSON.parse(t) : {};
}
const TEMPLATES = [
  { id: 'ae-light', name: 'AE 光影首頁', ready: true, note: '以 AE 首頁的聲光風格呈現：深色光影主視覺、金色細線、作品故事。' },
  { id: 'immersive', name: '沉浸展廳', ready: false, note: '即將推出' },
  { id: 'gallery-wall', name: '藝廊牆', ready: false, note: '即將推出' },
  { id: 'story-scroll', name: '故事長卷', ready: false, note: '即將推出' }
];

module.exports = { LIMITS, MAX_IMG, MAX_WORKS, TEMPLATES, storageName, getJSON, putJSON, listJSON, putImage, getImage, token, safeEq, hashPassword, verifyPassword, tempPassword, secret, sign, unsign, cookies, setCookie, SESSION, ADMIN, currentUser, isAdmin, adminConfigured, clean, esc, send, readBody };
