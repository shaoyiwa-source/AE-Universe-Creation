// AE Lumina Wall — application controller (r1)
import { db, loadSettings, saveSettings, lsGet, lsSet } from './store.js';
import { Sound } from './audio.js';
import { FX } from './fx.js';
import { runTransition, resetSlide, TRANSITIONS } from './transitions.js';
import { STR, OPTIONS } from './i18n.js';

const $ = (s, r = document) => r.querySelector(s);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Built-in collection (AE curated 27, v2393) ----------
const BUILTIN = [
  ['Eternal Sun', 'assets/4e0991885a9649ea.webp'], ['Infinity Core', 'assets/b46ca2328e93f1f4.webp'],
  ['Universe Heart Bloom', 'assets/bb5c9cf38f67af5b.webp'], ['Infinite Love', 'assets/2ee9aa3b017652d9.webp'],
  ['Life Energy Field', 'assets/52116e7d3550cdf1.webp'], ['Life Bloom', 'assets/6c165bd1deb30988.webp'],
  ['Joyful World', 'assets/85b757c169e7afd6.webp'], ['Universe Abundance', 'assets/cfda3a3a0f7fa43d.webp'],
  ['Heart Fly', 'assets/selected-works-v2/heart-fly.webp'], ['Heart Recovery', 'assets/selected-works-v2/heart-recovery.webp'],
  ['Love Embrace', 'assets/selected-works-v2/love-embrace.webp'], ['Love Energy Field', 'assets/selected-works-v2/love-energy-field.webp'],
  ['Colorful Flow', 'assets/selected-works-v2/colorful-flow.webp'], ['Nature’s Strength', 'assets/selected-works-v2/natures-strength.webp'],
  ['Fun Universe', 'assets/selected-works-v2/fun-universe.webp'], ['Marvellous Energy World', 'assets/selected-works-v2/marvellous-energy-world.webp'],
  [null, 'assets/selected-works-v2/selected-17.webp'], ['Expansion', 'assets/selected-works-v2/expansion.webp'],
  ['Heart Rebuild', 'assets/selected-works-v2/heart-rebuild.webp'], ['Flower Heart Bloom', 'assets/selected-works-v2/flower-heart-bloom.webp'],
  ['Heart Energy', 'assets/selected-works-v2/heart-energy.webp'], ['Infinite Love Strength', 'assets/selected-works-v2/infinite-love-strength.webp'],
  [null, 'assets/selected-works-v2/selected-23.webp'], [null, 'assets/selected-works-v2/selected-24.webp'],
  [null, 'assets/selected-works-v2/selected-25.webp'], [null, 'assets/selected-works-v2/selected-26.webp'],
  [null, 'assets/selected-works-v2/selected-27.webp'],
].map(([title, src], i) => ({ id: 'ae' + String(i + 1).padStart(2, '0'), no: i + 1, title, src, builtin: true }));

const DEFAULTS = {
  mode: 'online', adjusted: false, transition: 'random', interval: 10,
  effects: { echo: true, breath: false, stardust: true, aurora: false, petals: false, lasers: false, neon: false },
  interact: { ripple: true, chime: true, lumi: true, seeds: true },
  display: { captions: true, mat: true, drift: true, shuffle: false, loop: true },
  music: 'celestial', volume: 0.6, selected: [], musicName: '',
};

const S = loadSettings(DEFAULTS);
let lang = lsGet('ae-language', 'zh') === 'en' ? 'en' : 'zh';
const T = (k, ...a) => { const v = STR[lang][k]; return typeof v === 'function' ? v(...a) : v; };
const L = (o) => o[lang];
const modeOf = (id) => OPTIONS.modes.find(m => m.id === id) || OPTIONS.modes.find(m => m.id === 'online');

// ---------- AE Studio (hidden curator entrance) ----------
// Customers cannot add works. AE unlocks the studio by long-pressing the Three Rings mark (3 s) + password.
// NOTE (R2): checked in the browser against a salted PBKDF2 hash — a placeholder gate. R3 moves this to the server.
const STUDIO_SALT = '577221ecad4d1dab8fb0f88a5c68b057';
const STUDIO_HASH = '6330e9e9a9c4770fea436c54379e43146b922758972a622c0674c9109b49d56d';
let studio = false;
try { studio = sessionStorage.getItem('ae-studio') === '1'; } catch { studio = false; }
async function verifyStudio(pw) {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const salt = new Uint8Array(STUDIO_SALT.match(/../g).map(h => parseInt(h, 16)));
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 250000 }, key, 256);
    const hex = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
    return hex === STUDIO_HASH;
  } catch { return false; }
}
function setStudio(on) {
  studio = on;
  try { if (on) sessionStorage.setItem('ae-studio', '1'); else sessionStorage.removeItem('ae-studio'); } catch { /* ignore */ }
  document.documentElement.classList.toggle('studio', on);
  document.querySelectorAll('[data-studio]').forEach(el => { el.hidden = !on; });
  if (!on && S.music === 'custom') S.music = modeOf(S.mode).set.music;
  renderWall(); renderSettings();
}

let works = [...BUILTIN];
let persistOK = true;
const sound = new Sound();
sound.setVolume(S.volume);

// ---------- Toast ----------
let toastTimer;
function toast(msg, ms = 3200) {
  const el = $('#toast');
  el.textContent = msg; el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// ---------- i18n ----------
function applyLang() {
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = T(el.dataset.i18n); if (typeof v === 'string') el.textContent = v; });
  $('#langToggle').textContent = lang === 'zh' ? 'EN' : '中文';
  $('#langToggle').setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切換至中文');
  fx.lang = lang;
  renderWall(); renderSettings(); updateMusicNote();
}
$('#langToggle').addEventListener('click', () => { lang = lang === 'zh' ? 'en' : 'zh'; lsSet('ae-language', lang); applyLang(); });

// ---------- Works / wall ----------
const titleOf = (w) => w.title || T('untitled', w.no);
const wall = $('#wall');

function renderWall() {
  const frag = document.createDocumentFragment();
  works.forEach((w, i) => {
    const sel = S.selected.indexOf(w.id);
    const el = document.createElement('div');
    el.className = 'screen' + (sel >= 0 ? ' selected' : '');
    el.dataset.id = w.id;
    el.style.animationDelay = `${Math.min(i, 24) * 40}ms`;
    const no = String(i + 1).padStart(2, '0');
    el.innerHTML = `
      <button type="button" class="screen-hit" aria-pressed="${sel >= 0}" aria-label="${escapeHtml(titleOf(w))}">
        <span class="screen-bg"></span>
        <img class="screen-art" alt="" loading="lazy" decoding="async" draggable="false">
        <span class="screen-glass"></span>
        <span class="screen-meta"><b>${no}</b><em></em></span>
      </button>
      <span class="screen-badge" aria-hidden="true">${sel >= 0 ? sel + 1 : ''}</span>
      ${w.builtin ? '' : `<span class="screen-tag">${escapeHtml(T('yours'))}</span>`}
      <span class="screen-actions">
        <button type="button" class="screen-act play" data-act="play" aria-label="${escapeHtml(T('playFrom'))}" title="${escapeHtml(T('playFrom'))}"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg></button>
        ${w.builtin || !studio ? '' : `<button type="button" class="screen-act" data-act="remove" aria-label="${escapeHtml(T('remove'))}" title="${escapeHtml(T('remove'))}"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`}
      </span>`;
    el.querySelector('.screen-art').src = w.src;
    el.querySelector('.screen-bg').style.backgroundImage = `url("${w.src}")`;
    el.querySelector('em').textContent = titleOf(w);
    frag.appendChild(el);
  });
  wall.replaceChildren(frag);
  updateCount();
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function updateCount() {
  $('#selCount').textContent = S.selected.length;
  $('#allCount').textContent = works.length;
}
function refreshBadges() {
  wall.querySelectorAll('.screen').forEach(el => {
    const i = S.selected.indexOf(el.dataset.id);
    el.classList.toggle('selected', i >= 0);
    el.querySelector('.screen-badge').textContent = i >= 0 ? i + 1 : '';
    el.querySelector('.screen-hit').setAttribute('aria-pressed', String(i >= 0));
  });
  updateCount();
  saveSettings(S);
}

wall.addEventListener('click', async (e) => {
  const screen = e.target.closest('.screen'); if (!screen) return;
  const id = screen.dataset.id;
  const act = e.target.closest('[data-act]');
  if (act?.dataset.act === 'play') { openPlayer(id); return; }
  if (act?.dataset.act === 'remove' && studio) { await removeWork(id); return; }
  if (e.target.closest('.screen-hit')) {
    const i = S.selected.indexOf(id);
    if (i >= 0) S.selected.splice(i, 1); else S.selected.push(id);
    refreshBadges();
  }
});
$('#selectAll').addEventListener('click', () => { for (const w of works) if (!S.selected.includes(w.id)) S.selected.push(w.id); refreshBadges(); });
$('#clearSel').addEventListener('click', () => { S.selected = []; refreshBadges(); });
$('#playBtn').addEventListener('click', () => openPlayer(null));

// gentle gloss sweep across the wall
setInterval(() => {
  if (!player.hidden || document.hidden) return;
  const tiles = wall.querySelectorAll('.screen'); if (!tiles.length) return;
  const el = tiles[Math.floor(Math.random() * tiles.length)];
  el.classList.add('gloss'); setTimeout(() => el.classList.remove('gloss'), 2500);
}, 2200);

// ---------- Uploads ----------
async function loadUploads() {
  try {
    const rows = await db.all('works');
    rows.sort((a, b) => a.added - b.added);
    for (const r of rows) works.push({ id: r.id, title: r.title, src: URL.createObjectURL(r.blob), builtin: false, no: 0 });
    const m = await db.get('media', 'music');
    if (m?.blob) { sound.setCustom(m.blob); S.musicName = m.name || S.musicName; }
  } catch { persistOK = false; }
  if (S.music === 'custom' && (!sound.customUrl || !studio)) S.music = modeOf(S.mode).set.music;
  if (!OPTIONS.music.some(o => o.id === S.music)) S.music = modeOf(S.mode).set.music;
  const ids = new Set(works.map(w => w.id));
  S.selected = S.selected.filter(id => ids.has(id));
}

async function fileToImageBlob(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url;
    await img.decode();
    const max = 2560, w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) throw new Error('empty');
    if (Math.max(w, h) <= max && /image\/(jpeg|png|webp|gif|avif)/.test(file.type)) return file;
    const s = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('encode')), 'image/jpeg', 0.92));
  } finally { URL.revokeObjectURL(url); }
}

async function addFiles(files) {
  if (!studio) return;
  const list = [...files].filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|heic)$/i.test(f.name));
  if (!list.length) return;
  let ok = 0, failed = 0;
  for (const f of list) {
    try {
      const blob = await fileToImageBlob(f);
      const id = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const title = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 80) || 'Untitled';
      if (persistOK) { try { await db.put('works', { id, title, blob, added: Date.now() }); } catch { persistOK = false; toast(T('noPersist'), 5000); } }
      works.push({ id, title, src: URL.createObjectURL(blob), builtin: false, no: 0 });
      S.selected.push(id);
      ok++;
    } catch { failed++; }
  }
  renderWall(); saveSettings(S);
  if (ok) toast(T('added', ok)); else if (failed) toast(T('addFailed'));
  if (ok) wall.lastElementChild?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
}
$('#fileInput').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });

async function removeWork(id) {
  if (!confirm(T('confirmRemove'))) return;
  const w = works.find(x => x.id === id); if (!w || w.builtin) return;
  works = works.filter(x => x.id !== id);
  S.selected = S.selected.filter(x => x !== id);
  try { await db.del('works', id); } catch { /* ignore */ }
  URL.revokeObjectURL(w.src);
  renderWall(); saveSettings(S);
}

// drag & drop anywhere
const drop = $('#dropZone'); let dragDepth = 0;
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragenter', (e) => { if (!studio || !hasFiles(e) || !player.hidden) return; e.preventDefault(); dragDepth++; drop.hidden = false; });
window.addEventListener('dragover', (e) => { if (studio && hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) drop.hidden = true; });
window.addEventListener('drop', (e) => { if (!studio || !hasFiles(e)) return; e.preventDefault(); dragDepth = 0; drop.hidden = true; if (player.hidden) addFiles(e.dataTransfer.files); });

// ---------- Settings sheet ----------
const sheet = $('#settings'), scrim = $('#scrim');
function openSheet() { renderSettings(); sheet.hidden = false; scrim.hidden = false; $('#closeSettings').focus(); showControls(); }
function closeSheet() { const had = !sheet.hidden; sheet.hidden = true; scrim.hidden = true; if (had && !player.hidden) player.focus({ preventScroll: true }); }
$('#openSettings').addEventListener('click', openSheet);
$('#closeSettings').addEventListener('click', closeSheet);
scrim.addEventListener('click', closeSheet);

function chip(label, pressed, ae, onClick) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'lw-chip'; b.setAttribute('aria-pressed', String(pressed));
  b.textContent = label;
  if (ae) { const s = document.createElement('span'); s.className = 'ae'; s.textContent = 'AE'; b.appendChild(s); }
  b.addEventListener('click', onClick);
  return b;
}
function toggle(opt, on, onClick) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'lw-toggle'; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(on));
  b.innerHTML = `<span class="lw-toggle-text"><b></b><small></small></span><span class="lw-switch" aria-hidden="true"></span>`;
  b.querySelector('b').textContent = L(opt);
  if (opt.ae) { const s = document.createElement('span'); s.className = 'ae'; s.textContent = 'AE'; b.querySelector('b').appendChild(s); }
  b.querySelector('small').textContent = lang === 'zh' ? opt.dzh : opt.den;
  b.addEventListener('click', onClick);
  return b;
}

function renderSettings() {
  const modes = $('#modeCards'); modes.replaceChildren();
  for (const m of OPTIONS.modes) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lw-mode'; b.dataset.mode = m.id; b.setAttribute('aria-pressed', String(S.mode === m.id));
    b.innerHTML = '<b></b><i></i><small></small>';
    b.querySelector('b').textContent = m.zh === L(m) ? m.zh : m.en;
    b.querySelector('i').textContent = lang === 'zh' ? m.en : m.zh;
    b.querySelector('small').textContent = lang === 'zh' ? m.dzh : m.den;
    b.addEventListener('click', () => applyMode(m));
    modes.appendChild(b);
  }
  const rs = $('#resetMode');
  rs.hidden = !S.adjusted;
  rs.textContent = `${T('adjusted')} · ${T('resetMode')}`;
  const adj = () => { S.adjusted = true; };
  const tr = $('#transitionChips'); tr.replaceChildren();
  for (const o of OPTIONS.transitions) tr.appendChild(chip(L(o), S.transition === o.id, o.ae, () => { S.transition = o.id; adj(); commit(); }));
  const ef = $('#effectToggles'); ef.replaceChildren();
  for (const o of OPTIONS.effects) ef.appendChild(toggle(o, S.effects[o.id], () => { S.effects[o.id] = !S.effects[o.id]; adj(); commit(); }));
  const it = $('#interactToggles'); it.replaceChildren();
  for (const o of OPTIONS.interact) it.appendChild(toggle(o, S.interact[o.id], () => { S.interact[o.id] = !S.interact[o.id]; adj(); commit(); }));
  const di = $('#displayToggles'); di.replaceChildren();
  for (const o of OPTIONS.display) di.appendChild(toggle(o, S.display[o.id], () => { S.display[o.id] = !S.display[o.id]; adj(); commit(); if (o.id === 'mat' && !player.hidden) layout(); }));
  const mu = $('#musicChips'); mu.replaceChildren();
  for (const o of OPTIONS.music) {
    if (o.studio && (!studio || !sound.customUrl)) continue;
    mu.appendChild(chip(L(o), S.music === o.id, false, () => { const changed = S.music !== o.id; S.music = o.id; adj(); commit(changed); }));
  }
  const iv = $('#interval'); iv.value = S.interval; $('#intervalOut').textContent = S.interval + 's';
  const vo = $('#volume'); vo.value = S.volume; $('#volumeOut').textContent = Math.round(S.volume * 100) + '%';
  updateMusicNote();
}
function updateMusicNote() { $('#musicNote').textContent = sound.customUrl && S.musicName ? T('customMusic', S.musicName) : ''; }

function applyMode(m) {
  const set = m.set;
  S.mode = m.id; S.adjusted = false;
  for (const k of Object.keys(S.effects)) S.effects[k] = set.effects.includes(k);
  for (const k of Object.keys(S.interact)) S.interact[k] = set.interact.includes(k);
  Object.assign(S.display, set.display);
  S.interval = set.interval;
  S.transition = 'random';
  const musicChanged = S.music !== set.music;
  S.music = set.music;
  commit(musicChanged);
  if (!player.hidden) layout();
}
$('#resetMode').addEventListener('click', () => applyMode(modeOf(S.mode)));

function commit(musicChanged = false) {
  saveSettings(S);
  renderSettings();
  applyLive();
  if (musicChanged && !player.hidden) startMusic();
}

$('#interval').addEventListener('input', (e) => { S.interval = +e.target.value; $('#intervalOut').textContent = S.interval + 's'; saveSettings(S); });
$('#volume').addEventListener('input', (e) => { S.volume = +e.target.value; $('#volumeOut').textContent = Math.round(S.volume * 100) + '%'; sound.setVolume(S.volume); saveSettings(S); });
$('#musicInput').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f || !studio) return;
  sound.setCustom(f);
  S.musicName = f.name.replace(/\.[^.]+$/, '');
  S.music = 'custom';
  try { await db.put('media', { id: 'music', blob: f, name: S.musicName }); } catch { /* session only */ }
  toast(T('musicSaved', S.musicName));
  commit(true);
});

// ---------- Player ----------
const player = $('#player');
const stage = $('#stage');
const slides = [$('#slideA'), $('#slideB')];
const ambs = [$('#ambA'), $('#ambB')];
const neon = $('#neon');
const fxCanvas = $('#fx');
const fx = new FX(fxCanvas, { reduced });
let list = [], idx = 0, cur = 0, ambCur = 0;
let playing = false, busy = false, pending = 0, elapsed = 0, shown = false;
let wakeLock = null, idleTimer = null, captionTimer = null, nextLumi = 0;
const paletteCache = new Map();
const slideWork = [null, null];

function fitRect(nw, nh) {
  const W = stage.clientWidth, H = stage.clientHeight;
  const pad = S.display.mat ? Math.max(12, Math.min(64, Math.min(W, H) * (Math.min(W, H) < 600 ? 0.035 : 0.05))) : 0;
  const s = Math.min((W - pad * 2) / nw, (H - pad * 2) / nh);
  const w = nw * s, h = nh * s;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}
function placeSlide(i) {
  const img = slides[i].querySelector('img');
  if (!img.naturalWidth) return null;
  const r = fitRect(img.naturalWidth, img.naturalHeight);
  Object.assign(img.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  slides[i].rect = r;
  return r;
}
function placeNeon(r) {
  if (!r) return;
  Object.assign(neon.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
}
function layout() {
  const W = stage.clientWidth, H = stage.clientHeight;
  fx.resize(W, H);
  placeSlide(0); placeSlide(1);
  const r = slides[cur].rect; if (r) { fx.setArtRect(r); placeNeon(r); }
}
window.addEventListener('resize', () => { if (!player.hidden) layout(); });
window.addEventListener('orientationchange', () => setTimeout(() => { if (!player.hidden) layout(); }, 250));

function extractPalette(img) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 36;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, 36, 36);
    const d = x.getImageData(0, 0, 36, 36).data;
    const bins = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx, s = mx ? (mx - mn) / mx : 0;
      if (v < 0.18 || s < 0.18) continue;
      let h = 0; const dd = mx - mn;
      if (mx === r) h = ((g - b) / dd) % 6; else if (mx === g) h = (b - r) / dd + 2; else h = (r - g) / dd + 4;
      h = (h * 60 + 360) % 360;
      const bin = bins[Math.floor(h / 30) % 12], w = s * v;
      bin.w += w; bin.r += d[i] * w; bin.g += d[i + 1] * w; bin.b += d[i + 2] * w;
    }
    const top = bins.filter(b => b.w > 0).sort((a, b) => b.w - a.w).slice(0, 5);
    const out = top.map(b => brighten([b.r / b.w, b.g / b.w, b.b / b.w]));
    while (out.length < 3) out.push(out.length ? [236, 205, 140] : [214, 228, 217]);
    return out;
  } catch { return null; }
}
function brighten([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  s = Math.max(s, 0.6); const L2 = Math.min(0.74, Math.max(0.6, l));
  const q = L2 < 0.5 ? L2 * (1 + s) : L2 + s - L2 * s, p = 2 * L2 - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255));
}

function loadImg(img, src) {
  return new Promise((resolve) => {
    if (img.getAttribute('src') === src && img.complete && img.naturalWidth) return resolve(true);
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  }).then(ok => ok && img.decode ? img.decode().then(() => true, () => true) : ok);
}

function buildList(startId) {
  const ids = S.selected.length ? [...S.selected] : works.map(w => w.id);
  let l = ids.map(id => works.find(w => w.id === id)).filter(Boolean);
  if (S.display.shuffle) {
    for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  }
  let start = 0;
  if (startId) {
    start = l.findIndex(w => w.id === startId);
    if (start < 0) { l.unshift(works.find(w => w.id === startId)); start = 0; }
  }
  return { l, start };
}

async function openPlayer(startId) {
  const { l, start } = buildList(startId);
  if (!l.length) return;
  list = l; idx = start; shown = false; busy = false; pending = 0; elapsed = 0;
  sound.ensure(); // unlock audio synchronously inside the user gesture (Safari)
  player.hidden = false;
  document.body.classList.add('no-scroll');
  player.focus({ preventScroll: true });
  const root = document.documentElement;
  try { if (root.requestFullscreen && !document.fullscreenElement) await root.requestFullscreen({ navigationUI: 'hide' }); } catch { /* not supported (iPhone) */ }
  slides.forEach(s => resetSlide(s, false));
  slides.forEach(s => s.classList.remove('live'));
  ambs.forEach(a => a.classList.remove('on'));
  closeSheet();
  layout();
  applyLive();
  fx.start();
  playing = true; player.classList.remove('paused');
  startMusic();
  requestWake();
  showControls();
  if (S.interact.ripple || S.interact.seeds) { const h = $('#hint'); setTimeout(() => h.classList.add('on'), 1400); setTimeout(() => h.classList.remove('on'), 5200); }
  if (S.interact.lumi) setTimeout(() => fx.say(T('lumiHello')), 3000);
  nextLumi = 40;
  await show(idx, 0);
}

function closePlayer() {
  playing = false;
  fx.stop();
  sound.stop();
  player.hidden = true;
  document.body.classList.remove('no-scroll');
  $('#hint').classList.remove('on');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  releaseWake();
  closeSheet();
  $('#playBtn').focus();
}

function startMusic() {
  if (S.music === 'none') { sound.stop(); player.classList.add('muted'); return; }
  sound.setVolume(S.volume);
  sound.play(S.music);
  player.classList.remove('muted');
}

async function show(i, dir) {
  busy = true;
  const work = list[i];
  const nextSlot = shown ? 1 - cur : cur;
  const incoming = slides[nextSlot];
  const img = incoming.querySelector('img');
  const ok = await loadImg(img, work.src);
  if (!ok) { busy = false; if (list.length > 1) { list.splice(i, 1); idx = i % list.length; return show(idx, dir); } return; }
  const r = placeSlide(nextSlot);
  slideWork[nextSlot] = work;
  let pal = paletteCache.get(work.id);
  if (!pal) { pal = extractPalette(img); if (pal) paletteCache.set(work.id, pal); }
  if (pal) { fx.setPalette(pal); neon.style.setProperty('--neon', `rgb(${pal[0].join(',')})`); }
  // ambient wash
  const na = 1 - ambCur;
  ambs[na].style.backgroundImage = `url("${work.src}")`;
  ambs[na].classList.add('on'); ambs[ambCur].classList.remove('on'); ambCur = na;
  setCaption(work, i);
  const from = shown ? slides[cur] : null;
  const fromImg = from ? from.querySelector('img') : null;
  let kind = S.transition;
  if (kind === 'random') kind = pickTransition(modeOf(S.mode).set.pool);
  if (reduced) kind = 'dissolve';
  incoming.classList.add('live');
  fx.setArtRect(r);
  placeNeon(r);
  await runTransition(kind, { from, to: incoming, fromImg, fromRect: from ? from.rect : null, rect: r, W: stage.clientWidth, H: stage.clientHeight, fx, speed: Math.max(0.5, Math.min(1.3, S.interval / 12)) });
  if (from) from.classList.remove('live');
  cur = nextSlot; shown = true; elapsed = 0; busy = false;
  // preload next
  const nx = list[(i + 1) % list.length];
  if (nx) { const p = new Image(); p.decoding = 'async'; p.src = nx.src; }
  if (pending) { const d = pending; pending = 0; go(d); }
}
let lastKind = '';
function pickTransition(modePool) {
  const base = (modePool && modePool.length ? modePool : TRANSITIONS);
  const pool = base.length > 1 ? base.filter(k => k !== lastKind) : base;
  lastKind = pool[Math.floor(Math.random() * pool.length)];
  return lastKind;
}

function go(dir) {
  if (!list.length) return;
  if (busy) { pending = dir; return; }
  let n = idx + dir;
  if (n >= list.length) { if (!S.display.loop && dir > 0 && playing) { setPaused(true); toast(T('endOfShow')); return; } n = 0; }
  if (n < 0) n = list.length - 1;
  if (n === idx && shown) return;
  idx = n;
  show(idx, dir);
}

function setCaption(work, i) {
  const cap = $('#caption');
  cap.classList.add('off');
  clearTimeout(captionTimer);
  if (!S.display.captions) return;
  captionTimer = setTimeout(() => {
    $('#capTitle').textContent = titleOf(work);
    $('#capIndex').textContent = `${String(i + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`;
    cap.classList.remove('off');
    captionTimer = setTimeout(() => cap.classList.add('off'), 6500);
  }, 1100);
}

function setPaused(p) {
  playing = !p;
  player.classList.toggle('paused', p);
  $('#pauseBtn').setAttribute('aria-label', p ? 'Play' : 'Pause');
}

// frame tick (driven by FX loop)
const progressBar = $('#progressBar');
const breathEl = $('#breathGuide');
fx.onFrame = (dt) => {
  if (playing && shown && !busy) {
    elapsed += dt;
    if (elapsed >= S.interval) { elapsed = 0; go(1); }
  }
  progressBar.style.width = (shown ? Math.min(100, elapsed / S.interval * 100) : 0) + '%';
  if (S.effects.breath) {
    breathEl.style.setProperty('--b', (0.55 + 0.45 * fx.breath).toFixed(3));
    const txt = fx.inhaling ? T('inhale') : T('exhale');
    const sp = breathEl.querySelector('span'); if (sp.textContent !== txt) sp.textContent = txt;
  }
  if (S.interact.lumi) {
    nextLumi -= dt;
    if (nextLumi <= 0) { const lines = T('lumiLines'); fx.say(lines[Math.floor(Math.random() * lines.length)]); nextLumi = 45 + Math.random() * 40; }
  }
};

function applyLive() {
  fx.tempo = modeOf(S.mode).set.tempo || 1;
  fx.setEffects(S.effects);
  fx.setInteract(S.interact);
  sound.chimeOn = S.interact.chime;
  neon.classList.toggle('on', !!S.effects.neon);
  breathEl.classList.toggle('on', !!S.effects.breath);
  player.classList.toggle('nodrift', !S.display.drift || reduced);
  if (!S.display.captions) $('#caption').classList.add('off');
}

// controls
$('#prevBtn').addEventListener('click', () => { go(-1); elapsed = 0; });
$('#nextBtn').addEventListener('click', () => { go(1); elapsed = 0; });
$('#pauseBtn').addEventListener('click', () => setPaused(playing));
$('#closeBtn').addEventListener('click', closePlayer);
$('#fxBtn').addEventListener('click', openSheet);
$('#musicBtn').addEventListener('click', () => {
  if (player.classList.contains('muted')) {
    if (S.music === 'none') { S.music = 'celestial'; saveSettings(S); }
    startMusic();
  } else { sound.stop(); player.classList.add('muted'); }
});
$('#fsBtn').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
document.addEventListener('fullscreenchange', () => { if (!player.hidden) setTimeout(layout, 120); });

// idle → hide controls & cursor
function showControls() {
  player.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (sheet.hidden) player.classList.add('idle'); }, 3200);
}

// pointer interaction
let down = null;
const isUi = (el) => el.closest('.pl-controls, .lw-sheet');
player.addEventListener('pointerdown', (e) => {
  showControls();
  if (isUi(e.target)) return;
  const r = player.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  down = { x, y, t: performance.now(), id: e.pointerId };
  sound.ensure();
  const hit = fx.pointerDown(x, y);
  if (hit.seed) sound.chime(x / r.width, y / r.height, true);
  else if (S.interact.ripple || S.interact.chime) sound.chime(x / r.width, y / r.height, false);
});
player.addEventListener('pointermove', (e) => {
  showControls();
  if (isUi(e.target)) return;
  const r = player.getBoundingClientRect();
  if (e.pointerType === 'mouse' || down) fx.pointerMove(e.clientX - r.left, e.clientY - r.top);
});
const endPointer = (e) => {
  fx.pointerUp();
  if (!down || down.id !== e.pointerId) { down = null; return; }
  const r = player.getBoundingClientRect();
  const dx = e.clientX - r.left - down.x, dy = e.clientY - r.top - down.y, dt = performance.now() - down.t;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 700) { go(dx < 0 ? 1 : -1); elapsed = 0; }
  down = null;
};
player.addEventListener('pointerup', endPointer);
player.addEventListener('pointercancel', endPointer);

document.addEventListener('keydown', (e) => {
  if (player.hidden) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); return; }
  if (!sheet.hidden && e.target.closest?.('.lw-sheet')) { if (e.key === 'Escape') closeSheet(); return; }
  showControls();
  switch (e.key) {
    case 'ArrowRight': case 'PageDown': go(1); elapsed = 0; e.preventDefault(); break;
    case 'ArrowLeft': case 'PageUp': go(-1); elapsed = 0; e.preventDefault(); break;
    case ' ': case 'k': setPaused(playing); e.preventDefault(); break;
    case 'f': case 'F': $('#fsBtn').click(); break;
    case 'm': case 'M': $('#musicBtn').click(); break;
    case 'Escape': if (!sheet.hidden) closeSheet(); else if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else closePlayer(); break;
  }
});

// wake lock & visibility
async function requestWake() { try { if ('wakeLock' in navigator) { wakeLock = await navigator.wakeLock.request('screen'); } } catch { wakeLock = null; } }
function releaseWake() { try { wakeLock?.release(); } catch { /* ignore */ } wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (player.hidden) return;
  if (document.hidden) sound.suspend();
  else { sound.resume(); requestWake(); }
});

// Hidden entrance: long-press the Three Rings mark for 3 s
(() => {
  const mark = $('.lw-wordmark');
  let timer = null, fired = false;
  const cancel = () => { clearTimeout(timer); timer = null; mark.classList.remove('pressing'); };
  mark.addEventListener('pointerdown', () => {
    fired = false; cancel(); mark.classList.add('pressing');
    timer = setTimeout(async () => {
      fired = true; cancel();
      if (studio) return;
      const pw = window.prompt(T('studioPrompt'));
      if (!pw) return;
      if (await verifyStudio(pw.trim())) { setStudio(true); toast(T('studioOn')); } else toast(T('studioWrong'));
    }, 3000);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => mark.addEventListener(ev, cancel));
  mark.addEventListener('click', (e) => { if (fired) { e.preventDefault(); fired = false; } });
  mark.addEventListener('contextmenu', (e) => e.preventDefault());
})();
$('#studioLock').addEventListener('click', () => { setStudio(false); toast(T('studioOff')); });

// ---------- Boot ----------
(async function boot() {
  await loadUploads();
  document.documentElement.classList.toggle('studio', studio);
  document.querySelectorAll('[data-studio]').forEach(el => { el.hidden = !studio; });
  if (!persistOK) { /* in-memory only; warn on first upload */ }
  applyLang();
  saveSettings(S);
  // expose a tiny hook for automated QA
  window.__lumina = { get state() { return { idx, playing, busy, shown, list: list.length, cur, works: works.length, selected: S.selected.length, settings: S }; }, go, openPlayer, closePlayer };
})();
