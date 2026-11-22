// AE package · 雷射光 Prism Laser — beams come in from beyond the frame and land ON the painting: each hit lights a
// pool of coloured light on the painted surface, splits into prism rays and rings on the beat (from the homepage show).
export default {
  id: 'laser', type: 'effect', version: 1,
  name: { zh: '雷射光', en: 'Prism Laser' },
  desc: { zh: '光束從畫框外打在畫上，落點照亮畫面、折射出稜鏡光，隨鼓點閃動', en: 'Beams land on the painting, light its surface, split into prisms and pulse on the beat' },
  params: [
    { id: 'beams', type: 'range', min: 2, max: 8, step: 1, default: 6, label: { zh: '光束數量', en: 'Beams' } },
    { id: 'power', type: 'range', min: 0.2, max: 1, step: 0.05, default: 0.8, label: { zh: '亮度', en: 'Power' } },
    { id: 'colors', type: 'choice', default: 'prism', options: [{ id: 'prism', zh: '彩虹稜鏡', en: 'Prism' }, { id: 'painting', zh: '畫作的顏色', en: 'From the painting' }, { id: 'gold', zh: '香檳金', en: 'Champagne gold' }], label: { zh: '顏色', en: 'Colours' } },
    { id: 'sync', type: 'choice', default: 'music', options: [{ id: 'music', zh: '跟著音樂', en: 'With the music' }, { id: 'tempo', zh: '固定節拍', en: 'Fixed tempo' }], label: { zh: '節奏', en: 'Rhythm' } },
    { id: 'bpm', type: 'range', min: 60, max: 160, step: 1, default: 120, label: { zh: '節拍（BPM）', en: 'Tempo (BPM)' } },
    { id: 'pools', type: 'toggle', default: true, label: { zh: '照亮落點（光照在畫上）', en: 'Light pools on the painting' } },
  ],
  create(host, p) {
    const PRISM = [[255, 65, 109], [87, 255, 160], [255, 226, 141], [101, 219, 255], [201, 135, 255], [255, 172, 104]];
    let t = 0, lastBeat = -9, count = 0, own = 0;
    const rnd = (s) => { const n = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return n - Math.floor(n); };
    const col = (i, x, y) => p.colors === 'gold' ? [236, 205, 140] : p.colors === 'painting' ? host.colorAt(x, y) : PRISM[i % PRISM.length];
    const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a))})`;
    return {
      set(np) { Object.assign(p, np); },
      frame(dt, k) {
        t += dt;
        const r = host.rect; if (!r) return;
        // the beat: the music's kick drum when there is one, otherwise our own steady tempo
        const b = p.sync === 'music' ? host.beat() : null;
        let pulse, beat = false;
        if (b && b.live) { if (b.count !== count) { count = b.count; beat = true; } pulse = b.pulse; }
        else { own += dt; const iv = 60 / p.bpm; if (own >= iv) { own -= iv; count++; beat = true; lastBeat = t; } pulse = Math.exp(-(t - lastBeat) / 0.11); }
        const sweep = t * 0.35 + count * 0.18, group = Math.floor(count / 4);
        const ctx = host.front; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
        const n = Math.round(p.beams);
        for (let i = 0; i < n; i++) {
          // where it comes from: beyond the left, the right, or above the frame
          const side = i % 3;
          const ox = side === 0 ? r.x - r.w * 0.12 - 30 : side === 1 ? r.x + r.w * 1.12 + 30 : r.x + r.w * (0.15 + (i * 0.17) % 0.7);
          const oy = side === 2 ? -20 : r.y + r.h * (0.12 + ((i * 0.23) % 0.7));
          // where it lands: wandering over the painting, a new figure every four beats
          const a = i * Math.PI / 3 + sweep * 0.8 + rnd(group + 1) * 1.7;
          const tx = r.x + r.w * (0.14 + 0.72 * (0.5 + 0.5 * Math.sin(a)));
          const ty = r.y + r.h * (0.16 + 0.68 * (0.5 + 0.5 * Math.cos(a * 1.3)));
          const c = col(i, tx, ty), power = Math.min(1, 0.22 + pulse * 0.78) * p.power * k;
          // the beam: real colour that shows even on a light painting (painted over), then a glowing core (added light)
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = rgba(c, power * 0.22); ctx.lineWidth = 7 + pulse * 7;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.strokeStyle = rgba(c, power * 0.85); ctx.lineWidth = 1.8 + pulse * 2;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = rgba([255, 249, 223], power * 0.75); ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
          // it hits the painting: a pool of light on the painted surface …
          if (p.pools) {
            const R = 36 + pulse * 50;
            // the coloured light pool tints the painted surface …
            ctx.globalCompositeOperation = 'source-over';
            const g = ctx.createRadialGradient(tx, ty, 1, tx, ty, R);
            g.addColorStop(0, rgba(c, power * 0.42)); g.addColorStop(0.45, rgba(c, power * 0.18)); g.addColorStop(1, rgba(c, 0));
            ctx.fillStyle = g; ctx.fillRect(tx - R, ty - R, R * 2, R * 2);
            // … with a hot white centre where the beam strikes
            ctx.globalCompositeOperation = 'lighter';
            const h = ctx.createRadialGradient(tx, ty, 0, tx, ty, R * 0.35);
            h.addColorStop(0, rgba([255, 252, 236], power * 0.9)); h.addColorStop(1, rgba([255, 252, 236], 0));
            ctx.fillStyle = h; ctx.fillRect(tx - R, ty - R, R * 2, R * 2);
          }
          // … and splits into prism rays beyond the hit
          const ang = Math.atan2(ty - oy, tx - ox), reach = Math.min(r.w * 0.3, 150) * (1 + pulse * 0.25);
          for (let j = -1; j <= 1; j++) {
            const aj = ang + j * (0.16 + (group % 3) * 0.14) + Math.sin(sweep) * 0.15;
            const ex = tx + Math.cos(aj) * reach, ey = ty + Math.sin(aj) * reach;
            const gr = ctx.createLinearGradient(tx, ty, ex, ey);
            gr.addColorStop(0, rgba(PRISM[(i + j + 6) % 6], power * 0.75)); gr.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.strokeStyle = gr; ctx.lineWidth = 0.9 + pulse;
            ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(ex, ey); ctx.stroke();
          }
          // a ring opens on the beat
          if (pulse > 0.05) { ctx.strokeStyle = rgba(c, pulse * 0.6 * k); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(tx, ty, 8 + (1 - pulse) * 34, 0, Math.PI * 2); ctx.stroke(); }
        }
        ctx.restore();
        void beat;
      },
      dispose() {},
    };
  },
};
