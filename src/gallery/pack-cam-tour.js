// AE camera · 細節巡禮 Detail tour — like a documentary: the whole, then a slow glide between the painting's
// richest places (the brushwork, the texture of the paint), then back to the whole.
export default {
  id: 'cam-tour', type: 'camera', version: 1,
  name: { zh: '細節巡禮', en: 'Detail tour' },
  desc: { zh: '紀錄片的運鏡：全貌、緩緩滑過最精彩的筆觸與顏料紋理、再回到全貌', en: 'Documentary style: the whole, a glide over the richest brushwork, back to the whole' },
  params: [
    { id: 'stops', type: 'range', min: 1, max: 4, step: 1, default: 3, label: { zh: '停留的細節數', en: 'Details visited' } },
    { id: 'zoom', type: 'range', min: 1.2, max: 3, step: 0.05, default: 1.9, label: { zh: '靠近倍數', en: 'Closeness' } },
  ],
  create(host, p) {
    let pts = host.focalPoints(4);
    const ease = (q) => q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
    return {
      set(np) { Object.assign(p, np); },
      pose(q) {
        const n = Math.max(1, Math.min(pts.length, Math.round(p.stops))); if (!pts.length) pts = [[0.5, 0.5]];
        // whole (12%) → detail 1 → … → detail n → whole (last 15%)
        if (q < 0.12) return { s: 1, x: 0.5, y: 0.5, pull: 0 };
        if (q > 0.85) { const e = ease((q - 0.85) / 0.15), a = pts[n - 1]; return { s: p.zoom + (1 - p.zoom) * e, x: a[0], y: a[1], pull: 1 - e }; }
        const u = (q - 0.12) / 0.73 * n, i = Math.min(n - 1, Math.floor(u)), w = u - i;
        const a = i === 0 ? [0.5, 0.5] : pts[i - 1], b = pts[i];
        const e = ease(Math.min(1, w / 0.55)); // glide 55% of the segment, then rest on the detail
        const s = i === 0 ? 1 + (p.zoom - 1) * e : p.zoom;
        return { s, x: a[0] + (b[0] - a[0]) * e, y: a[1] + (b[1] - a[1]) * e, pull: i === 0 ? e : 1 };
      },
    };
  },
};
