// AE one-tap · 發亮光 Glow — from the homepage show: a warm sunburst opens at the painting's heart, rays turn,
// a ring spreads and small gold lights blossom over the work. (A 'burst' package: it plays once and ends.)
export default {
  id: 'glow', type: 'burst', version: 1, icon: 'glow',
  name: { zh: '發亮光', en: 'Glow' },
  desc: { zh: '畫的中心綻放一道溫暖的光芒', en: 'A warm sunburst opens at the heart of the work' },
  params: [],
  create(host) {
    const r = host.rect, f = host.focalPoints(1)[0] || [0.5, 0.45];
    const x = r.x + r.w * f[0], y = r.y + r.h * f[1];
    const spots = Array.from({ length: 5 }, (_, i) => { const pt = host.livingPoint() || [r.x + r.w * Math.random(), r.y + r.h * Math.random()]; return { x: pt[0], y: pt[1], at: 0.16 + i * 0.11 }; });
    let t = 0; const life = 1.7;
    host.chime('glow');
    return {
      frame(dt) {
        t += dt; const ctx = host.front, q = Math.min(1, t / life), a = Math.max(0, 1 - q) ** 1.3, rise = Math.min(1, q * 4), R = (0.35 + 0.65 * rise) * Math.min(r.w * 0.62, 320);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, `rgba(255,250,222,${0.9 * a})`); g.addColorStop(0.25, `rgba(255,220,120,${0.5 * a})`); g.addColorStop(0.6, `rgba(240,170,45,${0.18 * a})`); g.addColorStop(1, 'rgba(240,170,45,0)');
        ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
        ctx.lineCap = 'round';
        for (let i = 0; i < 14; i++) {
          const ang = i / 14 * Math.PI * 2 + q * 0.5, inner = R * 0.16, outer = R * (0.72 + 0.22 * Math.sin(i * 2.3));
          const x0 = x + Math.cos(ang) * inner, y0 = y + Math.sin(ang) * inner, x1 = x + Math.cos(ang) * outer, y1 = y + Math.sin(ang) * outer;
          const lg = ctx.createLinearGradient(x0, y0, x1, y1); lg.addColorStop(0, `rgba(255,240,190,${0.55 * a})`); lg.addColorStop(1, 'rgba(255,214,110,0)');
          ctx.strokeStyle = lg; ctx.lineWidth = i % 2 ? 1 : 1.8; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
        ctx.strokeStyle = `rgba(255,226,140,${0.7 * a})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, Math.max(0, R * 0.42 * rise + 6), 0, Math.PI * 2); ctx.stroke();
        // small gold lights blossoming over the work
        for (const s of spots) {
          const u = (t - s.at) / 1.1; if (u < 0 || u > 1) continue;
          const op = 1 - u, rad = 35 + u * 90, gg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad);
          gg.addColorStop(0, `rgba(255,249,210,${op})`); gg.addColorStop(0.22, `rgba(255,217,108,${op * 0.8})`); gg.addColorStop(1, 'rgba(245,180,45,0)');
          ctx.fillStyle = gg; ctx.fillRect(s.x - rad, s.y - rad, rad * 2, rad * 2);
          ctx.strokeStyle = `rgba(255,222,127,${op})`; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(0, 8 + u * 55), 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
        return t < life + 1.3;
      },
    };
  },
};
