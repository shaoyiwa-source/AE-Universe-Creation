// AE Lumina Wall — R10-2: the homepage sound & light show inside the player, one-tap effects, package import.
// Usage: node tests/show.test.mjs <desktop|phone> <outDir>
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
const port = phone ? 8852 : 8851;
const PASS = 'show-' + Date.now();
const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-show-'));
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
  // Night Party = the homepage show: its own track, lasers on its measured beat, one-tap effects
  await page.click('#openSettings'); await page.click('.lw-mode[data-mode=party]'); await page.click('#closeSettings');
  check(`[${which}] Night Party plays the homepage show track`, (await st()).settings.music === 'eternal');
  await page.click('#playBtn'); await page.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 });
  await page.evaluate(() => { window.__lumina.state.settings.interval = 120; });
  await page.waitForFunction(() => window.__lumina.state.music === 'eternal', null, { timeout: 8000 }).catch(() => {});
  const track = await page.evaluate(() => new Promise(res => setTimeout(() => { const a = [...document.querySelectorAll('audio')].concat(window.__trackProbe || []); res(true); }, 2500)));
  void track;
  const b1 = await page.evaluate(() => window.__lumina.state.packs);
  check(`[${which}] lasers are on (landing on the painting)`, b1.some(p => p.id === 'laser'));
  // the beat comes from the track's timeline: watch the count rise and the stage
  const beats = await page.evaluate(async () => {
    const seen = new Set(); let maxPulse = 0, c0 = null, c1 = null;
    for (let k = 0; k < 40; k++) { const b = window.__lumina.beat(); if (c0 === null) c0 = b.count; c1 = b.count; seen.add(b.stage); maxPulse = Math.max(maxPulse, b.pulse || 0); await new Promise(r => setTimeout(r, 100)); }
    return { live: window.__lumina.beat().live, stages: [...seen], gained: c1 - c0, maxPulse: +maxPulse.toFixed(2), t: +window.__lumina.trackTime().toFixed(1) };
  });
  check(`[${which}] lights follow the track's measured beats (≈148 BPM)`, beats.live && beats.gained >= 6 && beats.gained <= 14 && beats.maxPulse > 0.5, JSON.stringify(beats));
  check(`[${which}] the show opens at the homepage cue (build → drop)`, beats.t > 58 && beats.t < 75 && beats.stages.some(s => s === 'build' || s === 'drop'), JSON.stringify(beats));
  await page.screenshot({ path: `${out}/${which}-show-party.png` });
  // one-tap effects tray
  check(`[${which}] one-tap effects button is offered`, !(await page.evaluate(() => document.getElementById('trayBtn').hidden)));
  await page.evaluate(() => document.getElementById('trayBtn').click());
  await page.waitForSelector('#fxTray:not([hidden])');
  const btns = await page.evaluate(() => [...document.querySelectorAll('#fxTray button')].map(b => b.dataset.burst));
  check(`[${which}] tray offers Glow, Gold coins, Laser`, ['glow', 'coins', 'sweep'].every(id => btns.includes(id)), JSON.stringify(btns));
  for (const id of ['glow', 'coins', 'sweep']) {
    await page.evaluate((id) => document.querySelector(`#fxTray [data-burst=${id}]`).click(), id);
    await wait(250);
    const n = (await st()).bursts;
    check(`[${which}] ${id} plays at once`, n >= 1, `${n} active`);
    if (id === 'coins') await page.screenshot({ path: `${out}/${which}-show-coins.png` });
    await wait(1900);
  }
  await wait(1500);
  check(`[${which}] one-tap effects end by themselves`, (await st()).bursts === 0);
  // calm modes: no tray where it does not belong
  await page.evaluate(() => document.querySelector('#fxBtn').click()); await page.waitForSelector('#settings:not([hidden])');
  await page.click('.lw-mode[data-mode=gallery]'); await page.click('#closeSettings'); await wait(300);
  check(`[${which}] the quiet Art Museum has no one-tap tray`, await page.evaluate(() => document.getElementById('trayBtn').hidden));
  await page.keyboard.press('Escape'); await wait(300); await page.keyboard.press('Escape'); await wait(300);

  if (!phone) {
    // God mode: import a package file → it appears, plays, is saved, and travels inside the client player
    const box = await page.locator('.lw-wordmark').boundingBox();
    page.once('dialog', d => d.accept(PASS));
    await page.mouse.move(box.x + 20, box.y + box.height / 2); await page.mouse.down(); await wait(3300); await page.mouse.up();
    await page.waitForSelector('label.lw-upload:not([hidden])', { timeout: 8000 });
    const pkg = path.join(out, 'pack-firefly.js');
    fs.writeFileSync(pkg, `// test package\nexport default {\n  id: 'firefly', type: 'effect', version: 3,\n  name: { zh: '螢火', en: 'Fireflies' }, desc: { zh: '測試套件', en: 'test' },\n  params: [{ id: 'count', type: 'range', min: 1, max: 40, step: 1, default: 12, label: { zh: '數量', en: 'Count' } }],\n  create(host, p) { let t = 0; return { set(n) { Object.assign(p, n); }, frame(dt, k) { t += dt; const c = host.front, r = host.rect; for (let i = 0; i < p.count; i++) { const x = r.x + r.w * (0.5 + 0.4 * Math.sin(t + i)), y = r.y + r.h * (0.5 + 0.4 * Math.cos(t * 0.7 + i * 2)); c.globalAlpha = k; c.drawImage(host.sprite([200, 255, 140]), x - 8, y - 8, 16, 16); } }, dispose() {} }; },\n};\n`);
    const showId = await page.evaluate(async () => {
      const tok = JSON.parse(sessionStorage.getItem('ae-studio-token')).token;
      const r = await fetch('/api/lumina?a=exhibition-save', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify({ exhibition: { title: { zh: '套件測試', en: 'Pack test' }, mode: 'online', items: ['ae01', 'ae02', 'ae03'].map(id => ({ id })) } }) });
      return (await r.json()).exhibition.id;
    });
    await page.evaluate(() => window.__lumina.reload());
    await page.locator(`#shows [data-show="${showId}"]`).click().catch(async () => { await page.locator('#shows button', { hasText: '套件測試' }).first().click(); });
    await wait(300);
    await page.click('#playBtn'); await page.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 });
    await page.evaluate(() => document.getElementById('godBtn').click()); await page.waitForSelector('#godPanel:not([hidden])');
    await page.setInputFiles('#godPackInput', pkg);
    await page.waitForSelector('.lw-god-summon[data-pack=firefly]', { timeout: 8000 }).catch(() => {});
    check(`[${which}] an imported package appears in God mode with its version`, (await page.locator('.lw-god-summon[data-pack=firefly]').count()) === 1 && /v3/.test(await page.textContent('#godPackList')));
    await page.click('.lw-god-summon[data-pack=firefly]'); await wait(400);
    check(`[${which}] the imported package brings its own control`, (await page.locator('.lw-god-params[data-pack=firefly] .lw-param').count()) === 1);
    check(`[${which}] the imported package plays`, (await st()).packs.some(p => p.id === 'firefly'));
    await page.click('#godSave'); await wait(1200);
    // a visitor (fresh page) gets the imported package from the cloud library
    const v = await browser.newContext(ctxOpts); const vp = await v.newPage();
    await vp.goto(base + '/gallery.html', { waitUntil: 'networkidle' }); await vp.waitForFunction(() => window.__lumina && document.querySelectorAll('.screen').length > 0);
    await vp.locator(`#shows [data-show="${showId}"]`).click().catch(async () => { await vp.locator('#shows button', { hasText: '套件測試' }).first().click(); });
    await wait(300); await vp.click('#playBtn'); await vp.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 }); await wait(2000);
    check(`[${which}] visitors get the imported package too`, (await vp.evaluate(() => window.__lumina.state.packs)).some(p => p.id === 'firefly'));
    await v.close();
    // an older version never replaces a newer one
    const older = await page.evaluate(() => window.__lumina.registerOld());
    check(`[${which}] an older version never replaces a newer one`, older === 3, `kept v${older}`);
    // the client player file carries the imported package
    const html = await page.evaluate(async (id) => {
      const tok = JSON.parse(sessionStorage.getItem('ae-studio-token')).token;
      const c = await (await fetch('/api/lumina?a=catalog&studio=1', { headers: { authorization: 'Bearer ' + tok } })).json();
      const sh = c.exhibitions.find(e => e.id === id);
      const works = sh.items.map(it => ({ ...c.works.find(w => w.id === it.id), ...it }));
      const code = await (await fetch(c.packs[0].src)).text();
      const { exportEdition } = await import('./gallery/export.js');
      const o = await exportEdition({ meta: { titleZh: '套件測試', titleEn: 'Pack test', kind: 'client', quality: 'light', artist: 'Aurelia & Elion', year: '2026' }, works, mode: 'online', settings: window.__lumina.state.settings, packs: [code] });
      return await o.blob.text();
    }, showId);
    const f = path.join(out, 'show-edition.html'); fs.writeFileSync(f, html);
    const e = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const ep = await e.newPage(); const eerr = []; ep.on('pageerror', x => eerr.push(String(x)));
    await ep.goto('file://' + f); await ep.waitForFunction(() => window.__lumina, null, { timeout: 30000 }); await ep.click('#gateBtn');
    await ep.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 }).catch(() => {}); await wait(2000);
    check(`[${which}] the client player carries the imported package`, (await ep.evaluate(() => window.__lumina.state.packs)).some(p => p.id === 'firefly') && eerr.length === 0, eerr.slice(0, 2).join(' | '));
    await e.close();
  }
  check(`[${which}] no page errors`, errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { check(`[${which}] scenario crashed`, false, String(e).split('\n').slice(0, 4).join(' / ')); }
await browser.close(); srv.kill(); fs.rmSync(lib, { recursive: true, force: true });
const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} checks passed`); process.exit(f ? 1 : 0);
