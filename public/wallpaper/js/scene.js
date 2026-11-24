// AE動態桌布 — 場景：底圖＋物件＋濾鏡＋主題，及繪製
import {
  W, H, applyFilterPixels, drawFilterOverlay, drawTheme, drawComponent, drawParticles, COMP_RADIUS,
} from './effects.js';
import { music } from './sound.js';

export const FONT = '"Zen Maru Gothic", "PingFang TC", "Noto Sans TC", sans-serif';
export const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export const images = new Map(); // id -> HTMLImageElement（匯入的可愛圖片）

// 文字字型：圓體（可愛）、明體（與官網標題相同）、黑體（與官網內文相同）
export const TEXT_FONTS = {
  round: (px) => `900 ${px}px "Zen Maru Gothic", "PingFang TC", sans-serif`,
  serif: (px) => `600 ${px}px "Cormorant Garamond", "Noto Serif TC", "Songti TC", serif`,
  sans: (px) => `700 ${px}px Arial, "PingFang TC", "Noto Sans TC", sans-serif`,
};
export const textFont = (o) => (TEXT_FONTS[o.font] || TEXT_FONTS.round)(o.size || 96);

export function createScene() {
  return {
    baseRaw: null,       // 未加濾鏡的底圖 canvas
    base: null,          // 已加濾鏡的底圖 canvas
    hasPhoto: false,
    filter: 'none',
    theme: 'none',
    intensity: 0.8,
    objects: [],
  };
}

export function setBase(scene, canvas, hasPhoto) {
  scene.baseRaw = canvas;
  scene.hasPhoto = hasPhoto;
  scene.base = applyFilterPixels(canvas, scene.filter);
}
export function setFilter(scene, id) {
  scene.filter = id;
  if (scene.baseRaw) scene.base = applyFilterPixels(scene.baseRaw, id);
}

// 將圖片以「填滿」方式放入 W×H
export function coverCanvas(img) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const s = Math.max(W / iw, H / ih);
  const dw = iw * s, dh = ih * s;
  c.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  return cv;
}

// ---------------- 物件大小與點擊判定 ----------------
const measureCtx = document.createElement('canvas').getContext('2d');

export function objHalfSize(o) {
  if (o.type === 'comp') return [COMP_RADIUS, COMP_RADIUS];
  if (o.type === 'emoji') return [62, 62];
  if (o.type === 'image') {
    const img = images.get(o.imgId);
    if (!img) return [100, 100];
    const s = 360 / Math.max(img.naturalWidth, img.naturalHeight);
    return [img.naturalWidth * s / 2, img.naturalHeight * s / 2];
  }
  if (o.type === 'text') {
    measureCtx.font = textFont(o);
    const lines = o.text.split('\n');
    const w = Math.max(...lines.map((l) => measureCtx.measureText(l).width));
    return [w / 2 + 16, (lines.length * (o.size || 96) * 1.2) / 2 + 10];
  }
  return [0, 0];
}

export function hitTest(objects, x, y) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.type === 'stroke') {
      const reach = (o.size || 16) * 1.2 + 30;
      if (o.points.some(([px, py]) => Math.abs(px - x) < reach && Math.abs(py - y) < reach && Math.hypot(px - x, py - y) < reach)) return o;
      continue;
    }
    const [hw, hh] = objHalfSize(o);
    const c = Math.cos(-(o.rot || 0)), s = Math.sin(-(o.rot || 0));
    const dx = x - o.x, dy = y - o.y;
    const lx = (dx * c - dy * s) / o.scale, ly = (dx * s + dy * c) / o.scale;
    const pad = 24 / o.scale;
    if (Math.abs(lx) <= hw + pad && Math.abs(ly) <= hh + pad) return o;
  }
  return null;
}

// ---------------- 筆畫 ----------------
function tracePath(ctx, pts) {
  ctx.beginPath();
  if (pts.length === 1) { ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[0][0] + 0.1, pts[0][1]); return; }
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const l = pts[pts.length - 1];
  ctx.lineTo(l[0], l[1]);
}

function drawStroke(ctx, o, t) {
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (o.mode === 'rainbow') {
    // 彩虹光紋：沿著筆畫變換顏色，並緩緩流動
    const pts = o.points;
    const base = ctx.globalAlpha;
    for (let i = 1; i < pts.length; i++) {
      const hue = (i * 9 + t * 90) % 360;
      ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.strokeStyle = `hsl(${hue},100%,70%)`;
      ctx.globalAlpha = base * 0.25; ctx.lineWidth = o.size * 2.4; ctx.stroke();
      ctx.globalAlpha = base; ctx.lineWidth = o.size * 0.9; ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    tracePath(ctx, pts);
    ctx.strokeStyle = '#fff'; ctx.globalAlpha = base * 0.85; ctx.lineWidth = o.size * 0.25; ctx.stroke();
    ctx.restore();
    return;
  }
  tracePath(ctx, o.points);
  const a0 = ctx.globalAlpha;
  if (o.mode === 'pen') {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = o.size + 8; ctx.globalAlpha = 0.85 * a0; ctx.stroke();
    ctx.globalAlpha = a0; ctx.strokeStyle = o.color; ctx.lineWidth = o.size; ctx.stroke();
  } else {
    // 光紋：多層光暈＋流動亮點
    const pulse = 0.82 + 0.18 * Math.sin(t * 3 + o.points.length);
    ctx.strokeStyle = o.color;
    [[3.4, 0.12], [2.2, 0.2], [1.3, 0.45]].forEach(([w, a]) => {
      ctx.globalAlpha = a * pulse * a0; ctx.lineWidth = o.size * w; ctx.stroke();
    });
    ctx.globalAlpha = a0; ctx.lineWidth = o.size * 0.75; ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.9 * a0; ctx.lineWidth = o.size * 0.28; ctx.stroke();
    ctx.setLineDash([o.size * 1.2, o.size * 5]);
    ctx.lineDashOffset = -t * 260;
    ctx.globalAlpha = 0.9 * a0; ctx.lineWidth = o.size * 0.75; ctx.stroke();
  }
  ctx.restore();
}

// ---------------- 單一物件 ----------------
export function drawObject(ctx, o, t, live) {
  if (o.type === 'stroke') return drawStroke(ctx, o, t);
  if (o.type === 'comp') return drawComponent(ctx, o, t, live);
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(o.x, o.y); ctx.rotate(o.rot || 0); ctx.scale(o.scale * (o.flip ? -1 : 1), o.scale);
  if (o.tapT != null) { const k = Math.exp(-(t - o.tapT) * 5); ctx.scale(1 + k * 0.2, 1 + k * 0.2); }
  if (o.type === 'emoji') {
    ctx.font = `110px ${EMOJI_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.fillText(o.char, 0, 6);
  } else if (o.type === 'image') {
    const img = images.get(o.imgId);
    if (img) {
      const [hw, hh] = objHalfSize(o);
      ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
      ctx.drawImage(img, -hw, -hh, hw * 2, hh * 2);
    }
  } else if (o.type === 'text') {
    const size = o.size || 96;
    if (o.flip) ctx.scale(-1, 1); // 文字不鏡像
    ctx.font = textFont(o);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const lines = o.text.split('\n');
    const lh = size * 1.2;
    lines.forEach((l, i) => {
      const y = (i - (lines.length - 1) / 2) * lh;
      if (o.outline !== 'none') { ctx.lineWidth = size * 0.22; ctx.strokeStyle = o.outline || '#fff'; ctx.strokeText(l, 0, y); }
      ctx.fillStyle = o.color; ctx.fillText(l, 0, y);
    });
  }
  ctx.restore();
}

// ---------------- 整個畫面 ----------------
let lastT = 0;
export function renderScene(ctx, scene, t, opts = {}) {
  const dt = opts.dt ?? Math.min(0.05, Math.max(0, t - lastT));
  lastT = t;
  if (scene.base) ctx.drawImage(scene.base, 0, 0);
  else { ctx.fillStyle = '#FFE3F0'; ctx.fillRect(0, 0, W, H); }
  drawTheme(ctx, scene.theme, t, dt, scene.intensity, music);
  if (opts.reveal != null) drawRevealed(ctx, scene.objects, t, opts.reveal);
  else for (const o of scene.objects) drawObject(ctx, o, t, true);
  if (opts.draft) drawObject(ctx, opts.draft, t, true);
  drawParticles(ctx, dt);
  drawFilterOverlay(ctx, scene.filter, t);
  if (opts.selected) drawSelection(ctx, opts.selected);
}

// 重播手繪過程：筆畫依序一筆一筆畫出來（其他物件照常顯示）
function drawRevealed(ctx, objects, t, k) {
  const total = objects.reduce((n, o) => n + (o.type === 'stroke' ? o.points.length : 0), 0);
  let budget = Math.floor(total * Math.min(1, Math.max(0, k)));
  let tip = null;
  for (const o of objects) {
    if (o.type !== 'stroke') { drawObject(ctx, o, t, true); continue; }
    if (budget <= 0) continue;
    if (budget >= o.points.length) { budget -= o.points.length; drawObject(ctx, o, t, true); continue; }
    const pts = o.points.slice(0, Math.max(1, budget));
    budget = 0;
    drawObject(ctx, { ...o, points: pts }, t, true);
    tip = { p: pts[pts.length - 1], o };
  }
  if (tip) {
    // 筆尖的光點
    const [x, y] = tip.p, r = (tip.o.size || 16) * 1.6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.35, tip.o.mode === 'rainbow' ? `hsla(${(t * 90) % 360},100%,70%,.6)` : hexA(tip.o.color, 0.6)); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
function hexA(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return `rgba(255,255,255,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
export const hasStrokes = (sc) => sc.objects.some((o) => o.type === 'stroke');

function strokeBox(o) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of o.points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const pad = (o.size || 16) * 1.2 + 10;
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

function drawSelection(ctx, o) {
  if (o.type === 'stroke') {
    const [x0, y0, x1, y1] = strokeBox(o);
    ctx.save();
    ctx.setLineDash([18, 12]); ctx.lineWidth = 5; ctx.strokeStyle = '#FF7EB6';
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
    return;
  }
  const [hw, hh] = objHalfSize(o);
  ctx.save();
  ctx.translate(o.x, o.y); ctx.rotate(o.rot || 0);
  ctx.setLineDash([18, 12]); ctx.lineWidth = 5; ctx.strokeStyle = '#FF7EB6';
  const w = (hw + 16) * o.scale, h = (hh + 16) * o.scale;
  ctx.strokeRect(-w, -h, w * 2, h * 2);
  ctx.setLineDash([]); ctx.fillStyle = '#fff';
  [[-w, -h], [w, -h], [-w, h], [w, h]].forEach(([x, y]) => {
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });
  ctx.restore();
}

// ---------------- 序列化（存檔／收藏） ----------------
export async function canvasToBlob(cv, type = 'image/jpeg', q = 0.92) {
  return new Promise((r) => cv.toBlob(r, type, q));
}

export function serializeObjects(objects) {
  return objects.map((o) => {
    const c = { ...o };
    delete c.tapT;
    return c;
  });
}

export async function serializeScene(scene) {
  const imgs = {};
  for (const o of scene.objects) {
    if (o.type === 'image' && images.has(o.imgId) && !imgs[o.imgId]) imgs[o.imgId] = images.get(o.imgId).src;
  }
  return {
    base: scene.hasPhoto && scene.baseRaw ? await canvasToBlob(scene.baseRaw) : null,
    filter: scene.filter, theme: scene.theme, intensity: scene.intensity,
    objects: serializeObjects(scene.objects), imgs,
  };
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function deserializeScene(data, fallbackBase) {
  const scene = createScene();
  scene.filter = data.filter || 'none';
  scene.theme = data.theme || 'none';
  scene.intensity = data.intensity ?? 0.8;
  for (const [id, src] of Object.entries(data.imgs || {})) {
    if (!images.has(id)) { try { images.set(id, await loadImage(src)); } catch (e) { /* skip */ } }
  }
  scene.objects = (data.objects || []).filter((o) => o.type !== 'image' || images.has(o.imgId));
  if (data.base) {
    const url = URL.createObjectURL(data.base);
    try { setBase(scene, coverCanvas(await loadImage(url)), true); } finally { URL.revokeObjectURL(url); }
  } else setBase(scene, fallbackBase, false);
  return scene;
}
