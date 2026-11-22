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
    // one ready-made image per LED colour (glow + lens + hot centre): one draw per LED, however big the wall
    const sprites = new Map();
    const spriteFor = (col, sz, glow) => {
      const q = col.map(c => Math.min(255, Math.round(c / 17) * 17)), key = q.join() + '|' + sz.toFixed(1) + '|' + glow.toFixed(2);
      let sp = sprites.get(key); if (sp) return sp;
      if (sprites.size > 600) sprites.clear();
      const halo = Math.max(sz, sz * (1 + glow * 4)), dim = Math.ceil(halo * 2 + 2), c = document.createElement('canvas');
      const px = Math.min(2, window.devicePixelRatio || 1); c.width = c.height = Math.ceil(dim * px); // sharp on high-density screens
      const x = c.getContext('2d'), m = dim / 2, [r, g, b] = q; x.scale(px, px);
      if (glow > 0) { const gr = x.createRadialGradient(m, m, sz * 0.3, m, m, halo); gr.addColorStop(0, `rgba(${r},${g},${b},${0.55 * glow + 0.15})`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`); x.fillStyle = gr; x.fillRect(0, 0, dim, dim); }
      x.fillStyle = `rgb(${r},${g},${b})`; x.beginPath(); x.arc(m, m, sz / 2, 0, TAU); x.fill();
      x.globalAlpha = 0.8; x.fillStyle = '#fff'; x.beginPath(); x.arc(m, m, sz * 0.18, 0, TAU); x.fill(); // the hot centre of a real LED
      sp = { c, dim }; sprites.set(key, sp); return sp;
    };
    // where the LEDs are: strips of { x, y, m } — m is the position for the sound meter (0 = where it starts to grow)
    const strips = () => {
      const W = host.W, H = host.H, lowP = (host.alive && host.alive.quality < 1);
      const MAX = Math.round(Math.max(240, Math.min(1500, (W * H) / 700)) * (lowP ? 0.5 : 1)); // a budget by screen size, so phones and TVs stay smooth
      let r = { x: 0, y: 0, w: W, h: H };
      if (p.around === 'work' && host.rect) {
        r = { ...host.rect };
        const cp = host.camPose; // follow the camera's framing of the work (zoom and drift)
        if (cp && cp.s) { const cx = r.x + r.w / 2, cy = r.y + r.h / 2; r = { x: cx - (r.w / 2) * cp.s + (cp.tx || 0), y: cy - (r.h / 2) * cp.s + (cp.ty || 0), w: r.w * cp.s, h: r.h * cp.s }; }
      }
      const n = Math.max(2, Math.round(p.count));
      const g = p.around === 'work' ? -Math.max(8, p.size * 1.5) : Math.max(12, p.size * 2.5), e = Math.max(4, p.size); // outside the work, inside the screen
      const X0 = Math.max(e, r.x + g), X1 = Math.min(W - e, r.x + r.w - g), Y0 = Math.max(e, r.y + g), Y1 = Math.min(H - e, r.y + r.h - g);
      const sp = (X1 - X0) / (n - 1); // LEDs keep the same spacing in every direction, like a real strip
      const line = (ax, ay, bx, by, k, meter) => Array.from({ length: k }, (_, i) => { const f = k === 1 ? 0.5 : i / (k - 1); return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, m: meter(f) }; });
      const mid = (f) => Math.abs(f - 0.5) * 2, up = (f) => f;
      const vn = Math.max(2, Math.round((Y1 - Y0) / Math.max(1, sp)) + 1);
      let out;
      switch (p.layout) {
        case 'top': out = [line(X0, Y0, X1, Y0, n, mid)]; break;
        case 'both': out = [line(X0, Y0, X1, Y0, n, mid), line(X0, Y1, X1, Y1, n, mid)]; break;
        case 'sides': out = [line(X0, Y1, X0, Y0, vn, up), line(X1, Y1, X1, Y0, vn, up)]; break; // the meter grows from the floor up
        case 'middle': out = [line(X0, (Y0 + Y1) / 2, X1, (Y0 + Y1) / 2, n, mid)]; break;
        case 'rows': { // an even grid over the whole area; over budget, the LEDs spread further apart (still a full wall)
          const spW = Math.max(sp, Math.sqrt(Math.max(1, (X1 - X0) * (Y1 - Y0)) / MAX));
          const cols = Math.max(2, Math.round((X1 - X0) / spW) + 1), rows = Math.max(2, Math.round((Y1 - Y0) / spW) + 1);
          out = Array.from({ length: rows }, (_, j) => { const y = Y0 + (Y1 - Y0) * j / (rows - 1); return line(X0, y, X1, y, cols, mid); });
          return { strips: out, spacing: Math.max(1, Math.min((X1 - X0) / (cols - 1), (Y1 - Y0) / (rows - 1))) };
        }
        case 'frame': { // one strip all around with an LED on every corner; the meter grows from the bottom centre both ways
          const side = Math.max(0, vn - 2), L = [];
          for (let i = 0; i < n; i++) L.push({ x: X0 + (X1 - X0) * i / (n - 1), y: Y1 });
          for (let i = 1; i <= side; i++) L.push({ x: X1, y: Y1 - (Y1 - Y0) * i / (side + 1) });
          for (let i = 0; i < n; i++) L.push({ x: X1 - (X1 - X0) * i / (n - 1), y: Y0 });
          for (let i = 1; i <= side; i++) L.push({ x: X0, y: Y0 + (Y1 - Y0) * i / (side + 1) });
          const per = 2 * (X1 - X0) + 2 * (Y1 - Y0);
          const pos = (q) => { if (q.y === Y1) return Math.abs(q.x - (X0 + X1) / 2); if (q.y === Y0) return (X1 - X0) / 2 + (Y1 - Y0) + Math.abs((X0 + X1) / 2 - q.x); return (X1 - X0) / 2 + (Y1 - q.y); };
          out = [L.map(q => ({ ...q, m: Math.min(1, pos(q) / (per / 2)) }))]; break;
        }
        default: out = [line(X0, Y1, X1, Y1, n, mid)];
      }
      // never more than the budget (a very long frame on a big screen)
      const total = out.reduce((a, l) => a + l.length, 0);
      if (total > MAX) { const step = Math.ceil(total / MAX); out = out.map(l => l.filter((_, i) => i % step === 0)); }
      return { strips: out, spacing: Math.max(1, sp) };
    };
    let S = null, key = '';
    return {
      set(np) { Object.assign(p, np); },
      frame(dt, k) {
        t += dt * p.speed;
        const r = host.rect; if (!r) return;
        const cp = p.around === 'work' ? host.camPose : null;
        const kk = [p.layout, p.around, p.count, p.size, host.W, host.H, r.x, r.y, r.w, r.h, host.alive && host.alive.quality, cp ? [cp.s, cp.tx, cp.ty].join(':') : ''].join();
        if (kk !== key) { S = strips(); key = kk; }
        // sound: every clap / knock / beat flashes the strip and turns its colours
        let pulse = 0;
        const b = p.sound ? (host.beat() || {}) : {};
        if (!p.sound || b.hits == null) hitsSeen = null; else if (hitsSeen !== null && b.hits < hitsSeen) hitsSeen = b.hits;
        if (p.sound) {
          if (b.hits != null) {
            if (hitsSeen === null) hitsSeen = b.hits;
            if (b.hits > hitsSeen) { hitsSeen = b.hits; flashT = t; shift += 0.17; if (b.hits > (host.ledFlashed || 0)) { host.ledFlashed = b.hits; host.ledHits = (host.ledHits || 0) + 1; } }
          }
          if (b.live && b.count != null) { if (lastCount !== null && b.count > lastCount) { flashT = t; shift += 0.08; } lastCount = b.count; }
          pulse = Math.max(Math.exp(-Math.max(0, t - flashT) / (0.12 * p.speed)), b.live ? (b.pulse || 0) * 0.6 : 0);
          level = Math.max(b.energy ?? b.level ?? 0, pulse * 0.6, level * Math.pow(0.2, dt));
        }
        // screen-fixed: the camera never moves the strips (those around the work follow its framing above)
        const ctx = host.overlay || host.front;
        ctx.save();
        // the stage: with the painting, dimmed, or lights only (the player hides the painting, title, Lumi and sparkles)
        if (p.stage === 'dark') host.lightsOnly = Math.max(host.lightsOnly || 0, k);
        if (p.stage === 'dim') { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(0,0,0,${0.6 * k})`; ctx.fillRect(0, 0, host.W, host.H); }
        ctx.globalCompositeOperation = 'lighter';
        const sz = Math.max(1.5, Math.min(p.size, S.spacing * 0.8)); // an LED is never bigger than the gap to the next one
        const glow = (host.alive && host.alive.quality < 1) ? p.glow * 0.5 : p.glow;
        S.strips.forEach((leds, si) => {
          const n = leds.length;
          leds.forEach((L, i) => {
            const u = i / n; let col, v;
            switch (p.pattern) {
              case 'breathe': col = palette(t * 0.05 + shift + si * 0.1); v = 0.12 + 0.88 * (0.5 - 0.5 * Math.cos(t * TAU / 4)); break;
              case 'chase': { const step = Math.floor(t * 8); col = palette(Math.floor((i + step) / 4) * 0.13 + shift); v = (i + step) % 4 === 0 ? 1 : 0.1; break; }
              case 'comet': { const head = (t * 0.35 + si * 0.5) % 1, d = ((head - u) % 1 + 1) % 1; col = palette(head + shift); v = d < 0.25 ? Math.pow(1 - d / 0.25, 2) : 0.04; break; }
              case 'twinkle': { const ph = tw[(i + si * 211) % tw.length]; col = palette(ph + shift); v = 0.08 + 0.92 * Math.pow(Math.max(0, Math.sin(t * (1.2 + ph * 2.4) + ph * 40)), 8); break; }
              case 'meter': { const lit = Math.min(1, level * 1.4); col = palette(L.m * 0.4 + shift); v = L.m <= lit ? 1 : 0.05; break; }
              case 'solid': col = palette(u + shift); v = 1; break;
              default: col = palette(u * 1.5 - t * 0.12 + shift); v = 1; // flowing rainbow
            }
            v = Math.min(1, v * (0.75 + 0.6 * pulse)) * p.bright * k;
            if (v < 0.01) return;
            const sp = spriteFor(col, sz, glow);
            ctx.globalAlpha = v; ctx.drawImage(sp.c, L.x - sp.dim / 2, L.y - sp.dim / 2, sp.dim, sp.dim);
          });
        });
        ctx.restore();
      },
    };
  },
};
