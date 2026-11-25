// AE package · 飛入 Fly-in — the next work glides in from any direction, the last one drifts away the other way.
export default {
  id: 'fly', type: 'transition', version: 1,
  name: { zh: '四方飛入', en: 'Fly-in' },
  desc: { zh: '下一幅從任一方向飄入，上一幅往反方向退去', en: 'The next work glides in from any direction; the last drifts away the other way' },
  params: [
    { id: 'from', type: 'choice', default: 'random', options: ['random', 'left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].map(id => ({ id, zh: { random: '隨機', left: '左', right: '右', top: '上', bottom: '下', 'top-left': '左上', 'top-right': '右上', 'bottom-left': '左下', 'bottom-right': '右下' }[id], en: id })), label: { zh: '從哪裡來', en: 'From' } },
    { id: 'duration', type: 'range', min: 0.8, max: 3.5, step: 0.1, default: 1.8, unit: 's', label: { zh: '時間', en: 'Duration' } },
    { id: 'depth', type: 'toggle', default: true, label: { zh: '帶景深（由遠而近）', en: 'With depth (far to near)' } },
  ],
  async run(o, h, p) {
    const { from, to, W, H } = o;
    const dirs = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1], 'top-left': [-1, -1], 'top-right': [1, -1], 'bottom-left': [-1, 1], 'bottom-right': [1, 1] };
    const keys = Object.keys(dirs);
    const [dx, dy] = dirs[p.from === 'random' || !dirs[p.from] ? keys[(Math.random() * keys.length) | 0] : p.from];
    const D = Math.hypot(W, H) * 0.55;
    to.style.opacity = '0';
    await h.animate(p.duration * 1000, (q) => {
      const e = h.ease.out(q), b = h.ease.inOut(q);
      const s = p.depth ? 0.78 + 0.22 * e : 1;
      to.style.opacity = String(Math.min(1, q * 1.6));
      to.style.transform = `translate(${(1 - e) * dx * D}px, ${(1 - e) * dy * D}px) scale(${s})`;
      to.style.filter = `blur(${(1 - e) * 8}px)`;
      if (from) {
        from.style.opacity = String(1 - b);
        from.style.transform = `translate(${-b * dx * D * 0.35}px, ${-b * dy * D * 0.35}px) scale(${1 - (p.depth ? b * 0.12 : 0)})`;
        from.style.filter = `blur(${b * 6}px)`;
      }
    });
  },
};
