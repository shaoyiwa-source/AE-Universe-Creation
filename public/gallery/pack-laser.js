// AE package · 雷射光 Prism Laser — ported from the homepage sound & light show (盛明聲光展演系統):
// beams come in from beyond the frame and land ON the painting; on every kick streak-lasers fly in, gold sparks
// mark the hits and a sun glow breathes with the bass. With the show's own track the lights follow its measured
// beats: a few flickering beams while it builds, and at the drop every beam converges on the painting's sun.
// Additions for the player: colours can come from the painting, and the hit lights the painted surface.
export default {
  id: 'laser', type: 'effect', version: 2,
  name: { zh: '雷射光', en: 'Prism Laser' },
  desc: { zh: '光束從畫框外打在畫上、照亮落點、折射出稜鏡光；跟著鼓點飛入流星雷射，高潮時全部匯聚到畫的中心', en: 'Beams land on the painting and light it; streaks fly in on the beat, and at the drop all beams converge on its heart' },
  params: [
    { id: 'beams', type: 'range', min: 2, max: 8, step: 1, default: 6, label: { zh: '光束數量', en: 'Beams' } },
    { id: 'power', type: 'range', min: 0.2, max: 1, step: 0.05, default: 0.85, label: { zh: '亮度', en: 'Power' } },
    { id: 'colors', type: 'choice', default: 'prism', options: [{ id: 'prism', zh: '彩虹稜鏡（首頁原色）', en: 'Prism (homepage)' }, { id: 'painting', zh: '畫作的顏色', en: 'From the painting' }, { id: 'gold', zh: '香檳金', en: 'Champagne gold' }], label: { zh: '顏色', en: 'Colours' } },
    { id: 'sync', type: 'choice', default: 'music', options: [{ id: 'music', zh: '跟著音樂', en: 'With the music' }, { id: 'tempo', zh: '固定節拍', en: 'Fixed tempo' }], label: { zh: '節奏', en: 'Rhythm' } },
    { id: 'bpm', type: 'range', min: 60, max: 160, step: 1, default: 148, label: { zh: '節拍（BPM）', en: 'Tempo (BPM)' } },
    { id: 'bolts', type: 'toggle', default: true, label: { zh: '鼓點飛入的流星雷射', en: 'Streaks on the beat' } },
    { id: 'hits', type: 'toggle', default: true, label: { zh: '聲響觸發（拍手、彈指、敲擊立刻閃）', en: 'Sound hits (claps, snaps, knocks flash at once)' } },
    { id: 'pools', type: 'toggle', default: true, label: { zh: '照亮落點（光照在畫上）', en: 'Light pools on the painting' } },
    { id: 'sun', type: 'toggle', default: true, label: { zh: '畫中心的呼吸光', en: 'Breathing sun glow' } },
  ],
  create(host, p) {
    const PRISM = [[255, 65, 109], [87, 255, 160], [255, 226, 141], [101, 219, 255], [201, 135, 255], [255, 172, 104]];
    let t = 0, lastBeat = -9, count = 0, own = 0, energy = 0, bolts = [], sparks = [], hitsSeen = null, hitT = -9, shift = 0;
    const sun = host.focalPoints(1)[0] || [0.5, 0.45];
    const rnd = (s) => { const n = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return n - Math.floor(n); };
    const col = (i, x, y) => p.colors === 'gold' ? [236, 205, 140] : p.colors === 'painting' ? host.colorAt(x, y) : PRISM[(i + shift) % PRISM.length];
    const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a))})`;
    const origin = (r, i, seed = 0) => {
      const side = i % 3;
      return [side === 0 ? r.x - r.w * 0.12 - 30 : side === 1 ? r.x + r.w * 1.12 + 30 : r.x + r.w * (0.1 + ((i + seed) % 5) * 0.2),
        side === 2 ? -30 : r.y + r.h * (0.1 + ((i + seed) % 5) * 0.16)];
    };
    const target = (r, i, sweep, group, impact) => {
      const a = i * Math.PI / 3 + sweep * 0.24 + rnd(group + 1) * 1.7;
      const x = r.x + r.w * (0.16 + 0.68 * (0.5 + 0.5 * Math.sin(a))), y = r.y + r.h * (0.2 + 0.6 * (0.5 + 0.5 * Math.cos(a * 1.3)));
      const sx = r.x + r.w * sun[0], sy = r.y + r.h * sun[1];
      return [x * (1 - impact) + sx * impact, y * (1 - impact) + sy * impact];
    };
    return {
      set(np) { Object.assign(p, np); },
      frame(dt, k) {
        t += dt;
        const r = host.rect; if (!r) return;
        // the beat: the show track's measured timeline, the music's kick, or our own steady tempo
        let b = p.sync === 'music' ? host.beat() : null;
        let beat = false;
        if (b && b.live) { if (b.count !== count) { beat = b.count > count; count = b.count; } host.laserMode = b.room ? 'room' : 'music'; }
        else if (p.sync === 'music') {
          // no music playing: the beams do not flash; they breathe slowly (6 breaths a minute) and drift
          host.laserMode = 'calm';
          const br = 0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 10);
          b = { pulse: br * 0.28, stage: 'calm', buildProgress: 0, dropPulse: 0, sweep: t * 0.35, energy: 0.15 + br * 0.15, hits: b && b.hits, hitAge: b && b.hitAge };
        }
        else {
          host.laserMode = 'tempo';
          own += dt; const iv = 60 / p.bpm; if (own >= iv) { own -= iv; count++; beat = true; lastBeat = t; }
          b = { pulse: Math.exp(-(t - lastBeat) / 0.11), stage: 'groove', buildProgress: 0, dropPulse: 0, sweep: t / iv, energy: 0.4 + 0.3 * Math.sin(t * 0.7) };
        }
        // a clap / snap / knock heard in the room: flash at once and turn the colours (LED-strip style)
        if (p.hits && b.hits != null) {
          if (hitsSeen === null) hitsSeen = b.hits;
          if (b.hits > hitsSeen) { hitsSeen = b.hits; hitT = t - Math.max(0, Math.min(0.05, b.hitAge || 0)); shift++; if (b.hits > (host.hitsFlashed || 0)) { host.hitsFlashed = b.hits; host.laserHits = (host.laserHits || 0) + 1; } beat = true; }
        }
        const hitPulse = Math.exp(-Math.max(0, t - hitT) / 0.09);
        const stage = hitPulse > 0.3 && b.stage === 'calm' ? 'groove' : (b.stage || 'groove'), pulse = Math.max(b.pulse || 0, hitPulse), drop = b.dropPulse || 0, bp = b.buildProgress || 0;
        energy = Math.max(b.energy ?? b.level ?? 0, energy * 0.84);
        const sweep = b.sweep != null ? b.sweep : t * 2.4, group = Math.floor(count / 4);
        const impact = Math.min(1, drop * 1.8);
        const calm = stage === 'calm' ? 0.6 : 1;
        const n = stage === 'build' ? (bp > 0.7 ? Math.min(5, p.beams) : Math.min(3, p.beams)) : Math.round(p.beams);
        const ctx = host.front; ctx.save(); ctx.lineCap = 'round';
        // the sun glow breathing with the bass
        if (p.sun) {
          const sx = r.x + r.w * sun[0], sy = r.y + r.h * sun[1], R = Math.min(r.w * 0.42, 190);
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(sx, sy, 3, sx, sy, R);
          g.addColorStop(0, `rgba(255,223,115,${(energy * 0.16 + pulse * 0.35) * k})`); g.addColorStop(0.45, `rgba(243,178,48,${(energy * 0.08 + pulse * 0.18) * k})`); g.addColorStop(1, 'rgba(240,170,45,0)');
          ctx.fillStyle = g; ctx.fillRect(sx - R, sy - R, R * 2, R * 2);
        }
        // on the kick: streak-lasers fly in, gold sparks mark three hits
        if (beat && stage !== 'calm' && (stage !== 'build' || b.accentBeat)) {
          if (p.bolts && stage !== 'build') for (let i = 0; i < (stage === 'drop' ? 6 : 2); i++) { const [ox, oy] = origin(r, i, count); const [x, y] = target(r, i, sweep, group, impact); bolts.push({ ox, oy, x, y, age: 0, life: 0.18, c: col(i, x, y) }); }
          for (let i = 0; i < 3; i++) { const [x, y] = target(r, i * 2, sweep, group, impact); sparks.push({ x, y, age: 0, life: stage === 'build' ? 0.09 : 0.15 }); }
          if (bolts.length > 36) bolts.splice(0, bolts.length - 36); if (sparks.length > 9) sparks.splice(0, sparks.length - 9);
        }
        for (let i = 0; i < n; i++) {
          const [ox, oy] = origin(r, i), [tx, ty] = target(r, i, sweep, group, impact), c = col(i, tx, ty);
          const power = Math.min(1, (stage === 'build' ? 0.06 + bp * 0.06 : 0.07) + energy * 0.035 + pulse * 0.85 + drop * 0.12 + 0.12) * p.power * k * calm;
          // the beam: real colour that shows even on a light painting, then a glowing pale core
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = rgba(c, power * 0.22); ctx.lineWidth = 6 + pulse * 7;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.strokeStyle = rgba(c, power * 0.9); ctx.lineWidth = 0.8 + pulse * 2.2 + 0.8;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = rgba([255, 249, 223], power * 0.72); ctx.lineWidth = 0.65;
          ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
          // prism rays beyond the hit
          const ang = Math.atan2(ty - oy, tx - ox), reach = Math.min(r.w * 0.24, 150) * (1 + pulse * 0.22), spread = [0.12, 0.34, 0.52][group % 3];
          for (let j = -1; j <= 1; j++) {
            const aj = ang + j * spread + Math.sin(sweep) * 0.18, ex = tx + Math.cos(aj) * reach, ey = ty + Math.sin(aj) * reach;
            const gr = ctx.createLinearGradient(tx, ty, ex, ey); gr.addColorStop(0, rgba(PRISM[(i + j + 6) % 6], power * 0.72)); gr.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.strokeStyle = gr; ctx.lineWidth = 0.8 + pulse; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(ex, ey); ctx.stroke();
          }
          // the hit lights the painted surface
          if (p.pools) {
            const R = 38 + pulse * 48;
            ctx.globalCompositeOperation = 'source-over';
            const g = ctx.createRadialGradient(tx, ty, 1, tx, ty, R);
            g.addColorStop(0, rgba(c, power * 0.42)); g.addColorStop(0.45, rgba(c, power * 0.16)); g.addColorStop(1, rgba(c, 0));
            ctx.fillStyle = g; ctx.fillRect(tx - R, ty - R, R * 2, R * 2);
            ctx.globalCompositeOperation = 'lighter';
            const h = ctx.createRadialGradient(tx, ty, 0, tx, ty, R * 0.35);
            h.addColorStop(0, rgba([255, 249, 218], power * 0.75)); h.addColorStop(1, rgba([255, 249, 218], 0));
            ctx.fillStyle = h; ctx.fillRect(tx - R, ty - R, R * 2, R * 2);
          }
          if (pulse > 0.05) { ctx.strokeStyle = rgba(c, pulse * 0.6 * k); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(tx, ty, Math.max(0, 8 + (b.phase || 0) * 28), 0, Math.PI * 2); ctx.stroke(); }
        }
        // streak-lasers: a bright head flying in from the edge, leaving a fading trail
        ctx.globalCompositeOperation = 'lighter';
        for (const bo of bolts) {
          bo.age += dt; const q = Math.min(1, bo.age / bo.life), tail = Math.max(0, q - 0.32), near = (1 - q) ** 2, back = (1 - tail) ** 2;
          const op = Math.exp(-bo.age / 0.065) * k;
          const hx = bo.x + (bo.ox - bo.x) * near, hy = bo.y + (bo.oy - bo.y) * near, sx = bo.x + (bo.ox - bo.x) * back, sy = bo.y + (bo.oy - bo.y) * back;
          const st = ctx.createLinearGradient(sx, sy, hx, hy); st.addColorStop(0, rgba(bo.c, 0)); st.addColorStop(1, rgba(bo.c, op));
          ctx.strokeStyle = st; ctx.lineWidth = 1.4 + (1 - q) * 7; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
          ctx.fillStyle = rgba([255, 246, 210], op); ctx.beginPath(); ctx.arc(hx, hy, Math.max(0, 1.5 + (1 - q) * 2), 0, Math.PI * 2); ctx.fill();
        }
        bolts = bolts.filter(bo => bo.age < bo.life);
        // gold sparks where the beat lands
        for (const s of sparks) {
          s.age += dt; const q = s.age / s.life, op = (1 - q) * (stage === 'build' ? 0.55 + bp * 0.25 : 0.65) * k, R = stage === 'build' ? 24 + q * 44 : 18 + q * 38;
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, R); g.addColorStop(0, `rgba(255,247,207,${op})`); g.addColorStop(1, 'rgba(255,210,80,0)');
          ctx.fillStyle = g; ctx.fillRect(s.x - R, s.y - R, R * 2, R * 2);
        }
        sparks = sparks.filter(s => s.age < s.life);
        ctx.restore();
      },
      dispose() { bolts = []; sparks = []; },
    };
  },
};
