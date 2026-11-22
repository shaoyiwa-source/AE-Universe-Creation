// AE package · LED 燈條 LED Strip — rows of glowing LEDs on the screen, like a real LED strip: rainbow flow, breathing,
// chasing, comet, twinkle, a sound meter; colours chosen by the client (rainbow, up to three own colours, the painting's
// colours, warm white, gold). With "sound" on, every clap, knock or beat flashes the strip and turns its colours.
// The stage can stay with the painting, dim it, or go fully dark for pure light art.
const TAU = Math.PI * 2;
const hsv = (h, s = 1, v = 1) => { // h 0…1
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};
const hex = (h) => [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16) || 0);
const mix = (a, b, f) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * f));

export default {
  id: 'led', type: 'effect', version: 1,
  name: { zh: 'LED 燈條', en: 'LED Strip' },
  desc: { zh: '像真正的 LED 燈條：七彩流動、呼吸、跑馬、流星、閃爍、聲音律動；顏色可自選，可跟著拍手與音樂閃', en: 'Like a real LED strip: rainbow flow, breathing, chase, comet, twinkle, sound meter; own colours; flashes with claps and music' },
  params: [
    { id: 'layout', type: 'choice', default: 'bottom', label: { zh: '燈條位置', en: 'Layout' }, options: [
      { id: 'bottom', zh: '底部一排', en: 'One row, bottom' }, { id: 'top', zh: '頂部一排', en: 'One row, top' },
      { id: 'both', zh: '上下兩排', en: 'Top and bottom' }, { id: 'sides', zh: '左右兩條', en: 'Left and right' },
      { id: 'frame', zh: '圍成一圈', en: 'All around' }, { id: 'middle', zh: '橫過中央', en: 'Across the middle' },
      { id: 'rows', zh: '多排（燈牆）', en: 'Many rows (light wall)' } ] },
    { id: 'around', type: 'choice', default: 'screen', label: { zh: '圍繞', en: 'Around' }, options: [{ id: 'screen', zh: '整個螢幕', en: 'The whole screen' }, { id: 'work', zh: '畫作', en: 'The work' }] },
    { id: 'pattern', type: 'choice', default: 'rainbow', label: { zh: '燈光模式', en: 'Pattern' }, options: [
      { id: 'rainbow', zh: '流動', en: 'Flow' }, { id: 'breathe', zh: '呼吸', en: 'Breathe' }, { id: 'chase', zh: '跑馬燈', en: 'Chase' },
      { id: 'comet', zh: '流星', en: 'Comet' }, { id: 'twinkle', zh: '星光閃爍', en: 'Twinkle' }, { id: 'meter', zh: '聲音律動', en: 'Sound meter' },
      { id: 'solid', zh: '恆亮', en: 'Steady' } ] },
    { id: 'colors', type: 'choice', default: 'rainbow', label: { zh: '顏色', en: 'Colours' }, options: [
      { id: 'rainbow', zh: '七彩', en: 'Rainbow' }, { id: 'own', zh: '自選顏色', en: 'My colours' }, { id: 'painting', zh: '畫作的顏色', en: 'From the painting' },
      { id: 'warm', zh: '暖白', en: 'Warm white' }, { id: 'gold', zh: '香檳金', en: 'Champagne gold' } ] },
    { id: 'c1', type: 'color', default: '#ff3d7f', label: { zh: '顏色一', en: 'Colour 1' } },
    { id: 'c2', type: 'color', default: '#3db8ff', label: { zh: '顏色二', en: 'Colour 2' } },
    { id: 'c3', type: 'color', default: '#ffd23d', label: { zh: '顏色三', en: 'Colour 3' } },
    { id: 'count', type: 'range', min: 12, max: 160, step: 1, default: 60, label: { zh: '每排燈數', en: 'LEDs per row' } },
    { id: 'size', type: 'range', min: 2, max: 16, step: 1, default: 6, unit: 'px', label: { zh: '燈珠大小', en: 'LED size' } },
    { id: 'glow', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6, label: { zh: '光暈', en: 'Glow' } },
    { id: 'speed', type: 'range', min: 0.1, max: 3, step: 0.1, default: 1, label: { zh: '速度', en: 'Speed' } },
    { id: 'bright', type: 'range', min: 0.1, max: 1, step: 0.05, default: 0.85, label: { zh: '亮度', en: 'Brightness' } },
    { id: 'sound', type: 'toggle', default: true, label: { zh: '跟著聲音閃（拍手、音樂）', en: 'Flash with sound (claps, music)' } },
    { id: 'stage', type: 'choice', default: 'with', label: { zh: '畫作', en: 'The work' }, options: [{ id: 'with', zh: '和燈光一起', en: 'With the lights' }, { id: 'dim', zh: '調暗', en: 'Dimmed' }, { id: 'dark', zh: '只有燈光（黑幕）', en: 'Lights only (dark stage)' }] },
  ],
  create(host, p) {
    let t = 0, shift = 0, flashT = -9, hitsSeen = null, lastCount = null, level = 0, rng = 1;
    const tw = Array.from({ length: 2000 }, () => { rng = (rng * 16807) % 2147483647; return rng / 2147483647; }); // fixed twinkle phases
    const palette = (x) => { // x 0…1 around the colour wheel of the chosen colours
      x = ((x % 1) + 1) % 1;
      if (p.colors === 'rainbow') return hsv(x);
      if (p.colors === 'warm') return mix([255, 214, 160], [255, 240, 214], 0.5 + 0.5 * Math.sin(x * TAU));
      if (p.colors === 'gold') return mix([236, 205, 140], [255, 232, 180], 0.5 + 0.5 * Math.sin(x * TAU));
      const cs = p.colors === 'painting' ? host.palette.slice(0, 4) : [hex(p.c1), hex(p.c2), hex(p.c3)];
      const n = cs.length, f = x * n, i = Math.floor(f) % n;
      return mix(cs[i], cs[(i + 1) % n], f - Math.floor(f));
    };
    // where the LEDs are: a list of strips, each a list of [x, y]
    const strips = () => {
      const r = p.around === 'work' && host.rect ? host.rect : { x: 0, y: 0, w: host.W, h: host.H };
      const m = p.around === 'work' ? -Math.max(10, p.size * 2.5) : Math.max(12, p.size * 2.5), n = Math.round(p.count);
      const X0 = r.x + m, X1 = r.x + r.w - m, Y0 = r.y + m, Y1 = r.y + r.h - m;
      const line = (ax, ay, bx, by, k = n) => Array.from({ length: k }, (_, i) => { const f = k === 1 ? 0.5 : i / (k - 1); return [ax + (bx - ax) * f, ay + (by - ay) * f]; });
      const vn = Math.max(6, Math.round(n * (Y1 - Y0) / Math.max(1, X1 - X0)));
      switch (p.layout) {
        case 'top': return [line(X0, Y0, X1, Y0)];
        case 'both': return [line(X0, Y0, X1, Y0), line(X0, Y1, X1, Y1)];
        case 'sides': return [line(X0, Y1, X0, Y0, vn), line(X1, Y1, X1, Y0, vn)];
        case 'middle': return [line(X0, (Y0 + Y1) / 2, X1, (Y0 + Y1) / 2)];
        case 'rows': { const rows = Math.max(3, Math.min(12, Math.round(vn / 3))); return Array.from({ length: rows }, (_, j) => line(X0, Y0 + (Y1 - Y0) * (j / (rows - 1)), X1, Y0 + (Y1 - Y0) * (j / (rows - 1)))); }
        case 'frame': { // one continuous strip around: bottom left → right, up, top right → left, down
          const per = 2 * (X1 - X0) + 2 * (Y1 - Y0), k = Math.max(16, Math.round(n * per / Math.max(1, X1 - X0)));
          return [Array.from({ length: k }, (_, i) => {
            let d = (i / k) * per;
            if (d < X1 - X0) return [X0 + d, Y1]; d -= X1 - X0;
            if (d < Y1 - Y0) return [X1, Y1 - d]; d -= Y1 - Y0;
            if (d < X1 - X0) return [X1 - d, Y0]; d -= X1 - X0;
            return [X0, Y0 + d];
          })];
        }
        default: return [line(X0, Y1, X1, Y1)];
      }
    };
    let S = null, key = '';
    return {
      set(np) { Object.assign(p, np); },
      frame(dt, k) {
        t += dt * p.speed;
        const r = host.rect; if (!r) return;
        const kk = [p.layout, p.around, p.count, p.size, host.W, host.H, r.x, r.y, r.w, r.h].join();
        if (kk !== key) { S = strips(); key = kk; }
        // sound: every clap / knock / beat flashes the strip and turns its colours
        let pulse = 0;
        if (p.sound) {
          const b = host.beat() || {};
          if (b.hits == null) hitsSeen = null; else if (hitsSeen !== null && b.hits < hitsSeen) hitsSeen = b.hits;
          if (b.hits != null) { if (hitsSeen === null) hitsSeen = b.hits; if (b.hits > hitsSeen) { hitsSeen = b.hits; flashT = t; shift += 0.17; host.ledHits = (host.ledHits || 0) + 1; } }
          if (b.live && b.count != null) { if (lastCount !== null && b.count > lastCount) { flashT = t; shift += 0.08; } lastCount = b.count; }
          pulse = Math.max(Math.exp(-Math.max(0, t - flashT) / (0.12 * p.speed)), b.live ? (b.pulse || 0) * 0.6 : 0);
          level = Math.max(b.energy ?? b.level ?? pulse, level * Math.pow(0.2, dt));
        }
        const ctx = host.front;
        ctx.save();
        // the stage: with the painting, dimmed, or dark (pure light art)
        if (p.stage !== 'with') { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(0,0,0,${(p.stage === 'dark' ? 1 : 0.6) * k})`; ctx.fillRect(0, 0, host.W, host.H); }
        ctx.globalCompositeOperation = 'lighter';
        const sz = p.size, halo = sz * (2 + p.glow * 7);
        S.forEach((leds, si) => {
          const n = leds.length;
          leds.forEach(([x, y], i) => {
            const u = i / n; let col, v;
            switch (p.pattern) {
              case 'breathe': col = palette(t * 0.05 + shift + si * 0.1); v = 0.12 + 0.88 * (0.5 - 0.5 * Math.cos(t * TAU / 4)); break;
              case 'chase': { const step = Math.floor(t * 8); col = palette(Math.floor((i + step) / 4) * 0.13 + shift); v = (i + step) % 4 === 0 ? 1 : 0.1; break; }
              case 'comet': { const head = (t * 0.35 + si * 0.5) % 1, d = ((head - u) % 1 + 1) % 1; col = palette(head + shift); v = d < 0.25 ? Math.pow(1 - d / 0.25, 2) : 0.04; break; }
              case 'twinkle': { const ph = tw[(i + si * 211) % tw.length]; col = palette(ph + shift); v = 0.08 + 0.92 * Math.pow(Math.max(0, Math.sin(t * (1.2 + ph * 2.4) + ph * 40)), 8); break; }
              case 'meter': { const lit = Math.min(1, level * 1.4 + pulse * 0.3), d = Math.abs(u - 0.5) * 2; col = palette(d * 0.4 + shift); v = d <= lit ? 1 : 0.05; break; }
              case 'solid': col = palette(u + shift); v = 1; break;
              default: col = palette(u * 1.5 - t * 0.12 + shift); v = 1; // flowing rainbow
            }
            v = Math.min(1, v * (0.75 + 0.6 * pulse)) * p.bright * k;
            if (v < 0.01) return;
            if (p.glow > 0) { ctx.globalAlpha = v * (0.35 + 0.4 * pulse); ctx.drawImage(host.sprite(col), x - halo / 2, y - halo / 2, halo, halo); }
            ctx.globalAlpha = v; ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
            ctx.beginPath(); ctx.arc(x, y, sz / 2, 0, TAU); ctx.fill();
            ctx.globalAlpha = v * 0.8; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, sz * 0.18, 0, TAU); ctx.fill(); // the hot centre of a real LED
          });
        });
        ctx.restore();
      },
    };
  },
};
