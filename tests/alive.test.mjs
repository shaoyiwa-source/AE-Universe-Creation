// AE Lumina Wall — R10 step 1 "Living painting" (v2: light is added around the work; the painting itself is never altered).
// Usage: node tests/alive.test.mjs <desktop|phone> <outDir>
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
const port = phone ? 8812 : 8811;
const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-alive-'));
const srv = spawn(process.execPath, [path.join(here, 'lumina-dev-server.mjs'), String(port)], { env: { ...process.env, LUMINA_FS_DIR: lib, LUMINA_STUDIO_PASSWORD: 'x' }, stdio: 'pipe' });
process.on('exit', () => { try { srv.kill(); } catch { /* ignore */ } });
await new Promise(r => srv.stdout.on('data', d => String(d).includes('dev server') && r()));
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--enable-unsafe-swiftshader'] });
try {
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://localhost:${port}/gallery.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__lumina && document.querySelectorAll('.screen').length > 0);
  const st = () => page.evaluate(() => window.__lumina.state);
  // Art Museum stays still
  await page.click('#openSettings'); await page.waitForSelector('#settings:not([hidden])');
  await page.click('.lw-mode[data-mode=gallery]');
  const galleryOff = (await page.getAttribute('#interactToggles [data-opt=alive]', 'aria-checked')) === 'false';
  await page.click('.lw-mode[data-mode=residence]');
  const residenceOn = (await page.getAttribute('#interactToggles [data-opt=alive]', 'aria-checked')) === 'true';
  check(`[${which}] Living Painting: on in Residence, off in the quiet Art Museum`, galleryOff && residenceOn);
  await page.click('#closeSettings');
  await page.click('#playBtn'); await page.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 });
  await page.evaluate(() => { window.__lumina.state.settings.interval = 120; });
  await wait(400);
  const s0 = (await st()).alive;
  check(`[${which}] the painting is read and the light layers are ready`, s0.ok && s0.on, JSON.stringify(s0));
  check(`[${which}] it starts completely still (no light yet)`, s0.amb === 0 && s0.counts.motes === 0, `amb ${s0.amb}, motes ${s0.counts.motes}`);
  await wait(6000);
  const s1 = (await st()).alive;
  check(`[${which}] a few seconds later light lives in and around it`, s1.amb >= 0.9 && s1.counts.motes > 5 && s1.counts.dust > 3, JSON.stringify(s1.counts));
  check(`[${which}] the light also lives outside the frame (one space with the surroundings)`, s1.counts.outside > 3, `outside ${s1.counts.outside}`);
  // the painting itself is untouched: an ordinary image between a back layer and a front layer of light
  const layers = await page.evaluate(() => {
    const stage = document.getElementById('stage'), kids = [...stage.children];
    const back = stage.querySelector('.pl-alive-back'), front = stage.querySelector('.pl-alive'), slide = document.querySelector('.pl-slide');
    const s = window.__lumina.state, img = document.querySelectorAll('.pl-slide')[s.cur].querySelector('img');
    return { order: kids.indexOf(back) < kids.indexOf(slide) && kids.indexOf(front) > kids.indexOf(slide), passive: getComputedStyle(front).pointerEvents === 'none' && getComputedStyle(back).pointerEvents === 'none', img: getComputedStyle(img).visibility === 'visible' && !img.style.filter, inSlide: !document.querySelector('.pl-slide canvas') };
  });
  check(`[${which}] the painting is never altered (light layers behind and in front of it)`, layers.order && layers.passive && layers.img && layers.inSlide, JSON.stringify(layers));
  // find living and still spots
  const r = await page.evaluate(() => window.__lumina.aliveRect());
  const pts = [];
  for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) { const x = r.x + r.w * i / 12, y = r.y + r.h * j / 12; pts.push({ x, y, a: await page.evaluate(([x, y]) => window.__lumina.aliveAt(x, y), [x, y]) }); }
  pts.sort((a, b) => b.a - a.a);
  const A = pts[0];
  check(`[${which}] the painting is read: it has living parts`, A.a > 0.5, `best ${A.a.toFixed(2)}, ${pts.filter(p => p.a > 0.3).length}/${pts.length} living`);
  // tap → a clear answer
  const sp0 = (await st()).alive.stats.spawned;
  await page.mouse.click(A.x, A.y); await wait(120);
  const tap = (await st()).alive;
  check(`[${which}] a tap on a living part makes light rise from it`, tap.strength > 0.5 && tap.stats.taps >= 1 && tap.stats.spawned - sp0 >= 15, `strength ${tap.strength}, +${tap.stats.spawned - sp0} lights`);
  await wait(3000);
  // hold → grows with time
  const idx0 = (await st()).idx;
  await page.mouse.move(A.x, A.y); await page.mouse.down();
  const q0 = (await st()).alive.stats.spawned; await wait(350);
  const hs1 = (await st()).alive, h1 = hs1.strength, q1 = hs1.stats.spawned; await wait(1400);
  const q2a = (await st()).alive.stats.spawned; await wait(350);
  const hs2 = (await st()).alive, h2 = hs2.strength, q2 = hs2.stats.spawned;
  check(`[${which}] holding keeps light rising, faster the longer you hold`, (q2 - q2a) > (q1 - q0) * 1.5, `first 0.35 s: ${q1 - q0}, after 1.75 s: ${q2 - q2a}`);
  await page.screenshot({ path: `${out}/${which}-alive-hold.png` });
  check(`[${which}] the longer the press, the bigger the answer`, h2 > h1 + 0.4, `${h1} → ${h2}`);
  check(`[${which}] holding a living part does not open the magnifier`, !(await st()).loupe);
  await page.mouse.up(); await wait(150);
  const rel = (await st()).alive.strength; await wait(3200);
  const settled = (await st()).alive.strength;
  check(`[${which}] when released it springs back and settles`, rel > 0.3 && settled < 0.08, `${rel} → ${settled}`);
  check(`[${which}] touching never turns the page`, (await st()).idx === idx0);
  // a still part → hold to magnify
  const still = pts.slice().reverse().find(p => p.a < 0.3);
  if (still) {
    await page.mouse.move(still.x, still.y); await page.mouse.down(); await wait(700);
    const lp = (await st()).loupe; await page.mouse.up(); await wait(300);
    check(`[${which}] holding a still part opens the magnifier`, lp, `aliveAt ${still.a.toFixed(2)}`);
  } else check(`[${which}] holding a still part opens the magnifier`, true, 'this work is alive everywhere — nothing to magnify');
  // switching it off removes the layer; the static image remains
  await page.evaluate(() => document.querySelector('#fxBtn').click()); await page.waitForSelector('#settings:not([hidden])');
  await page.click('#interactToggles [data-opt=alive]'); await page.click('#closeSettings'); await wait(300);
  const off1 = (await st()).alive; await wait(1500); const off2 = (await st()).alive;
  check(`[${which}] turning Living Painting off: no new light, the painting stays as it is`, !off1.on && off2.stats.spawned === off1.stats.spawned, `${off1.stats.spawned} → ${off2.stats.spawned}`);
  check(`[${which}] no page errors`, errs.length === 0, errs.slice(0, 2).join(' | '));
} catch (e) { check(`[${which}] scenario crashed`, false, String(e).split('\n').slice(0, 4).join(' / ')); }
await browser.close(); srv.kill(); fs.rmSync(lib, { recursive: true, force: true });
const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} checks passed`); process.exit(f ? 1 : 0);
