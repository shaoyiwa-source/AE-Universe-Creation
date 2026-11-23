// AE Shinity — adjust while watching: settings opened during a presentation never cover or dim the painting.
// Usage: node tests/tuning.test.mjs <desktop|phone> <outDir>
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
const port = phone ? 8822 : 8821;
const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-tune-'));
const srv = spawn(process.execPath, [path.join(here, 'lumina-dev-server.mjs'), String(port)], { env: { ...process.env, LUMINA_FS_DIR: lib, LUMINA_STUDIO_PASSWORD: 'x' }, stdio: 'pipe' });
process.on('exit', () => { try { srv.kill(); } catch { /* ignore */ } });
await new Promise(r => srv.stdout.on('data', d => String(d).includes('dev server') && r()));
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`http://localhost:${port}/gallery.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__lumina && document.querySelectorAll('.screen').length > 0);
  await page.click('#playBtn'); await page.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 });
  await page.evaluate(() => { window.__lumina.state.settings.interval = 120; });
  await wait(600);
  const artRect = () => page.evaluate(() => { const s = window.__lumina.state, m = document.querySelectorAll('.pl-slide')[s.cur].querySelector('img'), b = m.getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width }; });
  const full = await artRect();
  await page.evaluate(() => document.querySelector('#fxBtn').click());
  await page.waitForSelector('#settings:not([hidden])'); await wait(700);
  const a = await artRect();
  const sh = await page.evaluate(() => { const b = document.getElementById('settings').getBoundingClientRect(); return { x: b.x, y: b.y }; });
  const free = phone ? a.b <= sh.y + 1 && a.y >= -1 : a.r <= sh.x + 1;
  await page.screenshot({ path: `${out}/${which}-tuning.png` });
  check(`[${which}] the whole painting stays in view beside the settings`, free, JSON.stringify({ art: a, sheet: sh }));
  const scrim = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('scrim')); return { bg: c.backgroundColor, pe: c.pointerEvents }; });
  check(`[${which}] the painting is not dimmed`, /rgba\(0, 0, 0, 0\)|transparent/.test(scrim.bg) && scrim.pe === 'none', JSON.stringify(scrim));
  // a mode change shows at once
  await page.click('.lw-mode[data-mode=party]'); await wait(500);
  const st1 = await page.evaluate(() => ({ mode: window.__lumina.state.settings.mode, neon: document.getElementById('neon').classList.contains('on') }));
  check(`[${which}] changing the scene shows immediately (Night Party neon)`, st1.mode === 'party' && st1.neon, JSON.stringify(st1));
  // a transition chosen while watching is shown right away on the next work
  const i0 = await page.evaluate(() => window.__lumina.state.idx);
  await page.locator('#transitionChips .lw-chip').nth(2).click();
  await page.waitForFunction((k) => window.__lumina.state.idx !== k, i0, { timeout: 8000 }).catch(() => {});
  check(`[${which}] picking a transition plays it on the next work`, (await page.evaluate(() => window.__lumina.state.idx)) !== i0);
  await page.waitForFunction(() => !window.__lumina.state.busy, null, { timeout: 15000 });
  // the painting still answers touch while the settings are open
  await page.click('.lw-mode[data-mode=residence]'); await wait(800);
  const b = await artRect();
  const before = await page.evaluate(() => window.__lumina.state.blooms + window.__lumina.state.alive.stats.spawned);
  await page.mouse.click((b.x + b.r) / 2, (b.y + b.b) / 2); await wait(250);
  const after = await page.evaluate(() => window.__lumina.state.blooms + window.__lumina.state.alive.stats.spawned);
  check(`[${which}] the painting can be touched while adjusting`, after > before && !(await page.isHidden('#settings')), `${before} → ${after}`);
  await page.click('#closeSettings'); await wait(700);
  const back = await artRect();
  check(`[${which}] closing the settings gives the painting the full screen again`, Math.abs(back.w - full.w) < 2 || back.w > a.w, `${a.w.toFixed(0)} → ${back.w.toFixed(0)} px`);
  check(`[${which}] no page errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { check(`[${which}] scenario crashed`, false, String(e).split('\n').slice(0, 4).join(' / ')); }
await browser.close(); srv.kill(); fs.rmSync(lib, { recursive: true, force: true });
const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} checks passed`); process.exit(f ? 1 : 0);
