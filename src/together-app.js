/* 雙生共創 Twin Flame — round 2 (2026-10-30). Real co-creation:
   ① two people take turns drawing light strokes on the painting (gold, blue, gold, blue);
   ② each brings one word; ③ both hold at the same time to fuse; ④ a lightprint card built from all of it.
   The painting <img> is never filtered or transformed; light is drawn on an overlay canvas above it.
   No backend: the whole lightprint lives in the URL. */
(() => {
'use strict';
const G = window.aeGames;
const ART_SRC = '/assets/selected-works-v2/love-embrace.webp';
const ART_TITLE = 'Love Embrace';
const WORDS = [
  ['光', 'Light'], ['勇氣', 'Courage'], ['溫柔', 'Tenderness'], ['耐心', 'Patience'],
  ['笑', 'Laughter'], ['安靜', 'Stillness'], ['信任', 'Trust'], ['好奇', 'Wonder']
];
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const ABC = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const FLAME_D = 'M80 16C108 48 104 86 92 112C86 132 84 156 80 176C76 156 74 132 68 112C56 86 52 48 80 16Z';
const GOLD = '255,214,130', BLUE = '122,168,255', TEAL = '141,255,228';
const HOLD_MS = 2400, NPTS = 18;
const $ = (id) => document.getElementById(id);
const stage = $('stage'), art = $('art'), ov = $('ov'), octx = ov.getContext('2d');

const S = {
  mode: 'local',            // local | send (I draw gold, then send) | remote (I answer in blue) | view
  strokes: [],              // [{c:'g'|'b', p:[{x,y}...]}]
  turns: ['g', 'b', 'g', 'b'],
  live: null,               // stroke being drawn
  phase: 'draw',            // draw | words | hold | done
  wa: -1, wb: -1, n1: '', n2: '', d: '', lp: '',
  fuse: 0, held: new Set(), t0: performance.now(), lastBuzz: 0
};

/* ---------- encode / decode ---------- */
const q2 = (v) => { const n = Math.max(0, Math.min(4095, Math.round(v * 4095))); return B64[n >> 6] + B64[n & 63]; };
const d2 = (s) => (B64.indexOf(s[0]) * 64 + B64.indexOf(s[1])) / 4095;
const encStroke = (p) => p.map((pt) => q2(pt.x) + q2(pt.y)).join('');
function decStroke(s) {
  if (!/^[A-Za-z0-9_-]+$/.test(s) || s.length % 4 || s.length < 16 || s.length > 4 * 40) return null;
  const out = [];
  for (let i = 0; i < s.length; i += 4) out.push({ x: d2(s.slice(i, i + 2)), y: d2(s.slice(i + 2, i + 4)) });
  return out;
}
const encSet = (c) => S.strokes.filter((s) => s.c === c).map((s) => encStroke(s.p)).join('.');
function decSet(v, c) { return String(v || '').split('.').map(decStroke).filter(Boolean).slice(0, 2).map((p) => ({ c, p })); }

const q = new URLSearchParams(location.search);
{
  const g = decSet(q.get('g'), 'g'), b = decSet(q.get('b'), 'b');
  const wa = Number(q.get('wa')), wb = Number(q.get('wb'));
  S.n1 = G.cleanName(q.get('n1')); S.n2 = G.cleanName(q.get('n2'));
  S.d = /^\d{8}$/.test(q.get('d') || '') ? q.get('d') : '';
  if (Number.isInteger(wa) && wa >= 0 && wa < WORDS.length) S.wa = wa;
  if (Number.isInteger(wb) && wb >= 0 && wb < WORDS.length) S.wb = wb;
  const lp = q.get('lp') || '';
  if (/^LP-[23456789A-HJ-NP-Z]{8}$/.test(lp)) S.lp = lp;
  if (g.length === 2 && b.length === 2 && S.wa >= 0 && S.wb >= 0) {
    S.mode = 'view'; S.strokes = [g[0], b[0], g[1], b[1]]; S.phase = 'done'; S.fuse = 1;
  } else if (g.length === 2 && S.wa >= 0) {
    S.mode = 'remote'; S.strokes = g.slice(); S.turns = ['g', 'g', 'b', 'b']; S.wb = -1;
  } else { S.wa = -1; S.wb = -1; }
}

/* ---------- geometry ---------- */
function segX(a, b, c, d) {
  const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
  return (t >= 0 && t <= 1 && u >= 0 && u <= 1) ? { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) } : null;
}
function crossings() {
  const gs = S.strokes.filter((s) => s.c === 'g'), bs = S.strokes.filter((s) => s.c === 'b'), out = [];
  for (const g of gs) for (const b of bs)
    for (let i = 0; i < g.p.length - 1; i++) for (let j = 0; j < b.p.length - 1; j++) {
      const x = segX(g.p[i], g.p[i + 1], b.p[j], b.p[j + 1]); if (x) out.push(x);
    }
  return out;
}
function heart() {
  const xs = crossings();
  if (xs.length) return { x: xs.reduce((a, p) => a + p.x, 0) / xs.length, y: xs.reduce((a, p) => a + p.y, 0) / xs.length };
  const gs = S.strokes.filter((s) => s.c === 'g').flatMap((s) => s.p), bs = S.strokes.filter((s) => s.c === 'b').flatMap((s) => s.p);
  if (!gs.length || !bs.length) return { x: .5, y: .5 };
  let best = 9, M = { x: .5, y: .5 };
  for (const a of gs) for (const b of bs) { const dd = Math.hypot(a.x - b.x, a.y - b.y); if (dd < best) { best = dd; M = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; } }
  return M;
}
function resample(pts, n) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = L[L.length - 1], out = [];
  for (let k = 0; k < n; k++) {
    const t = total * k / (n - 1); let i = 1;
    while (i < L.length - 1 && L[i] < t) i++;
    const seg = (L[i] - L[i - 1]) || 1, f = (t - L[i - 1]) / seg;
    out.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f });
  }
  return out;
}
function cardId() {
  let h = G.hash32('tf2|' + encSet('g') + '|' + encSet('b') + '|' + S.wa + '|' + S.wb), out = '';
  for (let i = 0; i < 8; i++) { h = G.mix(h, i); out += ABC[h % ABC.length]; }
  return 'TF-' + out.slice(0, 4) + '-' + out.slice(4);
}
function dateLabel() { return S.d ? S.d.slice(0, 4) + '.' + S.d.slice(4, 6) + '.' + S.d.slice(6) : G.today(); }
function stampDate() { if (!S.d) { const d = new Date(); S.d = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); } }

/* ---------- drawing light (overlay only) ---------- */
function sizeOv() {
  const r = art.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
  ov.width = Math.max(1, Math.round(r.width * d)); ov.height = Math.max(1, Math.round(r.height * d));
  octx.setTransform(d, 0, 0, d, 0, 0);
}
function pathOf(ctx, pts) {
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) { const m = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 }; ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y); }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
}
function lightStroke(ctx, pts, rgb, w, glow, alpha) {
  if (pts.length < 2) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = alpha == null ? 1 : alpha;
  pathOf(ctx, pts); ctx.strokeStyle = 'rgba(25,14,4,.5)'; ctx.lineWidth = w + 5; ctx.stroke();
  ctx.shadowColor = `rgba(${rgb},1)`; ctx.shadowBlur = glow;
  pathOf(ctx, pts); ctx.strokeStyle = `rgb(${rgb})`; ctx.lineWidth = w; ctx.stroke();
  ctx.shadowBlur = glow * .4;
  pathOf(ctx, pts); ctx.strokeStyle = 'rgba(255,253,246,.95)'; ctx.lineWidth = Math.max(1.2, w * .34); ctx.stroke();
  ctx.restore();
}
function node(ctx, x, y, r, a) {
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
  g.addColorStop(0, `rgba(${TEAL},.9)`); g.addColorStop(1, `rgba(${TEAL},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4fffb'; ctx.shadowColor = `rgb(${TEAL})`; ctx.shadowBlur = r * 2;
  ctx.beginPath(); ctx.arc(x, y, r * .7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function flame(ctx, cx, cy, h, a) {
  if (a <= 0) return;
  const k = h / 160;
  ctx.save(); ctx.translate(cx - 80 * k, cy - 110 * k); ctx.scale(k, k);
  const p = new Path2D(FLAME_D);
  const fill = ctx.createLinearGradient(0, 16, 0, 176);
  fill.addColorStop(0, `rgba(255,252,240,${a})`); fill.addColorStop(.45, `rgba(${TEAL},${a})`); fill.addColorStop(1, `rgba(20,201,164,${a})`);
  const edge = ctx.createLinearGradient(52, 0, 108, 0);
  edge.addColorStop(0, `rgba(${GOLD},${a})`); edge.addColorStop(.5, `rgba(125,255,240,${a})`); edge.addColorStop(1, `rgba(${BLUE},${a})`);
  ctx.shadowColor = `rgba(120,255,220,${a})`; ctx.shadowBlur = 26;
  ctx.fillStyle = fill; ctx.fill(p); ctx.lineWidth = 5; ctx.strokeStyle = edge; ctx.stroke(p);
  ctx.restore();
}
function halo(ctx, x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
/* Draw the whole lightprint in a box (used by the stage overlay and by the card). */
function drawPrint(ctx, bx, by, bw, bh, opt) {
  const o = Object.assign({ w: 4, fuse: S.fuse, pulse: 1, live: null }, opt || {});
  const m = (p) => ({ x: bx + p.x * bw, y: by + p.y * bh });
  const unit = Math.min(bw, bh);
  const glow = 10 + o.fuse * 18;
  S.strokes.forEach((s) => lightStroke(ctx, s.p.map(m), s.c === 'g' ? GOLD : BLUE, o.w * (1 + o.fuse * .25), glow));
  if (o.live && o.live.p.length > 1) lightStroke(ctx, o.live.p.map(m), o.live.c === 'g' ? GOLD : BLUE, o.w, 12);
  const xs = crossings();
  xs.forEach((p) => { const P = m(p); node(ctx, P.x, P.y, unit * (.012 + o.fuse * .006), .8 + o.fuse * .2); });
  if (o.fuse > 0) {
    const H = m(heart());
    halo(ctx, H.x, H.y, unit * (.16 + .18 * o.fuse) * o.pulse, TEAL, (o.card ? .3 : .5) * o.fuse);
    flame(ctx, H.x, H.y, unit * (.1 + .16 * o.fuse), Math.min(1, o.fuse * 1.4));
  }
}
function frame(now) {
  const r = art.getBoundingClientRect(), W = r.width, H = r.height;
  octx.clearRect(0, 0, W, H);
  const pulse = G.reduce ? 1 : 1 + Math.sin((now - S.t0) / 380) * .08;
  if (S.phase === 'hold') holdTick(now);
  S.lastT = now;
  drawPrint(octx, 0, 0, W, H, { w: Math.max(3, W * .009), pulse, live: S.live });
  requestAnimationFrame(frame);
}

/* ---------- ① draw in turns ---------- */
const turnIdx = () => S.strokes.length;
const curColor = () => S.turns[turnIdx()];
function relPoint(e) {
  const r = art.getBoundingClientRect();
  return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)), w: r.width, h: r.height };
}
let liveId = null, lastPx = null;
stage.addEventListener('pointerdown', (e) => {
  if (S.phase !== 'draw' || liveId !== null || !curColor()) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  liveId = e.pointerId; stage.setPointerCapture(e.pointerId);
  const p = relPoint(e); S.live = { c: curColor(), p: [{ x: p.x, y: p.y }] }; lastPx = { x: e.clientX, y: e.clientY };
  $('hint').hidden = true;
  G.chime('tap', p.x);
});
stage.addEventListener('pointermove', (e) => {
  if (e.pointerId !== liveId || !S.live) return;
  if (Math.hypot(e.clientX - lastPx.x, e.clientY - lastPx.y) < 4) return;
  lastPx = { x: e.clientX, y: e.clientY };
  const p = relPoint(e); if (S.live.p.length < 400) S.live.p.push({ x: p.x, y: p.y });
  if (Math.random() < .25) G.burst(e.clientX, e.clientY, { n: 3, colors: S.live.c === 'g' ? ['gold', 'white'] : ['blue', 'white'], speed: 1.2, size: 1.8, decay: .03 });
});
function endLive(e) {
  if (e.pointerId !== liveId) return;
  liveId = null;
  const s = S.live; S.live = null;
  if (!s) return;
  const r = art.getBoundingClientRect();
  let len = 0; for (let i = 1; i < s.p.length; i++) len += Math.hypot((s.p[i].x - s.p[i - 1].x) * r.width, (s.p[i].y - s.p[i - 1].y) * r.height);
  if (len < Math.min(r.width, r.height) * .22) { note('再長一點：按住拖曳，畫出一道光，不只是點一下。Draw a longer line — drag, not just tap.'); render(); return; }
  commitStroke({ c: s.c, p: resample(s.p, NPTS) }, e.clientX, e.clientY);
}
stage.addEventListener('pointerup', endLive);
stage.addEventListener('pointercancel', endLive);
stage.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (S.phase !== 'draw' || !curColor()) return;
  e.preventDefault();
  const h = G.hash32('k' + Date.now()), c = curColor(), pts = [];
  const y0 = .2 + (h % 60) / 100, y1 = .2 + (G.mix(h, 1) % 60) / 100;
  for (let i = 0; i < NPTS; i++) { const t = i / (NPTS - 1); pts.push({ x: c === 'g' ? .08 + t * .84 : .92 - t * .84, y: y0 + (y1 - y0) * t + Math.sin(t * Math.PI * 2 + (h % 7)) * .12 }); }
  const r = art.getBoundingClientRect();
  commitStroke({ c, p: pts.map((p) => ({ x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) })) }, r.left + r.width / 2, r.top + r.height / 2);
});
function commitStroke(s, cx, cy) {
  const before = crossings().length;
  S.strokes.push(s);
  const after = crossings().length;
  note('');
  G.burst(cx, cy, { n: 22, colors: s.c === 'g' ? ['gold', 'white'] : ['blue', 'white'], speed: 2.6 });
  G.chime('tap', .7); G.buzz(14);
  if (after > before) {
    note('交織了 ' + (after - before) + ' 次 ✦ Your lights crossed ' + (after - before) + '×');
    const r = art.getBoundingClientRect();
    crossings().slice(before).forEach((p) => G.burst(r.left + p.x * r.width, r.top + p.y * r.height, { n: 10, colors: ['teal', 'white'], speed: 1.8 }));
  }
  if (!curColor()) { goWords(); return; }
  render();
}
$('undo').addEventListener('click', () => {
  const fixed = S.mode === 'remote' ? 2 : 0;
  if (S.strokes.length > fixed) { S.strokes.pop(); note(''); render(); }
});
$('sendMode').addEventListener('click', () => {
  S.mode = 'send'; S.strokes = S.strokes.filter((s) => s.c === 'g').slice(0, 1); S.turns = ['g', 'g'];
  note('好的：你先畫兩道金光、選一個字，再把連結傳給他。OK — draw two gold lights, pick a word, then send the link.');
  render();
});
$('reset1').addEventListener('click', () => { location.href = '/together'; });

/* ---------- ② words ---------- */
function chips(box, which) {
  box.innerHTML = '';
  WORDS.forEach(([zh, en], i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'g-chip' + (which === 'b' ? ' blue' : '');
    b.setAttribute('aria-pressed', 'false'); b.dataset.i = i;
    b.innerHTML = zh + '<small>' + en + '</small>';
    b.addEventListener('click', () => {
      if (which === 'a') S.wa = i; else S.wb = i;
      box.querySelectorAll('.g-chip').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.i) === i)));
      G.burstAt(b, { n: 10, colors: which === 'a' ? ['gold', 'white'] : ['blue', 'white'], speed: 1.8 }); G.chime('tap', i / 8);
      wordsReady();
    });
    box.appendChild(b);
  });
}
function wordsReady() {
  const needA = S.mode !== 'remote', needB = S.mode !== 'send';
  const ok = (!needA || S.wa >= 0) && (!needB || S.wb >= 0);
  $('toHold').disabled = !ok; $('sendLink').disabled = !ok;
}
function goWords() {
  S.phase = 'words'; render();
  $('words').hidden = false;
  $('colA').hidden = S.mode === 'remote';
  $('colB').hidden = S.mode === 'send';
  $('toHold').parentElement.hidden = S.mode === 'send';
  $('sendBox').hidden = S.mode !== 'send';
  if (S.mode === 'send') $('wTitle').innerHTML = '② 你帶來一個字<span class="en">Bring your word</span>';
  if (S.mode === 'remote') $('wTitle').innerHTML = '② 他帶來了「' + WORDS[S.wa][0] + '」，你呢？<span class="en">They brought “' + WORDS[S.wa][1] + '”. What do you bring?</span>';
  wordsReady();
  setTimeout(() => $('words').scrollIntoView({ behavior: G.reduce ? 'auto' : 'smooth', block: 'center' }), 200);
}
$('sendLink').addEventListener('click', async () => {
  S.n1 = G.cleanName($('n1').value);
  const p = new URLSearchParams({ g: encSet('g'), wa: String(S.wa) });
  if (S.n1) p.set('n1', S.n1);
  const url = location.origin + '/together?' + p.toString();
  const r = await G.shareLink(url, '雙生共創 Twin Flame', '我在畫上畫了兩道光給你，點開，用你的光回應我 · I drew two lights for you — answer with yours');
  note(r === 'copied' ? '連結已複製，傳給對方。他會畫兩道藍光、選一個字、按住融合，卡片就完成了。Link copied.' : (r === 'manual' ? url : (r === 'cancel' ? '' : '已送出。他回應後，會得到你們的光紋卡。Sent.')));
  $('note').scrollIntoView({ block: 'center' });
});

/* ---------- ③ hold together ---------- */
// Local mode always shows two pads (gold + blue); both must be held at the same time.
// Phone/touch: two fingers (one per person). Computer (single mouse): one person holds a pad with the mouse,
// the other holds the Space key (= the other colour); or both on one keyboard: hold F (gold) + J (blue).
// Progress is driven by real elapsed time (not frame count), so throttled/slow frames can't stall it.
const coarse = matchMedia('(pointer: coarse)').matches;
const twoPads = () => S.mode === 'local';
const keyHeld = new Set();      // 'a' | 'b' held from the keyboard
const ptrHeld = new Map();      // pointerId -> 'a' | 'b' | 'both'
function syncHeld() {
  S.held = new Set([...keyHeld, ...ptrHeld.values()]);
  ['a', 'b', 'both'].forEach((k) => { const el = $(k === 'a' ? 'padA' : k === 'b' ? 'padB' : 'padBoth'); el.classList.toggle('on', S.held.has(k)); });
  const st = $('holdState'); if (!st) return;
  if (twoPads()) {
    const a = S.held.has('a'), b = S.held.has('b');
    st.innerHTML = '<span class="' + (a ? 'ok' : '') + '">金 ' + (a ? '✓ 按住中' : '… 等待') + '</span><span class="' + (b ? 'ok' : '') + '">藍 ' + (b ? '✓ 按住中' : '… 等待') + '</span>'
      + '<span class="en">' + (a && b ? 'Both holding — keep going' : 'Gold ' + (a ? 'holding' : 'waiting') + ' · Blue ' + (b ? 'holding' : 'waiting')) + '</span>';
  } else st.innerHTML = '';
}
function holdNeed() { return twoPads() ? (S.held.has('a') && S.held.has('b')) : S.held.has('both'); }
function holdTick(now) {
  if (S.phase !== 'hold') return;
  const last = S.holdT || now, dt = Math.max(0, Math.min(1000, now - last)); S.holdT = now;
  if (holdNeed()) { S.fuse = Math.min(1, S.fuse + dt / HOLD_MS); if (now - S.lastBuzz > 380) { G.buzz(8); S.lastBuzz = now; } }
  else S.fuse = Math.max(0, S.fuse - dt / 1400);
  $('meter').style.setProperty('--p', S.fuse.toFixed(3));
  $('meterTxt').textContent = Math.round(S.fuse * 100) + '%';
  if (S.fuse >= 1) fused();
}
let holdTimer = 0;
function goHold() {
  S.n1 = G.cleanName($('n1').value); S.n2 = G.cleanName($('n2').value);
  $('words').hidden = true; S.phase = 'hold'; S.fuse = 0; S.holdT = 0; render();
  $('hold').hidden = false;
  $('padA').hidden = $('padB').hidden = !twoPads(); $('padBoth').hidden = twoPads();
  $('padAkey').hidden = $('padBkey').hidden = coarse;
  if (twoPads()) {
    $('hTitle').innerHTML = '③ <b>兩個人同時</b>按住自己的顏色約 2.5 秒，直到光融合；放開會慢慢退回。<span class="en">Both at once: each hold your own colour for about 2.5 s until the lights fuse. Letting go drains it.</span>';
    $('hHow').innerHTML = coarse
      ? '📱 <b>手機：</b>金色的人一根手指按住「金」，藍色的人一根手指按住「藍」，兩根手指同時按著。<span class="en">Phone: one finger each — gold on 金, blue on 藍, both at the same time.</span>'
      : '💻 <b>電腦：</b>一個人用<b>滑鼠按住「金」</b>，另一個人同時<b>按住鍵盤空白鍵</b>（＝藍）。<br>或兩人共用鍵盤：一人按住 <kbd>F</kbd>（金）、一人按住 <kbd>J</kbd>（藍）。觸控螢幕可直接兩指各按一顆。'
        + '<span class="en">Computer: one person holds 金 with the mouse while the other holds the Space bar (= blue). Or share the keyboard: hold F (gold) + J (blue). On a touchscreen, use two fingers.</span>';
  } else if (S.mode === 'remote') { $('padBothTxt').textContent = '按住融合 HOLD'; $('hTitle').innerHTML = '③ 按住約 2.5 秒，把你的光和他的光融在一起。<span class="en">Hold for about 2.5 s to fuse your light with theirs.</span>'; $('hHow').innerHTML = '滑鼠按住、手指按住，或按住空白鍵都可以。<span class="en">Hold with the mouse, a finger, or the Space bar.</span>'; }
  note(''); syncHeld();
  clearInterval(holdTimer); holdTimer = setInterval(() => holdTick(performance.now()), 50);
  setTimeout(() => $('hold').scrollIntoView({ behavior: G.reduce ? 'auto' : 'smooth', block: 'end' }), 120);
}
$('toHold').addEventListener('click', goHold);
function bindPad(el, key) {
  el.addEventListener('pointerdown', (e) => {
    if (S.phase !== 'hold') return; if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) {}
    ptrHeld.set(e.pointerId, key); syncHeld(); G.chime('tap', key === 'a' ? .2 : key === 'b' ? .8 : .5);
  });
  const off = (e) => { if (ptrHeld.get(e.pointerId) === key) { ptrHeld.delete(e.pointerId); syncHeld(); } };
  el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off);
  el.addEventListener('lostpointercapture', (e) => { if (e.pointerType !== 'mouse') off(e); });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
bindPad($('padA'), 'a'); bindPad($('padB'), 'b'); bindPad($('padBoth'), 'both');
// a mouse release anywhere ends that mouse hold (even if capture was lost)
window.addEventListener('pointerup', (e) => { if (ptrHeld.has(e.pointerId)) { ptrHeld.delete(e.pointerId); syncHeld(); } });
// keyboard: Space = the colour the mouse isn't holding (blue by default); F = gold, J = blue
function keyFor(e) {
  if (e.code === 'KeyF') return twoPads() ? 'a' : 'both';
  if (e.code === 'KeyJ') return twoPads() ? 'b' : 'both';
  if (e.code === 'Space' || e.key === ' ' || e.key === 'Enter') {
    if (!twoPads()) return 'both';
    const m = [...ptrHeld.values()];
    return m.includes('b') && !m.includes('a') ? 'a' : 'b';
  }
  return '';
}
document.addEventListener('keydown', (e) => {
  if (S.phase !== 'hold' || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  const k = keyFor(e); if (!k) return;
  e.preventDefault(); if (e.repeat) return;
  S._keyMap = S._keyMap || {}; S._keyMap[e.code || e.key] = k;
  if (!keyHeld.has(k)) G.chime('tap', k === 'a' ? .2 : k === 'b' ? .8 : .5);
  keyHeld.add(k); syncHeld();
});
document.addEventListener('keyup', (e) => {
  const m = S._keyMap || {}, k = m[e.code || e.key]; if (!k) return;
  e.preventDefault(); delete m[e.code || e.key];
  if (!Object.values(m).includes(k)) keyHeld.delete(k); syncHeld();
});
window.addEventListener('blur', () => { keyHeld.clear(); ptrHeld.clear(); S._keyMap = {}; syncHeld(); });
async function fused() {
  if (S.phase !== 'hold') return;
  S.phase = 'done'; S.fuse = 1; clearInterval(holdTimer); keyHeld.clear(); ptrHeld.clear(); S.held.clear();
  document.querySelectorAll('.pad').forEach((p) => p.classList.remove('on'));
  const r = art.getBoundingClientRect(), H = heart();
  G.burst(r.left + H.x * r.width, r.top + H.y * r.height, { n: 80, colors: ['teal', 'gold', 'blue', 'white'], speed: 5, size: 3, decay: .011 });
  G.chime('glow'); G.buzz([30, 50, 40]);
  stampDate(); $('hold').hidden = true; render();
  await showResult(true);
}

/* ---------- ④ the card (1080×1920 phone wallpaper) ---------- */
let artImg = null, logoImg = null;
async function drawCard() {
  const c = $('cardCanvas'), ctx = c.getContext('2d'), W = 1080, H = 1920;
  await G.fontsReady();
  if (!artImg) artImg = await G.loadImg(ART_SRC);
  if (!logoImg) { try { logoImg = await G.loadImg('/assets/ae-three-rings-transparent.webp'); } catch (e) { logoImg = null; } }
  const ZH = G.FONT_ZH, EN = G.FONT_EN;
  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#120f0c'); bg.addColorStop(.5, '#0d0b09'); bg.addColorStop(1, '#0a0908');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // the painting, large, unaltered (contain-fit to the full card width)
  const pw = 1000, ph = Math.round(pw * artImg.naturalHeight / artImg.naturalWidth), px = 40, py = 150;
  G.text(ctx, 'AE UNIVERSE CREATION  ·  雙生共創 TWIN FLAME', W / 2, 100, { font: '500 24px ' + EN, color: '#e7bd67', spacing: 6 });
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18; ctx.fillStyle = '#000'; ctx.fillRect(px, py, pw, ph); ctx.restore();
  ctx.drawImage(artImg, px, py, pw, ph);
  // their light, drawn above the painting (overlay only)
  ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
  drawPrint(ctx, px, py, pw, ph, { w: 8, fuse: 1, card: true });
  ctx.restore();
  ctx.strokeStyle = 'rgba(231,189,103,.7)'; ctx.lineWidth = 2; ctx.strokeRect(px - 12, py - 12, pw + 24, ph + 24);
  let y = py + ph + 110;
  G.text(ctx, '雙生光紋卡', W / 2, y, { font: '600 78px ' + ZH, spacing: 14 });
  G.text(ctx, 'Twin Flame Lightprint', W / 2, y + 58, { font: 'italic 500 40px ' + EN, color: '#d9cfc0' });
  y += 150;
  // the two words, side by side
  const [za, ea] = WORDS[S.wa], [zb, eb] = WORDS[S.wb];
  const lx = 290, rx = 790;
  G.text(ctx, za, lx, y + 40, { font: '600 86px ' + ZH, color: '#ffd682' });
  G.text(ctx, ea, lx, y + 96, { font: 'italic 500 34px ' + EN, color: '#e9d4a8' });
  G.text(ctx, S.n1 || '金色的光', lx, y + 146, { font: '500 30px ' + ZH, color: '#9a8f80' });
  G.text(ctx, zb, rx, y + 40, { font: '600 86px ' + ZH, color: '#a9c6ff' });
  G.text(ctx, eb, rx, y + 96, { font: 'italic 500 34px ' + EN, color: '#c6d6f5' });
  G.text(ctx, S.n2 || '藍色的光', rx, y + 146, { font: '500 30px ' + ZH, color: '#9a8f80' });
  halo(ctx, W / 2, y + 20, 110, TEAL, .35);
  flame(ctx, W / 2, y + 30, 120, 1);
  y += 250;
  G.text(ctx, '「' + za + '」遇見「' + zb + '」，成了只屬於我們的光。', W / 2, y, { font: '600 42px ' + ZH, maxW: 940, lh: 60 });
  G.text(ctx, ea + ' met ' + eb + ' — and became a light of our own.', W / 2, y + 56, { font: 'italic 500 32px ' + EN, color: '#d9cfc0', maxW: 940, lh: 42 });
  y += 140;
  ctx.strokeStyle = 'rgba(231,189,103,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2 - 160, y - 40); ctx.lineTo(W / 2 + 160, y - 40); ctx.stroke();
  const xs = crossings().length;
  G.text(ctx, '4 道光  ·  交織 ' + xs + ' 次  ·  一起按住 1 次', W / 2, y + 10, { font: '500 30px ' + ZH, color: '#d9cfc0', spacing: 2 });
  G.text(ctx, '4 strokes · ' + xs + ' crossings · 1 shared hold', W / 2, y + 52, { font: 'italic 500 28px ' + EN, color: '#9a8f80' });
  G.text(ctx, cardId(), W / 2, y + 132, { font: '600 46px ' + EN, color: '#e7bd67', spacing: 8 });
  G.text(ctx, dateLabel() + (S.lp ? '  ·  光紋心卡 ' + S.lp : ''), W / 2, y + 180, { font: '500 28px ' + EN, color: '#9a8f80', spacing: 3 });
  G.text(ctx, '原作《' + ART_TITLE + '》· 光紋疊在畫上，畫作保持原樣', W / 2, H - 70, { font: '500 24px ' + ZH, color: '#7d7366' });
  return c;
}
function shareUrl() {
  const p = new URLSearchParams({ g: encSet('g'), b: encSet('b'), wa: String(S.wa), wb: String(S.wb), d: S.d });
  if (S.n1) p.set('n1', S.n1); if (S.n2) p.set('n2', S.n2); if (S.lp) p.set('lp', S.lp);
  return location.origin + '/together?' + p.toString();
}
// order strokes g,b,g,b for a stable layout regardless of who drew first
function normalise() {
  const g = S.strokes.filter((s) => s.c === 'g'), b = S.strokes.filter((s) => s.c === 'b');
  S.strokes = [g[0], b[0], g[1], b[1]].filter(Boolean);
}
async function showResult(scroll) {
  normalise();
  const id = cardId(), xs = crossings().length;
  $('reward').innerHTML = '<b>得到：</b>一張由你們<b>一起畫出</b>的光紋卡，編號 <b>' + id + '</b>。'
    + '<br>裡面有你們的 4 道光、交織的 ' + xs + ' 個光點、「' + WORDS[S.wa][0] + '」和「' + WORDS[S.wb][0] + '」兩個字，以及一起按住時生出的火焰。少了任何一個人，這張卡都不會存在。'
    + '<br>可以<b>存成手機桌布</b>，或<b>傳連結給對方</b>，他點開就會看到同一張。'
    + '<span class="en">Yours: a card you drew together, ID ' + id + ' — your 4 strokes, ' + xs + ' crossings, two words and the flame from your shared hold. Save it as a wallpaper or send the link.</span>';
  if (S.mode === 'view') { $('rGot').textContent = '你收到了 · YOU RECEIVED'; $('again').innerHTML = '也畫一張 <small>Make yours</small>'; }
  $('result').hidden = false;
  try { const c = await drawCard(); $('cardImg').src = c.toDataURL('image/png'); }
  catch (e) { $('rNote').textContent = '卡片圖片沒有生成，請重新整理。Card image failed — please reload.'; }
  if (scroll) setTimeout(() => $('result').scrollIntoView({ behavior: G.reduce ? 'auto' : 'smooth', block: 'start' }), 300);
  history.replaceState(null, '', shareUrl().replace(location.origin, ''));
}
$('save').addEventListener('click', async (e) => {
  G.burstAt(e.currentTarget, { n: 18 }); G.chime('tap', .8);
  const c = await drawCard();
  const ok = await G.saveCanvas(c, 'AE-TwinFlame-' + cardId() + '.png');
  $('rNote').textContent = ok ? '已儲存。設成手機桌布，讓你們的光每天都在。Saved — set it as your wallpaper.' : '';
});
$('shareCard').addEventListener('click', async () => {
  const r = await G.shareLink(shareUrl(), '雙生共創 Twin Flame · ' + cardId(), '我們一起畫的雙生光紋卡 · The Twin Flame card we made together');
  $('rNote').textContent = r === 'copied' ? '連結已複製，貼給對方吧。Link copied.' : (r === 'manual' ? shareUrl() : '');
});
$('again').addEventListener('click', () => { location.href = '/together'; });

/* ---------- UI state ---------- */
function setSteps(n) { document.querySelectorAll('#steps li').forEach((li) => { const s = Number(li.dataset.s); li.className = s < n ? 'done' : (s === n ? 'on' : ''); }); }
function say(html) { $('prompt').innerHTML = html; }
function note(t) { $('note').textContent = t || ''; }
function dots() {
  const box = $('dots'); box.innerHTML = '';
  S.turns.forEach((c, i) => { const d = document.createElement('i'); if (i < S.strokes.length) d.className = S.strokes[i] ? S.strokes[i].c : ''; else if (i === S.strokes.length && S.phase === 'draw') d.className = 'now'; box.appendChild(d); });
}
function render() {
  stage.classList.toggle('drawing', S.phase === 'draw');
  const tag = $('turnTag'), hint = $('hint');
  $('aside').hidden = S.phase !== 'draw';
  if (S.phase === 'draw') {
    setSteps(1);
    const i = turnIdx(), c = curColor(), gold = c === 'g';
    tag.hidden = false; tag.className = 'turn ' + c; tag.textContent = (gold ? '金色' : '藍色') + ' · 第 ' + (i + 1) + '/' + S.turns.length + ' 筆';
    hint.hidden = S.strokes.length > 0; hint.textContent = '按住拖曳，畫一道光 · Drag to draw';
    const col = gold ? '<span class="gold">金色</span>' : '<span class="blue">藍色</span>';
    let msg;
    if (S.mode === 'remote' && i === 2) msg = (S.n1 ? '<b>' + S.n1 + '</b>' : '有人') + '在畫上為你畫了兩道' + '<span class="gold">金光</span>。<br><b>輪到你</b>：畫一道' + col + '的光，試著穿過他的光。<span class="en">Someone drew two gold lights for you. Draw a blue light — try to cross theirs.</span>';
    else if (S.mode === 'remote') msg = '<b>最後一筆</b>：再畫一道' + col + '的光，把你們的光編在一起。<span class="en">One more blue light — weave them together.</span>';
    else if (S.mode === 'send') msg = (i === 0 ? '畫下你的第一道' : '再畫一道') + col + '的光。他之後會用藍光回應。<span class="en">Draw your gold light' + (i ? ' again' : '') + '. They will answer in blue.</span>';
    else if (i === 0) msg = '<b>第一個人（' + col + '）</b>：在畫上按住拖曳，畫一道光。<span class="en">Person one (gold): drag on the painting to draw a light.</span>';
    else if (i === 1) msg = '把手機交給<b>第二個人（' + col + '）</b>：畫一道光，<b>試著穿過金光</b>。<span class="en">Hand over — person two (blue): draw a light that crosses the gold.</span>';
    else if (i === 2) msg = '換回<b>第一個人（' + col + '）</b>：再畫一道，把兩道光<b>編在一起</b>。<span class="en">Back to gold: weave a second light through.</span>';
    else msg = '<b>第二個人（' + col + '）</b>：最後一筆，完成你們的光紋。<span class="en">Blue: the last stroke completes your lightprint.</span>';
    say(msg);
    $('undo').hidden = S.strokes.length <= (S.mode === 'remote' ? 2 : 0);
    $('sendMode').hidden = S.mode !== 'local' || S.strokes.length > 1;
  } else {
    tag.hidden = true; hint.hidden = true;
    if (S.phase === 'words') { setSteps(2); say('光紋畫好了。<span class="en">Your lightprint is drawn.</span>'); }
    else if (S.phase === 'hold') { setSteps(3); say(''); }
    else { setSteps(4); say(S.mode === 'view' ? '這是一張別人與你分享的雙生光紋卡。<span class="en">Someone shared their Twin Flame card with you.</span>' : '光融合了。往下看你們的卡。<span class="en">Fused — your card is below.</span>'); }
  }
  dots();
}

/* ---------- boot ---------- */
chips($('chipsA'), 'a'); chips($('chipsB'), 'b');
['n1', 'n2'].forEach((k) => { if (S[k]) $(k).value = S[k]; });
function boot() {
  sizeOv(); new ResizeObserver(sizeOv).observe(art);
  render();
  if (S.mode === 'view') showResult(false);
  if (S.lp && S.mode === 'local') note('你的光紋心卡 ' + S.lp + ' 會印在這張卡上。Your Lightprint ' + S.lp + ' will be printed on this card.');
  requestAnimationFrame(frame);
}
if (art.complete && art.naturalWidth) boot();
else { art.addEventListener('load', boot, { once: true }); art.addEventListener('error', () => { note('畫作沒有載入，請重新整理。The painting did not load — please reload.'); boot(); }, { once: true }); }
})();
