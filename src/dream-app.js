/* 夢想給予 Dream Giver — round 2 (2026-10-30).
   Give: write someone's dream → choose an AE painting for it → write a blessing → set a first small step → hold to seal → send.
   Receive: open the sealed letter → read the card → accept the dream → mark the first step → send a light back.
   Self: write your own dream → … → hold to commit → mark steps over time (kept on this device).
   Paintings are shown and placed unaltered (contain-fit, no crop, no filter). No backend: content lives in the link / localStorage. */
(() => {
'use strict';
const G = window.aeGames;
const V = '/assets/selected-works-v2/';
const P = [ // [src, title, zh word, en word]
  [V + 'love-embrace.webp', 'Love Embrace', '擁抱', 'Embrace'],
  [V + 'expansion.webp', 'Expansion', '擴展', 'Expansion'],
  [V + 'heart-recovery.webp', 'Heart Recovery', '復原', 'Recovery'],
  [V + 'heart-fly.webp', 'Heart Fly', '飛翔', 'Flight'],
  [V + 'colorful-flow.webp', 'Colorful Flow', '流動', 'Flow'],
  [V + 'love-energy-field.webp', 'Love Energy Field', '能量', 'Energy'],
  [V + 'flower-heart-bloom.webp', 'Flower Heart Bloom', '綻放', 'Bloom'],
  [V + 'heart-rebuild.webp', 'Heart Rebuild', '重建', 'Rebuild'],
  ['/assets/6c165bd1deb30988.webp', 'Life Bloom', '生長', 'Growth'],
  ['/assets/bb5c9cf38f67af5b.webp', 'Universe Heart Bloom', '宇宙', 'Universe'],
  ['/assets/85b757c169e7afd6.webp', 'Joyful World', '喜悅', 'Joy'],
  ['/assets/2ee9aa3b017652d9.webp', 'Infinite Love', '無限', 'Infinite'],
  [V + 'heart-energy.webp', 'Heart Energy', '心力', 'Heart power'],
  [V + 'natures-strength.webp', 'Nature’s Strength', '自然之力', 'Nature’s strength'],
  ['/assets/cfda3a3a0f7fa43d.webp', 'Universe Abundance', '豐盛', 'Abundance'],
  [V + 'fun-universe.webp', 'Fun Universe', '玩心', 'Play'],
  [V + 'marvellous-energy-world.webp', 'Marvellous Energy World', '奇妙', 'Marvel'],
  [V + 'infinite-love-strength.webp', 'Infinite Love Strength', '力量', 'Strength']
];
const C = [ // zh, en, placeholder, paintings, blessings, steps
  ['創作', 'Create', '例：完成一本自己的繪本', [4, 15, 16],
    ['你心裡的畫面，值得被看見。', '慢慢做，做出來的都是你。', '世界在等你的作品。'],
    ['今天畫或寫 10 分鐘，不打分數。', '把想法寫成三行，存進手機。', '找一件喜歡的作品，寫下喜歡的原因。']],
  ['健康', 'Health', '例：每天睡飽、身體輕盈', [2, 13, 7],
    ['你的身體一直在為你努力，謝謝它。', '每天好一點點，就很好。', '先照顧好自己，再照顧世界。'],
    ['今天散步 15 分鐘。', '今晚比平常早 30 分鐘睡。', '今天喝滿 6 杯水。']],
  ['旅行', 'Journey', '例：明年去看一次極光', [3, 1, 9],
    ['世界很大，你的腳步剛剛好。', '想去的地方，已經在等你了。', '出發，就是旅程的一半。'],
    ['把想去的地方寫下來，加上一個日期。', '查一張車票或機票的價格。', '這週去一個沒去過的街區走走。']],
  ['學習', 'Learn', '例：學會用日文聊天', [8, 5, 16],
    ['你學會的每一點，都會在未來發光。', '不急，懂了就是你的。', '好奇心是最好的老師。'],
    ['今天學一個新詞，教給一個人。', '找一本書或一堂課，讀完第一章。', '每天固定 15 分鐘，從今天開始。']],
  ['愛與家', 'Love & home', '例：和家人多一點時間', [0, 11, 10],
    ['願你被好好地愛，也好好地愛人。', '家，是有人等你回來的地方。', '愛一直都在，只是需要說出口。'],
    ['今天打一通電話給想念的人。', '為家人做一件小事，不說也沒關係。', '寫一張小紙條，說謝謝。']],
  ['事業', 'Work', '例：開一間自己的小店', [12, 14, 17],
    ['你的努力，會在對的時候開花。', '相信自己，你比想像中更準備好了。', '一步一步，就是最快的路。'],
    ['把目標拆成三步，今天完成第一步。', '主動聯絡一個能幫你的人。', '整理一份你最得意的作品清單。']],
  ['平靜', 'Peace', '例：心裡不再那麼急', [5, 6, 13],
    ['願你心裡有一片安靜的湖。', '放下一點，就輕一點。', '此刻的你，已經足夠。'],
    ['今天安靜地呼吸三分鐘。', '睡前放下手機十分鐘。', '寫下三件今天感謝的事。']],
  ['做自己', 'Be myself', '例：勇敢說出自己想要的', [17, 3, 15],
    ['你本來的樣子，就很好。', '勇敢不是不怕，是怕了還願意走。', '你的光，不需要誰的允許。'],
    ['今天做一個讓你自在的小選擇。', '說出一句真心話。', '把一直想做的事，排進行事曆。']]
];
const MINE = 'ae_dream_mine_v1', GOT = 'ae_dream_got_v1';
const $ = (id) => document.getElementById(id);
const clean = (v, n) => String(v || '').replace(/[<>`\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const S = { mode: '', role: 'make', to: '', from: '', c: -1, dr: '', p: -1, bl: '', st: '', d: '', accepted: '', steps: [], reply: false };
const dLabel = (d) => d ? d.slice(0, 4) + '.' + d.slice(4, 6) + '.' + d.slice(6) : G.today();
const nowD = () => { const d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

/* ---------- URL in ---------- */
const q = new URLSearchParams(location.search);
function fromQuery() {
  if (!q.has('c') || !q.has('p')) return false;
  const c = Number(q.get('c')), p = Number(q.get('p'));
  if (!(Number.isInteger(c) && c >= 0 && c < C.length && Number.isInteger(p) && p >= 0 && p < P.length)) return false;
  S.c = c; S.p = p; S.to = G.cleanName(q.get('to')); S.from = G.cleanName(q.get('fr'));
  S.dr = clean(q.get('dr'), 40); S.bl = clean(q.get('bl'), 40) || C[c][4][0]; S.st = clean(q.get('st'), 32) || C[c][5][0];
  S.d = /^\d{8}$/.test(q.get('d') || '') ? q.get('d') : '';
  return true;
}
const giftKey = () => G.hash32([S.to, S.from, S.c, S.dr, S.p, S.bl, S.st, S.d].join('|')).toString(36);

/* ---------- wizard ---------- */
function show(n) {
  ['w0', 'w1', 'w2', 'w3', 'w4', 'w5'].forEach((id, i) => { $(id).hidden = i !== n; });
  $('steps').hidden = n === 0;
  document.querySelectorAll('#steps li').forEach((li) => { const s = Number(li.dataset.s); li.className = s < n ? 'done' : (s === n ? 'on' : ''); });
  if (n > 0) setTimeout(() => $(n === 5 ? 'w5' : 'steps').scrollIntoView({ behavior: G.reduce ? 'auto' : 'smooth', block: 'start' }), 60);
  if (n === 5) prepSeal();
}
document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => show(Number(b.dataset.back))));
const give = () => S.mode === 'give';
const who = () => give() ? (S.to || '他') : '你';
function pickMode(m) {
  S.mode = m;
  $('mGive').setAttribute('aria-pressed', String(m === 'give')); $('mSelf').setAttribute('aria-pressed', String(m === 'self'));
  $('toWrap').hidden = !give(); $('fromWrap').hidden = !give();
  $('t1').innerHTML = give() ? '① 他的夢想是什麼？<span class="en">What is their dream?</span>' : '① 你的夢想是什麼？<span class="en">What is your dream?</span>';
  $('drLabel').textContent = give() ? '用一句話寫下他的夢（選填）· Their dream in one line' : '用一句話寫下你的夢（選填）· Your dream in one line';
  G.chime('tap', m === 'give' ? .3 : .7);
  show(1);
}
$('mGive').addEventListener('click', () => pickMode('give'));
$('mSelf').addEventListener('click', () => pickMode('self'));

// ① dream
C.forEach(([zh, en], i) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'g-chip'; b.dataset.i = i; b.setAttribute('aria-pressed', 'false');
  b.innerHTML = zh + '<small>' + en + '</small>';
  b.addEventListener('click', () => {
    if (S.c !== i) { S.p = -1; S.bl = ''; S.st = ''; $('bless').value = ''; $('step').value = ''; }
    S.c = i; document.querySelectorAll('#cats .g-chip').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.i) === i)));
    $('dream').placeholder = C[i][2]; G.burstAt(b, { n: 10, speed: 1.8 }); G.chime('tap', i / 8); $('n1').disabled = false;
  });
  $('cats').appendChild(b);
});
const counter = (inp, out, n) => inp.addEventListener('input', () => { $(out).textContent = inp.value.length + '/' + n; });
counter($('dream'), 'drCount', 40);
$('n1').addEventListener('click', () => { S.to = G.cleanName($('toName').value); S.dr = clean($('dream').value, 40); buildPaints(); show(2); });

// ② painting
function paintBtn(i, big) {
  const [src, title, zh, en] = P[i];
  const b = document.createElement('button'); b.type = 'button'; b.dataset.i = i; b.setAttribute('aria-pressed', String(S.p === i));
  if (big) { b.className = 'paint'; b.innerHTML = '<img src="' + src + '" alt="" loading="lazy"><b>' + zh + '<small>' + en + '</small></b><span>原作《' + title + '》</span>'; }
  else { b.innerHTML = '<img src="' + src + '" alt="' + title + '" loading="lazy">'; b.title = title; }
  b.addEventListener('click', () => {
    S.p = i; document.querySelectorAll('#paints .paint, #allP button').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.i) === i)));
    G.burstAt(b, { n: 14, speed: 2 }); G.chime('tap', .5); $('n2').disabled = false;
  });
  return b;
}
function buildPaints() {
  $('paints').innerHTML = ''; C[S.c][3].forEach((i) => $('paints').appendChild(paintBtn(i, true)));
  $('allP').innerHTML = ''; P.forEach((_, i) => $('allP').appendChild(paintBtn(i, false)));
  $('n2').disabled = S.p < 0;
}
$('moreP').addEventListener('click', () => { $('allP').hidden = !$('allP').hidden; });
$('n2').addEventListener('click', () => { buildSugs(); show(3); });

// ③ blessing  ④ step
function sugList(box, list, target, after) {
  box.innerHTML = '';
  list.forEach((t) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sug'; b.textContent = t; b.addEventListener('click', () => { $(target).value = t; $(target).dispatchEvent(new Event('input')); G.chime('tap', .6); after && after(); }); box.appendChild(b); });
}
function buildSugs() {
  $('t3').innerHTML = give() ? '③ 寫一句給' + (S.to ? '「' + S.to + '」' : '他') + '的祝福<span class="en">A blessing for them</span>' : '③ 寫一句給自己的話<span class="en">A line for yourself</span>';
  $('t4').innerHTML = give() ? '④ 送他一個第一小步<span class="en">A first small step for them</span>' : '④ 承諾你的第一小步<span class="en">Commit to your first small step</span>';
  sugList($('blSug'), C[S.c][4], 'bless'); sugList($('stSug'), C[S.c][5], 'step');
  $('n3').disabled = !$('bless').value.trim(); $('n4').disabled = !$('step').value.trim();
}
$('bless').addEventListener('input', () => { $('blCount').textContent = $('bless').value.length + '/40'; $('n3').disabled = !$('bless').value.trim(); });
$('step').addEventListener('input', () => { $('stCount').textContent = $('step').value.length + '/32'; $('n4').disabled = !$('step').value.trim(); });
$('n3').addEventListener('click', () => { S.bl = clean($('bless').value, 40); show(4); });
$('n4').addEventListener('click', () => { S.st = clean($('step').value, 32); show(5); });

// ⑤ seal (press and hold)
async function prepSeal() {
  $('t5').innerHTML = give() ? '⑤ 封緘這份夢想<span class="en">Seal the dream</span>' : '⑤ 承諾這個夢<span class="en">Commit to the dream</span>';
  $('sealCh').textContent = give() ? '封' : '諾';
  $('sealTxt').textContent = give() ? '按住封緘 HOLD' : '按住承諾 HOLD';
  $('sealNote').textContent = give() ? '按住火漆印，直到金圈走滿。Hold the seal until the gold ring is full.' : '按住，直到金圈走滿——這是你對自己的承諾。Hold until the ring is full — your promise to yourself.';
  S.d = nowD(); S.role = 'make';
  try { const c = await drawCard(); $('preview').src = c.toDataURL('image/png'); } catch (e) {}
}
$('pvBtn').addEventListener('click', () => { const w = $('sealWrap'), big = w.classList.toggle('big'); $('pvTxt').textContent = big ? '點一下縮小 · Tap to shrink' : '點一下放大 · Tap to enlarge'; if (!big) $('seal').scrollIntoView({ block: 'nearest' }); });
$('fromName').addEventListener('input', () => { clearTimeout(prepSeal.t); prepSeal.t = setTimeout(() => { S.from = G.cleanName($('fromName').value); prepSeal(); }, 300); });
function holdButton(el, ms, done) {
  let t0 = 0, raf = 0, holding = false;
  const tick = (now) => {
    if (!holding) return;
    const p = Math.min(1, (now - t0) / ms); el.style.setProperty('--p', p.toFixed(3));
    if (p >= 1) { holding = false; el.classList.remove('on'); done(); return; }
    if (Math.round(p * 10) !== Math.round((p - .02) * 10)) G.buzz(6);
    raf = requestAnimationFrame(tick);
  };
  const on = (e) => { if (e) { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) {} } holding = true; t0 = performance.now(); el.classList.add('on'); G.chime('tap', .4); raf = requestAnimationFrame(tick); };
  const off = () => { if (!holding) return; holding = false; cancelAnimationFrame(raf); el.classList.remove('on'); el.style.setProperty('--p', 0); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !holding && !e.repeat) { e.preventDefault(); on(); } });
  el.addEventListener('keyup', off);
}
holdButton($('seal'), 1600, async () => {
  S.from = G.cleanName($('fromName').value);
  G.burstAt($('seal'), { n: 60, colors: ['gold', 'rose', 'white'], speed: 4.4, size: 2.8, decay: .012 }); G.chime('glow'); G.buzz([30, 50, 40]);
  if (!give()) { S.accepted = S.d; S.steps = [{ t: S.st, d: S.d, done: '' }]; store(MINE, { c: S.c, dr: S.dr, p: S.p, bl: S.bl, d: S.d, steps: S.steps }); }
  ['w5'].forEach((id) => { $(id).hidden = true; }); $('steps').hidden = true; $('w0').hidden = true;
  S.role = give() ? 'sent' : 'self';
  await showResult(true);
});

/* ---------- the card (1080×1920) ---------- */
let imgCache = {};
async function img(src) { if (!imgCache[src]) imgCache[src] = await G.loadImg(src); return imgCache[src]; }
function stamp(ctx, x, y, r, rgb, l1, l2) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.12);
  ctx.strokeStyle = `rgba(${rgb},.9)`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r - 10, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = `rgba(${rgb},.08)`; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  G.text(ctx, l1, 0, -2, { font: '600 32px ' + G.FONT_ZH, color: `rgb(${rgb})` });
  G.text(ctx, l2, 0, 34, { font: '500 20px ' + G.FONT_EN, color: `rgb(${rgb})`, spacing: 2 });
  ctx.restore();
}
async function drawCard() {
  const c = $('cardCanvas'), ctx = c.getContext('2d'), W = 1080, H = 1920;
  await G.fontsReady();
  const [src, title, pzh, pen] = P[S.p], im = await img(src);
  const ZH = G.FONT_ZH, EN = G.FONT_EN;
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#17120d'); bg.addColorStop(.6, '#0d0b09'); bg.addColorStop(1, '#0a0908');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(231,189,103,.32)'; ctx.lineWidth = 2; ctx.strokeRect(28, 28, W - 56, H - 56);
  G.text(ctx, 'AE UNIVERSE CREATION  ·  夢想給予 DREAM GIVER', W / 2, 92, { font: '500 23px ' + EN, color: '#e7bd67', spacing: 6 });
  const isGift = S.mode === 'give' || S.role === 'got' || S.role === 'sent' || S.role === 'back';
  const head = isGift ? (S.to ? '給 ' + S.to + ' 的夢想卡' : '給你的夢想卡') : '我的夢想卡';
  G.text(ctx, head, W / 2, 168, { font: '600 58px ' + ZH, spacing: 6 });
  G.text(ctx, isGift ? 'A dream, given' + (S.to ? ' to ' + S.to : '') : 'My dream, committed', W / 2, 216, { font: 'italic 500 32px ' + EN, color: '#d9cfc0' });
  // painting — large, unaltered, contain-fit
  const portrait = im.naturalHeight > im.naturalWidth;
  const box = { x: 60, y: 262, w: 960, h: portrait ? 760 : 680 };
  const r = G.paintingInBox(ctx, im, box.x, box.y, box.w, box.h);
  // text block — drawn on a layer first, then centred in the space under the painting
  const L = document.createElement('canvas'); L.width = W; L.height = 1100; const lx = L.getContext('2d');
  let y = 40;
  G.text(lx, pzh + '  ·  ' + pen.toUpperCase(), W / 2, y, { font: '600 26px ' + EN, color: '#e7bd67', spacing: 6 });
  y += 86;
  const dream = S.dr || (C[S.c][0] + '的夢');
  G.text(lx, '夢想  DREAM', W / 2, y, { font: '500 22px ' + EN, color: '#9a8f80', spacing: 8 });
  y = G.text(lx, dream, W / 2, y + 70, { font: '600 60px ' + ZH, maxW: 900, lh: 78 });
  y = G.text(lx, '「' + S.bl + '」', W / 2, y + 84, { font: '500 40px ' + ZH, color: '#e9dcc4', maxW: 900, lh: 56 });
  y += 64;
  lx.strokeStyle = 'rgba(231,189,103,.45)'; lx.lineWidth = 2; lx.beginPath(); lx.moveTo(W / 2 - 160, y); lx.lineTo(W / 2 + 160, y); lx.stroke();
  const n = S.steps.length || 1, cur = S.steps.length ? S.steps[S.steps.length - 1].t : S.st;
  G.text(lx, (n > 1 ? '第 ' + n + ' 步' : '第一小步') + '  ·  ' + (n > 1 ? 'STEP ' + n : 'FIRST STEP'), W / 2, y + 64, { font: '600 26px ' + ZH, color: '#e7bd67', spacing: 4 });
  y = G.text(lx, cur, W / 2, y + 124, { font: '600 44px ' + ZH, maxW: 880, lh: 58 });
  const isG = S.mode === 'give' || ['got', 'sent', 'back'].includes(S.role);
  const sig = isG ? (S.from ? '— 來自 ' + S.from + '　' + dLabel(S.d) : '— ' + dLabel(S.d)) : '— 承諾於 ' + dLabel(S.d);
  y = G.text(lx, sig, W - 110, y + 92, { font: '500 32px ' + ZH, color: '#c9bfae', align: 'right' });
  const top = r.y + r.h + 20, bottom = 1630, hgt = y + 30;
  ctx.drawImage(L, 0, Math.max(top, top + (bottom - top - hgt) / 2));
  // stamps
  const doneN = S.steps.filter((s) => s.done).length;
  const marks = [];
  if (isGift && S.role !== 'make') marks.push(['231,189,103', '已封緘', 'SEALED']);
  if (S.accepted) marks.push(isGift ? ['141,255,228', '已收下', 'ACCEPTED'] : ['231,189,103', '已承諾', 'COMMITTED']);
  if (doneN) marks.push(['141,255,228', '已走 ' + doneN + ' 步', doneN + ' STEP' + (doneN > 1 ? 'S' : '') + ' ✓']);
  marks.forEach((m, k) => stamp(ctx, W / 2 + (k - (marks.length - 1) / 2) * 210, 1740, 86, ...m));
  G.text(ctx, '原作《' + title + '》· AE Universe Creation · 畫作保持原樣', W / 2, H - 60, { font: '500 23px ' + ZH, color: '#7d7366' });
  return c;
}

/* ---------- result ---------- */
function linkFor(extra) {
  const p = new URLSearchParams({ c: String(S.c), p: String(S.p), d: S.d });
  if (S.to) p.set('to', S.to); if (S.from) p.set('fr', S.from); if (S.dr) p.set('dr', S.dr);
  p.set('bl', S.bl); p.set('st', S.st);
  Object.entries(extra || {}).forEach(([k, v]) => p.set(k, v));
  return location.origin + '/dream-giver?' + p.toString();
}
function btn(label, cls, fn) { const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn' + (cls ? ' ' + cls : ''); b.innerHTML = label; b.addEventListener('click', fn); return b; }
function row(...bs) { const d = document.createElement('div'); d.className = 'row'; bs.forEach((b) => d.appendChild(b)); return d; }
const rNote = (t) => { $('rNote').textContent = t || ''; };
async function saveImg(name) { const c = await drawCard(); const ok = await G.saveCanvas(c, name); rNote(ok ? '已儲存。可以設成手機桌布，每天看見這個夢。Saved — set it as your wallpaper.' : ''); }
async function refresh() { try { const c = await drawCard(); $('cardImg').src = c.toDataURL('image/png'); } catch (e) { rNote('卡片圖片沒有生成，請重新整理。Card image failed — please reload.'); } }
function prog() {
  const box = $('prog'); box.innerHTML = '';
  const add = (t, ok) => { const i = document.createElement('i'); i.textContent = (ok ? '✓ ' : '○ ') + t; if (ok) i.className = 'ok'; box.appendChild(i); };
  if (S.role === 'sent') { add('寫下夢想', 1); add('選畫', 1); add('祝福', 1); add('第一步', 1); add('封緘', 1); add('送出', 0); return; }
  if (S.role === 'self') { add('許下夢想', 1); add('承諾', 1); S.steps.forEach((s, k) => add('第 ' + (k + 1) + ' 步', !!s.done)); return; }
  add('拆封', 1); add('收下這個夢', !!S.accepted); add('走出第一步', !!(S.steps[0] && S.steps[0].done)); add('回傳一道光', !!S.reply);
}
function saveGot() { const all = load(GOT) || {}; all[giftKey()] = { accepted: S.accepted, steps: S.steps, reply: S.reply }; store(GOT, all); }
function actions() {
  const a = $('acts'); a.innerHTML = ''; $('newStep').hidden = true;
  const [, title] = P[S.p];
  if (S.role === 'sent') {
    $('rGot').textContent = '你做出了 · YOU MADE';
    $('rTitle').innerHTML = '一份封好的夢想，準備送給' + (S.to ? '「' + S.to + '」' : '他') + '<span class="en">A sealed dream, ready to give</span>';
    $('reward').innerHTML = '<b>得到：</b>一張專屬的夢想卡——他的夢、原作《' + title + '》、你的祝福、一個第一小步，還有你的封緘。'
      + '<br><b>送出連結</b>後，他會收到一封要拆封的信，可以<b>收下這個夢</b>、完成第一步，再<b>傳一道光回給你</b>。'
      + '<span class="en">Yours to give: their dream, the painting, your blessing, a first step — sealed. Send the link; they open it, accept the dream, take the step and send a light back to you.</span>';
    a.appendChild(btn('送出這份夢想 <small>Send the dream</small>', '', async () => {
      const url = linkFor();
      const r = await G.shareLink(url, '夢想給予 Dream Giver', (S.from ? S.from + ' ' : '') + '送你一封夢想信，點開拆封 · A sealed dream for you');
      rNote(r === 'copied' ? '連結已複製，傳給' + (S.to || '他') + '吧。他拆封、收下後，可以傳一道光回給你。Link copied.' : (r === 'manual' ? url : (r === 'cancel' ? '' : '已送出。Sent.')));
      if (r !== 'cancel') { $('prog').lastChild.className = 'ok'; $('prog').lastChild.textContent = '✓ 送出'; }
    }));
    a.appendChild(row(btn('儲存圖片 <small>Save image</small>', 'ghost', () => saveImg('AE-DreamGiver-for-' + (S.to || 'you') + '.png')), btn('再送一個夢 <small>Another</small>', 'quiet', () => { location.href = '/dream-giver'; })));
  } else if (S.role === 'self') {
    const cur = S.steps[S.steps.length - 1], doneN = S.steps.filter((s) => s.done).length;
    $('rGot').textContent = '你許下了 · YOU COMMITTED';
    $('rTitle').innerHTML = '我的夢想卡<span class="en">My dream card</span>';
    $('reward').innerHTML = '<b>得到：</b>一張你承諾過的夢想卡——你的夢、原作《' + title + '》、給自己的一句話、眼前的一小步。'
      + '<br>做到了就回來按<b>「完成這一步」</b>，卡上會蓋章；再定下一步，夢就一步步走近。這張卡存在你的裝置裡' + (doneN ? '，目前已走了 <b>' + doneN + '</b> 步。' : '。')
      + '<span class="en">Your committed dream card. Come back, mark each step done to earn a stamp, then set the next one. Kept on this device.</span>';
    if (!cur.done) a.appendChild(btn('完成這一步 ✓ <small>Step done</small>', '', () => { cur.done = nowD(); persistMine(); G.burstAt($('cardImg'), { n: 50, colors: ['teal', 'gold', 'white'], speed: 3.6 }); G.chime('glow'); G.buzz([20, 30]); after(); }));
    else a.appendChild(btn('定下一步 → <small>Set the next step</small>', '', () => { $('newStep').hidden = false; sugList($('nsSug'), C[S.c][5], 'nsText'); $('nsText').focus(); }));
    a.appendChild(row(btn('儲存成手機桌布 <small>Save</small>', 'ghost', () => saveImg('AE-MyDream.png')), btn('送一個夢給別人 <small>Give one</small>', 'quiet', () => { location.href = '/dream-giver?mode=give'; })));
    a.appendChild(btn('重新許一個夢 <small>New dream</small>', 'quiet', () => { if (confirm('重新許一個夢？目前這張會被取代。Start a new dream? This one will be replaced.')) { try { localStorage.removeItem(MINE); } catch (e) {} location.href = '/dream-giver?mode=self'; } }));
  } else if (S.role === 'got') {
    $('rGot').textContent = (S.from ? S.from + ' 送你' : '有人送你') + ' · A DREAM FOR YOU';
    $('rTitle').innerHTML = '一個為你寫下的夢<span class="en">A dream written for you</span>';
    const step0 = S.steps[0];
    $('reward').innerHTML = '<b>得到：</b>' + (S.from ? '「' + S.from + '」' : '有人') + '為你寫下了夢想、選了原作《' + title + '》、寫了祝福，還替你想好第一小步。'
      + '<br>' + (!S.accepted ? '<b>收下這個夢</b>，卡上會蓋上「已收下」。' : (!step0.done ? '做到第一小步後，回來按<b>「我做到了」</b>。' : '<b>傳一道光回去</b>，讓他知道你收到了、也出發了。'))
      + '<span class="en">Someone wrote your dream, chose a painting, blessed it and set a first step. Accept it, take the step, then send a light back.</span>';
    if (!S.accepted) a.appendChild(btn('收下這個夢 <small>Accept the dream</small>', '', () => { S.accepted = nowD(); saveGot(); G.burstAt($('cardImg'), { n: 50, colors: ['teal', 'white', 'gold'], speed: 3.6 }); G.chime('glow'); G.buzz([20, 30]); after(); }));
    else if (!step0.done) a.appendChild(btn('我做到第一小步了 ✓ <small>I did the first step</small>', '', () => { step0.done = nowD(); saveGot(); G.burstAt($('cardImg'), { n: 50, colors: ['teal', 'gold', 'white'], speed: 3.6 }); G.chime('glow'); G.buzz([20, 30]); after(); }));
    if (S.accepted) a.appendChild(btn('傳一道光回去 <small>Send a light back</small>', S.steps[0].done ? '' : 'ghost', async () => {
      const url = linkFor({ r: '1', ac: S.accepted, dn: S.steps[0].done || '' });
      const r = await G.shareLink(url, '夢想給予 · 回光 A light back', '我收下了你給的夢' + (S.steps[0].done ? '，也走出了第一步' : '') + ' · I accepted the dream');
      if (r !== 'cancel') { S.reply = true; saveGot(); prog(); }
      rNote(r === 'copied' ? '連結已複製，傳回給' + (S.from || '他') + '。Link copied.' : (r === 'manual' ? url : (r === 'cancel' ? '' : '光已送回。Sent back.')));
    }));
    a.appendChild(row(btn('儲存成手機桌布 <small>Save</small>', 'ghost', () => saveImg('AE-DreamGiver-my-dream.png')), btn('也送一個夢 <small>Give one</small>', 'quiet', () => { location.href = '/dream-giver?mode=give'; })));
  } else if (S.role === 'back') {
    $('rGot').textContent = '一道光回來了 · A LIGHT CAME BACK';
    $('rTitle').innerHTML = (S.to ? '「' + S.to + '」' : '他') + '收下了你給的夢<span class="en">Your dream was accepted</span>';
    $('reward').innerHTML = '<b>' + (S.to || '他') + '</b>在 ' + dLabel(S.accepted) + ' 收下了這個夢' + (S.steps[0].done ? '，並在 ' + dLabel(S.steps[0].done) + ' <b>走出了第一步</b>。' : '，正準備走出第一步。')
      + '<span class="en">They accepted the dream' + (S.steps[0].done ? ' and took the first step.' : ' and are about to take the first step.') + '</span>';
    a.appendChild(row(btn('儲存圖片 <small>Save</small>', 'ghost', () => saveImg('AE-DreamGiver-light-back.png')), btn('再送一個夢 <small>Give another</small>', '', () => { location.href = '/dream-giver?mode=give'; })));
  }
  $('artThumb').src = P[S.p][0]; $('artName').textContent = '看原作《' + P[S.p][1] + '》';
  prog();
}
function persistMine() { store(MINE, { c: S.c, dr: S.dr, p: S.p, bl: S.bl, d: S.d, steps: S.steps }); }
async function after() { actions(); await refresh(); }
$('nsOk').addEventListener('click', () => {
  const t = clean($('nsText').value, 32); if (!t) { $('nsText').focus(); return; }
  S.steps.push({ t, d: nowD(), done: '' }); persistMine(); $('nsText').value = ''; G.chime('tap', .7); after();
});
async function showResult(scroll, rise) {
  $('result').hidden = false;
  actions(); await refresh();
  if (rise) { $('cardImg').classList.remove('rise'); void $('cardImg').offsetWidth; $('cardImg').classList.add('rise'); }
  if (scroll) setTimeout(() => $('result').scrollIntoView({ behavior: G.reduce ? 'auto' : 'smooth', block: 'start' }), 250);
  if (S.role === 'sent') history.replaceState(null, '', '/dream-giver?mode=give');
}

/* ---------- boot ---------- */
function bootRecipient() {
  S.mode = 'give'; S.steps = [{ t: S.st, d: S.d, done: '' }];
  const saved = (load(GOT) || {})[giftKey()];
  if (saved) { S.accepted = saved.accepted || ''; S.steps = saved.steps && saved.steps.length ? saved.steps : S.steps; S.reply = !!saved.reply; }
  $('w0').hidden = true; $('lead').hidden = true;
  $('env').hidden = false;
  $('envTo').innerHTML = '給 ' + (S.to || '你') + (S.from ? '　·　來自 ' + S.from : '') + '<span class="en">A sealed dream for ' + (S.to || 'you') + (S.from ? ' · from ' + S.from : '') + '</span>';
  $('banner').hidden = false;
  $('banner').innerHTML = (S.from ? '<b>' + S.from + '</b>' : '有人') + '為你寫下一個夢，封在這封信裡。按住火漆印拆開。<span class="en">Someone sealed a dream for you. Hold the seal to open.</span>';
  [$('banner'), $('envTo')].forEach((el) => el.querySelectorAll('b').forEach((b) => { b.textContent = b.textContent; }));
  holdButton($('envSeal'), 1000, async () => {
    G.burstAt($('envSeal'), { n: 60, colors: ['gold', 'rose', 'white'], speed: 4.2, size: 2.8, decay: .012 }); G.chime('glow'); G.buzz([20, 40, 30]);
    $('env').classList.add('open');
    await new Promise((r) => setTimeout(r, G.reduce ? 0 : 900));
    $('env').hidden = true; $('banner').hidden = true; S.role = 'got';
    await showResult(true, true);
  });
}
function bootBack() {
  S.mode = 'give'; S.role = 'back';
  S.accepted = /^\d{8}$/.test(q.get('ac') || '') ? q.get('ac') : nowD();
  S.steps = [{ t: S.st, d: S.d, done: /^\d{8}$/.test(q.get('dn') || '') ? q.get('dn') : '' }];
  S.reply = true;
  $('w0').hidden = true; $('lead').hidden = true;
  $('banner').hidden = false; $('banner').textContent = '✦ ' + (S.to || '他') + ' 傳了一道光回來 · A light came back to you';
  G.chime('glow');
  showResult(false, true);
}
function bootMine(m) {
  S.mode = 'self'; S.role = 'self'; S.c = m.c; S.dr = m.dr; S.p = m.p; S.bl = m.bl; S.d = m.d; S.steps = m.steps; S.accepted = m.d; S.st = m.steps[0].t;
  $('w0').hidden = true; showResult(false);
}
function escapeHTML(s) { return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
(function boot() {
  // sanitize names before any innerHTML use
  if (fromQuery()) {
    S.to = escapeHTML(S.to); S.from = escapeHTML(S.from);
    if (q.get('r') === '1') bootBack(); else bootRecipient();
    return;
  }
  const mine = load(MINE);
  const m = q.get('mode');
  if (m === 'give') { pickMode('give'); return; }
  if (m === 'self' && !mine) { pickMode('self'); return; }
  if (mine && mine.steps && mine.steps.length && Number.isInteger(mine.p) && P[mine.p] && C[mine.c]) {
    if (m === 'self') { bootMine(mine); return; }
    $('resume').hidden = false;
    $('resume').innerHTML = '你有一張正在進行的夢想卡（已走 ' + mine.steps.filter((s) => s.done).length + ' 步）。<span class="en">You have a dream in progress.</span>';
    const b = btn('繼續我的夢 <small>Continue</small>', 'ghost', () => bootMine(mine)); b.style.marginTop = '10px'; $('resume').appendChild(b);
  }
})();
})();
