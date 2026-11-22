// Local dev/test server for AE Lumina Wall: serves ./public and runs api/lumina.js with a
// Vercel-like req/res, storing data in LUMINA_FS_DIR instead of Vercel Blob.
// Usage: LUMINA_FS_DIR=/tmp/lumina LUMINA_STUDIO_PASSWORD=... node tests/lumina-dev-server.mjs [port]
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const handler = require(path.join(root, 'api', 'lumina.js'));
const port = Number(process.argv[2] || 8766);
if (!process.env.LUMINA_FS_DIR) { console.error('Set LUMINA_FS_DIR'); process.exit(1); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.m4a': 'audio/mp4' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/lumina') {
    req.query = Object.fromEntries(url.searchParams);
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const buf = Buffer.concat(chunks);
    const ct = String(req.headers['content-type'] || '');
    if (buf.length) req.body = ct.includes('application/json') ? JSON.parse(buf.toString() || '{}') : buf;
    res.status = (n) => { res.statusCode = n; return res; };
    res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
    res.send = (s) => { res.end(s); return res; };
    try { await handler(req, res); } catch (e) { console.error(e); res.statusCode = 500; res.end('error'); }
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p === '/' ) p = '/index.html';
  if (p === '/gallery') p = '/gallery.html';
  const file = path.join(pub, p);
  if (!file.startsWith(pub) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  const size = fs.statSync(file).size, m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  if (m) { // media seeking (like the real host)
    const start = m[1] === '' ? size - Number(m[2]) : Number(m[1]), end = m[1] !== '' && m[2] !== '' ? Math.min(size - 1, Number(m[2])) : size - 1;
    res.statusCode = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`); res.setHeader('Content-Length', String(end - start + 1));
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.setHeader('Content-Length', String(size));
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`lumina dev server on http://localhost:${port}`));
