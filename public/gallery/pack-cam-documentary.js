// AE camera · 斜角紀錄 Documentary angle — we arrive from the side, at an angle; the camera turns to face the
// painting and moves in on its heart, like the opening of a film.
export default {
  id: 'cam-documentary', type: 'camera', version: 1,
  name: { zh: '斜角紀錄', en: 'Documentary angle' },
  desc: { zh: '電影開場的視角：從側面斜看，慢慢轉正，再推近畫的核心', en: 'A film opening: from the side, turning to face the work, moving in on its heart' },
  params: [
    { id: 'side', type: 'choice', default: 'left', options: [{ id: 'left', zh: '從左側', en: 'From the left' }, { id: 'right', zh: '從右側', en: 'From the right' }], label: { zh: '從哪一側', en: 'Side' } },
    { id: 'angle', type: 'range', min: 10, max: 45, step: 1, default: 30, unit: '°', label: { zh: '斜看角度', en: 'Angle' } },
    { id: 'zoom', type: 'range', min: 1, max: 2.6, step: 0.05, default: 1.5, label: { zh: '最後靠近的倍數', en: 'Final closeness' } },
  ],
  create(host, p) {
    const f = host.focalPoints(1)[0] || [0.5, 0.5];
    const ease = (q) => q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
    return {
      set(np) { Object.assign(p, np); },
      pose(q) {
        const turn = ease(Math.min(1, q / 0.55)), push = ease(Math.max(0, (q - 0.45) / 0.55));
        const sgn = p.side === 'right' ? -1 : 1;
        return { s: 0.86 + 0.14 * turn + (p.zoom - 1) * push, x: f[0], y: f[1], pull: push, ry: sgn * p.angle * (1 - turn), rx: 6 * (1 - turn) };
      },
    };
  },
};
