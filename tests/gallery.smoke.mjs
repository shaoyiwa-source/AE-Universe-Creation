// AE Lumina Wall — acceptance smoke test (Playwright).
// Usage: serve ./public on a port, then: node tests/gallery.smoke.mjs http://localhost:8765 <shotDir>
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const base = process.argv[2] || 'http://localhost:8765';
const shots = process.argv[3] || '.';
const results = [];
const STUDIO_PASS = process.env.LUMINA_STUDIO_PASS || '';
const check = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function scenario(label, ctxOpts) {
  // controls auto-hide after 3s idle; wake them like a user would before pressing a player button
  const ui = async (page, sel) => { const v = page.viewportSize(); await page.mouse.move(v.width * 0.5 + Math.random() * 20, v.height * 0.2); await page.waitForTimeout(150); await page.click(sel); };
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + '/gallery.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__lumina && document.querySelectorAll('.screen').length >= 27);
  check(`[${label}] wall renders 27 screens`, (await page.locator('.screen').count()) === 27);
  await page.screenshot({ path: `${shots}/${label}-wall.png` });

  // horizontal overflow
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`[${label}] no horizontal scroll`, overflow <= 0, `overflow=${overflow}`);

  // select 3 portrait + landscape works in custom order: #2 (portrait), #3 (landscape), #10 (portrait)
  for (const n of [2, 3, 10]) await page.locator('.screen').nth(n - 1).locator('.screen-hit').click();
  const badges = await page.$$eval('.screen.selected .screen-badge', els => els.map(e => e.textContent));
  check(`[${label}] selection order badges`, badges.join(',') === '1,2,3', badges.join(','));

  // customers cannot add works
  check(`[${label}] customer view hides "add works" & music upload`, !(await page.locator('label.lw-upload').first().isVisible()) && !(await page.locator('.lw-music-upload').isVisible()));
  const longPress = async (pw) => {
    await page.evaluate(() => window.scrollTo(0, 0)); await wait(300); // the header is not sticky
    const box = await page.locator('.lw-wordmark').boundingBox();
    page.once('dialog', d => d.accept(pw));
    await page.mouse.move(box.x + 20, box.y + box.height / 2);
    await page.mouse.down(); await wait(3300); await page.mouse.up();
    await wait(1200);
  };
  await longPress('wrong-password');
  check(`[${label}] wrong studio password is rejected`, !(await page.locator('label.lw-upload').first().isVisible()));
  if (!STUDIO_PASS) throw new Error('set LUMINA_STUDIO_PASS to run the studio checks');
  await longPress(STUDIO_PASS);
  await page.waitForSelector('label.lw-upload:not([hidden])', { timeout: 8000 }).catch(() => {});
  check(`[${label}] long-press + password opens AE Studio`, await page.locator('label.lw-upload').first().isVisible());

  // upload a generated image (studio only)
  const png = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 800;
    const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 1200, 800);
    g.addColorStop(0, '#ff7eb3'); g.addColorStop(1, '#4fc3f7'); x.fillStyle = g; x.fillRect(0, 0, 1200, 800);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.setInputFiles('#fileInput', { name: 'my-test-work.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.waitForFunction(() => document.querySelectorAll('.screen').length === 28);
  check(`[${label}] upload adds a work and auto-selects it`, (await page.evaluate(() => window.__lumina.state.selected)) === 4);

  // settings sheet
  await page.click('#openSettings');
  await page.waitForSelector('#settings:not([hidden])');
  await wait(700);
  await page.screenshot({ path: `${shots}/${label}-settings.png` });
  const chips = await page.locator('#transitionChips .lw-chip').count();
  check(`[${label}] settings shows 7 transitions`, chips === 7);
  check(`[${label}] settings shows 6 scene modes`, (await page.locator('#modeCards .lw-mode').count()) === 6);
  const expect = { gallery: [20, 'hall'], healing: [16, 'nature'], hotel: [12, 'lounge'], residence: [18, 'dawn'], online: [10, 'celestial'], party: [6, 'pulse'] };
  for (const [id, [iv, mu]] of Object.entries(expect)) {
    await page.click(`.lw-mode[data-mode=${id}]`);
    const st = await page.evaluate(() => ({ iv: window.__lumina.state.settings.interval, mu: window.__lumina.state.settings.music, m: window.__lumina.state.settings.mode }));
    check(`[${label}] mode ${id} applies its preset`, st.iv === iv && st.mu === mu && st.m === id, JSON.stringify(st));
  }
  await page.locator('#effectToggles .lw-toggle').first().click();
  check(`[${label}] fine-tune marks mode as adjusted + offers reset`, await page.locator('#resetMode').isVisible());
  await page.click('#resetMode');
  check(`[${label}] reset restores the mode`, !(await page.locator('#resetMode').isVisible()));
  await page.click('.lw-mode[data-mode=online]');
  await page.click('#closeSettings');

  // play
  await page.click('#playBtn');
  await page.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 8000 });
  await wait(600);
  const fit = await page.evaluate(() => {
    const st = window.__lumina.state; const slide = document.querySelectorAll('.pl-slide')[st.cur];
    const img = slide.querySelector('img'); const r = img.getBoundingClientRect();
    return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, nw: img.naturalWidth, nh: img.naturalHeight };
  });
  const inside = fit.w <= fit.vw + 1 && fit.h <= fit.vh + 1;
  const fills = Math.max(fit.w / fit.vw, fit.h / fit.vh);
  check(`[${label}] first work (portrait) fully visible`, inside, JSON.stringify(fit));
  check(`[${label}] first work uses the screen well`, fills > 0.84, 'fill=' + fills.toFixed(2));
  await page.mouse.click(fit.vw * 0.3, fit.vh * 0.4);
  await page.mouse.move(fit.vw * 0.5, fit.vh * 0.5, { steps: 8 });
  await wait(250);
  await page.screenshot({ path: `${shots}/${label}-play1.png` });

  // cycle through every transition explicitly
  for (const k of ['bloom', 'rings', 'ink', 'silk', 'stardust', 'dissolve']) {
    await page.evaluate((k) => { window.__lumina.state.settings.transition = k; }, k);
    const before = await page.evaluate(() => window.__lumina.state.idx);
    await page.evaluate(() => window.__lumina.go(1));
    await wait(900);
    if (k === 'rings' || k === 'stardust') await page.screenshot({ path: `${shots}/${label}-tr-${k}.png` });
    await page.waitForFunction(() => !window.__lumina.state.busy, null, { timeout: 8000 });
    const after = await page.evaluate(() => window.__lumina.state.idx);
    check(`[${label}] transition ${k} completes`, after !== before, `${before}→${after}`);
    const g = await page.evaluate(() => {
      const st = window.__lumina.state; const img = document.querySelectorAll('.pl-slide')[st.cur].querySelector('img'); const r = img.getBoundingClientRect();
      const slide = document.querySelectorAll('.pl-slide')[st.cur];
      return { ok: r.width <= innerWidth + 1 && r.height <= innerHeight + 1, op: getComputedStyle(slide).opacity, mask: slide.style.maskImage || slide.style.webkitMaskImage || '' , land: img.naturalWidth > img.naturalHeight, fill: Math.max(r.width / innerWidth, r.height / innerHeight) };
    });
    check(`[${label}] after ${k}: art fully visible & opaque, no mask`, g.ok && g.op === '1' && !g.mask, JSON.stringify(g));
  }

  // every scene mode runs in the player (soundscapes, tempo, mode transitions) without errors
  for (const id of ['gallery', 'healing', 'hotel', 'residence', 'party', 'online']) {
    await ui(page, '#fxBtn');
    await page.click(`.lw-mode[data-mode=${id}]`);
    await page.click('#closeSettings');
    await page.evaluate(() => window.__lumina.go(1));
    await wait(1800);
    if (id === 'party' || id === 'healing' || id === 'gallery') await page.screenshot({ path: `${shots}/${label}-mode-${id}.png` });
    await page.waitForFunction(() => !window.__lumina.state.busy, null, { timeout: 9000 });
  }
  check(`[${label}] all 6 modes play`, true);

  // effects: turn everything on
  await page.evaluate(() => { const s = window.__lumina.state.settings; Object.keys(s.effects).forEach(k => s.effects[k] = true); });
  await ui(page, '#fxBtn');
  await page.waitForSelector('#settings:not([hidden])');
  await page.click('.lw-mode[data-mode=party]');
  await page.click('#closeSettings');
  await wait(2500);
  await page.screenshot({ path: `${shots}/${label}-prism.png` });
  await page.evaluate(() => { const s = window.__lumina.state.settings; s.effects.aurora = true; s.effects.petals = true; });
  await ui(page, '#fxBtn'); await page.click('.lw-mode[data-mode=healing]'); await page.click('#closeSettings');
  await wait(2500);
  await page.screenshot({ path: `${shots}/${label}-aurora.png` });

  // keyboard + pause
  await page.keyboard.press(' ');
  check(`[${label}] space pauses`, !(await page.evaluate(() => window.__lumina.state.playing)));
  await page.keyboard.press(' ');
  // measure frame rate briefly
  const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
  check(`[${label}] animation runs`, fps > 20, `fps≈${fps}`);
  await page.keyboard.press('Escape'); // 1st: leave fullscreen (browser-native in real use)
  await wait(400);
  await page.keyboard.press('Escape'); // 2nd: close the player
  await wait(300);
  check(`[${label}] Esc closes the player`, await page.evaluate(() => document.getElementById('player').hidden));

  // persistence after reload
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__lumina && document.querySelectorAll('.screen').length >= 27);
  const persisted = await page.evaluate(() => ({ n: document.querySelectorAll('.screen').length, sel: window.__lumina.state.selected }));
  check(`[${label}] upload + selection persist after reload`, persisted.n === 28 && persisted.sel === 4, JSON.stringify(persisted));

  check(`[${label}] no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
}

await scenario('desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await scenario('phone', { ...devices['iPhone 13'] });
await scenario('tv', { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
