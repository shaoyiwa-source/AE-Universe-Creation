// AE Shinity — R6 acceptance: record clips through the UI and inspect the produced video files.
// Usage: node tests/record.test.mjs <desktop|phone> <outDir>
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
const port = phone ? 8784 : 8783;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-rec-'));
const srv = spawn(process.execPath, [path.join(here, 'lumina-dev-server.mjs'), String(port)], { env: { ...process.env, LUMINA_FS_DIR: dir, LUMINA_STUDIO_PASSWORD: 'x-' + Date.now() }, stdio: 'pipe' });
process.on('exit', () => { try { srv.kill(); } catch { /* ignore */ } });
await new Promise((res, rej) => { srv.stdout.on('data', d => String(d).includes('dev server') && res()); srv.on('exit', c => rej(new Error('server exited ' + c))); });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const ctx = await browser.newContext({ ...ctxOpts, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://localhost:${port}/gallery.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__lumina && document.querySelectorAll('.screen').length > 0);
  for (const n of [1, 3, 10, 12]) await page.locator('.screen').nth(n - 1).locator('.screen-hit').click();
  await page.click('#playBtn');
  await page.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 20000 });
  const ui = async (sel) => { const v = page.viewportSize(); await page.mouse.move(v.width * 0.5, v.height * 0.25); await wait(150); await page.click(sel); };

  const shots = phone ? [['story', 1080, 1920], ['square', 1080, 1080]] : [['story', 1080, 1920], ['wallpaper', 1080, 1920], ['wide', 1920, 1080]];
  // full size, or 2/3 size (720p class) on small screens / low-core devices — chosen automatically for smooth recording
  const sizeOk = (w, h, ew, eh) => (w === ew && h === eh) || (w === Math.round(ew * 2 / 3 / 2) * 2 && h === Math.round(eh * 2 / 3 / 2) * 2);
  for (const [format, ew, eh] of shots) {
    await ui('#recBtn');
    await page.waitForSelector('#recDialog[open] #recSetup:not([hidden])');
    if (format === 'story') {
      check(`[${which}] record dialog offers 4 formats and 15/30 s`, (await page.locator('.rec-format').count()) === 4 && (await page.locator('#recSecs [data-secs]').count()) === 2);
      await page.screenshot({ path: `${out}/${which}-rec-setup.png` });
    }
    await page.click(`.rec-format[data-format=${format}]`);
    await page.click('#recSecs [data-secs="15"]');
    await page.evaluate(() => { window.__lumina.rec.secs = 6; }); // shorter clip for the test; the UI offers 15 / 30 s
    await page.click('#recGo');
    await page.waitForSelector('#recProgress:not([hidden])');
    await wait(3000);
    if (format === 'story') await page.screenshot({ path: `${out}/${which}-rec-progress.png` });
    await page.waitForSelector('#recResult:not([hidden])', { timeout: 60000 });
    const clip = await page.evaluate(() => window.__lumina.lastClip);
    check(`[${which}] ${format}: clip recorded (${clip && clip.mime}), ${format === 'wide' ? '16:9' : format === 'square' ? '1:1' : '9:16'}`, !!clip && clip.size > 60000 && sizeOk(clip.width, clip.height, ew, eh), JSON.stringify(clip));
    const px = await page.evaluate(async () => {
      const v = document.getElementById('recPreview');
      v.muted = true; await v.play().catch(() => {});
      await new Promise(r => { const t = setTimeout(r, 4000); const f = () => { if (v.currentTime > 2.2) { clearTimeout(t); r(); } else requestAnimationFrame(f); }; f(); });
      const c = document.createElement('canvas'); c.width = 90; c.height = Math.round(90 * v.videoHeight / v.videoWidth);
      const x = c.getContext('2d'); x.drawImage(v, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height).data; let s = 0, s2 = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; s += l; s2 += l * l; n++; }
      const mean = s / n; return { w: v.videoWidth, h: v.videoHeight, t: +v.currentTime.toFixed(2), mean: Math.round(mean), sd: Math.round(Math.sqrt(s2 / n - mean * mean)) };
    });
    check(`[${which}] ${format}: video plays with the artwork in frame (not blank)`, px.w === clip.width && px.h === clip.height && px.t > 1 && px.mean > 25 && px.sd > 18, JSON.stringify(px));
    if (format === 'story') check(`[${which}] clip carries the soundscape (audio track)`, clip.audio === true);
    await page.screenshot({ path: `${out}/${which}-rec-result-${format}.png` });
    const dl = page.waitForEvent('download');
    await page.click('#recSave');
    const d = await dl; const f = path.join(out, `${which}-${d.suggestedFilename()}`); await d.saveAs(f);
    check(`[${which}] ${format}: video file saved`, fs.statSync(f).size === clip.size && new RegExp(`^AE-Universe-Creation-.*-${format}-6s\\.(mp4|webm)$`).test(d.suggestedFilename()), d.suggestedFilename());
    await page.click('#recDone');
    await wait(400);
  }
  const st = await page.evaluate(() => ({ playing: window.__lumina.state.playing, shown: window.__lumina.state.shown }));
  check(`[${which}] show resumes after recording`, st.playing && st.shown);
  check(`[${which}] no console errors`, errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) {
  check(`[${which}] scenario crashed`, false, String(e).split('\n').slice(0, 8).join(' / '));
}
await browser.close();
srv.kill();
fs.rmSync(dir, { recursive: true, force: true });
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
