// AE Shinity — R10-1 God mode: summon effect packages, tune them, choose a transition package,
// save the choreography for a run of works; visitors (and client players) see exactly what was arranged.
// Usage: node tests/god.test.mjs <desktop|phone> <outDir>
import { createRequire } from 'module';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const which = process.argv[2] || 'desktop', out = process.argv[3] || '.';
const results = []; const check = (n, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${info ? '  — ' + info : ''}`); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const phone = which === 'phone';
const ctxOpts = phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const port = phone ? 8842 : 8841;
const PASS = 'god-' + Date.now();
const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'shinity-god-'));
const srv = spawn(process.execPath, [path.join(here, 'shinity-dev-server.mjs'), String(port)], { env: { ...process.env, SHINITY_FS_DIR: lib, SHINITY_STUDIO_PASSWORD: PASS }, stdio: 'pipe' });
process.on('exit', () => { try { srv.kill(); } catch { /* ignore */ } });
await new Promise(r => srv.stdout.on('data', d => String(d).includes('dev server') && r()));
const base = `http://localhost:${port}`;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(base + '/gallery.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__shinity && document.querySelectorAll('.screen').length > 0);
  const st = () => page.evaluate(() => window.__shinity.state);
  check(`[${which}] packages are registered (7 effects, 4 transitions, 5 camera moves)`, await page.evaluate(() => { const l = window.__shinity.packsList(); return l.filter(p => p.type === 'effect').length === 7 && l.filter(p => p.type === 'transition').length === 4 && l.filter(p => p.type === 'camera').length === 5; }));
  check(`[${which}] visitors never see God mode`, (await page.evaluate(() => document.getElementById('godBtn').hidden)));
  // AE Studio + an exhibition of six works
  const box = await page.locator('.lw-wordmark').boundingBox();
  page.once('dialog', d => d.accept(PASS));
  await page.mouse.move(box.x + 20, box.y + box.height / 2); await page.mouse.down(); await wait(3300); await page.mouse.up();
  await page.waitForSelector('label.lw-upload:not([hidden])', { timeout: 8000 });
  const showId = await page.evaluate(async () => {
    const tok = JSON.parse(sessionStorage.getItem('ae-studio-token')).token;
    const r = await fetch('/api/shinity?a=exhibition-save', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify({ exhibition: { title: { zh: '神之編排', en: 'Divine' }, mode: 'online', items: ['ae01', 'ae02', 'ae03', 'ae04', 'ae05', 'ae06'].map(id => ({ id })) } }) });
    return (await r.json()).exhibition.id;
  });
  await page.evaluate(() => window.__shinity.reload());
  await page.locator(`#shows [data-show="${showId}"]`).click().catch(async () => { await page.locator('#shows button', { hasText: '神之編排' }).first().click(); });
  await wait(400);
  await page.click('#playBtn'); await page.waitForFunction(() => window.__shinity.state.shown, null, { timeout: 30000 });
  check(`[${which}] AE Studio sees the God mode button`, !(await page.evaluate(() => document.getElementById('godBtn').hidden)));
  await page.evaluate(() => document.getElementById('godBtn').click());
  await page.waitForSelector('#godPanel:not([hidden])'); await wait(500);
  const idx0 = (await st()).idx;
  check(`[${which}] God mode opens beside the painting and pauses auto-advance`, (await st()).god && await page.evaluate(() => document.body.classList.contains('tuning')));
  // summon wind, heavenly light and silk ribbons
  for (const id of ['wind', 'light', 'ribbons']) await page.click(`.lw-god-summon[data-pack=${id}]`);
  await wait(2500);
  const s1 = await st();
  check(`[${which}] summoned effects appear at once`, ['wind', 'light', 'ribbons'].every(id => s1.packs.some(p => p.id === id)), JSON.stringify(s1.packs.map(p => p.id)));
  // each package brings its own controls
  const ctl = await page.evaluate(() => ['wind', 'light', 'ribbons'].map(id => document.querySelectorAll(`.lw-god-params[data-pack=${id}] .lw-param`).length));
  check(`[${which}] each package brings its own controls`, ctl[0] === 6 && ctl[1] === 6 && ctl[2] === 6, JSON.stringify(ctl));
  // the light is really drawn (front layer not empty) and the painting itself is untouched
  const lit = await page.evaluate(() => { const c = document.querySelector('.pl-alive'), x = c.getContext('2d'); const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 8) n++; return n; });
  check(`[${which}] wind, light and ribbons are drawn on the light layers`, lit > 500, `${lit} lit samples`);
  await page.screenshot({ path: `${out}/${which}-god-summon.png` });
  // tune: wind from the left, strong
  const r1 = page.locator('.lw-god-params[data-pack=wind] input[type=range]').first();
  await r1.fill('180');
  await wait(300);
  check(`[${which}] tuning a control changes the effect live`, (await st()).packs.find(p => p.id === 'wind').p.direction === 180);
  await wait(400);
  check(`[${which}] auto-advance stays paused while arranging`, (await st()).idx === idx0);
  // camera: from afar, then closer (一花一世界) — never closer than the photo's resolution allows
  await page.locator('#godCams .lw-chip', { hasText: '由遠而近' }).click();
  await wait(400);
  const c0 = (await st()).camPose;
  await wait(4000);
  const c1 = (await st()).camPose;
  check(`[${which}] the camera starts from afar and moves`, (await st()).cam === 'cam-approach' && c0 && c0.s < 0.95 && c1 && c1.s !== c0.s, JSON.stringify({ c0, c1 }));
  const camLayers = await page.evaluate(() => { const s = window.__shinity.state, m = document.querySelectorAll('.pl-slide')[s.cur].querySelector('img'), f = document.querySelector('.pl-alive'); return m.style.transform === f.style.transform && /scale/.test(m.style.transform); });
  check(`[${which}] the light layers move with the painting (one camera)`, camLayers);
  let maxSeen = 0, cap = 9;
  await page.locator('#godCams .lw-chip', { hasText: '細節巡禮' }).click();
  const z = page.locator('#godCamParams input[type=range]').nth(1); await z.fill('3');
  for (let k = 0; k < 20; k++) { const cp = (await st()).camPose; if (cp) { maxSeen = Math.max(maxSeen, cp.s); cap = cp.max; } await wait(250); }
  check(`[${which}] zoom never goes beyond the photo's resolution`, maxSeen <= cap + 0.01 && cap >= 1, `max ${maxSeen} (limit ${cap})`);
  check(`[${which}] the panel tells how close this photo allows`, /\d/.test(await page.textContent('#godZoomNote')));
  await page.locator('#godCams .lw-chip', { hasText: '空拍環繞' }).click();
  await wait(2500);
  const orb = (await st()).camPose;
  check(`[${which}] drone orbit views the work at an angle`, orb && (Math.abs(orb.ry) > 1 || Math.abs(orb.rx) > 1), JSON.stringify(orb));
  await page.screenshot({ path: `${out}/${which}-god-orbit.png` });
  // transition package + scope: works 1–3
  await page.locator('#godTrans .lw-chip', { hasText: '立體翻轉' }).click().catch(async () => { await page.locator('#godTrans .lw-chip').nth(2).click(); });
  await page.locator('#godScope .lw-chip').nth(1).click();
  await page.fill('#godFrom', '1'); await page.fill('#godTo', '3');
  await page.click('#godSave'); await wait(1500);
  const saved = await page.evaluate(async (id) => { const tok = JSON.parse(sessionStorage.getItem('ae-studio-token')).token; const r = await fetch('/api/shinity?a=catalog&studio=1', { headers: { authorization: 'Bearer ' + tok } }); return (await r.json()).exhibitions.find(e => e.id === id).items; }, showId);
  check(`[${which}] the choreography is saved for works 1–3 only`, [0, 1, 2].every(i => saved[i].fx && saved[i].fx.length === 3 && saved[i].tr && saved[i].tr.id === 'flip' && saved[i].cam && saved[i].cam.id === 'cam-orbit') && !saved[3].fx && !saved[3].tr && saved[0].fx.find(f => f.id === 'wind').p.direction === 180, JSON.stringify(saved.map(i => [i.fx ? i.fx.length : 0, i.tr ? i.tr.id : ''])));
  await page.click('#godClose'); await wait(400);
  check(`[${which}] closing God mode keeps the saved arrangement on screen`, (await st()).packs.length === 3 && !(await st()).god);
  // the flip transition package runs between work 1 and 2
  await page.evaluate(() => window.__shinity.go(1));
  let saw = false;
  for (let k = 0; k < 30 && !saw; k++) { saw = await page.evaluate(() => [...document.querySelectorAll('.pl-slide')].some(s => /rotate[XY]/.test(s.style.transform))); await wait(60); }
  check(`[${which}] the chosen transition package plays (3D turn)`, saw);
  await page.waitForFunction(() => !window.__shinity.state.busy, null, { timeout: 15000 });
  await wait(1500);
  check(`[${which}] the next work in the run keeps the same effects`, (await st()).packs.length === 3);
  await page.evaluate(() => window.__shinity.jump(3));
  await page.waitForFunction(() => window.__shinity.state.idx === 3 && !window.__shinity.state.busy, null, { timeout: 15000 }); await wait(1500);
  check(`[${which}] outside the run there are no extra effects`, (await st()).packs.length === 0);
  const slideClean = await page.evaluate(() => { const s = document.querySelectorAll('.pl-slide')[window.__shinity.state.cur]; return !s.style.transform && (s.style.opacity === '1'); });
  check(`[${which}] after a package transition the slide is left clean`, slideClean);

  // Night Party: the prism lasers land on the painting (not just beside it)
  await page.evaluate(() => document.querySelector('#fxBtn').click()); await page.waitForSelector('#settings:not([hidden])');
  await page.click('.lw-mode[data-mode=party]'); await page.click('#closeSettings'); await wait(2500);
  const lz = await page.evaluate(() => {
    const s = window.__shinity.state, c = document.querySelector('.pl-alive'), x = c.getContext('2d'), r = document.querySelectorAll('.pl-slide')[s.cur].querySelector('img').getBoundingClientRect();
    const k = c.width / c.clientWidth, d = x.getImageData(Math.round(r.x * k), Math.round(r.y * k), Math.round(r.width * k), Math.round(r.height * k)).data;
    let lit = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 30) lit++;
    return { packs: s.packs.map(p => p.id), lit };
  });
  check(`[${which}] a work without a camera move has no leftover pose (neon frame aligned)`, await page.evaluate(() => !document.getElementById('neon').style.transform));
  check(`[${which}] Night Party: lasers land on the painting and light it`, lz.packs.includes('laser') && lz.lit > 200, JSON.stringify(lz));
  await page.screenshot({ path: `${out}/${which}-party-laser.png` });
  // a visitor sees exactly what was arranged
  const v = await browser.newContext(ctxOpts); const vp = await v.newPage(); const verr = []; vp.on('pageerror', e => verr.push(String(e)));
  await vp.goto(base + '/gallery.html', { waitUntil: 'networkidle' }); await vp.waitForFunction(() => window.__shinity && document.querySelectorAll('.screen').length > 0);
  await vp.locator(`#shows [data-show="${showId}"]`).click().catch(async () => { await vp.locator('#shows button', { hasText: '神之編排' }).first().click(); });
  await wait(300);
  await vp.click('#playBtn'); await vp.waitForFunction(() => window.__shinity.state.shown, null, { timeout: 30000 }); await wait(2500);
  const vs = await vp.evaluate(() => window.__shinity.state);
  check(`[${which}] visitors see the arranged effects (fixed, no God mode)`, vs.packs.length === 3 && vs.packs.find(p => p.id === 'wind').p.direction === 180 && await vp.evaluate(() => document.getElementById('godBtn').hidden), JSON.stringify(vs.packs.map(p => p.id)));
  await vp.screenshot({ path: `${out}/${which}-god-visitor.png` });
  // the exported client player carries the choreography and plays it (offline, sandboxed file)
  if (which === 'desktop') {
    const html = await page.evaluate(async (id) => {
      const tok = JSON.parse(sessionStorage.getItem('ae-studio-token')).token;
      const c = await (await fetch('/api/shinity?a=catalog&studio=1', { headers: { authorization: 'Bearer ' + tok } })).json();
      const sh = c.exhibitions.find(e => e.id === id);
      const works = sh.items.slice(0, 4).map(it => ({ ...c.works.find(w => w.id === it.id), ...it }));
      const { exportEdition } = await import('./gallery/export.js');
      const out = await exportEdition({ meta: { titleZh: '神之編排', titleEn: 'Divine', kind: 'client', quality: 'light', artist: 'Aurelia & Elion', year: '2026' }, works, mode: 'online', settings: window.__shinity.state.settings });
      return await out.blob.text();
    }, showId);
    const f = path.join(out, 'god-edition.html'); fs.writeFileSync(f, html);
    const e = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const ep = await e.newPage(); const eerr = []; ep.on('pageerror', x => eerr.push(String(x)));
    await ep.goto('file://' + f); await ep.waitForFunction(() => window.__shinity, null, { timeout: 30000 });
    await ep.click('#gateBtn');
    await ep.waitForFunction(() => window.__shinity.state.shown, null, { timeout: 30000 }).catch(() => {}); await wait(2500);
    const es = await ep.evaluate(() => window.__shinity.state);
    check(`[${which}] the exported client player plays the same choreography`, es.packs.length === 3 && es.packs.find(p => p.id === 'wind').p.direction === 180 && eerr.length === 0, JSON.stringify({ packs: es.packs.map(p => p.id), errs: eerr.slice(0, 2) }));
    await e.close();
  }
  check(`[${which}] no page errors`, errs.length === 0 && verr.length === 0, errs.concat(verr).slice(0, 3).join(' | '));
} catch (e) { check(`[${which}] scenario crashed`, false, String(e).split('\n').slice(0, 4).join(' / ')); }
await browser.close(); srv.kill(); fs.rmSync(lib, { recursive: true, force: true });
const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} checks passed`); process.exit(f ? 1 : 0);
