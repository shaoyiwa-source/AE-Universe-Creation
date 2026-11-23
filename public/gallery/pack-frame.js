// AE package · 美術館畫框 Gallery Frame — the work hangs as a real, precious object: a gilded (or black, walnut, white)
// frame with a bevel catching the light, a soft shadow on the wall, and a warm gallery light washing the wall behind it.
// The wash breathes with the music. Drawn on the light layer that moves with the camera, so the frame tilts with the
// work in 3D moves. The painting itself is never covered.
export default {
  id: 'frame', type: 'effect', version: 1,
  name: { zh: '美術館畫框', en: 'Gallery Frame' },
  desc: { zh: '像真的掛在美術館：金箔畫框、斜面反光、牆上的陰影與暖光，隨音樂呼吸', en: 'Hung like a museum piece: gilded frame, bevel light, wall shadow and a warm wash breathing with the music' },
  params: [
    { id: 'style', type: 'choice', default: 'gold', label: { zh: '畫框', en: 'Frame' }, options: [
      { id: 'gold', zh: '金箔', en: 'Gilded' }, { id: 'black', zh: '黑漆', en: 'Black lacquer' }, { id: 'walnut', zh: '胡桃木', en: 'Walnut' }, { id: 'white', zh: '白色浮框', en: 'White float' } ] },
    { id: 'width', type: 'range', min: 0.01, max: 0.06, step: 0.002, default: 0.028, label: { zh: '框寬', en: 'Width' } },
    { id: 'wash', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55, label: { zh: '牆面暖光', en: 'Wall light' } },
    { id: 'music', type: 'toggle', default: true, label: { zh: '暖光隨音樂呼吸', en: 'Light breathes with the music' } },
  ],
  create(host, p) {
    let t = 0, pulse = 0, lastCount = null;
    const STY = {
      gold: [[110, 72, 22], [246, 214, 140], [168, 118, 42], [250, 230, 170], [120, 80, 26]],
      black: [[12, 12, 14], [70, 70, 76], [20, 20, 24], [96, 96, 104], [10, 10, 12]],
      walnut: [[58, 34, 18], [150, 100, 62], [84, 50, 26], [170, 120, 78], [52, 30, 16]],
      white: [[214, 210, 200], [255, 253, 248], [228, 224, 214], [255, 255, 255], [206, 202, 192]],
    };
    const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    return {
      set(np) { Object.assign(p, np); },
      frame(dt, k) {
        t += dt;
        const r = host.rect; if (!r || !host.W) return;
        if (p.music) {
          const b = host.beat() || {};
          if (b.live && b.count != null) { if (lastCount !== null && b.count > lastCount) pulse = 1; lastCount = b.count; }
          pulse = Math.max(pulse * Math.pow(0.12, dt), b.live ? (b.pulse || 0) * 0.7 : 0);
        } else pulse *= Math.pow(0.12, dt);
        const fw = Math.max(6, Math.min(r.w, r.h) * p.width), c = STY[p.style] || STY.gold;
        const X = r.x - fw, Y = r.y - fw, Wd = r.w + fw * 2, Hd = r.h + fw * 2;
        // the wall behind: a warm gallery light (wide, soft) and the frame's shadow — on the far layer
        const back = host.back; back.save();
        if (p.wash > 0) {
          const cx = r.x + r.w / 2, cy = r.y + r.h * 0.42, R = Math.max(r.w, r.h) * (0.95 + 0.08 * pulse);
          const g = back.createRadialGradient(cx, cy, R * 0.25, cx, cy, R);
          const a = (0.16 + 0.14 * pulse) * p.wash * k;
          g.addColorStop(0, `rgba(255,214,150,${a})`); g.addColorStop(0.55, `rgba(240,180,110,${a * 0.45})`); g.addColorStop(1, 'rgba(240,180,110,0)');
          back.globalCompositeOperation = 'lighter'; back.fillStyle = g; back.fillRect(cx - R, cy - R, R * 2, R * 2);
        }
        back.globalCompositeOperation = 'source-over'; back.shadowColor = `rgba(0,0,0,${0.55 * k})`; back.shadowBlur = fw * 2.4; back.shadowOffsetY = fw * 0.9;
        back.fillStyle = `rgba(0,0,0,${0.35 * k})`; back.fillRect(X, Y, Wd, Hd);
        back.restore();
        // the frame itself, on the near layer (around the painting, never over it)
        const f = host.front; f.save(); f.globalAlpha = k; f.globalCompositeOperation = 'source-over';
        f.beginPath(); f.rect(X, Y, Wd, Hd); f.rect(r.x, r.y, r.w, r.h); f.clip('evenodd');
        const lg = f.createLinearGradient(X, Y, X + Wd, Y + Hd); // light from the upper left, like a gallery spot
        c.forEach((col, i) => lg.addColorStop(i / (c.length - 1), rgb(col)));
        f.fillStyle = lg; f.fillRect(X, Y, Wd, Hd);
        // bevel: the outer edge catches the light on top/left, falls into shadow bottom/right; a thin inner lip
        const edge = (x0, y0, x1, y1, x2, y2, x3, y3, col) => { f.beginPath(); f.moveTo(x0, y0); f.lineTo(x1, y1); f.lineTo(x2, y2); f.lineTo(x3, y3); f.closePath(); f.fillStyle = col; f.fill(); };
        const b2 = fw * 0.38;
        edge(X, Y, X + Wd, Y, X + Wd - b2, Y + b2, X + b2, Y + b2, `rgba(255,255,255,${p.style === 'black' ? 0.18 : 0.34})`);
        edge(X, Y, X + b2, Y + b2, X + b2, Y + Hd - b2, X, Y + Hd, `rgba(255,255,255,${p.style === 'black' ? 0.12 : 0.22})`);
        edge(X, Y + Hd, X + b2, Y + Hd - b2, X + Wd - b2, Y + Hd - b2, X + Wd, Y + Hd, 'rgba(0,0,0,0.34)');
        edge(X + Wd, Y, X + Wd, Y + Hd, X + Wd - b2, Y + Hd - b2, X + Wd - b2, Y + b2, 'rgba(0,0,0,0.26)');
        f.strokeStyle = 'rgba(0,0,0,0.55)'; f.lineWidth = Math.max(1, fw * 0.08); f.strokeRect(r.x - f.lineWidth / 2, r.y - f.lineWidth / 2, r.w + f.lineWidth, r.h + f.lineWidth);
        // a slow glint travelling along the gilding (gold only), brighter on the beat
        if (p.style === 'gold') {
          const s = ((t * 0.07) % 1.3) - 0.15, gx = X + Wd * s, gw = Wd * 0.18;
          const sg = f.createLinearGradient(gx - gw, Y, gx + gw, Y + Hd * 0.25);
          const ga = 0.28 + 0.25 * pulse;
          sg.addColorStop(0, 'rgba(255,248,220,0)'); sg.addColorStop(0.5, `rgba(255,248,220,${ga})`); sg.addColorStop(1, 'rgba(255,248,220,0)');
          f.globalCompositeOperation = 'lighter'; f.fillStyle = sg; f.fillRect(X, Y, Wd, Hd);
        }
        f.restore();
      },
    };
  },
};
