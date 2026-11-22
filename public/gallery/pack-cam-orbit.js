// AE camera · 空拍環繞 Drone orbit — the camera circles the painting at an angle, as if flying around it.
export default {
  id: 'cam-orbit', type: 'camera', version: 1,
  name: { zh: '空拍環繞', en: 'Drone orbit' },
  desc: { zh: '像空拍機一樣，斜斜地繞著畫作飛', en: 'Like a drone, the camera circles the painting at an angle' },
  params: [
    { id: 'angle', type: 'range', min: 5, max: 40, step: 1, default: 22, unit: '°', label: { zh: '環繞角度', en: 'Orbit angle' } },
    { id: 'tilt', type: 'range', min: 0, max: 25, step: 1, default: 10, unit: '°', label: { zh: '俯角', en: 'Tilt' } },
    { id: 'turns', type: 'range', min: 0.5, max: 2, step: 0.25, default: 1, label: { zh: '繞幾圈', en: 'Sweeps' } },
    { id: 'distance', type: 'range', min: 0.75, max: 1.1, step: 0.01, default: 0.9, label: { zh: '距離', en: 'Distance' } },
  ],
  create(host, p) {
    return {
      set(np) { Object.assign(p, np); },
      pose(q) {
        const a = q * Math.PI * 2 * p.turns;
        const settle = Math.min(1, q / 0.12, (1 - q) / 0.12); // starts and ends facing the painting
        return { s: 1 + (p.distance - 1) * settle, x: 0.5, y: 0.5, pull: 0, ry: Math.sin(a) * p.angle * settle, rx: (p.tilt * 0.6 + Math.cos(a) * p.tilt * 0.4) * settle };
      },
    };
  },
};
