// AE camera · 由遠而近 From afar — 一花一世界: seen from afar it is one painting; come close and another world opens.
export default {
  id: 'cam-approach', type: 'camera', version: 1,
  name: { zh: '由遠而近', en: 'From afar, then closer' },
  desc: { zh: '一花一世界：遠看是一幅畫，走近是另一個世界', en: 'Seen from afar it is one painting; up close, another world' },
  params: [
    { id: 'from', type: 'range', min: 0.5, max: 0.95, step: 0.01, default: 0.66, label: { zh: '起始距離（越小越遠）', en: 'Start distance (smaller = farther)' } },
    { id: 'zoom', type: 'range', min: 1, max: 3, step: 0.05, default: 1.8, label: { zh: '最後靠近的倍數', en: 'Final closeness' } },
    { id: 'whole', type: 'range', min: 0.1, max: 0.6, step: 0.05, default: 0.35, label: { zh: '先看全貌的時間比例', en: 'Time spent on the whole' } },
  ],
  create(host, p) {
    const f = host.focalPoints(1)[0] || [0.5, 0.5];
    const ease = (q) => q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
    return {
      set(np) { Object.assign(p, np); },
      pose(q) {
        // 0 → whole: approach from far to the full painting; whole → 1: move in towards its richest place
        if (q < p.whole) { const e = ease(q / p.whole); return { s: p.from + (1 - p.from) * e, x: 0.5, y: 0.5, pull: 0 }; }
        const e = ease((q - p.whole) / (1 - p.whole));
        return { s: 1 + (p.zoom - 1) * e, x: f[0], y: f[1], pull: e };
      },
    };
  },
};
