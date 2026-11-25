// AE Shinity — clip recorder (R6): renders a short film of the show onto one canvas and records it.
// Everything a viewer sees is composed here (works, signature transitions, light effects, title card,
// captions, watermark), so the result looks the same on every device and in every aspect ratio.
import { FX } from './fx.js';

export const FORMATS = {
  story: { w: 1080, h: 1920 },     // IG / FB Stories & Reels 9:16
  wide: { w: 1920, h: 1080 },      // 16:9
  square: { w: 1080, h: 1080 },    // 1:1 feed
  wallpaper: { w: 1080, h: 1920 }, // phone live wallpaper: one work, full bleed, no text
};

export function pickMime() {
  // H.264 + AAC first (what Instagram / Facebook expect; iPhone Safari and recent Chrome provide it)
  const c = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs="avc1.42E01E, mp4a.40.2"', 'video/mp4;codecs=avc1.4D401F,mp4a.40.2', 'video/mp4;codecs=avc3.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  if (!window.MediaRecorder) return '';
  for (const t of c) { try { if (MediaRecorder.isTypeSupported(t)) return t; } catch { /* ignore */ } }
  return '';
}
export const canRecord = () => !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream && pickMime());

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const ease = (p) => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const easeOutBack = (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const dimsOf = (el) => el.tagName === 'VIDEO' ? [el.videoWidth, el.videoHeight] : [el.naturalWidth, el.naturalHeight];

function fit(nw, nh, W, H, pad, cover) {
  const s = cover ? Math.max(W / nw, H / nh) : Math.min((W - pad * 2) / nw, (H - pad * 2) / nh);
  const w = nw * s, h = nh * s;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}
function ambientOf(el, W, H) {
  // two-pass downsample → upsample gives a soft, grain-free blur (ctx.filter is not available everywhere)
  const tiny = document.createElement('canvas'); tiny.width = Math.max(12, Math.round(W / 28)); tiny.height = Math.max(12, Math.round(H / 28));
  const [nw, nh] = dimsOf(el); const r = fit(nw, nh, tiny.width, tiny.height, 0, true);
  const tx = tiny.getContext('2d'); tx.imageSmoothingQuality = 'high'; tx.drawImage(el, r.x, r.y, r.w, r.h);
  const c = document.createElement('canvas'); c.width = Math.max(24, Math.round(W / 5)); c.height = Math.max(24, Math.round(H / 5));
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(tiny, 0, 0, c.width, c.height);
  return c;
}

/**
 * @param {object} o
 *  works: [{ el, title, meta, points:[{u,v,c}], palette }]  (el = a loaded <img> or a playing <video>)
 *  format: 'story'|'wide'|'square'|'wallpaper', seconds, watermark, captions, scale (0.5–1)
 *  effects, tempo, transitions: ['innerbloom','dissolve',...], logo (<img>), motto, showTitle, sublabel
 *  audioStream (MediaStream|null), signal (AbortSignal), onProgress(t, total)
 * @returns {Promise<{blob: Blob, mime: string, ext: string, width: number, height: number}>}
 */
export async function recordClip(o) {
  const F = FORMATS[o.format] || FORMATS.story;
  const scale = o.scale || 1;
  const W = Math.round(F.w * scale / 2) * 2, H = Math.round(F.h * scale / 2) * 2;
  const wallpaper = o.format === 'wallpaper';
  const works = wallpaper ? o.works.slice(0, 1) : o.works;
  const total = o.seconds;
  const introDur = wallpaper ? 0 : Math.min(3.4, total * 0.22);
  const outroDur = wallpaper ? 0 : Math.min(2.2, total * 0.14);
  const body = total - introDur - outroDur;
  const segDur = body / works.length;
  const trans = Math.min(1.5, segDur * 0.38);
  const minDim = Math.min(W, H);
  const pad = wallpaper ? Math.round(minDim * 0.04) : Math.round(minDim * 0.06);

  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const tctx = tmp.getContext('2d');
  const mask = document.createElement('canvas'); mask.width = W; mask.height = H; const mctx = mask.getContext('2d');
  const fxc = document.createElement('canvas');
  const fx = new FX(fxc, { reduced: false });
  fx.density = o.density || 1;
  fx.resize(W, H);
  fx.tempo = o.tempo || 1;
  const eff = { ...(o.effects || {}) }; eff.lasers = eff.lasers && !wallpaper; eff.neon = false;
  fx.setEffects(eff);
  fx.setInteract({});
  const prepared = works.map((w) => {
    const [nw, nh] = dimsOf(w.el);
    return { ...w, rect: fit(nw, nh, W, H, pad, false), amb: ambientOf(w.el, W, H) };
  });
  try {
    await Promise.all([
      document.fonts.load(`${Math.round(minDim * 0.06)}px "Cormorant Garamond"`),
      document.fonts.load('400 40px Cinzel', 'AE UNIVERSE CREATION OUTER CALM'),
      document.fonts.load('300 40px "Noto Serif TC"', '外在沉靜內在綻放'),
    ]);
  } catch { /* fallback serif */ }

  // ---- drawing helpers ----
  function drawWork(c, w, k) {
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.imageSmoothingEnabled = true;
    c.drawImage(w.amb, 0, 0, W, H);
    c.fillStyle = 'rgba(5,8,6,0.64)'; c.fillRect(0, 0, W, H);
    const r = w.rect;
    const focus = (w.points && w.points[0]) || { u: 0.5, v: 0.5 };
    const z = 0.94 + 0.06 * ease(clamp01(k)); // grows to full size, never beyond: the whole work (incl. handwriting) stays in frame
    const fxp = r.x + focus.u * r.w, fyp = r.y + focus.v * r.h;
    if (!wallpaper) {
      c.save(); c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = minDim * 0.05; c.shadowOffsetY = minDim * 0.015;
      c.fillStyle = '#000'; c.fillRect(r.x, r.y, r.w, r.h); c.restore();
    }
    c.save(); c.beginPath(); c.rect(Math.max(0, r.x), Math.max(0, r.y), Math.min(W, r.w), Math.min(H, r.h)); c.clip();
    c.translate(fxp, fyp); c.scale(z, z); c.translate(-fxp, -fyp);
    c.drawImage(w.el, r.x, r.y, r.w, r.h);
    c.restore();
  }
  function circlesMask(circles) {
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.globalCompositeOperation = 'source-over'; mctx.clearRect(0, 0, W, H);
    mctx.globalCompositeOperation = 'lighter';
    for (const q of circles) {
      if (q.r <= 0) continue;
      const g = mctx.createRadialGradient(q.x, q.y, Math.max(0, q.r - q.f), q.x, q.y, q.r);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      mctx.fillStyle = g; mctx.beginPath(); mctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); mctx.fill();
      if (q.r - q.f > 0) { mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.arc(q.x, q.y, q.r - q.f, 0, Math.PI * 2); mctx.fill(); }
    }
  }
  const maxR = Math.hypot(W, H);
  const bubbleSeeds = Array.from({ length: 14 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, d: (i / 14) * 0.45, h: Math.random() * 360 }));
  function transitionDraw(kind, A, B, kA, kB, p) {
    drawWork(ctx, A, kA);
    drawWork(tctx, B, kB);
    fx.glowPts = null; fx.rings = null; fx.bubbleRings = null;
    if (kind === 'dissolve') { ctx.globalAlpha = ease(p); ctx.drawImage(tmp, 0, 0); ctx.globalAlpha = 1; return; }
    let circles = [];
    if (kind === 'innerbloom') {
      const pts = (B.points && B.points.length ? B.points : [{ u: 0.5, v: 0.45 }]).slice(0, 4);
      const feather = Math.max(minDim * 0.2, 120);
      circles = pts.map((q, i) => ({ x: B.rect.x + q.u * B.rect.w, y: B.rect.y + q.v * B.rect.h, r: ease(seg(p, 0.1 + i * 0.07, 0.95)) * (maxR + feather), f: feather }));
      fx.glowPts = pts.map((q, i) => { const e = Math.sin(Math.PI * seg(p, i * 0.07, 0.85)); return { x: B.rect.x + q.u * B.rect.w, y: B.rect.y + q.v * B.rect.h, r: minDim * (0.05 + 0.24 * e), a: 0.5 * e, c: q.c }; });
    } else if (kind === 'rings') {
      const cx = W / 2, cy = H / 2, off = Math.min(B.rect.w, W) * 0.26, order = [1, 0, 2];
      const centers = [[cx - off, cy], [cx, cy], [cx + off, cy]];
      const radii = centers.map((_, i) => ease(seg(p, order.indexOf(i) * 0.12, 0.76 + order.indexOf(i) * 0.12)) * (maxR + 70));
      circles = centers.map((c, i) => ({ x: c[0], y: c[1], r: radii[i], f: 70 }));
      fx.rings = { centers, radii: radii.map(v => v - 28), alpha: Math.sin(Math.PI * p) * 0.9 };
    } else { // bubbles
      const goal = maxR * 0.42;
      const rs = bubbleSeeds.map(b => { const q = seg(p, b.d, b.d + 0.5); return q <= 0 ? 0 : easeOutBack(q) * goal; });
      circles = bubbleSeeds.map((b, i) => ({ x: b.x, y: b.y, r: rs[i], f: 4 }));
      circles.push({ x: W / 2, y: H / 2, r: ease(seg(p, 0.75, 1)) * (maxR + 10), f: 4 });
      fx.bubbleRings = bubbleSeeds.map((b, i) => ({ x: b.x, y: b.y, r: rs[i], h: b.h, a: rs[i] > 0 ? 0.85 * (1 - seg(p, b.d + 0.15, b.d + 0.55)) : 0 }));
    }
    circlesMask(circles);
    tctx.globalCompositeOperation = 'destination-in'; tctx.drawImage(mask, 0, 0); tctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tmp, 0, 0);
  }
  const foil = (c, x0, x1) => { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#a8823a'); g.addColorStop(0.3, '#f3e2b0'); g.addColorStop(0.5, '#c9a55c'); g.addColorStop(0.75, '#e9d39b'); g.addColorStop(1, '#a8823a'); return g; };
  function spaced(c, text, x, y, spacing, align = 'center') {
    if ('letterSpacing' in c) { c.letterSpacing = `${spacing}px`; c.textAlign = align; c.fillText(text, x + (align === 'center' ? spacing / 2 : 0), y); c.letterSpacing = '0px'; return; }
    c.textAlign = align; c.fillText(text.split('').join(' '), x, y);
  }
  // Title card — the house motto in the AE player design: AE UNIVERSE CREATION / 外在沉靜 · 內在綻放 (gold gradient) / gold rule / OUTER CALM · INNER BLOOM
  function titleCard(alpha, reveal, closing) {
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, maxR / 2);
    g.addColorStop(0, '#16201a'); g.addColorStop(1, '#040605');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const u = minDim / 600; // CSS px → canvas px
    const zh = (o.lang || 'zh') === 'zh';
    const lines = zh ? ['外在沉靜', '內在綻放'] : ['OUTER CALM', 'INNER BLOOM'];
    const size = zh ? Math.min(W * 0.11, 50 * u) : Math.min(W * 0.075, 40 * u);
    const lineH = size * 1.28;
    const lw = 150 * u, lh = lw * (o.logo.naturalHeight / o.logo.naturalWidth || 0.5);
    const blockH = lh + 40 * u + 13 * u + 36 * u + lineH * 2 + 46 * u + 15 * u + (closing ? 0 : 50 * u);
    let y = (H - blockH) / 2;
    ctx.save(); ctx.beginPath(); ctx.rect(W / 2 - lw / 2, y - 10, lw * clamp01(reveal * 1.6), lh + 20); ctx.clip();
    ctx.drawImage(o.logo, W / 2 - lw / 2, y, lw, lh); ctx.restore();
    y += lh + 40 * u;
    const a1 = clamp01((reveal - 0.25) / 0.3), a2 = clamp01((reveal - 0.4) / 0.3), a3 = clamp01((reveal - 0.55) / 0.3), a4 = clamp01((reveal - 0.7) / 0.3);
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = alpha * a1; ctx.fillStyle = '#e0c894'; ctx.font = `400 ${Math.round(13 * u)}px Cinzel, "Cormorant Garamond", serif`;
    spaced(ctx, 'AE UNIVERSE CREATION', W / 2, y + 13 * u, 13 * u * 0.32);
    y += 13 * u + 36 * u;
    ctx.font = zh ? `300 ${Math.round(size)}px "Noto Serif TC", "Songti TC", serif` : `400 ${Math.round(size)}px Cinzel, "Cormorant Garamond", serif`;
    lines.forEach((line, k) => {
      const top = y + k * lineH, base = top + size * 1.0;
      const gr = ctx.createLinearGradient(0, top, 0, top + lineH);
      [[0, '#f3e2b6'], [0.3, '#e2c487'], [0.52, '#c9a263'], [0.7, '#b48a4e'], [0.86, '#d9bb80'], [1, '#a37c45']].forEach(([o2, c]) => gr.addColorStop(o2, c));
      ctx.globalAlpha = alpha * (k ? a3 : a2); ctx.fillStyle = gr;
      spaced(ctx, line, W / 2, base, size * (zh ? 0.2 : 0.28));
    });
    y += lineH * 2 + 28 * u;
    const rw = 72 * u * a4;
    const rg = ctx.createLinearGradient(W / 2 - rw / 2, 0, W / 2 + rw / 2, 0);
    rg.addColorStop(0, 'rgba(184,149,92,0)'); rg.addColorStop(0.3, '#b8955c'); rg.addColorStop(0.5, '#d9bd85'); rg.addColorStop(0.7, '#b8955c'); rg.addColorStop(1, 'rgba(184,149,92,0)');
    ctx.globalAlpha = alpha; ctx.fillStyle = rg; ctx.fillRect(W / 2 - rw / 2, y, rw, Math.max(1, u));
    y += 18 * u;
    ctx.globalAlpha = alpha * a4; ctx.fillStyle = '#e0c894';
    ctx.font = zh ? `400 ${Math.round(13 * u)}px Cinzel, "Cormorant Garamond", serif` : `300 ${Math.round(15 * u)}px "Noto Serif TC", "Songti TC", serif`;
    spaced(ctx, zh ? 'OUTER CALM · INNER BLOOM' : '外在沉靜 · 內在綻放', W / 2, y + 15 * u, (zh ? 13 : 15) * u * (zh ? 0.28 : 0.32));
    if (!closing && o.showTitle) {
      y += 15 * u + 40 * u;
      ctx.globalAlpha = alpha * a4; ctx.fillStyle = 'rgba(169,181,172,0.95)';
      ctx.font = `italic 400 ${Math.round(20 * u)}px "Cormorant Garamond", "Noto Serif TC", Georgia, serif`;
      ctx.textAlign = 'center'; ctx.fillText(o.showTitle, W / 2, y);
    }
    ctx.globalAlpha = 1;
  }
  function caption(w, i, a) {
    if (!o.captions || wallpaper || a <= 0) return;
    const x = W * 0.07, base = o.format === 'story' ? H * 0.84 : H * 0.88;
    ctx.globalAlpha = a;
    const sh = ctx.createLinearGradient(0, base - minDim * 0.2, 0, H); sh.addColorStop(0, 'rgba(4,6,5,0)'); sh.addColorStop(1, 'rgba(4,6,5,0.55)');
    ctx.fillStyle = sh; ctx.fillRect(0, base - minDim * 0.2, W, H - base + minDim * 0.2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(201,165,92,0.95)'; ctx.fillRect(x, base - minDim * 0.088, minDim * 0.05, Math.max(1, minDim * 0.0016));
    ctx.font = `400 ${Math.round(minDim * 0.019)}px "Noto Sans TC", Arial, sans-serif`;
    spaced(ctx, `AE UNIVERSE CREATION   ${String(i + 1).padStart(2, '0')} / ${String(works.length).padStart(2, '0')}`, x + minDim * 0.07, base - minDim * 0.08, minDim * 0.006, 'left');
    ctx.fillStyle = '#f4f4ed'; ctx.font = `400 ${Math.round(minDim * 0.058)}px "Cormorant Garamond", "Noto Serif TC", Georgia, serif`;
    ctx.fillText(w.title || '', x, base);
    if (w.sub) { const tw = ctx.measureText(w.title || '').width; ctx.fillStyle = 'rgba(224,200,148,0.9)'; ctx.font = `300 ${Math.round(minDim * 0.032)}px "Noto Serif TC", "Songti TC", serif`; ctx.fillText(w.sub, x + tw + minDim * 0.025, base); }
    if (w.meta) { ctx.fillStyle = 'rgba(169,181,172,0.95)'; ctx.font = `400 ${Math.round(minDim * 0.02)}px "Noto Sans TC", Arial, sans-serif`; spaced(ctx, w.meta.toUpperCase(), x, base + minDim * 0.045, minDim * 0.004, 'left'); }
    ctx.globalAlpha = 1;
  }
  function watermark() {
    if (!o.watermark) return;
    const lw = minDim * 0.075, lh = lw * (o.logo.naturalHeight / o.logo.naturalWidth || 0.5);
    const x = W - W * 0.06 - lw, y = (o.format === 'story' || wallpaper) ? H * 0.06 : H * 0.07;
    ctx.globalAlpha = 0.72; ctx.drawImage(o.logo, x, y, lw, lh);
    ctx.fillStyle = 'rgba(244,244,237,0.8)'; ctx.font = `italic 400 ${Math.round(minDim * 0.022)}px "Cormorant Garamond", Georgia, serif`;
    ctx.textAlign = 'right'; ctx.fillText('AE Universe Creation', x + lw, y + lh + minDim * 0.03); ctx.globalAlpha = 1;
  }

  // ---- recording ----
  const mime = pickMime();
  if (!mime) throw Object.assign(new Error('MediaRecorder unavailable'), { code: 'NO_RECORDER' });
  const vStream = cv.captureStream(30);
  const tracks = [...vStream.getVideoTracks(), ...((o.audioStream && o.audioStream.getAudioTracks()) || [])];
  const stream = new MediaStream(tracks);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(9e6 * scale * scale), audioBitsPerSecond: 160000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((res) => { rec.onstop = res; });

  // first frame before starting so the clip never opens on black
  ctx.fillStyle = '#040605'; ctx.fillRect(0, 0, W, H);
  rec.start(250);
  const t0 = performance.now();
  let last = t0, aborted = false, monitorTick = 0;
  if (o.monitor) { o.monitor.width = Math.round(240 * W / Math.max(W, H)); o.monitor.height = Math.round(240 * H / Math.max(W, H)); }
  await new Promise((resolve) => {
    const frame = (now) => {
      if (o.signal && o.signal.aborted) { aborted = true; return resolve(); }
      const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (t >= total) return resolve();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      const tb = t - introDur;
      const i = Math.max(0, Math.min(works.length - 1, Math.floor(tb / segDur)));
      const w = prepared[i];
      const local = tb - i * segDur;
      const k = clamp01((tb - i * segDur + trans) / (segDur + trans));
      if (tb < 0) { // title card, crossfading into the first work
        drawWork(ctx, prepared[0], 0);
        const a = 1 - seg(t, introDur - 0.7, introDur);
        titleCard(a, seg(t, 0.1, Math.max(1.2, introDur - 0.6)));
      } else if (i > 0 && local < trans) {
        const kind = o.transitions[(i - 1) % o.transitions.length] || 'innerbloom';
        transitionDraw(kind, prepared[i - 1], w, 1, k, local / trans);
      } else {
        fx.glowPts = null; fx.rings = null; fx.bubbleRings = null;
        drawWork(ctx, w, k);
      }
      // light effects layer
      fx.setArtRect(w.rect); if (w.palette) fx.setPalette(w.palette);
      if (fx._lastWork !== i) { fx.setBloomPoints(w.points || []); fx._lastWork = i; }
      fx.t += dt; fx._update(dt); fx._draw();
      ctx.globalAlpha = o.fxOpacity || 1; ctx.drawImage(fxc, 0, 0, W, H); ctx.globalAlpha = 1;
      if (tb >= 0 && t < total - outroDur) caption(w, i, seg(local, 0.5, 1.2) * (1 - seg(local, segDur - 0.6, segDur - 0.1)));
      if (outroDur && t >= total - outroDur) { const a = seg(t, total - outroDur, total - outroDur + 0.8); titleCard(a, 1, true); }
      watermark();
      if (o.onProgress) o.onProgress(Math.min(total, t), total);
      if (o.monitor && (monitorTick++ % 3 === 0)) { const m = o.monitor; m.getContext('2d').drawImage(cv, 0, 0, m.width, m.height); }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  rec.stop();
  await stopped;
  vStream.getTracks().forEach(tr => tr.stop());
  if (aborted) throw Object.assign(new Error('aborted'), { code: 'ABORTED' });
  const type = mime.split(';')[0];
  return { blob: new Blob(chunks, { type }), mime: type, ext: type === 'video/mp4' ? 'mp4' : 'webm', width: W, height: H };
}
