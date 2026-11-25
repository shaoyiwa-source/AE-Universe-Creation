// AE package · 帷幕拉開 Curtain — like an opening night: the curtain parts from the centre to reveal the next work.
export default {
  id: 'curtain', type: 'transition', version: 1,
  name: { zh: '帷幕拉開', en: 'Curtain' },
  desc: { zh: '像首演之夜，帷幕從中間拉開，揭開下一幅', en: 'Like an opening night: the curtain parts to reveal the next work' },
  params: [
    { id: 'direction', type: 'choice', default: 'sides', options: [{ id: 'sides', zh: '向兩側', en: 'To the sides' }, { id: 'updown', zh: '向上下', en: 'Up and down' }], label: { zh: '拉開方向', en: 'Opening' } },
    { id: 'duration', type: 'range', min: 1, max: 4, step: 0.1, default: 2.2, unit: 's', label: { zh: '時間', en: 'Duration' } },
    { id: 'edge', type: 'range', min: 0, max: 60, step: 2, default: 24, unit: 'px', label: { zh: '邊緣柔和', en: 'Soft edge' } },
  ],
  async run(o, h, p) {
    const { from, to, W, H } = o;
    to.style.opacity = '1';
    if (!from) return;
    const deg = p.direction === 'updown' ? 180 : 90, L = p.direction === 'updown' ? H : W, ed = p.edge;
    await h.animate(p.duration * 1000, (q) => {
      const e = h.ease.inOut(q), half = (L / 2) * e;
      const a = L / 2 - half, b = L / 2 + half;
      // the old work stays everywhere except the opening gap in the middle
      h.setMask(from, `linear-gradient(${deg}deg, #000 0px, #000 ${Math.max(0, a - ed)}px, transparent ${a}px, transparent ${b}px, #000 ${Math.min(L, b + ed)}px, #000 ${L}px)`);
      from.style.filter = `brightness(${1 - e * 0.3})`;
      o.fx.flash = Math.sin(Math.PI * q) * 0.18;
    });
  },
};
