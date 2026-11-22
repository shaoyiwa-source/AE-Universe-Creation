// AE package · 天光 Heavenly Light — rays descend from above, a museum light sweeps the canvas, dust glows in the beams.
export default {
  id: 'light', type: 'effect', version: 1,
  name: { zh: '天光', en: 'Heavenly Light' },
  desc: { zh: '光從天上灑下，美術館的光束緩緩掃過畫面', en: 'Light pours down from above; a gallery beam slowly sweeps the work' },
  params: [
    { id: 'intensity', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.6, label: { zh: '光的強度', en: 'Intensity' } },
    { id: 'rays', type: 'range', min: 2, max: 9, step: 1, default: 5, label: { zh: '光束數量', en: 'Rays' } },
    { id: 'angle', type: 'range', min: -40, max: 40, step: 1, default: -14, unit: '°', label: { zh: '光的角度', en: 'Angle' } },
    { id: 'tone', type: 'choice', default: 'gold', options: [{ id: 'gold', zh: '香檳金', en: 'Champagne gold' }, { id: 'white', zh: '晨光白', en: 'Morning white' }, { id: 'painting', zh: '畫作的顏色', en: 'From the painting' }], label: { zh: '光色', en: 'Tone' } },
    { id: 'sweep', type: 'toggle', default: true, label: { zh: '光束掃過畫面', en: 'Beam sweeps the work' } },
    { id: 'every', type: 'range', min: 4, max: 20, step: 1, default: 9, unit: 's', label: { zh: '掃過間隔', en: 'Sweep every' } },
  ],
  create(host, p) {
    let t = 0, sweepT = 0, dust = [];
    const tone = (i) => p.tone === 'white' ? [255, 246, 230] : p.tone === 'painting' ? host.palette[i % host.palette.length] : [236, 205, 140];
    const rays = () => Array.from({ length: p.rays }, (_, i) => ({ u: (i + 0.5) / p.rays + (Math.sin(i * 12.9) * 0.08), w: 0.05 + ((i * 7) % 5) * 0.018, ph: i * 1.7 }));
    let R = rays(), lastN = p.rays;
    return {
      set(np) { Object.assign(p, np); if (p.rays !== lastN) { R = rays(); lastN = p.rays; } },
      frame(dt, k) {
        t += dt; sweepT += dt;
        const W = host.W, H = host.H, r = host.rect, a = p.angle * Math.PI / 180;
        const back = host.back, front = host.front;
        // rays: drawn behind the painting (full) and very faintly over it (it stands inside the light)
        for (const [ctx, kk] of [[back, 1], [front, 0.28]]) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.translate(W / 2, -H * 0.1); ctx.rotate(a); ctx.translate(-W / 2, 0);
          R.forEach((ray, i) => {
            const breathe = 0.55 + 0.45 * Math.sin(t * 0.5 + ray.ph);
            const x = (ray.u + Math.sin(t * 0.07 + ray.ph) * 0.03) * W * 1.3 - W * 0.15, w = ray.w * W;
            const [cr, cg, cb] = tone(i);
            const g = ctx.createLinearGradient(0, 0, 0, H * 1.25);
            g.addColorStop(0, `rgba(${cr},${cg},${cb},${0.32 * p.intensity * breathe * kk * k})`);
            g.addColorStop(0.55, `rgba(${cr},${cg},${cb},${0.12 * p.intensity * breathe * kk * k})`);
            g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.moveTo(x - w * 0.25, 0); ctx.lineTo(x + w * 0.25, 0); ctx.lineTo(x + w, H * 1.25); ctx.lineTo(x - w, H * 1.25); ctx.closePath(); ctx.fill();
          });
          ctx.restore();
        }
        // dust glittering inside the beams
        while (dust.length < 60) dust.push({ x: Math.random() * W, y: Math.random() * H, v: 4 + Math.random() * 8, ph: Math.random() * 6.28, s: 1 + Math.random() * 2.2 });
        front.globalCompositeOperation = 'lighter';
        for (const d of dust) {
          d.y += d.v * dt; d.x += Math.sin(t * 0.4 + d.ph) * 4 * dt; if (d.y > H + 10) { d.y = -10; d.x = Math.random() * W; }
          front.globalAlpha = (0.25 + 0.5 * Math.max(0, Math.sin(t * 1.3 + d.ph))) * p.intensity * k;
          const s = d.s * 6; front.drawImage(host.sprite(tone(0)), d.x - s / 2, d.y - s / 2, s, s);
        }
        // the gallery beam: a soft band of light travels diagonally across the canvas
        if (p.sweep && r) {
          const period = p.every, ph = (sweepT % period) / period, run = Math.min(1, ph / 0.45);
          if (ph < 0.45) {
            front.save(); front.beginPath(); front.rect(r.x, r.y, r.w, r.h); front.clip();
            front.globalCompositeOperation = 'lighter';
            const cx = r.x - r.w * 0.4 + run * r.w * 1.8, bw = r.w * 0.22;
            const g = front.createLinearGradient(cx - bw, r.y, cx + bw, r.y + r.h * 0.35);
            const e = Math.sin(run * Math.PI) * 0.26 * p.intensity * k;
            g.addColorStop(0, 'rgba(255,248,230,0)'); g.addColorStop(0.5, `rgba(255,248,230,${e})`); g.addColorStop(1, 'rgba(255,248,230,0)');
            front.globalAlpha = 1; front.fillStyle = g; front.fillRect(r.x, r.y, r.w, r.h);
            front.restore();
          }
        }
        front.globalAlpha = 1;
      },
      dispose() { dust = []; },
    };
  },
};
