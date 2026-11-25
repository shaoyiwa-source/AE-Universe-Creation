// AE package · 遠近漂浮 Dream Depth — light floating in real depth around the painting. Each mote lives at a distance:
// far ones are small and sharp behind the work, near ones large, soft and out of focus in front of it (like a lens),
// and they drift slowly towards you, away from you, or breathe in and out — the painting sits in the middle of the space.
// With music, the drift swells on the beat and the motes glow with it. Colours come from the painting.
export default {
  id: 'depth', type: 'effect', version: 1,
  name: { zh: '遠近漂浮', en: 'Dream Depth' },
  desc: { zh: '光點在真正的遠近之間漂浮：遠的在畫後面、小而清楚，近的在畫前面、大而朦朧，緩緩靠近或遠離', en: 'Light floats in real depth: far motes small and sharp behind the work, near ones large and soft in front, drifting closer or away' },
  params: [
    { id: 'count', type: 'range', min: 20, max: 220, step: 1, default: 160, label: { zh: '光點數量', en: 'Motes' } },
    { id: 'drift', type: 'choice', default: 'breathe', label: { zh: '漂浮方向', en: 'Drift' }, options: [
      { id: 'toward', zh: '由遠而近', en: 'Coming closer' }, { id: 'away', zh: '由近而遠', en: 'Going away' }, { id: 'breathe', zh: '遠近呼吸', en: 'Breathing in and out' } ] },
    { id: 'speed', type: 'range', min: 0.05, max: 1, step: 0.05, default: 0.3, label: { zh: '速度', en: 'Speed' } },
    { id: 'size', type: 'range', min: 0.4, max: 2, step: 0.05, default: 1, label: { zh: '大小', en: 'Size' } },
    { id: 'glow', type: 'range', min: 0.2, max: 1, step: 0.05, default: 0.7, label: { zh: '亮度', en: 'Glow' } },
    { id: 'color', type: 'choice', default: 'painting', label: { zh: '光色', en: 'Colour' }, options: [{ id: 'painting', zh: '畫作的顏色', en: 'From the painting' }, { id: 'gold', zh: '香檳金', en: 'Champagne gold' }, { id: 'white', zh: '月光白', en: 'Moon white' }] },
    { id: 'music', type: 'toggle', default: true, label: { zh: '跟著音樂起伏', en: 'Swell with the music' } },
  ],
  create(host, p) {
    let t = 0, motes = [], seed = 7, surge = 0, lastCount = null;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const spawn = (m, far) => {
      m.x = (rnd() * 2 - 1) * 1.6; m.y = (rnd() * 2 - 1) * 1.0;
      m.z = far ? 0.9 + rnd() * 0.6 : 0.12 + rnd() * 1.38; // 0.12 (at your face) … 1.5 (deep behind the work)
      m.c = rnd(); m.tw = rnd() * 6.28; m.s = 0.6 + rnd() * 0.9; m.vx = (rnd() - 0.5) * 0.04; m.vy = (rnd() - 0.5) * 0.03 - 0.01;
      return m;
    };
    const colour = (m) => p.color === 'gold' ? [240, 212, 150] : p.color === 'white' ? [236, 240, 255] : host.palette[Math.floor(m.c * host.palette.length) % host.palette.length];
    const PAINT_Z = 0.55; // the painting's distance: motes beyond it are drawn behind the work, nearer ones in front
    return {
      set(np) { Object.assign(p, np); },
      frame(dt, k) {
        t += dt;
        const W = host.W, H = host.H; if (!W) return;
        while (motes.length < p.count) motes.push(spawn({}, false));
        if (motes.length > p.count) motes.length = p.count;
        // the music: each beat gives the drift a gentle push and the light a lift
        let lift = 0;
        if (p.music) {
          const b = host.beat() || {};
          if (b.live && b.count != null) { if (lastCount !== null && b.count > lastCount) surge = 1; lastCount = b.count; }
          lift = Math.max(b.live ? (b.pulse || 0) : 0, (b.level || 0) * 0.6);
        }
        surge *= Math.pow(0.15, dt);
        const dir = p.drift === 'toward' ? -1 : p.drift === 'away' ? 1 : Math.sin(t * 2 * Math.PI / 16); // breathe: 16 s in, out
        const vz = dir * p.speed * 0.12 * (1 + surge * 2.5);
        const f = Math.min(W, H) * 0.42, cx = W / 2, cy = H / 2;
        const back = host.back, front = host.front;
        // far first (painter's order), so near motes sit over far ones
        motes.sort((a, b) => b.z - a.z);
        for (const m of motes) {
          m.z += vz * dt; m.x += m.vx * dt; m.y += m.vy * dt;
          if (m.z < 0.1) spawn(m, true); else if (m.z > 1.6) { spawn(m, false); m.z = 0.15 + rnd() * 0.15; }
          const sx = cx + (m.x / m.z) * f, sy = cy + (m.y / m.z) * f;
          if (sx < -200 || sx > W + 200 || sy < -200 || sy > H + 200) { if (vz <= 0) spawn(m, true); continue; }
          const near = m.z < PAINT_Z;
          const blur = near ? Math.min(1, (PAINT_Z - m.z) / 0.4) : 0;                 // out of focus near the lens
          const size = (9 + 46 * blur) * m.s * p.size / Math.max(0.15, m.z);           // bigger when near
          const fadeFar = Math.min(1, (1.6 - m.z) / 0.5), fadeNear = Math.min(1, (m.z - 0.1) / 0.12);
          const tw = 0.65 + 0.35 * Math.sin(t * 1.3 + m.tw);
          const a = p.glow * k * fadeFar * fadeNear * tw * (near ? 0.5 + 0.35 * (1 - blur) : 1) * (1 + lift * 0.8);
          if (a < 0.01) continue;
          const ctx = near ? front : back; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a);
          ctx.drawImage(host.sprite(colour(m), blur > 0.3), sx - size / 2, sy - size / 2, size, size);
        }
      },
    };
  },
};
