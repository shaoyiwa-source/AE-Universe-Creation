// AE package · 立體翻轉 3D Turn — the work turns in space like a precious panel and shows its other side: the next work.
export default {
  id: 'flip', type: 'transition', version: 1,
  name: { zh: '立體翻轉', en: '3D Turn' },
  desc: { zh: '畫作像一面珍貴的展板在空間中轉身', en: 'The work turns in space like a precious panel' },
  params: [
    { id: 'axis', type: 'choice', default: 'y', options: [{ id: 'y', zh: '左右翻轉', en: 'Turn sideways' }, { id: 'x', zh: '上下翻轉', en: 'Turn vertically' }], label: { zh: '方向', en: 'Axis' } },
    { id: 'duration', type: 'range', min: 1, max: 3.5, step: 0.1, default: 2, unit: 's', label: { zh: '時間', en: 'Duration' } },
  ],
  async run(o, h, p) {
    const { from, to } = o, rot = p.axis === 'x' ? 'rotateX' : 'rotateY';
    to.style.opacity = '0';
    await h.animate(p.duration * 1000, (q) => {
      const e = h.ease.inOut(q);
      const a = e * 180, lift = Math.sin(e * Math.PI);
      if (from) {
        from.style.opacity = a < 90 ? '1' : '0';
        from.style.transform = `perspective(1400px) translateZ(${-lift * 220}px) ${rot}(${a}deg)`;
        from.style.filter = `brightness(${1 - lift * 0.35})`;
      }
      to.style.opacity = a >= 90 || !from ? String(from ? 1 : e) : '0';
      to.style.transform = `perspective(1400px) translateZ(${-lift * 220}px) ${rot}(${a - 180}deg)`;
      to.style.filter = `brightness(${1 - lift * 0.35})`;
      o.fx.flash = lift * 0.12;
    });
  },
};
