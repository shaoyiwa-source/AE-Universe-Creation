// AE Shinity — room music leads the light: with our music off and Sound reaction on, the prism lasers follow
// the kicks the microphone hears (fake microphone playing 120 BPM). Usage: node tests/room.test.mjs <outDir>
import { createRequire } from 'module'; import { spawn } from 'child_process'; import fs from 'fs';
const require = createRequire(process.cwd() + '/'); const { chromium } = require('playwright');
const O = process.argv[2] || '.';
// 20 s of "room music": a chord with a kick drum every 0.5 s (120 BPM)
const sr = 48000, n = sr * 20, d = new Float32Array(n);
for (let i = 0; i < n; i++) { const t = i / sr; d[i] = 0.06 * (Math.sin(2 * Math.PI * 261.6 * t) + Math.sin(2 * Math.PI * 329.6 * t)); const k = t % 0.5; d[i] += 0.85 * Math.sin(2 * Math.PI * (45 + 110 * Math.exp(-k * 30)) * k) * Math.exp(-k * 9); }
const buf = Buffer.alloc(44 + n * 2); buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(d[i] * 32767))), 44 + i * 2);
fs.writeFileSync(O + '/room.wav', buf);
const lib = fs.mkdtempSync(O + '/lib-');
const srv = spawn(process.execPath, [new URL('./shinity-dev-server.mjs', import.meta.url).pathname, '8816'], { env: { ...process.env, SHINITY_FS_DIR: lib, SHINITY_STUDIO_PASSWORD: 'x' }, stdio: 'pipe' });
await new Promise(r => srv.stdout.on('data', x => String(x).includes('dev server') && r()));
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${O}/room.wav`] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['microphone'] })).newPage();
await p.goto('http://localhost:8816/gallery.html', { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.__shinity && document.querySelectorAll('.screen').length);
await p.click('#openSettings'); await p.click('.lw-mode[data-mode=party]'); await p.click('#interactToggles [data-opt=listen]'); await p.waitForTimeout(800); await p.click('#closeSettings');
await p.click('#playBtn'); await p.waitForFunction(() => window.__shinity.state.shown, null, { timeout: 30000 });
await p.evaluate(() => document.getElementById('musicBtn').click()); // our music off: the room's music leads
const modes = []; let counts = [];
for (let k = 0; k < 16; k++) { await p.waitForTimeout(500); const s = await p.evaluate(() => ({ m: window.__shinity.state.laserMode, beats: window.__shinity.state.soundStats.beats })); modes.push(s.m); counts.push(s.beats); }
const heard = counts.at(-1) - counts[0], ok1 = modes.slice(2).every(m => m === 'room'), ok2 = heard >= 8 && heard <= 20;
console.log(`${ok1 ? 'PASS' : 'FAIL'}  lasers follow the room's music (our music off, microphone on)  — ${JSON.stringify(modes)}`);
console.log(`${ok2 ? 'PASS' : 'FAIL'}  the room's kicks are heard at about its tempo  — ${heard} kicks in 8 s (120 BPM)`);
console.log(`\n${(ok1 ? 1 : 0) + (ok2 ? 1 : 0)}/2 checks passed`); process.exitCode = ok1 && ok2 ? 0 : 1;
await b.close(); srv.kill(); fs.rmSync(lib, { recursive: true, force: true });
