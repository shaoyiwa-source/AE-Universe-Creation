// AE Shinity — signature transitions
export const TRANSITIONS = ['innerbloom', 'dissolve', 'bloom', 'rings', 'ink', 'silk', 'stardust', 'bubbles'];

const easeInOut = (p) => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const easeOutBack = (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (p, a, b) => clamp01((p - a) / (b - a));

function animateRaw(dur, fn) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    let done = false;
    const finish = () => { if (done) return; done = true; try { fn(1); } catch { /* ignore */ } resolve(); };
    // Safety: if rAF is throttled (background tab) never hang the slideshow.
    const guard = setTimeout(finish, dur + 1500);
    const step = (now) => {
      if (done) return;
      const p = Math.min(1, (now - t0) / dur);
      fn(p);
      if (p < 1) requestAnimationFrame(step);
      else { clearTimeout(guard); done = true; resolve(); }
    };
    requestAnimationFrame(step);
  });
}

function setMask(el, value) {
  el.style.webkitMaskImage = value;
  el.style.maskImage = value;
}

export function resetSlide(el, visible) {
  if (!el) return;
  el.style.opacity = visible ? '1' : '0';
  el.style.filter = '';
  el.style.transform = '';
  setMask(el, '');
}

/**
 * Run a transition between two slide layers.
 * @param {string} kind
 * @param {{from:HTMLElement|null,to:HTMLElement,fromImg:HTMLImageElement|null,rect:object,fromRect:object|null,W:number,H:number,fx:object}} o
 */
export async function runTransition(kind, o) {
  const { from, to, fx, W, H } = o;
  const speed = o.speed || 1; // mode tempo: party is faster, gallery is slower
  const animate = (d, fn) => animateRaw(d * speed, fn);
  const maxR = Math.hypot(W, H);
  to.style.opacity = '0';
  if (!from) kind = 'first';
  // a transition package (God mode) runs with the same helpers as the built-in transitions
  if (o.pack && from) {
    await o.pack.run(o, { animate, ease: { inOut: easeInOut, out: easeOut, back: easeOutBack }, setMask, clamp01, seg }, o.params || {});
    kind = 'package-done';
  }

  switch (kind) {
    case 'package-done': break;

    case 'first':
      await animate(2200, (p) => {
        const e = easeInOut(p);
        to.style.opacity = String(e);
        to.style.filter = `blur(${(1 - e) * 14}px) brightness(${1 + (1 - e) * 0.4})`;
        fx.flash = Math.sin(Math.PI * p) * 0.35;
      });
      break;

    case 'dissolve': // 柔光溶接
      await animate(2000, (p) => {
        const e = easeInOut(p);
        from.style.opacity = String(1 - e);
        from.style.filter = `blur(${e * 6}px)`;
        to.style.opacity = String(e);
        to.style.filter = `blur(${(1 - e) * 10}px) brightness(${1 + (1 - e) * 0.15})`;
      });
      break;

    case 'bloom': // 光暈綻放
      await animate(2600, (p) => {
        const a = easeInOut(seg(p, 0, 0.55));
        const b = easeInOut(seg(p, 0.35, 1));
        from.style.opacity = String(1 - a);
        from.style.filter = `brightness(${1 + a * 1.6}) blur(${a * 5}px)`;
        to.style.opacity = String(b);
        to.style.filter = `brightness(${1 + (1 - b) * 1.4}) blur(${(1 - b) * 6}px)`;
        fx.flash = Math.sin(Math.PI * p) * 0.6;
      });
      break;

    case 'rings': { // 三環共鳴 — brand Three Rings iris
      const r = o.rect;
      const cy = r.y + r.h / 2, cx = r.x + r.w / 2, off = Math.min(r.w, W) * 0.26;
      const centers = [[cx - off, cy], [cx, cy], [cx + off, cy]];
      const order = [1, 0, 2];
      const feather = 70;
      to.style.opacity = '1';
      await animate(2800, (p) => {
        const radii = centers.map((_, i) => easeInOut(seg(p, order.indexOf(i) * 0.12, 0.76 + order.indexOf(i) * 0.12)) * (maxR + feather));
        setMask(to, centers.map((c, i) => `radial-gradient(circle at ${c[0]}px ${c[1]}px, #000 ${Math.max(0, radii[i] - feather)}px, transparent ${radii[i]}px)`).join(','));
        from.style.filter = `brightness(${1 - p * 0.35})`;
        fx.rings = { centers, radii: radii.map(v => v - feather * 0.4), alpha: Math.sin(Math.PI * p) * 0.9 };
      });
      fx.rings = null;
      break;
    }

    case 'ink': { // 墨韻暈染 — organic watercolor bloom
      const r = o.rect;
      const seeds = Array.from({ length: 7 }, (_, i) => ({
        x: r.x + r.w * (0.15 + Math.random() * 0.7), y: r.y + r.h * (0.15 + Math.random() * 0.7),
        d: i === 0 ? 0 : Math.random() * 0.35, ph: Math.random() * 6.28,
      }));
      const feather = 140;
      to.style.opacity = '1';
      await animate(3200, (p) => {
        setMask(to, seeds.map(s => {
          const q = easeOut(seg(p, s.d, 1));
          const R = q * (maxR + feather) * (1 + 0.06 * Math.sin(p * 9 + s.ph));
          return `radial-gradient(circle at ${s.x}px ${s.y}px, #000 ${Math.max(0, R - feather)}px, transparent ${R}px)`;
        }).join(','));
        from.style.filter = `saturate(${1 - p * 0.6}) brightness(${1 - p * 0.2})`;
      });
      break;
    }

    case 'silk': { // 絲綢簾幕
      to.style.opacity = '1';
      await animate(2600, (p) => {
        const e = easeInOut(p);
        const pos = -30 + e * 160;
        setMask(to, `linear-gradient(105deg, #000 ${pos - 28}%, rgba(0,0,0,.5) ${pos - 12}%, transparent ${pos}%)`);
        to.style.transform = `translateX(${(1 - e) * 1.5}%)`;
        from.style.transform = `translateX(${-e * 1.5}%)`;
        from.style.opacity = String(1 - seg(p, 0.5, 1));
      });
      break;
    }

    case 'stardust': { // 星塵聚散 — the outgoing work dissolves into its own colored dust
      fx.dustFrom(o.fromImg, o.fromRect || o.rect);
      await animate(3000, (p) => {
        from.style.opacity = String(1 - easeInOut(seg(p, 0, 0.3)));
        const b = easeInOut(seg(p, 0.28, 1));
        to.style.opacity = String(b);
        to.style.filter = `blur(${(1 - b) * 8}px) brightness(${1 + (1 - b) * 0.3})`;
      });
      break;
    }

    case 'innerbloom': { // 內在綻放 — the next work opens from the brightest places of its own light
      const r = o.rect, m = Math.min(r.w, r.h);
      const pts = (o.points && o.points.length ? o.points : [{ u: 0.5, v: 0.45 }]).slice(0, 4)
        .map((q, i) => ({ x: r.x + q.u * r.w, y: r.y + q.v * r.h, d: i * 0.07, c: q.c }));
      const feather = Math.max(160, m * 0.35);
      to.style.opacity = '1';
      await animate(3400, (p) => {
        setMask(to, pts.map(q => {
          const R = easeInOut(seg(p, 0.12 + q.d, 0.96)) * (maxR + feather);
          return `radial-gradient(circle at ${q.x}px ${q.y}px, #000 ${Math.max(0, R - feather)}px, transparent ${R}px)`;
        }).join(','));
        const lift = Math.sin(Math.PI * seg(p, 0, 0.7));
        from.style.filter = `brightness(${1 + lift * 0.28}) saturate(${1 - p * 0.3})`;
        fx.glowPts = pts.map(q => { const e = Math.sin(Math.PI * seg(p, q.d, 0.85)); return { x: q.x, y: q.y, r: m * (0.05 + 0.24 * e), a: 0.5 * e, c: q.c }; });
      });
      fx.glowPts = null;
      break;
    }

    case 'bubbles': { // 泡泡樂園 — playful bubbles pop the next work into view
      const n = 16;
      const bs = Array.from({ length: n }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, d: (i / n) * 0.45 + Math.random() * 0.08, h: Math.random() * 360 }));
      const goal = maxR * 0.42;
      to.style.opacity = '1';
      await animate(2600, (p) => {
        const rs = bs.map(b => { const q = seg(p, b.d, b.d + 0.5); return q <= 0 ? 0 : easeOutBack(q) * goal; });
        const fin = easeInOut(seg(p, 0.75, 1)) * (maxR + 10);
        setMask(to, bs.map((b, i) => `radial-gradient(circle at ${b.x}px ${b.y}px, #000 ${Math.max(0, rs[i] - 3)}px, transparent ${rs[i] + 2}px)`)
          .concat(`radial-gradient(circle at ${W / 2}px ${H / 2}px, #000 ${fin}px, transparent ${fin + 2}px)`).join(','));
        fx.bubbleRings = bs.map((b, i) => ({ x: b.x, y: b.y, r: rs[i], h: b.h, a: rs[i] > 0 ? 0.85 * (1 - seg(p, b.d + 0.15, b.d + 0.55)) : 0 }));
      });
      fx.bubbleRings = null;
      break;
    }

    default:
      await animate(1000, (p) => { if (from) from.style.opacity = String(1 - p); to.style.opacity = String(p); });
  }

  fx.flash = 0;
  resetSlide(from, false);
  resetSlide(to, true);
}
