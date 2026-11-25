// AE camera · 全局凝視 Gaze — for works that must be seen whole: the gentlest breathing of distance, nothing more.
export default {
  id: 'cam-gaze', type: 'camera', version: 1,
  name: { zh: '全局凝視', en: 'Gaze on the whole' },
  desc: { zh: '適合要看全貌的作品：只有最輕微的遠近呼吸', en: 'For works seen whole: only the gentlest breathing of distance' },
  params: [
    { id: 'depth', type: 'range', min: 0.01, max: 0.12, step: 0.01, default: 0.05, label: { zh: '呼吸幅度', en: 'Breathing' } },
  ],
  create(host, p) {
    return { set(np) { Object.assign(p, np); }, pose(q) { return { s: 1 - p.depth + p.depth * (0.5 - 0.5 * Math.cos(q * Math.PI * 2)), x: 0.5, y: 0.5, pull: 0 }; } };
  },
};
