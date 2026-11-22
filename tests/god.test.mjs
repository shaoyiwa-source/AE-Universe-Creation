// AE Lumina Wall — R10-1 God mode: summon effect packages, tune them, choose a transition package,
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
const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-god-'));
const srv = spawn(process.execPath, [path.join(here, 'lumina-dev-server.mjs'), String(port)], { env: { ...process.env, LUMINA_FS_DIR: lib, LUMINA_STUDIO_PASSWORD: PASS }, stdio: 'pipe' });
process.on('exit', () => { try { srv.kill(); } catch { /* ignore */ } });
await new Promise(r => srv.stdout.on('data', d => String(d).includes('dev server') && r()));
const base = `http://localhost:${port}`;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(base + '/gallery.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__lumina && document.querySelectorAll('.screen').length > 0);
  const st = () => page.evaluate(() => window.__lumina.state);
  check(`[${which}] packages are registered (3 effects, 4 transitions)`, await page.evaluate(() => { const l = window.__lumina.packsList(); return l.filter(p => p.type === 'effect').length === 3 && l.filter(p => p.type === 'transition').length === 4; }));
  check(`[${which}] visitors never see God mode`, (await page.evaluate(() => document.getElementById('godBtn').hidden)));
  // AE Studio + an exhibition of six works
  const box = await page.locator('.lw-wordmark').boundingBox();
  page.once('dialog', d => d.accept(PASS));
  await page.mouse.move(box.x + 20, box.y + box.height / 2); await page.mouse.down(); await wait(3300); await page.mouse.up();
  await page.waitForSelector('label.lw-upload:not([hidden])', { timeout: 8000 });
  const showId = await page.evaluate(async () => {
    const tok = JSON.parse(sessionStorage.getItem('ae-studio-token')).token;
    const r = await fetch('/api/lumina?a=exhibition-save', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify({ exhibition: { title: { zh: '神之編排', en: 'Divine' }, mode: 'online', items: ['ae01', 'ae02', 'ae03', 'ae04', 'ae05', 'ae06'].map(id => ({ id })) } }) });
    return (await r.json()).exhibition.id;
  });
  await page.evaluate(() => window.__lumina.reload());
  await page.locator(`#shows [data-show="${showId}"]`).click().catch(async () => { await page.locator('#shows button', { hasText: '神之編排' }).first().click(); });
  await wait(400);
  await page.click('#playBtn'); await page.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 });
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
  // transition package + scope: works 1–3
  await page.locator('#godTrans .lw-chip', { hasText: '立體翻轉' }).click().catch(async () => { await page.locator('#godTrans .lw-chip').nth(2).click(); });
  await page.locator('#godScope .lw-chip').nth(1).click();
  await page.fill('#godFrom', '1'); await page.fill('#godTo', '3');
  await page.click('#godSave'); await wait(1500);
  const saved = await page.evaluate(async (id) => { const tok = JSON.parse(sessionStorage.getItem('ae-studio-token')).token; const r = await fetch('/api/lumina?a=catalog&studio=1', { headers: { authorization: 'Bearer ' + tok } }); return (await r.json()).exhibitions.find(e => e.id === id).items; }, showId);
  check(`[${which}] the choreography is saved for works 1–3 only`, [0, 1, 2].every(i => saved[i].fx && saved[i].fx.length === 3 && saved[i].tr && saved[i].tr.id === 'flip') && !saved[3].fx && !saved[3].tr && saved[0].fx.find(f => f.id === 'wind').p.direction === 180, JSON.stringify(saved.map(i => [i.fx ? i.fx.length : 0, i.tr ? i.tr.id : ''])));
  await page.click('#godClose'); await wait(400);
  check(`[${which}] closing God mode keeps the saved arrangement on screen`, (await st()).packs.length === 3 && !(await st()).god);
  // the flip transition package runs between work 1 and 2
  await page.evaluate(() => window.__lumina.go(1));
  let saw = false;
  for (let k = 0; k < 30 && !saw; k++) { saw = await page.evaluate(() => [...document.querySelectorAll('.pl-slide')].some(s => /rotate[XY]/.test(s.style.transform))); await wait(60); }
  check(`[${which}] the chosen transition package plays (3D turn)`, saw);
  await page.waitForFunction(() => !window.__lumina.state.busy, null, { timeout: 15000 });
  await wait(1500);
  check(`[${which}] the next work in the run keeps the same effects`, (await st()).packs.length === 3);
  await page.evaluate(() => window.__lumina.jump(3));
  await page.waitForFunction(() => window.__lumina.state.idx === 3 && !window.__lumina.state.busy, null, { timeout: 15000 }); await wait(1500);
  check(`[${which}] outside the run there are no extra effects`, (await st()).packs.length === 0);
  const slideClean = await page.evaluate(() => { const s = document.querySelectorAll('.pl-slide')[window.__lumina.state.cur]; return !s.style.transform && (s.style.opacity === '1'); });
  check(`[${which}] after a package transition the slide is left clean`, slideClean);

  // a visitor sees exactly what was arranged
  const v = await browser.newContext(ctxOpts); const vp = await v.newPage(); const verr = []; vp.on('pageerror', e => verr.push(String(e)));
  await vp.goto(base + '/gallery.html', { waitUntil: 'networkidle' }); await vp.waitForFunction(() => window.__lumina && document.querySelectorAll('.screen').length > 0);
  await vp.locator(`#shows [data-show="${showId}"]`).click().catch(async () => { await vp.locator('#shows button', { hasText: '神之編排' }).first().click(); });
  await wait(300);
  await vp.click('#playBtn'); await vp.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 }); await wait(2500);
  const vs = await vp.evaluate(() => window.__lumina.state);
  check(`[${which}] visitors see the arranged effects (fixed, no God mode)`, vs.packs.length === 3 && vs.packs.find(p => p.id === 'wind').p.direction === 180 && await vp.evaluate(() => document.getElementById('godBtn').hidden), JSON.stringify(vs.packs.map(p => p.id)));
  await vp.screenshot({ path: `${out}/${which}-god-visitor.png` });
  // the exported client player carries the choreography and plays it (offline, sandboxed file)
  if (which === 'desktop') {
    const html = await page.evaluate(async (id) => {
      const tok = JSON.parse(sessionStorage.getItem('ae-studio-token')).token;
      const c = await (await fetch('/api/lumina?a=catalog&studio=1', { headers: { authorization: 'Bearer ' + tok } })).json();
      const sh = c.exhibitions.find(e => e.id === id);
      const works = sh.items.slice(0, 4).map(it => ({ ...c.works.find(w => w.id === it.id), ...it }));
      const { exportEdition } = await import('./gallery/export.js');
      const out = await exportEdition({ meta: { titleZh: '神之編排', titleEn: 'Divine', kind: 'client', quality: 'light', artist: 'Aurelia & Elion', year: '2026' }, works, mode: 'online', settings: window.__lumina.state.settings });
      return await out.blob.text();
    }, showId);
    const f = path.join(out, 'god-edition.html'); fs.writeFileSync(f, html);
    const e = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const ep = await e.newPage(); const eerr = []; ep.on('pageerror', x => eerr.push(String(x)));
    await ep.goto('file://' + f); await ep.waitForFunction(() => window.__lumina, null, { timeout: 30000 });
    await ep.click('#gateBtn');
    await ep.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 }).catch(() => {}); await wait(2500);
    const es = await ep.evaluate(() => window.__lumina.state);
    check(`[${which}] the exported client player plays the same choreography`, es.packs.length === 3 && es.packs.find(p => p.id === 'wind').p.direction === 180 && eerr.length === 0, JSON.stringify({ packs: es.packs.map(p => p.id), errs: eerr.slice(0, 2) }));
    await e.close();
  }
  check(`[${which}] no page errors`, errs.length === 0 && verr.length === 0, errs.concat(verr).slice(0, 3).join(' | '));
} catch (e) { check(`[${which}] scenario crashed`, false, String(e).split('\n').slice(0, 4).join(' / ')); }
await browser.close(); srv.kill(); fs.rmSync(lib, { recursive: true, force: true });
const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} checks passed`); process.exit(f ? 1 : 0);
