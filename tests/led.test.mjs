// AE Shinity — LED 燈條 package: AE (or a light artist) lays LED strips on the screen, picks the pattern and colours,
// can dim the painting or go fully dark (pure light art), and the strip flashes with claps and music.
// Usage: node tests/led.test.mjs <outDir>
import { createRequire } from 'module';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || '.';
const results = []; const check = (n, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${info ? '  — ' + info : ''}`); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const PASS = 'led-' + Date.now();
const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'shinity-led-'));
const srv = spawn(process.execPath, [path.join(here, 'shinity-dev-server.mjs'), '8873'], { env: { ...process.env, SHINITY_FS_DIR: lib, SHINITY_STUDIO_PASSWORD: PASS }, stdio: 'pipe' });
process.on('exit', () => { try { srv.kill(); } catch { /* ignore */ } });
await new Promise(r => srv.stdout.on('data', d => String(d).includes('dev server') && r()));
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    const AC = window.AudioContext; window.AudioContext = function (...a) { const c = new AC(...a); window.__ctx = c; return c; }; window.AudioContext.prototype = AC.prototype;
    navigator.mediaDevices.getUserMedia = async () => {
      const c = window.__ctx, md = c.createMediaStreamDestination();
      const noise = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      window.__clap = (t) => { const s = c.createBufferSource(); s.buffer = noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; const g = c.createGain(); g.gain.value = 0.0001; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.8, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); s.connect(f).connect(g).connect(md); s.start(t); s.stop(t + 0.1); };
      return md.stream;
    };
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://localhost:8873/gallery.html', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__shinity && document.querySelectorAll('.screen').length);
  const box = await page.locator('.lw-wordmark').boundingBox(); page.once('dialog', d => d.accept(PASS));
  await page.mouse.move(box.x + 20, box.y + box.height / 2); await page.mouse.down(); await wait(3300); await page.mouse.up();
  await page.waitForSelector('label.lw-upload:not([hidden])', { timeout: 8000 });
  const showId = await page.evaluate(async () => {
    const tok = JSON.parse(sessionStorage.getItem('ae-studio-token')).token;
    const r = await fetch('/api/shinity?a=exhibition-save', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify({ exhibition: { title: { zh: '燈光藝術', en: 'Light Art' }, mode: 'online', items: ['ae01', 'ae02', 'ae03'].map(id => ({ id, duration: 60 })) } }) });
    return (await r.json()).exhibition.id;
  });
  await page.evaluate(() => window.__shinity.reload());
  await page.locator(`#shows [data-show="${showId}"]`).click().catch(async () => { await page.locator('#shows button', { hasText: '燈光藝術' }).first().click(); });
  await wait(400);
  await page.click('#playBtn'); await page.waitForFunction(() => window.__shinity.state.shown, null, { timeout: 30000 });
  await page.evaluate(() => document.getElementById('musicBtn').click()); // no music: the room leads
  await page.evaluate(() => document.getElementById('godBtn').click()); await page.waitForSelector('#godPanel:not([hidden])'); await wait(400);
  await page.click('.lw-god-summon[data-pack=led]'); await wait(1500);
  const P = '.lw-god-params[data-pack=led]';
  const nCtl = await page.evaluate((P) => document.querySelectorAll(`${P} .lw-param`).length, P);
  check('the LED strip is in God mode with its own controls (layout, pattern, colours, size, speed, sound, stage…)', nCtl === 14, `${nCtl} controls`);
  // LEDs around the whole screen sit on the fixed layer; around the work, on the layer that moves with it
  const lit = () => page.evaluate(() => { let n = 0; const hues = new Set(); for (const c of document.querySelectorAll('.pl-led, .pl-alive')) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 60) { n++; hues.add(`${d[i] >> 6}${d[i + 1] >> 6}${d[i + 2] >> 6}`); } } return { n, hues: hues.size }; });
  const a = await lit();
  check('a rainbow row of LEDs lights the bottom of the screen', a.n > 200 && a.hues >= 6, JSON.stringify(a));
  await page.screenshot({ path: `${out}/led-rainbow.png` });
  const pick = async (label) => { await page.locator(`${P} .lw-chip`, { hasText: label }).first().click(); await wait(200); };
  // all around the work, breathing, the client's own colours
  await pick('圍成一圈'); await pick('畫作'); await pick('呼吸'); await pick('自選顏色');
  await page.locator(`${P} input[type=color]`).nth(0).evaluate((i) => { i.value = '#ff2a6d'; i.dispatchEvent(new Event('input')); });
  await page.locator(`${P} input[type=color]`).nth(1).evaluate((i) => { i.value = '#05d9e8'; i.dispatchEvent(new Event('input')); });
  await wait(1200);
  const st = await page.evaluate(() => window.__shinity.state.packs.find(p => p.id === 'led').p);
  check('layout, pattern and own colours are applied live', st.layout === 'frame' && st.around === 'work' && st.pattern === 'breathe' && st.colors === 'own' && st.c1 === '#ff2a6d', JSON.stringify(st));
  const b1 = (await lit()).n; await wait(1900); const b2 = (await lit()).n;
  check('breathing: the strip brightens and dims continuously', Math.abs(b1 - b2) > 30, `${b1} → ${b2} lit samples`);
  await page.screenshot({ path: `${out}/led-frame-breathe.png` });
  // pure light art: a wall of LEDs on a dark stage
  await pick('多排（燈牆）'); await pick('整個螢幕'); await pick('流動'); await pick('七彩'); await pick('只有燈光（黑幕）');
  await wait(1200);
  const dark = await page.evaluate(() => { const op = (sel) => +getComputedStyle(document.querySelector(sel)).opacity; return { on: document.getElementById('player').classList.contains('lights-only'), slide: op('.pl-slide.live') , caption: op('.pl-caption'), sparkles: op('.pl-fx'), mark: op('.pl-mark') }; });
  const wall = await lit();
  check('lights only: the painting, its title, Lumi and the sparkles leave; the LED wall glows', dark.on && dark.slide === 0 && dark.caption === 0 && dark.sparkles === 0 && dark.mark === 0 && wall.n > 1000, JSON.stringify({ ...dark, lit: wall.n }));
  await page.screenshot({ path: `${out}/led-wall-dark.png` });
  // sound: claps flash the strip
  await page.locator('#godScope .lw-chip').nth(2).click(); await wait(200); // the whole exhibition
  await page.click('#godSave'); await wait(1500); await page.click('#godClose'); await wait(600);
  const through = await page.evaluate(async () => {
    const L = window.__shinity; const id0 = L.state.curId; let minLit = 1e9, dark = true;
    const c = document.querySelector('.pl-led'), x = c.getContext('2d');
    const count = () => { const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 64) if (d[i] > 60) n++; return n; };
    document.getElementById('nextBtn').click();
    const t0 = performance.now();
    while (performance.now() - t0 < 4000) { await new Promise(r => requestAnimationFrame(r)); minLit = Math.min(minLit, count()); dark = dark && document.getElementById('player').classList.contains('lights-only'); }
    return { moved: L.state.curId !== id0, minLit, dark };
  });
  check('a change of work: the LED wall and the dark stage never go out', through.moved && through.minLit > 500 && through.dark, JSON.stringify(through));
  check('the arrangement is saved to the work (the client screen plays it as arranged)', await page.evaluate(() => window.__shinity.state.packs.some(p => p.id === 'led')));
  await page.evaluate(() => document.querySelector('#fxBtn').click()); await page.waitForSelector('#settings:not([hidden])');
  await page.click('#interactToggles [data-opt=listen]'); await wait(800); await page.click('#closeSettings');
  const h0 = await page.evaluate(() => window.__shinity.state.hits.led);
  await page.evaluate(() => { let t = window.__ctx.currentTime + 0.4; for (const g of [0, 0.6, 0.45, 0.9, 0.5]) { t += g; window.__clap(t); } });
  await wait(4500);
  const h1 = await page.evaluate(() => window.__shinity.state.hits.led);
  check('every clap flashes the LED strip', h1 - h0 === 5, `${h1 - h0}/5 flashes`);
  check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { check('scenario crashed', false, String(e).split('\n').slice(0, 4).join(' / ')); }
await browser.close(); srv.kill(); fs.rmSync(lib, { recursive: true, force: true });
const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} checks passed`); process.exit(f ? 1 : 0);
