// AE Lumina Wall — "Living painting" (R10, v2). The painting itself is never changed or distorted.
// Life is ADDED around it, in its own colours, on two depths:
//   back layer  (behind the work)  : far star-dust and soft veils of light filling the empty space around it
//   front layer (over the work)    : motes and silk threads of light that rise from the painting and travel along
//                                    its own strokes, celestial dust drifting down, a few soft near "bokeh" lights
// The painting sits between the two layers, so it reads as an object in a deep, quiet space (depth / parallax).
// Touching a living part: light gathers there and rises from the painting — the longer / firmer, the more.

const TAU = Math.PI * 2;
const GOLD = [236, 205, 140];

// ---------- reading the painting ----------
export function analysePainting(img) {
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh) return null;
  const S = 192, sc = S / Math.max(nw, nh);
  const w = Math.max(8, Math.round(nw * sc)), h = Math.max(8, Math.round(nh * sc));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  let px;
  try { px = x.getImageData(0, 0, w, h).data; } catch { return null; }
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
  const GL = 36, cell = Math.max(w, h) / GL;
  const gw = Math.max(4, Math.round(w / cell)), gh = Math.max(4, Math.round(h / cell)), N = gw * gh;
  const jxx = new Float32Array(N), jyy = new Float32Array(N), jxy = new Float32Array(N), cnt = new Float32Array(N);
  const cr = new Float32Array(N), cg = new Float32Array(N), cb = new Float32Array(N), cs = new Float32Array(N);
  for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++) {
    const i = y * w + xx;
    const gx = (L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1]) - (L[i - w - 1] + 2 * L[i - 1] + L[i + w - 1]);
    const gy = (L[i + w - 1] + 2 * L[i + w] + L[i + w + 1]) - (L[i - w - 1] + 2 * L[i - w] + L[i - w + 1]);
    const c = Math.min(gw - 1, Math.floor(xx / w * gw)) + Math.min(gh - 1, Math.floor(y / h * gh)) * gw;
    jxx[c] += gx * gx; jyy[c] += gy * gy; jxy[c] += gx * gy; cnt[c]++;
    // colour of the cell, weighted towards vivid pixels (the painting's own light, not its paper)
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const wv = 0.15 + (mx ? (mx - mn) / mx : 0);
    cr[c] += r * wv; cg[c] += g * wv; cb[c] += b * wv; cs[c] += wv;
  }
  const blur = (a) => { const o = new Float32Array(N); for (let y = 0; y < gh; y++) for (let x2 = 0; x2 < gw; x2++) { let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x2 + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= gw || Y >= gh) continue; const wt = dx || dy ? 0.6 : 1; s += a[Y * gw + X] * wt; n += wt; } o[y * gw + x2] = s / n; } return o; };
  const Jxx = blur(jxx), Jyy = blur(jyy), Jxy = blur(jxy);
  const energy = new Float32Array(N), coh = new Float32Array(N), ang = new Float32Array(N);
  for (let c = 0; c < N; c++) {
    const n = Math.max(1, cnt[c]), a = Jxx[c] / n, b = Jyy[c] / n, d = Jxy[c] / n;
    energy[c] = a + b;
    coh[c] = Math.sqrt((a - b) * (a - b) + 4 * d * d) / (a + b + 1e-6);
    ang[c] = 0.5 * Math.atan2(2 * d, a - b) + Math.PI / 2; // along the stroke
  }
  const sorted = Array.from(energy).sort((p, q) => p - q);
  const lo = sorted[Math.floor(N * 0.2)], hi = sorted[Math.floor(N * 0.92)] || 1;
  const dirx = new Float32Array(N), diry = new Float32Array(N), alive = new Float32Array(N), col = new Array(N);
  for (let y = 0; y < gh; y++) for (let x2 = 0; x2 < gw; x2++) {
    const c = y * gw + x2; let ux = Math.cos(ang[c]), uy = Math.sin(ang[c]);
    let rx = 0, ry = 0; // align the axial directions with the neighbours: one continuous current
    if (x2 > 0) { rx += dirx[c - 1]; ry += diry[c - 1]; }
    if (y > 0) { rx += dirx[c - gw]; ry += diry[c - gw]; }
    if (rx * ux + ry * uy < 0) { ux = -ux; uy = -uy; }
    dirx[c] = ux; diry[c] = uy;
    const e = Math.max(0, Math.min(1, (energy[c] - lo) / (hi - lo + 1e-6)));
    alive[c] = Math.max(0, Math.min(1, (e - 0.12) / 0.6)) * (0.45 + 0.55 * Math.min(1, coh[c] * 1.6));
    const s = Math.max(1e-6, cs[c]); col[c] = lift([cr[c] / s, cg[c] / s, cb[c] / s]);
  }
  const share = alive.filter(a => a > 0.3).length / N;
  const spawn = []; for (let c = 0; c < N; c++) if (alive[c] > 0.3) spawn.push(c);
  return { gw, gh, dirx, diry, alive, col, share, spawn };
}
// light colours: keep the hue, lift towards a luminous tint (light, not paint)
function lift([r, g, b]) {
  const mx = Math.max(r, g, b, 1), k = 255 / mx;
  r *= k; g *= k; b *= k;
  return [Math.round(r * 0.72 + 255 * 0.28), Math.round(g * 0.72 + 255 * 0.28), Math.round(b * 0.72 + 255 * 0.28)];
}

// soft round glow sprites, cached per colour
const spriteCache = new Map();
function sprite(rgb, soft = 0) {
  const key = rgb.join(',') + '|' + soft;
  let c = spriteCache.get(key);
  if (c) return c;
  const R = 32; c = document.createElement('canvas'); c.width = c.height = R * 2;
  const x = c.getContext('2d'), g = x.createRadialGradient(R, R, 0, R, R, R);
  const [r, gg, b] = rgb;
  if (soft) { g.addColorStop(0, `rgba(${r},${gg},${b},.55)`); g.addColorStop(0.5, `rgba(${r},${gg},${b},.18)`); g.addColorStop(1, `rgba(${r},${gg},${b},0)`); }
  else { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, `rgba(${r},${gg},${b},.95)`); g.addColorStop(0.38, `rgba(${r},${gg},${b},.28)`); g.addColorStop(1, `rgba(${r},${gg},${b},0)`); }
  x.fillStyle = g; x.fillRect(0, 0, R * 2, R * 2);
  if (spriteCache.size > 400) spriteCache.clear();
  spriteCache.set(key, c);
  return c;
}
// a soft shadow: the light floats a little above the painting and casts a faint shade on it (depth)
let shadowSprite = null;
function shade() {
  if (shadowSprite) return shadowSprite;
  const R = 32, c = document.createElement('canvas'); c.width = c.height = R * 2;
  const x = c.getContext('2d'), g = x.createRadialGradient(R, R, 0, R, R, R);
  g.addColorStop(0, 'rgba(28,14,30,.55)'); g.addColorStop(0.45, 'rgba(28,14,30,.2)'); g.addColorStop(1, 'rgba(28,14,30,0)');
  x.fillStyle = g; x.fillRect(0, 0, R * 2, R * 2);
  return (shadowSprite = c);
}
// a feather of light: an elongated soft glow
const featherCache = new Map();
function feather(rgb) {
  const key = rgb.join(',');
  let c = featherCache.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = 64; c.height = 20;
  const x = c.getContext('2d'); x.translate(32, 10); x.scale(1, 0.28);
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 32);
  g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.25, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},.6)`); g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, 32, 0, TAU); x.fill();
  featherCache.set(key, c); return c;
}
const q8 = (rgb) => rgb.map(v => Math.min(255, Math.round(v / 24) * 24)); // fewer sprite variants

export class Alive {
  constructor() {
    this.back = document.createElement('canvas'); this.back.className = 'pl-alive-back';
    this.front = document.createElement('canvas'); this.front.className = 'pl-alive';
    for (const c of [this.back, this.front]) c.setAttribute('aria-hidden', 'true');
    this.bx = this.back.getContext('2d'); this.fx = this.front.getContext('2d');
    this.canvas = this.front;
    this.enabled = true; this.gain = 1; this.maxDpr = 1; this.quality = 1; // soft light needs no retina resolution
    this.motes = []; this.threads = []; this.dust = []; this.bokeh = []; this.veils = []; this.emitters = []; this.feathers = [];
    this.map = null; this.rect = null; this.W = 0; this.H = 0; this.t = 0; this.since = 0; this.on = false; this.amb = 0;
    this.par = { x: 0, y: 0, tx: 0, ty: 0 };
    this.hover = null;
    this.stats = { presses: 0, taps: 0, frames: 0, spawned: 0 };
    this.palette = [GOLD];
  }
  get ok() { return !!(this.bx && this.fx); }

  mount(stage) { // the back layer goes behind the paintings, the front layer above them
    if (this.back.parentNode !== stage) stage.insertBefore(this.back, stage.firstChild);
    if (this.front.parentNode !== stage) stage.appendChild(this.front);
  }
  resize(W, H) {
    this.W = W; this.H = H;
    const dpr = Math.min(this.maxDpr, window.devicePixelRatio || 1);
    // the back layer is far, soft light: half resolution is invisible to the eye and much cheaper
    for (const [c, x, k] of [[this.back, this.bx, dpr * 0.5], [this.front, this.fx, dpr]]) {
      const w = Math.round(W * k), h = Math.round(H * k);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      x.setTransform(k, 0, 0, k, 0, 0);
    }
  }

  // a painting has just appeared
  attach(slide, media, rect, id, palette) {
    if (!this.ok || !media || media.tagName !== 'IMG' || !media.naturalWidth) { this.detach(); return false; }
    this.cache = this.cache || new Map();
    let map = this.cache.get(id);
    if (!map) { map = analysePainting(media); if (!map) { this.detach(); return false; } this.cache.set(id, map); }
    this.mount(slide.parentNode);
    this.map = map; this.on = true; this.t0 = performance.now(); this.since = 0;
    this.palette = (palette && palette.length ? palette : [GOLD]).map(c => q8(c));
    this.setRect(rect);
    return true;
  }
  // the painting leaves: nothing new is born, what is in the air drifts on and fades (no hard cut between works)
  detach() { this.on = false; this.map = null; this.emitters = []; }
  // the player closes: clear everything
  clear() { this.detach(); this.feathers = []; this.motes = []; this.threads = []; this.dust = []; this.bokeh = []; this.veils = []; this.amb = 0; if (this.W) { this.bx.clearRect(0, 0, this.W, this.H); this.fx.clearRect(0, 0, this.W, this.H); } }
  setRect(r) {
    if (!r) return;
    this.rect = r;
    const st = this.front.parentNode;
    if (st) this.resize(st.clientWidth, st.clientHeight);
  }

  aliveAt(x, y) {
    const r = this.rect, m = this.map;
    if (!this.on || !r || !m || x < r.x || y < r.y || x > r.x + r.w || y > r.y + r.h) return 0;
    const gx = Math.min(m.gw - 1, Math.floor((x - r.x) / r.w * m.gw)), gy = Math.min(m.gh - 1, Math.floor((y - r.y) / r.h * m.gh));
    let best = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = gx + dx, Y = gy + dy; if (X >= 0 && Y >= 0 && X < m.gw && Y < m.gh) best = Math.max(best, m.alive[Y * m.gw + X] * (dx || dy ? 0.85 : 1)); }
    return best;
  }
  _cellAt(x, y) {
    const r = this.rect, m = this.map;
    if (!r || !m || x < r.x || y < r.y || x > r.x + r.w || y > r.y + r.h) return -1;
    return Math.min(m.gw - 1, Math.floor((x - r.x) / r.w * m.gw)) + Math.min(m.gh - 1, Math.floor((y - r.y) / r.h * m.gh)) * m.gw;
  }
  _colorAt(x, y) { const c = this._cellAt(x, y); return c >= 0 ? q8(this.map.col[c]) : this.palette[(Math.random() * this.palette.length) | 0]; }

  // ---- touch ----
  press(id, x, y, force = 0) {
    if (!this.on) return;
    this.emitters = this.emitters.filter(e => e.id !== id);
    this.emitters.push({ id, x, y, hold: 0, force, acc: 0, glow: 0, down: true, spin: Math.random() < 0.5 ? -1 : 1 });
    this.stats.presses++;
    this._burst(x, y, 10 + force * 8, 0.8);
  }
  move(id, x, y, force) { const e = this.emitters.find(q => q.id === id && q.down); if (e) { e.x = x; e.y = y; if (force != null) e.force = Math.max(e.force, force); } }
  release(id) {
    const e = this.emitters.find(q => q.id === id && q.down); if (!e) return;
    e.down = false;
    if (e.hold < 0.25) { this.stats.taps++; e.glow = Math.max(e.glow, 0.85); this._burst(e.x, e.y, 14, 1); }
    else this._burst(e.x, e.y, Math.min(30, 8 + e.hold * 8), 1.2); // let go: the gathered light rises away
  }
  setHover(x, y) { const a = this.aliveAt(x, y); this.hover = a > 0.3 ? { x, y } : null; return a; }
  clearHover() { this.hover = null; }
  strength() { return this.emitters.reduce((m, e) => Math.max(m, e.down ? Math.min(1.5, 0.6 + e.hold * 0.6 + e.force * 0.5) : e.glow), 0); }
  get pressing() { return this.emitters.some(e => e.down); }

  // ---- births ----
  _mote(x, y, opt = {}) {
    if (this.motes.length > 260 * this.quality) return;
    const z = opt.z ?? (0.75 + Math.random() * 0.6);
    const a = Math.random() * TAU, sp = opt.speed ?? 0;
    this.motes.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opt.rise || 0), life: 0, max: opt.life ?? (3.5 + Math.random() * 3.5),
      size: (opt.size ?? (1.5 + Math.random() * 2.4)) * z, z, rgb: opt.rgb || this._colorAt(x, y), tw: Math.random() * TAU, spin: opt.spin || 0, sign: Math.random() < 0.5 ? -1 : 1 });
    this.stats.spawned++;
  }
  _burst(x, y, n, k) {
    for (let i = 0; i < n; i++) this._mote(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, { speed: 30 + Math.random() * 60 * k, rise: 14 * k, life: 2.2 + Math.random() * 2.4, size: 1.4 + Math.random() * 2.6 });
  }
  _thread() {
    const m = this.map, r = this.rect; if (!m || !m.spawn.length || this.threads.length >= 4 * this.quality) return;
    const c = m.spawn[(Math.random() * m.spawn.length) | 0];
    const x = r.x + ((c % m.gw) + Math.random()) / m.gw * r.w, y = r.y + (Math.floor(c / m.gw) + Math.random()) / m.gh * r.h;
    this.threads.push({ x, y, pts: [[x, y]], life: 0, max: 5 + Math.random() * 4, rgb: this._colorAt(x, y), sign: Math.random() < 0.5 ? -1 : 1, w: 0.7 + Math.random() * 0.8 });
  }

  // the current under a point: along the painting's own strokes inside it, a slow upward breath outside it
  _flow(x, y, t, sign) {
    const c = this._cellAt(x, y);
    const nx = Math.sin(y * 0.011 + t * 0.35) + Math.sin(x * 0.007 - t * 0.27), ny = Math.cos(x * 0.009 + t * 0.31) - Math.sin(y * 0.006 + t * 0.21);
    if (c < 0) return [nx * 6, -9 + ny * 5];
    const m = this.map;
    return [m.dirx[c] * 20 * sign + nx * 4, m.diry[c] * 20 * sign + ny * 4 - 4];
  }

  frame(dt, playing) {
    if (!this.ok || !this.W) return;
    dt = Math.min(dt, 0.05);
    this.t += dt;
    if (this.on) this.since = (performance.now() - this.t0) / 1000;
    // still at first, then the light starts to live
    const target = this.on ? Math.max(0, Math.min(1, (this.since - 2.2) / 2.8)) * (playing ? 1 : 0.7) : 0;
    this.amb += (target - this.amb) * Math.min(1, dt * 2);
    const g = this.gain, q = this.quality, r = this.rect, m = this.map, t = this.t;
    this.par.x += (this.par.tx - this.par.x) * Math.min(1, dt * 2.5); this.par.y += (this.par.ty - this.par.y) * Math.min(1, dt * 2.5);

    // births: motes from the living parts, threads, dust from above, near bokeh, veils in the empty space
    if (this.on && m && r && m.spawn.length) {
      this._acc = (this._acc || 0) + dt * 7 * this.amb * g * q;
      while (this._acc >= 1) {
        this._acc -= 1;
        const c = m.spawn[(Math.random() * m.spawn.length) | 0];
        const x = r.x + ((c % m.gw) + Math.random()) / m.gw * r.w, y = r.y + (Math.floor(c / m.gw) + Math.random()) / m.gh * r.h;
        this._mote(x, y, { rgb: q8(m.col[c]) });
      }
      if (this.amb > 0.5 && Math.random() < dt * 0.5 * g) this._thread();
    }
    this._dacc = (this._dacc || 0) + dt * 4 * this.amb * q;
    while (this._dacc >= 1) {
      this._dacc -= 1;
      const z = 0.45 + Math.random() * 1.0;
      this.dust.push({ x: Math.random() * this.W, y: -12, z, vy: (7 + Math.random() * 10) * z, ph: Math.random() * TAU, rgb: Math.random() < 0.55 ? GOLD : this.palette[(Math.random() * this.palette.length) | 0], life: 0, size: (0.9 + Math.random() * 1.9) * z });
    }
    // feathers of light descending from above: slow, turning, a few at a time
    if (this.amb > 0.4 && this.feathers.length < Math.round(6 * q) && Math.random() < dt * 0.55 * g) {
      const z = 0.8 + Math.random() * 0.7;
      this.feathers.push({ x: Math.random() * this.W, y: -20, z, vy: (9 + Math.random() * 8) * z, ph: Math.random() * TAU, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 0.7, len: (16 + Math.random() * 16) * z, rgb: Math.random() < 0.5 ? GOLD : this.palette[(Math.random() * this.palette.length) | 0], life: 0 });
    }
    while (this.bokeh.length < Math.round(5 * q) && this.amb > 0.2) {
      const z = 1.6 + Math.random() * 0.9;
      this.bokeh.push({ x: Math.random() * this.W, y: this.H * (0.2 + Math.random() * 0.8), z, r: 26 + Math.random() * 40, vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 4, rgb: this.palette[(Math.random() * this.palette.length) | 0], life: 0, max: 14 + Math.random() * 10 });
    }
    while (this.veils.length < 4 && this.amb > 0.1) {
      this.veils.push({ x: Math.random() * this.W, y: Math.random() * this.H, r: Math.max(this.W, this.H) * (0.25 + Math.random() * 0.25), vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 4, rgb: this.palette[(Math.random() * this.palette.length) | 0], life: 0, max: 18 + Math.random() * 14 });
    }

    // touch emitters: light gathers where the painting is touched and rises out of it
    for (const e of this.emitters) {
      if (e.down) {
        e.hold += dt;
        const s = Math.min(1.5, 0.6 + e.hold * 0.6 + e.force * 0.5);
        e.glow += (s - e.glow) * Math.min(1, dt * 5);
        e.acc += dt * (8 + e.hold * 14 + e.force * 12) * g;
        const rad = 14 + Math.min(70, e.hold * 26) + e.force * 20;
        while (e.acc >= 1) {
          e.acc -= 1;
          const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * rad;
          const x = e.x + Math.cos(a) * d, y = e.y + Math.sin(a) * d;
          this._mote(x, y, { speed: 10 + Math.random() * 25, rise: 18 + e.hold * 10, life: 2.4 + Math.random() * 2.6, size: 1.3 + Math.random() * 2.4 + Math.min(1.5, e.hold * 0.5), spin: e.spin * (0.9 + Math.random() * 0.6), z: 0.85 + Math.random() * 0.55 });
        }
      } else e.glow *= Math.exp(-dt * 2.2);
    }
    this.emitters = this.emitters.filter(e => e.down || e.glow > 0.02);

    // ---- draw: back layer (behind the painting) ----
    const bx = this.bx, fx = this.fx, W = this.W, H = this.H;
    bx.clearRect(0, 0, W, H); fx.clearRect(0, 0, W, H);
    bx.globalCompositeOperation = 'lighter'; fx.globalCompositeOperation = 'lighter';
    const fade = (l, max, inT = 1.2, outT = 1.6) => Math.max(0, Math.min(1, l / inT, (max - l) / outT));
    for (const v of this.veils) {
      v.life += dt; v.x += v.vx * dt; v.y += v.vy * dt;
      const a = fade(v.life, v.max, 5, 6) * 0.10 * this.amb * g;
      if (a <= 0.002) continue;
      bx.globalAlpha = a;
      bx.drawImage(sprite(v.rgb, 1), v.x - v.r - this.par.x * 0.3, v.y - v.r - this.par.y * 0.3, v.r * 2, v.r * 2);
    }
    this.veils = this.veils.filter(v => v.life < v.max);
    // dust: far grains pass behind the painting, near grains in front of it
    for (const d of this.dust) {
      d.life += dt; d.y += d.vy * dt; d.x += Math.sin(t * 0.6 + d.ph) * 6 * dt * d.z;
      const tw = 0.55 + 0.45 * Math.sin(t * (1.6 + d.z) + d.ph * 3);
      const a = Math.min(1, d.life / 1.5) * tw * (d.z < 0.9 ? 0.55 : 0.85) * Math.max(this.amb, 0.25);
      if (a <= 0.01) continue;
      const ctx = d.z < 0.9 ? bx : fx, p = d.z < 0.9 ? 0.4 : 1.2, s = d.size * 7;
      ctx.globalAlpha = a; ctx.drawImage(sprite(q8(d.rgb)), d.x - s / 2 - this.par.x * p * d.z, d.y - s / 2 - this.par.y * p * d.z, s, s);
    }
    this.dust = this.dust.filter(d => d.y < H + 20 && d.life < 60);

    // ---- front layer (over the painting) ----
    for (const m2 of this.motes) {
      m2.life += dt;
      const [fx2, fy2] = this._flow(m2.x, m2.y, t, m2.sign);
      // spin around where it was born (touch), then join the painting's current and rise
      m2.vx += (fx2 - m2.vx) * Math.min(1, dt * 1.4) + (m2.spin ? -m2.vy * m2.spin * dt * 0.8 : 0);
      m2.vy += (fy2 - m2.vy) * Math.min(1, dt * 1.4) + (m2.spin ? m2.vx * m2.spin * dt * 0.8 : 0);
      m2.x += m2.vx * dt; m2.y += m2.vy * dt;
      const tw = 0.7 + 0.3 * Math.sin(t * 3.1 + m2.tw);
      const a = fade(m2.life, m2.max, 0.9, 1.8) * tw * 0.9;
      if (a <= 0.01) continue;
      const s = m2.size * 8, X = m2.x - this.par.x * m2.z, Y = m2.y - this.par.y * m2.z;
      if (r && X > r.x && X < r.x + r.w && Y > r.y && Y < r.y + r.h) { // over the painting: a faint shade below it → it floats
        fx.globalCompositeOperation = 'source-over'; fx.globalAlpha = a * 0.7;
        const sh = s * 0.9, off = 2 + 3 * m2.z; fx.drawImage(shade(), X - sh / 2 + off * 0.5, Y - sh / 2 + off, sh, sh);
        fx.globalCompositeOperation = 'lighter';
      }
      fx.globalAlpha = a;
      fx.drawImage(sprite(m2.rgb), X - s / 2, Y - s / 2, s, s);
    }
    this.motes = this.motes.filter(m2 => m2.life < m2.max && m2.x > -60 && m2.x < W + 60 && m2.y > -60 && m2.y < H + 60);
    // silk threads of light following the strokes
    fx.lineCap = 'round'; fx.lineJoin = 'round';
    for (const th of this.threads) {
      th.life += dt;
      const [vx, vy] = this._flow(th.x, th.y, t, th.sign);
      th.x += vx * dt * 1.6; th.y += vy * dt * 1.6;
      th.pts.push([th.x, th.y]); if (th.pts.length > 46) th.pts.shift();
      const a = fade(th.life, th.max, 1.4, 2.2) * 0.5 * g;
      if (a <= 0.01 || th.pts.length < 3) continue;
      const [cr, cg, cb] = th.rgb;
      fx.strokeStyle = `rgb(${cr},${cg},${cb})`;
      for (let i = 1; i < th.pts.length; i++) {
        const k = i / th.pts.length;
        fx.globalAlpha = a * k * k; fx.lineWidth = th.w * (0.4 + k);
        fx.beginPath(); fx.moveTo(th.pts[i - 1][0] - this.par.x, th.pts[i - 1][1] - this.par.y); fx.lineTo(th.pts[i][0] - this.par.x, th.pts[i][1] - this.par.y); fx.stroke();
      }
    }
    this.threads = this.threads.filter(th => th.life < th.max);
    // touch glow: a soft halo where the light gathers
    for (const e of this.emitters) {
      if (e.glow < 0.02) continue;
      const rr = (34 + e.glow * 40) * (1 + 0.06 * Math.sin(t * 4));
      fx.globalAlpha = Math.min(0.55, e.glow * 0.38);
      fx.drawImage(sprite(q8(this._colorAt(e.x, e.y)), 1), e.x - rr, e.y - rr, rr * 2, rr * 2);
      fx.globalAlpha = Math.min(0.35, e.glow * 0.22);
      fx.drawImage(sprite(GOLD, 1), e.x - rr * 0.6, e.y - rr * 0.6, rr * 1.2, rr * 1.2);
    }
    if (this.hover && this.on) { fx.globalAlpha = 0.16; const rr = 40; fx.drawImage(sprite(q8(this._colorAt(this.hover.x, this.hover.y)), 1), this.hover.x - rr, this.hover.y - rr, rr * 2, rr * 2); }
    for (const f of this.feathers) {
      f.life += dt; f.y += f.vy * dt; f.x += Math.sin(t * 0.5 + f.ph) * 10 * dt; f.rot += f.vr * dt;
      const a = Math.min(1, f.life / 2) * (0.55 + 0.25 * Math.sin(t * 1.7 + f.ph)) * this.amb;
      if (a <= 0.01) continue;
      const X = f.x - this.par.x * f.z, Y = f.y - this.par.y * f.z;
      fx.save(); fx.translate(X, Y); fx.rotate(f.rot + Math.sin(t * 0.8 + f.ph) * 0.4);
      fx.globalAlpha = a; fx.drawImage(feather(q8(f.rgb)), -f.len, -f.len * 0.3, f.len * 2, f.len * 0.6); fx.restore();
    }
    this.feathers = this.feathers.filter(f => f.y < this.H + 30);
    // near, out-of-focus lights in front of everything: depth
    for (const b of this.bokeh) {
      b.life += dt; b.x += b.vx * dt; b.y += b.vy * dt;
      const a = fade(b.life, b.max, 4, 5) * 0.12 * this.amb;
      if (a <= 0.003) continue;
      fx.globalAlpha = a; fx.drawImage(sprite(b.rgb, 1), b.x - b.r - this.par.x * b.z * 1.5, b.y - b.r - this.par.y * b.z * 1.5, b.r * 2, b.r * 2);
    }
    this.bokeh = this.bokeh.filter(b => b.life < b.max);
    bx.globalAlpha = 1; fx.globalAlpha = 1;
    this.stats.frames++;
  }
  // gentle parallax: the layers shift a few pixels with the pointer, the painting stays put
  look(x, y) { if (!this.W) return; this.par.tx = (x / this.W - 0.5) * 10; this.par.ty = (y / this.H - 0.5) * 8; }
  counts() {
    const r = this.rect, out = r ? this.motes.filter(m => m.x < r.x || m.x > r.x + r.w || m.y < r.y || m.y > r.y + r.h).length + this.dust.length : 0;
    return { outside: out, feathers: this.feathers.length, motes: this.motes.length, threads: this.threads.length, dust: this.dust.length, bokeh: this.bokeh.length, veils: this.veils.length };
  }
}
