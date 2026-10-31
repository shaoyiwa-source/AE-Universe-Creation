/* 聲光藝廊 · 音樂共創 Jam — TEST VERSION (isolated page, does not modify the Light Player).
   - All music is self-made test audio synthesized live with Web Audio (no recorded track).
   - Painting 「盛明 Eternal Sun」 is drawn unaltered (source-over, no filters); lights are only overlaid/backlit.
   - Every part is scheduled on the AudioContext clock; taps apply on the next beat. */
(function () {
'use strict';

/* ===== CONFIG — to switch to the real track later, set BACKGROUND_TRACK_URL (one constant). =====
   The track must be 148 BPM; BACKGROUND_TRACK_OFFSET = seconds to its first downbeat.
   While null, a self-made synth loop (four-on-the-floor kick + pad) is used. */
const BACKGROUND_TRACK_URL = null; // e.g. '/player/eternal-sun/assets/ae-eternal-stream.m4a' once music rights are verified
const CONFIG = {
  BACKGROUND_TRACK_URL,
  BACKGROUND_TRACK_OFFSET: 0,
  BACKGROUND_TRACK_GAIN: 0.8,
  BPM: 148,
  SESSION_SECONDS: 30,
  PAINTING_URL: '/player/eternal-sun/assets/eternal-sun.jpg',
  LOOKAHEAD: 0.12,   // seconds scheduled ahead of the audio clock
  TICK_MS: 25
};

const STEP = 60 / CONFIG.BPM / 4;                     // one 16th note
const SESSION_STEPS = Math.round(CONFIG.SESSION_SECONDS / STEP); // 296 steps = 74 beats = 30.0 s
const ROWS = 5, COLS = 5;

/* ---------- i18n (follows the site setting: localStorage 'ae-language') ---------- */
const T = {
  zh: {
    back: '← 返回聲光藝廊', badge: '測試版 · 音樂為自製測試音訊', title: '音樂共創',
    howto: '點格子加入聲音，每一格都會跟著節拍', start: '開始共創', startSub: 'Start jamming', rec: '錄製中',
    boardTitle: '5 種聲音 × 5 種變化', tipIdle: '按「▶ 開始共創」後，就能點格子。',
    tipRun: '每一排是一種樂器，一排亮一格；再點一次就關掉。',
    resultTitle: '我的盛明版本', resultBadge: '測試版錄製 · 音樂為自製測試音訊，非正式曲目',
    replay: '▶ 重播', download: '下載「我的盛明版本」', again: '再共創一次',
    foot: '聲光藝廊 · 音樂共創 測試版', footNote: '畫作為 AE 原作，只疊加光效，不改變原作顏色。',
    canvasLabel: '盛明 Eternal Sun 原作與光效', preparing: '準備中…',
    kindVideo: '影片（背光＋畫作＋光效＋聲音），30 秒。', kindAudio: '僅錄音（此瀏覽器不支援錄影），30 秒。',
    recFail: '此瀏覽器無法錄製，但聲音與光仍可遊玩。', ended: '30 秒結束！正在整理你的版本…',
    willOn: '{r} {n}：下一拍加入', willOff: '{r}：下一拍關閉', nowOn: '{r} {n} 加入', nowOff: '{r} 關閉',
    cell: '{r} 變化 {n}', audioFail: '無法啟動聲音，請再按一次。', lang: 'EN', langLabel: 'Switch to English',
    file: '我的盛明版本-測試版', secLeft: '剩 {s} 秒'
  },
  en: {
    back: '← Back to Light Player', badge: 'Test version · self-made test audio', title: 'Music Jam',
    howto: 'Tap a square to add a sound — every square stays on the beat', start: 'Start jamming', startSub: '開始共創', rec: 'Recording',
    boardTitle: '5 sounds × 5 variations', tipIdle: 'Press “▶ Start jamming”, then tap the squares.',
    tipRun: 'Each row is one instrument, one square per row; tap again to turn it off.',
    resultTitle: 'My Eternal Sun version', resultBadge: 'Test recording · self-made test audio, not the official track',
    replay: '▶ Replay', download: 'Download “My Eternal Sun version”', again: 'Jam again',
    foot: 'Light Player · Music Jam test version', footNote: 'The painting is the AE original; only light is overlaid, its colours are never changed.',
    canvasLabel: 'Eternal Sun original painting with light effects', preparing: 'Getting ready…',
    kindVideo: 'Video (backlight + painting + light + sound), 30 s.', kindAudio: 'Audio only (this browser cannot record video), 30 s.',
    recFail: 'This browser cannot record, but you can still play with sound and light.', ended: '30 seconds — done! Preparing your version…',
    willOn: '{r} {n}: joins on the next beat', willOff: '{r}: stops on the next beat', nowOn: '{r} {n} on', nowOff: '{r} off',
    cell: '{r} variation {n}', audioFail: 'Could not start audio — please tap again.', lang: '中文', langLabel: '切換至中文',
    file: 'my-eternal-sun-version-test', secLeft: '{s} s left'
  }
};
let lang = 'en';
try { lang = localStorage.getItem('ae-language') === 'zh' ? 'zh' : 'en'; } catch (e) {}
const t = (k, v) => String(T[lang][k] ?? k).replace(/\{(\w)\}/g, (_, x) => (v && v[x] != null ? v[x] : ''));

const LAYERS = [
  { zh: '鼓組', en: 'Drums', rgb: [255, 214, 120] },
  { zh: '貝斯', en: 'Bass', rgb: [232, 70, 210] },
  { zh: '和弦', en: 'Chords', rgb: [70, 150, 255] },
  { zh: '旋律', en: 'Melody', rgb: [87, 255, 160] },
  { zh: '光點', en: 'Sparkle', rgb: [255, 246, 214] }
];
const LASER = ['#ff416d', '#57ffa0', '#ffe28d', '#65dbff', '#c987ff', '#ffac68'];
const rowName = r => LAYERS[r][lang];

/* ---------- music theory: one key (A minor), one progression for every pitched part ---------- */
const CHORDS = [ // Am – F – C – G, one bar each
  { root: 45, tones: [57, 60, 64] },
  { root: 41, tones: [57, 60, 65] },
  { root: 48, tones: [55, 60, 64] },
  { root: 43, tones: [55, 59, 62] }
];
const PENTA = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84]; // A minor pentatonic A3..C6
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const _ = null;
const MELODY = [
  [5, _, _, 7, _, _, 8, _, 7, _, 5, _, 4, _, _, _],
  [7, _, 8, _, 9, _, 8, 7, _, _, 5, _, _, _, _, _, 4, _, 5, _, 7, _, 5, 4, _, _, 2, _, _, _, _, _],
  [9, 8, 7, 8, 9, _, 7, _, 9, 8, 7, 8, 10, _, 9, _],
  [5, _, _, _, _, _, _, _, 4, _, _, _, 7, _, _, _, 8, _, _, _, _, _, _, _, 7, _, _, _, 5, _, _, _],
  [4, _, 4, 5, _, 7, _, 5, 4, _, 2, _, 4, _, _, _]
];
const hash = n => { let x = (n * 2654435761) >>> 0; x ^= x >>> 13; x = Math.imul(x, 1274126177) >>> 0; return (x ^ (x >>> 16)) >>> 0; };

/* ---------- audio graph ---------- */
let ctx = null, master, layerBus = [], reverbIn, delayIn, outGain, recDest, noiseBuf, bgSource = null, bgBuffer = null;
function buildAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC({ latencyHint: 'interactive' });
  master = ctx.createGain(); master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
  outGain = ctx.createGain();
  master.connect(comp); comp.connect(outGain); outGain.connect(ctx.destination);
  if (ctx.createMediaStreamDestination) { recDest = ctx.createMediaStreamDestination(); outGain.connect(recDest); }
  // reverb (generated impulse) + dotted-8th delay
  const len = Math.floor(ctx.sampleRate * 2.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  const conv = ctx.createConvolver(); conv.buffer = ir; reverbIn = ctx.createGain(); const ret = ctx.createGain(); ret.gain.value = 0.32;
  reverbIn.connect(conv); conv.connect(ret); ret.connect(master);
  delayIn = ctx.createGain(); const dl = ctx.createDelay(1); dl.delayTime.value = STEP * 3; const fb = ctx.createGain(); fb.gain.value = 0.32;
  const dlf = ctx.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 3200; const dret = ctx.createGain(); dret.gain.value = 0.35;
  delayIn.connect(dl); dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(dret); dret.connect(master);
  const levels = [0.9, 0.75, 0.5, 0.5, 0.45];
  layerBus = levels.map(v => { const g = ctx.createGain(); g.gain.value = v; g.connect(master); return g; });
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
}
const bgBus = () => master;
function env(g, tt, peak, a, d) { g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(peak, tt + a); g.gain.exponentialRampToValueAtTime(0.0001, tt + a + d); }
function osc(type, f, tt, dur, dest, detune) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, tt); if (detune) o.detune.value = detune; o.connect(dest); o.start(tt); o.stop(tt + dur + 0.05); return o; }
function noise(tt, dur, dest) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.connect(dest); s.start(tt, Math.random() * 0.5); s.stop(tt + dur + 0.05); return s; }
function filt(type, f, q, dest) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; b.connect(dest); return b; }
function gainTo(dest, sends) { const g = ctx.createGain(); g.connect(dest); if (sends) sends.forEach(([n, v]) => { const s = ctx.createGain(); s.gain.value = v; g.connect(s); s.connect(n); }); return g; }

const SND = {
  kick(tt, dest, peak) { const g = gainTo(dest); const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(165, tt); o.frequency.exponentialRampToValueAtTime(44, tt + 0.13); o.connect(g); env(g, tt, peak, 0.003, 0.36); o.start(tt); o.stop(tt + 0.42); },
  hat(tt, dest, peak, len) { const g = gainTo(dest); noise(tt, len + 0.02, filt('highpass', 7600, 0.7, g)); env(g, tt, peak, 0.001, len); },
  clap(tt, dest, peak) { const g = gainTo(dest, [[reverbIn, 0.25]]); noise(tt, 0.25, filt('bandpass', 1500, 1.1, g)); const p = g.gain; p.setValueAtTime(peak, tt); p.exponentialRampToValueAtTime(peak * 0.08, tt + 0.011); p.setValueAtTime(peak * 0.85, tt + 0.013); p.exponentialRampToValueAtTime(peak * 0.08, tt + 0.024); p.setValueAtTime(peak * 0.75, tt + 0.026); p.exponentialRampToValueAtTime(0.0001, tt + 0.21); },
  snare(tt, dest, peak) { const g = gainTo(dest, [[reverbIn, 0.15]]); noise(tt, 0.2, filt('highpass', 1300, 0.6, g)); env(g, tt, peak, 0.001, 0.16); const g2 = gainTo(dest); osc('triangle', 196, tt, 0.1, g2); env(g2, tt, peak * 0.6, 0.001, 0.08); },
  rim(tt, dest, peak, f) { const g = gainTo(dest); osc('triangle', f, tt, 0.06, filt('bandpass', f * 1.5, 3, g)); env(g, tt, peak, 0.001, 0.05); },
  bass(tt, dest, midi, dur, peak, cut) { const g = gainTo(dest); const lp = filt('lowpass', cut || 900, 4, g); lp.frequency.setValueAtTime((cut || 900) * 1.8, tt); lp.frequency.exponentialRampToValueAtTime((cut || 900) * 0.4, tt + Math.max(0.08, dur)); osc('sawtooth', mtof(midi), tt, dur + 0.05, lp); const sub = gainTo(dest); osc('sine', mtof(midi), tt, dur + 0.05, sub); g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(peak, tt + 0.006); g.gain.setTargetAtTime(0.0001, tt + dur, 0.03); sub.gain.setValueAtTime(0.0001, tt); sub.gain.linearRampToValueAtTime(peak * 0.7, tt + 0.006); sub.gain.setTargetAtTime(0.0001, tt + dur, 0.03); },
  chord(tt, dest, notes, dur, peak, o) { o = o || {}; const g = gainTo(dest, [[reverbIn, o.rev ?? 0.4]]); const lp = filt('lowpass', o.cut || 2200, 0.8, g); notes.forEach(m => { osc(o.type || 'sawtooth', mtof(m), tt, dur + (o.rel || 0.1), lp, -7); osc(o.type || 'sawtooth', mtof(m), tt, dur + (o.rel || 0.1), lp, 7); }); const per = peak / notes.length; g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(per, tt + (o.att || 0.008)); g.gain.setTargetAtTime(0.0001, tt + dur, (o.rel || 0.1) / 3); },
  lead(tt, dest, midi, dur, peak) { const g = gainTo(dest, [[delayIn, 0.5], [reverbIn, 0.2]]); const lp = filt('lowpass', 3400, 0.7, g); osc('triangle', mtof(midi), tt, dur + 0.1, lp); osc('square', mtof(midi), tt, dur + 0.1, lp, 5).frequency.setValueAtTime(mtof(midi), tt); g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(peak, tt + 0.01); g.gain.setTargetAtTime(peak * 0.6, tt + 0.03, 0.08); g.gain.setTargetAtTime(0.0001, tt + dur, 0.04); },
  bell(tt, dest, midi, peak, len) { const g = gainTo(dest, [[reverbIn, 0.55], [delayIn, 0.25]]); osc('sine', mtof(midi), tt, len, g); const g2 = gainTo(dest); osc('sine', mtof(midi) * 2.76, tt, len * 0.4, g2); env(g, tt, peak, 0.002, len); env(g2, tt, peak * 0.25, 0.002, len * 0.3); },
  riser(tt, dest, dur, peak) { const g = gainTo(dest, [[reverbIn, 0.5]]); const bp = filt('bandpass', 400, 4, g); bp.frequency.setValueAtTime(350, tt); bp.frequency.exponentialRampToValueAtTime(7000, tt + dur); noise(tt, dur, bp); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(peak, tt + dur * 0.97); g.gain.linearRampToValueAtTime(0.0001, tt + dur + 0.02); },
  swell(tt, dest, notes, dur, peak) { const g = gainTo(dest, [[reverbIn, 0.6]]); notes.forEach(m => osc('sine', mtof(m), tt, dur + 0.05, g)); g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(peak / notes.length, tt + dur * 0.95); g.gain.linearRampToValueAtTime(0.0001, tt + dur + 0.03); }
};

/* ---------- patterns: row × column → notes at global step n (16th), time tt ---------- */
// returns visual strength (0..1) if something sounded on this step, else 0
function playCell(row, col, n, tt) {
  const s = n % 16, bar = Math.floor(n / 16), ch = CHORDS[bar % 4], d = layerBus[row];
  if (row === 0) {
    if (col === 0) { if (s % 4 === 2) { SND.hat(tt, d, 0.32, 0.09); return 0.7; } }
    else if (col === 1) { SND.hat(tt, d, s % 4 === 2 ? 0.28 : 0.12, 0.035); return s % 4 === 0 ? 0.6 : (s % 4 === 2 ? 0.45 : 0); }
    else if (col === 2) { if (s === 4 || s === 12) { SND.clap(tt, d, 0.55); return 1; } }
    else if (col === 3) { if (s === 4 || s === 12) { SND.snare(tt, d, 0.5); return 1; } if (s === 7 || s === 10 || s === 15) { SND.snare(tt, d, 0.14); return 0.35; } }
    else if (col === 4) { if ([3, 6, 11, 14].includes(s)) { SND.rim(tt, d, 0.38, [880, 660, 990, 740][[3, 6, 11, 14].indexOf(s)]); return 0.6; } if (s % 2 === 0) { SND.hat(tt, d, 0.08, 0.05); } }
    return 0;
  }
  if (row === 1) {
    const r = ch.root;
    if (col === 0) { if (s % 4 === 0) { SND.bass(tt, d, r, STEP * 3.2, 0.42, 700); return 0.9; } }
    else if (col === 1) { if (s % 4 === 2) { SND.bass(tt, d, r, STEP * 1.6, 0.45, 1000); return 0.9; } }
    else if (col === 2) { if (s % 4 !== 0) { SND.bass(tt, d, s % 4 === 2 ? r + 12 : r, STEP * 0.8, 0.34, 1200); return s % 4 === 2 ? 0.8 : 0.3; } }
    else if (col === 3) { const i = [0, 3, 6, 10, 13].indexOf(s); if (i >= 0) { SND.bass(tt, d, r + [0, 0, 7, 12, 0][i], STEP * 1.8, 0.42, 900); return 0.85; } }
    else if (col === 4) { if (s === 0) { SND.bass(tt, d, r, STEP * 14, 0.4, 300); return 1; } if (s === 8) return 0.4; }
    return 0;
  }
  if (row === 2) {
    const c = ch.tones;
    if (col === 0) { if (s % 4 === 2) { SND.chord(tt, d, c, STEP * 1.2, 0.36, { cut: 2600 }); return 0.85; } }
    else if (col === 1) { if (s === 0) { SND.chord(tt, d, c.concat(c[0] + 12), STEP * 15.5, 0.34, { type: 'triangle', att: 0.25, rel: 0.5, cut: 1800, rev: 0.7 }); return 1; } if (s % 4 === 0) return 0.35; }
    else if (col === 2) { if (s % 2 === 0) { SND.chord(tt, d, [c[(s / 2) % 3] + 12], STEP * 1.6, 0.26, { type: 'square', cut: 3000, rev: 0.3 }); return 0.55; } }
    else if (col === 3) { if ([0, 3, 6, 8, 11, 14].includes(s)) { SND.chord(tt, d, c, STEP * 0.9, 0.36, { cut: 3200, rev: 0.35 }); return 0.8; } }
    else if (col === 4) { SND.chord(tt, d, c, STEP * 0.55, s % 4 === 2 ? 0.34 : 0.17, { cut: 2400, rel: 0.04, rev: 0.25 }); return s % 4 === 2 ? 0.7 : 0.25; }
    return 0;
  }
  if (row === 3) {
    const pat = MELODY[col], v = pat[n % pat.length];
    if (v != null) { let len = 1; while (len < 8 && pat[(n + len) % pat.length] == null) len++; SND.lead(tt, d, PENTA[v], STEP * Math.min(len, 6) * 0.92, 0.3); return 0.9; }
    return 0;
  }
  if (row === 4) {
    const c = ch.tones;
    if (col === 0) { if (s === 0 || s === 10) { SND.bell(tt, d, c[s === 0 ? 2 : 1] + 24, 0.3, 1.4); return 1; } }
    else if (col === 1) { if (bar % 2 === 0 && s === 0) { SND.riser(tt, d, STEP * 32, 0.32); } if (s % 4 === 0) return 0.3 + 0.7 * (((bar % 2) * 16 + s) / 32); }
    else if (col === 2) { SND.bell(tt, d, c[n % 3] + 24 + (s % 8 === 7 ? 12 : 0), 0.08, 0.35); return s % 4 === 0 ? 0.5 : 0.2; }
    else if (col === 3) { if (s === 8) { SND.swell(tt, d, c.map(m => m + 12), STEP * 8, 0.32); } if (s >= 8 && s % 2 === 0) return (s - 6) / 10; }
    else if (col === 4) { const h = hash(n + 7); if (h % 3 === 0) { SND.bell(tt, d, PENTA[6 + (h >>> 3) % 6] + 12, 0.14, 0.6); return 0.75; } }
    return 0;
  }
  return 0;
}
function playBackground(n, tt) {
  if (bgBuffer) return n % 4 === 0 ? 0.6 : 0; // real track carries the beat
  const s = n % 16, ch = CHORDS[Math.floor(n / 16) % 4];
  if (s % 4 === 0) SND.kick(tt, bgBus(), 0.95);
  if (s === 0) SND.chord(tt, bgBus(), [ch.root + 12].concat(ch.tones), STEP * 15.8, 0.13, { type: 'sine', att: 0.4, rel: 0.6, cut: 1100, rev: 0.8 });
  return s % 4 === 0 ? 1 : 0;
}

/* ---------- session state + scheduler ---------- */
const S = { running: false, t0: 0, nextStep: 0, active: [-1, -1, -1, -1, -1], pending: [null, null, null, null, null], timer: 0, tEnd: 0, ended: false };
const JAM = window.__AEJam = { config: CONFIG, step: STEP, sessionSteps: SESSION_STEPS, toggles: [], scheduled: [], applied: [], errors: [], get t0() { return S.t0; }, get active() { return S.active.slice(); }, get running() { return S.running; }, get now() { return ctx ? ctx.currentTime : 0; }, get fx() { return { beams: fx.beams.length, orbs: fx.orbs.length }; }, recorder: null };
const visQ = [];
const stepTime = n => S.t0 + n * STEP;
function logSched(e) { if (JAM.scheduled.length < 6000) JAM.scheduled.push(e); }

function tick() {
  if (!S.running || !ctx) return;
  const horizon = ctx.currentTime + CONFIG.LOOKAHEAD;
  while (S.nextStep < SESSION_STEPS && stepTime(S.nextStep) < horizon) {
    const n = S.nextStep, tt = stepTime(n);
    for (let r = 0; r < ROWS; r++) {
      const p = S.pending[r];
      if (p && p.step <= n) { S.active[r] = p.col; S.pending[r] = null; const a = { row: r, col: p.col, step: n, time: tt, onBeat: n % 4 === 0, tapTime: p.tapTime }; JAM.applied.push(a); visQ.push({ t: tt, kind: 'apply', row: r, col: p.col }); }
    }
    const bg = playBackground(n, tt); if (bg) { visQ.push({ t: tt, kind: 'beat', row: -1, s: bg }); logSched({ row: 'bg', step: n, t: tt }); }
    for (let r = 0; r < ROWS; r++) {
      const c = S.active[r]; if (c < 0) continue;
      const v = playCell(r, c, n, tt);
      if (v > 0) { visQ.push({ t: tt, kind: 'note', row: r, col: c, s: v }); logSched({ row: r, col: c, step: n, t: tt }); }
    }
    S.nextStep++;
  }
  if (!S.ended && ctx.currentTime >= S.tEnd + 0.45) finishSession();
}

function onCell(r, c) {
  if (!S.running || S.ended) return;
  const cur = S.active[r], pend = S.pending[r], effective = pend ? pend.col : cur;
  const target = effective === c ? -1 : c;
  if (target === cur) { S.pending[r] = null; JAM.toggles.push({ row: r, col: c, target: 'cancel', tapTime: ctx.currentTime }); render(); return; } // undo a not-yet-applied tap
  const step = Math.ceil(S.nextStep / 4) * 4; // next beat that is not yet scheduled
  if (step >= SESSION_STEPS) return;
  S.pending[r] = { col: target, step, tapTime: ctx.currentTime };
  JAM.toggles.push({ row: r, col: c, target, tapTime: ctx.currentTime, applyStep: step, applyTime: stepTime(step) });
  say(target >= 0 ? t('willOn', { r: rowName(r), n: target + 1 }) : t('willOff', { r: rowName(r) }));
  render();
}

/* ---------- recording (canvas+audio video, fallback audio-only) ---------- */
let rec = null, chunks = [], recKind = '', recMime = '', resultURL = '';
function pickMime(list) { if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return ''; return list.find(m => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || ''; }
function startRecorder() {
  rec = null; chunks = []; recKind = ''; recMime = '';
  if (!window.MediaRecorder || !recDest) return false;
  const audioTracks = recDest.stream.getAudioTracks();
  const tryMake = (stream, mime, kind) => { try { const m = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000, audioBitsPerSecond: 160000 }) : new MediaRecorder(stream); m.start(1000); rec = m; recKind = kind; recMime = m.mimeType || mime; return true; } catch (e) { JAM.errors.push('rec-' + kind + ':' + e.name); return false; } };
  if (canvas.captureStream) {
    const vm = pickMime(['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']);
    if (vm) { let vs = null; try { vs = canvas.captureStream(30); } catch (e) { JAM.errors.push('captureStream:' + e.name); }
      if (vs && tryMake(new MediaStream([...vs.getVideoTracks(), ...audioTracks]), vm, 'video')) { wire(); return true; } }
  }
  const am = pickMime(['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']);
  if (tryMake(new MediaStream(audioTracks), am, 'audio')) { wire(); return true; }
  return false;
  function wire() { rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); }; JAM.recorder = { kind: recKind, mime: recMime }; }
}
function stopRecorder() {
  return new Promise(res => {
    if (!rec || rec.state === 'inactive') return res(null);
    rec.onstop = () => { const type = (recMime || (recKind === 'video' ? 'video/webm' : 'audio/webm')).split(';')[0]; res(new Blob(chunks, { type })); };
    try { rec.stop(); } catch (e) { res(null); }
  });
}

/* ---------- start / finish ---------- */
async function startSession() {
  if (S.running) return;
  startBtn.disabled = true; startBtn.querySelector('[data-i18n="start"]').textContent = t('preparing');
  try {
    if (!ctx) buildAudio();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    await ctx.resume();
    if (CONFIG.BACKGROUND_TRACK_URL && !bgBuffer) {
      try { const ab = await (await fetch(CONFIG.BACKGROUND_TRACK_URL)).arrayBuffer(); bgBuffer = await ctx.decodeAudioData(ab); } catch (e) { bgBuffer = null; JAM.errors.push('track:' + e.name); }
    }
  } catch (e) { JAM.errors.push('audio:' + e.name); startBtn.disabled = false; applyLang(); say(t('audioFail')); return; }
  resultSec.hidden = true; if (resultURL) { URL.revokeObjectURL(resultURL); resultURL = ''; }
  JAM.toggles.length = 0; JAM.scheduled.length = 0; JAM.applied.length = 0; visQ.length = 0; fx.beams.length = 0; fx.orbs.length = 0;
  S.active = [-1, -1, -1, -1, -1]; S.pending = [null, null, null, null, null]; S.nextStep = 0; S.ended = false;
  S.t0 = ctx.currentTime + 0.3; S.tEnd = S.t0 + SESSION_STEPS * STEP;
  outGain.gain.cancelScheduledValues(0); outGain.gain.setValueAtTime(1, ctx.currentTime);
  outGain.gain.setValueAtTime(1, S.tEnd - 0.7); outGain.gain.linearRampToValueAtTime(0.0001, S.tEnd + 0.35);
  if (bgBuffer) { bgSource = ctx.createBufferSource(); bgSource.buffer = bgBuffer; bgSource.loop = true; const g = ctx.createGain(); g.gain.value = CONFIG.BACKGROUND_TRACK_GAIN; bgSource.connect(g); g.connect(master); bgSource.start(S.t0, CONFIG.BACKGROUND_TRACK_OFFSET); bgSource.stop(S.tEnd + 0.5); }
  const recOK = startRecorder();
  S.running = true;
  overlay.hidden = true; hud.hidden = false; recBadge.hidden = !recOK;
  if (!recOK) say(t('recFail')); else say('');
  tipEl.textContent = t('tipRun');
  render();
  S.timer = setInterval(tick, CONFIG.TICK_MS); tick();
  const first = grid.querySelector('.jam-cell'); if (first && document.activeElement === startBtn) first.focus({ preventScroll: true });
}
async function finishSession() {
  S.ended = true; S.running = false; clearInterval(S.timer); render(); say(t('ended'));
  const blob = await stopRecorder();
  hud.hidden = true; overlay.hidden = false; startBtn.disabled = false; applyLang();
  media.innerHTML = '';
  if (!blob || !blob.size) { // no recording possible in this browser: still close the session with a clear result
    JAM.result = { kind: 'none', size: 0 }; replayBtn.hidden = true; dlLink.hidden = true; kindEl.textContent = t('recFail');
    resultSec.hidden = false; tipEl.textContent = t('tipIdle'); resultSec.focus({ preventScroll: true }); resultSec.scrollIntoView({ block: 'start' }); return;
  }
  replayBtn.hidden = false; dlLink.hidden = false;
  resultURL = URL.createObjectURL(blob);
  const ext = /mp4/.test(blob.type) ? (recKind === 'video' ? 'mp4' : 'm4a') : 'webm';
  const el = document.createElement(recKind === 'video' ? 'video' : 'audio');
  el.controls = true; el.playsInline = true; el.setAttribute('playsinline', ''); el.preload = 'metadata'; el.src = resultURL; el.id = 'jam-result-media';
  // Chrome's MediaRecorder WebM has no duration header → force the browser to compute it so the seek bar works
  el.addEventListener('loadedmetadata', function fix() { if (el.duration === Infinity) { el.addEventListener('durationchange', function back() { if (el.duration !== Infinity) { el.removeEventListener('durationchange', back); el.currentTime = 0; } }); try { el.currentTime = 1e7; } catch (e) {} } el.removeEventListener('loadedmetadata', fix); });
  media.appendChild(el);
  dlLink.href = resultURL; dlLink.download = t('file') + '.' + ext;
  JAM.result = { kind: recKind, type: blob.type, size: blob.size, filename: dlLink.download };
  kindEl.textContent = recKind === 'video' ? t('kindVideo') : t('kindAudio');
  resultSec.hidden = false; tipEl.textContent = t('tipIdle'); say('');
  resultSec.focus({ preventScroll: true }); resultSec.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

/* ---------- visuals: backlight → painting (unaltered) → light effects ---------- */
const canvas = document.getElementById('jam-canvas'), g2d = canvas.getContext('2d');
const img = new Image(); img.decoding = 'async'; img.src = CONFIG.PAINTING_URL;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const fx = { beams: [], orbs: [], pulse: 0, rowPulse: [0, 0, 0, 0, 0] };
let W = 0, H = 0, paint = { x: 0, y: 0, w: 0, h: 0 };
function resize() {
  const r = canvas.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  const cap = 720 / Math.max(1, w); if (cap < 1) { w = Math.round(w * cap); h = Math.round(h * cap); }
  if (w && h && (w !== canvas.width || h !== canvas.height)) { canvas.width = w; canvas.height = h; }
  W = canvas.width; H = canvas.height;
  const ar = (img.naturalWidth || 1110) / (img.naturalHeight || 1536), aw = W * 0.86, ah = H * 0.9;
  let pw = aw, ph = aw / ar; if (ph > ah) { ph = ah; pw = ah * ar; }
  paint = { x: (W - pw) / 2, y: (H - ph) / 2, w: pw, h: ph };
}
// light anchor points on the painting per layer (fractions of painting box)
const ANCHOR = [[0.5, 0.42], [0.3, 0.7], [0.72, 0.3], [0.62, 0.62], [0.42, 0.22]];
function spawn(row, s) {
  const layers = S.active.filter(c => c >= 0).length, energy = 0.45 + 0.55 * (layers / 5), red = reduced.matches;
  const rgb = row >= 0 ? LAYERS[row].rgb : [255, 220, 130];
  const [ax, ay] = row >= 0 ? ANCHOR[row] : [0.5, 0.42];
  const jx = (Math.random() - 0.5) * 0.18, jy = (Math.random() - 0.5) * 0.14;
  const tx = paint.x + paint.w * (ax + jx), ty = paint.y + paint.h * (ay + jy);
  if (row >= 0) fx.rowPulse[row] = Math.max(fx.rowPulse[row], s);
  if (row < 0) { fx.pulse = Math.max(fx.pulse, s); }
  const now = performance.now();
  // gold light orb on every beat-carrying event
  fx.orbs.push({ x: tx, y: ty, r: (0.05 + 0.07 * s * energy) * W, born: now, life: red ? 500 : 650, rgb: row >= 0 && row !== 0 && row !== 4 ? blend([255, 214, 120], rgb, 0.35) : [255, 214, 120], a: 0.25 + 0.4 * s * energy });
  if (row < 0 || red) return;
  const n = Math.max(1, Math.round((1 + layers * 0.6) * s));
  for (let i = 0; i < n; i++) {
    const edge = (row + i) % 4, o = Math.random();
    const ox = edge === 0 ? 0 : edge === 1 ? W : o * W, oy = edge === 0 || edge === 1 ? o * H * 0.8 : (edge === 2 ? 0 : H);
    fx.beams.push({ ox, oy, x: tx, y: ty, born: now, life: 260 + 140 * s, color: i === 0 ? `rgb(${rgb.join(',')})` : LASER[(row * 2 + i) % LASER.length], w: (1.2 + 2.2 * s * energy) * (W / 400), a: 0.3 + 0.35 * energy });
  }
  if (fx.beams.length > 80) fx.beams.splice(0, fx.beams.length - 80);
  if (fx.orbs.length > 40) fx.orbs.splice(0, fx.orbs.length - 40);
}
const blend = (a, b, m) => a.map((v, i) => Math.round(v * (1 - m) + b[i] * m));
function flashCell(r) { const c = S.active[r]; if (c < 0) return; const el = cells[r][c]; el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 70); }

function draw() {
  requestAnimationFrame(draw);
  if (!W) resize();
  // release audio-timed visual events (compensate output latency)
  if (ctx && visQ.length) {
    const lat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0), now = ctx.currentTime - lat;
    while (visQ.length && visQ[0].t <= now) {
      const e = visQ.shift();
      if (e.kind === 'apply') { render(); say(e.col >= 0 ? t('nowOn', { r: rowName(e.row), n: e.col + 1 }) : t('nowOff', { r: rowName(e.row) })); continue; }
      spawn(e.row, e.s); if (e.row >= 0) flashCell(e.row);
    }
  }
  const now = performance.now(), layers = S.active.filter(c => c >= 0).length;
  fx.pulse *= 0.9; for (let i = 0; i < 5; i++) fx.rowPulse[i] *= 0.9;
  const c = g2d;
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.fillStyle = '#060806'; c.fillRect(0, 0, W, H);
  // 1) backlight behind the painting (rear ambient light, visible around the edges)
  const run = S.running ? 1 : 0.35, base = (0.22 + 0.13 * layers) * run + 0.12;
  const halo = (x, y, rad, rgb, a) => { const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, `rgba(${rgb.join(',')},${Math.min(0.95, a)})`); g.addColorStop(0.45, `rgba(${rgb.join(',')},${Math.min(0.5, a * 0.4)})`); g.addColorStop(1, `rgba(${rgb.join(',')},0)`); c.fillStyle = g; c.fillRect(0, 0, W, H); };
  c.globalCompositeOperation = 'lighter';
  halo(W * 0.5, H * 0.42, Math.max(W, H) * 0.62, [239, 177, 57], base + fx.pulse * 0.35);
  for (let r = 0; r < ROWS; r++) if (S.active[r] >= 0) { const [ax, ay] = ANCHOR[r]; halo(W * (ax < 0.5 ? 0.08 : 0.92), H * ay, W * 0.55, LAYERS[r].rgb, 0.18 + fx.rowPulse[r] * 0.45); }
  // 2) the painting — drawn as-is (no filter, no tint, full opacity)
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  if (img.complete && img.naturalWidth) c.drawImage(img, paint.x, paint.y, paint.w, paint.h);
  // 3) light effects overlaid: laser beams + gold light orbs
  c.globalCompositeOperation = 'lighter';
  fx.beams = fx.beams.filter(b => now - b.born < b.life);
  for (const b of fx.beams) {
    const k = 1 - (now - b.born) / b.life, a = b.a * k;
    c.globalAlpha = a * 0.28; c.strokeStyle = b.color; c.lineWidth = b.w * 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(b.ox, b.oy); c.lineTo(b.x, b.y); c.stroke();
    c.globalAlpha = a; c.lineWidth = b.w; c.beginPath(); c.moveTo(b.ox, b.oy); c.lineTo(b.x, b.y); c.stroke();
  }
  c.globalAlpha = 1;
  fx.orbs = fx.orbs.filter(o => now - o.born < o.life);
  for (const o of fx.orbs) {
    const p = (now - o.born) / o.life, k = 1 - p, rad = o.r * (0.6 + 0.6 * p);
    const g = c.createRadialGradient(o.x, o.y, 0, o.x, o.y, rad);
    g.addColorStop(0, `rgba(255,248,225,${(o.a * k).toFixed(3)})`); g.addColorStop(0.3, `rgba(${o.rgb.join(',')},${(o.a * k * 0.7).toFixed(3)})`); g.addColorStop(1, `rgba(${o.rgb.join(',')},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(o.x, o.y, rad, 0, Math.PI * 2); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  // countdown
  if (S.running && ctx) { const left = Math.max(0, Math.ceil(S.tEnd - ctx.currentTime)); const v = String(Math.min(CONFIG.SESSION_SECONDS, left)); if (timerEl.textContent !== v) { timerEl.textContent = v; timerEl.setAttribute('aria-label', t('secLeft', { s: v })); } }
}

/* ---------- UI ---------- */
const $ = id => document.getElementById(id);
const grid = $('jam-grid'), startBtn = $('jam-start'), overlay = $('jam-overlay'), hud = $('jam-hud'), timerEl = $('jam-timer'), recBadge = $('jam-rec');
const replayBtn = $('jam-replay');
const tipEl = $('jam-tip'), statusEl = $('jam-status'), resultSec = $('jam-result'), media = $('jam-media'), dlLink = $('jam-download'), kindEl = $('jam-kind');
const cells = [], labels = [];
let sayTimer = 0; function say(msg) { statusEl.textContent = msg; clearTimeout(sayTimer); if (msg) sayTimer = setTimeout(() => { statusEl.textContent = ''; }, 2600); }
for (let r = 0; r < ROWS; r++) {
  const lab = document.createElement('div'); lab.className = 'jam-rowlabel'; lab.style.setProperty('--c', `rgb(${LAYERS[r].rgb.join(',')})`); lab.id = 'jam-row-' + r; grid.appendChild(lab); labels.push(lab);
  cells[r] = [];
  for (let col = 0; col < COLS; col++) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'jam-cell'; b.dataset.row = r; b.dataset.col = col;
    b.style.setProperty('--rgb', LAYERS[r].rgb.join(',')); b.innerHTML = `<span class="n" aria-hidden="true">${col + 1}</span>`;
    b.addEventListener('click', () => onCell(r, col));
    grid.appendChild(b); cells[r].push(b);
  }
}
function render() {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const b = cells[r][c], p = S.pending[r];
    b.disabled = !S.running;
    b.setAttribute('aria-pressed', String(S.active[r] === c));
    b.classList.toggle('pending', !!p && (p.col === c || (p.col === -1 && S.active[r] === c)));
  }
}
function applyLang() {
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  const lb = document.querySelector('[data-lang-toggle]'); lb.textContent = t('lang'); lb.setAttribute('aria-label', t('langLabel'));
  labels.forEach((l, r) => { l.innerHTML = ''; l.append(LAYERS[r][lang]); const sm = document.createElement('small'); sm.textContent = lang === 'zh' ? LAYERS[r].en : LAYERS[r].zh; l.append(sm); });
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) cells[r][c].setAttribute('aria-label', t('cell', { r: rowName(r), n: c + 1 }));
  if (!S.running) tipEl.textContent = t('tipIdle'); else tipEl.textContent = t('tipRun');
  if (resultURL && dlLink.download) { const ext = dlLink.download.split('.').pop(); dlLink.download = t('file') + '.' + ext; kindEl.textContent = recKind === 'video' ? t('kindVideo') : t('kindAudio'); } else if (JAM.result && JAM.result.kind === 'none') kindEl.textContent = t('recFail');
  document.title = (lang === 'zh' ? '音樂共創 Jam（測試版）· 聲光藝廊' : 'Music Jam (test version) · Light Player') + ' · AE Universe Creation';
}
document.querySelector('[data-lang-toggle]').addEventListener('click', () => { lang = lang === 'zh' ? 'en' : 'zh'; try { localStorage.setItem('ae-language', lang); } catch (e) {} applyLang(); });
startBtn.addEventListener('click', startSession);
$('jam-again').addEventListener('click', () => { startSession(); window.scrollTo({ top: 0, behavior: 'auto' }); });
replayBtn.addEventListener('click', () => { const m = $('jam-result-media'); if (m) { m.currentTime = 0; const p = m.play(); if (p && p.catch) p.catch(() => {}); } });
dlLink.addEventListener('click', e => { if (!resultURL) e.preventDefault(); });
window.addEventListener('resize', resize); if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
img.addEventListener('load', resize);
applyLang(); render(); resize(); requestAnimationFrame(draw);
})();
