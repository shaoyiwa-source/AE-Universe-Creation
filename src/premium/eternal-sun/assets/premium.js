/* 盛明 Eternal Sun — Premium Edition dynamic wallpaper (site v2476.57, Preview trial).
   ART RULE: the painting is a plain, untouched <img>. Every effect is a separate layer behind it
   (wall / back-glow / gold frame) or a toggleable overlay above it (LED, aura, UV, glints).
   With all effects off the painting pixels are exactly the original image. */
const $ = s => document.querySelector(s);
const Q = new URLSearchParams(location.search);
const SUN = { x: 0.515, y: 0.50 };            // sun focal point of the painting (normalized)
const AR = 1110 / 1536;
const S = {
  lang: Q.get('lang') === 'en' ? 'en' : 'zh', mode: 'natural', intensity: 0.7, speed: 1,
  frame: true, led: true, aura: true, glint: true, laser: true, lamp: 'auto',
  engine: 'webgl', playing: false
};
if (Q.get('fx') === '0') Object.assign(S, { frame: false, led: false, aura: false, glint: false, laser: false });
if (['rgb', 'uv'].includes(Q.get('mode'))) S.mode = 'rgb'; if (Q.get('mode') === 'show') S.mode = 'show';

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
const A = { ctx: null, an: null, buf: null, bass: 0, avg: 0, level: 0, lastKick: 0, kick: 0 };
const audio = $('#music');
async function togglePlay() {
  if (!A.ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    A.ctx = new AC();
    const src = A.ctx.createMediaElementSource(audio);
    A.an = A.ctx.createAnalyser(); A.an.fftSize = 1024; A.an.smoothingTimeConstant = 0.6;
    src.connect(A.an); A.an.connect(A.ctx.destination);
    A.buf = new Uint8Array(A.an.frequencyBinCount);
    try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().catch(() => {}); } catch (e) {}
  }
  if (A.ctx.state === 'suspended') await A.ctx.resume();
  if (audio.paused) { try { await audio.play(); S.playing = true; } catch (e) { S.playing = false; } }
  else { audio.pause(); S.playing = false; }
  updatePlayLabel();
}
let rings = [];
function analyse(now) {
  let bass = 0;
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
function onKick(now, k) { A.lastKick = now; A.kick = 1; RG.beats++; if (S.laser && S.playing) fireBolts(now, null, S.mode === 'show' ? 4 : 2); if (S.aura) rings.push({ t: now, k }); if (rings.length > 8) rings.shift(); }

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
const LAMPS = ['green', 'red', 'blue'], LAMP_RGB = { red: [255, 47, 72], green: [85, 255, 125], blue: [120, 80, 255] };
const RG = { masks: {}, beats: 0, cur: 'green', from: 'green', changed: -1e9, lastKey: '' };
function lampResponse(r, g, b, c) {
  const fl = Math.max(0, g - r * .45 - b * .25), w = (r + g + b) / 3;
  if (c === 'red') return [r * .82 + g * .18 + 40, g * .22 + r * .1, b * .30 + r * .12 + 14];
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
  const step = S.playing ? Math.floor(RG.beats / 8) : Math.floor(now * S.speed / 3500);
  return LAMPS[((step % 3) + 3) % 3];
}
function drawRGB(now) {
  const rc = $('#rgb'); const on = S.mode === 'rgb' && RG.masks.red;
  rc.classList.toggle('on', !!on); if (!on) return;
  const col = lampNow(now);
  if (col !== RG.cur) { RG.from = RG.cur; RG.cur = col; RG.changed = now; }
  const mix = Math.min(1, (now - RG.changed) / 900), c = rc.getContext('2d'), op = k => (k === 'red' ? .78 : .86) * (0.55 + 0.5 * S.intensity);
  c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, rc.width, rc.height);
  if (mix < 1) { c.globalAlpha = op(RG.from) * (1 - mix); c.drawImage(RG.masks[RG.from], 0, 0); }
  c.globalAlpha = op(RG.cur) * (mix < 1 ? mix : 1); c.drawImage(RG.masks[RG.cur], 0, 0);
  // beat shimmer: lamp brightens slightly on each kick
  c.globalCompositeOperation = 'screen'; const L2 = lampColor(now);
  c.globalAlpha = 0.10 * A.kick + 0.06 * A.level; c.fillStyle = `rgb(${L2.join(',')})`; c.fillRect(0, 0, rc.width, rc.height);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}
function lampColor(now) {
  const a = LAMP_RGB[RG.from], b = LAMP_RGB[RG.cur], m = Math.min(1, (now - RG.changed) / 900);
  return a.map((v, i) => Math.round(v * (1 - m) + b[i] * m));
}

/* ---------- Laser beams (restored from homepage Eternal Sun sound-light / Light Player 'laser' effect, experience-renderer.js) ---------- */
const LASER = ['#ff416d', '#57ffa0', '#ffe28d', '#65dbff', '#c987ff', '#ffac68'];
let bolts = [];
function fireBolts(now, at, n) {
  const p = L.p;
  for (let i = 0; i < n; i++) {
    const e = (i + bolts.length) % 3, ox = e === 0 ? -10 : e === 1 ? L.W + 10 : p.x + p.w * (.1 + Math.random() * .8), oy = e === 2 ? -10 : L.H * (.1 + Math.random() * .6);
    const tx = at ? at.x : p.x + p.w * (.15 + .7 * Math.random()), ty = at ? at.y : p.y + p.h * (.15 + .7 * Math.random());
    bolts.push({ ox, oy, x: tx, y: ty, born: now + i * 25, life: at ? 700 : 260, col: LASER[(i + bolts.length) % 6] });
  }
  if (bolts.length > 40) bolts.splice(0, bolts.length - 40);
}
function drawLasers(c, now) {
  const p = L.p, show = S.mode === 'show';
  if (!S.laser) { bolts.length = 0; return; }
  const t = now / 1000 * S.speed, I = S.intensity, pulse = Math.max(A.kick, S.playing ? 0 : Math.pow(1 - ((t / .81) % 1), 3) * .6);
  c.lineCap = 'round';
  // sweeping ambient beams: 6 in light-show mode, 3 otherwise
  const n = show ? 6 : 3, base = show ? .55 : .28;
  for (let i = 0; i < n; i++) {
    const k = show ? i : i * 2, ox = k % 3 === 0 ? 0 : k % 3 === 1 ? L.W : p.x + p.w * (.2 + k * .11), oy = k % 3 === 2 ? 0 : L.H * (.12 + (k % 4) * .2);
    const ph = t * (.55 + k * .07) + k * 1.7, tx = p.x + p.w * (.5 + .4 * Math.sin(ph)), ty = p.y + p.h * (.3 + .42 * (.5 + .5 * Math.cos(ph * 1.3)));
    beam(c, ox, oy, tx, ty, LASER[k], Math.min(1, (base + .45 * pulse) * (0.4 + I)), pulse);
  }
  bolts = bolts.filter(b => now - b.born < b.life);
  for (const b of bolts) { const q = Math.max(0, now - b.born) / b.life; beam(c, b.ox, b.oy, b.x, b.y, b.col, Math.sin(Math.PI * q) * (0.5 + I * .6), 1); }
}
function beam(c, ox, oy, tx, ty, col, a, pulse) {
  if (!(a > 0.01)) return;
  c.globalAlpha = a; c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = (12 + pulse * 14) * L.dpr; c.lineWidth = 1.1 + pulse * 2;
  c.beginPath(); c.moveTo(ox, oy); c.lineTo(tx, ty); c.stroke();
  c.shadowBlur = 0; c.strokeStyle = '#fff9df'; c.lineWidth = .6; c.globalAlpha = a * .8; c.beginPath(); c.moveTo(ox, oy); c.lineTo(tx, ty); c.stroke();
  const r = 22 + pulse * 26, g = c.createRadialGradient(tx, ty, 1, tx, ty, r);
  g.addColorStop(0, `rgba(255,249,218,${.6 * a})`); g.addColorStop(.25, col + '88'); g.addColorStop(1, col + '00');
  c.globalAlpha = 1; c.fillStyle = g; c.fillRect(tx - r, ty - r, 2 * r, 2 * r);
}
/* sun bloom (restored from Light Player 'glow' / homepage tap bloom): tap the painting or press ✦ */
let blooms = [];
function bloom(now, x, y) { blooms.push({ t: now, x, y }); if (blooms.length > 4) blooms.shift(); if (S.aura) { rings.push({ t: now, k: 1 }); } if (S.laser) fireBolts(now, { x, y }, 6); }
function drawBlooms(c, now) {
  blooms = blooms.filter(b => now - b.t < 1800);
  for (const b of blooms) {
    const q = (now - b.t) / 1800, a = Math.sin(Math.PI * Math.min(1, q * 1.4)) * (1 - q) * (0.6 + .5 * S.intensity), r = L.p.w * (.08 + .32 * q);
    const col = S.mode === 'rgb' ? lampColor(now) : [255, 214, 120];
    const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, r); g.addColorStop(0, `rgba(255,250,230,${a})`); g.addColorStop(.35, `rgba(${col.join(',')},${a * .6})`); g.addColorStop(1, `rgba(${col.join(',')},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, r, 0, 6.2832); c.fill();
    c.strokeStyle = `rgba(255,240,200,${a * .5})`; c.lineWidth = 1;
    for (let i = 0; i < 12; i++) { const an = i * .5236 + q; c.beginPath(); c.moveTo(b.x + Math.cos(an) * r * .2, b.y + Math.sin(an) * r * .2); c.lineTo(b.x + Math.cos(an) * r * 1.1, b.y + Math.sin(an) * r * 1.1); c.stroke(); }
  }
}
/* lamp cones in RGB mode: coloured light falling from three virtual lamps above the painting */
function drawCones(c, now) {
  if (S.mode !== 'rgb') return;
  const p = L.p, col = lampColor(now), pos = { red: .18, green: .5, blue: .82 }[RG.cur], x = p.x + p.w * pos, a = (.16 + .1 * A.kick) * (0.5 + S.intensity);
  const g = c.createLinearGradient(x, 0, p.x + p.w / 2, p.y + p.h * .6); g.addColorStop(0, `rgba(${col.join(',')},${a})`); g.addColorStop(1, `rgba(${col.join(',')},0)`);
  c.fillStyle = g; c.beginPath(); c.moveTo(x - 6, 0); c.lineTo(x + 6, 0); c.lineTo(p.x + p.w * 1.05, p.y + p.h * .8); c.lineTo(p.x - p.w * .05, p.y + p.h * .8); c.closePath(); c.fill();
  // coloured spill on the wall around the frame
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, sg = c.createRadialGradient(cx, cy, p.w * .55, cx, cy, p.w * 1.2);
  sg.addColorStop(0, `rgba(${col.join(',')},${.22 * (0.5 + S.intensity)})`); sg.addColorStop(1, `rgba(${col.join(',')},0)`);
  c.save(); c.beginPath(); c.rect(0, 0, L.W, L.H); c.rect(p.x, p.y, p.w, p.h); c.clip('evenodd'); c.fillStyle = sg; c.fillRect(0, 0, L.W, L.H); c.restore();
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
    const e = 0.35 + 0.45 * A.level + 0.35 * A.kick, N = 160;
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
    c.save(); c.beginPath(); c.rect(p.x, p.y, p.w, p.h); c.clip();
    const cx = p.x + p.w * SUN.x, cy = p.y + p.h * SUN.y, dur = 2600 / S.speed;
    rings = rings.filter(r => now - r.t < dur);
    for (const r of rings) {
      const q = (now - r.t) / dur, e = 1 - Math.pow(1 - q, 2.2);
      const rad = p.w * (0.05 + 0.5 * e), a = Math.pow(1 - q, 1.8) * 0.33 * I * (0.6 + 0.6 * r.k);
      const gr = c.createRadialGradient(cx, cy, rad * 0.86, cx, cy, rad * 1.04);
      gr.addColorStop(0, 'rgba(255,214,140,0)'); gr.addColorStop(0.75, `rgba(255,214,140,${a})`); gr.addColorStop(1, 'rgba(255,200,120,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, rad * 1.05, 0, 6.2832); c.fill();
    }
    c.restore();
  } else rings.length = 0;
  if (S.glint) {
    if (Math.random() < 0.006 * S.speed * (0.5 + I)) glints.push({ t: now, u: Math.random(), s: 0.6 + Math.random() * 0.6 });
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
  } else glints.length = 0;
  drawCones(c, now); drawBlooms(c, now); drawLasers(c, now);
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
function showUI() { document.body.classList.add('ui'); $('#panel').hidden = false; clearTimeout(uiTimer); uiTimer = setTimeout(() => { if (!$('#panel').matches(':hover')) document.body.classList.remove('ui'); }, 4500); }
function syncButtons() {
  document.querySelectorAll('.tg').forEach(b => { b.classList.toggle('on', !!S[b.dataset.k]); b.setAttribute('aria-pressed', String(!!S[b.dataset.k])); });
  for (const [id, m] of [['#mNat', 'natural'], ['#mRgb', 'rgb'], ['#mShow', 'show']]) { $(id).classList.toggle('on', S.mode === m); $(id).setAttribute('aria-pressed', String(S.mode === m)); }
  $('#lamps').hidden = S.mode !== 'rgb';
  document.querySelectorAll('.lp').forEach(b => b.classList.toggle('on', b.dataset.c === S.lamp));
  $('#orig').classList.toggle('on', !!saved); $('#orig').setAttribute('aria-pressed', String(!!saved));
  // nothing to draw above the painting -> remove the overlay layers entirely, so the <img> is composited exactly as on its own
  const any = S.led || S.aura || S.glint || S.laser || S.mode !== 'natural';
  $('#front').style.display = any ? '' : 'none';
  if (S.mode !== 'rgb') { $('#rgb').classList.remove('on'); }
  $('#rgb').style.display = S.mode === 'rgb' ? '' : 'none';
  document.body.dataset.mode = S.mode; document.body.dataset.original = saved ? '1' : '0';
}
let saved = null; const KEYS = ['frame', 'led', 'aura', 'glint', 'laser', 'mode'];
function setOriginal() { // toggle: 1st press = untouched original art, 2nd press = restore previous effects
  if (saved) { Object.assign(S, saved); saved = null; }
  else { saved = Object.fromEntries(KEYS.map(k => [k, S[k]])); Object.assign(S, { frame: false, led: false, aura: false, glint: false, laser: false, mode: 'natural' }); T.tx = T.ty = 0; rings.length = 0; bolts.length = 0; blooms.length = 0; }
  syncButtons();
}
function leaveOriginal() { saved = null; }
function bindUI() {
  const st = $('#stage');
  st.addEventListener('pointerdown', e => {
    onPointer(e); const wasHidden = !document.body.classList.contains('ui'); showUI();
    const p = L.p; if (!saved && !wasHidden && e.clientX >= p.x && e.clientX <= p.x + p.w && e.clientY >= p.y && e.clientY <= p.y + p.h) bloom(performance.now(), e.clientX, e.clientY);
  });
  st.addEventListener('pointermove', e => { onPointer(e); if (e.pointerType === 'mouse') showUI(); });
  $('#panel').addEventListener('pointerdown', e => { e.stopPropagation(); showUI(); });
  $('#play').onclick = togglePlay;
  $('#mNat').onclick = () => { leaveOriginal(); S.mode = 'natural'; syncButtons(); };
  $('#mRgb').onclick = () => { leaveOriginal(); S.mode = 'rgb'; syncButtons(); };
  $('#mShow').onclick = () => { leaveOriginal(); S.mode = 'show'; if (!S.laser) S.laser = true; syncButtons(); };
  document.querySelectorAll('.lp').forEach(b => b.onclick = () => { S.lamp = b.dataset.c; syncButtons(); });
  $('#burst').onclick = () => { leaveOriginal(); const p = L.p; bloom(performance.now(), p.x + p.w * SUN.x, p.y + p.h * SUN.y); syncButtons(); };
  $('#lang').onclick = () => { S.lang = S.lang === 'en' ? 'zh' : 'en'; applyLang(); };
  $('#int').oninput = e => { S.intensity = +e.target.value; };
  $('#spd').oninput = e => { S.speed = +e.target.value; };
  document.querySelectorAll('.tg').forEach(b => b.onclick = () => { leaveOriginal(); S[b.dataset.k] = !S[b.dataset.k]; syncButtons(); });
  $('#orig').onclick = setOriginal;
  addEventListener('resize', layout);
}

/* ---------- loop ---------- */
let slow = 0, frames = 0, lastT = 0;
function loop(now) {
  const dt = now - (lastT || now); lastT = now;
  if (!Number.isFinite(T.tx)) T.tx = 0; if (!Number.isFinite(T.ty)) T.ty = 0;
  T.x += (T.tx - T.x) * 0.06; T.y += (T.ty - T.y) * 0.06;
  analyse(now);
  gl.render(now); drawRGB(now); drawFront(now);
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
  window.__premium = { S, setOriginal, syncButtons, engine: () => S.engine, stats: () => ({ bolts: bolts.length, blooms: blooms.length, rings: rings.length, lamp: RG.cur, rgbReady: !!RG.masks.red, playing: S.playing, t: audio.currentTime }) };
  document.body.dataset.ready = '1';
  requestAnimationFrame(loop);
}
start();
