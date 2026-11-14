// AE動態桌布 — 濾鏡、動態主題、動態可愛元件、粒子
export const W = 1080;
export const H = 2340;
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

// =====================================================================
// 濾鏡：底圖調色（一次運算）＋每格動態疊層
// =====================================================================
export const FILTERS = [
  { id: 'none', name: '原圖', desc: '不加濾鏡' },
  { id: 'peach', name: '蜜桃奶霜', desc: '暖粉柔光・呼吸光暈' },
  { id: 'lavender', name: '夢幻紫霧', desc: '薰衣草色調・流動霧氣' },
  { id: 'film', name: '復古底片', desc: '膠片顆粒・漏光閃爍' },
];

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

export function applyFilterPixels(src, id) {
  const out = document.createElement('canvas');
  out.width = src.width; out.height = src.height;
  const c = out.getContext('2d');
  c.drawImage(src, 0, 0);
  if (id === 'none') return out;
  const img = c.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    if (id === 'peach') {
      // 降飽和一點、提亮暗部、偏暖粉
      r = l + (r - l) * 0.92; g = l + (g - l) * 0.92; b = l + (b - l) * 0.92;
      r = 128 + (r - 128) * 0.88 + 26; g = 128 + (g - 128) * 0.88 + 12; b = 128 + (b - 128) * 0.88 + 10;
      r = r * 1.03; b = b * 0.97 + (l > 170 ? 8 : 0);
    } else if (id === 'lavender') {
      r = l + (r - l) * 0.78; g = l + (g - l) * 0.78; b = l + (b - l) * 0.78;
      r = 128 + (r - 128) * 0.92 + 14; g = 128 + (g - 128) * 0.9 + 2; b = 128 + (b - 128) * 0.92 + 30;
      if (l > 160) { r += 10; b += 6; }
    } else if (id === 'film') {
      r = l + (r - l) * 0.78; g = l + (g - l) * 0.78; b = l + (b - l) * 0.78;
      r = 128 + (r - 128) * 1.12; g = 128 + (g - 128) * 1.1; b = 128 + (b - 128) * 1.05;
      r = 22 + r * 0.9 + 8; g = 20 + g * 0.9 + 4; b = 26 + b * 0.84 - 4; // 褪色黑位＋暖綠
    }
    d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
  }
  c.putImageData(img, 0, 0);
  return out;
}

let grainTiles = null;
function makeGrain() {
  grainTiles = [];
  for (let k = 0; k < 3; k++) {
    const g = document.createElement('canvas');
    g.width = g.height = 256;
    const c = g.getContext('2d');
    const im = c.createImageData(256, 256);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = Math.random() * 255;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255;
    }
    c.putImageData(im, 0, 0);
    grainTiles.push(g);
  }
}

export function drawFilterOverlay(ctx, id, t) {
  if (id === 'peach') {
    const k = 0.5 + 0.5 * Math.sin(t * 0.9);
    let g = ctx.createRadialGradient(W * (0.3 + 0.15 * Math.sin(t * 0.3)), H * 0.12, 0, W * 0.3, H * 0.12, H * 0.6);
    g.addColorStop(0, `rgba(255,190,200,${0.22 + 0.14 * k})`);
    g.addColorStop(1, 'rgba(255,190,200,0)');
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    g = ctx.createLinearGradient(0, H, 0, H * 0.6);
    g.addColorStop(0, `rgba(255,214,170,${0.18 + 0.08 * k})`); g.addColorStop(1, 'rgba(255,214,170,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  } else if (id === 'lavender') {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const x = W * (0.5 + 0.55 * Math.sin(t * 0.13 + i * 1.7));
      const y = H * (0.5 + 0.45 * Math.cos(t * 0.11 + i * 2.3));
      const r = H * (0.28 + 0.06 * Math.sin(t * 0.4 + i));
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const col = i % 2 ? '200,170,255' : '255,180,230';
      g.addColorStop(0, `rgba(${col},0.26)`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  } else if (id === 'film') {
    if (!grainTiles) makeGrain();
    ctx.save();
    // 顆粒
    const tile = grainTiles[Math.floor(t * 24) % 3];
    const pat = ctx.createPattern(tile, 'repeat');
    ctx.globalAlpha = 0.09; ctx.globalCompositeOperation = 'overlay';
    ctx.translate(-Math.random() * 256, -Math.random() * 256);
    ctx.fillStyle = pat; ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // 漏光
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 1;
    const lx = W * (1.05 + 0.1 * Math.sin(t * 0.5)), ly = H * (0.3 + 0.25 * Math.sin(t * 0.21));
    const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, W * 0.9);
    lg.addColorStop(0, `rgba(255,120,40,${0.3 + 0.15 * Math.sin(t * 1.3)})`); lg.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    // 暗角
    ctx.globalCompositeOperation = 'source-over';
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.72);
    vg.addColorStop(0, 'rgba(20,10,0,0)'); vg.addColorStop(1, 'rgba(20,10,0,0.5)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // 閃爍＋刮痕
    const flick = Math.random();
    if (flick > 0.93) { ctx.fillStyle = 'rgba(255,245,220,0.05)'; ctx.fillRect(0, 0, W, H); }
    if (flick < 0.06) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      const sx = Math.random() * W; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + rand(-20, 20), H); ctx.stroke();
    }
    ctx.restore();
  }
}

// =====================================================================
// 動態桌面主題
// =====================================================================
export const THEMES = [
  { id: 'none', name: '無主題', desc: '只顯示元件' },
  { id: 'laser', name: '夜店雷射', desc: '彩色雷射光束・跟著音樂閃' },
  { id: 'breeze', name: '微風流動', desc: '花瓣樹葉隨風飄・風紋流動' },
  { id: 'sparkle', name: '閃閃發光', desc: '星光閃爍・亮片飄落' },
];

const themeState = {};

function initBreeze() {
  const petals = [];
  for (let i = 0; i < 46; i++) {
    petals.push({
      x: rand(0, W), y: rand(0, H), s: rand(14, 30), rot: rand(0, TAU), vr: rand(-1.5, 1.5),
      ph: rand(0, TAU), sp: rand(0.6, 1.3), leaf: Math.random() < 0.3,
      col: ['#FFC2D9', '#FFD9E8', '#FFFFFF', '#FFB3CE'][i % 4],
    });
  }
  const streaks = [];
  for (let i = 0; i < 8; i++) streaks.push(newStreak(true));
  return { petals, streaks };
}
function newStreak(randomStart) {
  return { x: rand(-W * 0.4, W * 0.6), y: rand(0, H), len: rand(W * 0.5, W * 0.9), amp: rand(20, 60), p: randomStart ? rand(0, 1) : 0, dur: rand(3, 6), w: rand(2, 4.5) };
}

function initSparkle() {
  const stars = [];
  for (let i = 0; i < 70; i++) {
    stars.push({ x: rand(0, W), y: rand(0, H), s: rand(14, 46), sp: rand(1.2, 3.2), ph: rand(0, TAU), col: ['255,255,255', '255,230,150', '255,190,225', '190,225,255'][i % 4] });
  }
  const glitter = [];
  for (let i = 0; i < 60; i++) glitter.push({ x: rand(0, W), y: rand(0, H), r: rand(2, 5), vy: rand(30, 90), ph: rand(0, TAU) });
  return { stars, glitter };
}

function initLaser() {
  const dots = [];
  for (let i = 0; i < 36; i++) dots.push({ a: rand(0, TAU), r: rand(0.15, 1), s: rand(10, 26), h: rand(0, 360) });
  return { dots };
}

export function drawTheme(ctx, id, t, dt, k, energy) {
  if (id === 'none' || !id || k <= 0) return;
  if (!themeState[id]) themeState[id] = id === 'laser' ? initLaser() : id === 'breeze' ? initBreeze() : initSparkle();
  const st = themeState[id];
  if (id === 'laser') drawLaser(ctx, st, t, k, energy);
  else if (id === 'breeze') drawBreeze(ctx, st, t, dt, k, energy);
  else if (id === 'sparkle') drawSparkle(ctx, st, t, dt, k, energy);
}

function drawLaser(ctx, st, t, k, e) {
  const beat = e.playing ? e.beat : Math.max(0, 1 - ((t * 2) % 1) * 3.5); // 沒音樂時 120BPM
  const boost = e.playing ? 0.6 + e.level * 1.4 : 1;
  ctx.save();
  ctx.fillStyle = `rgba(12,0,30,${0.42 * k})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  // 舞台霧
  for (let i = 0; i < 3; i++) {
    const x = W * (0.5 + 0.4 * Math.sin(t * 0.2 + i * 2)), y = H * (0.75 + 0.15 * Math.cos(t * 0.17 + i));
    const g = ctx.createRadialGradient(x, y, 0, x, y, W * 0.8);
    g.addColorStop(0, `hsla(${(t * 30 + i * 120) % 360},90%,60%,${0.1 * k})`); g.addColorStop(1, 'hsla(0,0%,0%,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // 雷射光束
  const emitters = [[W * 0.06, H * 0.99, -Math.PI / 2 + 0.55], [W * 0.94, H * 0.99, -Math.PI / 2 - 0.55], [W * 0.5, H * 0.01, Math.PI / 2]];
  ctx.lineCap = 'round';
  emitters.forEach(([ex, ey, base], ei) => {
    for (let i = 0; i < 6; i++) {
      const ang = base + (i - 2.5) * 0.16 + Math.sin(t * (0.6 + ei * 0.25) + i * 0.8) * 0.5;
      const hue = (t * 50 + ei * 120 + i * 22) % 360;
      const a = Math.min(1, (0.45 + 0.35 * Math.sin(t * 5 + i * 1.3 + ei)) * k * boost);
      const x2 = ex + Math.cos(ang) * H * 1.4, y2 = ey + Math.sin(ang) * H * 1.4;
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(x2, y2);
      ctx.strokeStyle = `hsla(${hue},100%,55%,${a * 0.18})`; ctx.lineWidth = 26; ctx.stroke();
      ctx.strokeStyle = `hsla(${hue},100%,62%,${a * 0.75})`; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.55})`; ctx.lineWidth = 1.5; ctx.stroke();
    }
    const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 120);
    g.addColorStop(0, `rgba(255,255,255,${0.8 * k})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(ex - 120, ey - 120, 240, 240);
  });
  // 鏡球光點
  st.dots.forEach((d) => {
    const a = d.a + t * 0.35;
    const x = W / 2 + Math.cos(a) * W * 0.7 * d.r, y = H * 0.42 + Math.sin(a * 1.3) * H * 0.35 * d.r;
    const g = ctx.createRadialGradient(x, y, 0, x, y, d.s * (1 + beat * 0.6));
    g.addColorStop(0, `hsla(${(d.h + t * 40) % 360},100%,80%,${0.7 * k})`); g.addColorStop(1, 'hsla(0,0%,0%,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 60, y - 60, 120, 120);
  });
  // 節拍閃光
  if (beat > 0.05) {
    ctx.fillStyle = `hsla(${(t * 90) % 360},100%,65%,${beat * 0.13 * k})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

function petalPath(ctx, s, leaf) {
  ctx.beginPath();
  if (leaf) {
    ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * 0.7, s, 0); ctx.quadraticCurveTo(0, s * 0.7, -s, 0);
  } else {
    ctx.moveTo(0, -s * 0.55);
    ctx.bezierCurveTo(s * 0.9, -s * 0.9, s * 0.9, s * 0.6, 0, s * 0.6);
    ctx.bezierCurveTo(-s * 0.9, s * 0.6, -s * 0.9, -s * 0.9, 0, -s * 0.55);
  }
}

function drawBreeze(ctx, st, t, dt, k, e) {
  const wind = 1 + (e.playing ? e.level * 1.5 : 0);
  ctx.save();
  // 柔和陽光
  const sg = ctx.createRadialGradient(W * 0.15, H * 0.05, 0, W * 0.15, H * 0.05, H * 0.55);
  sg.addColorStop(0, `rgba(255,250,215,${(0.32 + 0.1 * Math.sin(t * 0.8)) * k})`); sg.addColorStop(1, 'rgba(255,250,215,0)');
  ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
  // 風紋
  ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round';
  st.streaks.forEach((s, i) => {
    s.p += (dt / s.dur) * wind;
    if (s.p > 1.3) st.streaks[i] = s = newStreak(false);
    const seg = 24;
    for (let j = 0; j < seg; j++) {
      const u0 = s.p - 0.3 + (j / seg) * 0.3, u1 = u0 + 0.3 / seg;
      if (u1 < 0 || u0 > 1) continue;
      const fade = Math.sin(Math.PI * Math.min(1, Math.max(0, u0))) * (j / seg);
      const p0 = streakPt(s, u0, t), p1 = streakPt(s, u1, t);
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * fade * k})`; ctx.lineWidth = s.w;
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    }
  });
  // 花瓣
  ctx.globalAlpha = Math.min(1, k * 1.1);
  st.petals.forEach((p) => {
    p.x += (55 + 30 * Math.sin(t * 0.7 + p.ph)) * p.sp * dt * wind;
    p.y += (38 + 22 * Math.sin(t * 1.3 + p.ph)) * p.sp * dt;
    p.rot += p.vr * dt * wind;
    if (p.x > W + 40) p.x = -40;
    if (p.y > H + 40) { p.y = -40; p.x = rand(-W * 0.2, W); }
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(t * 2 + p.ph)));
    petalPath(ctx, p.s, p.leaf);
    ctx.fillStyle = p.leaf ? '#A8E6A1' : p.col; ctx.fill();
    ctx.strokeStyle = p.leaf ? 'rgba(80,160,90,.5)' : 'rgba(255,140,180,.45)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  });
  ctx.restore();
}
function streakPt(s, u, t) {
  return [s.x + u * s.len, s.y + Math.sin(u * 5 + t * 0.6) * s.amp - u * 60];
}

export function starPath(ctx, r, thin = 0.18) {
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    const na = a + Math.PI / 2;
    if (i === 0) ctx.moveTo(x, y);
    ctx.quadraticCurveTo(Math.cos(a + Math.PI / 4) * r * thin, Math.sin(a + Math.PI / 4) * r * thin, Math.cos(na) * r, Math.sin(na) * r);
  }
  ctx.closePath();
}

function drawSparkle(ctx, st, t, dt, k, e) {
  const boost = e.playing ? 0.8 + e.level * 1.6 + e.beat * 0.6 : 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  st.glitter.forEach((g) => {
    g.y += g.vy * dt; if (g.y > H + 10) { g.y = -10; g.x = rand(0, W); }
    const a = (0.4 + 0.6 * Math.abs(Math.sin(t * 4 + g.ph))) * k;
    ctx.fillStyle = `rgba(255,240,200,${a * 0.8})`;
    ctx.beginPath(); ctx.arc(g.x + Math.sin(t + g.ph) * 10, g.y, g.r, 0, TAU); ctx.fill();
  });
  st.stars.forEach((s) => {
    const b = Math.sin(t * s.sp + s.ph);
    if (b <= 0) return;
    const r = s.s * b * b * boost;
    const a = Math.min(1, b * k * 1.2);
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 1.6);
    g.addColorStop(0, `rgba(${s.col},${0.55 * a})`); g.addColorStop(1, `rgba(${s.col},0)`);
    ctx.fillStyle = g; ctx.fillRect(s.x - r * 1.6, s.y - r * 1.6, r * 3.2, r * 3.2);
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(t * 0.3 + s.ph);
    starPath(ctx, r); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill();
    ctx.restore();
  });
  // 斜向光澤掃過
  const cyc = (t % 6) / 6;
  if (cyc < 0.45) {
    const p = cyc / 0.45;
    const x = -W * 0.6 + p * W * 2.2;
    ctx.save(); ctx.translate(x, H / 2); ctx.rotate(-0.45);
    const lg = ctx.createLinearGradient(-160, 0, 160, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, `rgba(255,255,255,${0.22 * k})`); lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg; ctx.fillRect(-160, -H, 320, H * 2);
    ctx.restore();
  }
  ctx.restore();
}

// =====================================================================
// 粒子（元件互動與觸碰特效）
// =====================================================================
export const particles = [];
export function burst(x, y, kind, n = 10, spread = 1) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(120, 380) * spread;
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'bubble' ? 120 : 60),
      life: 0, max: rand(0.7, 1.4), s: rand(14, 30), kind, rot: rand(0, TAU),
      hue: kind === 'heart' ? rand(330, 360) : rand(0, 360),
    });
  }
}
export function emit(x, y, kind, opts = {}) {
  particles.push({
    x, y, vx: opts.vx ?? rand(-30, 30), vy: opts.vy ?? rand(-160, -90), life: 0, max: opts.max ?? rand(1.6, 2.6),
    s: opts.s ?? rand(12, 24), kind, rot: rand(0, TAU), hue: rand(330, 360), wob: rand(0, TAU),
  });
}

export function heartPath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.35);
  ctx.bezierCurveTo(-s * 1.1, -s * 0.35, -s * 0.55, -s * 1.05, 0, -s * 0.5);
  ctx.bezierCurveTo(s * 0.55, -s * 1.05, s * 1.1, -s * 0.35, 0, s * 0.35);
  ctx.closePath();
}

export function drawParticles(ctx, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.max) { particles.splice(i, 1); continue; }
    const u = p.life / p.max;
    if (p.kind === 'bubble') { p.vx *= 0.97; p.vy = p.vy * 0.98 - 6 * dt * 60 * 0.1; p.x += Math.sin(p.life * 6 + (p.wob || 0)) * 0.8; }
    else { p.vx *= 0.96; p.vy = p.vy * 0.96 + 260 * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const a = 1 - u * u;
    ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = a;
    if (p.kind === 'heart') {
      ctx.rotate(Math.sin(p.life * 5) * 0.3);
      heartPath(ctx, p.s); ctx.fillStyle = `hsl(${p.hue},95%,72%)`; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    } else if (p.kind === 'bubble') {
      ctx.beginPath(); ctx.arc(0, 0, p.s, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(-p.s * 0.35, -p.s * 0.35, p.s * 0.22, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
    } else {
      ctx.rotate(p.rot + p.life * 3);
      starPath(ctx, p.s * (1 - u * 0.5)); ctx.fillStyle = `hsl(${p.hue},100%,85%)`; ctx.fill();
    }
    ctx.restore();
  }
}

// =====================================================================
// 動態可愛元件（三款）
// =====================================================================
export const COMPONENTS = [
  { id: 'cloud', name: '雲朵寶寶', desc: '飄呀飄・會眨眼', sound: 'pop', burst: 'heart' },
  { id: 'star', name: '跳跳星', desc: '彈跳＋灑星光', sound: 'bell', burst: 'spark' },
  { id: 'heart', name: '果凍愛心', desc: '噗通心跳・冒泡泡', sound: 'chirp', burst: 'bubble' },
];
export const COMP_RADIUS = 110;

function face(ctx, t, seed, y = 0, scale = 1, eye = '#3B2A3F') {
  const blink = ((t + seed * 1.7) % 3.8) < 0.13;
  ctx.save(); ctx.translate(0, y); ctx.scale(scale, scale);
  // 腮紅
  ctx.fillStyle = 'rgba(255,120,160,.55)';
  ctx.beginPath(); ctx.ellipse(-36, 14, 13, 8, 0, 0, TAU); ctx.ellipse(36, 14, 13, 8, 0, 0, TAU); ctx.fill();
  // 眼睛
  ctx.fillStyle = eye;
  [-22, 22].forEach((ex) => {
    ctx.beginPath();
    if (blink) { ctx.ellipse(ex, 0, 8, 2.2, 0, 0, TAU); ctx.fill(); }
    else {
      ctx.ellipse(ex, 0, 7.5, 10, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 2.5, -3.5, 3, 0, TAU); ctx.fill(); ctx.fillStyle = eye;
    }
  });
  // 嘴巴 ω
  ctx.strokeStyle = eye; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-6, 12, 6, 0.1, Math.PI - 0.1); ctx.arc(6, 12, 6, 0.1, Math.PI - 0.1); ctx.stroke();
  ctx.restore();
}

export function drawComponent(ctx, o, t, live = true) {
  const tap = o.tapT != null ? Math.exp(-(t - o.tapT) * 4.5) : 0;
  ctx.save();
  ctx.translate(o.x, o.y); ctx.rotate(o.rot || 0); ctx.scale(o.scale, o.scale);
  if (o.kind === 'cloud') drawCloud(ctx, o, t, tap, live);
  else if (o.kind === 'star') drawStar(ctx, o, t, tap, live);
  else drawJelly(ctx, o, t, tap, live);
  ctx.restore();
}

function drawCloud(ctx, o, t, tap, live) {
  const bob = Math.sin(t * 1.6 + o.seed) * 14;
  const sq = 1 + tap * 0.22 * Math.sin((t - (o.tapT || 0)) * 22);
  ctx.translate(0, bob - tap * 30);
  ctx.scale(sq, 2 - sq);
  const blobs = [[-62, 14, 42], [-22, -22, 54], [32, -16, 50], [70, 16, 38], [0, 26, 52], [-40, 32, 36], [42, 32, 38]];
  // 影子
  ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#5a6b9a';
  ctx.beginPath(); ctx.ellipse(0, 112 - bob, 80 - bob * 0.8, 12, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#BFD8F5';
  ctx.beginPath(); blobs.forEach(([x, y, r]) => { ctx.moveTo(x + r + 6, y); ctx.arc(x, y, r + 6, 0, TAU); }); ctx.fill();
  const g = ctx.createLinearGradient(0, -80, 0, 80);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#EAF3FF');
  ctx.fillStyle = g;
  ctx.beginPath(); blobs.forEach(([x, y, r]) => { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }); ctx.fill();
  face(ctx, t, o.seed, 10);
  if (live && Math.random() < 0.012) emitWorld(o, 0, -70, 'heart');
}

function roundedStar(ctx, R, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

function drawStar(ctx, o, t, tap, live) {
  const p = (t * 0.75 + o.seed) % 1;
  const hop = Math.sin(p * Math.PI);
  const land = p < 0.12 ? 1 - p / 0.12 : p > 0.92 ? (p - 0.92) / 0.08 : 0;
  const sx = 1 + land * 0.14, sy = 1 - land * 0.16;
  // 影子
  ctx.save(); ctx.globalAlpha = 0.16 * (1 - hop * 0.5); ctx.fillStyle = '#7a5a20';
  ctx.beginPath(); ctx.ellipse(0, 100, 70 - hop * 20, 10, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.translate(0, -hop * 46 + land * 8 - tap * 40);
  ctx.rotate(Math.sin(t * 2.2 + o.seed) * 0.12 + tap * TAU * (1 - tap) * 0.6);
  ctx.scale(sx, sy);
  ctx.lineJoin = 'round';
  roundedStar(ctx, 96, 44);
  ctx.lineWidth = 30; ctx.strokeStyle = '#F5A623'; ctx.stroke();
  const g = ctx.createLinearGradient(0, -90, 0, 80);
  g.addColorStop(0, '#FFF2A0'); g.addColorStop(1, '#FFC93C');
  ctx.lineWidth = 20; ctx.strokeStyle = g; ctx.stroke();
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.beginPath(); ctx.ellipse(-30, -40, 12, 7, -0.6, 0, TAU); ctx.fill();
  face(ctx, t, o.seed, 8, 0.85, '#5A3A12');
  if (live && land > 0.95 && Math.random() < 0.5) emitWorld(o, rand(-60, 60), 80, 'spark', { vy: rand(-140, -60), s: rand(10, 18), max: 0.8 });
}

function drawJelly(ctx, o, t, tap, live) {
  const ph = (t * 1.1 + o.seed) % 1;
  const beat = Math.max(0, Math.sin(ph * TAU * 2)) * (ph < 0.5 ? 1 : 0);
  const s = 1 + beat * 0.08 + tap * 0.25;
  const wob = Math.sin(t * 7) * 0.03 * (1 + tap * 3);
  ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = '#a03060';
  ctx.beginPath(); ctx.ellipse(0, 70, 70, 10, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.translate(0, 30 + Math.sin(t * 1.4 + o.seed) * 6);
  ctx.scale(s + wob, s - wob);
  heartPath(ctx, 120);
  ctx.lineWidth = 10; ctx.strokeStyle = '#F0559A'; ctx.stroke();
  const g = ctx.createRadialGradient(-30, -50, 10, 0, 0, 140);
  g.addColorStop(0, '#FFC4DA'); g.addColorStop(1, '#FF5E9A');
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.beginPath(); ctx.ellipse(-50, -60, 18, 10, -0.7, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(-26, -72, 5, 0, TAU); ctx.fill();
  face(ctx, t, o.seed, -10, 0.9, '#5A1830');
  if (live && Math.random() < 0.03) emitWorld(o, rand(-50, 50), -90, 'bubble', { s: rand(8, 18), vy: rand(-140, -80), max: rand(1.4, 2.2) });
}

// 從元件的本地座標噴出粒子到世界座標
function emitWorld(o, lx, ly, kind, opts) {
  const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0);
  const x = o.x + (lx * c - ly * s) * o.scale, y = o.y + (lx * s + ly * c) * o.scale;
  emit(x, y, kind, opts);
}

// 預覽小圖用
export function drawComponentIcon(canvas, kind, t = 0.4) {
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  const bg = c.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#FFF0F7'); bg.addColorStop(1, '#E8F2FF');
  c.fillStyle = bg; c.fillRect(0, 0, canvas.width, canvas.height);
  drawComponent(c, { kind, x: canvas.width / 2, y: canvas.height / 2 + 4, scale: canvas.width / 290, rot: 0, seed: 0.3 }, t, false);
}

// 沒有匯入照片時的預設底圖
export function defaultBackground() {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#FFD6E8'); g.addColorStop(0.45, '#E9D9FF'); g.addColorStop(1, '#C9E6FF');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.globalAlpha = 0.5;
  for (let i = 0; i < 14; i++) {
    const x = (i * 397) % W, y = ((i * 733) % H);
    const r = 120 + (i * 37) % 160;
    const rg = c.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, '#FFFFFF'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = rg; c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  c.globalAlpha = 1;
  return cv;
}
