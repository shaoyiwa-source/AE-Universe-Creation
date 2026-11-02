/* 盛明 Eternal Sun — Premium Edition dynamic wallpaper (site v2476.61, Preview trial).
   ART RULE: the painting is a plain, untouched <img>. Every effect is a separate layer behind it
   (wall / back-glow / gold frame) or a toggleable overlay above it (LED, aura, UV, glints).
   With all effects off the painting pixels are exactly the original image. */
const $ = s => document.querySelector(s);
const Q = new URLSearchParams(location.search);
const SUN = { x: 0.515, y: 0.50 };            // sun focal point of the painting (normalized)
const AR = 1110 / 1536;
const S = {
  lang: Q.get('lang') === 'en' ? 'en' : 'zh', mode: 'natural', intensity: 0.7, speed: 1,
  frame: true, led: true, aura: true, glint: true, laser: false, bloom: true, rgbStyle: 'bar', lamp: 'auto', preset: 'golden', look: '', impact: true,
  engine: 'webgl', playing: false
};
if (Q.get('fx') === '0') Object.assign(S, { frame: false, led: false, aura: false, glint: false, laser: false, bloom: false });
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
  for (const c of [$('#front'), $('#back')]) { c.width = L.W * L.dpr; c.height = L.H * L.dpr; }
  if (gl) gl.resize(); 
}

/* ---------- audio / beat ---------- */
const CK = { base: 0, at: 0, last: -1, ok: 0 };
const A = { count: 0, t: 0, phase: 0, ctx: null, an: null, buf: null, bass: 0, avg: 0, level: 0, lastKick: 0, kick: 0 };
const audio = $('#music');
async function togglePlay() {
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
  if (A.ctx && A.ctx.state === 'suspended') await A.ctx.resume();
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
    if (ct !== CK.last || !CK.ok) { const pred = CK.base + (now - CK.at) / 1000 * rate; if (!CK.ok || Math.abs(pred - ct) > 0.04 || ct < CK.last) { CK.base = ct; CK.at = now; } CK.last = ct; CK.ok = 1; }
    let tt = CK.base + (now - CK.at) / 1000 * rate; if (Math.abs(tt - ct) > 0.25) { CK.base = tt = ct; CK.at = now; }
    A.t = tt; bass = Math.min(1, EN.energyAt(TL, tt));
    const b = RH.update(bass, tt);
    if (b.count < A.count) A.count = b.count; // loop / seek back
    if (b.beat) { A.count = b.count; onKick(now, 0.6 + 0.4 * bass); if (isHeavy(b, tt, bass)) IMP.t = now, IMP.n++; }
    A.bass = bass; A.level += (bass - A.level) * 0.25; A.kick = b.pulse; A.phase = b.phase; return;
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
const IMP = { t: -1e9, n: 0 };
const GROOVE = [[64.871, 116.79], [129.736, 1e9]];
function isHeavy(b, t, bass) { // climax heavy downbeats: the drop hits, then every 4th beat inside the two grooves
  if ((b.dropPulse || 0) > 0.3) return true;
  const g = GROOVE.find(r => t >= r[0] && t < r[1]); if (!g) return false;
  const beatLen = 60 / 148.02; const idx = Math.round((t - g[0]) / beatLen); return idx % 4 === 0 && bass > 0.55;
}
function drawImpact(c, now) {
  if (!S.impact) return; const q = (now - IMP.t) / 700; if (q < 0 || q > 1) { document.getElementById('stage').style.transform = ''; return; }
  const p = L.p, e = (1 - q) * (1 - q), cx = p.x + p.w * SUN.x, cy = p.y + p.h * SUN.y;
  c.save(); c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 0.45 * e * (0.6 + 0.5 * S.intensity); c.fillStyle = 'rgb(255,236,190)'; c.fillRect(0, 0, L.W, L.H);   // whole-frame flash
  c.globalAlpha = Math.min(1, 1.1 * (1 - q)); c.strokeStyle = 'rgba(255,246,222,1)'; c.lineWidth = Math.max(3, p.w * 0.025 * (1 - q));    // shockwave from the sun
  c.beginPath(); c.arc(cx, cy, p.w * (0.05 + 1.1 * q), 0, 6.2832); c.stroke();
  c.globalAlpha = 0.5 * (1 - q); c.lineWidth = Math.max(2, p.w * 0.01); c.beginPath(); c.arc(cx, cy, p.w * (0.02 + 0.7 * q), 0, 6.2832); c.stroke();
  c.globalAlpha = 0.9 * e; c.strokeStyle = 'rgba(255,214,140,1)'; c.lineWidth = L.F * 1.6; c.strokeRect(p.x - L.F * .5, p.y - L.F * .5, p.w + L.F, p.h + L.F); // thick frame glow
  c.restore(); c.globalAlpha = 1;
  document.getElementById('stage').style.transform = `scale(${1 + 0.018 * e})`;                                        // whole-frame pulse
}
function onKick(now, k) { A.lastKick = now; if (!S.playing) A.kick = 1; RG.beats++; const n = S.playing ? A.count : RG.beats; LZ.hit = now; if (S.laser && n % 8 === 0) LZ.pat = (LZ.pat + 1) % 3; if (S.glint) sparkle(now, S.playing ? 3 : 2); if (S.bloom && n % 4 === 0) autoBloom(now); }

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
  if (col !== RG.cur) { RG.from = RG.cur; RG.cur = col; RG.changed = now; }
  const mix = Math.min(1, (now - RG.changed) / (S.playing ? 260 : 900)), c = rc.getContext('2d'), op = k => (k === 'red' ? .78 : .86) * (0.55 + 0.5 * S.intensity);
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
  const a = LAMP_RGB[RG.from], b = LAMP_RGB[RG.cur], m = Math.min(1, (now - RG.changed) / (S.playing ? 260 : 900));
  return a.map((v, i) => Math.round(v * (1 - m) + b[i] * m));
}

/* ---------- Club lasers (v2476.60): thin crisp beams from fixed emitters above the painting.
   patterns rotate every 8 kicks: fan sheet sweep / single-beam scan / crossing twin fans.
   On the beat the beams strobe hard on, then gate down; faint haze scatter along each beam; tips fade out. ---------- */
const LASER = ['#00ff4c', '#ff1744', '#2f5bff', '#ff2bd6', '#00e5ff', '#39ff14'];
const LZ = { pat: 0, hit: -1e9 };
let bolts = [];
function fireBolts() {}
function emitters() { // v2476.61: off-frame sources (bottom corners + above screen), beams land ON the painting
  return [{ x: L.W * .5, y: -30 }, { x: -30, y: L.H + 30 }, { x: L.W + 30, y: L.H + 30 }];
}
function laserGate(now) {
  if (!S.playing) return 0.6 + 0.25 * Math.sin(now / 700);
  const ph = A.phase || 0; return ph < 0.22 ? 1 : 0.5;
}
const trail = [];
function drawLasers(c, now) {
  if (!S.laser) { trail.length = 0; return; }
  const t = now / 1000 * S.speed, I = 0.45 + S.intensity * 0.75, g = laserGate(now) * I, E = emitters(), p = L.p;
  const n8 = Math.floor((S.playing ? A.count : RG.beats) / 8), colA = LASER[n8 % 6], colB = LASER[(n8 + 3) % 6];
  const P2 = (u, v) => ({ x: p.x + p.w * u, y: p.y + p.h * v });
  c.save(); c.lineCap = 'round';
  const beam = (o, h, col, a) => { // faint haze beam from an off-frame source to the hit point on the canvas surface
    c.globalAlpha = a * 0.35; c.strokeStyle = col; c.lineWidth = 7; c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(h.x, h.y); c.stroke();
    c.globalAlpha = Math.min(1, a); c.lineWidth = 2; c.stroke(); c.globalAlpha = a * .6; c.strokeStyle = '#fff'; c.lineWidth = .8; c.stroke(); };
  const spot = (h, col, a, r = 10) => { // bright hit spot burning on the painting
    const gr = c.createRadialGradient(h.x, h.y, 0, h.x, h.y, r * 3); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, col); gr.addColorStop(1, col + '00');
    c.globalAlpha = Math.min(1, a * 1.2); c.fillStyle = gr; c.beginPath(); c.arc(h.x, h.y, r * 3, 0, 6.2832); c.fill(); };
  const P = LZ.pat;
  if (P === 0) { // horizontal scan line sweeping up and down the artwork
    const v = 0.5 + 0.44 * Math.sin(t * 1.3), y = p.y + p.h * v;
    c.globalAlpha = g * 0.5; c.strokeStyle = colA; c.lineWidth = 14; c.beginPath(); c.moveTo(p.x, y); c.lineTo(p.x + p.w, y); c.stroke();
    c.globalAlpha = Math.min(1, g * 1.2); c.lineWidth = 4; c.stroke(); c.globalAlpha = Math.min(1, g); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
    for (let i = 0; i < 5; i++) { const h = P2(0.1 + 0.2 * i, v); beam(i < 2 ? E[1] : i > 2 ? E[2] : E[0], h, colA, g); spot(h, colA, g, 5); }
    const vv = 0.5 + 0.44 * Math.sin(t * 1.3 + Math.PI); // counter scan, vertical line
    const x = p.x + p.w * (0.5 + 0.44 * Math.sin(t * 0.9)); c.globalAlpha = Math.min(1, g); c.strokeStyle = colB; c.lineWidth = 3.5; c.beginPath(); c.moveTo(x, p.y); c.lineTo(x, p.y + p.h); c.stroke();
    spot({ x, y: p.y + p.h * vv }, colB, g, 6); beam(E[0], { x, y: p.y + p.h * vv }, colB, g);
  } else if (P === 1) { // rotating ring of hit points around the sun + traced circle
    const cx = p.x + p.w * SUN.x, cy = p.y + p.h * SUN.y, R = p.w * (0.26 + 0.06 * Math.sin(t * 2));
    c.globalAlpha = Math.min(1, g * 1.1); c.strokeStyle = colA; c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.stroke();
    for (let i = 0; i < 8; i++) { const an = t * 1.6 + i * Math.PI / 4, h = { x: cx + Math.cos(an) * R, y: cy + Math.sin(an) * R }; beam(E[i % 3], h, i % 2 ? colB : colA, g); spot(h, i % 2 ? colB : colA, g, 5); }
    c.globalAlpha = Math.min(1, g); c.strokeStyle = colB; c.lineWidth = 3; c.beginPath(); for (let i = 0; i <= 6; i++) { const an = -t * 0.8 + i * Math.PI / 3; const X = cx + Math.cos(an) * R * .55, Y = cy + Math.sin(an) * R * .55; i ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.stroke(); // hexagon inside
  } else { // two Lissajous dots drawing trails across the painting
    const a1 = P2(0.5 + 0.42 * Math.sin(t * 1.7), 0.5 + 0.42 * Math.sin(t * 2.3 + 1)), a2 = P2(0.5 + 0.42 * Math.sin(t * 1.1 + 2), 0.5 + 0.42 * Math.cos(t * 1.9));
    trail.push([a1, a2]); if (trail.length > 40) trail.shift();
    for (const [k, col] of [[0, colA], [1, colB]]) { c.strokeStyle = col; c.lineWidth = 4.5; for (let i = 1; i < trail.length; i++) { c.globalAlpha = g * i / trail.length; c.beginPath(); c.moveTo(trail[i - 1][k].x, trail[i - 1][k].y); c.lineTo(trail[i][k].x, trail[i][k].y); c.stroke(); } }
    beam(E[1], a1, colA, g); beam(E[2], a2, colB, g); spot(a1, colA, g, 8); spot(a2, colB, g, 8);
  }
  c.restore(); c.globalAlpha = 1;
}
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
  if (S.mode !== 'rgb' || S.rgbStyle === 'wash') return;
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
    c.fillStyle = '#3a2a14'; rr(c, p.x + p.w * .12, F.y, p.w * .76, F.h * .45, F.h * .2); c.fill();
    for (const u of [.2, .5, .8]) {
      const x = p.x + p.w * u, s = F.h * 1.1;
      c.shadowBlur = (14 + 14 * k) * L.dpr; c.fillStyle = '#6b4f26'; rr(c, x - s * .55, F.y, s * 1.1, s * 1.2, s * .3); c.fill();
      c.shadowBlur = 0; c.globalAlpha = Math.min(1, (.6 + .4 * k) * I); const lg = c.createRadialGradient(x, F.y + s * 1.15, 0, x, F.y + s * 1.15, s * .6);
      lg.addColorStop(0, 'rgba(255,252,244,1)'); lg.addColorStop(1, `rgba(${cs},0.8)`); c.fillStyle = lg; c.beginPath(); c.ellipse(x, F.y + s * 1.15, s * .5, s * .22, 0, 0, 6.2832); c.fill(); c.globalAlpha = 1;
    }
  }
  c.restore();
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
/* glints (v2476.60): clearly visible 4-point star sparkles on beats, on the frame and the sun's highlights */
let sparks = [];
function sparkle(now, n) {
  for (let i = 0; i < n; i++) sparks.push({ t: now + i * 60, u: Math.random(), onSun: Math.random() < .45, a: Math.random() * 6.28, d: .05 + Math.random() * .2, s: .7 + Math.random() * .6 });
  if (sparks.length > 24) sparks.splice(0, sparks.length - 24);
}
function drawSparks(c, now, ox, oy) {
  const p = L.p, I = S.intensity, g = S.frame ? L.F * 0.5 : 2, r = { x: p.x - g + ox, y: p.y - g + oy, w: p.w + 2 * g, h: p.h + 2 * g }, life = 1100;
  sparks = sparks.filter(q => now - q.t < life);
  for (const q of sparks) {
    if (now < q.t) continue;
    const f = (now - q.t) / life, a = Math.sin(Math.PI * Math.min(1, f * 1.3)) * (0.7 + .5 * I);
    const [x, y] = q.onSun ? [p.x + p.w * SUN.x + Math.cos(q.a) * p.w * q.d * 1.6, p.y + p.h * SUN.y + Math.sin(q.a) * p.w * q.d * 1.6] : perimeterPoint(q.u, r);
    const s = Math.max(14, p.w * .045) * q.s * (0.6 + .6 * Math.sin(Math.PI * f));
    const gr = c.createRadialGradient(x, y, 0, x, y, s * .7); gr.addColorStop(0, `rgba(255,255,250,${a})`); gr.addColorStop(1, 'rgba(255,230,170,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(x, y, s * .7, 0, 6.2832); c.fill();
    c.save(); c.translate(x, y); c.rotate(f * .6); c.fillStyle = `rgba(255,252,236,${a})`;
    for (const [L1, w1] of [[s * 1.6, s * .09], [s * .9, s * .06]]) { c.beginPath(); c.moveTo(0, -L1); c.lineTo(w1, 0); c.lineTo(0, L1); c.lineTo(-w1, 0); c.closePath(); c.fill(); c.beginPath(); c.moveTo(-L1, 0); c.lineTo(0, w1); c.lineTo(L1, 0); c.lineTo(0, -w1); c.closePath(); c.fill(); c.rotate(.785); }
    c.restore();
  }
}

/* ---------- colours ---------- */
const GOLD = [[255, 196, 92], [255, 150, 70], [255, 222, 150], [214, 120, 255], [120, 230, 170]];
function ledColor(u, t) { // smooth chase gradient around perimeter, warm-biased
  const v = (u + t) % 1 * GOLD.length, i = Math.floor(v), f = v - i;
  const a = GOLD[i % GOLD.length], b = GOLD[(i + 1) % GOLD.length], s = f * f * (3 - 2 * f);
  return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
}

/* ---------- front overlay (Canvas 2D, screen-blended): LED strip, aura rings, glints ---------- */
const fx = $('#front').getContext('2d');
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
    const e = 0.2 + 0.4 * A.level + 0.95 * A.kick, N = 160; // flashes on every kick
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
    const cx = p.x + p.w * SUN.x, cy = p.y + p.h * SUN.y, br = 0.5 + 0.5 * Math.sin(now / 1000 * 1.4 * S.speed);
    const rad = p.w * (0.30 + 0.012 * br + 0.022 * A.kick), a = Math.min(1, (0.55 + 0.15 * br + 0.4 * A.kick) * (0.5 + I));
    const gr = c.createRadialGradient(cx, cy, rad * 0.82, cx, cy, rad * 1.12);
    gr.addColorStop(0, 'rgba(255,214,150,0)'); gr.addColorStop(0.5, `rgba(255,226,170,${a * 0.6})`); gr.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, rad * 1.12, 0, 6.2832); c.fill();
    c.strokeStyle = `rgba(255,250,232,${a})`; c.lineWidth = Math.max(2, p.w * .006); c.shadowColor = 'rgba(255,220,150,1)'; c.shadowBlur = 14 * k;
    c.beginPath(); c.arc(cx, cy, rad, 0, 6.2832); c.stroke(); c.shadowBlur = 0;
  }
  if (S.glint) {
    if (Math.random() < 0.004 * S.speed * (0.5 + I)) sparkle(now, 1); if (false) glints.push({ t: now, u: Math.random(), s: 0.6 + Math.random() * 0.6 });
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
  drawCones(c, now); drawLasers(c, now);
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
function hideUI() { clearTimeout(uiTimer); document.body.classList.remove('ui'); }
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
                                : { amt: Math.min(1.6, I * 1.3 + 0.3 * k + 0.3 * hv), line: Math.min(1.2, 1.0 + 0.2 * k), hue: 0, spd: 1 };
  if (window.AELooks.draw(c, w, h, { x: 0, y: 0, w, h }, LK.ph, LK.idx[S.look], 1, false, 1, vals)) LK.draws++;
}
function frontVis() { // nothing to draw above the painting -> remove the overlay layer entirely, so the <img> is composited exactly as on its own
  const any = (S.impact && performance.now() - IMP.t < 800) || S.led || S.aura || S.glint || S.laser || S.bloom || blooms.length > 0 || S.mode !== 'natural';
  const d = any ? '' : 'none'; if ($('#front').style.display !== d) $('#front').style.display = d;
}
function syncButtons() {
  document.querySelectorAll('.tg').forEach(b => { b.classList.toggle('on', !!S[b.dataset.k]); b.setAttribute('aria-pressed', String(!!S[b.dataset.k])); });
  for (const [id, m] of [['#mNat', 'natural'], ['#mRgb', 'rgb']]) { $(id).classList.toggle('on', S.mode === m); $(id).setAttribute('aria-pressed', String(S.mode === m)); }
  $('#lamps').hidden = S.mode !== 'rgb'; $('#styles').hidden = S.mode !== 'rgb';
  document.querySelectorAll('.lp').forEach(b => b.classList.toggle('on', b.dataset.c === S.lamp));
  $('#orig').classList.toggle('on', !!saved); $('#orig').setAttribute('aria-pressed', String(!!saved));
  // nothing to draw above the painting -> remove the overlay layers entirely, so the <img> is composited exactly as on its own
  frontVis();
  $('#burst').classList.toggle('on', !!S.bloom); $('#burst').setAttribute('aria-pressed', String(!!S.bloom));
  document.querySelectorAll('.st').forEach(b => b.classList.toggle('on', b.dataset.s === S.rgbStyle));
  document.querySelectorAll('.pr').forEach(b => { b.classList.toggle('on', b.dataset.p === S.preset); b.setAttribute('aria-pressed', String(b.dataset.p === S.preset)); });
  if (S.mode !== 'rgb') { $('#rgb').classList.remove('on'); }
  $('#rgb').style.display = S.mode === 'rgb' ? '' : 'none';
  document.body.dataset.mode = S.mode; document.body.dataset.original = saved ? '1' : '0';
}
let saved = null; const KEYS = ['frame', 'led', 'aura', 'glint', 'laser', 'bloom', 'mode', 'look', 'impact'];
function setOriginal() { // toggle: 1st press = untouched original art, 2nd press = restore previous effects
  if (saved) { Object.assign(S, saved); saved = null; }
  else { saved = Object.fromEntries(KEYS.map(k => [k, S[k]])); Object.assign(S, { frame: false, led: false, aura: false, glint: false, laser: false, bloom: false, mode: 'natural', look: '', impact: false }); $('#stage').style.transform = ''; T.tx = T.ty = 0; rings.length = 0; bolts.length = 0; blooms.length = 0; }
  syncButtons();
}
function leaveOriginal() { saved = null; }
function bindUI() {
  const st = $('#stage');
  st.addEventListener('pointerdown', e => {
    onPointer(e); const wasHidden = !document.body.classList.contains('ui'); showUI();
    const p = L.p; if (!wasHidden && e.clientX >= p.x && e.clientX <= p.x + p.w && e.clientY >= p.y && e.clientY <= p.y + p.h) bloom(performance.now(), e.clientX, e.clientY);
  });
  st.addEventListener('pointermove', e => { onPointer(e); if (e.pointerType === 'mouse') showUI(); });
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
  document.querySelectorAll('.pr').forEach(b => b.onclick = () => applyPreset(b.dataset.p));
  $('#close').onclick = e => { e.stopPropagation(); hideUI(); };
  ['pointerdown', 'pointermove', 'input', 'keydown', 'wheel'].forEach(ev => $('#panel').addEventListener(ev, bumpUI, { passive: true }));
  document.querySelectorAll('.tg').forEach(b => b.onclick = () => { S.preset = ''; leaveOriginal(); S[b.dataset.k] = !S[b.dataset.k]; syncButtons(); });
  $('#orig').onclick = setOriginal;
  addEventListener('resize', layout);
  // page zoom locked: iOS ignores user-scalable=no, so also cancel its pinch / double-tap gestures (painting always fits the screen)
  ['gesturestart', 'gesturechange', 'gestureend', 'dblclick'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  let lastTouch = 0; document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTouch < 300) e.preventDefault(); lastTouch = n; }, { passive: false });
}

/* ---------- 7 curated presets (模式), each with its own tuned motion speed (no speed slider) ---------- */
const BASE = { frame: true, led: false, aura: false, glint: false, bloom: false, laser: false, look: '', impact: false, rgbStyle: 'bar', lamp: 'auto' };
const PRESETS = {
  golden:  { ...BASE, mode: 'natural', led: true, aura: true, glint: true, bloom: true, impact: true, intensity: 0.75, speed: 1 },        // 金色綻放: gold LED + aura + sun blooms + heavy-beat impact
  gallery: { ...BASE, mode: 'rgb', rgbStyle: 'bar', glint: true, intensity: 0.75, speed: 1 },                                               // 畫廊燈: fixed picture-light bar
  breath:  { ...BASE, mode: 'rgb', rgbStyle: 'wash', lamp: 'blue', aura: true, intensity: 0.55, speed: 0.45 },                                // 柔光呼吸: slow cool blue-violet wash + breathing ring, no LED/sparks
  stage:   { ...BASE, mode: 'rgb', rgbStyle: 'spot', led: true, glint: true, bloom: true, impact: true, intensity: 0.85, speed: 1.2 },       // RGB 舞台: 3 spots + impact
  club:    { ...BASE, mode: 'rgb', rgbStyle: 'wash', frame: true, led: true, laser: true, impact: true, intensity: 0.85, speed: 1.1 },       // 夜店雷射: lasers projected on the painting
  amber:   { ...BASE, mode: 'natural', look: 'amber', led: true, impact: true, intensity: 0.75, speed: 1 },                                  // 琥珀 Amber (琉璃 glass): golden light flowing along curved veins
  gem:     { ...BASE, mode: 'natural', look: 'gem', glint: true, impact: true, intensity: 0.75, speed: 1 }                                   // 寶石 Gem: faceted, white streaks along facet edges flash on beats
};
function applyPreset(k) { saved = null; Object.assign(S, PRESETS[k]); S.preset = k; $('#int').value = S.intensity; syncButtons(); }

/* ---------- loop ---------- */
let slow = 0, frames = 0, lastT = 0;
function loop(now) {
  const dt = now - (lastT || now); lastT = now;
  if (!Number.isFinite(T.tx)) T.tx = 0; if (!Number.isFinite(T.ty)) T.ty = 0;
  T.x += (T.tx - T.x) * 0.06; T.y += (T.ty - T.y) * 0.06;
  analyse(now);
  gl.render(now); drawRGB(now); drawLook(now, dt); frontVis(); drawFront(now); drawImpact(fx, now); updateProg(now);
  if (gl.kind === 'webgl' && !Q.has('nofallback') && document.visibilityState === 'visible') {
    frames++; if (dt > 45) slow++;
    if (frames === 240) { if (slow > 150) swapToLite(); frames = 0; slow = 0; }
  }
  requestAnimationFrame(loop);
}

async function start() {
  bindUI(); applyLang(); syncButtons();
  if (weakDevice()) { S.engine = 'lite'; initLite(); }
  else { try { await initWebGL(); } catch (e) { console.warn('WebGL unavailable, using Canvas 2D', e && e.message); swapToLite(); } }
  layout(); updateEngineNote();
  const img = $('#painting'); if (img.complete && img.naturalWidth) buildRGB(img); else img.addEventListener('load', () => buildRGB(img), { once: true });
  if (window.AELooks) window.AELooks.prepare(img).then(ok => { LK.ready = !!ok; });
  window.__premium = { A, IMP, LK, LZ, audio, CUE, RG, beatTimeline: !!RH, S, setOriginal, syncButtons, engine: () => S.engine, applyPreset, PRESETS, CK, stats: () => ({ sparks: sparks.length, bolts: bolts.length, blooms: blooms.length, rings: rings.length, lamp: RG.cur, rgbReady: !!RG.masks.red, playing: S.playing, t: audio.currentTime, looksOk: LK.ready, lookDraws: LK.draws, impacts: IMP.n }) };
  document.body.dataset.ready = '1';
  requestAnimationFrame(loop);
}
start();
