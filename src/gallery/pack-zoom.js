// AE package · 穿越推進 Pass Through — we travel through the work into the next one.
export default {
  id: 'zoom', type: 'transition', version: 1,
  name: { zh: '穿越推進', en: 'Pass Through' },
  desc: { zh: '鏡頭穿過這一幅，進入下一幅', en: 'The camera passes through this work into the next' },
  params: [
    { id: 'depth', type: 'range', min: 1.4, max: 4, step: 0.1, default: 2.4, label: { zh: '穿越深度', en: 'Depth' } },
    { id: 'duration', type: 'range', min: 1, max: 3.5, step: 0.1, default: 2, unit: 's', label: { zh: '時間', en: 'Duration' } },
    { id: 'glow', type: 'toggle', default: true, label: { zh: '穿越時的光', en: 'Glow while passing' } },
  ],
  async run(o, h, p) {
    const { from, to } = o;
    to.style.opacity = '0';
    await h.animate(p.duration * 1000, (q) => {
      const e = h.ease.inOut(q);
      if (from) {
        from.style.transform = `scale(${1 + e * (p.depth - 1)})`;
        from.style.opacity = String(1 - h.ease.inOut(Math.min(1, q * 1.4)));
        from.style.filter = `blur(${e * 10}px) brightness(${1 + e * 0.5})`;
      }
      to.style.opacity = String(h.ease.out(Math.max(0, (q - 0.2) / 0.8)));
      to.style.transform = `scale(${0.55 + 0.45 * h.ease.out(q)})`;
      to.style.filter = `blur(${(1 - e) * 8}px)`;
      if (p.glow) o.fx.flash = Math.sin(Math.PI * q) * 0.4;
    });
  },
};
