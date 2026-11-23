// AE Lumina Wall — showcase (/showcase): one tap, then the finished show. Act 1: the room's sound plays the painting
// (dim → bright, saturated, contrasty; bursts, lasers, LED meter). Act 2: the theme track and the stage show.
// The "microphone" is generated in the player's own audio clock. Usage: node tests/showcase.test.mjs <outDir> [phone]
import { createRequire } from 'module';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || '.'; const phone = process.argv[3] === 'phone';
const results = []; const check = (n, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${info ? '  — ' + info : ''}`); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-showcase-'));
const port = phone ? 8875 : 8874;
const srv = spawn(process.execPath, [path.join(here, 'lumina-dev-server.mjs'), String(port)], { env: { ...process.env, LUMINA_FS_DIR: lib, LUMINA_STUDIO_PASSWORD: 'x' }, stdio: 'pipe' });
process.on('exit', () => { try { srv.kill(); } catch { /* ignore */ } });
await new Promise(r => srv.stdout.on('data', d => String(d).includes('dev server') && r()));
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext(phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    const AC = window.AudioContext; window.AudioContext = function (...a) { const c = new AC(...a); window.__ctx = c; return c; }; window.AudioContext.prototype = AC.prototype;
    navigator.mediaDevices.getUserMedia = async () => {
      const c = window.__ctx, md = c.createMediaStreamDestination();
      const noise = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      window.__clap = (t, v = 0.8) => { const s = c.createBufferSource(); s.buffer = noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; const g = c.createGain(); g.gain.value = 0.0001; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); s.connect(f).connect(g).connect(md); s.start(t); s.stop(t + 0.1); };
      window.__voice = (t, secs) => { for (let k = 0; k < secs * 4; k++) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 140 + Math.random() * 90; const tt = t + k * 0.25; g.gain.value = 0.0001; g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.35, tt + 0.03); g.gain.linearRampToValueAtTime(0.0001, tt + 0.22); o.connect(g).connect(md); o.start(tt); o.stop(tt + 0.24); } };
      return md.stream;
    };
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`http://localhost:${port}/showcase`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#startGate:not([hidden])', { timeout: 10000 });
  const gate = await page.evaluate(() => ({ title: document.getElementById('gateShow').textContent, main: getComputedStyle(document.querySelector('main')).display }));
  check('opens on one quiet start screen (no gallery, no menus)', /盛明/.test(gate.title) && gate.main === 'none', JSON.stringify(gate));
  await page.screenshot({ path: `${out}/showcase-gate${phone ? '-phone' : ''}.png` });
  await page.click('#gateBtn');
  await page.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 });
  await wait(1500);
  const ui = await page.evaluate(() => ({ controls: getComputedStyle(document.getElementById('controls')).display, listen: window.__lumina.state.listen, music: window.__lumina.state.music }));
  check('act 1: no buttons; the microphone listens; no music yet', ui.controls === 'none' && ui.listen && (!ui.music || ui.music === 'none'), JSON.stringify(ui));
  const look = () => page.evaluate(() => ({ b: +getComputedStyle(document.getElementById('player')).getPropertyValue('--sc-b') || 0, bursts: window.__lumina.state.bursts, laser: window.__lumina.state.hits.flashes, led: window.__lumina.state.hits.led }));
  await wait(2500); const quiet = await look();
  await page.screenshot({ path: `${out}/showcase-quiet${phone ? '-phone' : ''}.png` });
  // a clap
  await page.evaluate(() => window.__clap(window.__ctx.currentTime + 0.1));
  let peak = quiet; for (let i = 0; i < 12; i++) { await wait(60); const l = await look(); if (l.b > peak.b) peak = l; }
  await page.screenshot({ path: `${out}/showcase-clap${phone ? '-phone' : ''}.png` });
  const after = await look();
  check('a clap: the painting jumps from dim to bright, a burst, the lasers and the LED flash', quiet.b < 0.5 && peak.b > 0.95 && after.laser > quiet.laser && after.led > quiet.led, JSON.stringify({ quiet: quiet.b, peak: peak.b, laser: after.laser - quiet.laser, led: after.led - quiet.led }));
  await wait(2500);
  // talking
  const v0 = await look(); await page.evaluate(() => window.__voice(window.__ctx.currentTime + 0.1, 2.5));
  let vmax = 0; for (let i = 0; i < 20; i++) { await wait(120); vmax = Math.max(vmax, (await look()).b); }
  await page.screenshot({ path: `${out}/showcase-voice${phone ? '-phone' : ''}.png` });
  check('a voice: the painting brightens while you speak', vmax > v0.b + 0.25, JSON.stringify({ before: v0.b, during: vmax }));
  await wait(3000);
  const settled = await look();
  check('silence again: it settles back to dim', settled.b < 0.5, String(settled.b));
  // act 2 after ~40 s
  await page.waitForFunction(() => window.__lumina.state.music === 'eternal', null, { timeout: 45000 }).catch(() => {});
  await wait(1500);
  const a2 = await page.evaluate(() => ({ music: window.__lumina.state.music, cur: window.__lumina.state.curId, b: getComputedStyle(document.querySelector('.pl-slide.live .pl-media')).filter, controls: getComputedStyle(document.getElementById('controls')).display, t: window.__lumina.trackTime() }));
  check('act 2: the theme track begins at the build, the painting at full light, still no buttons', a2.music === 'eternal' && a2.cur === 'sc-infinity-nature' && (a2.b === 'none' || a2.b === '') && a2.controls === 'none', JSON.stringify(a2));
  await page.waitForFunction(() => window.__lumina.trackTime() > 66, null, { timeout: 20000 }).catch(() => {});
  await wait(600);
  const drop = await page.evaluate(() => ({ cur: window.__lumina.state.curId, laser: window.__lumina.state.laserMode, packs: window.__lumina.state.packs.map(p => p.id), t: +window.__lumina.trackTime().toFixed(2) }));
  check('the drop lands on a dark work with every laser and the LED frame (on the music\'s clock)', drop.cur === 'ae14' && drop.laser === 'music' && drop.packs.includes('laser') && drop.packs.includes('led'), JSON.stringify(drop));
  await page.screenshot({ path: `${out}/showcase-act2${phone ? '-phone' : ''}.png` });
  check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { check('scenario crashed', false, String(e).split('\n').slice(0, 4).join(' / ')); }
await browser.close(); srv.kill(); fs.rmSync(lib, { recursive: true, force: true });
const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} checks passed`); process.exit(f ? 1 : 0);
