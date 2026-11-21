// AE Lumina Wall — R8 acceptance: stability items + sound reaction (fake microphone fed with a generated sound file).
// Usage: node tests/r8.test.mjs <desktop|phone> <outDir>
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
const phone = which === 'phone';
const ctxOpts = phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const port = phone ? 8786 : 8785;

// ---- a 14 s test recording: silence, claps, a sung vowel, music with a kick drum ----
function makeWav(file) {
  const sr = 48000, secs = 14, n = sr * secs, d = new Float32Array(n);
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    if (t >= 1.5 && t < 4.5) { // claps every 0.45 s
      const k = (t - 1.5) % 0.45; if (k < 0.04) d[i] += rnd() * 0.9 * Math.exp(-k * 90);
    } else if (t >= 4.5 && t < 8.5) { // vowel 'ah': 180 Hz with harmonics shaped by formants ~700 / 1200 Hz
      const f0 = 180 * (1 + 0.01 * Math.sin(2 * Math.PI * 5 * t)); let v = 0;
      for (let h = 1; h <= 14; h++) { const f = f0 * h; const a = Math.exp(-Math.pow((f - 700) / 260, 2)) + 0.7 * Math.exp(-Math.pow((f - 1200) / 300, 2)) + 0.25 / h; v += a * Math.sin(2 * Math.PI * f * t); }
      d[i] += v * 0.16 * (0.75 + 0.25 * Math.sin(2 * Math.PI * 1.2 * t));
    } else if (t >= 8.5) { // music: C-E-G chord + kick on every 0.5 s + soft hat
      d[i] += 0.07 * (Math.sin(2 * Math.PI * 261.6 * t) + Math.sin(2 * Math.PI * 329.6 * t) + Math.sin(2 * Math.PI * 392 * t) + 0.6 * Math.sin(2 * Math.PI * 523.3 * t));
      const k = (t - 8.5) % 0.5; d[i] += 0.85 * Math.sin(2 * Math.PI * (45 + 110 * Math.exp(-k * 30)) * k) * Math.exp(-k * 9);
      const hk = (t - 8.75) % 0.5; if (hk >= 0 && hk < 0.03) d[i] += rnd() * 0.12 * Math.exp(-hk * 120);
    }
  }
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(d[i] * 32767))), 44 + i * 2);
  fs.writeFileSync(file, buf);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-r8-'));
const wav = path.join(dir, 'mic.wav'); makeWav(wav);
const srv = spawn(process.execPath, [path.join(here, 'lumina-dev-server.mjs'), String(port)], { env: { ...process.env, LUMINA_FS_DIR: path.join(dir, 'lib'), LUMINA_STUDIO_PASSWORD: 'x-' + Date.now() }, stdio: 'pipe' });
fs.mkdirSync(path.join(dir, 'lib'));
process.on('exit', () => { try { srv.kill(); } catch { /* ignore */ } });
await new Promise((res, rej) => { srv.stdout.on('data', d => String(d).includes('dev server') && res()); srv.on('exit', c => rej(new Error('server exited ' + c))); });
const base = `http://localhost:${port}/gallery.html`;

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`] });
try {
  const ctx = await browser.newContext({ ...ctxOpts, permissions: ['microphone'] });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__lumina && document.querySelectorAll('.screen').length > 0);
  const ui = async (sel) => { const v = page.viewportSize(); await page.mouse.move(v.width * 0.5, v.height * 0.25); await wait(150); await page.click(sel); };
  const st = () => page.evaluate(() => window.__lumina.state);

  // lasers belong to Night Party only
  await page.click('#openSettings'); await page.waitForSelector('#settings:not([hidden])');
  await page.click('.lw-mode[data-mode=online]');
  const lasersOnline = await page.locator('#effectToggles [data-opt=lasers]').count();
  await page.click('.lw-mode[data-mode=party]');
  const lasersParty = await page.locator('#effectToggles [data-opt=lasers]').count();
  check(`[${which}] lasers only offered in Night Party`, lasersOnline === 0 && lasersParty === 1, `${lasersOnline}/${lasersParty}`);
  await page.click('.lw-mode[data-mode=residence]'); // camera drift on: used for the no-crop check
  // sound reaction is off by default; switching it on asks for the microphone
  check(`[${which}] sound reaction off by default`, (await page.getAttribute('#interactToggles [data-opt=listen]', 'aria-checked')) === 'false');
  await page.click('#interactToggles [data-opt=listen]');
  await page.waitForFunction(() => document.querySelector('#interactToggles [data-opt=listen]').getAttribute('aria-checked') === 'true', null, { timeout: 8000 }).catch(() => {});
  check(`[${which}] sound reaction switches on after microphone permission`, (await page.getAttribute('#interactToggles [data-opt=listen]', 'aria-checked')) === 'true');
  await page.screenshot({ path: `${out}/${which}-r8-settings.png` });
  await page.click('#closeSettings');

  await page.click('#playBtn');
  await page.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 20000 });
  check(`[${which}] listening indicator shows in the player`, await page.isVisible('#micDot'));
  // never crop: sample the camera drift — the drawn artwork never exceeds its fitted frame
  let crop = 0;
  for (let k = 0; k < 8; k++) {
    crop = Math.max(crop, await page.evaluate(() => {
      const s = window.__lumina.state, img = document.querySelectorAll('.pl-slide')[s.cur].querySelector('img');
      const b = img.getBoundingClientRect(); return Math.max(0, b.width - parseFloat(img.style.width), b.height - parseFloat(img.style.height));
    }));
    await wait(400);
  }
  check(`[${which}] camera drift never crops the work (handwriting stays in frame)`, crop <= 1, `overflow ${crop.toFixed(1)} px`);
  // the bilingual note only opens on demand
  check(`[${which}] statement does not pop up by itself`, (await page.textContent('#capStatement')) === '' && !(await page.isVisible('#plInfo')));
  await ui('#infoBtn');
  await page.waitForSelector('#plInfo:not([hidden])');
  check(`[${which}] ⓘ opens the bilingual note`, (await page.textContent('#infoTitle')).length > 0);
  await page.screenshot({ path: `${out}/${which}-r8-info.png` });
  await page.click('#infoClose');
  // intensity
  await ui('#fxBtn');
  await page.locator('#intensity').fill('1');
  const o1 = await page.evaluate(() => document.getElementById('fx').style.opacity);
  await page.locator('#intensity').fill('5');
  const o5 = await page.evaluate(() => document.getElementById('fx').style.opacity);
  check(`[${which}] light intensity 1–5 (lowest still visible, highest capped)`, +o1 >= 0.5 && +o1 < +o5 && +o5 <= 1, `${o1} → ${o5}`);
  await page.locator('#intensity').fill('3');
  await page.click('#closeSettings');

  // sound reaction: let the fake microphone play claps → voice → music
  await wait(16000);
  const ss = (await st()).soundStats;
  await page.screenshot({ path: `${out}/${which}-r8-sound.png` });
  check(`[${which}] claps → gold bursts`, ss.claps >= 2 && ss.bursts >= 2, JSON.stringify(ss));
  check(`[${which}] voice → inner light rises`, ss.voice > 120, `voice frames ${ss.voice}`);
  check(`[${which}] music → gold halo on the beat`, ss.music > 120 && ss.beats >= 4, `music frames ${ss.music}, beats ${ss.beats}`);
  check(`[${which}] five-tier intensity reached ≥ 3`, ss.maxTier >= 3, `max tier ${ss.maxTier}`);
  await page.keyboard.press('Escape'); await wait(300); await page.keyboard.press('Escape'); await wait(400);
  check(`[${which}] microphone stops when the player closes`, !(await st()).listen);

  // low-power: throttle the CPU and expect the player to lighten itself
  await page.click('#playBtn');
  await page.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 20000 });
  // a healthy device must not be downgraded; ~20 fps for 4 s must trigger the lighter quality
  await page.evaluate(() => window.__lumina.simulateFps(58, 6));
  const stayed = !(await st()).lowPower;
  await page.evaluate(() => window.__lumina.simulateFps(20, 4.5));
  check(`[${which}] a smooth device keeps full quality`, stayed);
  check(`[${which}] slow device switches to lighter quality automatically`, (await st()).lowPower && await page.evaluate(() => document.getElementById('player').classList.contains('lowpower')));
  check(`[${which}] no console errors`, errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
} catch (e) {
  check(`[${which}] scenario crashed`, false, String(e).split('\n').slice(0, 6).join(' / '));
}
await browser.close();

// microphone refused: the toggle stays off and the visitor is told why
const b2 = await chromium.launch();
try {
  const c2 = await b2.newContext(ctxOpts); const p2 = await c2.newPage();
  await p2.goto(base, { waitUntil: 'networkidle' }); await p2.waitForFunction(() => window.__lumina);
  await p2.click('#openSettings'); await p2.waitForSelector('#settings:not([hidden])');
  await p2.click('#interactToggles [data-opt=listen]'); await wait(1500);
  check(`[${which}] refused microphone: stays off with a clear message`, (await p2.getAttribute('#interactToggles [data-opt=listen]', 'aria-checked')) === 'false' && (await p2.isVisible('#toast')));
} catch (e) { check(`[${which}] deny scenario crashed`, false, String(e).split('\n')[0]); }
await b2.close();
srv.kill();
fs.rmSync(dir, { recursive: true, force: true });
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
