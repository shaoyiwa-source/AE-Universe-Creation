// AE Shinity — R9 acceptance: launch readiness.
//  1. titles never sit on a painting (every work, wide and tall screens)
//  2. a cloud outage never wipes the library and never stops the wall
//  3. caching: visitors share an edge copy; studio reads fresh; media cached for a year
// Usage: node tests/r9.test.mjs <desktop|phone|tv> <outDir>
import { createRequire } from 'module';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const which = process.argv[2] || 'desktop';
const out = process.argv[3] || '.';
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const ctxOpts = which === 'phone' ? { ...devices['iPhone 13'] } : which === 'tv' ? { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const port = { desktop: 8796, phone: 8797, tv: 8798 }[which];
const PASS = 'r9-' + Date.now();

const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'shinity-r9-'));
const srv = spawn(process.execPath, [path.join(here, 'shinity-dev-server.mjs'), String(port)], { env: { ...process.env, SHINITY_FS_DIR: lib, SHINITY_STUDIO_PASSWORD: PASS }, stdio: 'pipe' });
process.on('exit', () => { try { srv.kill(); } catch { /* ignore */ } });
await new Promise((res, rej) => { srv.stdout.on('data', d => String(d).includes('dev server') && res()); srv.on('exit', c => rej(new Error('server exited ' + c))); });
const base = `http://localhost:${port}`;
const api = (q, opt = {}) => fetch(`${base}/api/shinity?${q}`, opt);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(base + '/gallery.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__shinity && document.querySelectorAll('.screen').length > 0);

  // ---- 1. titles vs paintings, every work, captions on (Online Exhibition) ----
  await page.click('#openSettings'); await page.waitForSelector('#settings:not([hidden])');
  await page.click('.lw-mode[data-mode=online]'); await page.click('#closeSettings');
  await page.click('#playBtn');
  await page.waitForFunction(() => window.__shinity.state.shown, null, { timeout: 30000 });
  const n = await page.evaluate(() => window.__shinity.state.list);
  const bad = [], shrunk = [];
  for (let i = 0; i < n; i++) {
    await page.evaluate((k) => window.__shinity.jump(k), i);
    await page.waitForFunction((k) => window.__shinity.state.idx === k && !window.__shinity.state.busy, i, { timeout: 15000 });
    await page.waitForFunction(() => !document.getElementById('caption').classList.contains('off'), null, { timeout: 8000 }).catch(() => {});
    await wait(250);
    const g = await page.evaluate(() => {
      const s = window.__shinity.state, el = document.querySelectorAll('.pl-slide')[s.cur].querySelector('img, video');
      const a = { x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: parseFloat(el.style.width), h: parseFloat(el.style.height) };
      const cap = document.getElementById('caption'), t = document.getElementById('capTitle').getBoundingClientRect();
      const ix = Math.max(0, Math.min(a.x + a.w, t.right) - Math.max(a.x, t.left)), iy = Math.max(0, Math.min(a.y + a.h, t.bottom) - Math.max(a.y, t.top));
      const W = innerWidth, H = innerHeight;
      return { id: s.curId, over: cap.classList.contains('over'), overlap: Math.round(ix * iy), inView: t.bottom <= H + 1 && t.top >= -1, fill: Math.max(a.w / W, a.h / H) };
    });
    if (g.overlap > 0 || !g.inView) bad.push(`${g.id}:${g.overlap}px²${g.over ? '(over)' : ''}`);
    if (g.fill < 0.6) shrunk.push(`${g.id}:${g.fill.toFixed(2)}`);
  }
  await page.screenshot({ path: `${out}/${which}-r9-wide-title.png` });
  check(`[${which}] titles never sit on a painting (${n} works)`, bad.length === 0, bad.slice(0, 6).join(' '));
  check(`[${which}] paintings stay large (≥ 60% of the screen's long side)`, shrunk.length === 0, shrunk.join(' '));
  // captions off → paintings take the full frame again
  const fullBefore = await page.evaluate(() => { const s = window.__shinity.state; return parseFloat(document.querySelectorAll('.pl-slide')[s.cur].querySelector('img, video').style.width); });
  await page.evaluate(() => { const s = window.__shinity.state.settings; s.display.captions = false; });
  await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await wait(300);
  const fullAfter = await page.evaluate(() => { const s = window.__shinity.state; return parseFloat(document.querySelectorAll('.pl-slide')[s.cur].querySelector('img, video').style.width); });
  check(`[${which}] without titles the painting uses the whole frame`, fullAfter >= fullBefore - 0.5, `${fullBefore.toFixed(0)} → ${fullAfter.toFixed(0)} px`);
  await page.keyboard.press('Escape'); await wait(300); await page.keyboard.press('Escape'); await wait(300);
  check(`[${which}] no page errors while playing`, errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();

  if (which === 'desktop') {
    // ---- 2. cloud outage ----
    const tok = (await (await api('a=login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: PASS }) })).json()).token;
    check('[api] studio login works', !!tok);
    const auth = { authorization: 'Bearer ' + tok };
    const img = fs.readFileSync(path.join(here, '..', 'public', 'assets', 'selected-works-v2', 'heart-energy.webp'));
    const up = await (await api('a=upload&kind=work&name=R9%20Test&type=image%2Fwebp', { method: 'POST', headers: { ...auth, 'content-type': 'application/octet-stream' }, body: img })).json();
    check('[api] AE can add a work', !!(up.work && up.work.id));
    const before = (await (await api('a=catalog&studio=1', { headers: auth })).json()).works.length;
    fs.writeFileSync(path.join(lib, '.down'), '1'); // the cloud store becomes unreachable (e.g. suspended)
    const pub = await api('a=catalog'); const pj = await pub.json();
    check('[api] outage: visitors still get a playable wall (built-in works)', pub.status === 200 && pj.storage === 'degraded' && pj.works.length >= 10, `${pub.status} ${pj.storage} ${pj.works && pj.works.length}`);
    const ed = await api('a=update', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ id: up.work.id, patch: { title: { en: 'X', zh: '' } } }) });
    check('[api] outage: editing is refused instead of overwriting the library', ed.status === 503 && (await ed.json()).error === 'STORAGE_DOWN', String(ed.status));
    const up2 = await api('a=upload&kind=work&name=Y&type=image%2Fwebp', { method: 'POST', headers: { ...auth, 'content-type': 'application/octet-stream' }, body: img });
    check('[api] outage: adding is refused too', up2.status === 503);
    const med = await api('a=media&p=' + encodeURIComponent(new URL(up.work.src, base).searchParams.get('p')));
    check('[api] outage: media answers 503 and is not cached', med.status === 503 && /no-store/.test(med.headers.get('cache-control') || ''));
    fs.unlinkSync(path.join(lib, '.down'));
    const after = await (await api('a=catalog&studio=1', { headers: auth })).json();
    check('[api] after the outage the library is intact (nothing lost)', after.works.length === before && after.works.some(w => w.id === up.work.id && w.title.en === 'R9 Test'), `${before} → ${after.works.length}`);

    // the page during an outage: wall plays, studio is told why
    fs.writeFileSync(path.join(lib, '.down'), '1');
    const c2 = await browser.newContext(ctxOpts); const p2 = await c2.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(String(e)));
    await p2.goto(base + '/gallery.html', { waitUntil: 'networkidle' }); await p2.waitForFunction(() => window.__shinity && document.querySelectorAll('.screen').length > 0);
    const st = await p2.evaluate(() => ({ cloud: window.__shinity.state.cloud, works: window.__shinity.state.works }));
    await p2.click('#playBtn'); await p2.waitForFunction(() => window.__shinity.state.shown, null, { timeout: 30000 });
    check('[page] outage: the wall still loads and plays', st.cloud === 'degraded' && st.works >= 10 && e2.length === 0, JSON.stringify(st));
    await p2.keyboard.press('Escape'); await wait(300); await p2.keyboard.press('Escape'); await wait(300);
    const box = await p2.locator('.lw-wordmark').boundingBox();
    p2.once('dialog', d => d.accept(PASS));
    await p2.mouse.move(box.x + 20, box.y + box.height / 2); await p2.mouse.down(); await wait(3300); await p2.mouse.up();
    await p2.waitForSelector('#toast:not([hidden])', { timeout: 8000 });
    const msg = await p2.textContent('#toast');
    check('[page] outage: AE Studio explains that editing is paused', /暫停新增與編輯|paused/.test(msg), msg);
    await p2.screenshot({ path: `${out}/r9-outage-studio.png` });
    await c2.close();
    fs.unlinkSync(path.join(lib, '.down'));

    // ---- 3. caching ----
    const pr = await api('a=catalog'), pc = pr.headers.get('cache-control') || '', ec = pr.headers.get('vercel-cdn-cache-control') || '';
    check('[cache] visitors share an edge copy of the catalog (≤ 60 s old)', /max-age=60/.test(ec), ec);
    check('[cache] browsers never show a stale catalog', /max-age=0/.test(pc) && /must-revalidate/.test(pc) && !/stale/.test(pc), pc);
    const sc = (await api('a=catalog&studio=1', { headers: auth })).headers.get('cache-control') || '';
    check('[cache] AE Studio always reads fresh', /no-store/.test(sc) && /private/.test(sc), sc);
    const mc = (await api('a=media&p=' + encodeURIComponent(new URL(up.work.src, base).searchParams.get('p')))).headers.get('cache-control') || '';
    check('[cache] media cached for a year (immutable)', /immutable/.test(mc) && /max-age=31536000/.test(mc), mc);
    const t1 = await (await api(`a=upload&kind=thumb&id=${up.work.id}&type=image%2Fwebp`, { method: 'POST', headers: { ...auth, 'content-type': 'application/octet-stream' }, body: img })).json();
    const t2 = await (await api(`a=upload&kind=thumb&id=${up.work.id}&type=image%2Fwebp`, { method: 'POST', headers: { ...auth, 'content-type': 'application/octet-stream' }, body: img })).json();
    const oldThumb = await api('a=media&p=' + encodeURIComponent(new URL(t1.work.thumb, base).searchParams.get('p')));
    check('[cache] a replaced poster gets a new address (no stale cache) and the old file is removed', t1.work.thumb !== t2.work.thumb && oldThumb.status === 404);
  }
} catch (e) {
  check(`[${which}] scenario crashed`, false, String(e).split('\n').slice(0, 5).join(' / '));
}
await browser.close();
srv.kill();
fs.rmSync(lib, { recursive: true, force: true });
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
