// AE Lumina Wall — light-effects engine (single canvas, additive light, palette-aware)
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const GOLD = [236, 205, 140];
const WARM = [255, 232, 186];

export class FX {
  constructor(canvas, opts = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.reduced = !!opts.reduced;
    this.W = 1; this.H = 1; this.dpr = 1;
    this.palette = [GOLD, [214, 228, 217], [180, 200, 255]];
    this.effects = {};
    this.interact = {};
    this.rect = { x: 0, y: 0, w: 1, h: 1 };
    this.sprites = new Map();
    this.running = false;
    this.t = 0;
    this.last = 0;
    this.onFrame = null;
    this.lang = 'zh';
    this.tempo = 1;
    // particle pools
    this.bokeh = []; this.stars = []; this.petals = []; this.shooting = null;
    this.ripples = []; this.sparks = []; this.seeds = []; this.flowers = []; this.dust = [];
    this.trail = [];
    this.flash = 0; this.rings = null;
    this.nextSeed = 4;
    this.lumi = { x: -100, y: -100, vx: 0, vy: 0, lastInput: -99, blink: 0, nextBlink: 2, bubble: null, nextBubble: 30, wing: 0, hop: 0 };
    this.pointer = { x: 0, y: 0, down: false, lastMove: -99 };
    this.auroraCv = document.createElement('canvas');
    this.auroraCtx = this.auroraCv.getContext('2d');
    this._loop = this._loop.bind(this);
  }

  resize(W, H) {
    this.W = W; this.H = H;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    dpr = Math.min(dpr, Math.sqrt(2.6e6 / Math.max(1, W * H)));
    this.dpr = Math.max(0.5, dpr);
    this.cv.width = Math.round(W * this.dpr);
    this.cv.height = Math.round(H * this.dpr);
    this.auroraCv.width = Math.max(32, Math.round(W / 8));
    this.auroraCv.height = Math.max(16, Math.round(H * 0.6 / 8));
    if (this.lumi.x < 0) { this.lumi.x = W * 0.8; this.lumi.y = H * 0.3; }
    this._populate(true);
  }

  setArtRect(r) { this.rect = r; }
  setPalette(p) { if (p && p.length) this.palette = p; }
  setEffects(e) { this.effects = { ...e }; this._populate(false); }
  setInteract(i) { this.interact = { ...i }; if (!i.seeds) this.seeds.length = 0; }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._loop);
  }
  stop() { this.running = false; this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.cv.width, this.cv.height); }

  // breath value 0..1 on a 10 s cycle (6 breaths / min); first half inhale
  get breath() { return 0.5 - 0.5 * Math.cos(this.t * TAU / 10); }
  get inhaling() { return (this.t % 10) < 5; }

  _scale(n) { return Math.round(n * (this.reduced ? 0.4 : 1)); }
  _area() { return this.W * this.H; }

  _populate(force) {
    const A = this._area();
    const want = {
      bokeh: this.effects.echo ? this._scale(clamp(A / 42000, 12, 36)) : 0,
      stars: this.effects.stardust ? this._scale(clamp(A / 8000, 60, 240)) : 0,
      petals: this.effects.petals ? this._scale(clamp(A / 55000, 14, 32)) : 0,
    };
    if (force) { this.bokeh.length = 0; this.stars.length = 0; this.petals.length = 0; }
    while (this.bokeh.length < want.bokeh) this.bokeh.push(this._newBokeh(true));
    this.bokeh.length = Math.min(this.bokeh.length, want.bokeh);
    while (this.stars.length < want.stars) this.stars.push(this._newStar());
    this.stars.length = Math.min(this.stars.length, want.stars);
    while (this.petals.length < want.petals) this.petals.push(this._newPetal(true));
    this.petals.length = Math.min(this.petals.length, want.petals);
  }

  _newBokeh(anywhere) {
    const s = Math.sqrt(this._area()) / 1000;
    return {
      x: rand(0, this.W), y: anywhere ? rand(0, this.H) : this.H + 60,
      r: rand(18, 72) * clamp(s, 0.6, 1.8), c: pick(this.palette),
      vx: rand(-6, 6), vy: rand(-14, -4), ph: rand(0, TAU),
      age: anywhere ? rand(0, 10) : 0, life: rand(10, 18), a: rand(0.08, 0.2),
    };
  }
  _newStar() {
    return { x: rand(0, this.W), y: rand(0, this.H), r: rand(0.4, 1.5), w: rand(0.6, 2.4), ph: rand(0, TAU), a: rand(0.25, 0.9), vy: rand(-3, -0.5), gold: Math.random() < 0.3 };
  }
  _newPetal(anywhere) {
    const s = clamp(Math.sqrt(this._area()) / 1100, 0.6, 1.6);
    return {
      x: rand(-40, this.W + 40), y: anywhere ? rand(-this.H, this.H) : rand(-80, -20),
      size: rand(8, 16) * s, rot: rand(0, TAU), vr: rand(-0.8, 0.8), flip: rand(0, TAU), vf: rand(1, 2.4),
      vy: rand(16, 34) * s, sway: rand(18, 46), ph: rand(0, TAU), c: pick(this.palette),
    };
  }

  // ---- sprites ----
  _glow(c, soft = false) {
    const key = c.join(',') + (soft ? 's' : 'g');
    let s = this.sprites.get(key);
    if (s) return s;
    s = document.createElement('canvas'); s.width = s.height = 64;
    const x = s.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (soft) {
      g.addColorStop(0, rgba(c, 0.85)); g.addColorStop(0.55, rgba(c, 0.45)); g.addColorStop(0.82, rgba(c, 0.12)); g.addColorStop(1, rgba(c, 0));
    } else {
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, rgba(c, 0.9)); g.addColorStop(0.5, rgba(c, 0.25)); g.addColorStop(1, rgba(c, 0));
    }
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    if (this.sprites.size > 160) this.sprites.clear();
    this.sprites.set(key, s);
    return s;
  }
  _petalSprite(c) {
    const key = c.join(',') + 'p';
    let s = this.sprites.get(key);
    if (s) return s;
    s = document.createElement('canvas'); s.width = 48; s.height = 64;
    const x = s.getContext('2d');
    const light = c.map(v => Math.round(v + (255 - v) * 0.55));
    const g = x.createLinearGradient(24, 4, 24, 60);
    g.addColorStop(0, rgba(light, 0.95)); g.addColorStop(0.6, rgba(c, 0.6)); g.addColorStop(1, rgba(c, 0.1));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(24, 60);
    x.bezierCurveTo(2, 44, 4, 14, 20, 4);
    x.quadraticCurveTo(24, 10, 28, 4);
    x.bezierCurveTo(44, 14, 46, 44, 24, 60);
    x.fill();
    this.sprites.set(key, s);
    return s;
  }

  // ---- input ----
  pointerDown(x, y) {
    this.pointer.x = x; this.pointer.y = y; this.pointer.down = true; this.pointer.lastMove = this.t;
    this.lumi.lastInput = this.t; this.lumi.hop = 1;
    // seed hit?
    for (let i = this.seeds.length - 1; i >= 0; i--) {
      const s = this.seeds[i];
      if (Math.hypot(s.x - x, s.y - y) < s.r * 2.8 + 18) {
        this.seeds.splice(i, 1);
        this._bloom(s.x, s.y, s.c);
        return { seed: true };
      }
    }
    if (this.interact.ripple) {
      const c = pick(this.palette);
      this.ripples.push({ x, y, t0: this.t, c });
      this._burst(x, y, this._scale(16), c, 140);
    }
    return { seed: false };
  }
  pointerMove(x, y) {
    const p = this.pointer;
    const d = Math.hypot(x - p.x, y - p.y);
    p.x = x; p.y = y; p.lastMove = this.t;
    this.lumi.lastInput = this.t;
    if (this.interact.ripple && d > 6 && this.sparks.length < 900) {
      const n = Math.min(3, Math.ceil(d / 18));
      for (let i = 0; i < n; i++) this.sparks.push({ x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-20, 20), vy: rand(-30, 4), life: rand(0.6, 1.3), age: 0, c: pick(this.palette), size: rand(4, 10) });
    }
  }
  pointerUp() { this.pointer.down = false; }

  _burst(x, y, n, c, speed) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = rand(speed * 0.3, speed);
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: rand(0.9, 1.8), age: 0, c: Math.random() < 0.3 ? GOLD : c, size: rand(5, 13) });
    }
  }
  _bloom(x, y, c) {
    this.flowers.push({ x, y, t0: this.t, c, rot: rand(0, TAU), n: 8 });
    this._burst(x, y, this._scale(34), c, 220);
    this.ripples.push({ x, y, t0: this.t, c: GOLD });
  }

  say(text, dur = 4.5) { this.lumi.bubble = { text, t0: this.t, dur }; }

  // ---- transitions hooks ----
  dustFrom(img, rect) {
    if (!img || !(img.naturalWidth || img.videoWidth)) return;
    const maxP = this.reduced ? 1800 : 6500;
    let step = Math.max(5, Math.sqrt((rect.w * rect.h) / maxP));
    const cols = Math.floor(rect.w / step), rows = Math.floor(rect.h / step);
    const c = document.createElement('canvas'); c.width = cols; c.height = rows;
    const x = c.getContext('2d', { willReadFrequently: true });
    let data;
    try { x.drawImage(img, 0, 0, cols, rows); data = x.getImageData(0, 0, cols, rows).data; } catch { return; }
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    this.dust.length = 0;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = (j * cols + i) * 4;
      if (data[k + 3] < 40) continue;
      const px = rect.x + i * step + step / 2, py = rect.y + j * step + step / 2;
      const dx = px - cx, dy = py - cy, dist = Math.hypot(dx, dy) || 1;
      const sp = rand(20, 90);
      this.dust.push({
        x: px, y: py, vx: dx / dist * sp + rand(-15, 15), vy: dy / dist * sp * 0.6 - rand(20, 70),
        c: `rgb(${data[k]},${data[k + 1]},${data[k + 2]})`, s: step * rand(0.7, 1.05), age: 0,
        life: rand(1.4, 2.6), delay: (1 - (py - rect.y) / rect.h) * 0.35 + Math.random() * 0.25, ph: rand(0, TAU),
      });
    }
  }

  // ---- main loop ----
  _loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now; this.t += dt;
    try { this._update(dt); this._draw(); } catch (e) { console.error(e); }
    if (this.onFrame) this.onFrame(dt, this.t);
    requestAnimationFrame(this._loop);
  }

  _update(dt) {
    const W = this.W, H = this.H, t = this.t;
    for (let i = 0; i < this.bokeh.length; i++) {
      const b = this.bokeh[i];
      b.age += dt;
      b.x += (b.vx + Math.sin(t * 0.3 + b.ph) * 8) * dt * this.tempo; b.y += b.vy * dt * this.tempo;
      if (b.age > b.life || b.y < -b.r * 2) this.bokeh[i] = this._newBokeh(b.y < -b.r * 2 ? false : true), this.bokeh[i].age = 0;
    }
    for (const s of this.stars) { s.y += s.vy * dt; if (s.y < -4) { s.y = H + 4; s.x = rand(0, W); } }
    if (this.effects.stardust && !this.shooting && Math.random() < dt / 14) {
      const fromLeft = Math.random() < 0.5;
      this.shooting = { x: fromLeft ? rand(0, W * 0.4) : rand(W * 0.6, W), y: rand(0, H * 0.35), vx: (fromLeft ? 1 : -1) * rand(500, 800), vy: rand(160, 260), age: 0, life: 1.1 };
    }
    if (this.shooting) { const s = this.shooting; s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.age > s.life) this.shooting = null; }
    for (let i = 0; i < this.petals.length; i++) {
      const p = this.petals[i];
      p.y += p.vy * dt; p.rot += p.vr * dt; p.flip += p.vf * dt;
      p.x += Math.sin(t * 0.7 + p.ph) * p.sway * dt;
      if (p.y > H + 60) this.petals[i] = this._newPetal(false);
    }
    // interaction
    this.ripples = this.ripples.filter(r => t - r.t0 < 2);
    for (const s of this.sparks) { s.age += dt; s.vx *= 0.96; s.vy = s.vy * 0.96 - 18 * dt; s.x += s.vx * dt; s.y += s.vy * dt; }
    this.sparks = this.sparks.filter(s => s.age < s.life);
    this.flowers = this.flowers.filter(f => t - f.t0 < 2.6);
    // seeds
    if (this.interact.seeds) {
      this.nextSeed -= dt;
      if (this.nextSeed <= 0 && this.seeds.length < 3) {
        const s = clamp(Math.sqrt(this._area()) / 1100, 0.7, 1.5);
        this.seeds.push({ x: rand(W * 0.08, W * 0.92), y: H + 20, r: rand(6, 9) * s, vy: rand(-26, -16) * s, ph: rand(0, TAU), c: pick(this.palette), age: 0 });
        this.nextSeed = rand(6, 11);
      }
      for (const s of this.seeds) { s.age += dt; s.y += s.vy * dt; s.x += Math.sin(t * 0.9 + s.ph) * 14 * dt; }
      this.seeds = this.seeds.filter(s => s.y > -40);
    }
    // dust
    if (this.dust.length) {
      let alive = 0;
      for (const d of this.dust) {
        d.age += dt;
        if (d.age < d.delay) { alive++; continue; }
        const a = d.age - d.delay;
        d.vx += Math.sin(d.y * 0.012 + t * 1.3 + d.ph) * 40 * dt;
        d.vy -= 26 * dt;
        d.x += d.vx * dt; d.y += d.vy * dt;
        if (a < d.life) alive++;
      }
      if (!alive) this.dust.length = 0;
    }
    // lumi
    if (this.interact.lumi) this._updateLumi(dt);
  }

  _updateLumi(dt) {
    const L = this.lumi, t = this.t, r = this.rect;
    let tx, ty;
    if (t - L.lastInput < 4) { tx = this.pointer.x + 34; ty = this.pointer.y - 30; }
    else {
      const cx = this.W / 2, cy = this.H / 2;
      const ax = Math.max(r.w / 2 + 40, this.W * 0.3), ay = Math.max(r.h / 2 * 0.7, this.H * 0.22);
      tx = cx + Math.cos(t * 0.11) * ax * 0.9; ty = cy + Math.sin(t * 0.17) * ay * 0.8;
    }
    tx = clamp(tx, 24, this.W - 24); ty = clamp(ty, 30, this.H - 30);
    const k = t - L.lastInput < 4 ? 5 : 1.1;
    L.vx += ((tx - L.x) * k - L.vx * 2.2) * dt;
    L.vy += ((ty - L.y) * k - L.vy * 2.2) * dt;
    L.x += L.vx * dt; L.y += L.vy * dt;
    L.wing += dt * (8 + Math.min(10, Math.hypot(L.vx, L.vy) / 30));
    L.hop = Math.max(0, L.hop - dt * 2.5);
    L.nextBlink -= dt;
    if (L.nextBlink <= 0) { L.blink = 0.18; L.nextBlink = rand(2.5, 5.5); }
    L.blink = Math.max(0, L.blink - dt);
    if (this.trail.length < 400 && Math.random() < 0.5) this.trail.push({ x: L.x + rand(-3, 3), y: L.y + rand(-3, 3), age: 0, life: rand(0.6, 1.2) });
    for (const p of this.trail) { p.age += dt; p.y += 8 * dt; }
    this.trail = this.trail.filter(p => p.age < p.life);
  }

  _draw() {
    const ctx = this.ctx, W = this.W, H = this.H, t = this.t, e = this.effects;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    if (e.aurora) this._drawAurora();
    if (e.breath) this._drawBreathVeil();
    if (e.lasers) this._drawLasers();

    // color echo bokeh
    for (const b of this.bokeh) {
      const fade = Math.min(1, b.age / 2.5, (b.life - b.age) / 2.5);
      if (fade <= 0) continue;
      ctx.globalAlpha = b.a * fade * (0.75 + 0.25 * Math.sin(t * 0.8 + b.ph));
      const s = this._glow(b.c, true);
      ctx.drawImage(s, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
    // stars
    if (this.stars.length) {
      for (const s of this.stars) {
        const a = s.a * (0.45 + 0.55 * Math.sin(t * s.w + s.ph));
        if (a <= 0.02) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = s.gold ? '#f2dfae' : '#ffffff';
        ctx.fillRect(s.x - s.r / 2, s.y - s.r / 2, s.r, s.r);
        if (s.r > 1.2) { ctx.globalAlpha = a * 0.5; const g = this._glow(s.gold ? GOLD : [220, 230, 255]); ctx.drawImage(g, s.x - 6, s.y - 6, 12, 12); }
      }
      if (this.shooting) {
        const s = this.shooting, f = 1 - s.age / s.life;
        const gr = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 0.18, s.y - s.vy * 0.18);
        gr.addColorStop(0, `rgba(255,248,230,${0.9 * f})`); gr.addColorStop(1, 'rgba(255,248,230,0)');
        ctx.globalAlpha = 1; ctx.strokeStyle = gr; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.18, s.y - s.vy * 0.18); ctx.stroke();
      }
    }
    // petals (normal blending looks more like soft petals)
    if (this.petals.length) {
      ctx.globalCompositeOperation = 'source-over';
      for (const p of this.petals) {
        const sp = this._petalSprite(p.c);
        const sx = Math.cos(p.flip);
        ctx.globalAlpha = 0.55;
        ctx.setTransform(this.dpr * Math.cos(p.rot) * sx, this.dpr * Math.sin(p.rot) * sx, -this.dpr * Math.sin(p.rot), this.dpr * Math.cos(p.rot), p.x * this.dpr, p.y * this.dpr);
        ctx.drawImage(sp, -p.size * 0.75 / 2, -p.size / 2, p.size * 0.75, p.size);
      }
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
    }
    if (e.breath) this._drawInfinity();

    // stardust transition
    if (this.dust.length) {
      ctx.globalCompositeOperation = 'source-over';
      for (const d of this.dust) {
        if (d.age < d.delay) continue;
        const a = 1 - (d.age - d.delay) / d.life;
        if (a <= 0) continue;
        const sz = d.s * (0.22 + 0.5 * a);
        ctx.globalAlpha = a;
        ctx.fillStyle = d.c;
        ctx.fillRect(d.x - sz / 2, d.y - sz / 2, sz, sz);
      }
      ctx.globalCompositeOperation = 'lighter';
    }
    // transition overlays
    if (this.flash > 0.001) {
      const r = this.rect, cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = Math.max(W, H) * 0.8;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, `rgba(255,246,222,${0.85 * this.flash})`); g.addColorStop(0.45, `rgba(236,205,140,${0.35 * this.flash})`); g.addColorStop(1, 'rgba(236,205,140,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (this.rings) {
      const { centers, radii, alpha } = this.rings;
      for (let i = 0; i < centers.length; i++) {
        if (radii[i] <= 1) continue;
        for (const [lw, a] of [[10, 0.08], [3, 0.35], [1.2, 0.9]]) {
          ctx.globalAlpha = alpha * a; ctx.lineWidth = lw; ctx.strokeStyle = 'rgb(236,205,140)';
          ctx.beginPath(); ctx.arc(centers[i][0], centers[i][1], radii[i], 0, TAU); ctx.stroke();
        }
      }
    }
    // ripples
    for (const r of this.ripples) {
      const age = t - r.t0;
      for (let k = 0; k < 3; k++) {
        const a = age - k * 0.16; if (a <= 0) continue;
        const rad = 10 + a * 150 + k * 6;
        ctx.globalAlpha = Math.max(0, 0.55 * (1 - a / 1.6));
        ctx.strokeStyle = rgba(k === 0 ? GOLD : r.c, 1); ctx.lineWidth = 1.4 - k * 0.3;
        ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU); ctx.stroke();
      }
      const ga = Math.max(0, 1 - age / 0.7);
      if (ga > 0) { ctx.globalAlpha = ga * 0.8; const g = this._glow(r.c); ctx.drawImage(g, r.x - 50, r.y - 50, 100, 100); }
    }
    // flowers (light-seed bloom)
    for (const f of this.flowers) {
      const age = t - f.t0, p = Math.min(1, age / 1.1), fade = Math.max(0, 1 - age / 2.6);
      const R = 18 + 70 * (1 - Math.pow(1 - p, 3));
      ctx.globalAlpha = fade * 0.9;
      const g = this._glow(f.c);
      for (let i = 0; i < f.n; i++) {
        const a = f.rot + i / f.n * TAU + age * 0.4;
        const px = f.x + Math.cos(a) * R * 0.62, py = f.y + Math.sin(a) * R * 0.62;
        ctx.save();
        ctx.translate(px, py); ctx.rotate(a); ctx.scale(1, 0.42);
        ctx.drawImage(g, -R * 0.55, -R * 0.55, R * 1.1, R * 1.1);
        ctx.restore();
      }
      ctx.globalAlpha = fade; const gg = this._glow(GOLD); ctx.drawImage(gg, f.x - R * 0.5, f.y - R * 0.5, R, R);
    }
    // sparks
    for (const s of this.sparks) {
      const a = 1 - s.age / s.life; if (a <= 0) continue;
      ctx.globalAlpha = a;
      const g = this._glow(s.c); const sz = s.size * (0.4 + 0.6 * a);
      ctx.drawImage(g, s.x - sz, s.y - sz, sz * 2, sz * 2);
    }
    // seeds
    for (const s of this.seeds) {
      const pulse = 1 + 0.15 * Math.sin(t * 3 + s.ph);
      const fadeIn = Math.min(1, s.age / 1.2);
      ctx.globalAlpha = 0.75 * fadeIn; const g = this._glow(s.c); const R = s.r * 4.2 * pulse;
      ctx.drawImage(g, s.x - R, s.y - R, R * 2, R * 2);
      ctx.globalAlpha = fadeIn; const w = this._glow(WARM); ctx.drawImage(w, s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
      // 4-point twinkle
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(t * 0.8 + s.ph);
      ctx.globalAlpha = 0.6 * fadeIn; ctx.strokeStyle = '#fff6df'; ctx.lineWidth = 1;
      const L = s.r * 2.4 * pulse;
      ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.moveTo(0, -L); ctx.lineTo(0, L); ctx.stroke();
      ctx.restore();
    }
    if (this.interact.lumi) this._drawLumi();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  _drawAurora() {
    const a = this.auroraCtx, w = this.auroraCv.width, h = this.auroraCv.height, t = this.t;
    a.globalCompositeOperation = 'source-over';
    a.clearRect(0, 0, w, h);
    a.globalCompositeOperation = 'lighter';
    const cols = [[63, 224, 192], [124, 242, 154], [155, 124, 255], this.palette[0]];
    for (let k = 0; k < 4; k++) {
      const c = cols[k];
      const base = h * (0.22 + k * 0.1);
      const amp = h * (0.12 + 0.05 * k);
      const thick = h * (0.32 + 0.08 * Math.sin(t * 0.2 + k));
      a.beginPath();
      const pts = [];
      for (let x = 0; x <= w; x += 2) {
        const y = base + Math.sin(x / w * TAU * (0.8 + k * 0.25) + t * (0.12 + k * 0.03) + k * 1.7) * amp + Math.sin(x / w * TAU * 2.3 - t * 0.21 + k) * amp * 0.35;
        pts.push([x, y]);
      }
      a.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) a.lineTo(p[0], p[1]);
      for (let i = pts.length - 1; i >= 0; i--) a.lineTo(pts[i][0], pts[i][1] - thick);
      a.closePath();
      const g = a.createLinearGradient(0, base - amp - thick, 0, base + amp);
      g.addColorStop(0, rgba(c, 0)); g.addColorStop(0.6, rgba(c, 0.35)); g.addColorStop(0.92, rgba(c, 0.75)); g.addColorStop(1, rgba(c, 0));
      a.fillStyle = g;
      a.globalAlpha = 0.5 + 0.25 * Math.sin(t * 0.3 + k * 2);
      a.fill();
    }
    const ctx = this.ctx;
    ctx.globalAlpha = 0.55;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.auroraCv, 0, 0, this.W, this.H * 0.6);
  }

  _drawLasers() {
    const ctx = this.ctx, W = this.W, H = this.H, t = this.t * this.tempo;
    const L = Math.hypot(W, H) * 1.1;
    const origins = [[0, H], [W, H], [W * 0.5, H + 10]];
    let n = 0;
    for (let o = 0; o < origins.length; o++) {
      const [ox, oy] = origins[o];
      const beams = o === 2 ? 2 : 3;
      for (let b = 0; b < beams; b++, n++) {
        const base = o === 0 ? -Math.PI / 4 : o === 1 ? -Math.PI * 3 / 4 : -Math.PI / 2;
        const ang = base + Math.sin(t * (0.18 + b * 0.05) + n * 1.3) * (o === 2 ? 0.5 : 0.42) + (b - 1) * 0.18;
        const hue = (t * 24 + n * 47) % 360;
        const spread = 0.012;
        const ex1 = ox + Math.cos(ang - spread) * L, ey1 = oy + Math.sin(ang - spread) * L;
        const ex2 = ox + Math.cos(ang + spread) * L, ey2 = oy + Math.sin(ang + spread) * L;
        const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(ang) * L, oy + Math.sin(ang) * L);
        g.addColorStop(0, `hsla(${hue},100%,68%,0.42)`); g.addColorStop(0.5, `hsla(${hue},100%,62%,0.12)`); g.addColorStop(1, `hsla(${hue},100%,60%,0)`);
        ctx.globalAlpha = 0.5 + 0.25 * Math.sin(t * 1.7 + n);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex1, ey1); ctx.lineTo(ex2, ey2); ctx.closePath(); ctx.fill();
        const g2 = ctx.createLinearGradient(ox, oy, ox + Math.cos(ang) * L * 0.8, oy + Math.sin(ang) * L * 0.8);
        g2.addColorStop(0, `hsla(${hue},100%,88%,0.75)`); g2.addColorStop(1, `hsla(${hue},100%,80%,0)`);
        ctx.strokeStyle = g2; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.cos(ang) * L * 0.8, oy + Math.sin(ang) * L * 0.8); ctx.stroke();
      }
      ctx.globalAlpha = 0.6;
      const hz = this._glow([255, 255, 255]);
      ctx.drawImage(hz, ox - 60, oy - 60, 120, 120);
    }
  }

  _drawBreathVeil() {
    const ctx = this.ctx, W = this.W, H = this.H, b = this.breath;
    const c = this.palette[0];
    const R = Math.hypot(W, H) / 2;
    const g = ctx.createRadialGradient(W / 2, H / 2, R * (0.55 + 0.1 * b), W / 2, H / 2, R);
    g.addColorStop(0, rgba(c, 0)); g.addColorStop(1, rgba(c, 0.07 + 0.13 * b));
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  _drawInfinity() {
    const ctx = this.ctx, r = this.rect, t = this.t;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const a = Math.min(Math.max(r.w, this.W * 0.5) * 0.46, this.W * 0.44) * (0.96 + 0.04 * this.breath);
    const N = this.reduced ? 26 : 64;
    const speed = TAU / 22;
    for (let i = N - 1; i >= 0; i--) {
      const s = t * speed - i * 0.022;
      const d = 1 + Math.sin(s) ** 2;
      const x = cx + a * Math.cos(s) / d, y = cy + a * Math.sin(s) * Math.cos(s) / d * 0.9;
      const f = 1 - i / N;
      ctx.globalAlpha = 0.5 * f * f;
      const sz = (i === 0 ? 26 : 14) * (0.4 + 0.6 * f);
      const g = this._glow(i % 9 === 0 ? this.palette[1 % this.palette.length] : GOLD);
      ctx.drawImage(g, x - sz, y - sz, sz * 2, sz * 2);
    }
  }

  _drawLumi() {
    const ctx = this.ctx, L = this.lumi, t = this.t;
    for (const p of this.trail) {
      const a = 1 - p.age / p.life;
      ctx.globalAlpha = a * 0.5; const g = this._glow(WARM); ctx.drawImage(g, p.x - 3, p.y - 3, 6, 6);
    }
    const bob = Math.sin(t * 2.2) * 3 - L.hop * 10 * Math.sin(L.hop * Math.PI);
    const x = L.x, y = L.y + bob;
    ctx.globalAlpha = 0.55 + 0.15 * Math.sin(t * 1.6);
    const halo = this._glow([255, 214, 150], true); ctx.drawImage(halo, x - 40, y - 40, 80, 80);
    // wings
    ctx.globalCompositeOperation = 'source-over';
    const wf = Math.sin(L.wing) * 0.5 + 0.5;
    ctx.fillStyle = 'rgba(255,250,235,0.32)';
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(x + side * 8, y - 4); ctx.rotate(side * (0.5 + wf * 0.5));
      ctx.beginPath(); ctx.ellipse(side * 5, -2, 7, 4 + wf * 1.5, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    // body
    const body = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 11);
    body.addColorStop(0, '#fffef8'); body.addColorStop(0.6, '#ffeec7'); body.addColorStop(1, 'rgba(255,214,150,0.85)');
    ctx.globalAlpha = 1; ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(x, y, 10.5, 0, TAU); ctx.fill();
    // eyes
    const look = Math.max(-1.2, Math.min(1.2, L.vx / 80));
    const eh = L.blink > 0 ? 0.35 : 2.1;
    ctx.fillStyle = '#3b2a14';
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + side * 3.6 + look, y - 0.8, 1.35, eh, 0, 0, TAU); ctx.fill(); }
    // blush
    ctx.fillStyle = 'rgba(255,150,150,0.45)';
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + side * 6.2, y + 2.6, 2, 1.2, 0, 0, TAU); ctx.fill(); }
    // tiny smile
    ctx.strokeStyle = '#3b2a14'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(x + look, y + 2.2, 1.6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    // bubble
    if (L.bubble) {
      const age = t - L.bubble.t0;
      if (age > L.bubble.dur) L.bubble = null;
      else {
        const a = Math.min(1, age / 0.4, (L.bubble.dur - age) / 0.6);
        ctx.font = '13px "Noto Sans TC", Arial, sans-serif';
        const tw = ctx.measureText(L.bubble.text).width;
        const bw = tw + 26, bh = 30;
        let bx = x - bw / 2, by = y - 26 - bh;
        bx = clamp(bx, 10, this.W - bw - 10); if (by < 8) by = y + 24;
        ctx.globalAlpha = a * 0.92;
        ctx.fillStyle = 'rgba(16,22,18,0.82)';
        ctx.strokeStyle = 'rgba(201,165,92,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 15); else ctx.rect(bx, by, bw, bh);
        ctx.fill(); ctx.stroke();
        ctx.globalAlpha = a; ctx.fillStyle = '#f4f4ed'; ctx.textBaseline = 'middle';
        ctx.fillText(L.bubble.text, bx + 13, by + bh / 2 + 0.5);
      }
    }
    ctx.globalCompositeOperation = 'lighter';
  }
}
