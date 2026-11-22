// AE Lumina Wall — beat lock: the room's music is heard through the microphone, the tempo and phase are locked and
// the light fires ON the predicted beat. The "microphone" here is a generated kick track with sample-exact kick times
// (120 BPM, then a new song at 128 BPM, then silence). Usage: node tests/lock.test.mjs <outDir>
import { createRequire } from 'module';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const results = []; const check = (n, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${info ? '  — ' + info : ''}`); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-lock-'));
const srv = spawn(process.execPath, [path.join(here, 'lumina-dev-server.mjs'), '8871'], { env: { ...process.env, LUMINA_FS_DIR: lib, LUMINA_STUDIO_PASSWORD: 'x' }, stdio: 'pipe' });
process.on('exit', () => { try { srv.kill(); } catch { /* ignore */ } });
await new Promise(r => srv.stdout.on('data', d => String(d).includes('dev server') && r()));
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const stats = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return { mean: m, sd: Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length), worst: Math.max(...a.map(Math.abs)) }; };
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  // the "room": a kick drum + chord rendered in the player's own audio clock, so every kick time is known exactly
  await ctx.addInitScript(() => {
    const AC = window.AudioContext; window.AudioContext = function (...a) { const c = new AC(...a); window.__ctx = c; return c; }; window.AudioContext.prototype = AC.prototype;
    navigator.mediaDevices.getUserMedia = async () => {
      const c = window.__ctx, md = c.createMediaStreamDestination();
      window.__kicks = [];
      window.__room = (bpm, from, secs) => {
        const per = 60 / bpm;
        for (let t = from; t < from + secs; t += per) {
          const o = c.createOscillator(), g = c.createGain();
          o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
          o.connect(g).connect(md); o.start(t); o.stop(t + 0.4); window.__kicks.push(t);
          const h = c.createOscillator(), hg = c.createGain(); h.type = 'triangle'; h.frequency.value = 330; hg.gain.setValueAtTime(0.05, t); hg.gain.exponentialRampToValueAtTime(0.0001, t + per);
          h.connect(hg).connect(md); h.start(t); h.stop(t + per);
        }
      };
      return md.stream;
    };
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://localhost:8871/gallery.html', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__lumina && document.querySelectorAll('.screen').length);
  await page.click('#openSettings'); await page.click('.lw-mode[data-mode=party]'); await page.click('#closeSettings');
  await page.click('#playBtn'); await page.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 });
  await page.evaluate(() => document.getElementById('musicBtn').click()); // our music off: the room leads
  await page.evaluate(() => document.querySelector('#fxBtn').click()); await page.waitForSelector('#settings:not([hidden])');
  await page.click('#interactToggles [data-opt=listen]'); await wait(800); await page.click('#closeSettings');
  // song 1: 120 BPM for 12 s
  const t1 = await page.evaluate(() => { const t = window.__ctx.currentTime + 0.3; window.__room(120, t, 12); return t; });
  await wait(4000);
  const early = await page.evaluate(() => window.__lumina.state.lock);
  check('locks onto the room\'s tempo within 4 s', early.locked && Math.abs(early.bpm - 120) < 1.5, JSON.stringify({ locked: early.locked, bpm: early.bpm }));
  await wait(7000);
  const s1 = await page.evaluate(() => ({ lock: window.__lumina.state.lock, kicks: window.__kicks, mode: window.__lumina.state.laserMode }));
  // the onset detector's delay in this pipeline, and the lock's accuracy against the onsets it heard (the predictor itself)
  const nearest = (t, list) => list.reduce((b, k) => Math.abs(k - t) < Math.abs(b - t) ? k : b, list[0]);
  const det = stats(s1.lock.onsets.map(o => o - nearest(o, s1.kicks)));
  const em = s1.lock.emitted.filter(t => t > t1 + 3 && t < t1 + 12);
  const vsKick = stats(em.map(t => t - nearest(t, s1.kicks)));
  check('the light fires on the beat: predicted beats vs. real kicks', vsKick.worst <= 0.025, `mean ${(vsKick.mean * 1000).toFixed(1)} ms, sd ${(vsKick.sd * 1000).toFixed(1)} ms, worst ${(vsKick.worst * 1000).toFixed(1)} ms over ${em.length} beats (onset detection ${(det.mean * 1000).toFixed(1)} ms)`);
  check('steady: beat-to-beat jitter is tiny', vsKick.sd <= 0.008, `sd ${(vsKick.sd * 1000).toFixed(1)} ms`);
  check('the lasers follow the locked beat', s1.mode === 'room', s1.mode);
  // song 2: 128 BPM, a new phase
  const t2 = await page.evaluate(() => { const t = window.__ctx.currentTime + 0.37; window.__room(128, t, 12); return t; });
  await wait(12000);
  const s2 = await page.evaluate(() => ({ lock: window.__lumina.state.lock, kicks: window.__kicks }));
  const em2 = s2.lock.emitted.filter(t => t > t2 + 5 && t < t2 + 12);
  const v2 = stats(em2.map(t => t - nearest(t, s2.kicks.filter(k => k >= t2 - 0.1))));
  check('a new song (128 BPM) re-locks and stays on the beat', s2.lock.locked && Math.abs(s2.lock.bpm - 128) < 1.5 && v2.worst <= 0.03, `bpm ${s2.lock.bpm}, worst ${(v2.worst * 1000).toFixed(1)} ms over ${em2.length} beats`);
  // silence: let go, breathe
  await wait(4500);
  const s3 = await page.evaluate(() => ({ lock: window.__lumina.state.lock, mode: window.__lumina.state.laserMode }));
  check('silence: the lock lets go and the lasers breathe', !s3.lock.locked && s3.mode === 'calm', JSON.stringify({ locked: s3.lock.locked, mode: s3.mode }));
  check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { check('scenario crashed', false, String(e).split('\n').slice(0, 4).join(' / ')); }
await browser.close(); srv.kill(); fs.rmSync(lib, { recursive: true, force: true });
const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} checks passed`); process.exit(f ? 1 : 0);
