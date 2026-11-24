// AE Shinity — music keeps playing: resumes after an interruption, no pile-up of missed phrases, gentle start.
// Usage: node tests/music.test.mjs <desktop|phone> <outDir>
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
const results = []; const check = (n, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${info ? '  — ' + info : ''}`); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const phone = which === 'phone';
const ctxOpts = phone ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 800 } };
const port = phone ? 8832 : 8831;
const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'shinity-music-'));
const srv = spawn(process.execPath, [path.join(here, 'shinity-dev-server.mjs'), String(port)], { env: { ...process.env, SHINITY_FS_DIR: lib, SHINITY_STUDIO_PASSWORD: 'x' }, stdio: 'pipe' });
process.on('exit', () => { try { srv.kill(); } catch { /* ignore */ } });
await new Promise(r => srv.stdout.on('data', d => String(d).includes('dev server') && r()));
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext(ctxOpts);
  // count every note the music starts, with the audio clock time it is scheduled for
  await ctx.addInitScript(() => {
    window.__notes = [];
    const os = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (when) { window.__notes.push({ at: when || this.context.currentTime, now: this.context.currentTime, wall: performance.now() }); return os.apply(this, arguments); };
    const AC = window.AudioContext; window.AudioContext = function (...a) { const c = new AC(...a); window.__ctx = c; return c; }; window.AudioContext.prototype = AC.prototype;
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`http://localhost:${port}/gallery.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__shinity && document.querySelectorAll('.screen').length > 0);
  await page.click('#openSettings'); await page.click('.lw-mode[data-mode=residence]'); await page.click('#closeSettings');
  check(`[${which}] Residence plays its own music (Warm Home)`, (await page.evaluate(() => window.__shinity.state.settings.music)) === 'hearth');
  await page.click('#playBtn'); await page.waitForFunction(() => window.__ctx && window.__ctx.state === 'running', null, { timeout: 10000 });
  const t0 = await page.evaluate(() => window.__ctx.currentTime);
  await wait(1200);
  const early = await page.evaluate((t0) => window.__notes.filter(n => n.at < t0 + 2.4 && n.at >= t0).length, t0);
  await wait(3000);
  const later = await page.evaluate((t0) => window.__notes.filter(n => n.at >= t0 + 2.4 && n.at < t0 + 4).length, t0);
  check(`[${which}] gentle start: only the warm floor first, the first chord after it has bloomed`, early <= 10 && later >= 8, `oscillators in first 2.4 s: ${early} (warm floor), next 1.6 s: ${later} (first chord)`);
  // switching to another app for 20 s: the page is hidden, the audio paused
  await page.evaluate(() => { window.__hidden = true; Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hidden }); document.dispatchEvent(new Event('visibilitychange')); });
  await wait(500);
  const before = await page.evaluate(() => window.__notes.length);
  await wait(20000);
  const during = (await page.evaluate(() => window.__notes.length)) - before;
  check(`[${which}] while away, missed phrases are not piled up`, during <= 6, `${during} notes queued while away`);
  await page.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => window.__ctx.state === 'running', null, { timeout: 6000 }).catch(() => {});
  const back = await page.evaluate(() => window.__ctx.currentTime);
  check(`[${which}] coming back, the music resumes by itself`, (await page.evaluate(() => window.__ctx.state)) === 'running');
  await wait(1500);
  const burst = await page.evaluate((b) => window.__notes.filter(n => n.at >= b - 0.2 && n.at < b + 1).length, back);
  check(`[${which}] no burst of stacked chords on return`, burst <= 40, `${burst} oscillators in the first second (one chord ≈ 14–22; stacked bars would be 40+)`);
  // an interruption while on screen (a call or notification on iPhone): resumes within a few seconds
  await page.evaluate(() => window.__ctx.suspend());
  await page.waitForFunction(() => window.__ctx.state === 'running', null, { timeout: 6000 }).catch(() => {});
  check(`[${which}] an interruption on screen is recovered automatically`, (await page.evaluate(() => window.__ctx.state)) === 'running');
  const n1 = await page.evaluate(() => window.__notes.length); await wait(10000);
  const n2 = await page.evaluate(() => window.__notes.length);
  check(`[${which}] and keeps playing`, n2 - n1 >= 6, `${n2 - n1} notes in 10 s`);
  // two minutes later it is still playing (no silent stop)
  await page.evaluate(() => { window.__shinity.state.settings.interval = 6; });
  await wait(60000);
  const n3 = await page.evaluate(() => window.__notes.length); await wait(12000);
  const n4 = await page.evaluate(() => window.__notes.length);
  check(`[${which}] still playing after more than a minute and several works`, n4 - n3 >= 6 && (await page.evaluate(() => window.__ctx.state)) === 'running', `${n4 - n3} notes in 12 s`);
  check(`[${which}] no page errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { check(`[${which}] scenario crashed`, false, String(e).split('\n').slice(0, 4).join(' / ')); }
await browser.close(); srv.kill(); fs.rmSync(lib, { recursive: true, force: true });
const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} checks passed`); process.exit(f ? 1 : 0);
