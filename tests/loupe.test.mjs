// AE Shinity — R9.1: long-press magnifier + no system image menu. Usage: node tests/loupe.test.mjs <desktop|phone> <outDir>
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
const port = phone ? 8802 : 8801;
const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'shinity-lp-'));
const srv = spawn(process.execPath, [path.join(here, 'shinity-dev-server.mjs'), String(port)], { env: { ...process.env, SHINITY_FS_DIR: lib, SHINITY_STUDIO_PASSWORD: 'x' }, stdio: 'pipe' });
process.on('exit', () => { try { srv.kill(); } catch { /* ignore */ } });
await new Promise(r => srv.stdout.on('data', d => String(d).includes('dev server') && r()));
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`http://localhost:${port}/gallery.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__shinity && document.querySelectorAll('.screen').length > 0);
  const css = await (await fetch(`http://localhost:${port}/gallery/gallery.css`)).text();
  check(`[${which}] iOS long-press image menu is turned off (touch-callout)`, /img,video\{-webkit-touch-callout:none\}/.test(css));
  check(`[${which}] wall images never receive a touch (nothing to save)`, await page.evaluate(() => getComputedStyle(document.querySelector('.screen img')).pointerEvents === 'none'));
  // the magnifier lives where the painting is not "alive"; switch the living painting off to test it anywhere
  await page.click('#openSettings'); await page.waitForSelector('#settings:not([hidden])');
  if ((await page.getAttribute('#interactToggles [data-opt=alive]', 'aria-checked')) === 'true') await page.click('#interactToggles [data-opt=alive]');
  await page.click('#closeSettings');
  await page.click('#playBtn'); await page.waitForFunction(() => window.__shinity.state.shown, null, { timeout: 30000 });
  await wait(1200);
  const art = await page.evaluate(() => { const s = window.__shinity.state, el = document.querySelectorAll('.pl-slide')[s.cur].querySelector('img'); return { x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: parseFloat(el.style.width), h: parseFloat(el.style.height), pe: getComputedStyle(el).pointerEvents }; });
  const hitTop = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y).tagName, { x: art.x + art.w / 2, y: art.y + art.h / 2 });
  check(`[${which}] artwork never receives a touch (nothing to save)`, art.pe === 'none' && hitTop !== 'IMG', hitTop);
  const cm = await page.evaluate(() => { const el = document.querySelector('.pl-slide img'); const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); el.dispatchEvent(ev); return ev.defaultPrevented; });
  check(`[${which}] right-click / long-press menu is suppressed`, cm);
  const cx = art.x + art.w * 0.5, cy = art.y + art.h * 0.55;
  const t0 = await page.evaluate(() => window.__shinity.state.idx);
  // a short tap does not open the lens
  await page.mouse.move(cx, cy); await page.mouse.down(); await wait(150); await page.mouse.up(); await wait(300);
  check(`[${which}] a short tap does not open the magnifier`, await page.evaluate(() => document.getElementById('loupe').hidden));
  // long-press opens it
  await page.mouse.move(cx, cy); await page.mouse.down(); await wait(700);
  const on = await page.evaluate(() => { const l = document.getElementById('loupe'); return !l.hidden && l.classList.contains('on'); });
  check(`[${which}] long-press opens the magnifier`, on);
  const pos = async () => page.evaluate(() => { const l = document.getElementById('loupe'), i = l.querySelector('img'); return { l: l.getBoundingClientRect().toJSON(), t: i.style.transform, src: !!i.currentSrc }; });
  const a = await pos();
  await page.screenshot({ path: `${out}/${which}-loupe-1.png` });
  // drag: lens follows, shows a different part of the work
  for (let k = 1; k <= 10; k++) { await page.mouse.move(cx + k * 9, cy - k * 7); await wait(30); }
  await wait(200);
  const b = await pos();
  await page.screenshot({ path: `${out}/${which}-loupe-2.png` });
  check(`[${which}] dragging moves the lens and its view`, Math.abs(b.l.x - a.l.x) > 40 && a.t !== b.t && a.src, `${a.t} → ${b.t}`);
  check(`[${which}] lens stays on screen`, b.l.x >= 0 && b.l.y >= 0 && b.l.right <= page.viewportSize().width && b.l.bottom <= page.viewportSize().height);
  // moving the finger up towards the top: the lens follows continuously, never jumps to the other side
  const ys = [];
  for (let k = 0; k <= 30; k++) { const yy = cy - (cy - art.y - 4) * k / 30; await page.mouse.move(cx, yy); await wait(25); ys.push({ f: yy, l: (await pos()).l.y }); }
  let jump = 0; for (let k = 1; k < ys.length; k++) jump = Math.max(jump, Math.abs(ys[k].l - ys[k - 1].l));
  const stepF = (cy - art.y) / 30;
  check(`[${which}] the lens moves smoothly to the top edge (no jump)`, jump <= stepF * 1.6 + 1 && ys.every(p => p.l <= p.f + 1), `largest jump ${jump.toFixed(1)} px for a ${stepF.toFixed(1)} px finger step`);
  check(`[${which}] the lens marks the exact point under the finger`, await page.evaluate(() => getComputedStyle(document.getElementById('loupe'), '::before').content !== 'none'));
  // the slide does not change while looking closely, even past its time
  await page.evaluate(() => { window.__shinity.state; });
  await wait(1500);
  await page.mouse.up(); await wait(400);
  check(`[${which}] releasing closes the magnifier and does not turn the page`, await page.evaluate(() => document.getElementById('loupe').hidden) && (await page.evaluate(() => window.__shinity.state.idx)) === t0);
  // a swipe still turns the page (no lens)
  await page.mouse.move(art.x + art.w * 0.8, cy); await page.mouse.down();
  for (let k = 1; k <= 8; k++) { await page.mouse.move(art.x + art.w * 0.8 - k * 30, cy); await wait(20); }
  await page.mouse.up(); await wait(2500);
  check(`[${which}] a swipe still turns the page`, (await page.evaluate(() => window.__shinity.state.idx)) !== t0 && await page.evaluate(() => document.getElementById('loupe').hidden));
  check(`[${which}] no page errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { check(`[${which}] scenario crashed`, false, String(e).split('\n').slice(0, 4).join(' / ')); }
await browser.close(); srv.kill(); fs.rmSync(lib, { recursive: true, force: true });
const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} checks passed`); process.exit(f ? 1 : 0);
