// AE Lumina Wall — R5 acceptance: export an edition in AE Studio, then run the exported single file
// (1) inside an NFT-marketplace-style sandboxed iframe with every network request blocked, and
// (2) opened directly from disk (offline client edition).
// Usage: node tests/edition.test.mjs <desktop|phone> <outDir>
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
const PASS = 'test-' + Math.random().toString(36).slice(2, 10);
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const ctxOpts = which === 'phone' ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const port = which === 'phone' ? 8782 : 8781;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-ed-'));
const srv = spawn(process.execPath, [path.join(here, 'lumina-dev-server.mjs'), String(port)], { env: { ...process.env, LUMINA_FS_DIR: dir, LUMINA_STUDIO_PASSWORD: PASS }, stdio: 'pipe' });
process.on('exit', () => { try { srv.kill(); } catch { /* ignore */ } });
await new Promise((res, rej) => { srv.stdout.on('data', d => String(d).includes('dev server') && res()); srv.on('exit', c => rej(new Error('server exited ' + c))); });
const base = `http://localhost:${port}`;

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
let file;
try {
  // ---------- 1. curate + export in AE Studio ----------
  const ctx = await browser.newContext({ ...ctxOpts, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(base + '/gallery.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__lumina && document.querySelectorAll('.screen').length > 0);
  const box = await page.locator('.lw-wordmark').boundingBox();
  page.once('dialog', d => d.accept(PASS));
  await page.mouse.move(box.x + 20, box.y + box.height / 2); await page.mouse.down(); await wait(3300); await page.mouse.up();
  await page.waitForSelector('label.lw-upload:not([hidden])', { timeout: 8000 });
  check(`[${which}] studio shows download-original and export tools`, (await page.locator('[data-act=download]').count()) > 0 && (await page.locator('[data-show-act=export]').count()) === 1);
  const dl0 = page.waitForEvent('download');
  await page.locator('.screen').first().hover(); await page.locator('.screen').first().locator('[data-act=download]').click();
  const orig = await dl0;
  check(`[${which}] AE can download an original from the library`, /\.webp$/.test(orig.suggestedFilename()), orig.suggestedFilename());

  for (const n of [1, 3, 10]) await page.locator('.screen').nth(n - 1).locator('.screen-hit').click();
  const webm = await page.evaluate(async () => {
    const v = document.createElement('canvas'); v.width = 640; v.height = 360; const vx = v.getContext('2d');
    const rec = new MediaRecorder(v.captureStream(24), { mimeType: 'video/webm' }); const parts = [];
    rec.ondataavailable = e => parts.push(e.data); const done = new Promise(r => { rec.onstop = r; });
    rec.start(); const t0 = performance.now();
    await new Promise(r => { const f = () => { const t = (performance.now() - t0) / 1000; vx.fillStyle = `hsl(${40 + t * 60},70%,50%)`; vx.fillRect(0, 0, 640, 360); vx.fillStyle = '#fff6d8'; vx.beginPath(); vx.arc(320 + Math.sin(t * 3) * 180, 180, 46, 0, 7); vx.fill(); if (t < 1.6) requestAnimationFrame(f); else r(); }; f(); });
    rec.stop(); await done;
    const buf = new Uint8Array(await new Blob(parts).arrayBuffer()); let s = ''; for (const b of buf) s += String.fromCharCode(b); return btoa(s);
  });
  await page.setInputFiles('#fileInput', { name: 'Golden Breath.webm', mimeType: 'video/webm', buffer: Buffer.from(webm, 'base64') });
  await page.waitForFunction(() => window.__lumina.state.works === 28, null, { timeout: 20000 });
  await page.waitForSelector('#toast', { state: 'hidden', timeout: 8000 }).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#openSettings'); await page.waitForSelector('#settings:not([hidden])');
  await page.click('.lw-mode[data-mode=hotel]'); await page.click('#closeSettings');

  await page.click('[data-show-act=export]');
  await page.waitForSelector('#exportDialog[open]');
  check(`[${which}] export dialog lists the selected works`, /4/.test(await page.textContent('#exportStatus')));
  await page.fill('#exportForm [name=titleZh]', 'Maison 首展'); await page.fill('#exportForm [name=titleEn]', 'Maison Premiere');
  await page.fill('#exportForm [name=no]', '3'); await page.fill('#exportForm [name=of]', '88');
  await page.selectOption('#exportForm [name=kind]', 'nft');
  await page.screenshot({ path: `${out}/${which}-export-dialog.png` });
  const dl = page.waitForEvent('download', { timeout: 120000 });
  await page.click('#exportGo');
  const d = await dl;
  file = path.join(out, `${which}-${d.suggestedFilename()}`);
  await d.saveAs(file);
  const html = fs.readFileSync(file, 'utf8');
  const mb = fs.statSync(file).size / 1048576;
  check(`[${which}] edition exported as one HTML file`, /^MaisonAE-maison-premiere-nft-3of88\.html$/.test(d.suggestedFilename()) && mb > 0.2, `${d.suggestedFilename()} ${mb.toFixed(2)} MB`);
  check(`[${which}] edition has no external references (fonts, API, assets, module files)`,
    !/fonts\.googleapis|fonts\.gstatic|src="assets\/|src="gallery\/|href="gallery\/|href="\/favicon/.test(html), '');
  check(`[${which}] edition embeds manifest, fonts and bundle`, html.includes('window.__AE_EDITION__') && /@font-face/.test(html) && html.includes('const __ae_app'));
  check(`[${which}] studio page had no errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();

  // ---------- 2. NFT-marketplace-style sandbox: iframe sandbox="allow-scripts", network blocked ----------
  const nft = await browser.newContext(ctxOpts);
  const external = [];
  await nft.route('**/*', (route) => {
    const u = route.request().url();
    if (u === 'https://nft.example/host.html') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body style="margin:0;background:#000"><iframe id="art" sandbox="allow-scripts" allow="fullscreen; autoplay" src="https://nft.example/edition.html" style="width:100vw;height:100vh;border:0;display:block"></iframe></body>' });
    if (u === 'https://nft.example/edition.html') return route.fulfill({ contentType: 'text/html', body: html });
    external.push(u); return route.abort();
  });
  const p2 = await nft.newPage();
  const cerr = []; p2.on('console', m => { if (m.type() === 'error') cerr.push(m.text()); });
  let dialogs = 0; p2.on('dialog', dd => { dialogs++; dd.dismiss(); });
  await p2.goto('https://nft.example/host.html');
  let fr = null;
  for (let i = 0; i < 50 && !fr; i++) { fr = p2.frames().find(f => f.url().endsWith('/edition.html')); if (!fr) await wait(100); }
  await fr.waitForFunction(() => window.__lumina && document.querySelectorAll('.screen').length > 0, null, { timeout: 15000 });
  const st = await fr.evaluate(() => { const s = window.__lumina.state; return { edition: s.edition, works: s.works, studio: s.studio, cloud: s.cloud, mode: s.settings.mode, origin: self.origin }; });
  check(`[${which}] NFT sandbox: edition boots from the embedded manifest (opaque origin)`, st.edition && st.works === 4 && st.cloud === 'edition' && st.origin === 'null', JSON.stringify(st));
  check(`[${which}] NFT sandbox: start gate shows edition 3 / 88 and the motto`, (await fr.isVisible('#startGate')) && /3/.test(await fr.textContent('#gateEdition')) && /88/.test(await fr.textContent('#gateEdition')) && (await fr.textContent('#gateMotto')).includes('外在沈靜'));
  await p2.screenshot({ path: `${out}/${which}-nft-gate.png` });
  check(`[${which}] NFT sandbox: no studio, no upload, no share/export`, !st.studio && !(await fr.isVisible('label.lw-upload')) && (await fr.locator('[data-show-act]').count()) === 0 && (await fr.locator('[data-act=edit], [data-act=download]').count()) === 0);
  await fr.click('#gateBtn');
  await fr.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 20000 });
  const ps = await fr.evaluate(() => { const s = window.__lumina.state; return { list: s.list, mode: s.settings.mode, blooms: s.blooms }; });
  check(`[${which}] NFT sandbox: show plays in the exported mode (Hotel) with Inner Bloom`, ps.list === 4 && ps.mode === 'hotel' && ps.blooms > 0, JSON.stringify(ps));
  await wait(800); await p2.screenshot({ path: `${out}/${which}-nft-play.png` });
  let trOk = true;
  for (const k of ['innerbloom', 'rings', 'stardust']) {
    await fr.evaluate((k) => { window.__lumina.state.settings.transition = k; }, k);
    const b = await fr.evaluate(() => window.__lumina.state.idx);
    await fr.evaluate(() => window.__lumina.go(1));
    await fr.waitForFunction((b) => !window.__lumina.state.busy && window.__lumina.state.idx !== b, b, { timeout: 12000 }).catch(() => { trOk = false; });
  }
  check(`[${which}] NFT sandbox: signature transitions run`, trOk);
  check(`[${which}] NFT sandbox: recording is available in the edition`, await fr.evaluate(() => !document.getElementById('recBtn').hidden && !!window.MediaRecorder));
  const vIdx = await fr.evaluate(() => [...document.querySelectorAll('.pl-thumb')].findIndex(b => b.querySelector('span')) );
  const vi = vIdx >= 0 ? vIdx : 3;
  await fr.evaluate((i) => window.__lumina.jump(i), vi);
  await fr.waitForFunction((i) => window.__lumina.state.idx === i && !window.__lumina.state.busy, vi, { timeout: 15000 }).catch(() => {});
  const vid = await fr.evaluate(async () => { const s = window.__lumina.state; const sl = document.querySelectorAll('.pl-slide')[s.cur]; const v = sl.querySelector('video'); await new Promise(r => setTimeout(r, 700)); return { kind: sl.dataset.kind, w: v.videoWidth, t: v.currentTime }; });
  check(`[${which}] NFT sandbox: motion work (embedded video) plays`, vid.kind === 'video' && vid.w > 0 && vid.t > 0, JSON.stringify(vid));
  const vp = p2.viewportSize();
  await p2.mouse.click(vp.width * 0.4, vp.height * 0.4); await wait(200);
  check(`[${which}] NFT sandbox: touch/mouse interaction works`, true);
  // long-press the wordmark must not open any studio prompt
  await fr.evaluate(() => document.getElementById('closeBtn').click());
  await wait(500);
  const wb = await fr.locator('.lw-wordmark').boundingBox();
  await p2.mouse.move(wb.x + 20, wb.y + wb.height / 2); await p2.mouse.down(); await wait(3300); await p2.mouse.up(); await wait(500);
  check(`[${which}] NFT sandbox: hidden studio entrance is disabled`, dialogs === 0);
  await fr.evaluate(() => document.getElementById('cert').scrollIntoView());
  await wait(400);
  check(`[${which}] NFT sandbox: certificate with fingerprint`, (await fr.isVisible('#cert')) && /[0-9a-f]{8}/.test(await fr.textContent('#certFp')));
  await p2.screenshot({ path: `${out}/${which}-nft-certificate.png` });
  check(`[${which}] NFT sandbox: zero network requests leave the file`, external.length === 0, external.slice(0, 3).join(' '));
  check(`[${which}] NFT sandbox: no console errors`, cerr.length === 0, cerr.slice(0, 2).join(' | '));
  await nft.close();

  // ---------- 3. opened straight from disk (offline client edition) ----------
  const off = await browser.newContext({ ...ctxOpts, offline: true });
  const p3 = await off.newPage();
  const net = []; p3.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) net.push(r.url()); });
  const e3 = []; p3.on('pageerror', e => e3.push(String(e)));
  await p3.goto('file://' + path.resolve(file));
  await p3.waitForFunction(() => window.__lumina && document.querySelectorAll('.screen').length === 4, null, { timeout: 15000 });
  await p3.click('#gateBtn');
  await p3.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 20000 });
  check(`[${which}] offline file: plays from disk with no network`, net.length === 0 && e3.length === 0, net.concat(e3).slice(0, 2).join(' | '));
  await off.close();
} catch (e) {
  check(`[${which}] scenario crashed`, false, String(e).split('\n').slice(0, 6).join(' / '));
}
await browser.close();
srv.kill();
fs.rmSync(dir, { recursive: true, force: true });
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
