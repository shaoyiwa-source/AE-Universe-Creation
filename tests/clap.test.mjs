// AE Shinity — claps, finger snaps, knocks, thumps: with NO music at all, every sudden sound (any frequency) lights the lasers
// at once (like an LED strip's sound-active mode), and claps kept in time become the beat the light locks to.
// The "microphone" is generated in the player's own audio clock, so every clap time is known exactly.
// Usage: node tests/clap.test.mjs <outDir>
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
const results = []; const check = (n, ok, info = '') => {  results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${info ? '  — ' + info : ''}`); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-clap-'));
const srv = spawn(process.execPath, [path.join(here, 'lumina-dev-server.mjs'), '8872'], { env: { ...process.env, LUMINA_FS_DIR: lib, LUMINA_STUDIO_PASSWORD: 'x' }, stdio: 'pipe' });
process.on('exit', () => { try { srv.kill(); } catch { /* ignore */ } });
await new Promise(r => srv.stdout.on('data', d => String(d).includes('dev server') && r()));
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const stats = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return { mean: m, sd: Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length), worst: Math.max(...a.map(Math.abs)) }; };
const nearest = (t, list) => list.reduce((b, k) => Math.abs(k - t) < Math.abs(b - t) ? k : b, list[0]);
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    const AC = window.AudioContext; window.AudioContext = function (...a) { const c = new AC(...a); window.__ctx = c; return c; }; window.AudioContext.prototype = AC.prototype;
    navigator.mediaDevices.getUserMedia = async () => {
      const c = window.__ctx, md = c.createMediaStreamDestination();
      const noise = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const burst = (t, f, q, type, peak, decay) => {
        const s = c.createBufferSource(); s.buffer = noise; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
        const g = c.createGain(); g.gain.value = 0.0001; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
        s.connect(fl).connect(g).connect(md); s.start(t, Math.random() * 0.5); s.stop(t + decay + 0.02);
      };
      window.__claps = []; window.__snaps = [];
      window.__clap = (t, v = 0.8) => { burst(t, 1400, 1.2, 'bandpass', v, 0.07); burst(t + 0.008, 1800, 1, 'bandpass', v * 0.5, 0.05); window.__claps.push(t); };
      window.__snap = (t, v = 0.35) => { burst(t, 3000, 0.8, 'highpass', v, 0.025); window.__snaps.push(t); };
      // a room that is not silent: a steady hum and a slow pad swelling in and out — these must NOT flash
      window.__ambience = (from, secs) => {
        const o = c.createOscillator(), g = c.createGain(); g.gain.value = 0.0001; o.frequency.value = 220; g.gain.setValueAtTime(0.0001, from); g.gain.linearRampToValueAtTime(0.04, from + 0.8); o.connect(g).connect(md); o.start(from); o.stop(from + secs);
        const p = c.createOscillator(), pg = c.createGain(); pg.gain.value = 0.0001; p.type = 'sawtooth'; p.frequency.value = 330; pg.gain.setValueAtTime(0.0001, from);
        for (let k = 0; k + 2 <= secs; k += 2) { pg.gain.linearRampToValueAtTime(0.06, from + k + 1); pg.gain.linearRampToValueAtTime(0.0001, from + k + 2); }
        // everything fades out before it stops (a hard stop is a real click, and the room would rightly flash)
        g.gain.setValueAtTime(0.04, from + secs - 0.8); g.gain.linearRampToValueAtTime(0.0001, from + secs);
        p.connect(pg).connect(md); p.start(from); p.stop(from + secs);
        const s = c.createBufferSource(); s.buffer = noise; s.loop = true; const ng = c.createGain(); ng.gain.value = 0.0001; ng.gain.setValueAtTime(0.0001, from); ng.gain.linearRampToValueAtTime(0.01, from + 0.8); ng.gain.setValueAtTime(0.01, from + secs - 0.8); ng.gain.linearRampToValueAtTime(0.0001, from + secs); s.connect(ng).connect(md); s.start(from); s.stop(from + secs);
      };
      // a pure tone burst: a thump (low) or a knock (mid)
      window.__tone = (t, f, v, d) => { const o = c.createOscillator(), g = c.createGain(); g.gain.value = 0.0001; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(md); o.start(t); o.stop(t + d + 0.02); };
      // music from another speaker: kick on the beat, hi-hat on the off-beat
      window.__band = (bpm, from, secs, laptop) => {
        const per = 60 / bpm; let out = md;
        if (laptop) { const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 200; const g0 = c.createGain(); g0.gain.value = 0.03; hp.connect(g0).connect(md); out = hp; } // a laptop mic, music at background level
        const md0 = md; { const md = out;
        for (let t = from; t < from + secs; t += per) {
          const o = c.createOscillator(), g = c.createGain(); g.gain.value = 0.0001;
          o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
          o.connect(g).connect(md); o.start(t); o.stop(t + 0.4);
          { const s2 = c.createBufferSource(); s2.buffer = noise; const f2 = c.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 7000; const g2 = c.createGain(); g2.gain.value = 0.0001; const th = t + per / 2; g2.gain.setValueAtTime(0.0001, th); g2.gain.linearRampToValueAtTime(0.3, th + 0.001); g2.gain.exponentialRampToValueAtTime(0.0001, th + 0.04); s2.connect(f2).connect(g2).connect(md); s2.start(th); s2.stop(th + 0.06); }
          window.__kicks = (window.__kicks || []).concat(t);
        }
      } };
      return md.stream;
    };
  });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => m.type() === 'error' && console.error('console:', m.text()));
  await page.goto('http://localhost:8872/gallery.html', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__lumina && document.querySelectorAll('.screen').length);
  await page.click('#openSettings'); await page.click('.lw-mode[data-mode=party]'); await page.click('#closeSettings');
  await page.click('#playBtn'); await page.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 });
  await page.evaluate(() => document.getElementById('musicBtn').click()); // no music at all
  await page.evaluate(() => document.querySelector('#fxBtn').click()); await page.waitForSelector('#settings:not([hidden])');
  await page.click('#interactToggles [data-opt=listen]'); await wait(800); await page.click('#closeSettings');
  const before = await page.evaluate(() => window.__lumina.state.hits);
  // 1. ambience only, 5 s: nothing should flash
  const ambAt = await page.evaluate(() => { const t = window.__ctx.currentTime + 0.5; window.__ambience(t, 5); return t; }); await wait(6000);
  const amb = await page.evaluate(() => window.__lumina.state.hits);
  if (amb.count !== before.count) console.error('DEBUG false hits at', amb.times.slice(-(amb.count - before.count)), 'ambience', ambAt, 'to', ambAt + 5);
  check('a hum, a swelling pad and room hiss do not set it off', amb.count === before.count, `${amb.count - before.count} false hits`);
  // 2. scattered claps, irregular, over quiet ambience
  const gaps = [0.37, 1.13, 0.52, 1.71, 0.66, 0.93, 0.41, 1.29, 0.58, 0.84]; // irregular, like someone testing the room
  await page.evaluate((gaps) => { let t = window.__ctx.currentTime + 0.6; window.__ambience(t - 0.3, 12); for (const g of gaps) { t += g; window.__clap(t, 0.5 + Math.random() * 0.4); } }, gaps);
  await wait(10500);
  const c1 = await page.evaluate(() => ({ hits: window.__lumina.state.hits, claps: window.__claps.slice() }));
  const got = c1.hits.count - amb.count;
  const err1 = stats(c1.hits.times.slice(-got).map(t => t - nearest(t, c1.claps)));
  check('every clap is heard, once (no misses, no doubles)', got === gaps.length, `${got}/${gaps.length}`);
  if (got !== gaps.length) console.error('hits', c1.hits.times.slice(-got).map(t => t.toFixed(3)).join(' '), '\nclaps', c1.claps.map(t => t.toFixed(3)).join(' '));
  check('…and timed precisely', err1.worst <= 0.012, `mean ${(err1.mean * 1000).toFixed(1)} ms, worst ${(err1.worst * 1000).toFixed(1)} ms`);
  check('each one flashes the lasers', c1.hits.flashes - amb.flashes === c1.hits.count - amb.count, `${c1.hits.flashes - amb.flashes} flashes for ${c1.hits.count - amb.count} hits`);
  // flash latency: frames from the moment the clap is heard to the light on screen (and, for information, the audio-clock time)
  const lat = await page.evaluate(async () => {
    const c = window.__ctx, t = c.currentTime + 0.25, h0 = window.__lumina.state.hits.count, f0 = window.__lumina.state.hits.flashes; window.__clap(t, 0.8);
    let frames = -1; const lim = performance.now() + 3000;
    while (window.__lumina.state.hits.flashes === f0 && performance.now() < lim) { await new Promise(r => requestAnimationFrame(r)); if (frames >= 0 || window.__lumina.state.hits.count !== h0) frames++; }
    return { frames, ms: (c.currentTime - t) * 1000 };
  });
  check('the light answers the instant a clap is heard (same or next frame)', lat.frames >= 0 && lat.frames <= 1, `${lat.frames} frame(s); ${lat.ms.toFixed(0)} ms on this headless machine's audio clock incl. its fake-mic buffering`);
  // 3. finger snaps: quieter and brighter
  await page.evaluate(() => { let t = window.__ctx.currentTime + 0.3; for (const g of [0.4, 0.7, 0.55, 0.9, 0.5, 0.8]) { t += g; window.__snap(t); } });
  await wait(4500);
  const sn = await page.evaluate(() => ({ hits: window.__lumina.state.hits, snaps: window.__snaps.slice() }));
  const gotS = sn.hits.count - c1.hits.count - 1;
  const errS = stats(sn.hits.times.slice(-Math.max(1, gotS)).map(t => t - nearest(t, sn.snaps)));
  check('finger snaps are heard too', gotS === 6 && errS.worst <= 0.012, `${gotS}/6, worst ${(errS.worst * 1000).toFixed(1)} ms`);
  // 4. clapping in time (100 BPM, 12 s) with no music: the claps become the beat and the light locks to them
  const t0 = await page.evaluate(() => { const t = window.__ctx.currentTime + 0.3; for (let k = 0; k < 20; k++) window.__clap(t + k * 0.6, 0.6 + Math.random() * 0.3); return t; });
  await wait(12500);
  const lk = await page.evaluate(() => ({ lock: window.__lumina.state.lock, claps: window.__claps.slice(), mode: window.__lumina.state.laserMode }));
  const rhythm = lk.claps.filter(t => t >= t0 - 0.01);
  const em = lk.lock.emitted.filter(t => t > t0 + 4 && t < t0 + 11.5);
  const ve = stats(em.map(t => t - nearest(t, rhythm)));
  check('claps in time lock the tempo (100 BPM)', Math.abs((lk.lock.bpm || 0) - 100) < 1.5, `bpm ${lk.lock.bpm}`);
  check('…and the light lands on the claps', em.length >= 8 && ve.worst <= 0.025, `mean ${(ve.mean * 1000).toFixed(1)} ms, worst ${(ve.worst * 1000).toFixed(1)} ms over ${em.length} beats`);
  await page.screenshot({ path: `${out}/clap.png` });
  // 5. low and mid sounds flash too: a thump on the table (low), a knock on wood (mid)
  await wait(3500); // the clapping lock lets go
  const f5 = await page.evaluate(() => window.__lumina.state.hits);
  await page.evaluate(() => { let t = window.__ctx.currentTime + 0.4; for (let i = 0; i < 4; i++) { window.__tone(t, 70, 0.9, 0.12); t += 0.7; window.__tone(t, 520, 0.6, 0.05); t += 0.8; } });
  await wait(6800);
  const s5 = await page.evaluate(() => window.__lumina.state.hits);
  check('low thumps and mid knocks flash as well (any frequency)', s5.count - f5.count === 8 && s5.flashes - f5.flashes === 8, `${s5.count - f5.count}/8 heard, ${s5.flashes - f5.flashes} flashes`);
  // 6. music from another speaker (kick + hi-hat): every kick and hi-hat flashes, and the lock follows the beat
  await wait(3000);
  const f6 = await page.evaluate(() => window.__lumina.state.hits);
  await page.evaluate(() => window.__band(124, window.__ctx.currentTime + 0.4, 8)); await wait(8800);
  const s6 = await page.evaluate(() => ({ hits: window.__lumina.state.hits, lock: window.__lumina.state.lock, mode: window.__lumina.state.laserMode }));
  check('room music: kicks and hi-hats flash, and the light locks to the beat', s6.hits.flashes - f6.flashes >= 28 && Math.abs(s6.lock.bpm - 124) < 1.5 && s6.mode === 'room', `${s6.hits.flashes - f6.flashes} flashes for 33 sounds; bpm ${s6.lock.bpm}, lasers ${s6.mode}`);
  // 7. a laptop mic with little bass, music at background level: the light locks to the kick, not the off-beat hi-hat
  await wait(4000);
  const t7 = await page.evaluate(() => { window.__kicks = []; const t = window.__ctx.currentTime + 0.4; window.__band(124, t, 10, true); return t; });
  await wait(10500);
  const s7 = await page.evaluate(() => ({ lock: window.__lumina.state.lock, kicks: window.__kicks }));
  const em7 = s7.lock.emitted.filter(t => t > t7 + 4 && t < t7 + 10);
  const v7 = em7.length ? stats(em7.map(t => t - nearest(t, s7.kicks))) : { worst: 9, mean: 9 };
  check('a laptop mic with quiet music locks on the kick (not half a beat off)', Math.abs(s7.lock.bpm - 124) < 1.5 && v7.worst <= 0.03, `bpm ${s7.lock.bpm}, worst ${(v7.worst * 1000).toFixed(1)} ms over ${em7.length} beats`);
  // 8. sound reaction off and on again: claps still flash
  await page.evaluate(() => document.querySelector('#fxBtn').click()); await page.waitForSelector('#settings:not([hidden])');
  await page.click('#interactToggles [data-opt=listen]'); await wait(500); await page.click('#interactToggles [data-opt=listen]'); await wait(1200); await page.click('#closeSettings');
  const f8 = await page.evaluate(() => window.__lumina.state.hits);
  await page.evaluate(() => { let t = window.__ctx.currentTime + 0.4; for (const g of [0, 0.55, 0.7, 0.45]) { t += g; window.__clap(t); } });
  await wait(3000);
  const s8 = await page.evaluate(() => window.__lumina.state.hits);
  check('after turning sound reaction off and on, every clap still flashes', s8.count - f8.count === 4 && s8.flashes - f8.flashes === 4, `${s8.count - f8.count} heard, ${s8.flashes - f8.flashes} flashes`);
  check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { check('scenario crashed', false, String(e).split('\n').slice(0, 4).join(' / ')); }
await browser.close(); srv.kill(); fs.rmSync(lib, { recursive: true, force: true });
const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} checks passed`); process.exit(f ? 1 : 0);
