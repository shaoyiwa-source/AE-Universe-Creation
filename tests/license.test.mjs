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
  const r = await (await fetch(base + '/api/lumina?a=license-activate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ license: old.id, code: old.code, device: 'a'.repeat(32), sid: 'd'.repeat(24) }) })).json();
  check('an expired licence cannot be activated', r.error === 'EXPIRED', JSON.stringify(r));
  await s1.screenshot({ path: `${out}/license-client.png` });
  // ---- a venue with unreliable internet: AE allows 7 offline days; the screen restarts with no internet ----
  const l3 = (await studio('license-save', { license: { customer: { name: '山上美術館' }, exhibitionId: ex.id, modes: ['hotel'], offlineDays: 7 } })).json.license;
  check('AE can set how long a screen may play without internet', l3.offlineDays === 7);
  const c3 = await browser.newContext(view); const s3 = await c3.newPage(); const e3 = []; s3.on('pageerror', e => e3.push(String(e)));
  await s3.goto(`${base}/gallery?license=${l3.id}&hb=2`, { waitUntil: 'networkidle' }); await s3.waitForSelector('#licGate:not([hidden])');
  await s3.fill('#licCode', l3.code); await s3.click('#licGo'); await s3.waitForSelector('#startGate:not([hidden])', { timeout: 8000 });
  await s3.click('#gateBtn'); await s3.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 });
  // the program and the works are saved on this machine
  const srcs3 = await s3.evaluate(() => window.__lumina.licence().works.map(w => w.src)); let saved = 0;
  for (let i = 0; i < 40 && !saved; i++) { saved = await s3.evaluate(async (srcs) => { const c = await caches.open('lumina-offline-v2'); const keys = (await c.keys()).map(r => r.url); return srcs.every(u => keys.includes(new URL(u, location.href).href)) && keys.some(k => k.includes('/gallery/app.js')) ? keys.length : 0; }, srcs3); if (!saved) await wait(500); }
  check('the program and every licensed work are kept on the machine', saved > 0, `${saved} files saved`);
  await c3.setOffline(true);
  await s3.reload({ waitUntil: 'load' }).catch(() => {});
  await s3.waitForSelector('#startGate:not([hidden])', { timeout: 15000 }).catch(() => {});
  check('restart with no internet: it still opens (last confirmed licence)', await s3.evaluate(() => !document.getElementById('startGate').hidden && window.__lumina.licState().offline).catch(() => false));
  await s3.click('#gateBtn').catch(() => {}); await s3.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 }).catch(() => {});
  const offImg = await s3.evaluate(() => { const im = [...document.querySelectorAll('#player img')].filter(i => i.complete && i.naturalWidth > 0); return im.length; }).catch(() => 0);
  check('…and plays the works from the machine', offImg > 0, `${offImg} works drawn offline`);
  // beyond the allowed offline days it stops politely
  await s3.evaluate(() => { const k = Object.keys(localStorage).find(k => k.startsWith('ae-lic-cache-')); const c = JSON.parse(localStorage.getItem(k)); c.okAt = Date.now() - 8 * 86400e3; localStorage.setItem(k, JSON.stringify(c)); });
  await s3.reload({ waitUntil: 'load' }).catch(() => {}); await wait(2500);
  check('offline longer than AE allows (8 > 7 days): it stops and asks for internet', await s3.evaluate(() => /無法連線|cannot be checked/.test(document.getElementById('licMsg').textContent) && document.getElementById('startGate').hidden).catch(() => false));
  await c3.setOffline(false);
  await s3.reload({ waitUntil: 'networkidle' }); await s3.waitForSelector('#startGate:not([hidden])', { timeout: 10000 }).catch(() => {});
  check('internet back: it continues by itself, no code needed', await s3.evaluate(() => !document.getElementById('startGate').hidden && !window.__lumina.licState().offline));
  await s3.click('#gateBtn'); await s3.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 });
  // ---- the computer is copied (same saved data): only one copy plays at a time ----
  const c4 = await browser.newContext({ ...view, storageState: await c3.storageState() }); const s4 = await c4.newPage();
  await s4.goto(`${base}/gallery?license=${l3.id}&hb=2`, { waitUntil: 'networkidle' });
  await s4.waitForSelector('#startGate:not([hidden])', { timeout: 10000 }).catch(() => {});
  check('a copy of the computer opens (it carries the same saved device)…', await s4.evaluate(() => !document.getElementById('startGate').hidden));
  await s3.waitForSelector('#licGate:not([hidden])', { timeout: 10000 }).catch(() => {});
  check('…and the other copy stops at its next check (one screen at a time)', await s3.evaluate(() => document.getElementById('player').hidden && !document.getElementById('licClaim').hidden && /另一台|another screen/.test(document.getElementById('licMsg').textContent)), await s3.textContent('#licMsg'));
  await wait(4500);
  check('the stopped copy stays stopped (no ping-pong)', await s3.evaluate(() => document.getElementById('player').hidden && window.__lumina.licState().blocked === 'SUPERSEDED'));
  await s3.click('#licClaim'); await s3.waitForSelector('#startGate:not([hidden])', { timeout: 8000 }).catch(() => {});
  await s4.click('#gateBtn').catch(() => {}); await s4.waitForSelector('#licGate:not([hidden])', { timeout: 10000 }).catch(() => {});
  check('"play on this screen" takes it back; the copy stops', await s3.evaluate(() => !document.getElementById('startGate').hidden) && await s4.evaluate(() => !document.getElementById('licGate').hidden && window.__lumina.licState().blocked === 'SUPERSEDED'));
  // ---- reviewer's attacks, kept as regression checks ----
  const tamper = async (fn) => { await c3.setOffline(true); await s3.evaluate(fn); await s3.reload({ waitUntil: 'load' }).catch(() => {}); await wait(2500); const ok = await s3.evaluate(() => !document.getElementById('startGate').hidden).catch(() => false); return ok; };
  await s3.click('#licClaim').catch(() => {}); await wait(1500); // s3 owns the licence again
  const key3 = await s3.evaluate(() => Object.keys(localStorage).find(k => k.startsWith('ae-lic-cache-')));
  const fresh = await s3.evaluate((k) => localStorage.getItem(k), key3);
  const opens = [];
  opens.push(await tamper(() => { const k = Object.keys(localStorage).find(k => k.startsWith('ae-lic-cache-')); const c = JSON.parse(localStorage.getItem(k)); c.okAt = Date.now() + 365 * 86400e3; localStorage.setItem(k, JSON.stringify(c)); }));
  await s3.evaluate(([k, v]) => localStorage.setItem(k, v), [key3, fresh]);
  opens.push(await tamper(() => { const k = Object.keys(localStorage).find(k => k.startsWith('ae-lic-cache-')); const c = JSON.parse(localStorage.getItem(k)); c.config.expires = '2020-01-01'; localStorage.setItem(k, JSON.stringify(c)); }));
  await s3.evaluate(([k, v]) => localStorage.setItem(k, v), [key3, fresh]);
  opens.push(await tamper(() => { const k = Object.keys(localStorage).find(k => k.startsWith('ae-lic-cache-')); const c = JSON.parse(localStorage.getItem(k)); c.seen = Date.now() + 5 * 86400e3; localStorage.setItem(k, JSON.stringify(c)); })); // the clock was turned back 5 days
  await s3.evaluate(([k, v]) => localStorage.setItem(k, v), [key3, fresh]);
  const honest = await tamper(() => {});
  check('offline: a saved time in the future, a past end date, or a clock turned back do not play; the honest copy does', opens.every(x => !x) && honest, JSON.stringify({ tampered: opens, honest }));
  await c3.setOffline(false);
  // a launch that does not say which launch it is, is refused
  const tok3 = await s3.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /^ae-lic-l/.test(k)))).token);
  const dev3 = await s3.evaluate(() => localStorage.getItem('ae-device'));
  const nosid = await fetch(base + '/api/lumina?a=license-config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: tok3, device: dev3 }) });
  check('a check without a launch id is refused', nosid.status === 400);
  // a broken device token (e.g. the server key changed) heals itself with the saved code — no visit needed
  await s3.reload({ waitUntil: 'networkidle' }); await s3.waitForSelector('#startGate:not([hidden])', { timeout: 10000 }).catch(() => {});
  await s3.click('#gateBtn').catch(() => {}); await s3.waitForFunction(() => window.__lumina.state.shown, null, { timeout: 30000 }).catch(() => {});
  await s3.evaluate(() => { const k = Object.keys(localStorage).find(k => /^ae-lic-l/.test(k)); const t = JSON.parse(localStorage.getItem(k)); t.token = t.token.replace(/.$/, c => c === 'A' ? 'B' : 'A'); localStorage.setItem(k, JSON.stringify(t)); });
  await wait(5000);
  check('a broken device token heals itself and the show keeps playing', await s3.evaluate(() => !document.getElementById('player').hidden && !window.__lumina.licState().blocked));
  // two licences created at the same moment: both are listed and both codes work
  const [n1, n2] = await Promise.all(['同時一', '同時二'].map(name => studio('license-save', { license: { customer: { name }, exhibitionId: ex.id, modes: ['hotel'] } })));
  const listed = (await studio('license-list', {})).json.licenses.map(l => l.id);
  const act = await Promise.all([n1, n2].map(n => fetch(base + '/api/lumina?a=license-activate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: n.json.license.code, device: 'b'.repeat(32), sid: 'c'.repeat(24) }) }).then(r => r.status)));
  check('two licences created at the same moment: both listed, both codes work', listed.includes(n1.json.license.id) && listed.includes(n2.json.license.id) && act.every(x => x === 200), JSON.stringify(act));
  // the offline copy does not touch the rest of the public site
  await s3.goto(base + '/index.html', { waitUntil: 'networkidle' }).catch(() => {});
  const siteCached = await s3.evaluate(async () => (await (await caches.open('lumina-offline-v2')).keys()).map(r => r.url).filter(u => /\/index\.html|site\.(js|css)/.test(u)));
  check('the offline copy leaves the rest of the site alone', siteCached.length === 0, JSON.stringify(siteCached));
  // ?code= in a link leaves the address bar
  const c5 = await browser.newContext(view); const s5 = await c5.newPage();
  await s5.goto(`${base}/gallery?license=${n1.json.license.id}&code=${encodeURIComponent(n1.json.license.code)}`, { waitUntil: 'networkidle' });
  check('a code in the link is filled in and removed from the address bar', !/code=/.test(s5.url()) && (await s5.inputValue('#licCode')) === n1.json.license.code);
  await c5.close();
  check('no page errors on the venue screens', e3.length === 0, e3.slice(0, 2).join(' | '));
  check('no page errors', errs.length === 0 && e1.length === 0, errs.concat(e1).slice(0, 3).join(' | '));
} catch (e) { check('scenario crashed', false, String(e).split('\n').slice(0, 4).join(' / ')); }
await browser.close(); srv.kill(); fs.rmSync(lib, { recursive: true, force: true });
const f = results.filter(x => !x).length; console.log(`\n${results.length - f}/${results.length} checks passed`); process.exit(f ? 1 : 0);
