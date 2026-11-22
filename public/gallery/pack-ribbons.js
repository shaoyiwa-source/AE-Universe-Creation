// AE package · 流光絲帶 Silk Ribbons — wide, soft ribbons of light flow along the painting's own strokes.
export default {
  id: 'ribbons', type: 'effect', version: 1,
  name: { zh: '流光絲帶', en: 'Silk Ribbons' },
  desc: { zh: '寬而柔的光帶沿著畫作的筆觸流動，清楚可見', en: 'Wide, soft ribbons of light flow along the strokes — clearly visible' },
  params: [
    { id: 'count', type: 'range', min: 2, max: 14, step: 1, default: 6, label: { zh: '絲帶數量', en: 'Ribbons' } },
    { id: 'width', type: 'range', min: 4, max: 40, step: 1, default: 16, unit: 'px', label: { zh: '寬度', en: 'Width' } },
    { id: 'speed', type: 'range', min: 0.2, max: 2, step: 0.05, default: 0.8, label: { zh: '流速', en: 'Speed' } },
    { id: 'opacity', type: 'range', min: 0.1, max: 0.8, step: 0.05, default: 0.38, label: { zh: '亮度', en: 'Brightness' } },
    { id: 'color', type: 'choice', default: 'painting', options: [{ id: 'painting', zh: '畫作的顏色', en: 'From the painting' }, { id: 'gold', zh: '香檳金', en: 'Champagne gold' }, { id: 'rainbow', zh: '虹彩', en: 'Iridescent' }], label: { zh: '顏色', en: 'Colour' } },
    { id: 'reach', type: 'choice', default: 'everywhere', options: [{ id: 'painting', zh: '只在畫上', en: 'On the work only' }, { id: 'everywhere', zh: '飄出畫框', en: 'Drift beyond the frame' }], label: { zh: '範圍', en: 'Reach' } },
  ],
  create(host, p) {
    let ribbons = [], t = 0;
    const hsl = (h) => { const f = (n) => { const k = (n + h / 30) % 12; return 255 * (0.72 - 0.38 * Math.max(-1, Math.min(k - 3, 9 - k, 1))); }; return [f(0) | 0, f(8) | 0, f(4) | 0]; };
    const born = () => {
      const r = host.rect, pt = host.livingPoint();
      const x = pt ? pt[0] : r.x + Math.random() * r.w, y = pt ? pt[1] : r.y + Math.random() * r.h;
      return { x, y, pts: [], life: 0, max: 6 + Math.random() * 6, sign: Math.random() < 0.5 ? -1 : 1, hue: Math.random() * 360, rgb: p.color === 'gold' ? [236, 205, 140] : host.colorAt(x, y), w: 0.7 + Math.random() * 0.6 };
    };
    return {
      set(np) { Object.assign(p, np); },
      frame(dt, k) {
        t += dt;
        const r = host.rect; if (!r) return;
        while (ribbons.length < p.count) { const b = born(); b.life = Math.random() * 3; ribbons.push(b); }
        if (ribbons.length > p.count) ribbons.length = p.count;
        const ctx = host.front; ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const rb of ribbons) {
          rb.life += dt;
          const [fx, fy] = host.flowAt(rb.x, rb.y);
          const inside = rb.x > r.x && rb.x < r.x + r.w && rb.y > r.y && rb.y < r.y + r.h;
          const sp = 55 * p.speed;
          rb.x += (fx * rb.sign * sp + Math.sin(t * 0.9 + rb.hue) * 8 + host.wind.x * 0.6) * dt;
          rb.y += (fy * rb.sign * sp + Math.cos(t * 0.7 + rb.hue) * 8 - (inside ? 0 : 14) + host.wind.y * 0.6) * dt;
          if (p.reach === 'painting' && !inside) rb.life = Math.max(rb.life, rb.max - 0.6);
          rb.pts.push([rb.x, rb.y]); if (rb.pts.length > 70) rb.pts.shift();
          if (p.color === 'painting' && rb.pts.length % 10 === 0 && inside) rb.rgb = rb.rgb.map((v, i) => v * 0.7 + host.colorAt(rb.x, rb.y)[i] * 0.3);
          const fade = Math.max(0, Math.min(1, rb.life / 1.5, (rb.max - rb.life) / 1.8));
          const n = rb.pts.length; if (n < 4 || fade <= 0) { if (rb.life > rb.max) Object.assign(rb, born()); continue; }
          for (let i = 1; i < n; i++) {
            const q = i / n, taper = Math.sin(q * Math.PI);
            const rgb = p.color === 'rainbow' ? hsl((rb.hue + i * 3 + t * 20) % 360) : rb.rgb;
            ctx.strokeStyle = `rgb(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0})`;
            // the soft body of the ribbon …
            ctx.globalAlpha = p.opacity * 0.35 * taper * fade * k; ctx.lineWidth = p.width * rb.w * taper + 1;
            ctx.beginPath(); ctx.moveTo(rb.pts[i - 1][0], rb.pts[i - 1][1]); ctx.lineTo(rb.pts[i][0], rb.pts[i][1]); ctx.stroke();
          }
          // … and its bright silk core
          ctx.globalAlpha = p.opacity * 0.9 * fade * k; ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(255,250,240,1)';
          ctx.beginPath(); rb.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
          if (rb.life > rb.max) Object.assign(rb, born());
        }
        ctx.globalAlpha = 1;
      },
      dispose() { ribbons = []; },
    };
  },
};
