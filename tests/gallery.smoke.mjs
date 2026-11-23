// AE Shinity — acceptance test (Playwright). Self-contained: starts the local API server
// (tests/lumina-dev-server.mjs) with a fresh library and a throw-away studio password.
// Usage: node tests/gallery.smoke.mjs <desktop|phone|tv|all> <shotDir>
import { createRequire } from 'module';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const which = process.argv[2] || 'all';
const shots = process.argv[3] || '.';
const PASS = 'test-' + Math.random().toString(36).slice(2, 10);
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function startServer(port) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-'));
  const child = spawn(process.execPath, [path.join(here, 'lumina-dev-server.mjs'), String(port)], { env: { ...process.env, LUMINA_FS_DIR: dir, LUMINA_STUDIO_PASSWORD: PASS }, stdio: 'pipe' });
  return new Promise((resolve, reject) => {
    child.stdout.on('data', d => { if (String(d).includes('dev server')) resolve({ child, dir, base: `http://localhost:${port}` }); });
    child.on('exit', (code) => reject(new Error('dev server exited ' + code)));
  });
}

const servers = [];
process.on('exit', () => servers.forEach(c => { try { c.kill(); } catch { /* ignore */ } }));
async function scenario(label, ctxOpts, port) {
  const srv = await startServer(port);
  servers.push(srv.child);
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ ...ctxOpts, permissions: ['clipboard-read', 'clipboard-write'] });
  let page = await ctx.newPage();
  const errors = [];
  const watch = (p) => {
    p.on('pageerror', e => errors.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/status of 401/.test(m.text())) errors.push(m.text()); });
  };
  watch(page);
  const open = async (q = '') => { await page.goto(srv.base + '/gallery.html' + q, { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__lumina && document.querySelectorAll('.screen').length > 0); };
  const ui = async (sel) => { const v = page.viewportSize(); await page.mouse.move(v.width * 0.5 + Math.random() * 20, v.height * 0.2); await wait(150); await page.click(sel); };
  const st = () => page.evaluate(() => { const s = window.__lumina.state; return { ...s, settings: undefined, mode: s.settings.mode, interval: s.settings.interval }; });
  const tile = (n) => page.locator('.screen').nth(n);
  const act = async (n, a) => { await page.waitForSelector('#toast', { state: 'hidden', timeout: 8000 }).catch(() => {}); await tile(n).hover().catch(() => {}); await tile(n).locator(`[data-act=${a}]`).click(); };
  const longPress = async (pw) => {
    await page.evaluate(() => window.scrollTo(0, 0)); await wait(300);
    const box = await page.locator('.lw-wordmark').boundingBox();
    page.once('dialog', d => d.accept(pw));
    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.mouse.down(); await wait(3300); await page.mouse.up();
    await wait(1500);
  };

  await open();
  // ---------- customer ----------
  check(`[${label}] wall shows the 21 named works (6 unnamed stay hidden) from the cloud API`, (await page.locator('.screen').count()) === 21 && (await st()).cloud === 'fs');
  check(`[${label}] nothing selected → button says "play all"`, /全部|all/i.test(await page.textContent('#playBtn')));
  check(`[${label}] no horizontal scroll`, (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
  check(`[${label}] customers cannot add or edit (no upload, no studio actions)`,
    !(await page.locator('label.lw-upload').first().isVisible()) && (await page.locator('[data-act=edit]').count()) === 0);
  await page.screenshot({ path: `${shots}/${label}-wall.png` });
  for (const n of [2, 3, 10]) await tile(n - 1).locator('.screen-hit').click();
  check(`[${label}] with a selection the button says how many will play`, /3/.test(await page.textContent('#playBtn')));
  check(`[${label}] selection order badges`, (await page.$$eval('.screen.selected .screen-badge', els => els.map(e => e.textContent).join(','))) === '1,2,3');

  // settings: modes + frame interval + camera
  await page.click('#openSettings'); await page.waitForSelector('#settings:not([hidden])'); await wait(500);
  check(`[${label}] 9 scene modes grouped in 2 arenas (on-site / online)`, (await page.locator('#modeCards .lw-mode').count()) === 9 && (await page.locator('#modeCards .lw-arena').count()) === 2);
  const expect = { gallery: [20, 'hall'], healing: [16, 'nature'], hotel: [12, 'lounge'], residence: [18, 'hearth'], party: [6, 'eternal'], dream: [12, 'celestial'], kids: [8, 'dawn'], cinema: [12, 'celestial'], online: [10, 'celestial'] };
  let modesOk = true;
  for (const [id, [iv, mu]] of Object.entries(expect)) {
    await page.click(`.lw-mode[data-mode=${id}]`);
    const s = await page.evaluate(() => window.__lumina.state.settings);
    if (s.interval !== iv || s.music !== mu || s.mode !== id) modesOk = false;
  }
  check(`[${label}] every mode applies its preset`, modesOk);
  await page.locator('#interval').fill(String(24)); // last step = 1 hour (frame mode)
  check(`[${label}] interval reaches 1 hour (digital frame mode)`, (await page.textContent('#intervalOut')) === '1 h' && (await page.evaluate(() => window.__lumina.state.settings.interval)) === 3600);
  await page.click('#resetMode');
  check(`[${label}] reset restores mode timing`, (await page.evaluate(() => window.__lumina.state.settings.interval)) === 10);
  await page.screenshot({ path: `${shots}/${label}-settings.png` });
  await page.click('#closeSettings');

  // static viewing
  await act(0, 'view');
  await page.waitForSelector('#viewer:not([hidden])'); await wait(600);
  const vt = await page.textContent('#vwTitle');
  const box = await page.locator('#vwStage').boundingBox();
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2); await wait(300);
  const zoomed = await page.evaluate(() => document.getElementById('viewer').classList.contains('zoomed'));
  await page.screenshot({ path: `${shots}/${label}-viewer.png` });
  await page.keyboard.press('ArrowRight'); await wait(300);
  const vt2 = await page.textContent('#vwTitle');
  check(`[${label}] static viewing: label, double-tap zoom, next work`, !!vt && zoomed && vt2 !== vt, `${vt} → ${vt2}`);
  await page.keyboard.press('Escape');
  check(`[${label}] viewer closes with Esc`, await page.evaluate(() => document.getElementById('viewer').hidden));

  // player
  await page.click('#playBtn');
  await wait(1800);
  check(`[${label}] maison title card opens the show (motto shown)`, await page.isVisible('#plIntro') && (await page.textContent('#introMotto')).length > 0);
  await page.screenshot({ path: `${shots}/${label}-intro.png` });
  await page.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 15000 }); await wait(500);
  check(`[${label}] Inner Bloom finds light points in the work`, (await st()).blooms > 0);
  const fit = await page.evaluate(() => { const s = window.__lumina.state; const el = document.querySelectorAll('.pl-slide')[s.cur].querySelector('img'); const r = el.getBoundingClientRect(); return { ok: r.width <= innerWidth + 1 && r.height <= innerHeight + 1, fill: Math.max(r.width / innerWidth, r.height / innerHeight) }; });
  check(`[${label}] first work fully visible and well sized`, fit.ok && fit.fill > 0.84, JSON.stringify(fit));
  await page.mouse.click(page.viewportSize().width * 0.3, page.viewportSize().height * 0.4);
  await page.screenshot({ path: `${shots}/${label}-play.png` });
  // landscape work: its title must sit in the margin, not on the painting
  await page.evaluate(() => window.__lumina.jump(1));
  await page.waitForFunction(() => window.__lumina.state.idx === 1 && !window.__lumina.state.busy, null, { timeout: 12000 }).catch(() => {});
  await page.waitForFunction(() => !document.getElementById('caption').classList.contains('off'), null, { timeout: 5000 }).catch(() => {});
  const ov = await page.evaluate(() => {
    const cap = document.getElementById('caption'), s = window.__lumina.state;
    const art = document.querySelectorAll('.pl-slide')[s.cur].querySelector('img').getBoundingClientRect();
    const h2 = document.getElementById('capTitle').getBoundingClientRect();
    const ix = Math.max(0, Math.min(h2.right, art.right) - Math.max(h2.left, art.left)), iy = Math.max(0, Math.min(h2.bottom, art.bottom) - Math.max(h2.top, art.top));
    return { over: cap.classList.contains('over'), overlap: +(ix * iy / Math.max(1, h2.width * h2.height)).toFixed(2), id: s.curId };
  });
  check(`[${label}] title of a landscape work sits beside/below it, not on it`, ov.over || ov.overlap < 0.05, JSON.stringify(ov));
  await page.screenshot({ path: `${shots}/${label}-caption-landscape.png` });
  let trOk = true;
  for (const k of ['innerbloom', 'bloom', 'rings', 'ink', 'silk', 'stardust', 'bubbles', 'dissolve']) {
    await page.evaluate((k) => { window.__lumina.state.settings.transition = k; }, k);
    const before = (await st()).idx;
    await page.evaluate(() => window.__lumina.go(1));
    if (k === 'innerbloom' || k === 'bubbles') { await wait(1300); await page.screenshot({ path: `${shots}/${label}-tr-${k}.png` }); }
    await page.waitForFunction((b) => !window.__lumina.state.busy && window.__lumina.state.idx !== b, before, { timeout: 9000 }).catch(() => { trOk = false; });
    const g = await page.evaluate(() => { const s = window.__lumina.state; const sl = document.querySelectorAll('.pl-slide')[s.cur]; return getComputedStyle(sl).opacity === '1' && !(sl.style.maskImage || sl.style.webkitMaskImage); });
    if (!g) trOk = false;
  }
  check(`[${label}] all 8 transitions complete cleanly`, trOk);
  // film strip
  await ui('#stripBtn');
  await page.waitForSelector('#strip:not([hidden])');
  await page.locator('.pl-thumb').nth(1).click();
  await page.waitForFunction(() => window.__lumina.state.idx === 1 && !window.__lumina.state.busy, null, { timeout: 9000 }).catch(() => {});
  check(`[${label}] film strip jumps to a work`, (await st()).idx === 1);
  await page.screenshot({ path: `${shots}/${label}-strip.png` });
  await ui('#stripBtn');
  // camera drift + every mode in the player
  let modesPlay = true;
  for (const id of ['gallery', 'healing', 'hotel', 'residence', 'party', 'dream', 'kids', 'cinema', 'online']) {
    await ui('#fxBtn');
    await page.click(`.lw-mode[data-mode=${id}]`);
    await page.click('#closeSettings');
    await page.evaluate(() => window.__lumina.go(1));
    await wait(1500);
    if (id === 'kids') { const v = page.viewportSize(); for (const [fx, fy] of [[0.3, 0.4], [0.6, 0.55], [0.45, 0.3]]) await page.mouse.click(v.width * fx, v.height * fy); await wait(250); if ((await st()).cuties < 1) modesPlay = false; }
    if (['party', 'residence', 'gallery', 'kids', 'cinema', 'hotel'].includes(id)) await page.screenshot({ path: `${shots}/${label}-mode-${id}.png` });
    await page.waitForFunction(() => !window.__lumina.state.busy, null, { timeout: 9000 }).catch(() => { modesPlay = false; });
    if (id === 'residence' && !(await page.evaluate(() => document.getElementById('player').classList.contains('camera')))) modesPlay = false;
  }
  check(`[${label}] all 9 modes play (camera drift in Residence, cute pops in Little Ones)`, modesPlay);
  const shift = await page.evaluate(() => { const p = document.getElementById('player'), s = document.getElementById('stage'); return p.scrollTop + p.scrollLeft + s.scrollTop + s.scrollLeft + Math.abs(s.getBoundingClientRect().left) + Math.abs(s.getBoundingClientRect().top); });
  check(`[${label}] stage stays perfectly in place (no scroll drift)`, shift === 0, 'offset=' + shift);
  await page.keyboard.press(' ');
  check(`[${label}] space pauses`, !(await st()).playing);
  await page.keyboard.press(' ');
  const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else r(n / 1.5); }; requestAnimationFrame(f); }));
  check(`[${label}] animation runs`, fps > 20, `fps≈${Math.round(fps)}`);
  for (let k = 0; k < 4 && !(await page.evaluate(() => document.getElementById('player').hidden)); k++) { await page.keyboard.press('Escape'); await wait(500); }
  check(`[${label}] Esc closes the player`, await page.evaluate(() => document.getElementById('player').hidden));

  // ---------- AE Studio ----------
  await longPress('wrong-password');
  check(`[${label}] wrong studio password is rejected by the server`, !(await page.locator('label.lw-upload').first().isVisible()));
  await longPress(PASS);
  await page.waitForSelector('label.lw-upload:not([hidden])', { timeout: 8000 }).catch(() => {});
  check(`[${label}] long-press + password opens AE Studio (server-verified)`, (await st()).studio && (await page.locator('[data-act=edit]').count()) > 0);

  // upload an image and a short video
  const files = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 800;
    const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 1200, 800);
    g.addColorStop(0, '#ff7eb3'); g.addColorStop(1, '#4fc3f7'); x.fillStyle = g; x.fillRect(0, 0, 1200, 800);
    const png = c.toDataURL('image/png').split(',')[1];
    const v = document.createElement('canvas'); v.width = 640; v.height = 360; const vx = v.getContext('2d');
    const rec = new MediaRecorder(v.captureStream(24), { mimeType: 'video/webm' }); const parts = [];
    rec.ondataavailable = e => parts.push(e.data);
    const done = new Promise(r => { rec.onstop = r; });
    rec.start(); const t0 = performance.now();
    await new Promise(r => { const f = () => { const t = (performance.now() - t0) / 1000; vx.fillStyle = `hsl(${t * 120},70%,55%)`; vx.fillRect(0, 0, 640, 360); vx.fillStyle = '#fff'; vx.beginPath(); vx.arc(320 + Math.sin(t * 3) * 200, 180, 40, 0, 7); vx.fill(); if (t < 1.6) requestAnimationFrame(f); else r(); }; f(); });
    rec.stop(); await done;
    const blob = new Blob(parts, { type: 'video/webm' });
    const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (const b of buf) s += String.fromCharCode(b);
    return { png, webm: btoa(s) };
  });
  await page.setInputFiles('#fileInput', [
    { name: 'Morning Light.png', mimeType: 'image/png', buffer: Buffer.from(files.png, 'base64') },
    { name: 'Living Ink.webm', mimeType: 'video/webm', buffer: Buffer.from(files.webm, 'base64') },
  ]);
  await page.waitForFunction(() => window.__lumina.state.works === 29, null, { timeout: 20000 }).catch(() => {});
  check(`[${label}] image + video uploaded to the cloud library`, (await st()).works === 29);
  check(`[${label}] video work is tagged as motion art`, (await page.locator('.screen').last().locator('.screen-tag').textContent().catch(() => '')).length > 0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await wait(400);
  await page.screenshot({ path: `${shots}/${label}-studio-wall.png` });

  // edit the uploaded image: bilingual title, year, statement
  const n = await page.locator('.screen').count();
  await act(n - 2, 'edit');
  await page.waitForSelector('#editDialog[open]');
  await page.fill('#editForm [name=titleZh]', '晨光'); await page.fill('#editForm [name=titleEn]', 'Morning Light II'); await page.fill('#editForm [name=year]', '2026');
  await page.fill('#editForm [name=medium]', 'Digital'); await page.fill('#editForm [name=stZh]', '一束光，落在心上。');
  await page.screenshot({ path: `${shots}/${label}-edit.png` });
  await page.click('#editSave');
  await page.waitForFunction(() => !document.getElementById('editDialog').open);
  await wait(800);
  check(`[${label}] edited title shows on the wall (one consistent name)`, (await page.locator('.screen').nth(n - 2).locator('em').textContent()) === 'Morning Light II');
  await act(n - 2, 'view'); await page.waitForSelector('#viewer:not([hidden])');
  check(`[${label}] Chinese title appears as the subtitle`, (await page.textContent('#vwTitle')) === 'Morning Light II' && (await page.textContent('#vwSub')) === '晨光');
  await page.keyboard.press('Escape'); await wait(300);

  // reorder: move the first work later
  const firstId = await tile(0).getAttribute('data-id');
  await act(0, 'right'); await wait(800);
  check(`[${label}] reorder works and persists`, (await tile(1).getAttribute('data-id')) === firstId);

  // exhibition from selection: (current selection 3 house works) + the 2 uploads
  check(`[${label}] new uploads are auto-selected`, (await page.locator('.screen').nth(n - 1).getAttribute('class')).includes('selected'));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('[data-show-act=new]');
  await page.waitForSelector('#showDialog[open]');
  await page.fill('#showForm [name=titleZh]', '療癒之光'); await page.fill('#showForm [name=titleEn]', 'Healing Light');
  await page.selectOption('#showForm [name=mode]', 'healing');
  await page.fill('#showForm [name=noteZh]', '在流水與風鈴中，與畫作一起呼吸。');
  await page.click('#showForm button[type=submit]');
  await page.waitForFunction(() => window.__lumina.state.view !== 'all', null, { timeout: 8000 }).catch(() => {});
  const sv = await st();
  check(`[${label}] exhibition saved with 5 works and its scene mode`, sv.exhibitions === 1 && (await page.locator('.screen').count()) === 5 && sv.mode === 'healing');
  await page.screenshot({ path: `${shots}/${label}-exhibition.png` });
  // per-work override inside the exhibition: work #1 stays 7 s, Three Rings
  await act(0, 'edit'); await page.waitForSelector('#editDialog[open]');
  const inShow = await page.isVisible('#inShow');
  await page.fill('#editForm [name=duration]', '7'); await page.selectOption('#editForm [name=transition]', 'rings');
  await page.click('#editSave'); await page.waitForFunction(() => !document.getElementById('editDialog').open); await wait(800);
  check(`[${label}] per-work timing & transition inside an exhibition`, inShow);

  // hide the uploaded image from visitors, then log out
  const lastIdx = (await page.locator('.screen').count()) - 2;
  await act(lastIdx, 'edit'); await page.waitForSelector('#editDialog[open]');
  await page.check('#editForm [name=hidden]'); await page.click('#editSave');
  await page.waitForFunction(() => !document.getElementById('editDialog').open); await wait(800);
  const link = await page.evaluate(async () => { document.querySelector('[data-show-act=share]').click(); await new Promise(r => setTimeout(r, 400)); return navigator.clipboard.readText(); });
  check(`[${label}] share link carries exhibition + mode + autoplay`, /show=x[a-z0-9]+/.test(link) && /mode=healing/.test(link) && /autoplay=1/.test(link), link);
  await page.click('#studioLock'); await wait(800);
  check(`[${label}] locking the studio hides curator tools again`, !(await st()).studio && (await page.locator('[data-act=edit]').count()) === 0);
  check(`[${label}] hidden work is invisible to visitors`, (await st()).works === 22);

  // ---------- a visitor opens the shared link (fresh page, no studio) ----------
  await page.close();
  page = await ctx.newPage(); watch(page);
  await page.goto(link.replace(/^https?:\/\/[^/]+/, srv.base), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__lumina);
  check(`[${label}] shared link shows the start gate with the motto`, await page.isVisible('#startGate') && (await page.textContent('#gateMotto')).length > 0);
  await page.screenshot({ path: `${shots}/${label}-gate.png` });
  await page.click('#gateBtn');
  await page.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 15000 });
  const sp = await st();
  check(`[${label}] shared exhibition plays its own works (hidden one excluded) in its mode`, sp.list === 4 && sp.mode === 'healing' && sp.view !== 'all', JSON.stringify({ list: sp.list, mode: sp.mode }));
  check(`[${label}] per-work timing applied (work 1 = 7 s)`, sp.curDur === 7, 'curDur=' + sp.curDur);
  // jump to the video work and verify it plays
  await page.evaluate(() => window.__lumina.jump(3));
  await page.waitForFunction(() => window.__lumina.state.idx === 3 && !window.__lumina.state.busy, null, { timeout: 12000 }).catch(() => {});
  const vid = await page.evaluate(async () => { const s = window.__lumina.state; const sl = document.querySelectorAll('.pl-slide')[s.cur]; const v = sl.querySelector('video'); const t0 = v.currentTime; await new Promise(r => setTimeout(r, 700)); return { kind: sl.dataset.kind, adv: v.currentTime !== t0 || v.currentTime > 0, w: v.videoWidth }; });
  check(`[${label}] motion artwork (video) plays in the show`, vid.kind === 'video' && vid.w > 0 && vid.adv, JSON.stringify(vid));
  await page.screenshot({ path: `${shots}/${label}-video.png` });

  check(`[${label}] no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  srv.child.kill();
  fs.rmSync(srv.dir, { recursive: true, force: true });
}

const runs = { desktop: [{ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, 8771], phone: [{ ...devices['iPhone 13'] }, 8772], tv: [{ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }, 8773] };
for (const [name, [opts, port]] of Object.entries(runs)) if (which === 'all' || which === name) {
  try { await scenario(name, opts, port); } catch (e) { check(`[${name}] scenario crashed`, false, String(e).split('\n').slice(0, 12).join(' / ') + ' @ ' + (String(e.stack).match(/smoke.mjs:(\d+)/) || [])[1]); }
}
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
