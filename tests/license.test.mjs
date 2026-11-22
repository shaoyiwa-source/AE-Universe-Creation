// AE Lumina Wall — R11 licences: AE creates a licence for a client (works + choreography, modes, what the client may
// adjust, period); the client activates it with the code on ONE screen; pause / resume / revoke / move screen / expiry
// take effect at the next minute check; a client's own works never appear publicly.
// Usage: node tests/license.test.mjs <outDir>
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
const results = []; const check = (n, ok, info = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${info ? '  — ' + info : ''}`); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const PASS = 'lic-' + Date.now();
const lib = fs.mkdtempSync(path.join(os.tmpdir(), 'lumina-lic-'));
const srv = spawn(process.execPath, [path.join(here, 'lumina-dev-server.mjs'), '8881'], { env: { ...process.env, LUMINA_FS_DIR: lib, LUMINA_STUDIO_PASSWORD: PASS }, stdio: 'pipe' });
process.on('exit', () => { try { srv.kill(); } catch { /* ignore */ } });
await new Promise(r => srv.stdout.on('data', d => String(d).includes('dev server') && r()));
const base = 'http://localhost:8881';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const view = { viewport: { width: 1280, height: 800 } };
try {
  // ---- AE Studio: an exhibition with one client-only work, then a licence ----
  const ctx = await browser.newContext(view); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(base + '/gallery.html', { waitUntil: 'networkidle' }); await page.waitForFunction(() => window.__lumina && document.querySelectorAll('.screen').length > 0);
  const box = await page.locator('.lw-wordmark').boundingBox(); page.once('dialog', d => d.accept(PASS));
  await page.mouse.move(box.x + 20, box.y + box.height / 2); await page.mouse.down(); await wait(3300); await page.mouse.up();
  await page.waitForSelector('label.lw-upload:not([hidden])', { timeout: 8000 });
  const studio = (a, body) => page.evaluate(async ([a, body]) => { const tok = JSON.parse(sessionStorage.getItem('ae-studio-token')).token; const r = await fetch('/api/lumina?a=' + a, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify(body) }); return { status: r.status, json: await r.json() }; }, [a, body]);
  await studio('update', { id: 'ae05', patch: { private: true } }); // the client's own painting
  const ex = (await studio('exhibition-save', { exhibition: { title: { zh: '晶華飯店大廳', en: 'Lobby' }, mode: 'hotel', items: ['ae01', 'ae05', 'ae09'].map(id => ({ id, duration: 8, ...(id === 'ae09' ? { fx: [{ id: 'light', p: {} }] } : {}) })) } })).json.exhibition;
  await page.evaluate(() => window.__lumina.reload());
  // create the licence through the studio dialog
  await page.click('#openLicenses'); await page.waitForSelector('#licDialog[open]');
  await page.click('#licNew');
  await page.fill('#licEdit [name=name]', '晶華飯店'); await page.fill('#licEdit [name=email]', 'lobby@example.com'); await page.fill('#licEdit [name=venue]', '台北・大廳');
  await page.selectOption('#licEdit [name=exhibition]', ex.id);
  // modes: hotel (already chosen from the exhibition) + dream; controls: intensity, volume, advance (not modes)
  await page.click('#licModes [data-v=dream]');
  await page.click('#licControls [data-v=modes]'); await page.click('#licControls [data-v=advance]');
  await page.click('#licSave');
  await page.waitForSelector('#licOut:not([hidden])', { timeout: 8000 });
  const lic = await page.evaluate(() => ({ code: document.getElementById('licOutCode').textContent, url: document.getElementById('licOutUrl').textContent, qr: !!document.querySelector('#licQr svg') }));
  check('AE creates a licence: link, activation code and QR code', /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(lic.code) && /\/gallery\?license=l/.test(lic.url) && lic.qr, JSON.stringify(lic));
  await page.screenshot({ path: `${out}/license-studio.png` });
  const lid = new URL(lic.url).searchParams.get('license');
  // a client's own work never shows publicly
  const pub = await (await fetch(base + '/api/lumina?a=catalog')).json();
  check('the client\'s own work is not public', !pub.works.some(w => w.id === 'ae05'));
  // ---- the client's screen ----
  const c1 = await browser.newContext(view); const s1 = await c1.newPage(); const e1 = []; s1.on('pageerror', e => e1.push(String(e)));
  await s1.goto(`${base}/gallery?license=${lid}&hb=2`, { waitUntil: 'networkidle' });
  await s1.waitForSelector('#licGate:not([hidden])');
  check('the client sees the activation screen (no gallery, no studio)', await s1.evaluate(() => getComputedStyle(document.querySelector('main')).display === 'none' && !document.querySelector('#licForm').hidden));
  await s1.fill('#licCode', 'AAAA-BBBB-CCCC'); await s1.click('#licGo'); await wait(1200);
  check('a wrong code is refused', /不正確|not right/.test(await s1.textContent('#licMsg')));
  await s1.fill('#licCode', lic.code.toLowerCase().replace(/-/g, ' ')); await s1.click('#licGo');
  await s1.waitForSelector('#startGate:not([hidden])', { timeout: 8000 });
  check('the right code activates (any case / spacing) and opens the start gate', /晶華/.test(await s1.textContent('#gateEdition')), await s1.textContent('#gateEdition'));
  await s1.click('#gateBtn'); await s1.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 });
  const st1 = await s1.evaluate(() => ({ works: window.__lumina.state.works, list: window.__lumina.state.list, mode: window.__lumina.state.settings.mode, ids: window.__lumina.licence().works.map(w => w.id) }));
  check('it plays exactly the licensed exhibition (incl. the client\'s own work)', st1.list === 3 && st1.ids.includes('ae05') && st1.mode === 'hotel', JSON.stringify(st1));
  await s1.evaluate(() => document.querySelector('#fxBtn').click()); await s1.waitForSelector('#settings:not([hidden])');
  const ui = await s1.evaluate(() => ({
    modes: document.querySelector('#modeCards').closest('section').hidden ? 0 : document.querySelectorAll('#modeCards .lw-mode').length,
    intensity: !document.getElementById('effectToggles').closest('section').hidden, effects: !document.getElementById('effectToggles').hidden,
    advance: !document.getElementById('transitionChips').closest('section').hidden, transitions: !document.getElementById('transitionChips').hidden,
    display: !document.getElementById('displayToggles').closest('section').hidden, rec: !document.getElementById('recBtn').hidden, god: !document.getElementById('godBtn').hidden,
  }));
  check('the client sees only what AE opened (intensity, volume, paging — no modes, effects, transitions, display, recording, God mode)', ui.modes === 0 && ui.intensity && !ui.effects && ui.advance && !ui.transitions && !ui.display && !ui.rec && !ui.god, JSON.stringify(ui));
  await s1.click('#closeSettings');
  // ---- one licence, one screen ----
  const c2 = await browser.newContext(view); const s2 = await c2.newPage();
  await s2.goto(`${base}/gallery?license=${lid}&hb=2`, { waitUntil: 'networkidle' }); await s2.waitForSelector('#licGate:not([hidden])');
  await s2.fill('#licCode', lic.code); await s2.click('#licGo'); await wait(1200);
  check('a second screen with the same code is refused', /另一台|another screen/.test(await s2.textContent('#licMsg')), await s2.textContent('#licMsg'));
  // ---- pause → the screen stops at its next check; resume → it plays again by itself ----
  await studio('license-save', { license: { id: lid, status: 'paused' } });
  await s1.waitForSelector('#licGate:not([hidden])', { timeout: 10000 }).catch(() => {});
  check('pausing stops the screen within the minute check', /暫停|paused/.test(await s1.textContent('#licMsg')) && await s1.evaluate(() => document.getElementById('player').hidden));
  await studio('license-save', { license: { id: lid, status: 'active' } });
  await s1.waitForFunction(() => !document.getElementById('player').hidden, null, { timeout: 10000 }).catch(() => {});
  check('resuming plays again by itself', await s1.evaluate(() => !document.getElementById('player').hidden));
  // ---- AE changes the choreography → the screen follows ----
  await studio('exhibition-save', { exhibition: { ...ex, items: ex.items.map(it => ({ ...it, fx: [{ id: 'ribbons', p: {} }] })) } });
  await wait(4500);
  check('a new choreography reaches the screen without touching it', await s1.evaluate(() => window.__lumina.licence().exhibition.items.every(it => it.fx && it.fx[0].id === 'ribbons')));
  // ---- the client moves to a new screen ----
  await studio('license-reset-device', { id: lid });
  await s2.fill('#licCode', lic.code); await s2.click('#licGo');
  await s2.waitForSelector('#startGate:not([hidden])', { timeout: 8000 }).catch(() => {});
  check('after "reset device" the new screen activates', await s2.evaluate(() => !document.getElementById('startGate').hidden));
  await s1.waitForSelector('#licGate:not([hidden])', { timeout: 10000 }).catch(() => {});
  check('…and the old screen stops (licence moved)', /移轉|moved/.test(await s1.textContent('#licMsg')), await s1.textContent('#licMsg'));
  // ---- revoke / expiry ----
  await studio('license-save', { license: { id: lid, status: 'revoked' } });
  await s2.waitForSelector('#licGate:not([hidden])', { timeout: 10000 }).catch(() => {});
  check('revoking stops the screen', /停止|ended/.test(await s2.textContent('#licMsg')));
  const old = (await studio('license-save', { license: { customer: { name: '過期測試' }, exhibitionId: ex.id, modes: ['online'], starts: '2025-01-01', expires: '2025-12-31' } })).json.license;
  const r = await (await fetch(base + '/api/lumina?a=license-activate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ license: old.id, code: old.code, device: 'a'.repeat(32) }) })).json();
  check('an expired licence cannot be activated', r.error === 'EXPIRED', JSON.stringify(r));
  await s1.screenshot({ path: `${out}/license-client.png` });
  check('no page errors', errs.length === 0 && e1.length === 0, errs.concat(e1).slice(0, 3).join(' | '));
} catch (e) { check('scenario crashed', false, String(e).split('\n').slice(0, 4).join(' / ')); }
await browser.close(); srv.kill(); fs.rmSync(lib, { recursive: true, force: true });
const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} checks passed`); process.exit(f ? 1 : 0);
