// AE one-tap · 雷射光 Laser sweep — from the homepage show: six beams sweep over the painting for a moment,
// flaring at 148 BPM, each hit lighting the painted surface.
export default {
  id: 'sweep', type: 'burst', version: 1, icon: 'laser',
  name: { zh: '雷射光', en: 'Laser' },
  desc: { zh: '六道雷射掃過畫面，隨 148 BPM 閃動', en: 'Six beams sweep the work, flaring at 148 BPM' },
  params: [],
  create(host) {
    const r = host.rect, C = [[255, 65, 109], [87, 255, 160], [255, 226, 141], [101, 219, 255], [201, 135, 255], [255, 172, 104]], seed = Math.random() * 6;
    for (let v = 0; v < 4; v++) setTimeout(() => host.chime('zap', v), v * 405);
    let t = 0; const life = 1.65;
    const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`;
    return {
      frame(dt) {
        t += dt; const q = Math.min(1, t / life), env = Math.sin(Math.PI * q) ** 0.5, bt = t / 0.405, pulse = (1 - (bt - Math.floor(bt))) ** 3;
        const ctx = host.front; ctx.save(); ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const ox = i % 3 === 0 ? r.x - r.w * 0.06 : i % 3 === 1 ? r.x + r.w * 1.06 : r.x + r.w * (0.2 + i * 0.11), oy = i % 3 === 2 ? -16 : r.y + r.h * (0.12 + (i % 4) * 0.2);
          const ph = t * (1.1 + i * 0.13) + i * 1.7 + seed, tx = r.x + r.w * (0.5 + 0.4 * Math.sin(ph)), ty = r.y + r.h * (0.3 + 0.42 * (0.5 + 0.5 * Math.cos(ph * 1.3)));
          const c = C[i], power = Math.min(1, env * (0.35 + 0.65 * pulse));
          ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = rgba(c, power * 0.85); ctx.lineWidth = 1.2 + pulse * 2.4;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba([255, 249, 223], power * 0.8); ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
          const R = 30 + pulse * 34, g = ctx.createRadialGradient(tx, ty, 1, tx, ty, R);
          g.addColorStop(0, rgba([255, 249, 218], power * 0.7)); g.addColorStop(0.2, rgba(c, power * 0.35)); g.addColorStop(1, rgba(c, 0));
          ctx.fillStyle = g; ctx.fillRect(tx - R, ty - R, R * 2, R * 2);
        }
        ctx.restore();
        return t < life;
      },
    };
  },
};
