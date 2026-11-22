// AE package · 風 Wind — visible wind passes over and around the painting; the painting's own light is carried by it.
// Package contract v1: a self-contained module (no imports). The host gives a reading of the painting,
// two light layers (back = behind the work, front = over it) and a few helpers. The painting itself is never touched.
export default {
  id: 'wind', type: 'effect', version: 1,
  name: { zh: '風', en: 'Wind' },
  desc: { zh: '一陣陣風吹過畫面，帶著畫裡的光一起流動', en: 'Gusts sweep across the work, carrying its light along' },
  params: [
    { id: 'direction', type: 'range', min: 0, max: 359, step: 1, default: 345, unit: '°', label: { zh: '風向', en: 'Direction' } },
    { id: 'strength', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.6, label: { zh: '風力', en: 'Strength' } },
    { id: 'gusts', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5, label: { zh: '陣風起伏', en: 'Gustiness' } },
    { id: 'streaks', type: 'range', min: 4, max: 40, step: 1, default: 18, label: { zh: '風絲數量', en: 'Wisps' } },
    { id: 'petals', type: 'range', min: 0, max: 24, step: 1, default: 8, label: { zh: '隨風的光瓣', en: 'Light petals' } },
    { id: 'color', type: 'choice', default: 'painting', options: [{ id: 'painting', zh: '畫作的顏色', en: 'From the painting' }, { id: 'gold', zh: '香檳金', en: 'Champagne gold' }, { id: 'white', zh: '月光白', en: 'Moon white' }], label: { zh: '顏色', en: 'Colour' } },
  ],
  create(host, p) {
    const TAU = Math.PI * 2;
    let wisps = [], petals = [], t = 0, gust = 0;
    const colour = (x, y) => p.color === 'gold' ? [236, 205, 140] : p.color === 'white' ? [235, 240, 255] : host.colorAt(x, y);
    const dir = () => { const a = p.direction * Math.PI / 180; return [Math.cos(a), Math.sin(a)]; };
    const spawnPoint = () => {
      // enter from the upwind side of the screen
      const [dx, dy] = dir(), W = host.W, H = host.H;
      if (Math.abs(dx) > Math.abs(dy)) return [dx > 0 ? -40 : W + 40, Math.random() * H];
      return [Math.random() * W, dy > 0 ? -40 : H + 40];
    };
    const newWisp = (anywhere) => {
      const [x, y] = anywhere ? [Math.random() * host.W, Math.random() * host.H] : spawnPoint();
      return { x, y, pts: [], life: 0, max: 5 + Math.random() * 5, w: 0.8 + Math.random() * 1.8, ph: Math.random() * TAU, sp: 0.7 + Math.random() * 0.6, rgb: colour(host.W / 2, host.H / 2) };
    };
    const newPetal = (anywhere) => { const [x, y] = anywhere ? [Math.random() * host.W, Math.random() * host.H] : spawnPoint(); return { x, y, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 3, s: 10 + Math.random() * 14, ph: Math.random() * TAU, rgb: host.palette[(Math.random() * host.palette.length) | 0] }; };
    return {
      set(np) { Object.assign(p, np); },
      frame(dt, k) {
        t += dt;
        const W = host.W, H = host.H, [dx, dy] = dir();
        // gusts: a slow swell with quicker flutters on top
        gust = (1 - p.gusts) + p.gusts * (0.55 + 0.45 * Math.sin(t * 0.7) * Math.sin(t * 0.23 + 1.3) + 0.15 * Math.sin(t * 2.3));
        const speed = 140 * p.strength * gust;
        host.wind.x = dx * speed * 0.35 * k; host.wind.y = dy * speed * 0.35 * k; // the painting's living light is carried too
        while (wisps.length < p.streaks) wisps.push(newWisp(wisps.length < p.streaks / 2 && t < 0.1));
        while (petals.length < p.petals) petals.push(newPetal(t < 0.1));
        if (petals.length > p.petals) petals.length = p.petals;
        const ctx = host.front, back = host.back;
        ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const w of wisps) {
          w.life += dt;
          // the wind bends a little along the painting's strokes where it passes over them
          const [fx, fy] = host.flowAt(w.x, w.y);
          const wob = Math.sin(t * 1.6 * w.sp + w.ph) * 0.35;
          const vx = (dx - dy * wob) * speed * w.sp + fx * 18, vy = (dy + dx * wob) * speed * w.sp + fy * 18;
          w.x += vx * dt; w.y += vy * dt;
          w.pts.push([w.x, w.y]); if (w.pts.length > 34) w.pts.shift();
          if (w.pts.length % 6 === 0) w.rgb = colour(w.x, w.y);
          const fade = Math.min(1, w.life / 0.8, (w.max - w.life) / 1.2);
          const a = Math.max(0, fade) * 0.42 * k * (0.5 + 0.5 * p.strength);
          if (a > 0.01 && w.pts.length > 3) {
            const [r, g, b] = w.rgb;
            ctx.strokeStyle = `rgb(${r},${g},${b})`;
            for (let i = 1; i < w.pts.length; i++) {
              const q = i / w.pts.length;
              ctx.globalAlpha = a * q * q; ctx.lineWidth = w.w * (0.3 + q * 1.2);
              ctx.beginPath(); ctx.moveTo(w.pts[i - 1][0], w.pts[i - 1][1]); ctx.lineTo(w.pts[i][0], w.pts[i][1]); ctx.stroke();
            }
          }
          if (w.life > w.max || w.x < -200 || w.x > W + 200 || w.y < -200 || w.y > H + 200) Object.assign(w, newWisp(false));
        }
        for (const q of petals) {
          q.rot += q.vr * dt * (0.6 + gust);
          q.x += (dx * speed * 0.55 + Math.sin(t + q.ph) * 14) * dt; q.y += (dy * speed * 0.55 + Math.cos(t * 0.8 + q.ph) * 12 + 6) * dt;
          if (q.x < -60 || q.x > W + 60 || q.y < -60 || q.y > H + 60) Object.assign(q, newPetal(false));
          const ctx2 = q.s > 17 ? ctx : back; // big ones pass in front, small ones behind: depth
          ctx2.save(); ctx2.translate(q.x, q.y); ctx2.rotate(q.rot); ctx2.scale(1, 0.42 + 0.3 * Math.sin(q.rot * 2));
          // a soft petal of light: a tinted glow with a faint warm heart (never a hard white blob)
          ctx2.globalAlpha = 0.5 * k; ctx2.globalCompositeOperation = 'lighter';
          ctx2.drawImage(host.sprite(q.rgb, true), -q.s, -q.s, q.s * 2, q.s * 2);
          ctx2.globalAlpha = 0.22 * k; const c = q.s * 0.45; ctx2.drawImage(host.sprite(q.rgb), -c, -c, c * 2, c * 2);
          ctx2.restore();
        }
        ctx.globalAlpha = 1;
      },
      dispose() { host.wind.x = 0; host.wind.y = 0; wisps = []; petals = []; },
    };
  },
};
