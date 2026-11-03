/* 盛明 Eternal Sun — Premium Edition dynamic wallpaper (site v2476.75, Preview trial).
   ART RULE: the painting is a plain, untouched <img>. Every effect is a separate layer behind it
   (wall / back-glow / gold frame) or a toggleable overlay above it (LED, aura, UV, glints).
   With all effects off the painting pixels are exactly the original image. */
const $ = s => document.querySelector(s);
const Q = new URLSearchParams(location.search);
const SUN = { x: 0.515, y: 0.50 };            // sun focal point of the painting (normalized)
const AR = 1110 / 1536;
const S = {
  lang: Q.get('lang') === 'en' ? 'en' : 'zh', mode: 'natural', intensity: 0.7, speed: 1,
  frame: true, led: true, aura: true, glint: true, laser: false, bloom: true, rgbStyle: 'bar', lamp: 'auto', preset: 'home', look: '', impact: true,
  engine: 'webgl', playing: false, home: true,
  search: true, dip: true, lw: (() => { try { return localStorage.getItem('ae-premium-lw') || 'mid'; } catch (e) { return 'mid'; } })() // v75: 探照燈 / beat-dip / 雷射粗細
};
if (Q.get('fx') === '0') Object.assign(S, { search: false, dip: false, frame: false, led: false, aura: false, glint: false, laser: false, bloom: false });
if (['rgb', 'uv'].includes(Q.get('mode'))) S.mode = 'rgb'; 

/* ---------- i18n ---------- */
function applyLang() {
  document.documentElement.lang = S.lang === 'en' ? 'en' : 'zh-Hant';
  document.querySelectorAll('[data-zh]').forEach(el => { el.textContent = el.dataset[S.lang]; });
  $('#lang').textContent = S.lang === 'en' ? '中文' : 'EN';
  updatePlayLabel(); updateEngineNote();
}
function updatePlayLabel() {
  const b = $('#play');
  b.textContent = S.playing ? (S.lang === 'en' ? '❚❚ Pause' : '❚❚ 暫停') : b.dataset[S.lang];
}
function updateEngineNote() {
  $('#engine').textContent = (S.engine === 'webgl' ? 'WebGL' : 'Canvas 2D') + ' · ' +
    (S.lang === 'en' ? 'effects are overlays — the original painting is never altered' : '所有光效皆為圖層 · 原作畫面不做任何修改');
}

/* ---------- layout ---------- */
const L = { W: 0, H: 0, dpr: 1, p: { x: 0, y: 0, w: 0, h: 0 }, F: 10 };
function layout() {
  L.W = innerWidth; L.H = innerHeight; L.dpr = Math.min(devicePixelRatio || 1, 2);
  const portrait = L.H > L.W;
  const mx = portrait ? 0.14 : 0.12, my = portrait ? 0.16 : 0.12;
  let w = L.W * (1 - mx), h = w / AR;
  if (h > L.H * (1 - my)) { h = L.H * (1 - my); w = h * AR; }
  w = Math.round(w); h = Math.round(h);
  L.p = { x: Math.round((L.W - w) / 2), y: Math.round((L.H - h) / 2), w, h };
  L.F = Math.max(9, Math.round(w * 0.03));
  const a = $('#art').style;
  a.left = L.p.x + 'px'; a.top = L.p.y + 'px'; a.width = w + 'px'; a.height = h + 'px';
  for (const c of [$('#front'), $('#back'), $('#coin')]) { c.width = L.W * L.dpr; c.height = L.H * L.dpr; }
  if (gl) gl.resize(); 
}

/* ---------- audio / beat ---------- */
const CK = { base: 0, at: 0, last: -1, ok: 0, err: 0 };
// Output latency (v2476.64): read from an AudioContext created on the play gesture (not routed; reading only).
// Media elements and Web Audio share the same output device, so baseLatency + outputLatency is the delay from decoder to speaker.
const OM = (() => { const o = window.aePremiumOnsets; return o ? { sub: o.sub, st: o.subS, i: 0, n: 0, since: 9, hits: 0, last: -1 } : { sub: null }; })();
const SYNC = { off: (() => { try { const v = +localStorage.getItem('ae-premium-sync-ms'); return Number.isFinite(v) ? Math.max(-200, Math.min(200, v)) : 0; } catch (e) { return 0; } })() };
document.addEventListener('visibilitychange', () => { CK.ok = 0; });
const LAT = { ctx: null, v: 0, frame: 0.012, read: 0, src: 'none', override: null };
function measureLatency() {
  try { if (!LAT.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { LAT.ctx = new AC({ latencyHint: 'playback' }); LAT.ctx.resume && LAT.ctx.resume(); } } } catch (e) {}
  const c = LAT.ctx; if (!c) return; const o = Number(c.outputLatency) || 0, b = Number(c.baseLatency) || 0;
  LAT.out = o; LAT.base = b; LAT.src = o ? 'outputLatency+baseLatency' : (b ? 'baseLatency' : 'none'); LAT.v = Math.min(0.5, Math.max(0, o + b)); LAT.read = performance.now();
}
function latency() { if (LAT.override != null) return LAT.override; if (performance.now() - LAT.read > 2000) measureLatency(); return Math.max(0, LAT.v - LAT.frame); }
const QL = new URLSearchParams(location.search).get('lat'); if (QL != null && QL !== '' && !isNaN(+QL)) LAT.override = +QL / 1000;
const A = { count: 0, t: 0, phase: 0, ctx: null, an: null, buf: null, bass: 0, avg: 0, level: 0, lastKick: 0, kick: 0 };
const audio = $('#music');
for (const ev of ['waiting', 'stalled', 'seeking']) audio.addEventListener(ev, () => { CK.stall = 1; CK.ok = 0; });
for (const ev of ['playing', 'seeked', 'canplay']) audio.addEventListener(ev, () => { CK.stall = 0; CK.ok = 0; });

async function togglePlay() {
  // v2476.69: start the media element FIRST, synchronously inside the tap (iOS Safari refuses play() issued after an await → stall)
  let early = null; if (audio.paused) { if (!A.started) { A.started = 1; startAtCue(); } try { early = audio.play(); if (early && early.catch) early.catch(() => {}); } catch (e) {} }
  measureLatency();
  if (!A.ctx && !RH) {
    const AC = window.AudioContext || window.webkitAudioContext;
    A.ctx = new AC();
    const src = A.ctx.createMediaElementSource(audio);
    A.an = A.ctx.createAnalyser(); A.an.fftSize = 1024; A.an.smoothingTimeConstant = 0.6;
    src.connect(A.an); A.an.connect(A.ctx.destination);
    A.buf = new Uint8Array(A.an.frequencyBinCount);
    try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().catch(() => {}); } catch (e) {}
  }
  try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission && !A.asked) { A.asked = 1; DeviceOrientationEvent.requestPermission().catch(() => {}); } } catch (e) {}
  if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
  if (early) { try { await early; } catch (e) {} syncPlay(); return; }
  if (audio.paused) { if (!A.started) { A.started = 1; startAtCue(); } try { await audio.play(); } catch (e) {} }
  else audio.pause();
  syncPlay();
}
// v2476.60: the button always mirrors the REAL audio state (iOS pauses media when you leave Safari) -> one tap resumes
const CUE = 58.3; // v2476.61: first play starts at the climax (0:58)
function startAtCue() { const go = () => { try { audio.currentTime = CUE; } catch (e) {} }; if (audio.readyState >= 1) go(); else { go(); audio.addEventListener('loadedmetadata', go, { once: true }); } }
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
let seeking = false, progAt = 0;
function updateProg(now) { if (now - progAt < 250) return; progAt = now; const d = audio.duration; $('#tdur').textContent = Number.isFinite(d) ? fmt(d) : '0:00'; if (!seeking) { $('#tcur').textContent = fmt(audio.currentTime); $('#seek').value = Number.isFinite(d) && d > 0 ? Math.round(audio.currentTime / d * 1000) : 0; } }
function syncPlay() { S.playing = !audio.paused && !audio.ended; updatePlayLabel(); }
['play', 'playing', 'pause', 'ended', 'emptied', 'stalled', 'suspend', 'waiting'].forEach(ev => audio.addEventListener(ev, syncPlay));
document.addEventListener('visibilitychange', syncPlay); addEventListener('pageshow', syncPlay); addEventListener('focus', syncPlay);
let rings = [];
// v2476.60: same pre-measured kick timeline + bass energy as the homepage sound-light (ae-home-beats.js / ae-home-light-energy.js).
// Driven by audio.currentTime, so it works on iPhone even when the live analyser returns silence.
const EN = window.aeHomeAudioEnergy, TL = window.aeHomeBeatTimeline;
const RH = EN && TL && TL.events ? EN.createRhythm(TL.events, TL.accents || [], TL.sections || []) : null;
function analyse(now) {
  let bass = 0;
  if (RH && S.playing) {
    // v2476.60 sync: beat time = audio.currentTime every frame (smoothed between coarse currentTime updates, re-locked if off by >40 ms).
    // Independent of the Speed slider and of frame rate, so it cannot drift over long playback or after seeking / looping.
    const ct = audio.currentTime, rate = audio.playbackRate || 1;
    // v2476.64: phase-locked clock (slews toward every fresh currentTime instead of tolerating 40 ms before re-locking),
    // then shifted back by the measured output latency so lights land on what is HEARD, not what the decoder has reached.
    if (ct !== CK.last || !CK.ok) { const pred = CK.base + (now - CK.at) / 1000 * rate, d = ct - pred; if (!CK.ok || Math.abs(d) > 0.12 || ct < CK.last) { CK.base = ct; CK.at = now; } else { CK.base = pred + d * 0.2; CK.at = now; } CK.err = d; CK.last = ct; CK.ok = 1; }
    let tt = CK.base + (now - CK.at) / 1000 * rate; if (Math.abs(tt - ct) > 0.25) { CK.base = tt = ct; CK.at = now; }
    // v2476.65 robustness: never extrapolate while the element is seeking / buffering (the CUE seek on first play and
    // mobile stalls kept the old clock running ahead of the frozen audio), and never more than 0.35 s past the last real update.
    if (audio.seeking || audio.readyState < 3 || CK.stall) { CK.base = tt = ct; CK.at = now; }
    else if (tt - ct > 0.35) { CK.base = tt = ct; CK.at = now; }
    tt = Math.max(0, tt - latency() - SYNC.off / 1000); // + offset = lights later
    CK.tt = tt;
    A.t = tt; bass = Math.min(1, EN.energyAt(TL, tt));
    const b = RH.update(bass, tt);
    if (b.count < A.count) A.count = b.count; // loop / seek back
    if (b.beat) { A.count = b.count; onKick(now, 0.6 + 0.4 * bass); const hv75 = isHeavy(b, tt, bass); v75Beat(now, bass, hv75, b); if (hv75) { IMP.t = now; IMP.at = TL.events[b.count - 1]; IMP.n++; partyHeavy(now); } if (b.stage !== 'build' || b.accentBeat) { if (b.stage !== 'build') launchDepth(null, null, now, b.count); for (let i = 0; i < 3; i++) { musicSpots.push({ ...hpDest(i * 2, b.sweep, now), born: now }); } if (musicSpots.length > 9) musicSpots.splice(0, musicSpots.length - 9); } partyBeat(b, now); }
    A.b = b; A.since = b.count ? Math.max(0, tt - TL.events[b.count - 1]) : 9; // seconds since the last grid kick (audio time)
    A.bass = bass; A.level += (bass - A.level) * 0.25; A.kick = A.kickQ = Math.exp(-A.since / 0.095); // quarter-note kick (grid)
    // v2476.65 onset map: the builds accelerate to 8th/16th snare rolls and the bass goes double-time after each drop.
    // A quarter-only grid felt like the lights "could not keep up" as the music sped up, so every measured onset now punches too.
    if (OM.sub) { const ss = OM.sub; let k = OM.i; if (k > 0 && ss[k - 1] > tt) k = 0; while (k < ss.length && ss[k] <= tt) k++; OM.i = k;
      if (k) { const ds = tt - ss[k - 1]; OM.since = ds; OM.n = k; const sub = Math.exp(-ds / 0.075) * (0.35 + 0.4 * OM.st[k - 1]); if (ds < 0.012 && OM.last !== k) { OM.last = k; OM.hits++; } A.kick = Math.max(A.kick, sub); } } A.drop = b.dropPulse || 0; A.phase = b.phase; return;
  }
  CK.ok = 0;
  if (A.an && S.playing) {
    A.an.getByteFrequencyData(A.buf);
    const hz = A.ctx.sampleRate / A.an.fftSize; const n = Math.max(2, Math.round(140 / hz));
    for (let i = 1; i <= n; i++) bass += A.buf[i];
    bass /= n * 255;
    A.avg = A.avg * 0.96 + bass * 0.04;
    if (bass > A.avg * 1.18 + 0.04 && bass > 0.35 && now - A.lastKick > 280) onKick(now, bass);
  } else {
    // idle: slow breathing, a gentle ring every ~3.2 s
    bass = 0.25 + 0.15 * Math.sin(now / 900);
    if (now - A.lastKick > 3200 / S.speed) onKick(now, 0.5);
  }
  A.bass = bass; A.level += (bass - A.level) * 0.15;
  A.kick *= 0.9;
}
const IMP = { t: -1e9, n: 0, s: 1 };
const GROOVE = [[64.871, 116.79], [129.736, 1e9]];
function isHeavy(b, t, bass) { // v2476.62: heavy downbeats felt through the WHOLE song (bar downbeats with strong bass), strongest on the drops + climax grooves
  if ((b.dropPulse || 0) > 0.3) { IMP.s = 1; return true; }
  const g = GROOVE.find(r => t >= r[0] && t < r[1]), beatLen = 60 / 148.02;
  if (g) { const idx = Math.round((t - g[0]) / beatLen); if (idx % 4 === 0 && bass > 0.55) { IMP.s = 0.85; return true; } return false; }
  if (b.count % 4 === 0 && bass > 0.7) { IMP.s = 0.55; return true; }
  return false;
}
// impE: audio-time envelope while playing, shorter than one beat (0.405 s) so it never smears into the next kick
function impE(now) { if (!S.impact) return 0; const q = S.playing && IMP.at != null ? (A.t - IMP.at) / 0.34 : (now - IMP.t) / 650; return q < 0 || q > 1 ? 0 : (1 - q) * (1 - q) * (IMP.s || 1); }
function drawImpact(c, now) { // v2476.62: refined — soft light swell from the sun, gentle fading rays, slight brightness lift. No ripple rings.
  const e = impE(now); if (e <= 0.002) return;
  const p = L.p, cx = p.x + p.w * SUN.x, cy = p.y + p.h * SUN.y, I = 0.6 + 0.5 * S.intensity, R = p.w * (0.55 + 0.15 * e);
  c.save(); c.globalCompositeOperation = 'source-over';
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, `rgba(255,244,214,${0.42 * e * I})`); g.addColorStop(0.35, `rgba(255,226,170,${0.16 * e * I})`); g.addColorStop(1, 'rgba(255,220,160,0)');
  c.fillStyle = g; c.fillRect(0, 0, L.W, L.H);                                                   // lens-like glow swell from the sun
  c.globalAlpha = 0.07 * e * I; c.fillStyle = 'rgb(255,240,215)'; c.fillRect(p.x, p.y, p.w, p.h);  // slight overall brightness lift
  c.globalAlpha = 1; const n = 14, rot = (IMP.n * 0.37) % 6.2832;
  for (let i = 0; i < n; i++) { const an = rot + i * 6.2832 / n, len = p.w * (0.35 + 0.25 * ((i * 7) % 5) / 5);
    const lg = c.createLinearGradient(cx, cy, cx + Math.cos(an) * len, cy + Math.sin(an) * len); lg.addColorStop(0, `rgba(255,248,230,${0.22 * e * I})`); lg.addColorStop(1, 'rgba(255,248,230,0)');
    c.strokeStyle = lg; c.lineWidth = 1; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(an) * len, cy + Math.sin(an) * len); c.stroke(); } // fine fading rays
  c.restore();
}
function onKick(now, k) { A.lastKick = now; if (!S.playing) A.kick = 1; RG.beats++; const n = S.playing ? A.count : RG.beats; LZ.hit = now; if (S.laser && n % 8 === 0) LZ.pat = (LZ.pat + 1) % 3; if (S.glint) { sparkle(now, S.playing ? 1 : 1); if (S.playing && n % 16 === 0) sheen(now); } if (S.bloom && n % 4 === 0) autoBloom(now); }

/* ---------- pointer / tilt ---------- */
const T = { tx: 0, ty: 0, x: 0, y: 0, px: -1, py: -1 };
function onPointer(e) {
  T.tx = (e.clientX / L.W - 0.5) * 2; T.ty = (e.clientY / L.H - 0.5) * 2;
  T.px = e.clientX - L.p.x; T.py = e.clientY - L.p.y;
}
addEventListener('deviceorientation', e => {
  if (!Number.isFinite(e.gamma) || !Number.isFinite(e.beta)) return;
  T.tx = Math.max(-1, Math.min(1, e.gamma / 25)); T.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
});

/* ---------- RGB tri-colour light wash (restored from Light Player 三色照畫, /player/eternal-sun/ experience-lighting.js).
   Simulates red / green / blue-violet LED lamps shining on the painting (owner ref IMG_1681.MOV).
   The response images are built once into SEPARATE canvases and drawn on the #rgb overlay; the <img> is never touched. */
const LAMPS = ['green', 'red', 'blue'], LAMP_RGB = { red: [255, 120, 140], green: [85, 255, 125], blue: [120, 80, 255] };
const RG = { masks: {}, beats: 0, cur: 'green', from: 'green', changed: -1e9, lastKey: '' };
function lampResponse(r, g, b, c) {
  const fl = Math.max(0, g - r * .45 - b * .25), w = (r + g + b) / 3;
  if (c === 'red') return [r * .70 + g * .16 + b * .08 + 62, g * .36 + r * .14 + 26, b * .42 + r * .16 + 40]; // softer, paler red
  if (c === 'green') return [r * .30 + w * .1, g * .92 + w * .25 + fl * .25, b * .18];
  return [r * .22 + b * .25 + 20, g * .10 + fl * 1.25, b * .80 + r * .25 + w * .25 + 40];   // blue-violet: greens fluoresce
}
function buildRGB(img) {
  const w = 555, h = 768, t = document.createElement('canvas'); t.width = w; t.height = h;
  const x = t.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
  const src = x.getImageData(0, 0, w, h).data;
  for (const col of LAMPS) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const o = c.getContext('2d'), d = o.createImageData(w, h);
    for (let i = 0; i < src.length; i += 4) {
      const v = lampResponse(src[i], src[i + 1], src[i + 2], col);
      d.data[i] = Math.min(255, v[0]); d.data[i + 1] = Math.min(255, v[1]); d.data[i + 2] = Math.min(255, v[2]); d.data[i + 3] = 255;
    }
    o.putImageData(d, 0, 0); RG.masks[col] = c;
  }
  const rc = $('#rgb'); rc.width = w; rc.height = h;
}
function lampNow(now) {
  if (S.lamp !== 'auto') return S.lamp;
  const step = S.playing ? Math.floor(A.count / 2) : Math.floor(now * S.speed / 3500);
  return LAMPS[((step % 3) + 3) % 3];
}
function drawRGB(now) {
  const rc = $('#rgb'); const on = S.mode === 'rgb' && RG.masks.red;
  rc.classList.toggle('on', !!on); if (!on) return;
  const col = lampNow(now);
  if (col !== RG.cur) { RG.from = RG.cur; RG.cur = col; RG.changed = now; RG.changedT = A.t; }
  const mix = Math.min(1, S.playing ? Math.max(0, A.t - (RG.changedT || 0)) / 0.26 : (now - RG.changed) / 900), c = rc.getContext('2d'), op = k => (k === 'red' ? .78 : .86) * (0.55 + 0.5 * S.intensity);
  c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, rc.width, rc.height);
  if (mix < 1) { c.globalAlpha = op(RG.from) * (1 - mix); c.drawImage(RG.masks[RG.from], 0, 0); }
  c.globalAlpha = op(RG.cur) * (mix < 1 ? mix : 1); c.drawImage(RG.masks[RG.cur], 0, 0);
  // beat shimmer: lamp brightens slightly on each kick
  // night room: dim the lit painting between beats, flash back up on every kick (stronger while music plays)
  c.globalCompositeOperation = 'source-atop'; c.globalAlpha = Math.max(0, (S.playing ? 0.5 : 0.3) - (S.playing ? 0.45 : 0.2) * A.kick); c.fillStyle = '#05040a'; c.fillRect(0, 0, rc.width, rc.height);
  if (S.rgbStyle !== 'wash') { c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 1; const vg = c.createLinearGradient(0, 0, 0, rc.height); vg.addColorStop(0, 'rgba(5,4,10,0)'); vg.addColorStop(.45, 'rgba(5,4,10,0.12)'); vg.addColorStop(1, 'rgba(5,4,10,0.42)'); c.fillStyle = vg; c.fillRect(0, 0, rc.width, rc.height); }
  c.globalCompositeOperation = 'screen'; const L2 = lampColor(now);
  c.globalAlpha = 0.16 * A.kick + 0.04 * A.level; c.fillStyle = `rgb(${L2.join(',')})`; c.fillRect(0, 0, rc.width, rc.height);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}
function lampColor(now) {
  const a = LAMP_RGB[RG.from], b = LAMP_RGB[RG.cur], m = Math.min(1, S.playing ? Math.max(0, A.t - (RG.changedT || 0)) / 0.26 : (now - RG.changed) / 900);
  return a.map((v, i) => Math.round(v * (1 - m) + b[i] * m));
}

/* ---------- Club lasers (v2476.60): thin crisp beams from fixed emitters above the painting.
   patterns rotate every 8 kicks: fan sheet sweep / single-beam scan / crossing twin fans.
   On the beat the beams strobe hard on, then gate down; faint haze scatter along each beam; tips fade out. ---------- */
/* Lasers (v2476.63): faithful port of the homepage sound-light lasers (ae-home-light.js, GPT handoff 8b64dbf, unchanged in
   site v2476.26): six prismatic beams from off-frame origins onto the painting, refracted ray fans at each landing point,
   soft light pools, beat rings; flying depth bolts on each kick; small music spots. Coordinates mapped to the painting rect. */
const LASER = ['#ff416d', '#57ffa0', '#ffe28d', '#65dbff', '#c987ff', '#ffac68'];
const LZ = { pat: 0, hit: -1e9 };
const LWM = { thin: 1, mid: 1.9, thick: 3 }; const lwk = () => LWM[S.lw] || 1.9; // v75 雷射粗細 細/中/粗
let bolts = [], musicSpots = [], spots = [];
function fireBolts() {}
const variation = seed => { const n = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return n - Math.floor(n); };
function hpGeom() { const p = L.p; return { X0: p.x, W: p.w, T: p.y, H: p.h, sx: p.x + p.w * SUN.x, sy: p.y + p.h * SUN.y }; }
function hpDest(i, phase, now) {
  const G = hpGeom(), group = Math.floor((A.count || RG.beats) / 4), angle = i * Math.PI / 3 + phase * .24 + variation(group + 1) * 1.7;
  const t = { x: G.X0 + G.W * (.16 + .68 * (.5 + .5 * Math.sin(angle))), y: G.T + Math.max(30, G.H * (.20 + .60 * (.5 + .5 * Math.cos(angle * 1.3)))) };
  const impact = S.playing ? Math.min(1, (A.drop || 0) * 1.8) : 0;
  return { x: t.x * (1 - impact) + G.sx * impact, y: t.y * (1 - impact) + G.sy * impact };
}
function launchDepth(x, y, now, seed) {
  if (!S.laser) return; const G = hpGeom(), st = A.b ? A.b.stage : 'groove', number = S.playing ? (st === 'drop' ? 6 : 2) : 6;
  for (let i = 0; i < number; i++) {
    const edge = i % 3, ox = edge === 0 ? G.X0 - G.W * .12 : edge === 1 ? G.X0 + G.W * 1.12 : G.X0 + G.W * (.1 + ((i + seed) % 5) * .2), oy = edge === 2 ? G.T - 30 : G.T + G.H * (.1 + ((i + seed) % 5) * .16);
    const tg = x === null ? hpDest(i, seed, now) : { x, y };
    bolts.push({ ox, oy, x: tg.x, y: tg.y, born: now + (S.playing ? 0 : i * 12), life: S.playing ? 180 : 650, musical: S.playing, color: LASER[i] });
  }
  if (bolts.length > 36) bolts.splice(0, bolts.length - 36);
}
/* v2476.68: like the homepage, the sweep is NOT auto-fired during music any more (v67 stacked it on heavy beats + drops on top
   of the six music beams = up to 18 beams + 18 pools at once -> cluttered). It stays available as a manual effect only.
   v2476.67: lite v0.1.0 "laser show" sweep — six beams from off-frame emitters sweep across the art for 1.65 s, flaring on each
   beat of the audio grid (lite used a 0.405 s wall clock; here the flare is A.since from the real beat grid). Fired on heavy beats. */
const LSW = []; function laserShow(now) { LSW.push({ born: now, life: 1650, seed: variation(now % 1000) * 6 }); if (LSW.length > 2) LSW.shift(); }
function drawLaserShow(ctx, now, G, lite) {
  for (let n = LSW.length - 1; n >= 0; n--) if (now - LSW[n].born > LSW[n].life) LSW.splice(n, 1);
  for (const w of LSW) {
    const t = (now - w.born) / 1000, life = (now - w.born) / w.life, env = Math.sin(Math.PI * Math.min(1, life)) ** .5, pulse = S.playing ? Math.exp(-(A.since || 0) / 0.11) : (1 - ((t / .405) % 1)) ** 3;
    ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const ox = i % 3 === 0 ? G.X0 - G.W * .06 : i % 3 === 1 ? G.X0 + G.W * 1.06 : G.X0 + G.W * (.2 + i * .11), oy = i % 3 === 2 ? G.T - 16 : G.T + G.H * (.12 + (i % 4) * .2);
      const ph = t * (1.1 + i * .13) + i * 1.7 + w.seed, tx = G.X0 + G.W * (.5 + .4 * Math.sin(ph)), ty = G.T + Math.max(24, G.H * (.3 + .42 * (.5 + .5 * Math.cos(ph * 1.3))));
      const col = LASER[i], power = Math.min(1, env * (.35 + .65 * pulse));
      ctx.shadowColor = col; ctx.shadowBlur = lite ? 0 : 16 + pulse * 18; ctx.strokeStyle = col; ctx.globalAlpha = power; ctx.lineWidth = 1.2 + pulse * 2.4;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.shadowBlur = lite ? 0 : 4; ctx.strokeStyle = '#fff9df'; ctx.lineWidth = .7; ctx.globalAlpha = power * .8; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      const pool = ctx.createRadialGradient(tx, ty, 1, tx, ty, 30 + pulse * 34); pool.addColorStop(0, `rgba(255,249,218,${power * .7})`); pool.addColorStop(.2, col + Math.round(power * 90).toString(16).padStart(2, '0')); pool.addColorStop(1, col + '00');
      ctx.fillStyle = pool; ctx.fillRect(tx - 70, ty - 70, 140, 140);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
  }
}
function drawLasers(ctx, now) {
  if (S.home && document.body.dataset.original !== '1') return; // v71: with 歡樂派對 on, 雷射 = the homepage lasers only (no stacked premium set)
  const G = hpGeom(), lite = S.engine === 'lite';
  ctx.save(); ctx.beginPath(); ctx.rect(G.X0, G.T, G.W, G.H); ctx.clip();
  if (S.laser) {
    const b = S.playing && A.b ? A.b : { count: RG.beats, pulse: A.kick, phase: 0, stage: 'groove', dropPulse: 0, buildProgress: 0, sweep: now / 405 };
    const pulse = S.playing ? (A.b ? A.b.pulse : A.kickQ) : A.kick, colors = LASER, sweep = b.sweep || 0; // v2476.68: homepage beat.pulse envelope
    // v2476.67 (AE Player lite v0.1.0, ecbfd41): warm sun glow breathing under the beams, and a beat-locked laser show sweep on heavy beats.
    if (S.playing) { const en = Math.max(A.level, (LZ.en || 0) * .84); LZ.en = en; const R0 = Math.min(G.W * .42, 190) * Math.max(1, G.W / 460);
      const sg = ctx.createRadialGradient(G.sx, G.sy, 3, G.sx, G.sy, R0); sg.addColorStop(0, `rgba(255,223,115,${en * .16 + pulse * .35})`); sg.addColorStop(.45, `rgba(243,178,48,${en * .08 + pulse * .18})`); sg.addColorStop(1, 'rgba(240,170,45,0)');
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = sg; ctx.fillRect(G.X0, G.T, G.W, G.H); }
    drawLaserShow(ctx, now, G, lite);
    ctx.globalCompositeOperation = 'screen';
    const group = Math.floor(b.count / 4), pattern = Math.floor(variation(group + 3) * 3), beamCount = b.stage === 'build' ? (b.buildProgress > .7 ? 5 : 3) : 6;
    LZ.pat = pattern; const energy = A.level;
    for (let i = 0; i < beamCount; i++) {
      const originX = i % 3 === 0 ? G.X0 - G.W * .08 : i % 3 === 1 ? G.X0 + G.W * 1.08 : G.X0 + G.W * (.15 + i * .12), originY = i % 3 === 2 ? G.T - 20 : G.T + G.H * (.15 + (i % 4) * .20);
      const tg = hpDest(i, sweep, now), targetX = tg.x, targetY = tg.y;
      const power = Math.min(1, ((b.stage === 'build' ? .06 + b.buildProgress * .06 : .07) + energy * .035 + pulse * .85 + (b.dropPulse || 0) * .12) * Math.min(1, 0.6 + 0.6 * S.intensity) + (S.playing ? 0 : .12));
      const W0 = (1.2 + pulse * 2.4) * lwk(); ctx.save(); ctx.globalCompositeOperation = S.night ? 'screen' : 'source-over'; ctx.lineCap = 'round'; ctx.strokeStyle = colors[i]; ctx.shadowColor = colors[i]; ctx.shadowBlur = lite ? 0 : W0 * 3;
      ctx.globalAlpha = power * .22; ctx.lineWidth = W0 * 4.2; ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(targetX, targetY); ctx.stroke(); ctx.globalAlpha = power * .4; ctx.lineWidth = W0 * 2; ctx.stroke(); ctx.restore(); // v75 coloured outer halo
      ctx.shadowColor = colors[i]; ctx.shadowBlur = lite ? 0 : 14 + pulse * 25;
      ctx.strokeStyle = colors[i]; ctx.globalAlpha = Math.min(1, power * 1.3 + .1); ctx.lineWidth = W0;
      ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(targetX, targetY); ctx.stroke();
      ctx.shadowBlur = lite ? 0 : 4; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = .9 * Math.sqrt(lwk()); ctx.globalAlpha = Math.min(1, power * 1.1 + .15);
      ctx.beginPath(); ctx.moveTo(originX, originY); ctx.lineTo(targetX, targetY); ctx.stroke();
      // v75: the 3-line prismatic split at the landing point is gone — the round pool below is the single impact light spot
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      const pool = ctx.createRadialGradient(targetX, targetY, 1, targetX, targetY, (44 + pulse * 54) * (.85 + .15 * lwk()));
      pool.addColorStop(0, `rgba(255,249,218,${power * .60})`); pool.addColorStop(.18, colors[i] + Math.round(power * 75).toString(16).padStart(2, '0')); pool.addColorStop(1, colors[i] + '00');
      ctx.fillStyle = pool; ctx.fillRect(targetX - 90, targetY - 90, 180, 180);
      ctx.strokeStyle = colors[i]; ctx.lineWidth = .7; ctx.globalAlpha = pulse * .6; ctx.beginPath(); ctx.arc(targetX, targetY, Math.max(0, 8 + Math.min(1, b.phase) * 28), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
    bolts = bolts.filter(q => now - q.born < q.life);
    ctx.globalCompositeOperation = 'screen';
    for (const q of bolts) {
      const pr = Math.max(0, (now - q.born) / q.life), tail = Math.max(0, pr - .32), near = (1 - pr) ** 2, back = (1 - tail) ** 2;
      const opacity = q.musical ? EN.flightPower((now - q.born) / 1000) : Math.sin(Math.PI * pr);
      const tipX = q.x + (q.ox - q.x) * near, tipY = q.y + (q.oy - q.y) * near, startX = q.x + (q.ox - q.x) * back, startY = q.y + (q.oy - q.y) * back;
      const streak = ctx.createLinearGradient(startX, startY, tipX, tipY); streak.addColorStop(0, q.color + '00'); streak.addColorStop(1, q.color);
      ctx.strokeStyle = streak; ctx.lineWidth = (1.4 + (1 - pr) * 7) * lwk(); ctx.shadowColor = q.color; ctx.shadowBlur = lite ? 0 : 20; ctx.globalAlpha = opacity * .95;
      ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.strokeStyle = '#fff9e9'; ctx.lineWidth = (.7 + (1 - pr) * 1.5) * Math.sqrt(lwk()); ctx.globalAlpha = opacity * .85;
      ctx.beginPath(); ctx.moveTo(startX + (tipX - startX) * .5, startY + (tipY - startY) * .5); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.fillStyle = '#fff6d2'; ctx.beginPath(); ctx.arc(tipX, tipY, Math.max(0, 1.5 + (1 - pr) * 2), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    const st = A.b ? A.b.stage : 'groove', musicLife = st === 'build' ? 90 : 150;
    musicSpots = musicSpots.filter(s => now - s.born < musicLife);
    for (const s of musicSpots) {
      const life = (now - s.born) / musicLife, opacity = (1 - life) * (st === 'build' ? .55 + (A.b.buildProgress || 0) * .25 : .65), radius = st === 'build' ? 24 + life * 44 : 18 + life * 38;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius); g.addColorStop(0, `rgba(255,247,207,${opacity})`); g.addColorStop(1, 'rgba(255,210,80,0)');
      ctx.fillStyle = g; ctx.fillRect(s.x - radius, s.y - radius, radius * 2, radius * 2);
    }
  } else { bolts.length = 0; musicSpots.length = 0; }
  ctx.restore(); ctx.globalAlpha = 1;
}
/* homepage tap response (ring + soft gold pool, 1.1 s) + gold burst element; in gallery/glint presets the stars also scatter from the finger */
let tapStars = [];
function drawTaps(ctx, now) {
  const touchLife = 1100; spots = spots.filter(s => now - s.born < touchLife);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (const s of spots) {
    const life = (now - s.born) / touchLife, opacity = 1 - life, radius = 35 + life * 90;
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius); g.addColorStop(0, `rgba(255,249,210,${opacity})`); g.addColorStop(.22, `rgba(255,217,108,${opacity * .8})`); g.addColorStop(1, 'rgba(245,180,45,0)');
    ctx.fillStyle = g; ctx.fillRect(s.x - radius, s.y - radius, radius * 2, radius * 2);
    ctx.strokeStyle = `rgba(255,222,127,${opacity})`; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(0, 8 + life * 55), 0, Math.PI * 2); ctx.stroke();
  }
  tapStars = tapStars.filter(q => now - q.t < q.life);
  for (const q of tapStars) {
    const u = (now - q.t) / q.life, e = 1 - (1 - u) ** 3, x = q.x + q.vx * e, y = q.y + q.vy * e + 12 * u * u, a = (1 - u) ** 1.5, r = q.s * (1 - .5 * u);
    const mg = ctx.createRadialGradient(x, y, 0, x, y, r); mg.addColorStop(0, `rgba(255,250,236,${a * .85})`); mg.addColorStop(.4, `rgba(255,222,160,${a * .35})`); mg.addColorStop(1, 'rgba(255,210,140,0)');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
function artTap(x, y) { // x,y in stage (un-zoomed) coordinates
  if (window.aeHomeReplica && document.body.dataset.original !== '1') window.aeHomeReplica.tap(x, y); // v70: homepage tap beams + gold ripple in ALL modes
  if (S.home && window.aeHomeReplica) { if (!A.started && !S.playing) togglePlay(); RG.taps = (RG.taps || 0) + 1; tapSound(x); return; } // v2476.69: homepage tap (beams + gold ripples)
  if (!A.started && !S.playing) { togglePlay(); tapSound(x); return; } // v2476.65: first tap on the painting starts the music
  if (S.playing) beatTap(x, y);
  const now = performance.now(); RG.taps = (RG.taps || 0) + 1; // ring + gold burst now come from the global homepage tap layer
  if (S.glint || S.preset === 'gallery') for (let i = 0; i < 10; i++) { const an = Math.random() * 6.2832, d = 30 + Math.random() * 90; tapStars.push({ t: now, x, y, vx: Math.cos(an) * d, vy: Math.sin(an) * d, s: 3 + Math.random() * 5, life: 700 + Math.random() * 600 }); }
  tapSound(x);
}
/* v2476.65 beat taps: while playing, a tap is judged against the audio beat grid (same clock as the lights).
   on-beat (<=70 ms, perfect <=35 ms): warm halo + a soft bell note from C# minor pentatonic (the song's key), climbing with the combo;
   off-beat: just the normal ring. Consecutive on-beat taps build a combo (shown as a small fading ×N), dragging leaves a light trail. */
const GAME = { combo: 0, best: 0, last: 0, hits: 0, perfect: 0, taps: 0, marks: [], trail: [], ac: null };
const PENTA = [554.37, 659.25, 739.99, 830.61, 987.77, 1108.73, 1318.51, 1479.98];
function beatErr() { const ev = TL && TL.events; if (!ev || !ev.length) return 9; const t = CK.tt != null ? CK.tt : A.t; let lo = 0, hi = ev.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m] <= t) lo = m + 1; else hi = m; } const a = lo ? t - ev[lo - 1] : 9, b = lo < ev.length ? ev[lo] - t : 9; return a < b ? a : -b; }
// v2476.66 tap sounds: only the song's tonic C# and its fifth G#, very quiet, high-passed so they sit above the mix
// like a glass/coin "ting"; plus a 4 ms filtered click. No scale climbing, nothing that can clash with the track.
const TONE = { root: 1108.73, fifth: 1661.22, vol: 0.022 };
function acx() { const c = GAME.ac || (GAME.ac = LAT.ctx || new (window.AudioContext || window.webkitAudioContext)()); if (c.state === 'suspended') c.resume(); return c; }
function ting(perfect) {
  try { const c = acx(), t = c.currentTime + 0.005, out = c.createGain(), hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900; out.gain.value = TONE.vol * (perfect ? 1 : 0.6); hp.connect(out); out.connect(c.destination);
    const notes = perfect ? [[TONE.root, 1, 0.9], [TONE.fifth, 0.45, 0.7]] : [[TONE.root, 0.8, 0.55]];
    for (const [f, g, d] of notes) for (const [m, k] of [[1, 1], [2.756, .18]]) { const o = c.createOscillator(), v = c.createGain(); o.type = 'sine'; o.frequency.value = f * m; v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g * k, t + .004); v.gain.exponentialRampToValueAtTime(0.0001, t + d * (m > 1 ? .35 : 1)); o.connect(v); v.connect(hp); o.start(t); o.stop(t + d + .05); }
    const n = c.createBuffer(1, Math.round(c.sampleRate * 0.004), c.sampleRate), dd = n.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / dd.length);
    const ns = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain(); ns.buffer = n; bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 1.2; ng.gain.value = perfect ? 0.5 : 0.35; ns.connect(bp); bp.connect(ng); ng.connect(hp); ns.start(t);
    GAME.sounds = (GAME.sounds || 0) + 1;
  } catch (e) {}
}
/* v72 tap sound setting: 音階 (scale chime / ting, as before) or EDM kick 輕/中/重 — short, tight, sub-heavy, ducked under the track */
const TAPSND = { mode: (() => { try { return localStorage.getItem('ae-premium-tapsnd') || 'scale'; } catch (e) { return 'scale'; } })(), n: 0 };
/* v75 808-style kick: deep sub sine sweep (~155→45 Hz) with a long tail, a separate 45 Hz sub layer, a click transient;
   輕/中/重 differ in length, sub weight and click; 重 adds tanh saturation + the longest boom. All kicks go through a
   compressor + brick-wall limiter bus so stacked taps never clip. */
const KICKS = { k1: { f0: 150, f1: 55, pd: 0.06, d: 0.32, g: 0.55, sub: 0.0, click: 0.28, drive: 0 },
                k2: { f0: 155, f1: 47, pd: 0.085, d: 0.7, g: 0.8, sub: 0.45, click: 0.4, drive: 0 },
                k3: { f0: 160, f1: 43, pd: 0.11, d: 1.35, g: 0.95, sub: 0.8, click: 0.55, drive: 5 } };
function kbus(c) { if (GAME.kbus && GAME.kbus.context === c) return GAME.kbus;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.25;
  const lim = c.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
  const mg = c.createGain(); mg.gain.value = 0.9; comp.connect(lim); lim.connect(mg); mg.connect(c.destination); GAME.kbus = comp; return comp; }
function kick(lv) {
  try { const K = KICKS[lv] || KICKS.k2, c = acx(), t = c.currentTime + 0.004, duck = S.playing ? 0.75 : 1, out = c.createGain(); out.gain.value = K.g * duck; out.connect(kbus(c));
    let body = out;
    if (K.drive) { const ws = c.createWaveShaper(), cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cv[i] = Math.tanh(x * K.drive) / Math.tanh(K.drive); } ws.curve = cv; ws.oversample = '4x';
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; ws.connect(lp); lp.connect(out); const pre = c.createGain(); pre.gain.value = 1.4; pre.connect(ws); body = pre; }
    const o = c.createOscillator(), v = c.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(K.f0, t); o.frequency.exponentialRampToValueAtTime(K.f1, t + K.pd); o.frequency.linearRampToValueAtTime(K.f1 * 0.94, t + K.d);
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(1, t + 0.0015); v.gain.setTargetAtTime(0.55, t + 0.01, 0.06); v.gain.setTargetAtTime(0.0001, t + 0.08, K.d / 4); o.connect(v); v.connect(body); o.start(t); o.stop(t + K.d + 0.15);
    if (K.sub) { const so = c.createOscillator(), sg = c.createGain(); so.type = 'sine'; so.frequency.value = K.f1 * 0.98; sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(K.sub, t + 0.02); sg.gain.setTargetAtTime(0.0001, t + 0.12, K.d / 3.5); so.connect(sg); sg.connect(body); so.start(t); so.stop(t + K.d + 0.2); }
    const n = c.createBuffer(1, Math.round(c.sampleRate * 0.005), c.sampleRate), dd = n.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / dd.length) ** 2;
    const ns = c.createBufferSource(), hp = c.createBiquadFilter(), ng = c.createGain(); ns.buffer = n; hp.type = 'highpass'; hp.frequency.value = 2500; ng.gain.value = K.click; ns.connect(hp); hp.connect(ng); ng.connect(out); ns.start(t);
    const bo = c.createOscillator(), bg = c.createGain(); bo.type = 'triangle'; bo.frequency.setValueAtTime(1200, t); bo.frequency.exponentialRampToValueAtTime(300, t + 0.012); bg.gain.setValueAtTime(K.click * 0.6, t); bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.014); bo.connect(bg); bg.connect(out); bo.start(t); bo.stop(t + 0.02);
    TAPSND.n++; GAME.sounds = (GAME.sounds || 0) + 1;
  } catch (e) {}
}
function tapSound(x) { if (TAPSND.mode !== 'scale') { kick(TAPSND.mode); return true; } if (!S.playing && window.aeChime && window.aeChime.tap) try { window.aeChime.tap((x - L.p.x) / Math.max(L.p.w, 1)); } catch (e) {} return false; }
function setTapSound(m) { TAPSND.mode = m; try { localStorage.setItem('ae-premium-tapsnd', m); } catch (e) {} document.querySelectorAll('.ts').forEach(b => { b.classList.toggle('on', b.dataset.s === m); b.setAttribute('aria-pressed', String(b.dataset.s === m)); }); if (m !== 'scale') kick(m); }
function beatTap(x, y) {
  const now = performance.now(), e = beatErr(), ae = Math.abs(e); GAME.taps++; GAME.lastErr = Math.round(e * 1000);
  if (ae <= 0.07) { GAME.combo = now - GAME.last < 2600 ? GAME.combo + 1 : 1; GAME.last = now; GAME.hits++; const perfect = ae <= 0.035; if (perfect) GAME.perfect++;
    GAME.best = Math.max(GAME.best, GAME.combo); if (perfect) bloom(now, x, y);
    if (TAPSND.mode === 'scale') ting(perfect);
    GAME.marks.push({ t: now, x, y, n: GAME.combo, perfect }); if (GAME.marks.length > 4) GAME.marks.shift();
  } else { GAME.combo = 0; }
}
function drawGame(c, now) {
  GAME.marks = GAME.marks.filter(m => now - m.t < 1300); GAME.trail = GAME.trail.filter(q => now - q.t < 650);
  c.save(); c.globalCompositeOperation = 'screen';
  for (let i = 1; i < GAME.trail.length; i++) { const a = GAME.trail[i - 1], b = GAME.trail[i]; if (b.t - a.t > 80) continue; const k = 1 - (now - b.t) / 650;
    c.strokeStyle = `rgba(255,226,160,${k * .5})`; c.lineWidth = 1 + 5 * k; c.lineCap = 'round'; c.shadowColor = 'rgba(255,200,120,.9)'; c.shadowBlur = 10 * k; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
  c.shadowBlur = 0;
  cxC.setTransform(1, 0, 0, 1, 0, 0); cxC.clearRect(0, 0, cxC.canvas.width, cxC.canvas.height); cxC.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  drawConfetti(cxC, now);
  for (const m of GAME.marks) drawCoin(cxC, now, m);
  c.restore();
}
/* v2476.66 reward coin: a small rendered gold coin (rim, embossed sun, specular sweep) that pops, rises a little and shimmers.
   perfect = larger, brighter, soft halo + 'Perfect'; good = smaller, dimmer + 'Nice'. Labels are thin, small, semi-transparent. */
function drawCoin(c, now, m) {
  // v2476.67: a flat struck coin — circular face, visible milled edge (thickness) as it tilts, reeded rim, engraved sun,
  // dark hairline outline + contact shadow so it reads on the brightest parts of the painting.
  const u = (now - m.t) / 1300; if (u < 0 || u > 1) return;
  const pop = u < .16 ? 1 - (1 - u / .16) ** 3 : 1 + .06 * Math.sin(Math.min(1, (u - .16) / .22) * Math.PI) * (1 - u);
  const R0 = (m.perfect ? 17 : 12) * Math.max(.85, Math.min(1.3, L.p.w / 520)), r = R0 * Math.max(.01, pop), a = u < .7 ? 1 : 1 - (u - .7) / .3;
  const x = m.x, y = m.y - 26 - 22 * Math.sqrt(u);
  const ue = Math.min(1, u / .42), th = 1.05 * (1 - ue) ** 2 + .12 * Math.sin(u * 9) * (1 - u), cs = Math.cos(th), T = r * .24 * Math.sin(Math.abs(th)), rx = r * cs; // tilt about the vertical axis
  c.save(); c.globalAlpha = a;
  if (m.perfect) { const h = c.createRadialGradient(x, y, r * .4, x, y, r * 3.2); h.addColorStop(0, 'rgba(255,220,140,.30)'); h.addColorStop(1, 'rgba(255,200,110,0)'); c.globalCompositeOperation = 'screen'; c.fillStyle = h; c.beginPath(); c.arc(x, y, r * 3.2, 0, 6.2832); c.fill(); c.globalCompositeOperation = 'source-over'; }
  // soft contact shadow (helps on bright paint)
  c.fillStyle = 'rgba(20,10,0,.28)'; c.beginPath(); c.ellipse(x + T * .5 + 1.5, y + r * .12 + 2.5, rx + T + 1.5, r + 1.5, 0, 0, 6.2832); c.fill();
  // edge / thickness: back face + band, reeded
  const eg = c.createLinearGradient(x - rx, 0, x + rx + T, 0); eg.addColorStop(0, '#6b4512'); eg.addColorStop(.5, '#b9852f'); eg.addColorStop(1, '#5a3a0f');
  c.fillStyle = eg; c.beginPath(); c.ellipse(x + T, y, rx, r, 0, -Math.PI / 2, Math.PI / 2); c.lineTo(x, y + r); c.ellipse(x, y, rx, r, 0, Math.PI / 2, -Math.PI / 2, true); c.closePath(); c.fill();
  if (T > .8) { c.strokeStyle = 'rgba(60,36,6,.55)'; c.lineWidth = .6; for (let k = -8; k <= 8; k++) { const yy = y + (k / 9) * r, w = Math.sqrt(Math.max(0, 1 - (k / 9) ** 2)); c.beginPath(); c.moveTo(x + rx * w, yy); c.lineTo(x + rx * w + T, yy); c.stroke(); } }
  // face
  c.save(); c.translate(x, y); c.scale(Math.max(.05, cs), 1);
  const rim = c.createLinearGradient(-r, -r, r, r); rim.addColorStop(0, '#fff1c0'); rim.addColorStop(.4, '#e2b45a'); rim.addColorStop(.75, '#9c6b22'); rim.addColorStop(1, '#efcb78');
  c.fillStyle = rim; c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.fill();
  c.strokeStyle = 'rgba(110,70,16,.6)'; c.lineWidth = Math.max(.5, r * .035); for (let k = 0; k < 48; k++) { const an = k / 48 * 6.2832; c.beginPath(); c.moveTo(Math.cos(an) * r * .86, Math.sin(an) * r * .86); c.lineTo(Math.cos(an) * r * .97, Math.sin(an) * r * .97); c.stroke(); } // reeded rim
  const face = c.createRadialGradient(-r * .3, -r * .35, r * .08, 0, 0, r * .82); face.addColorStop(0, '#ffefbd'); face.addColorStop(.55, '#e6b85d'); face.addColorStop(1, '#b17d2d');
  c.fillStyle = face; c.beginPath(); c.arc(0, 0, r * .8, 0, 6.2832); c.fill();
  c.strokeStyle = 'rgba(255,244,210,.7)'; c.lineWidth = Math.max(.5, r * .03); c.beginPath(); c.arc(0, 0, r * .8, -2.4, -0.6); c.stroke(); // bevel light
  c.strokeStyle = 'rgba(110,70,16,.7)'; c.lineWidth = Math.max(.6, r * .045); c.beginPath(); c.arc(0, 0, r * .22, 0, 6.2832); c.stroke(); // engraved sun
  for (let k = 0; k < 12; k++) { const an = k * .5236; c.beginPath(); c.moveTo(Math.cos(an) * r * .3, Math.sin(an) * r * .3); c.lineTo(Math.cos(an) * r * (k % 2 ? .45 : .56), Math.sin(an) * r * (k % 2 ? .45 : .56)); c.stroke(); }
  c.strokeStyle = 'rgba(255,246,214,.55)'; c.lineWidth = Math.max(.4, r * .02); c.beginPath(); c.arc(-r * .01, -r * .015, r * .22, 3.4, 5.2); c.stroke();
  c.save(); c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.clip(); const sx = -r * 1.6 + r * 3.2 * ((u * 1.6) % 1);
  const sg = c.createLinearGradient(sx - r * .3, -r, sx + r * .3, r); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, `rgba(255,255,250,${m.perfect ? .6 : .4})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
  c.globalCompositeOperation = 'screen'; c.fillStyle = sg; c.fillRect(-r, -r, r * 2, r * 2); c.restore();
  c.strokeStyle = 'rgba(40,22,4,.75)'; c.lineWidth = 1 / Math.max(.3, cs); c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.stroke(); // dark hairline outline
  c.restore(); c.restore();
  const la = Math.max(0, 1 - u / .8) * (m.perfect ? .95 : .78);
  if (la > 0) { c.save(); c.globalAlpha = la; c.font = `italic 500 ${m.perfect ? 13 : 12}px "Cormorant Garamond", Georgia, serif`; c.textAlign = 'center'; if (c.letterSpacing !== undefined) c.letterSpacing = '1.5px';
    const txt = (m.perfect ? 'Perfect' : 'Nice') + (m.n >= 2 ? '  ×' + m.n : ''), ty = y - R0 - 10 - 6 * u;
    c.lineJoin = 'round'; c.strokeStyle = 'rgba(30,16,2,.45)'; c.lineWidth = 2.2; c.strokeText(txt, x, ty); c.fillStyle = '#fff4d6'; c.fillText(txt, x, ty); c.restore(); }
}
/* v2476.67 派對 party layer (overlay only, all timing from the audio beat grid + onset map):
   drops/climax -> coloured light motes + gold confetti burst from the frame edges; heavy beats -> soft coloured sweep;
   bar downbeats -> faint multicolour bloom from the sun. Confetti is drawn on the normal-blend coin layer so gold reads as foil. */
const PT = { motes: [], conf: [], sweeps: [], blooms: [], bursts: 0, lastDrop: -1, lastOn: -1 };
const PCOL = ['#ff5c8a', '#5effb0', '#ffe08a', '#6fd8ff', '#c98bff', '#ffb070'];
function partyBurst(now, big) {
  const p = L.p, n = big ? 46 : 18, m = big ? 30 : 10; PT.bursts++;
  for (let i = 0; i < n; i++) { const side = i % 4, u = Math.random(); const [x, y, an] = side === 0 ? [p.x + p.w * u, p.y, Math.PI / 2] : side === 1 ? [p.x + p.w, p.y + p.h * u, Math.PI] : side === 2 ? [p.x + p.w * u, p.y + p.h, -Math.PI / 2] : [p.x, p.y + p.h * u, 0];
    const a2 = an + (Math.random() - .5) * 1.3, v = (160 + Math.random() * 300) * Math.max(.7, p.w / 520);
    PT.motes.push({ t: now, x, y, vx: Math.cos(a2) * v, vy: Math.sin(a2) * v, col: PCOL[i % PCOL.length], r: 3 + Math.random() * 4, life: 1100 + Math.random() * 900 }); }
  for (let i = 0; i < m; i++) { const side = i % 2, u = Math.random(), x = side ? p.x + p.w - 4 : p.x + 4, y = p.y + p.h * (.05 + .35 * u);
    const v = (220 + Math.random() * 300) * Math.max(.7, p.w / 520), a2 = (side ? Math.PI - .35 : .35) + (Math.random() - .5) * .9;
    PT.conf.push({ t: now, x, y, vx: Math.cos(a2) * v, vy: Math.sin(a2) * v - 80, w: 8 + Math.random() * 6, h: 4 + Math.random() * 3, rot: Math.random() * 6, vr: (Math.random() - .5) * 14, flip: Math.random() * 6, vf: 6 + Math.random() * 8, tone: i % 3, life: 2200 + Math.random() * 900 }); }
  if (PT.motes.length > 160) PT.motes.splice(0, PT.motes.length - 160); if (PT.conf.length > 90) PT.conf.splice(0, PT.conf.length - 90);
}
function partyHeavy(now) { if (!S.party || !S.playing) return; PT.sweeps.push({ t: now, dir: (IMP.n % 2) ? 1 : -1, col: PCOL[IMP.n % PCOL.length] }); if (PT.sweeps.length > 3) PT.sweeps.shift(); }
function partyBeat(b, now) {
  if (!S.party || !S.playing) return;
  if (b.count % 4 === 1 && b.stage !== 'build') { PT.blooms.push({ t: now, c1: PCOL[(b.count >> 2) % 6], c2: PCOL[((b.count >> 2) + 3) % 6] }); if (PT.blooms.length > 2) PT.blooms.shift(); }
  const secs = (TL && TL.sections) || []; for (let k = 0; k < secs.length; k++) { const d = secs[k].drop; if (PT.lastDrop === k && A.t < d - 1) PT.lastDrop = -1; if (PT.lastDrop !== k && A.t >= d - 0.02 && A.t < d + 0.6) { PT.lastDrop = k; partyBurst(now, true); } }
  const gr = GROOVE.find(r => A.t >= r[0] && A.t < r[1]); if ((b.stage === 'drop' || gr) && b.count % 16 === 0) partyBurst(now, false); // drop + climax grooves: smaller edge bursts every 4 bars
}
function drawParty(c, now) { // screen layer: motes, sweeps, blooms
  if (!S.party) { PT.motes.length = PT.sweeps.length = PT.blooms.length = 0; return; }
  const p = L.p, dt = Math.min(.05, (now - (PT.lt || now)) / 1000); PT.lt = now;
  // onset-map sparkle: small motes from the edges on fast onsets during drops
  if (S.playing && OM.n !== PT.lastOn && A.b && (A.b.stage === 'drop' || GROOVE.some(r => A.t >= r[0] && A.t < r[1]))) { PT.lastOn = OM.n; if (Math.random() < .5) { const u = Math.random(), top = Math.random() < .5; PT.motes.push({ t: now, x: p.x + p.w * u, y: top ? p.y : p.y + p.h, vx: (Math.random() - .5) * 60, vy: (top ? 1 : -1) * (60 + Math.random() * 80), col: PCOL[OM.n % 6], r: 1.6 + Math.random() * 2, life: 700 }); } }
  c.save(); c.beginPath(); c.rect(p.x - 40, p.y - 40, p.w + 80, p.h + 80); c.clip(); c.globalCompositeOperation = 'screen';
  PT.blooms = PT.blooms.filter(q => now - q.t < 900);
  for (const q of PT.blooms) { const u = (now - q.t) / 900, a = Math.sin(Math.PI * Math.min(1, u * 2.2)) * (1 - u) * .32, R = p.w * (.18 + .5 * u), X = p.x + p.w * SUN.x, Y = p.y + p.h * SUN.y;
    const g = c.createRadialGradient(X, Y, 0, X, Y, R); g.addColorStop(0, `rgba(255,250,235,${a})`); g.addColorStop(.35, q.c1 + Math.round(a * 200).toString(16).padStart(2, '0')); g.addColorStop(.7, q.c2 + Math.round(a * 120).toString(16).padStart(2, '0')); g.addColorStop(1, q.c2 + '00'); c.fillStyle = g; c.beginPath(); c.arc(X, Y, R, 0, 6.2832); c.fill(); }
  PT.sweeps = PT.sweeps.filter(q => now - q.t < 700);
  for (const q of PT.sweeps) { const u = (now - q.t) / 700, e = u * u * (3 - 2 * u), a = Math.sin(Math.PI * u) * .16, w = p.w * .18, cx = q.dir > 0 ? p.x - w + (p.w + 2 * w) * e : p.x + p.w + w - (p.w + 2 * w) * e;
    c.save(); c.beginPath(); c.rect(p.x, p.y, p.w, p.h); c.clip(); c.translate(cx, p.y + p.h / 2); c.rotate(q.dir * .32); const lg = c.createLinearGradient(-w, 0, w, 0); lg.addColorStop(0, q.col + '00'); lg.addColorStop(.5, q.col + Math.round(a * 255).toString(16).padStart(2, '0')); lg.addColorStop(1, q.col + '00'); c.fillStyle = lg; c.fillRect(-w, -p.h, 2 * w, 2 * p.h); c.restore(); }
  c.restore();
}
function drawConfetti(c, now) { // normal blend: light motes + gold foil confetti with a two-tone flip
  if (!S.party) { PT.conf.length = 0; return; } const dt = Math.min(.05, (now - (PT.ct || now)) / 1000); PT.ct = now;
  PT.motes = PT.motes.filter(q => now - q.t < q.life);
  for (const q of PT.motes) { q.vx *= (1 - 1.3 * dt); q.vy *= (1 - 1.3 * dt); q.x += q.vx * dt; q.y += q.vy * dt; const u = (now - q.t) / q.life, a = (1 - u) ** 1.2 * (.75 + .25 * Math.sin(now / 60 + q.r * 9)), R = q.r * 2.4;
    c.globalAlpha = a; const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, R); g.addColorStop(0, '#ffffff'); g.addColorStop(.28, q.col); g.addColorStop(.62, q.col + '88'); g.addColorStop(1, q.col + '00'); c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, R, 0, 6.2832); c.fill(); }
  c.globalAlpha = 1;

  PT.conf = PT.conf.filter(q => now - q.t < q.life);
  for (const q of PT.conf) { q.vy += 260 * dt; q.vx *= (1 - 1.2 * dt); q.vy *= (1 - 1.0 * dt); q.x += q.vx * dt + Math.sin(now / 300 + q.rot) * 14 * dt; q.y += q.vy * dt; q.rot += q.vr * dt; q.flip += q.vf * dt;
    const u = (now - q.t) / q.life, a = Math.min(1, (1 - u) * 2.5), f = Math.cos(q.flip), lit = f > 0;
    c.save(); c.globalAlpha = a; c.translate(q.x, q.y); c.rotate(q.rot); c.scale(1, Math.max(.12, Math.abs(f)));
    c.fillStyle = q.tone === 2 ? (lit ? '#f6f1e6' : '#b9b2a2') : (lit ? (q.tone ? '#ffe3a0' : '#f2c75f') : (q.tone ? '#b98a35' : '#9a6c22'));
    c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); if (f > .9) { c.fillStyle = `rgba(255,255,245,${(f - .9) * 9})`; c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); } c.strokeStyle = 'rgba(50,30,6,.55)'; c.lineWidth = .5; c.strokeRect(-q.w / 2, -q.h / 2, q.w, q.h); c.restore(); }
}
/* v2476.66 光紋 (light pattern): optional mode — finger strokes on the painting persist, breathe with the beat, and can be
   saved as a personal card (painting crop + the drawn light, composited in a new image; the page's artwork is never touched). */
const GLOW = { on: false, strokes: [], cur: null, saved: 0 };
function glowDown(e) { if (!GLOW.on || Z.pts.size !== 1) return; const q = toArt(e); if (!q) return; GLOW.cur = { pts: [q], hue: GLOW.strokes.length % 3 }; GLOW.strokes.push(GLOW.cur); if (GLOW.strokes.length > 60) GLOW.strokes.shift(); }
function glowMove(e) { if (!GLOW.on || !GLOW.cur || Z.pts.size !== 1) { GLOW.cur = null; return; } const q = toArt(e); if (!q) return; const l = GLOW.cur.pts[GLOW.cur.pts.length - 1]; if (Math.hypot(q.u - l.u, q.v - l.v) > 0.004) GLOW.cur.pts.push(q); }
function toArt(e) { const x = (e.clientX - Z.x) / Z.s, y = (e.clientY - Z.y) / Z.s, p = L.p; if (x < p.x || x > p.x + p.w || y < p.y || y > p.y + p.h) return null; return { u: (x - p.x) / p.w, v: (y - p.y) / p.h }; }
const GLOW_COL = [[255, 214, 140], [255, 236, 196], [255, 190, 120]];
function strokeGlow(c, p, ox, oy, sc, now, breath) {
  c.save(); c.globalCompositeOperation = 'screen'; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const st of GLOW.strokes) { if (st.pts.length < 2) continue; const col = GLOW_COL[st.hue].join(',');
    for (const [w, a, bl] of [[9, .10, 18], [3.2, .38, 8], [1.1, .85, 0]]) { c.strokeStyle = `rgba(${col},${a * breath})`; c.lineWidth = w * sc * (0.85 + 0.3 * (breath - .6)); c.shadowColor = `rgba(${col},.9)`; c.shadowBlur = bl * sc;
      c.beginPath(); st.pts.forEach((q, i) => { const X = ox + q.u * p.w, Y = oy + q.v * p.h; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.stroke(); } }
  c.restore();
}
function drawGlow(c, now) { if (!GLOW.strokes.length) return; const breath = S.playing ? 0.62 + 0.38 * A.kick : 0.72 + 0.12 * Math.sin(now / 900); strokeGlow(c, L.p, L.p.x, L.p.y, 1, now, breath); }
function saveGlowCard() {
  const img = $('#painting'); if (!img || !img.naturalWidth || !GLOW.strokes.length) return null;
  let u0 = 1, v0 = 1, u1 = 0, v1 = 0; for (const st of GLOW.strokes) for (const q of st.pts) { u0 = Math.min(u0, q.u); v0 = Math.min(v0, q.v); u1 = Math.max(u1, q.u); v1 = Math.max(v1, q.v); }
  const NW = img.naturalWidth, NH = img.naturalHeight, pad = .06; let cw = Math.max(.35, u1 - u0 + 2 * pad) * NW, ch = Math.max(.35, v1 - v0 + 2 * pad) * NH;
  if (cw / ch > .8) ch = cw / .8; else cw = ch * .8; cw = Math.min(NW, cw); ch = Math.min(NH, ch);
  let cx = ((u0 + u1) / 2) * NW - cw / 2, cy = ((v0 + v1) / 2) * NH - ch / 2; cx = Math.max(0, Math.min(NW - cw, cx)); cy = Math.max(0, Math.min(NH - ch, cy));
  const OW = 1080, sc = OW / cw, OH = Math.round(ch * sc), M = 70, FOOT = 120, cv = document.createElement('canvas'); cv.width = OW + 2 * M; cv.height = OH + 2 * M + FOOT;
  const c = cv.getContext('2d'); c.fillStyle = '#0b0907'; c.fillRect(0, 0, cv.width, cv.height);
  c.drawImage(img, cx, cy, cw, ch, M, M, OW, OH); // painting crop, untouched
  c.save(); c.beginPath(); c.rect(M, M, OW, OH); c.clip(); strokeGlow(c, { w: NW * sc, h: NH * sc }, M - cx * sc, M - cy * sc, sc * NW / Math.max(1, L.p.w), performance.now(), 1); c.restore();
  c.strokeStyle = 'rgba(214,178,106,.65)'; c.lineWidth = 2; c.strokeRect(M - 10, M - 10, OW + 20, OH + 20);
  c.fillStyle = '#e9d7a6'; c.textAlign = 'center'; c.font = '300 34px "Cormorant Garamond", Georgia, serif'; c.fillText('光繪  ·  盛明 Eternal Sun', cv.width / 2, OH + 2 * M + 40);
  c.globalAlpha = .6; c.font = '300 20px "Cormorant Garamond", Georgia, serif'; const d = new Date(); c.fillText('AE UNIVERSE CREATION  ·  ' + d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0'), cv.width / 2, OH + 2 * M + 78);
  GLOW.saved++; GLOW.last = { w: cv.width, h: cv.height };
  // v2476.67: iOS Safari ignores <a download> -> build the file synchronously (keeps the tap's user activation) and use the
  // share sheet (保存影像); if sharing is unavailable/declined, show the card full-screen with a long-press-to-save hint.
  const url = cv.toDataURL('image/png'); GLOW.url = url; let file = null;
  try { const bin = atob(url.split(',')[1]), arr = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k); file = new File([arr], 'AE-光繪卡-EternalSun.png', { type: 'image/png' }); } catch (e) {}
  const show = () => { GLOW.method = GLOW.method || 'view'; $('#cardimg').src = url; document.body.classList.add('card-open'); };
  const touch = matchMedia('(pointer: coarse)').matches;
  if (file && navigator.canShare && navigator.canShare({ files: [file] }) && touch) { GLOW.method = 'share'; navigator.share({ files: [file], title: '光繪卡 · 盛明 Eternal Sun' }).catch(err => { if (!err || err.name !== 'AbortError') { GLOW.method = 'view'; show(); } }); }
  else if (touch) { GLOW.method = 'view'; show(); }
  else { GLOW.method = 'download'; const a = document.createElement('a'); a.href = url; a.download = 'AE-光繪卡-EternalSun.png'; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 1000); show(); }
  return cv;
}
function setGlow(on) { GLOW.on = on; if (!on) { GLOW.strokes.length = 0; GLOW.cur = null; } document.body.classList.toggle('glow-on', on); $('#glowbtn') && $('#glowbtn').classList.toggle('on', on); frontVis(); }
function gameTrail(e) { if (!S.playing || Z.pts.size !== 1) return; const x = (e.clientX - Z.x) / Z.s, y = (e.clientY - Z.y) / Z.s, p = L.p; if (x < p.x || x > p.x + p.w || y < p.y || y > p.y + p.h) return; GAME.trail.push({ x, y, t: performance.now() }); if (GAME.trail.length > 40) GAME.trail.shift(); }
/* sun bloom (restored from Light Player 'glow' / homepage tap bloom): tap the painting or press ✦ */
let blooms = [];
function bloom(now, x, y) { blooms.push({ t: now, x, y }); if (blooms.length > 4) blooms.shift(); if (S.laser) fireBolts(now, { x, y }, 6); }
function autoBloom(now) { const p = L.p; bloom(now, p.x + p.w * SUN.x, p.y + p.h * SUN.y); }
function drawBlooms(c, now) {
  blooms = blooms.filter(b => now - b.t < 1800); c.save(); c.beginPath(); c.rect(0, 0, L.W, L.H); c.clip();
  for (const b of blooms) {
    const q = (now - b.t) / 1800, a = Math.sin(Math.PI * Math.min(1, q * 1.4)) * (1 - q) * (0.6 + .5 * S.intensity), r = L.p.w * (.12 + .3 * q);
    const col = S.mode === 'rgb' ? lampColor(now) : [255, 214, 120];
    const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, r); g.addColorStop(0, `rgba(255,250,230,${a})`); g.addColorStop(.35, `rgba(${col.join(',')},${a * .6})`); g.addColorStop(1, `rgba(${col.join(',')},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, r, 0, 6.2832); c.fill();
    const R2 = r * 1.9, h = c.createRadialGradient(b.x, b.y, r * .3, b.x, b.y, R2); h.addColorStop(0, `rgba(${col.join(',')},${a * .35})`); h.addColorStop(1, `rgba(${col.join(',')},0)`);
    c.fillStyle = h; c.beginPath(); c.arc(b.x, b.y, R2, 0, 6.2832); c.fill();
    c.lineCap = 'round';
    for (let i = 0; i < 16; i++) { const an = i * .3927 + q * .4, len = (i % 2 ? 1.25 : 1.9) * r;
      const lg = c.createLinearGradient(b.x, b.y, b.x + Math.cos(an) * len, b.y + Math.sin(an) * len); lg.addColorStop(0, `rgba(255,252,240,${a})`); lg.addColorStop(1, 'rgba(255,240,200,0)');
      c.strokeStyle = lg; c.lineWidth = i % 2 ? 1.5 : 3; c.beginPath(); c.moveTo(b.x + Math.cos(an) * r * .12, b.y + Math.sin(an) * r * .12); c.lineTo(b.x + Math.cos(an) * len, b.y + Math.sin(an) * len); c.stroke(); }
    c.strokeStyle = `rgba(255,246,220,${a * .9})`; c.lineWidth = 2; c.beginPath(); c.arc(b.x, b.y, L.p.w * (.06 + .55 * q), 0, 6.2832); c.stroke();
  }
  c.restore();
}
/* RGB mode (v2476.60): a fixed gallery picture light. The fixture never moves; only its colour changes with the beat.
   styles: 'bar'  = one emissive light bar above the frame washing down the painting
           'spot' = three fixed pin spotlights on a rail, soft round pools
           'wash' = no fixture, soft even colour wash (previous look) */
function fixture(p) { const fw = p.w * .78, fh = Math.max(6, p.w * .022), fy = Math.max(6, p.y - (S.frame ? L.F : 0) - fh - Math.max(8, p.w * .03)); return { x: p.x + (p.w - fw) / 2, y: fy, w: fw, h: fh }; }
function drawCones(c, now) {
  if (S.mode !== 'rgb' || S.rgbStyle === 'wash') return;
  const p = L.p, col = lampColor(now), cs = col.join(','), I = 0.5 + S.intensity, k = A.kick, F = fixture(p);
  const glow = (.55 + .45 * k) * I;
  if (S.rgbStyle === 'bar') {
    // light falling down: fixed trapezoid, brightest just under the bar
    const g = c.createLinearGradient(0, F.y + F.h, 0, p.y + p.h * .85); g.addColorStop(0, `rgba(${cs},${.30 * glow})`); g.addColorStop(.35, `rgba(${cs},${.12 * glow})`); g.addColorStop(1, `rgba(${cs},0)`);
    c.fillStyle = g; c.beginPath(); c.moveTo(F.x, F.y + F.h); c.lineTo(F.x + F.w, F.y + F.h); c.lineTo(p.x + p.w * 1.06, p.y + p.h * .85); c.lineTo(p.x - p.w * .06, p.y + p.h * .85); c.closePath(); c.fill();
  } else {
    for (const u of [.2, .5, .8]) {
      const x = p.x + p.w * u, y0 = F.y + F.h, cy = p.y + p.h * .34, rr = p.w * .26;
      const g = c.createLinearGradient(0, y0, 0, cy + rr); g.addColorStop(0, `rgba(${cs},${.22 * glow})`); g.addColorStop(1, `rgba(${cs},0)`);
      c.fillStyle = g; c.beginPath(); c.moveTo(x - 3, y0); c.lineTo(x + 3, y0); c.lineTo(x + rr, cy); c.lineTo(x - rr, cy); c.closePath(); c.fill();
      const pg = c.createRadialGradient(x, cy, 0, x, cy, rr); pg.addColorStop(0, `rgba(${cs},${.20 * glow})`); pg.addColorStop(1, `rgba(${cs},0)`);
      c.fillStyle = pg; c.beginPath(); c.ellipse(x, cy, rr, rr * .7, 0, 0, 6.2832); c.fill();
    }
  }
  // coloured spill on the wall around the frame (static)
  const cx = p.x + p.w / 2, sg = c.createRadialGradient(cx, p.y, p.w * .1, cx, p.y + p.h * .2, p.w * 1.1);
  sg.addColorStop(0, `rgba(${cs},${.20 * I})`); sg.addColorStop(1, `rgba(${cs},0)`);
  c.save(); c.beginPath(); c.rect(0, 0, L.W, L.H); c.rect(p.x, p.y, p.w, p.h); c.clip('evenodd'); c.fillStyle = sg; c.fillRect(0, 0, L.W, L.H); c.restore();
}
/* the fixture itself, drawn normally (not screen) so it reads as a physical brass bar that glows */
function drawFixture(c, now) {
  if (S.mode !== 'rgb') return;
  if (S.rgbStyle === 'wash') { drawBarOnly(c, now); return; } // v2476.67: 柔光呼吸 too — coloured light always comes from a visible fixture
  const p = L.p, F = fixture(p), col = lampColor(now), cs = col.join(','), k = A.kick, I = 0.5 + S.intensity;
  c.save();
  // wall arm
  c.fillStyle = '#2a2016'; c.fillRect(p.x + p.w / 2 - 2, F.y + F.h * .5, 4, Math.max(0, p.y - F.y - F.h * .5));
  // halo
  c.shadowColor = `rgba(${cs},${Math.min(1, (.7 + .3 * k) * I)})`; c.shadowBlur = (18 + 18 * k) * L.dpr;
  if (S.rgbStyle === 'bar') {
    const bg = c.createLinearGradient(0, F.y, 0, F.y + F.h); bg.addColorStop(0, '#d9b46a'); bg.addColorStop(.45, '#7a5a2a'); bg.addColorStop(1, '#3a2a14');
    c.fillStyle = bg; rr(c, F.x, F.y, F.w, F.h, F.h / 2); c.fill(); c.shadowBlur = 0;
    // emissive diffuser along the underside
    const lg = c.createLinearGradient(F.x, 0, F.x + F.w, 0); lg.addColorStop(0, `rgba(${cs},0.35)`); lg.addColorStop(.5, 'rgba(255,252,244,0.95)'); lg.addColorStop(1, `rgba(${cs},0.35)`);
    c.fillStyle = lg; c.globalAlpha = Math.min(1, (.75 + .25 * k)); rr(c, F.x + F.h * .4, F.y + F.h * .55, F.w - F.h * .8, F.h * .38, F.h * .19); c.fill();
    c.globalAlpha = Math.min(1, (.55 + .45 * k) * I); c.fillStyle = `rgba(${cs},0.9)`; rr(c, F.x + F.h * .4, F.y + F.h * .62, F.w - F.h * .8, F.h * .26, F.h * .13); c.fill();
  } else {
    c.restore(); drawBarOnly(c, now); c.save(); c.shadowColor = `rgba(${cs},${Math.min(1, (.7 + .3 * k) * I)})`; // spot heads hang under the bar
    F.y += F.h * 1.05;
    for (const u of [.2, .5, .8]) {
      const x = p.x + p.w * u, s = F.h * 1.1;
      c.shadowBlur = (14 + 14 * k) * L.dpr; c.fillStyle = '#6b4f26'; rr(c, x - s * .55, F.y, s * 1.1, s * 1.2, s * .3); c.fill();
      c.shadowBlur = 0; c.globalAlpha = Math.min(1, (.6 + .4 * k) * I); const lg = c.createRadialGradient(x, F.y + s * 1.15, 0, x, F.y + s * 1.15, s * .6);
      lg.addColorStop(0, 'rgba(255,252,244,1)'); lg.addColorStop(1, `rgba(${cs},0.8)`); c.fillStyle = lg; c.beginPath(); c.ellipse(x, F.y + s * 1.15, s * .5, s * .22, 0, 0, 6.2832); c.fill(); c.globalAlpha = 1;
    }
  }
  c.restore();
}
// v2476.66: every preset that throws R/G/B light gets the gallery's brass picture-light bar (柔光呼吸 unchanged).
function drawBarOnly(c, now) {
  const p = L.p, F = fixture(p), col = lampColor(now), cs = col.join(','), k = A.kick, I = 0.5 + S.intensity;
  c.save(); c.fillStyle = '#2a2016'; c.fillRect(p.x + p.w / 2 - 2, F.y + F.h * .5, 4, Math.max(0, p.y - F.y - F.h * .5));
  c.shadowColor = `rgba(${cs},${Math.min(1, (.7 + .3 * k) * I)})`; c.shadowBlur = (18 + 18 * k) * L.dpr;
  const bg = c.createLinearGradient(0, F.y, 0, F.y + F.h); bg.addColorStop(0, '#d9b46a'); bg.addColorStop(.45, '#7a5a2a'); bg.addColorStop(1, '#3a2a14');
  c.fillStyle = bg; rr(c, F.x, F.y, F.w, F.h, F.h / 2); c.fill(); c.shadowBlur = 0;
  const lg = c.createLinearGradient(F.x, 0, F.x + F.w, 0); lg.addColorStop(0, `rgba(${cs},0.35)`); lg.addColorStop(.5, 'rgba(255,252,244,0.95)'); lg.addColorStop(1, `rgba(${cs},0.35)`);
  c.fillStyle = lg; c.globalAlpha = Math.min(1, (.75 + .25 * k)); rr(c, F.x + F.h * .4, F.y + F.h * .55, F.w - F.h * .8, F.h * .38, F.h * .19); c.fill();
  c.globalAlpha = Math.min(1, (.55 + .45 * k) * I); c.fillStyle = `rgba(${cs},0.9)`; rr(c, F.x + F.h * .4, F.y + F.h * .62, F.w - F.h * .8, F.h * .26, F.h * .13); c.fill();
  c.restore(); FX.bar = (FX.bar || 0) + 1;
}
const FX = {};
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
/* glints (v2476.65): soft specular highlights + varnish sheen (replaces the 4-point star sparkles) */
let sparks = [];
function sparkle(now, n) {
  for (let i = 0; i < n; i++) sparks.push({ t: now + i * 60, u: Math.random(), onSun: Math.random() < .45, a: Math.random() * 6.28, d: .05 + Math.random() * .2, s: .7 + Math.random() * .6 });
  if (sparks.length > 24) sparks.splice(0, sparks.length - 24);
}
function drawSparks(c, now, ox, oy) {
  // v2476.65 閃光 = specular light, not star symbols: a soft anisotropic highlight (like light catching wet varnish /
  // a lens glint seen out of focus) that swells and fades, plus an occasional slow sheen sweeping across the varnish.
  const p = L.p, I = S.intensity, g = S.frame ? L.F * 0.5 : 2, r = { x: p.x - g + ox, y: p.y - g + oy, w: p.w + 2 * g, h: p.h + 2 * g }, life = 1500;
  sparks = sparks.filter(q => now - q.t < life);
  c.save(); c.beginPath(); c.rect(r.x - 30, r.y - 30, r.w + 60, r.h + 60); c.clip();
  for (const q of sparks) {
    if (now < q.t) continue;
    const f = (now - q.t) / life, env = Math.sin(Math.PI * Math.min(1, f)) ** 2, a = env * (0.22 + .18 * I);
    const [x, y] = q.onSun ? [p.x + p.w * SUN.x + Math.cos(q.a) * p.w * q.d * 1.6, p.y + p.h * SUN.y + Math.sin(q.a) * p.w * q.d * 1.6] : perimeterPoint(q.u, r);
    const s = Math.max(10, p.w * .03) * q.s;
    c.save(); c.translate(x, y); c.rotate(-0.62 + q.a * 0.08); c.scale(2.6, 0.55); // elongated along a fixed "light direction"
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, s); gr.addColorStop(0, `rgba(255,252,242,${a})`); gr.addColorStop(.35, `rgba(255,236,200,${a * .45})`); gr.addColorStop(1, 'rgba(255,220,170,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, s, 0, 6.2832); c.fill(); c.restore();
    const core = c.createRadialGradient(x, y, 0, x, y, s * .28); core.addColorStop(0, `rgba(255,255,252,${a * 1.2})`); core.addColorStop(1, 'rgba(255,248,230,0)');
    c.fillStyle = core; c.beginPath(); c.arc(x, y, s * .28, 0, 6.2832); c.fill();
  }
  c.restore();
  if (SH.t && now - SH.t < SH.dur) { // varnish sheen: a wide, very faint diagonal band crossing the canvas
    const u = (now - SH.t) / SH.dur, e = u * u * (3 - 2 * u), a = Math.sin(Math.PI * u) * (0.07 + 0.05 * I), w = p.w * 0.22;
    const cx = p.x + ox - w * 2 + (p.w + w * 4) * e;
    c.save(); c.beginPath(); c.rect(p.x + ox, p.y + oy, p.w, p.h); c.clip(); c.translate(cx, p.y + oy + p.h / 2); c.rotate(0.38);
    const lg = c.createLinearGradient(-w, 0, w, 0); lg.addColorStop(0, 'rgba(255,240,210,0)'); lg.addColorStop(.5, `rgba(255,248,232,${a})`); lg.addColorStop(1, 'rgba(255,240,210,0)');
    c.fillStyle = lg; c.fillRect(-w, -p.h, w * 2, p.h * 2); c.restore();
  }
}
const SH = { t: 0, dur: 2600 };
function sheen(now) { if (!SH.t || now - SH.t > SH.dur + 3000) SH.t = now; }

/* ---------- colours ---------- */
const GOLD = [[255, 196, 92], [255, 150, 70], [255, 222, 150], [214, 120, 255], [120, 230, 170]];
function ledColor(u, t) { // smooth chase gradient around perimeter, warm-biased
  const v = (u + t) % 1 * GOLD.length, i = Math.floor(v), f = v - i;
  const a = GOLD[i % GOLD.length], b = GOLD[(i + 1) % GOLD.length], s = f * f * (3 - 2 * f);
  return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
}

/* ---------- front overlay (Canvas 2D, screen-blended): LED strip, aura rings, glints ---------- */
const fx = $('#front').getContext('2d');
const cxC = $('#coin').getContext('2d'); // v2476.66 coins: normal blending so the gold reads as solid metal (front layer is screen-blended)
$('#front').style.mixBlendMode = 'screen';
let glints = [];
function perimeterPoint(u, r) { // u in [0,1) along rect r
  const P = 2 * (r.w + r.h); let d = u * P;
  if (d < r.w) return [r.x + d, r.y]; d -= r.w;
  if (d < r.h) return [r.x + r.w, r.y + d]; d -= r.h;
  if (d < r.w) return [r.x + r.w - d, r.y + r.h]; d -= r.w;
  return [r.x, r.y + r.h - d];
}
function drawFront(now) {
  const c = fx, k = L.dpr, I = S.intensity, p = L.p;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, c.canvas.width, c.canvas.height); c.setTransform(k, 0, 0, k, 0, 0);
  const t = now / 1000 * 0.06 * S.speed;
  const ox = T.x * 3, oy = T.y * 3;
  if (S.led) {
    const g = S.frame ? L.F + 2.5 : 3, r = { x: p.x - g + ox, y: p.y - g + oy, w: p.w + 2 * g, h: p.h + 2 * g };
    const e = 0.2 + 0.4 * A.level + 0.95 * A.kick + 1.1 * impE(now), N = 160; // flashes on every kick
    c.lineCap = 'round';
    for (const [lw, al, blur] of [[9, 0.10, 0], [2.2, 0.9, 6]]) {
      c.lineWidth = lw; c.shadowBlur = blur * k;
      for (let i = 0; i < N; i++) {
        const u0 = i / N, u1 = (i + 1) / N, col = ledColor(u0, t);
        const a = Math.min(1, al * e * (0.4 + I));
        c.strokeStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${a})`; c.shadowColor = c.strokeStyle;
        const [x0, y0] = perimeterPoint(u0, r), [x1, y1] = perimeterPoint(u1, r);
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      }
    }
    c.shadowBlur = 0;
  }
  if (S.aura) {
    const cx = p.x + p.w * SUN.x, cy = p.y + p.h * SUN.y, br = S.playing ? 0.5 + 0.5 * Math.cos(6.2832 * ((A.count + Math.min(1, A.phase)) / 8)) : 0.5 + 0.5 * Math.sin(now / 1000 * 1.4 * S.speed);
    const rad = p.w * (0.30 + 0.012 * br + 0.022 * A.kick), a = Math.min(1, (0.55 + 0.15 * br + 0.4 * A.kick) * (0.5 + I));
    const gr = c.createRadialGradient(cx, cy, rad * 0.82, cx, cy, rad * 1.12);
    gr.addColorStop(0, 'rgba(255,214,150,0)'); gr.addColorStop(0.5, `rgba(255,226,170,${a * 0.6})`); gr.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, rad * 1.12, 0, 6.2832); c.fill();
    c.strokeStyle = `rgba(255,250,232,${a})`; c.lineWidth = Math.max(2, p.w * .006); c.shadowColor = 'rgba(255,220,150,1)'; c.shadowBlur = 14 * k;
    c.beginPath(); c.arc(cx, cy, rad, 0, 6.2832); c.stroke(); c.shadowBlur = 0;
  }
  if (S.glint) {
    if (Math.random() < 0.0025 * S.speed * (0.5 + I)) sparkle(now, 1); if (!S.playing && Math.random() < 0.0007) sheen(now); if (false) glints.push({ t: now, u: Math.random(), s: 0.6 + Math.random() * 0.6 });
    const g = S.frame ? L.F * 0.5 : 2, r = { x: p.x - g + ox, y: p.y - g + oy, w: p.w + 2 * g, h: p.h + 2 * g };
    glints = glints.filter(q => now - q.t < 900);
    for (const q of glints) {
      const f = (now - q.t) / 900, a = Math.sin(f * Math.PI) * 0.85 * I, [x, y] = perimeterPoint(q.u, r), s = Math.max(8, L.F * 0.55) * q.s;
      if (!Number.isFinite(x + y + s + a)) continue;
      const gr = c.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, `rgba(255,250,235,${a})`); gr.addColorStop(1, 'rgba(255,230,180,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, s, 0, 6.2832); c.fill();
      c.strokeStyle = `rgba(255,248,225,${a * 0.8})`; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(x - s * 1.4, y); c.lineTo(x + s * 1.4, y); c.moveTo(x, y - s * 1.4); c.lineTo(x, y + s * 1.4); c.stroke();
    }
    drawSparks(c, now, ox, oy);
  } else { glints.length = 0; sparks.length = 0; }
  drawCones(c, now); drawLasers(c, now); drawTaps(c, now); drawParty(c, now); drawGlow(c, now); drawGame(c, now);
  c.save(); c.globalCompositeOperation = 'source-over'; drawFixture(c, now); c.restore();
  drawBlooms(c, now);
  c.globalAlpha = 1; c.shadowBlur = 0;
}

/* ---------- back layer: WebGL (Three.js) or Canvas 2D fallback ---------- */
let gl = null;
async function initWebGL() {
  const THREE = await import('./three.module.min.js');
  const canvas = $('#back');
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!r.getContext()) throw new Error('no webgl');
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x060505);
  const cam = new THREE.PerspectiveCamera(30, 1, 10, 20000); const D = 1600;
  // environment for metallic gold: soft warm studio gradient
  const ec = document.createElement('canvas'); ec.width = 512; ec.height = 256; const ex = ec.getContext('2d');
  const eg = ex.createLinearGradient(0, 0, 0, 256); eg.addColorStop(0, '#2a2218'); eg.addColorStop(0.42, '#fff1cf'); eg.addColorStop(0.5, '#6b5434'); eg.addColorStop(1, '#0a0806');
  ex.fillStyle = eg; ex.fillRect(0, 0, 512, 256); ex.fillStyle = 'rgba(255,240,210,.9)'; ex.fillRect(120, 60, 60, 40); ex.fillRect(330, 70, 40, 30);
  const et = new THREE.CanvasTexture(ec); et.mapping = THREE.EquirectangularReflectionMapping; et.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromEquirectangular(et).texture;
  const goldM = new THREE.MeshStandardMaterial({ color: 0xd4a85a, metalness: 1, roughness: 0.3 });
  const goldDark = new THREE.MeshStandardMaterial({ color: 0x8a6430, metalness: 1, roughness: 0.45 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x0d0b09, roughness: 1, metalness: 0 }));
  scene.add(wall);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xfff1d6, 1.4); key.position.set(-0.6, 1, 1.2); scene.add(key);
  // back-panel glow texture
  const gc = document.createElement('canvas'); gc.width = gc.height = 256; const gx = gc.getContext('2d');
  const gg = gx.createRadialGradient(128, 128, 0, 128, 128, 128); gg.addColorStop(0, 'rgba(255,255,255,1)'); gg.addColorStop(0.45, 'rgba(255,255,255,.45)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
  gx.fillStyle = gg; gx.fillRect(0, 0, 256, 256);
  const glowM = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffc070 });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowM); scene.add(glow);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.9 })); scene.add(panel);
  const frame = new THREE.Group(); scene.add(frame);
  let depth = 20;
  function buildFrame() {
    frame.clear();
    const p = L.p, F = L.F; depth = F * 1.5;
    const W = p.w, H = p.h, zf = F * 0.25;
    const bar = (w, h, x, y, m, d, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); frame.add(b); };
    // outer moulding (front face slightly raised), inner fine lip, darker side depth
    bar(W + 2 * F, F, 0, H / 2 + F / 2, goldM, depth, zf - depth / 2); bar(W + 2 * F, F, 0, -H / 2 - F / 2, goldM, depth, zf - depth / 2);
    bar(F, H, -W / 2 - F / 2, 0, goldM, depth, zf - depth / 2); bar(F, H, W / 2 + F / 2, 0, goldM, depth, zf - depth / 2);
    const l = F * 0.28;
    bar(W + 2 * l, l, 0, H / 2 + l / 2, goldDark, l, zf + l / 2); bar(W + 2 * l, l, 0, -H / 2 - l / 2, goldDark, l, zf + l / 2);
    bar(l, H, -W / 2 - l / 2, 0, goldDark, l, zf + l / 2); bar(l, H, W / 2 + l / 2, 0, goldDark, l, zf + l / 2);
    const cx = p.x + W / 2 - L.W / 2, cy = -(p.y + H / 2 - L.H / 2);
    frame.position.set(cx, cy, 0);
    panel.position.set(cx, cy, -depth); panel.scale.set(W * 0.98, H * 0.98, 1);
    glow.position.set(cx, cy, -depth - 1); glow.scale.set(W * 2.1, H * 1.75, 1);
    wall.position.set(0, 0, -depth - 2); wall.scale.set(L.W * 4, L.H * 4, 1);
  }
  function resize() { r.setPixelRatio(L.dpr); r.setSize(L.W, L.H, false); buildFrame(); }
  function render(now) {
    // off-axis projection: the z=0 plane (painting) stays pinned to the screen; only depth layers shift (parallax)
    const ox = T.x * 60, oy = -T.y * 60, n = 10, s = n / D;
    cam.position.set(ox, oy, D); cam.rotation.set(0, 0, 0); cam.updateMatrixWorld();
    cam.projectionMatrix.makePerspective((-L.W / 2 - ox) * s, (L.W / 2 - ox) * s, (L.H / 2 - oy) * s, (-L.H / 2 - oy) * s, n, 20000);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    frame.visible = S.frame;
    const e = S.frame ? (0.35 + 0.6 * A.level + 0.4 * A.kick) * (0.3 + S.intensity) : 0;
    const col = S.mode === 'rgb' ? lampColor(now) : ledColor(0, now / 1000 * 0.06 * S.speed);
    glowM.color.setRGB(col[0] / 255, col[1] / 255, col[2] / 255); glowM.opacity = Math.min(1, 0.55 * e);
    glow.visible = S.frame; panel.visible = S.frame;
    r.render(scene, cam);
  }
  gl = { resize, render, kind: 'webgl' };
}
function initLite() {
  const c = $('#back').getContext('2d');
  gl = {
    kind: 'lite', resize() {},
    render(now) {
      const k = L.dpr, p = L.p, F = L.F; c.setTransform(k, 0, 0, k, 0, 0);
      c.fillStyle = '#060505'; c.fillRect(0, 0, L.W, L.H);
      if (!S.frame) return;
      const e = (0.35 + 0.6 * A.level + 0.4 * A.kick) * (0.3 + S.intensity), col = S.mode === 'rgb' ? lampColor(now) : ledColor(0, now / 1000 * 0.06 * S.speed);
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      c.save(); c.translate(cx, cy); c.scale(1, p.h / p.w * 0.85);
      const g = c.createRadialGradient(0, 0, p.w * 0.3, 0, 0, p.w * 1.05);
      g.addColorStop(0, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${Math.min(0.5, 0.3 * e)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(-L.W * 2, -L.H * 2, L.W * 4, L.H * 4); c.restore();
      // side depth: trapezoids shifted by parallax
      const dx = -T.x * F * 0.9, dy = -T.y * F * 0.9, x0 = p.x - F, y0 = p.y - F, x1 = p.x + p.w + F, y1 = p.y + p.h + F;
      c.fillStyle = '#5a4120';
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y0); c.lineTo(x1 + dx, y0 + dy); c.lineTo(x0 + dx, y0 + dy); c.fill();
      c.beginPath(); c.moveTo(x0, y1); c.lineTo(x1, y1); c.lineTo(x1 + dx, y1 + dy); c.lineTo(x0 + dx, y1 + dy); c.fill();
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0, y1); c.lineTo(x0 + dx, y1 + dy); c.lineTo(x0 + dx, y0 + dy); c.fill();
      c.beginPath(); c.moveTo(x1, y0); c.lineTo(x1, y1); c.lineTo(x1 + dx, y1 + dy); c.lineTo(x1 + dx, y0 + dy); c.fill();
      const gg = c.createLinearGradient(x0, y0, x1, y1);
      gg.addColorStop(0, '#f3d79a'); gg.addColorStop(0.35, '#b8873e'); gg.addColorStop(0.55, '#f8e3b0'); gg.addColorStop(1, '#8c6630');
      c.fillStyle = gg; c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.rect(p.x, p.y, p.w, p.h); c.fill('evenodd');
      c.strokeStyle = 'rgba(70,48,18,.8)'; c.lineWidth = 1; c.strokeRect(p.x - F * 0.28, p.y - F * 0.28, p.w + F * 0.56, p.h + F * 0.56);
    }
  };
}
function weakDevice() {
  if (Q.get('lite') === '1') return true;
  if ((navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2) return true;
  try { const t = document.createElement('canvas'); return !(t.getContext('webgl2') || t.getContext('webgl')); } catch (e) { return true; }
}
function swapToLite() { // auto-fallback when WebGL is slow; replace the canvas so it can take a 2D context
  const old = $('#back'), n = document.createElement('canvas'); n.id = 'back'; n.setAttribute('aria-hidden', 'true');
  old.replaceWith(n); S.engine = 'lite'; initLite(); layout(); updateEngineNote();
}

/* ---------- UI ---------- */
let uiTimer = 0;
const UI_MS = 5000;
function hideUI(force) { clearTimeout(uiTimer); if (force !== true && document.body.classList.contains('adv-open')) return; document.body.classList.remove('ui', 'adv-open'); $('#adv').setAttribute('aria-expanded', 'false'); } // v72: 進階 open -> panel stays until ✕
function bumpUI() { if (document.body.classList.contains('ui')) { clearTimeout(uiTimer); uiTimer = setTimeout(hideUI, UI_MS); } }
function showUI() { document.body.classList.add('ui'); $('#panel').hidden = false; clearTimeout(uiTimer); uiTimer = setTimeout(hideUI, UI_MS); } // auto-close after 5 s without interaction (no :hover check — it sticks on touch screens)
/* 琥珀 Amber / 寶石 Gem (v2476.61): AE Living Wallpaper looks (琉璃 glass + 寶石 gem shaders, looks.js) on their own canvas
   above the painting; phase flows continuously and surges on every beat. 原畫 hides the canvas -> painting pixels untouched. */
const LK = { ph: 0, ready: false, draws: 0, idx: { gem: 1, amber: 2 } };
function drawLook(now, dt) {
  const cv = $('#look'), on = !!S.look && LK.ready;
  if (cv.style.display !== (on ? 'block' : 'none')) cv.style.display = on ? 'block' : 'none';
  if (!on) return;
  const w = Math.round(L.p.w * L.dpr * (L.W < 600 ? 0.8 : 0.7)), h = Math.round(w / AR); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const k = A.kick || 0, hv = S.impact ? Math.max(0, 1 - (now - IMP.t) / 500) : 0;
  LK.ph = (LK.ph + Math.min(50, dt) / 12000 * S.speed * (1 + 2.5 * k + 3 * hv)) % 1;
  const c = cv.getContext('2d'); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.drawImage($('#painting'), 0, 0, w, h);
  const I = 0.6 + S.intensity * 0.6;
  const vals = S.look === 'gem' ? { amt: Math.min(1.6, I + 0.5 * k + 0.4 * hv), spk: Math.min(2.5, 0.8 + 1.6 * k + 1.2 * hv), hue: 0, cut: 1 }
                                : { amt: Math.max(0.3, 0.42 + 0.25 * S.intensity + 0.15 * k + 0.15 * hv), line: 0.3 + 0.06 * k, hue: 0, spd: 1 };
  if (window.AELooks.draw(c, w, h, { x: 0, y: 0, w, h }, LK.ph, LK.idx[S.look], 1, false, 1, vals)) LK.draws++;
}
function frontVis() { // nothing to draw above the painting -> remove the overlay layer entirely, so the <img> is composited exactly as on its own
  const any = (S.impact && performance.now() - IMP.t < 800) || spots.length > 0 || tapStars.length > 0 || GAME.marks.length > 0 || GAME.trail.length > 0 || GLOW.strokes.length > 0 || S.party || PT.conf.length > 0 || S.led || S.aura || S.glint || S.laser || S.bloom || blooms.length > 0 || S.mode !== 'natural';
  const d = any ? '' : 'none'; if ($('#front').style.display !== d) $('#front').style.display = d;
}
function syncButtons() {
  if ($('#partybtn')) { $('#partybtn').classList.toggle('on', !!S.party); $('#partybtn').setAttribute('aria-pressed', String(!!S.party)); }
  document.querySelectorAll('.tg').forEach(b => { b.classList.toggle('on', !!S[b.dataset.k]); b.setAttribute('aria-pressed', String(!!S[b.dataset.k])); });
  for (const [id, m] of [['#mNat', 'natural'], ['#mRgb', 'rgb']]) { $(id).classList.toggle('on', S.mode === m); $(id).setAttribute('aria-pressed', String(S.mode === m)); }
  $('#lamps').hidden = S.mode !== 'rgb'; $('#styles').hidden = S.mode !== 'rgb';
  document.querySelectorAll('.lp').forEach(b => b.classList.toggle('on', b.dataset.c === S.lamp));
  $('#orig').classList.toggle('on', !!saved); $('#orig').setAttribute('aria-pressed', String(!!saved));
  // nothing to draw above the painting -> remove the overlay layers entirely, so the <img> is composited exactly as on its own
  frontVis();
  $('#burst').classList.toggle('on', !!S.bloom); $('#burst').setAttribute('aria-pressed', String(!!S.bloom));
  document.querySelectorAll('.st').forEach(b => b.classList.toggle('on', b.dataset.s === S.rgbStyle));
  document.querySelectorAll('.pr[data-p]').forEach(b => { const on = b.dataset.p === S.preset; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  if (S.mode !== 'rgb') { $('#rgb').classList.remove('on'); }
  $('#rgb').style.display = S.mode === 'rgb' ? '' : 'none';
  document.body.dataset.mode = S.mode; document.body.dataset.original = saved ? '1' : '0';
}
let saved = null; const KEYS = ['search', 'dip', 'frame', 'led', 'aura', 'glint', 'laser', 'bloom', 'mode', 'look', 'impact'];
function setOriginal() { // toggle: 1st press = untouched original art, 2nd press = restore previous effects
  if (saved) { Object.assign(S, saved); saved = null; }
  else { saved = Object.fromEntries(KEYS.map(k => [k, S[k]])); Object.assign(S, { frame: false, led: false, aura: false, glint: false, laser: false, bloom: false, mode: 'natural', look: '', impact: false }); T.tx = T.ty = 0; rings.length = 0; bolts.length = 0; blooms.length = 0; }
  syncButtons();
}
function leaveOriginal() { saved = null; }
/* pinch-zoom + pan of the art stage only (page itself stays fixed); effects zoom together. Double-tap or ⟲ resets. */
const Z = { s: 1, x: 0, y: 0, pts: new Map(), st: null, lastTap: 0 };
function applyZoom() {
  Z.s = Math.min(6, Math.max(1, Z.s)); if (Z.s === 1) { Z.x = Z.y = 0; }
  const mx = L.W * (Z.s - 1), my = L.H * (Z.s - 1); Z.x = Math.min(0, Math.max(-mx, Z.x)); Z.y = Math.min(0, Math.max(-my, Z.y));
  const st = $('#stage').style; st.transformOrigin = '0 0'; st.transform = Z.s === 1 ? '' : `translate(${Z.x}px,${Z.y}px) scale(${Z.s})`;
  document.body.classList.toggle('zoomed', Z.s > 1); $('#zreset').hidden = Z.s === 1;
}
function resetZoom() { Z.s = 1; applyZoom(); }
function zoomAt(cx, cy, ns) { const ux = (cx - Z.x) / Z.s, uy = (cy - Z.y) / Z.s; Z.s = Math.min(6, Math.max(1, ns)); Z.x = cx - ux * Z.s; Z.y = cy - uy * Z.s; applyZoom(); }
function bindZoom() {
  const st = $('#stage');
  st.addEventListener('pointerdown', e => { Z.pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); Z.st = null; if (Z.pts.size === 1) Z.g = { x: e.clientX, y: e.clientY, t: Date.now(), multi: false }; if (Z.pts.size >= 2) { Z.pinching = true; if (Z.g) Z.g.multi = true; } });
  st.addEventListener('pointermove', e => { if (!Z.pts.has(e.pointerId)) return; const pr = Z.pts.get(e.pointerId); Z.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Z.pts.size === 2) { const [a, b] = [...Z.pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      if (!Z.st) Z.st = { d, s: Z.s, cx, cy }; else { Z.x += cx - Z.st.cx; Z.y += cy - Z.st.cy; Z.st.cx = cx; Z.st.cy = cy; zoomAt(cx, cy, Z.st.s * d / Z.st.d); } }
    else if (Z.pts.size === 1 && Z.s > 1 && !GLOW.on) { Z.x += e.clientX - pr.x; Z.y += e.clientY - pr.y; applyZoom(); } });
  const up = e => { Z.pts.delete(e.pointerId); Z.st = null; if (!Z.pts.size) setTimeout(() => { Z.pinching = false; }, 50); };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => st.addEventListener(ev, up));
  st.addEventListener('pointerup', e => { const n = Date.now(), g = Z.g; if (!g || Z.pts.size) return; Z.g = null; const tap = !g.multi && n - g.t < 280 && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 12; if (!tap) { Z.lastTap = 0; return; } if (!Z.consumed) { const x = (e.clientX - Z.x) / Z.s, y = (e.clientY - Z.y) / Z.s, p = L.p; if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) artTap(x, y); else if (!A.started && !S.playing) togglePlay(); else if (Z.s === 1) showUI(); } if (n - Z.lastTap < 320 && Z.s > 1) { resetZoom(); Z.lastTap = 0; } else Z.lastTap = n; });
  st.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Z.s * Math.exp(-e.deltaY * 0.002)); }, { passive: false });
  $('#zreset').onclick = e => { e.stopPropagation(); resetZoom(); };
}
function bindUI() {
  bindZoom();
  const st = $('#stage');
  // v2476.63: the painting is for art interaction only. Panel opens from ⚙ or a tap on the empty area beside the painting;
  // while it is open a tap anywhere outside it (backdrop) closes it.
  st.addEventListener('pointerdown', e => { onPointer(e); if (document.body.classList.contains('ui') && Z.pts.size <= 1) { hideUI(); Z.consumed = true; } else if (Z.pts.size <= 1) Z.consumed = false; });
  st.addEventListener('pointermove', e => { onPointer(e); if (GLOW.on) glowMove(e); else gameTrail(e); });
  st.addEventListener('pointerdown', e => { if (GLOW.on) setTimeout(() => glowDown(e), 0); });
  ['pointerup', 'pointercancel'].forEach(ev => st.addEventListener(ev, () => { GLOW.cur = null; }));
  $('#glowbtn').onclick = e => { e.stopPropagation(); setGlow(!GLOW.on); hideUI(true); };
  $('#glowclear').onclick = e => { e.stopPropagation(); GLOW.strokes.length = 0; frontVis(); };
  $('#glowsave').onclick = e => { e.stopPropagation(); saveGlowCard(); };
  $('#glowdone').onclick = e => { e.stopPropagation(); setGlow(false); };
  $('#cardclose').onclick = e => { e.stopPropagation(); document.body.classList.remove('card-open'); };
  $('#partybtn').onclick = e => { e.stopPropagation(); S.party = !S.party; syncButtons(); };
  $('#open').onclick = e => { e.stopPropagation(); showUI(); };
  if ($('#openhint')) { $('#openhint').onclick = e => { e.stopPropagation(); showUI(); document.body.classList.add('adv-open'); $('#adv').setAttribute('aria-expanded', 'true'); }; $('#openhint').addEventListener('pointerdown', e => e.stopPropagation()); } // v73: hint opens settings with 進階 shown
  $('#panel').addEventListener('pointerdown', e => { e.stopPropagation(); showUI(); });
  $('#play').onclick = togglePlay;
  $('#mNat').onclick = () => { S.preset = ''; leaveOriginal(); S.mode = 'natural'; syncButtons(); };
  $('#mRgb').onclick = () => { S.preset = ''; leaveOriginal(); S.mode = 'rgb'; syncButtons(); };
  document.querySelectorAll('.lp').forEach(b => b.onclick = () => { S.lamp = b.dataset.c; syncButtons(); });
  $('#burst').onclick = () => { S.bloom = !S.bloom; if (S.bloom) autoBloom(performance.now()); syncButtons(); }; // toggle: periodic bloom every 4 beats (works over 原畫 too); tapping the painting still blooms
  document.querySelectorAll('.st').forEach(b => b.onclick = () => { S.rgbStyle = b.dataset.s; syncButtons(); });
  $('#lang').onclick = () => { S.lang = S.lang === 'en' ? 'zh' : 'en'; applyLang(); };
  $('#int').oninput = e => { S.intensity = +e.target.value; S.preset = ''; syncButtons(); };
  const sk = $('#seek'); sk.addEventListener('pointerdown', () => { seeking = true; }); sk.addEventListener('input', () => { seeking = true; const d = audio.duration; if (Number.isFinite(d)) { $('#tcur').textContent = fmt(sk.value / 1000 * d); } });
  sk.addEventListener('change', () => { const d = audio.duration; if (Number.isFinite(d)) { A.started = 1; audio.currentTime = sk.value / 1000 * d; } seeking = false; progAt = 0; });
  document.querySelectorAll('.pr[data-p]').forEach(b => b.onclick = () => applyPreset(b.dataset.p));
  document.querySelectorAll('.ts').forEach(b => b.onclick = e => { e.stopPropagation(); setTapSound(b.dataset.s); }); setTapSound.init = 1;
  $('#close').onclick = e => { e.stopPropagation(); hideUI(true); };
  ['pointerdown', 'pointermove', 'input', 'keydown', 'wheel'].forEach(ev => $('#panel').addEventListener(ev, bumpUI, { passive: true }));
  document.querySelectorAll('.tg').forEach(b => b.onclick = () => { leaveOriginal(); S[b.dataset.k] = !S[b.dataset.k]; syncButtons(); });
  $('#orig').onclick = setOriginal;
  addEventListener('resize', layout);
  // page zoom locked: iOS ignores user-scalable=no, so also cancel its pinch / double-tap gestures (painting always fits the screen)
  ['gesturestart', 'gesturechange', 'gestureend', 'dblclick'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  let lastTouch = 0; document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTouch < 300) e.preventDefault(); lastTouch = n; }, { passive: false });
}

/* ---------- 7 curated presets (模式), each with its own tuned motion speed (no speed slider) ---------- */
const BASE = { search: false, dip: true, party: false, frame: true, led: false, aura: false, glint: false, bloom: false, laser: false, look: '', impact: false, rgbStyle: 'bar', lamp: 'auto' };
const PRESETS = { // v72: exactly four exclusive modes (1,4 day · 2,3 night); toggles still combine on top
  home:   { ...BASE, mode: 'natural', frame: true, laser: true, search: true, spots3: true, idle: true, look: '', intensity: 0.7, speed: 1, night: false },                        // 歡樂派對 ☀: homepage sound-light replica
  club:   { ...BASE, mode: 'rgb', rgbStyle: 'bar', lamp: 'auto', frame: true, laser: true, led: true, spots3: false, idle: false, intensity: 0.85, speed: 1.1, night: true }, // 沈浸夜店 ☾: dark club, clean lasers + RGB light bar on beat
  breath: { ...BASE, mode: 'rgb', rgbStyle: 'wash', lamp: 'blue', frame: true, aura: true, spots3: false, idle: false, intensity: 0.55, speed: 0.45, night: true },   // 柔光呼吸 ☾: calm dark, soft breathing wash + aura, gentle frame light, no lasers
  gem:    { ...BASE, mode: 'natural', look: 'gem', frame: true, led: true, glint: true, impact: true, spots3: false, idle: false, intensity: 0.75, speed: 1, night: false } // 尊榮寶石 ☀: bright, gold frame + gem/pearl sparkle + gallery light, no lasers
};
function applyPreset(k) { if (!PRESETS[k]) k = 'home'; saved = null; Object.assign(S, PRESETS[k]); S.preset = k; S.home = k === 'home'; // v70: 歡樂派對 is a base layer that stays on under every other preset/toggle; 只留燈光 turns it off
  $('#int').value = S.intensity; syncButtons(); }
function homeSync() { const orig = document.body.dataset.original === '1', on = S.home && !orig; document.body.classList.toggle('home-mode', on); /* v72: 三光點/待機漣漪 work in every mode */ const R = window.aeHomeReplica; if (!R) return; if (R.active === orig) R.setActive(!orig); if (R.ambient !== on) R.setAmbient(on); if (R.setLasers && R.lasers !== !!S.laser) R.setLasers(!!S.laser); if (R.setSpots && R.spots3 !== !!S.spots3) R.setSpots(!!S.spots3); if (R.setIdle && R.idle !== !!S.idle) R.setIdle(!!S.idle); document.body.classList.toggle('look-night', !orig && !!S.night); document.body.classList.toggle('look-day', !orig && !S.night); } // v70: tap-beam layer global in every mode; homepage ambient show only while 歡樂派對 is on

/* ---------- loop ---------- */
let slow = 0, frames = 0, lastT = 0;
function loop(now) {
  const dt = now - (lastT || now); lastT = now;
  if (!Number.isFinite(T.tx)) T.tx = 0; if (!Number.isFinite(T.ty)) T.ty = 0;
  T.x += (T.tx - T.x) * 0.06; T.y += (T.ty - T.y) * 0.06;
  analyse(now); homeSync();
  gl.render(now); drawRGB(now); drawLook(now, dt); frontVis(); drawFront(now); drawImpact(fx, now); drawV75(now); updateProg(now);
  if (gl.kind === 'webgl' && !Q.has('nofallback') && document.visibilityState === 'visible') {
    frames++; if (dt > 45) slow++;
    if (frames === 240) { if (slow > 150) swapToLite(); frames = 0; slow = 0; }
  }
  requestAnimationFrame(loop);
}

async function start() {
  bindUI(); applyLang(); if (Q.get('fx') !== '0') { const qp = Q.get('preset'); applyPreset(PRESETS[qp] ? qp : 'home'); } syncButtons();
  if (weakDevice()) { S.engine = 'lite'; initLite(); }
  else { try { await initWebGL(); } catch (e) { console.warn('WebGL unavailable, using Canvas 2D', e && e.message); swapToLite(); } }
  layout(); updateEngineNote();
  const img = $('#painting'); if (img.complete && img.naturalWidth) buildRGB(img); else img.addEventListener('load', () => buildRGB(img), { once: true });
  if (window.AELooks) window.AELooks.prepare(img).then(ok => { LK.ready = !!ok; });
  // v2476.64: no text/image selection, callout, drag or tap highlight on the artwork (pinch zoom is our own pointer handler).
for (const ev of ['selectstart', 'dragstart', 'contextmenu']) document.addEventListener(ev, e => { if (!e.target.closest || !e.target.closest('#panel input')) e.preventDefault(); });
document.querySelectorAll('#stage img, #art img').forEach(im => { im.draggable = false; im.setAttribute('draggable', 'false'); });
$('#stage').addEventListener('touchstart', e => { if (e.touches.length > 1 || e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault());
// v2476.65: 對拍微調 slider (advanced panel), saved to localStorage
(() => { const r = $('#syncoff'), o = $('#syncval'); if (!r) return; const show = () => { o.textContent = (SYNC.off > 0 ? '+' : '') + SYNC.off + ' ms'; }; r.value = SYNC.off; show();
  r.addEventListener('input', () => { SYNC.off = Math.round(+r.value); show(); try { localStorage.setItem('ae-premium-sync-ms', String(SYNC.off)); } catch (e) {} }); })();
// v2476.65: elegant play glyph over the painting until the first playback starts
function syncGlyph() { const g = $('#artplay'); if (!g) return; const p = L.p; g.style.left = (p.x + p.w / 2) + 'px'; g.style.top = (p.y + p.h / 2) + 'px'; g.classList.toggle('gone', !!(A.started || S.playing)); }
audio.addEventListener('play', syncGlyph); addEventListener('resize', () => setTimeout(syncGlyph, 50)); setTimeout(syncGlyph, 0); setInterval(syncGlyph, 1000);
// v2476.64: main panel = presets + 只留燈光; 進階 reveals the full fine-control set (advanced panel).
$('#adv').addEventListener('click', e => { e.stopPropagation(); const on = document.body.classList.toggle('adv-open'); $('#adv').setAttribute('aria-expanded', String(on)); });
document.querySelectorAll('.ts').forEach(b => b.classList.toggle('on', b.dataset.s === TAPSND.mode));
document.querySelectorAll('.lw').forEach(b => b.onclick = e => { e.stopPropagation(); setLw(b.dataset.w); }); setLw(S.lw, true);
window.__premium = { V75, setLw, TAPSND, kick, setTapSound, hideUI, L, S, PT, partyBurst, laserShow, LSW, FX, GLOW, setGlow, saveGlowCard, drawCoin, ting, TONE, OM, GAME, SYNC, beatErr, beatTap, sheen, SH, LAT, latency, artTap, spotsN: () => spots.length, tapStarsN: () => tapStars.length, boltsN: () => bolts.length, Z, zoomAt, resetZoom, A, IMP, LK, LZ, audio, CUE, RG, beatTimeline: !!RH, S, setOriginal, syncButtons, engine: () => S.engine, applyPreset, PRESETS, CK, stats: () => ({ sparks: sparks.length, bolts: bolts.length, blooms: blooms.length, rings: rings.length, lamp: RG.cur, rgbReady: !!RG.masks.red, playing: S.playing, t: audio.currentTime, looksOk: LK.ready, lookDraws: LK.draws, impacts: IMP.n }) };
  document.body.dataset.ready = '1';
  requestAnimationFrame(loop);
}

/* ---------- v2476.75 overlays (never touch the painting pixels) ----------
   探照燈 searchlights: 2–4 wide soft cones sweeping up from below the frame, swaying slowly with the music.
   beat-dip: day modes stay fully bright, but a strong beat briefly lays a 10–15 % dark veil (≈120 ms) over the art so the lasers pop.
   閃光 strobe: a short white flash on heavy beats (max ~2/s, off with prefers-reduced-motion). */
const V75 = { dip: { t: -1e9, a: 0 }, strobe: { t: -1e9, last: -1e9, n: 0 }, dips: 0, sway: 0, lastNow: 0 };
const RM75 = matchMedia('(prefers-reduced-motion: reduce)');
function setLw(w, quiet) { if (!LWM[w]) w = 'mid'; S.lw = w; if (!quiet) try { localStorage.setItem('ae-premium-lw', w); } catch (e) {} document.querySelectorAll('.lw').forEach(b => { b.classList.toggle('on', b.dataset.w === w); b.setAttribute('aria-pressed', String(b.dataset.w === w)); }); }
function v75Beat(now, bass, heavy, b) {
  if (document.body.dataset.original === '1') return;
  const strong = heavy || (b && (b.dropPulse || 0) > 0.3) || bass > 0.78;
  if (strong && S.dip && !S.night && (heavy || now - V75.dip.t > 1500)) { V75.dip.t = now; V75.dip.a = heavy ? 0.15 : 0.1; V75.dips++; } // heavy beats, otherwise at most one light dip per 1.5 s
  if ((heavy || (b && (b.dropPulse || 0) > 0.3)) && S.glint && !RM75.matches && now - V75.strobe.last >= 450) { V75.strobe.last = V75.strobe.t = now; V75.strobe.n++; }
}
const fx75 = (() => { const c = document.createElement('canvas'); c.id = 'fx75'; c.setAttribute('aria-hidden', 'true'); c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none'; const st = $('#stage'), co = $('#coin'); st.insertBefore(c, co); return c.getContext('2d'); })();
const dip75 = (() => { const d = document.createElement('div'); d.id = 'dip75'; d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:#000;opacity:0'; $('#art').appendChild(d); return d; })();
function drawV75(now) {
  const c = fx75, cv = c.canvas, k = L.dpr || 1, orig = document.body.dataset.original === '1';
  const W = Math.round(L.W * k), H = Math.round(L.H * k); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  // beat-dip veil (art only, below the light layers)
  let da = 0; if (!orig && S.dip && !S.night) { const q = (now - V75.dip.t) / 120; da = q >= 0 && q < 1 ? V75.dip.a * (q < 0.25 ? q / 0.25 : 1 - (q - 0.25) / 0.75) : 0; }
  dip75.style.opacity = da.toFixed(3); V75.dipNow = da;
  const st = V75.strobe, sq = (now - st.t) / 90, strobing = !orig && S.glint && !RM75.matches && sq >= 0 && sq < 1;
  if (!S.search && !strobing || orig) { if (V75.drawn) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); V75.drawn = 0; } cv.style.display = orig ? 'none' : ''; return; }
  cv.style.display = ''; V75.drawn = 1;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.setTransform(k, 0, 0, k, 0, 0);
  const p = L.p, dt = Math.min(0.05, (now - (V75.lastNow || now)) / 1000); V75.lastNow = now;
  if (S.search) {
    const lvl = S.playing ? A.level : 0.25, kk = S.playing ? A.kick : 0;
    V75.sway += dt * (S.playing ? 0.5 + 0.9 * lvl : 0.35) * (RM75.matches ? 0.15 : 1);
    const n = p.w < 420 ? 2 : p.w < 700 ? 3 : 4, by = p.y + p.h + Math.max(20, p.w * 0.06), len = p.h * 1.35 + 60;
    c.save(); c.beginPath(); c.rect(0, 0, L.W, L.H); c.clip(); c.globalCompositeOperation = S.night ? 'screen' : 'source-over'; // day: a warm haze over the bright art (additive would vanish into the light colours)
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1), bx = p.x + p.w * (0.12 + 0.76 * u), base = -(u - 0.5) * 0.38;
      const ang = -Math.PI / 2 + base + Math.sin(V75.sway * (0.8 + i * 0.17) + i * 1.9) * 0.32, half = 0.1 + 0.025 * Math.sin(V75.sway * 0.6 + i);
      const a = Math.min(0.7, (0.3 + 0.18 * lvl + 0.2 * kk) * (0.7 + 0.45 * S.intensity));
      const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
      const g = c.createLinearGradient(bx, by, ex, ey); g.addColorStop(0, `rgba(255,248,226,${a})`); g.addColorStop(0.35, `rgba(255,240,205,${a * 0.6})`); g.addColorStop(1, 'rgba(255,236,200,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(bx + Math.cos(ang + Math.PI / 2) * 6, by + Math.sin(ang + Math.PI / 2) * 6);
      c.lineTo(bx + Math.cos(ang - half) * len, by + Math.sin(ang - half) * len); c.lineTo(bx + Math.cos(ang + half) * len, by + Math.sin(ang + half) * len);
      c.lineTo(bx + Math.cos(ang - Math.PI / 2) * 6, by + Math.sin(ang - Math.PI / 2) * 6); c.closePath(); c.fill();
      // soft inner core so the cone has a brighter centre line
      const g2 = c.createLinearGradient(bx, by, ex, ey); g2.addColorStop(0, `rgba(255,252,240,${a * 0.7})`); g2.addColorStop(0.5, `rgba(255,250,235,${a * 0.25})`); g2.addColorStop(1, 'rgba(255,250,235,0)');
      c.fillStyle = g2; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(ang - half * 0.35) * len, by + Math.sin(ang - half * 0.35) * len); c.lineTo(bx + Math.cos(ang + half * 0.35) * len, by + Math.sin(ang + half * 0.35) * len); c.closePath(); c.fill();
      const lg = c.createRadialGradient(bx, by, 0, bx, by, 26); lg.addColorStop(0, `rgba(255,252,240,${Math.min(1, a * 2)})`); lg.addColorStop(1, 'rgba(255,240,210,0)'); c.fillStyle = lg; c.fillRect(bx - 26, by - 26, 52, 52); // lamp head
    }
    c.restore();
  }
  if (strobing) { c.save(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.5 * (1 - sq) ** 1.5; c.fillStyle = '#fff'; c.fillRect(p.x, p.y, p.w, p.h); c.restore(); }
}
start(); // v75: after the v75 overlay declarations
