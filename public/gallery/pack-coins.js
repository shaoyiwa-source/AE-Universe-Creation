// AE one-tap · 金幣 Gold coins — from the homepage show: a shower of spinning gold coins (each struck with ✦)
// pours over the painting, bounces on its lower edge and rings.
export default {
  id: 'coins', type: 'burst', version: 1, icon: 'coins',
  name: { zh: '金幣', en: 'Gold coins' },
  desc: { zh: '一陣旋轉的金幣灑落在畫上，彈跳、叮噹作響', en: 'Spinning gold coins pour over the work, bounce and ring' },
  params: [],
  create(host) {
    const r = host.rect, v = (s) => { const n = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return n - Math.floor(n); }, seed = Math.random() * 13;
    const coins = Array.from({ length: 24 }, (_, i) => ({ i, x: r.x + r.w * (0.06 + 0.88 * v(i * 1.3 + seed)), y: r.y - 14 - v(i * 7.1) * 90, vx: (v(i * 3.3) - 0.5) * 90, vy: 30 + v(i * 4.4) * 120,
      r: (7 + v(i * 5.7 + seed) * 6) * Math.max(0.8, Math.min(1.6, r.w / 600)), spin: v(i) * 6, spinV: 5 + v(i * 9.1) * 9, tilt: (v(i * 6.6) - 0.5) * 0.5, delay: i * 0.045, life: 2.3, bounces: 0, ring: i % 3 === 0 }));
    for (let i = 0; i < 6; i++) setTimeout(() => host.chime('coin', i * 2 + 1), 40 + i * 95);
    let t = 0;
    return {
      frame(dt) {
        t += dt; const ctx = host.front, floor = r.y + r.h - 4; let any = false;
        for (const c of coins) {
          const u = t - c.delay; if (u < 0) { any = true; continue; } if (u > c.life) continue; any = true;
          c.vy += 980 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.spin += c.spinV * dt;
          if (c.y > floor - c.r) { c.y = floor - c.r; if (c.bounces < 2) { c.vy = -Math.abs(c.vy) * 0.38; c.vx *= 0.7; c.bounces++; if (c.bounces === 1 && c.ring) host.chime('coin', c.i); } else c.vy = 0; }
          const fade = Math.min(1, u / 0.12) * Math.min(1, (c.life - u) / 0.45); if (fade <= 0) continue;
          const sx = Math.max(0.12, Math.abs(Math.cos(c.spin)));
          ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.translate(c.x, c.y); ctx.rotate(c.tilt); ctx.scale(sx, 1); ctx.globalAlpha = fade;
          const cg = ctx.createRadialGradient(-c.r * 0.35, -c.r * 0.4, c.r * 0.1, 0, 0, c.r); cg.addColorStop(0, '#fff6cf'); cg.addColorStop(0.45, '#efc457'); cg.addColorStop(1, '#9c6b1a');
          ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(120,78,16,.85)'; ctx.lineWidth = 1; ctx.stroke();
          ctx.strokeStyle = 'rgba(255,236,170,.75)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(0, 0, c.r * 0.68, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = 'rgba(120,78,16,.7)'; ctx.beginPath(); const k = c.r * 0.36;
          ctx.moveTo(0, -k); ctx.lineTo(k * 0.28, -k * 0.28); ctx.lineTo(k, 0); ctx.lineTo(k * 0.28, k * 0.28); ctx.lineTo(0, k); ctx.lineTo(-k * 0.28, k * 0.28); ctx.lineTo(-k, 0); ctx.lineTo(-k * 0.28, -k * 0.28); ctx.closePath(); ctx.fill();
          ctx.restore();
          if (sx > 0.96) { ctx.globalAlpha = fade * 0.9; ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(c.x - c.r * 0.35, c.y - c.r * 0.4, 1.6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
        }
        return any;
      },
    };
  },
};
