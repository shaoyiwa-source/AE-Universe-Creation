// AE Lumina Wall — application controller (r3: cloud library + full exhibition features)
import { loadSettings, saveSettings, lsGet, lsSet } from './store.js';
import { Sound } from './audio.js';
import { FX } from './fx.js';
import { runTransition, resetSlide, TRANSITIONS } from './transitions.js';
import { STR, OPTIONS } from './i18n.js';
import { recordClip, canRecord } from './recorder.js';
import { Listener } from './listen.js';
import { Alive } from './alive.js';
import { PackHost, PACKS, packsOf, paramsFor, transitionPack, registerPack, packFromSource, BUILTIN } from './packs.js';

const $ = (s, r = document) => r.querySelector(s);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const API = '/api/lumina';
const MAX_UPLOAD = Math.floor(4.3 * 1024 * 1024);

// House collection — used when the cloud library is unreachable (offline preview)
const FALLBACK = [
  ['Eternal Sun', 'assets/4e0991885a9649ea.webp'], ['Infinity Core', 'assets/b46ca2328e93f1f4.webp'],
  ['Universe Heart Bloom', 'assets/bb5c9cf38f67af5b.webp'], ['Infinite Love', 'assets/2ee9aa3b017652d9.webp'],
  ['Life Energy Field', 'assets/52116e7d3550cdf1.webp'], ['Life Bloom', 'assets/6c165bd1deb30988.webp'],
  ['Joyful World', 'assets/85b757c169e7afd6.webp'], ['Universe Abundance', 'assets/cfda3a3a0f7fa43d.webp'],
  ['Heart Fly', 'assets/selected-works-v2/heart-fly.webp'], ['Heart Recovery', 'assets/selected-works-v2/heart-recovery.webp'],
  ['Love Embrace', 'assets/selected-works-v2/love-embrace.webp'], ['Love Energy Field', 'assets/selected-works-v2/love-energy-field.webp'],
  ['Colorful Flow', 'assets/selected-works-v2/colorful-flow.webp'], ['Nature’s Strength', 'assets/selected-works-v2/natures-strength.webp'],
  ['Fun Universe', 'assets/selected-works-v2/fun-universe.webp'], ['Marvellous Energy World', 'assets/selected-works-v2/marvellous-energy-world.webp'],
  ['', 'assets/selected-works-v2/selected-17.webp'], ['Expansion', 'assets/selected-works-v2/expansion.webp'],
  ['Heart Rebuild', 'assets/selected-works-v2/heart-rebuild.webp'], ['Flower Heart Bloom', 'assets/selected-works-v2/flower-heart-bloom.webp'],
  ['Heart Energy', 'assets/selected-works-v2/heart-energy.webp'], ['Infinite Love Strength', 'assets/selected-works-v2/infinite-love-strength.webp'],
  ['', 'assets/selected-works-v2/selected-23.webp'], ['', 'assets/selected-works-v2/selected-24.webp'],
  ['', 'assets/selected-works-v2/selected-25.webp'], ['', 'assets/selected-works-v2/selected-26.webp'],
  ['', 'assets/selected-works-v2/selected-27.webp'],
].map(([en, src], i) => ({ id: 'ae' + String(i + 1).padStart(2, '0'), no: i + 1, builtin: true, type: 'image', src, thumb: src, title: { en, zh: i === 0 ? '盛明' : '' } })).filter(w => w.title.en); // unnamed works are not shown

// Interval steps: 4 s … 1 h (frame mode)
const STEPS = [4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 25, 30, 40, 50, 60, 90, 120, 180, 300, 600, 900, 1800, 3600];
const fmtSec = (s) => s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)} min` : '1 h';

const DEFAULTS = {
  mode: 'online', adjusted: false, transition: 'random', interval: 10, advance: 'auto',
  effects: { innerbloom: true, lumiere: true, echo: true, breath: false, stardust: true, aurora: false, petals: false, lasers: false, neon: false },
  interact: { alive: true, tray: true, ripple: true, chime: true, lumi: true, seeds: true, cute: false, listen: false },
  display: { intro: true, captions: true, label: true, camera: false, mat: true, drift: true, shuffle: false, loop: true },
  music: 'celestial', volume: 0.6, intensity: 3, selected: [],
};

// Edition (exported 客戶版 / NFT 版): everything comes from the embedded manifest; no server, no studio
const ED = window.__AE_EDITION__ || null;
// licensed player (R11): /gallery?license=<id> — a client's own arranged exhibition, bound to one screen
const LIC_ID = (() => { try { const v = new URLSearchParams(location.search).get('license'); return !ED && /^l[a-z0-9]{6,40}$/.test(v || '') ? v : null; } catch { return null; } })();
let LIC = null;
const SKEY = ED ? 'ae-lumina-ed-' + ED.id : 'ae-lumina-settings';
const S = loadSettings(DEFAULTS, SKEY);
if (ED && ED.settings && lsGet(SKEY, null) === null) {
  const es = ED.settings;
  for (const k of ['mode', 'transition', 'interval', 'music', 'volume', 'advance']) if (k in es) S[k] = es[k];
  for (const k of ['effects', 'interact', 'display']) if (es[k]) Object.assign(S[k], es[k]);
  S.selected = [];
}
let lang = lsGet('ae-language', 'zh') === 'en' ? 'en' : 'zh';
const T = (k, ...a) => { const v = STR[lang][k]; return typeof v === 'function' ? v(...a) : v; };
const L = (o) => o[lang];
const modeOf = (id) => OPTIONS.modes.find(m => m.id === id) || OPTIONS.modes.find(m => m.id === 'online');
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- state ----------
let works = [], exhibitions = [], tracks = [], cloud = 'none';
let view = 'all';
let token = null;
try { const t = JSON.parse(sessionStorage.getItem('ae-studio-token') || 'null'); if (t && t.exp > Date.now()) token = t.token; } catch { token = null; }
if (ED) token = null;
let studio = !!token;
const sound = new Sound();
sound.setVolume(S.volume);

// ---------- toast ----------
let toastTimer;
function toast(msg, ms = 3400) {
  const el = $('#toast');
  el.textContent = msg; el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// ---------- API ----------
async function api(action, { method = 'GET', body, query = {}, raw, type } = {}) {
  const qs = new URLSearchParams({ a: action, ...query });
  if (token && action === 'catalog') qs.set('studio', '1'); // studio reads never share the visitors' edge-cached copy
  const headers = {};
  if (token) headers.authorization = 'Bearer ' + token;
  let payload;
  if (raw) { headers['content-type'] = 'application/octet-stream'; qs.set('type', type); payload = raw; }
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(`${API}?${qs}`, { method, headers, body: payload });
  let data = null;
  try { data = await r.json(); } catch { data = null; }
  if (r.status === 401 && action !== 'login' && studio) { setStudio(false); toast(T('sessionExpired')); }
  if (!r.ok || !data) { const e = new Error((data && data.error) || String(r.status)); e.code = data && data.error; e.status = r.status; throw e; }
  return data;
}
const normWork = (w, i) => ({
  ...w, no: w.no || i + 1, type: w.type || 'image', thumb: w.thumb || (w.type === 'video' ? '' : w.src),
  title: typeof w.title === 'object' && w.title ? w.title : { en: w.title || '', zh: '' },
  statement: w.statement || { en: '', zh: '' },
});
// packages AE imported in God mode (their code lives in the cloud library); loaded once per version
let catalogPacks = [];
const packSources = new Map();
async function loadPackages(list) {
  for (const pk of list || []) {
    try {
      if (!packSources.has(pk.src)) packSources.set(pk.src, await (await fetch(pk.src)).text());
      registerPack(packFromSource(packSources.get(pk.src)));
    } catch (err) { console.warn('package', pk.id, err); }
  }
}
async function loadCatalog() {
  if (LIC) {
    works = (LIC.works || []).map(normWork); tracks = []; cloud = 'licensed';
    exhibitions = LIC.exhibition ? [{ ...LIC.exhibition, id: 'xlic' }] : [];
    view = exhibitions.length ? 'xlic' : 'all';
    catalogPacks = LIC.packs || []; await loadPackages(catalogPacks);
    if (S.music === 'eternal' || String(S.music).startsWith('track:')) { /* the show track streams from the site */ }
    return;
  }
  if (ED) {
    for (const code of ED.packs || []) { try { registerPack(packFromSource(code)); } catch (err) { console.warn('package', err); } }
    if (S.music === 'eternal') S.music = 'pulse'; // the show track is not inside player files
    works = ED.works.map(normWork); tracks = []; cloud = 'edition';
    exhibitions = [{ id: 'xedition', title: ED.title, note: ED.note, mode: ED.mode, items: ED.works.map(w => ({ id: w.id, ...(w.duration ? { duration: w.duration } : {}), ...(w.transition ? { transition: w.transition } : {}), ...(w.fx ? { fx: w.fx } : {}), ...(w.tr ? { tr: w.tr } : {}), ...(w.cam ? { cam: w.cam } : {}) })) }];
    view = 'xedition';
    const ids = new Set(works.map(w => w.id)); S.selected = S.selected.filter(id => ids.has(id));
    if (String(S.music).startsWith('track:') || !OPTIONS.music.some(o => o.id === S.music)) S.music = modeOf(S.mode).set.music;
    return;
  }
  try {
    const d = await api('catalog');
    works = d.works.map(normWork); exhibitions = d.exhibitions || []; tracks = d.tracks || []; cloud = d.storage || 'none';
    catalogPacks = d.packs || []; await loadPackages(catalogPacks);
  } catch {
    works = FALLBACK.map(normWork); exhibitions = []; tracks = []; cloud = 'offline';
  }
  const ids = new Set(works.map(w => w.id));
  S.selected = S.selected.filter(id => ids.has(id));
  if (view !== 'all' && !exhibitions.some(e => e.id === view)) view = 'all';
  if (String(S.music).startsWith('track:') && !tracks.some(t => 'track:' + t.id === S.music)) S.music = modeOf(S.mode).set.music;
  if (!String(S.music).startsWith('track:') && !OPTIONS.music.some(o => o.id === S.music)) S.music = modeOf(S.mode).set.music;
}

// ---------- i18n ----------
// One consistent name per work: the English title everywhere; the Chinese title (if any) as a quiet subtitle
const titleOf = (w) => w.title.en || w.title.zh || T('untitled', w.no || 0);
const subtitleOf = (w) => (w.title.en && w.title.zh && w.title.zh !== w.title.en) ? w.title.zh : '';
const metaOf = (w) => [w.year, w.medium, w.size].filter(Boolean).join(' · ');
const statementOf = (w) => (w.statement && (lang === 'zh' ? (w.statement.zh || w.statement.en) : (w.statement.en || w.statement.zh))) || '';
const showTitle = (e) => (lang === 'zh' ? (e.title.zh || e.title.en) : (e.title.en || e.title.zh)) || T('untitledShow');
function applyLang() {
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => { const v = T(el.dataset.i18n); if (typeof v === 'string') el.textContent = v; });
  $('#langToggle').textContent = lang === 'zh' ? 'EN' : '中文';
  $('#langToggle').setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切換至中文');
  renderMottos();
  renderAll(); renderSettings(); renderEdition();
}
// 「外在沉靜，內在綻放」— the house motto block (design from the AE player; gold gradient, Cinzel + Noto Serif TC)
function renderMottos() {
  document.querySelectorAll('.ae-motto').forEach(el => {
    const tag = el.dataset.motto === 'h1' ? 'h1' : 'p';
    el.innerHTML = '<p class="brand">AE UNIVERSE CREATION</p>' + (lang === 'zh'
      ? `<${tag} class="tg zh-hero"><span>外在沉靜</span><span>內在綻放</span></${tag}><i class="gr" aria-hidden="true"></i><div class="sub-en">OUTER CALM · INNER BLOOM</div>`
      : `<${tag} class="tg"><span>OUTER CALM</span><span>INNER BLOOM</span></${tag}><i class="gr" aria-hidden="true"></i><div class="sub-zh">外在沉靜 · 內在綻放</div>`);
  });
}
$('#langToggle').addEventListener('click', () => { lang = lang === 'zh' ? 'en' : 'zh'; lsSet('ae-language', lang); applyLang(); });

// ---------- views: all works / exhibitions ----------
const currentShow = () => exhibitions.find(e => e.id === view) || null;
function viewWorks() {
  const sh = currentShow();
  if (!sh) return works;
  return sh.items.map(it => works.find(w => w.id === it.id)).filter(Boolean);
}
const itemOf = (id) => { const sh = currentShow(); return sh ? sh.items.find(it => it.id === id) || null : null; };
function setView(id, { applyShowMode = true } = {}) {
  view = exhibitions.some(e => e.id === id) ? id : 'all';
  wall.classList.remove('settled');
  const sh = currentShow();
  if (sh && applyShowMode) applyMode(modeOf(sh.mode), { quiet: true });
  renderAll();
}

const shows = $('#shows');
function renderShows() {
  if (ED) { shows.hidden = true; $('#showNote').hidden = true; return; }
  const frag = document.createDocumentFragment();
  const tab = (id, label) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lw-show-tab'; b.dataset.view = id; b.setAttribute('aria-pressed', String(view === id));
    b.textContent = label; frag.appendChild(b);
  };
  tab('all', T('all'));
  for (const e of exhibitions) tab(e.id, showTitle(e));
  const spacer = document.createElement('span'); spacer.className = 'lw-show-spacer'; frag.appendChild(spacer);
  const act = (id, label, cls = '') => { const b = document.createElement('button'); b.type = 'button'; b.className = 'lw-show-act ' + cls; b.dataset.showAct = id; b.textContent = label; frag.appendChild(b); };
  act('share', T('shareLink'));
  if (studio) {
    act('export', T('exportEd'), 'studio');
    act('new', '＋ ' + T('newShow'), 'studio');
    if (currentShow()) { act('update', T('updateShow'), 'studio'); act('edit', T('editShow'), 'studio'); }
  }
  shows.replaceChildren(frag);
  const sh = currentShow();
  const note = $('#showNote');
  const txt = sh ? (lang === 'zh' ? (sh.note?.zh || sh.note?.en) : (sh.note?.en || sh.note?.zh)) : '';
  note.hidden = !txt; note.textContent = txt || '';
}
shows.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-view]');
  if (t) { setView(t.dataset.view); return; }
  const a = e.target.closest('[data-show-act]'); if (!a) return;
  const act = a.dataset.showAct;
  if (act === 'share') return shareLink();
  if (!studio) return;
  if (act === 'export') return openExport();
  if (act === 'new') {
    const ids = S.selected.filter(id => works.some(w => w.id === id));
    if (!ids.length) { toast(T('needSelection')); return; }
    openShowDialog({ title: { zh: '', en: '' }, note: { zh: '', en: '' }, mode: S.mode, items: ids.map(id => ({ id })) });
  }
  if (act === 'edit') openShowDialog(currentShow());
  if (act === 'update') {
    const sh = currentShow(); if (!sh) return;
    const ids = S.selected.filter(id => works.some(w => w.id === id));
    if (!ids.length) { toast(T('needSelection')); return; }
    const keep = new Map(sh.items.map(it => [it.id, it]));
    await saveShow({ ...sh, items: ids.map(id => keep.get(id) || { id }) });
  }
});

async function shareLink() {
  const u = new URL(location.href);
  u.search = '';
  if (currentShow()) u.searchParams.set('show', view);
  u.searchParams.set('mode', S.mode);
  u.searchParams.set('autoplay', '1');
  const link = u.toString();
  try { await navigator.clipboard.writeText(link); toast(T('linkCopied')); }
  catch { window.prompt(T('shareLink'), link); }
}

// ---------- wall ----------
const wall = $('#wall');
const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  view: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M11 8v6M8 11h6"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  remove: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
};
function renderWall() {
  const list = viewWorks();
  const frag = document.createDocumentFragment();
  list.forEach((w, i) => {
    const sel = S.selected.indexOf(w.id);
    const el = document.createElement('div');
    el.className = 'screen' + (sel >= 0 ? ' selected' : '') + (w.hidden ? ' is-hidden' : '');
    el.dataset.id = w.id;
    el.style.animationDelay = `${Math.min(i, 24) * 40}ms`;
    const btn = (act, label, cls = '') => `<button type="button" class="screen-act ${cls}" data-act="${act}" aria-label="${esc(label)}" title="${esc(label)}">${ICON[act]}</button>`;
    const tags = [w.type === 'video' ? T('videoTag') : '', studio && w.hidden ? T('hiddenTag') : ''].filter(Boolean);
    el.innerHTML = `
      <button type="button" class="screen-hit" aria-pressed="${sel >= 0}">
        <span class="screen-bg"></span>
        <span class="screen-glass"></span>
        <span class="screen-meta"><b>${String(i + 1).padStart(2, '0')}</b><em></em></span>
      </button>
      <span class="screen-badge" aria-hidden="true">${sel >= 0 ? sel + 1 : ''}</span>
      ${tags.length ? `<span class="screen-tag">${esc(tags.join(' · '))}</span>` : ''}
      <span class="screen-actions">
        ${btn('play', T('playFrom'), 'play')}${btn('view', T('view'))}
        ${studio ? btn('edit', T('edit')) + btn('download', T('download')) + btn('left', T('moveLeft')) + btn('right', T('moveRight')) + btn('remove', currentShow() ? T('removeFromShow') : T('del')) : ''}
      </span>`;
    const hit = el.querySelector('.screen-hit');
    hit.setAttribute('aria-label', titleOf(w));
    let art;
    if (w.thumb) { art = document.createElement('img'); art.loading = 'lazy'; art.decoding = 'async'; art.src = w.thumb; el.querySelector('.screen-bg').style.backgroundImage = `url("${w.thumb}")`; }
    else { art = document.createElement('video'); art.muted = true; art.playsInline = true; art.preload = 'metadata'; art.src = w.src + '#t=0.5'; }
    art.className = 'screen-art'; art.draggable = false; art.alt = '';
    hit.insertBefore(art, hit.querySelector('.screen-glass'));
    el.querySelector('em').textContent = titleOf(w);
    frag.appendChild(el);
  });
  wall.replaceChildren(frag);
  updateCount();
  // entrance animation only on first paint / view change, not on every curator edit
  clearTimeout(renderWall.t); renderWall.t = setTimeout(() => wall.classList.add('settled'), 2200);
}
// Count + play label say exactly what will play: everything (nothing selected) or the selection, in order
function updateCount() {
  const ids = new Set(viewWorks().map(w => w.id));
  const n = S.selected.filter(id => ids.has(id)).length;
  $('#selCount').textContent = n || ids.size;
  $('#allCount').textContent = ids.size;
  $('#allCount').hidden = !n; $('.lw-count-sep').hidden = !n;
  $('.lw-count-label').textContent = n ? T('countSel') : T('countAll');
  const pl = $('#playBtn span'); if (pl) pl.textContent = n ? T('playSel', n) : T('playAll');
  const fab = $('#fab span'); if (fab) fab.textContent = n ? T('playSel', n) : T('playAll');
}
function refreshBadges() {
  wall.querySelectorAll('.screen').forEach(el => {
    const i = S.selected.indexOf(el.dataset.id);
    el.classList.toggle('selected', i >= 0);
    el.querySelector('.screen-badge').textContent = i >= 0 ? i + 1 : '';
    el.querySelector('.screen-hit').setAttribute('aria-pressed', String(i >= 0));
  });
  updateCount();
  saveSettings(S, SKEY);
}
function renderAll() { renderShows(); renderWall(); }

wall.addEventListener('click', async (e) => {
  const screen = e.target.closest('.screen'); if (!screen) return;
  const id = screen.dataset.id;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'play') return openPlayer(id);
  if (act === 'view') return openViewer(id);
  if (act && studio) {
    if (act === 'edit') return openEdit(id);
    if (act === 'download') return downloadOriginal(id);
    if (act === 'left' || act === 'right') return move(id, act === 'left' ? -1 : 1);
    if (act === 'remove') return removeWork(id);
    return;
  }
  if (e.target.closest('.screen-hit')) {
    const i = S.selected.indexOf(id);
    if (i >= 0) S.selected.splice(i, 1); else S.selected.push(id);
    refreshBadges();
  }
});
$('#selectAll').addEventListener('click', () => { for (const w of viewWorks()) if (!S.selected.includes(w.id)) S.selected.push(w.id); refreshBadges(); });
$('#clearSel').addEventListener('click', () => { const ids = new Set(viewWorks().map(w => w.id)); S.selected = S.selected.filter(id => !ids.has(id)); refreshBadges(); });
$('#playBtn').addEventListener('click', () => openPlayer(null));
// phones: the toolbar scrolls away, so a slim floating "Begin show" appears instead
$('#fab').addEventListener('click', () => openPlayer(null));
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([en]) => { $('#fab').hidden = en.isIntersecting || window.innerWidth > 760; }).observe($('.lw-toolbar'));
}

setInterval(() => {
  if (!player.hidden || document.hidden) return;
  const tiles = wall.querySelectorAll('.screen'); if (!tiles.length) return;
  const el = tiles[Math.floor(Math.random() * tiles.length)];
  el.classList.add('gloss'); setTimeout(() => el.classList.remove('gloss'), 2500);
}, 2200);

// ---------- studio: auth ----------
function setStudio(on, newToken) {
  if (on && newToken) { token = newToken.token; try { sessionStorage.setItem('ae-studio-token', JSON.stringify(newToken)); } catch { /* ignore */ } }
  if (!on) { token = null; try { sessionStorage.removeItem('ae-studio-token'); } catch { /* ignore */ } }
  studio = on;
  document.documentElement.classList.toggle('studio', on);
  document.querySelectorAll('[data-studio]').forEach(el => { el.hidden = !on; });
}
async function enterStudio() {
  if (ED) return; // editions never contain the studio
  const pw = window.prompt(T('studioPrompt'));
  if (!pw) return;
  try {
    const t = await api('login', { method: 'POST', body: { password: pw.trim() } });
    setStudio(true, t);
    await loadCatalog(); renderAll(); renderSettings();
    toast(cloud === 'degraded' ? T('storageDown') : T('studioOn'), cloud === 'degraded' ? 7000 : undefined);
  } catch (err) {
    toast(err.code === 'STUDIO_NOT_CONFIGURED' ? T('studioNotConfigured') : err.code === 'WRONG_PASSWORD' ? T('studioWrong') : T('offline'));
  }
}
(() => {
  if (ED || LIC_ID) return;
  const mark = $('.lw-wordmark');
  let timer = null, fired = false;
  const cancel = () => { clearTimeout(timer); timer = null; mark.classList.remove('pressing'); };
  mark.addEventListener('pointerdown', () => {
    fired = false; cancel(); mark.classList.add('pressing');
    timer = setTimeout(() => { fired = true; cancel(); if (!studio) enterStudio(); }, 3000);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => mark.addEventListener(ev, cancel));
  mark.addEventListener('click', (e) => { if (fired) { e.preventDefault(); fired = false; } });
  mark.addEventListener('contextmenu', (e) => e.preventDefault());
})();
$('#studioLock').addEventListener('click', async () => { setStudio(false); await loadCatalog(); renderAll(); renderSettings(); toast(T('studioOff')); });

function studioError(err) {
  if (err.code === 'STORAGE_NOT_READY') toast(T('storageNotReady'), 6000);
  else if (err.code === 'STORAGE_DOWN') toast(T('storageDown'), 7000);
  else if (err.code === 'TOO_LARGE') toast(T('tooLarge', ''), 5000);
  else if (err.status !== 401) toast(T('addFailed'));
}

// ---------- studio: uploads ----------
function canvasBlob(c, type = 'image/jpeg', q = 0.9) { return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('encode')), type, q)); }
async function decodeImage(file) {
  const url = URL.createObjectURL(file);
  const img = new Image(); img.src = url;
  try { await img.decode(); return img; } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
async function scaled(source, w, h, max, q) {
  const s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return canvasBlob(c, 'image/jpeg', q);
}
async function prepareImage(file) {
  if (file.type === 'image/gif') { if (file.size > MAX_UPLOAD) throw Object.assign(new Error('big'), { code: 'TOO_LARGE' }); const img = await decodeImage(file); return { blob: file, type: 'image/gif', thumb: await scaled(img, img.naturalWidth, img.naturalHeight, 720, 0.85) }; }
  const img = await decodeImage(file);
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) throw new Error('empty');
  let blob = (file.size <= MAX_UPLOAD && Math.max(w, h) <= 2560 && /image\/(jpeg|png|webp|avif)/.test(file.type)) ? file : null;
  for (const [max, q] of [[2560, 0.9], [2560, 0.8], [2048, 0.82], [1600, 0.82]]) {
    if (blob && blob.size <= MAX_UPLOAD) break;
    blob = await scaled(img, w, h, max, q);
  }
  if (blob.size > MAX_UPLOAD) throw Object.assign(new Error('big'), { code: 'TOO_LARGE' });
  return { blob, type: blob.type || file.type, thumb: await scaled(img, w, h, 720, 0.85) };
}
function videoPoster(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    const done = (b) => { URL.revokeObjectURL(url); resolve(b); };
    const t = setTimeout(() => done(null), 10000);
    v.addEventListener('loadeddata', () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 3); }, { once: true });
    v.addEventListener('seeked', async () => {
      clearTimeout(t);
      try { done(await scaled(v, v.videoWidth, v.videoHeight, 720, 0.85)); } catch { done(null); }
    }, { once: true });
    v.addEventListener('error', () => { clearTimeout(t); done(null); }, { once: true });
  });
}
async function addFiles(files) {
  if (!studio) return;
  const list = [...files].filter(f => /^(image|video)\//.test(f.type) || /\.(jpe?g|png|webp|gif|avif|heic|mp4|webm|mov)$/i.test(f.name));
  if (!list.length) return;
  const added = [];
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    toast(T('uploading', i + 1, list.length), 60000);
    const name = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 80);
    try {
      let raw, type, thumb;
      if (f.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(f.name)) {
        if (f.size > MAX_UPLOAD) { toast(T('tooLarge', f.name), 5000); continue; }
        raw = f; type = f.type || 'video/mp4'; thumb = await videoPoster(f);
      } else ({ blob: raw, type, thumb } = await prepareImage(f));
      const { work } = await api('upload', { method: 'POST', query: { kind: 'work', name }, raw, type });
      if (thumb) { try { await api('upload', { method: 'POST', query: { kind: 'thumb', id: work.id }, raw: thumb, type: 'image/jpeg' }); } catch { /* poster optional */ } }
      added.push(work.id);
    } catch (err) {
      if (err.code === 'TOO_LARGE') toast(T('tooLarge', f.name), 5000);
      else if (err.code === 'STORAGE_NOT_READY') { toast(T('storageNotReady'), 6000); break; }
      else if (err.code === 'STORAGE_DOWN') { toast(T('storageDown'), 7000); break; }
      else if (err.status === 401) break;
      else toast(T('addFailed'), 4000);
    }
  }
  await loadCatalog();
  S.selected.push(...added.filter(id => !S.selected.includes(id)));
  if (added.length && currentShow()) {
    const sh = currentShow();
    await saveShow({ ...sh, items: [...sh.items, ...added.map(id => ({ id }))] }, { silent: true });
  }
  renderAll(); saveSettings(S, SKEY);
  if (added.length) { toast(T('added', added.length)); wall.lastElementChild?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); }
}
$('#fileInput').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
const drop = $('#dropZone'); let dragDepth = 0;
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragenter', (e) => { if (!studio || !hasFiles(e) || !player.hidden) return; e.preventDefault(); dragDepth++; drop.hidden = false; });
window.addEventListener('dragover', (e) => { if (studio && hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) drop.hidden = true; });
window.addEventListener('drop', (e) => { if (!studio || !hasFiles(e)) return; e.preventDefault(); dragDepth = 0; drop.hidden = true; if (player.hidden) addFiles(e.dataTransfer.files); });

// ---------- studio: edit / order / remove ----------
const editDialog = $('#editDialog'), editForm = $('#editForm');
let editing = null;
function openEdit(id) {
  const w = works.find(x => x.id === id); if (!w) return;
  editing = w;
  const f = editForm.elements;
  f.titleZh.value = w.title.zh || ''; f.titleEn.value = w.title.en || '';
  f.year.value = w.year || ''; f.medium.value = w.medium || ''; f.size.value = w.size || '';
  f.stZh.value = w.statement?.zh || ''; f.stEn.value = w.statement?.en || '';
  f.hidden.checked = !!w.hidden; f.private.checked = !!w.private;
  const it = itemOf(id);
  $('#inShow').hidden = !it;
  const sel = f.transition; sel.replaceChildren();
  for (const o of OPTIONS.transitions) { const op = document.createElement('option'); op.value = o.id === 'random' ? '' : o.id; op.textContent = o.id === 'random' ? T('modeLabel') : L(o); sel.appendChild(op); }
  if (it) { f.duration.value = it.duration || ''; sel.value = it.transition || ''; }
  $('#editDelete').textContent = currentShow() ? T('removeFromShow') : T('del');
  editDialog.showModal();
}
$('#editCancel').addEventListener('click', () => editDialog.close());
$('#editDelete').addEventListener('click', async () => { const id = editing?.id; editDialog.close(); if (id) await removeWork(id); });
editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = editForm.elements, w = editing; if (!w) return;
  const patch = { title: { zh: f.titleZh.value, en: f.titleEn.value }, year: f.year.value, medium: f.medium.value, size: f.size.value,
    statement: { zh: f.stZh.value, en: f.stEn.value }, hidden: f.hidden.checked, private: f.private.checked };
  try {
    await api('update', { method: 'POST', body: { id: w.id, patch } });
    const sh = currentShow();
    if (sh && itemOf(w.id)) {
      const d = parseInt(f.duration.value, 10);
      const items = sh.items.map(it => it.id !== w.id ? it : { id: it.id, ...(d >= 3 ? { duration: d } : {}), ...(f.transition.value ? { transition: f.transition.value } : {}) });
      await saveShow({ ...sh, items }, { silent: true });
    }
    editDialog.close();
    await loadCatalog(); renderAll(); toast(T('saved'));
  } catch (err) { studioError(err); }
});
async function move(id, dir) {
  const sh = currentShow();
  if (sh) {
    const items = [...sh.items]; const i = items.findIndex(it => it.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    await saveShow({ ...sh, items }, { silent: true });
  } else {
    const ids = works.map(w => w.id); const i = ids.indexOf(id); const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    works = ids.map(x => works.find(w => w.id === x)); renderWall();
    try { await api('reorder', { method: 'POST', body: { ids } }); } catch (err) { studioError(err); }
  }
  renderWall();
}
async function removeWork(id) {
  const sh = currentShow();
  if (sh) { await saveShow({ ...sh, items: sh.items.filter(it => it.id !== id) }, { silent: true }); renderAll(); return; }
  if (!confirm(T('confirmRemove'))) return;
  try { await api('delete', { method: 'POST', body: { id } }); S.selected = S.selected.filter(x => x !== id); await loadCatalog(); renderAll(); saveSettings(S, SKEY); }
  catch (err) { studioError(err); }
}

// ---------- studio: exhibitions ----------
const showDialog = $('#showDialog'), showForm = $('#showForm');
let showDraft = null;
function openShowDialog(sh) {
  showDraft = sh;
  const f = showForm.elements;
  f.titleZh.value = sh.title?.zh || ''; f.titleEn.value = sh.title?.en || '';
  f.noteZh.value = sh.note?.zh || ''; f.noteEn.value = sh.note?.en || '';
  f.mode.replaceChildren(...OPTIONS.modes.map(m => { const o = document.createElement('option'); o.value = m.id; o.textContent = L(m); return o; }));
  f.mode.value = sh.mode || S.mode;
  $('#showDelete').hidden = !sh.id;
  showDialog.showModal();
}
$('#showCancel').addEventListener('click', () => showDialog.close());
$('#showDelete').addEventListener('click', async () => {
  if (!showDraft?.id || !confirm(T('confirmDeleteShow'))) return;
  showDialog.close();
  try { await api('exhibition-delete', { method: 'POST', body: { id: showDraft.id } }); await loadCatalog(); view = 'all'; renderAll(); }
  catch (err) { studioError(err); }
});
showForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = showForm.elements;
  const sh = { ...showDraft, title: { zh: f.titleZh.value, en: f.titleEn.value }, note: { zh: f.noteZh.value, en: f.noteEn.value }, mode: f.mode.value };
  showDialog.close();
  const saved = await saveShow(sh);
  if (saved) setView(saved.id);
});
async function saveShow(sh, { silent = false } = {}) {
  try {
    const { exhibition } = await api('exhibition-save', { method: 'POST', body: { exhibition: sh } });
    await loadCatalog();
    if (!silent) toast(T('showSaved'));
    renderAll();
    return exhibition;
  } catch (err) { studioError(err); return null; }
}

// ---------- studio: originals & edition export ----------
function downloadOriginal(id) {
  const w = works.find(x => x.id === id); if (!w) return;
  const ext = (/\.(\w+)(?:$|[?#&])/.exec(decodeURIComponent(w.src)) || [, w.type === 'video' ? 'mp4' : 'webp'])[1];
  const a = document.createElement('a');
  a.href = w.src; a.download = `${(w.title.en || w.title.zh || 'AE-work').replace(/[\\/:*?"<>|]+/g, ' ').trim()}.${ext}`;
  document.body.appendChild(a); a.click(); a.remove();
}
const exportDialog = $('#exportDialog'), exportForm = $('#exportForm');
function exportList() {
  const base = viewWorks();
  const inView = new Set(base.map(w => w.id));
  const sel = S.selected.filter(id => inView.has(id));
  const l = sel.length ? sel.map(id => works.find(w => w.id === id)) : base;
  return l.filter(w => w && !w.hidden).map(w => ({ ...w, ...(itemOf(w.id) || {}) })); // hidden works never leave the studio
}
function openExport() {
  const sh = currentShow(), f = exportForm.elements;
  f.titleZh.value = sh?.title?.zh || ''; f.titleEn.value = sh?.title?.en || '';
  f.noteZh.value = sh?.note?.zh || ''; f.noteEn.value = sh?.note?.en || '';
  f.artist.value = 'Aurelia & Elion'; f.year.value = String(new Date().getFullYear());
  $('#exportStatus').textContent = T('worksCount', exportList().length);
  $('#exportGo').disabled = false;
  const syncKind = () => exportForm.querySelectorAll('.nft-only').forEach(el => { el.hidden = f.kind.value !== 'nft'; });
  f.kind.onchange = syncKind; syncKind();
  exportDialog.showModal();
}
$('#exportCancel').addEventListener('click', () => exportDialog.close());
exportForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = exportForm.elements, go = $('#exportGo'), status = $('#exportStatus');
  const list = exportList(); if (!list.length) { toast(T('needSelection')); return; }
  go.disabled = true;
  try {
    const { exportEdition } = await import('./export.js');
    const settings = { mode: S.mode, transition: S.transition, interval: S.interval, advance: S.advance || 'auto', music: String(S.music).startsWith('track:') || S.music === 'eternal' ? (modeOf(S.mode).set.music === 'eternal' ? 'pulse' : modeOf(S.mode).set.music) : S.music, volume: S.volume, effects: { ...S.effects }, interact: { ...S.interact }, display: { ...S.display } };
    const out = await exportEdition({
      meta: { titleZh: f.titleZh.value, titleEn: f.titleEn.value, noteZh: f.noteZh.value, noteEn: f.noteEn.value, artist: f.artist.value, year: f.year.value, no: f.no.value, of: f.of.value, kind: f.kind.value, quality: f.quality.value },
      works: list, mode: S.mode, settings, packs: catalogPacks.map(pk => packSources.get(pk.src)).filter(Boolean),
      onProgress: (m) => { status.textContent = T('exporting', m); },
    });
    const a = document.createElement('a'); a.href = URL.createObjectURL(out.blob); a.download = out.filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    exportDialog.close();
    toast(T('exported', (out.size / 1048576).toFixed(1)), 5000);
  } catch (err) { console.warn('export', err); status.textContent = T('exportFailed'); }
  finally { go.disabled = false; }
});

// ---------- edition chrome (exported player) ----------
function renderEdition() {
  if (!ED) return;
  const tt = (o) => (lang === 'zh' ? (o.zh || o.en) : (o.en || o.zh)) || '';
  const ed = ED.kind === 'nft' && ED.edition && ED.edition.of > 1 ? T('editionOf', ED.edition.no, ED.edition.of) : T('kindName', ED.kind);
  const he = $('#heroEdition'); he.hidden = false; he.textContent = tt(ED.title) || 'AE Universe Creation';
  $('.lw-lede').textContent = tt(ED.note) || T('heroLede');
  const home = $('.lw-header-actions a.lw-link');
  if (ED.site) { home.href = ED.site; home.target = '_blank'; home.rel = 'noopener'; $('.lw-wordmark').href = ED.site; $('.lw-wordmark').target = '_blank'; }
  else { home.hidden = true; $('.lw-wordmark').removeAttribute('href'); }
  const cert = $('#cert'); cert.hidden = false;
  $('#certTitle').textContent = tt(ED.title) || 'AE Universe Creation';
  const numbered = ED.kind === 'nft' && ED.edition && ED.edition.of > 1;
  const rows = [[T('edKind'), T('kindName', ED.kind)], ...(numbered ? [[T('edNo'), `${ED.edition.no} / ${ED.edition.of}`]] : []), [T('edArtist'), ED.artist], [T('f_year'), ED.year],
    [lang === 'zh' ? '作品' : 'Works', T('worksCount', ED.works.length)], [T('issued'), (ED.exportedAt || '').slice(0, 10)]];
  $('#certList').replaceChildren(...rows.flatMap(([k, v]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; return [dt, dd]; }));
}

// ---------- settings sheet ----------
const sheet = $('#settings'), scrim = $('#scrim');
// opened during a presentation: "adjust while watching" — the painting moves aside (never covered, never dimmed)
// and keeps playing and answering touch, so every setting can be seen as it is changed
function setTuning(on) {
  const was = player.classList.contains('tuning');
  document.body.classList.toggle('tuning', on); player.classList.toggle('tuning', on);
  if (was !== on && !player.hidden) requestAnimationFrame(() => layout());
}
function openSheet() { closeGod(); renderSettings(); sheet.hidden = false; scrim.hidden = false; setTuning(!player.hidden); $('#closeSettings').focus({ preventScroll: true }); showControls(); }
function closeSheet() { const had = !sheet.hidden; sheet.hidden = true; scrim.hidden = true; setTuning(false); if (had && !player.hidden) player.focus({ preventScroll: true }); }
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
  b.type = 'button'; b.className = 'lw-toggle'; b.dataset.opt = opt.id; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(on));
  b.innerHTML = `<span class="lw-toggle-text"><b></b><small></small></span><span class="lw-switch" aria-hidden="true"></span>`;
  b.querySelector('b').textContent = L(opt);
  if (opt.ae) { const s = document.createElement('span'); s.className = 'ae'; s.textContent = 'AE'; b.querySelector('b').appendChild(s); }
  b.querySelector('small').textContent = lang === 'zh' ? opt.dzh : opt.den;
  b.addEventListener('click', onClick);
  return b;
}
function renderSettings() {
  const modes = $('#modeCards'); modes.replaceChildren();
  let lastArena = '';
  for (const m of OPTIONS.modes) {
    if (LIC && !LIC.modes.includes(m.id)) continue; // a licence offers only the modes AE chose
    if (m.arena !== lastArena) {
      lastArena = m.arena;
      const ar = OPTIONS.arenas.find(a => a.id === m.arena);
      const h = document.createElement('p'); h.className = 'lw-arena'; h.dataset.arena = ar.id;
      h.innerHTML = '<b></b><small></small>'; h.querySelector('b').textContent = L(ar); h.querySelector('small').textContent = lang === 'zh' ? ar.dzh : ar.den;
      modes.appendChild(h);
    }
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lw-mode'; b.dataset.mode = m.id; b.setAttribute('aria-pressed', String(S.mode === m.id));
    b.innerHTML = '<b></b><i></i><small></small>';
    b.querySelector('b').textContent = L(m);
    b.querySelector('i').textContent = lang === 'zh' ? m.en : m.zh;
    b.querySelector('small').textContent = lang === 'zh' ? m.dzh : m.den;
    b.addEventListener('click', () => applyMode(m));
    modes.appendChild(b);
  }
  const rs = $('#resetMode');
  rs.hidden = !S.adjusted;
  rs.textContent = `${T('adjusted')} · ${T('resetMode')}`;
  const adj = () => { S.adjusted = true; };
  const ad = $('#advanceChips'); ad.replaceChildren();
  for (const id of ['auto', 'manual']) ad.appendChild(chip(T('adv_' + id), (S.advance || 'auto') === id, false, () => {
    S.advance = id; saveSettings(S, SKEY); renderSettings();
    if (id === 'manual' && !player.hidden) toast(T('manualHint'), 4200);
    if (id === 'auto') elapsed = 0;
  }));
  const tr = $('#transitionChips'); tr.replaceChildren();
  for (const o of OPTIONS.transitions) tr.appendChild(chip(L(o), S.transition === o.id, o.ae, () => { S.transition = o.id; adj(); commit(); if (!player.hidden && shown && o.id !== 'random') { go(1); elapsed = 0; } }));
  const ef = $('#effectToggles'); ef.replaceChildren();
  for (const o of OPTIONS.effects) { if (o.partyOnly && S.mode !== 'party') continue; ef.appendChild(toggle(o, S.effects[o.id], () => { S.effects[o.id] = !S.effects[o.id]; adj(); commit(); })); }
  const inten = $('#intensity'); inten.value = S.intensity; $('#intensityOut').textContent = S.intensity;
  const it = $('#interactToggles'); it.replaceChildren();
  for (const o of OPTIONS.interact) it.appendChild(toggle(o, S.interact[o.id], () => {
    if (o.id === 'listen') { setListen(!S.interact.listen); return; }
    S.interact[o.id] = !S.interact[o.id]; adj(); commit();
  }));
  const di = $('#displayToggles'); di.replaceChildren();
  for (const o of OPTIONS.display) di.appendChild(toggle(o, !!S.display[o.id], () => { S.display[o.id] = !S.display[o.id]; adj(); commit(); if ((o.id === 'mat') && !player.hidden) layout(); }));
  const mu = $('#musicChips'); mu.replaceChildren();
  for (const o of OPTIONS.music) mu.appendChild(chip(L(o), S.music === o.id, false, () => { const ch = S.music !== o.id; S.music = o.id; adj(); commit(ch); }));
  for (const t of tracks) {
    const id = 'track:' + t.id;
    mu.appendChild(chip(`${T('track')} · ${t.name}`, S.music === id, false, () => { const ch = S.music !== id; S.music = id; adj(); commit(ch); }));
  }
  const note = $('#musicNote'); note.replaceChildren();
  const curTrack = tracks.find(t => 'track:' + t.id === S.music);
  if (studio && curTrack) {
    const del = document.createElement('button'); del.type = 'button'; del.className = 'lw-reset'; del.textContent = `${T('del')} · ${curTrack.name}`;
    del.addEventListener('click', async () => { if (!confirm(T('del') + '?')) return; try { await api('track-delete', { method: 'POST', body: { id: curTrack.id } }); await loadCatalog(); S.music = modeOf(S.mode).set.music; commit(true); } catch (err) { studioError(err); } });
    note.appendChild(del);
  }
  const iv = $('#interval'); iv.min = 0; iv.max = STEPS.length - 1; iv.step = 1;
  iv.value = STEPS.reduce((bi, v, i) => Math.abs(v - S.interval) < Math.abs(STEPS[bi] - S.interval) ? i : bi, 0);
  $('#intervalOut').textContent = fmtSec(S.interval);
  const vo = $('#volume'); vo.value = S.volume; $('#volumeOut').textContent = Math.round(S.volume * 100) + '%';
  licenceControls();
}
// a licensed player shows only the adjustments AE opened for this client
function licenceControls() {
  if (!LIC) return;
  const c = new Set(LIC.controls || []), sec = (id) => $('#' + id).closest('section');
  const show = (el, on) => { if (el) el.hidden = !on; };
  show(sec('modeCards'), c.has('modes') && LIC.modes.length > 1); show($('#resetMode'), false);
  const ts = sec('transitionChips'); show(ts, c.has('advance'));
  ts.querySelectorAll('h3, #transitionChips, .lw-range').forEach(el => show(el, false));
  const es = sec('effectToggles'); show(es, c.has('intensity')); show($('#effectToggles'), false);
  const is = sec('interactToggles'); show(is, c.has('listen'));
  is.querySelectorAll('.lw-toggle').forEach(b => show(b, b.dataset.opt === 'listen'));
  const ms = sec('musicChips'); show(ms, c.has('music') || c.has('volume'));
  show($('#musicChips'), c.has('music')); show(ms.querySelector('h3'), c.has('music')); show($('#volume').closest('label'), c.has('volume'));
  ms.querySelectorAll('.lw-music-upload, #musicNote').forEach(el => show(el, false));
  show(sec('displayToggles'), false); show($('.lw-tune-head'), false);
  $('#recBtn').hidden = !c.has('record') || !canRecord();
  $('#fxBtn').hidden = !['modes', 'intensity', 'volume', 'music', 'advance', 'listen'].some(k => c.has(k));
}
function applyMode(m, { quiet = false } = {}) {
  const set = m.set;
  S.mode = m.id; S.adjusted = false;
  for (const k of Object.keys(S.effects)) S.effects[k] = set.effects.includes(k);
  for (const k of Object.keys(S.interact)) if (k !== 'listen') S.interact[k] = set.interact.includes(k); // the microphone is never switched on by a mode
  Object.assign(S.display, set.display);
  S.interval = set.interval;
  S.transition = 'random';
  const musicChanged = S.music !== set.music;
  S.music = set.music;
  commit(musicChanged && !quiet);
  if (!player.hidden) layout();
}
$('#resetMode').addEventListener('click', () => applyMode(modeOf(S.mode)));
function commit(musicChanged = false) {
  saveSettings(S, SKEY); renderSettings(); applyLive();
  if (musicChanged && !player.hidden) startMusic();
}
$('#interval').addEventListener('input', (e) => { S.interval = STEPS[+e.target.value] || 10; S.adjusted = true; $('#intervalOut').textContent = fmtSec(S.interval); const rs = $('#resetMode'); rs.hidden = false; rs.textContent = `${T('adjusted')} · ${T('resetMode')}`; saveSettings(S, SKEY); });
$('#volume').addEventListener('input', (e) => { S.volume = +e.target.value; $('#volumeOut').textContent = Math.round(S.volume * 100) + '%'; sound.setVolume(S.volume); saveSettings(S, SKEY); });
$('#musicInput').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f || !studio) return;
  if (f.size > MAX_UPLOAD) { toast(T('tooLarge', f.name), 5000); return; }
  try {
    toast(T('uploading', 1, 1), 60000);
    const { track } = await api('upload', { method: 'POST', query: { kind: 'track', name: f.name.replace(/\.[^.]+$/, '').slice(0, 60) }, raw: f, type: f.type || 'audio/mpeg' });
    await loadCatalog();
    S.music = 'track:' + track.id; toast(T('musicSaved', track.name)); commit(true);
  } catch (err) { studioError(err); }
});

// ---------- static viewing (賞析) ----------
const viewer = $('#viewer'), vwStage = $('#vwStage'), vwImg = $('#vwImg'), vwVideo = $('#vwVideo');
let vList = [], vIdx = 0;
const Z = { s: 1, x: 0, y: 0 };
const vwMedia = () => (vwVideo.hidden ? vwImg : vwVideo);
function applyZoom() { vwMedia().style.transform = `translate(${Z.x}px, ${Z.y}px) scale(${Z.s})`; viewer.classList.toggle('zoomed', Z.s > 1.01); }
function clampPan() {
  const m = vwMedia(), r = vwStage.getBoundingClientRect();
  const w = m.offsetWidth * Z.s, h = m.offsetHeight * Z.s;
  const mx = Math.max(0, (w - r.width) / 2), my = Math.max(0, (h - r.height) / 2);
  Z.x = Math.max(-mx, Math.min(mx, Z.x)); Z.y = Math.max(-my, Math.min(my, Z.y));
}
function zoomAt(ns, cx, cy) {
  const r = vwStage.getBoundingClientRect();
  const px = cx - (r.left + r.width / 2), py = cy - (r.top + r.height / 2);
  ns = Math.max(1, Math.min(6, ns));
  Z.x = px - (px - Z.x) * (ns / Z.s); Z.y = py - (py - Z.y) * (ns / Z.s); Z.s = ns;
  if (ns === 1) { Z.x = 0; Z.y = 0; }
  clampPan(); applyZoom();
}
function renderViewer() {
  const w = vList[vIdx]; if (!w) return;
  Z.s = 1; Z.x = 0; Z.y = 0;
  if (w.type === 'video') { vwImg.hidden = true; vwVideo.hidden = false; vwVideo.src = w.src; vwVideo.play().catch(() => {}); }
  else { vwVideo.pause(); vwVideo.hidden = true; vwImg.hidden = false; vwImg.src = w.src; }
  applyZoom();
  $('#vwIndex').textContent = `${String(vIdx + 1).padStart(2, '0')} / ${String(vList.length).padStart(2, '0')}`;
  $('#vwTitle').textContent = titleOf(w);
  $('#vwSub').textContent = subtitleOf(w);
  $('#vwMeta').textContent = metaOf(w);
  $('#vwStatement').textContent = statementOf(w);
}
function openViewer(id) {
  vList = viewWorks(); vIdx = Math.max(0, vList.findIndex(w => w.id === id));
  viewer.hidden = false; document.body.classList.add('no-scroll');
  renderViewer(); viewer.focus({ preventScroll: true });
}
function closeViewer() { viewer.hidden = true; vwVideo.pause(); document.body.classList.remove('no-scroll'); }
const vwStep = (d) => { vIdx = (vIdx + d + vList.length) % vList.length; renderViewer(); };
$('#vwPrev').addEventListener('click', () => vwStep(-1));
$('#vwNext').addEventListener('click', () => vwStep(1));
$('#vwClose').addEventListener('click', closeViewer);
$('#vwPlay').addEventListener('click', () => { const id = vList[vIdx]?.id; closeViewer(); openPlayer(id); });
vwStage.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(Z.s * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX, e.clientY); }, { passive: false });
vwStage.addEventListener('dblclick', (e) => zoomAt(Z.s > 1.01 ? 1 : 2.6, e.clientX, e.clientY));
const vp = new Map(); let pinch = null, lastTap = 0;
vwStage.addEventListener('pointerdown', (e) => {
  vwStage.setPointerCapture(e.pointerId);
  vp.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (vp.size === 2) { const [a, b] = [...vp.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: Z.s }; }
  if (e.pointerType !== 'mouse') { const now = performance.now(); if (now - lastTap < 300 && vp.size === 1) zoomAt(Z.s > 1.01 ? 1 : 2.6, e.clientX, e.clientY); lastTap = now; }
});
vwStage.addEventListener('pointermove', (e) => {
  const p = vp.get(e.pointerId); if (!p) return;
  if (vp.size === 2 && pinch) {
    vp.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...vp.values()];
    zoomAt(pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
    return;
  }
  if (Z.s > 1.01) { Z.x += e.clientX - p.x; Z.y += e.clientY - p.y; clampPan(); applyZoom(); }
  vp.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
const vpEnd = (e) => { vp.delete(e.pointerId); if (vp.size < 2) pinch = null; };
vwStage.addEventListener('pointerup', vpEnd); vwStage.addEventListener('pointercancel', vpEnd);

// ---------- player ----------
const player = $('#player');
const stage = $('#stage');
const slides = [$('#slideA'), $('#slideB')];
const ambs = [$('#ambA'), $('#ambB')];
const neon = $('#neon');
const fx = new FX($('#fx'), { reduced });
const alive = new Alive(); // R10: the painting itself comes alive and answers touch
const packs = new PackHost(alive); // R10 God mode: effect packages drawn on the same light layers
// the beat for beat-driven light: our music's kick; with our music off but the microphone on, the room's own music;
// otherwise none — beat-driven effects then breathe slowly instead of flashing
const roomBeat = { count: 0, at: -9, level: 0 };
packs.beatFn = () => {
  // every sound the room makes — claps, snaps, knocks, a kick, a hi-hat — flashes the light at once (LED-strip style);
  // the locked beat carries the groove on top. Our own soundtrack is not counted (it already drives the light exactly).
  const hit = () => (listener.on ? { hits: roomBeat.hits || 0, hitAge: roomBeat.hitAge } : {});
  const b = sound.beat();
  if (b.live && !player.classList.contains('muted') && S.music !== 'none') return b;
  if (listener.on && roomBeat.locked) return { live: true, room: true, locked: true, pulse: roomBeat.pulse, count: roomBeat.lockCount, stage: 'groove', energy: roomBeat.level, bpm: roomBeat.bpm, ...hit() };
  if (listener.on && performance.now() / 1000 - (roomBeat.rawAt || -9) < 2.5) return { live: true, room: true, pulse: Math.exp(-(performance.now() / 1000 - roomBeat.rawAt) / 0.11), count: roomBeat.count, stage: 'groove', energy: roomBeat.level, ...hit() };
  return { live: false, quiet: true, pulse: 0, count: 0, ...hit() };
};
packs.chimeFn = (k, i) => (k === 'glow' ? sound.glowChime() : k === 'coin' ? sound.coinChime(i) : sound.zapChime(i)); // one-tap effect sounds
let camT = 0; // camera clock while arranging in God mode (loops the work's duration)
let list = [], idx = 0, cur = 0, ambCur = 0, curDur = 10, curItem = null;
let playing = false, busy = false, pending = null, elapsed = 0, shown = false;
let wakeLock = null, idleTimer = null, captionTimer = null, nextLumi = 0;
const paletteCache = new Map();
const pointCache = new Map();

const mediaOf = (i) => slides[i].dataset.kind === 'video' ? slides[i].querySelector('video') : slides[i].querySelector('img');
const dims = (el) => el.tagName === 'VIDEO' ? [el.videoWidth, el.videoHeight] : [el.naturalWidth, el.naturalHeight];
function fitRect(nw, nh) {
  const W = stage.clientWidth, H = stage.clientHeight;
  const pad = S.display.mat ? Math.max(12, Math.min(64, Math.min(W, H) * (Math.min(W, H) < 600 ? 0.035 : 0.05))) : 0;
  let s = Math.min((W - pad * 2) / nw, (H - pad * 2) / nh);
  // R9: a wide work on a wide screen leaves no room beside or below it, so the title would sit on the painting.
  // Give up a little size (at most ~16%) to free a calm strip below for the title; otherwise keep the full size.
  if (S.display.captions) {
    // a fixed strip (title + subtitle + label below the work), not the caption's current height: that still belongs to the previous work
    const reserve = W < 760 ? 88 + 8 + 82 : 22 + 8 + 114;
    const below = (H - nh * s) / 2, side = (W - nw * s) / 2;
    if (below < reserve && side < 250) {
      const s2 = Math.min((W - pad * 2) / nw, (H - pad - reserve) / nh);
      if (s2 >= s * 0.84) {
        const w = nw * s2, h = nh * s2;
        return { x: (W - w) / 2, y: Math.max(pad * 0.6, (H - reserve - h) / 2), w, h };
      }
    }
  }
  const w = nw * s, h = nh * s;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}
function placeSlide(i) {
  const el = mediaOf(i); const [nw, nh] = dims(el);
  if (!nw) return null;
  const r = fitRect(nw, nh);
  Object.assign(el.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  slides[i].rect = r;
  return r;
}
function placeNeon(r) { if (r) Object.assign(neon.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' }); }
function layout() {
  fx.resize(stage.clientWidth, stage.clientHeight);
  placeSlide(0); placeSlide(1);
  const r = slides[cur].rect; if (r) { fx.setArtRect(r); placeNeon(r); positionCaption(r); alive.setRect(r); if (packs.cam) { packs.cam.r = r; packs.cam.maxZoom = packs.maxZoomFor(packs.cam.media, r); } }
}
// put the living layer on the painting now on screen (when the mode allows it)
function wakeAlive() {
  if (!shown || player.hidden) { alive.detach(); return; }
  const media = mediaOf(cur), work = list[idx];
  if (!work) return;
  if (reduced || !S.interact.alive || work.type === 'video') { alive.detach(); alive.read(slides[cur], media, slides[cur].rect, work.id, paletteCache.get(work.id)); return; }
  if (alive.on) return;
  alive.attach(slides[cur], media, slides[cur].rect, work.id, paletteCache.get(work.id));
}
// the choreography of the work on screen: its effect packages (God mode: what AE arranged for it)
function applyChoreo() {
  if (reduced || player.hidden || !shown) { packs.setEffects([]); return; }
  const it = curItem || {};
  packs.setEffects(god.open ? god.fx : (it.fx || modeFx()));
}
// what a scene mode brings by itself when nothing is arranged: Night Party's prism lasers land on the painting
function modeFx() { return S.mode === 'party' && S.effects.lasers ? [{ id: 'laser', p: {} }] : []; }

// ---------- God mode (AE Studio only) ----------
// Summon effect packages on the work on screen, tune them with the controls each package brings, choose the
// transition into it, then save it to this work, a run of works, or the whole exhibition. Customers' players
// simply follow what is saved (they never see this panel).
const god = { open: false, fx: [], tr: null, cam: null, scope: 'this', sel: null, previewTr: null };
const godPanel = $('#godPanel');
const clone = (o) => JSON.parse(JSON.stringify(o));
function ctrlFor(d, value, onChange) {
  const wrap = document.createElement('div'); wrap.className = 'lw-param';
  const lab = L(d.label);
  if (d.type === 'range') {
    wrap.innerHTML = `<label class="lw-range"><span></span><input type="range"><output></output></label>`;
    const i = wrap.querySelector('input'), out = wrap.querySelector('output');
    wrap.querySelector('span').textContent = lab;
    Object.assign(i, { min: d.min, max: d.max, step: d.step || 0.01, value });
    const fmt = (v) => (Math.abs(v) >= 10 || Number.isInteger(+d.step) ? Math.round(v) : (+v).toFixed(2)) + (d.unit || '');
    out.textContent = fmt(value);
    i.addEventListener('input', () => { out.textContent = fmt(i.value); onChange(+i.value); });
  } else if (d.type === 'choice') {
    wrap.innerHTML = `<p class="lw-param-label"></p><div class="lw-chips"></div>`;
    wrap.querySelector('p').textContent = lab;
    const box = wrap.querySelector('.lw-chips');
    for (const o of d.options) {
      const b = chip(L(o), value === o.id, false, () => { box.querySelectorAll('.lw-chip').forEach(x => x.setAttribute('aria-pressed', String(x === b))); onChange(o.id); });
      box.appendChild(b);
    }
  } else if (d.type === 'toggle') {
    const b = toggle({ id: d.id, zh: d.label.zh, en: d.label.en, dzh: '', den: '' }, value, () => { const on = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(on)); onChange(on); });
    wrap.appendChild(b);
  } else if (d.type === 'color') {
    wrap.innerHTML = `<label class="lw-range"><span></span><input type="color"></label>`;
    wrap.querySelector('span').textContent = lab;
    const i = wrap.querySelector('input'); i.value = value; i.addEventListener('input', () => onChange(i.value));
  }
  return wrap;
}
function godLoad() { // the panel shows what is arranged for the work now on screen
  const it = curItem || {};
  god.fx = clone(it.fx || []); god.tr = it.tr ? clone(it.tr) : null; god.cam = it.cam ? clone(it.cam) : null;
  renderGod(); packs.setEffects(god.fx); godCamera();
}
function godApply() { packs.setEffects(god.fx); renderGod(true); }
function godCamera() { if (!shown) return; packs.setCamera(god.cam, mediaOf(cur), slides[cur].rect, neon); camT = 0; }
function renderGod(keepScroll) {
  const w = list[idx]; $('#godWork').textContent = w ? `${String(idx + 1).padStart(2, '0')} · ${titleOf(w)}` : '';
  // summon: one button per effect package; active ones show their own controls
  const sm = $('#godSummons'); sm.replaceChildren();
  for (const pk of packsOf('effect')) {
    const on = god.fx.some(e => e.id === pk.id);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lw-god-summon'; b.dataset.pack = pk.id; b.setAttribute('aria-pressed', String(on));
    b.innerHTML = '<b></b><small></small>'; b.querySelector('b').textContent = L(pk.name); b.querySelector('small').textContent = L(pk.desc);
    b.addEventListener('click', () => {
      if (on) god.fx = god.fx.filter(e => e.id !== pk.id);
      else if (god.fx.length < 4) god.fx.push({ id: pk.id, p: paramsFor(pk) });
      godApply();
    });
    sm.appendChild(b);
  }
  const pp = $('#godParams'); pp.replaceChildren();
  for (const e of god.fx) {
    const pk = PACKS.get(e.id); if (!pk) continue;
    const box = document.createElement('div'); box.className = 'lw-god-params'; box.dataset.pack = pk.id;
    const h = document.createElement('p'); h.className = 'lw-param-head'; h.textContent = L(pk.name); box.appendChild(h);
    const p = e.p = paramsFor(pk, e.p);
    for (const d of pk.params) box.appendChild(ctrlFor(d, p[d.id], (v) => { p[d.id] = v; packs.setEffects(god.fx); }));
    pp.appendChild(box);
  }
  // transition into this work
  const tc = $('#godTrans'); tc.replaceChildren();
  tc.appendChild(chip(T('godFollow'), !god.tr, false, () => { god.tr = null; renderGod(true); }));
  for (const pk of packsOf('transition')) tc.appendChild(chip(L(pk.name), !!god.tr && god.tr.id === pk.id, true, () => { god.tr = { id: pk.id, p: paramsFor(pk) }; renderGod(true); }));
  const tp = $('#godTransParams'); tp.replaceChildren();
  if (god.tr && PACKS.get(god.tr.id)) {
    const pk = PACKS.get(god.tr.id), p = god.tr.p = paramsFor(pk, god.tr.p);
    for (const d of pk.params) tp.appendChild(ctrlFor(d, p[d.id], (v) => { p[d.id] = v; }));
  }
  $('#godPreview').disabled = list.length < 2;
  // camera: how the work is looked at (whole, from afar, a detail tour, a drone orbit, a film angle)
  const cc = $('#godCams'); cc.replaceChildren();
  cc.appendChild(chip(T('godNoCam'), !god.cam, false, () => { god.cam = null; godCamera(); renderGod(true); }));
  for (const pk of packsOf('camera')) cc.appendChild(chip(L(pk.name), !!god.cam && god.cam.id === pk.id, true, () => { god.cam = { id: pk.id, p: paramsFor(pk) }; godCamera(); renderGod(true); }));
  const cp = $('#godCamParams'); cp.replaceChildren();
  if (god.cam && PACKS.get(god.cam.id)) {
    const pk = PACKS.get(god.cam.id), p = god.cam.p = paramsFor(pk, god.cam.p);
    const d0 = document.createElement('p'); d0.className = 'lw-note'; d0.textContent = L(pk.desc); cp.appendChild(d0);
    for (const d of pk.params) cp.appendChild(ctrlFor(d, p[d.id], (v) => { p[d.id] = v; packs.cameraSet(p); camT = 0; }));
  }
  const mz = shown ? packs.maxZoomFor(mediaOf(cur), slides[cur].rect) : 1;
  $('#godZoomNote').textContent = T('godMaxZoom', mz.toFixed(1));
  // where to save it
  const sh = currentShow();
  const sc = $('#godScope'); sc.replaceChildren();
  for (const id of ['this', 'range', 'all']) sc.appendChild(chip(T('godScope_' + id), god.scope === id, false, () => { god.scope = id; renderGod(true); }));
  $('#godRange').hidden = god.scope !== 'range';
  const n = list.length; const f = $('#godFrom'), t = $('#godTo');
  f.max = t.max = n; if (!f.value) f.value = idx + 1; if (!t.value) t.value = Math.min(n, idx + 3);
  $('#godNeedShow').hidden = !!sh; $('#godNeedShow').textContent = T('godNeedShow');
  // the packages this studio has: built-in and imported (with versions)
  const pl = $('#godPackList'); pl.replaceChildren();
  for (const pk of PACKS.values()) {
    const li = document.createElement('li'); li.innerHTML = '<span><b></b> <small></small></span><span></span>';
    li.querySelector('b').textContent = L(pk.name); li.querySelector('small').textContent = pk.type;
    li.lastChild.textContent = BUILTIN.has(pk.id) && !catalogPacks.some(c => c.id === pk.id) ? `v${pk.version || 1} · ${T('godBuiltin')}` : `v${pk.version || 1}`;
    pl.appendChild(li);
  }
  $('#godSave').disabled = !sh;
}
function openGod() {
  if (!studio || ED || player.hidden) return;
  closeSheet();
  god.open = true; godPanel.hidden = false; scrim.hidden = false; setTuning(true);
  $('#godFrom').value = ''; $('#godTo').value = '';
  godLoad(); showControls();
}
function closeGod() {
  if (!god.open) return;
  god.open = false; godPanel.hidden = true; scrim.hidden = true; setTuning(false);
  applyChoreo(); // back to what is saved
}
$('#godBtn').addEventListener('click', () => (god.open ? closeGod() : openGod()));
$('#godClose').addEventListener('click', closeGod);
$('#godPreview').addEventListener('click', () => {
  if (list.length < 2 || busy) return;
  // replay the arrival of this work from the previous one, with the transition chosen here
  god.previewTr = god.tr ? clone(god.tr) : null;
  const target = idx, keepFx = clone(god.fx), keepTr = god.tr ? clone(god.tr) : null;
  const back = (target - 1 + list.length) % list.length;
  god.replay = { target, keepFx, keepTr };
  god.previewTr = null; jump(back);
  const wait = () => { if (busy) return setTimeout(wait, 120); god.previewTr = keepTr; jump(target); const w2 = () => { if (busy || idx !== target) return setTimeout(w2, 120); god.fx = keepFx; god.tr = keepTr; godApply(); }; setTimeout(w2, 200); };
  setTimeout(wait, 300);
});
$('#godPackInput').addEventListener('change', async (e) => {
  const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const code = await f.text();
    const pk = packFromSource(code); registerPack(pk); // checked before it is stored
    const { pack } = await api('upload', { method: 'POST', query: { kind: 'pack', id: pk.id, ptype: pk.type, version: String(pk.version || 1), name: JSON.stringify(pk.name || {}) }, raw: new Blob([code], { type: 'text/javascript' }), type: 'text/javascript' });
    packSources.set(pack.src, code);
    await loadCatalog(); renderGod(true);
    toast(T('godImported', `${L(pk.name)} v${pk.version || 1}`));
  } catch (err) { if (err && err.code) studioError(err); else toast(T('godImportBad')); }
});
$('#godSave').addEventListener('click', async () => {
  const sh = currentShow(); if (!sh) return;
  const n = list.length;
  let from = idx, to = idx;
  if (god.scope === 'all') { from = 0; to = n - 1; }
  else if (god.scope === 'range') { from = Math.max(0, Math.min(n - 1, (+$('#godFrom').value || 1) - 1)); to = Math.max(from, Math.min(n - 1, (+$('#godTo').value || from + 1) - 1)); }
  const ids = new Set(list.slice(from, to + 1).map(w => w.id));
  const copy = clone(sh);
  copy.items = copy.items.map(it => {
    if (!ids.has(it.id)) return it;
    const o = { ...it, fx: clone(god.fx) };
    if (god.tr) o.tr = clone(god.tr); else delete o.tr;
    if (god.cam) o.cam = clone(god.cam); else delete o.cam;
    return o;
  });
  const saved = await saveShow(copy, { silent: true });
  if (saved) {
    // keep playing the same works with the saved choreography
    const keep = list.map(w => w.id);
    curItem = itemOf(list[idx].id);
    toast(T('godSaved', to - from + 1), 3600);
    void keep;
  }
});
window.addEventListener('resize', () => { if (!player.hidden) layout(); });
window.addEventListener('orientationchange', () => setTimeout(() => { if (!player.hidden) layout(); }, 250));

function extractPalette(el) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 36;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(el, 0, 0, 36, 36);
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
    const out = bins.filter(b => b.w > 0).sort((a, b) => b.w - a.w).slice(0, 5).map(b => brighten([b.r / b.w, b.g / b.w, b.b / b.w]));
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

// 內在綻放：find up to 4 well-separated bright, luminous places in a work (normalized u,v + color)
function brightPoints(el) {
  try {
    const N = 40, c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(el, 0, 0, N, N);
    const d = x.getImageData(0, 0, N, N).data;
    const cells = [];
    for (let j = 2; j < N - 2; j++) for (let i = 2; i < N - 2; i++) {
      let r = 0, g = 0, b = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const k = ((j + dy) * N + (i + dx)) * 4; r += d[k]; g += d[k + 1]; b += d[k + 2]; }
      r /= 9; g /= 9; b /= 9;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b, sat = mx ? (mx - mn) / mx : 0;
      cells.push({ u: (i + 0.5) / N, v: (j + 0.5) / N, s: lum * (0.75 + 0.5 * sat) - (mn > 235 ? 60 : 0), c: [r, g, b].map(Math.round) });
    }
    cells.sort((a, b) => b.s - a.s);
    const out = [];
    for (const q of cells) { if (out.every(o => Math.hypot(o.u - q.u, o.v - q.v) > 0.24)) out.push(q); if (out.length === 4) break; }
    return out.map(({ u, v, c }) => ({ u, v, c }));
  } catch { return []; }
}

function loadImg(img, src) {
  return new Promise((resolve) => {
    if (img.getAttribute('src') === src && img.complete && img.naturalWidth) return resolve(true);
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  }).then(ok => ok && img.decode ? img.decode().then(() => true, () => true) : ok);
}
function loadVideo(v, src) {
  return new Promise((resolve) => {
    const abs = new URL(src, location.href).href;
    if (v.src === abs && v.readyState >= 2) return resolve(true);
    const t = setTimeout(() => resolve(v.readyState >= 1), 10000);
    v.onloadeddata = () => { clearTimeout(t); resolve(true); };
    v.onerror = () => { clearTimeout(t); resolve(false); };
    v.src = abs; v.load();
  });
}
async function loadInto(slot, work) {
  const s = slides[slot], img = s.querySelector('img'), v = s.querySelector('video');
  if (work.type === 'video') {
    img.hidden = true; v.hidden = false; s.dataset.kind = 'video';
    const ok = await loadVideo(v, work.src);
    if (ok) { try { v.currentTime = 0; } catch { /* ignore */ } v.play().catch(() => {}); }
    return ok;
  }
  v.pause(); v.hidden = true; s.dataset.kind = 'image'; img.hidden = false;
  return loadImg(img, work.src);
}

function buildList(startId) {
  const base = viewWorks();
  const inView = new Set(base.map(w => w.id));
  const sel = S.selected.filter(id => inView.has(id));
  let l = sel.length ? sel.map(id => works.find(w => w.id === id)).filter(Boolean) : [...base];
  if (S.display.shuffle) for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
  let start = 0;
  if (startId) { start = l.findIndex(w => w.id === startId); if (start < 0) { const w = works.find(x => x.id === startId); if (w) l.unshift(w); start = 0; } }
  return { l, start };
}

async function openPlayer(startId) {
  const { l, start } = buildList(startId);
  if (!l.length) return;
  list = l; idx = start; shown = false; busy = false; pending = null; elapsed = 0;
  sound.ensure(); // unlock audio inside the user gesture (Safari)
  player.hidden = false;
  document.body.classList.add('no-scroll');
  player.focus({ preventScroll: true });
  try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch { /* iPhone */ }
  slides.forEach(s => { resetSlide(s, false); s.classList.remove('live'); });
  ambs.forEach(a => a.classList.remove('on'));
  closeSheet();
  buildStrip();
  layout(); applyLive(); fx.start();
  playing = true; player.classList.remove('paused');
  startMusic(); requestWake(); showControls();
  if (S.interact.listen) startListening(false).then(ok => { $('#micDot').hidden = !ok; });
  nextLumi = 40;
  if (S.display.intro) await playIntro();
  if (player.hidden) return;
  await show(idx);
  if (player.hidden) return;
  if (S.interact.ripple || S.interact.seeds || S.interact.cute) { const h = $('#hint'); h.classList.add('on'); setTimeout(() => h.classList.remove('on'), 3800); }
  if (S.interact.lumi) setTimeout(() => fx.say(T('lumiHello')), 1200);
}
// Title card: gold Three Rings, the exhibition title and the house motto
function playIntro() {
  const el = $('#plIntro');
  const sh = currentShow();
  $('#introTitle').textContent = sh ? showTitle(sh) : (ED ? (lang === 'zh' ? ED.title.zh || ED.title.en : ED.title.en || ED.title.zh) : '');
  el.hidden = false; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => { el.hidden = true; el.classList.remove('on', 'out'); resolve(); }, 900); };
    const t = setTimeout(finish, reduced ? 1500 : 4800);
    el.onpointerdown = () => { clearTimeout(t); finish(); };
  });
}
function closePlayer() {
  closeLoupe(); closeGod(); setTrayOpen(false); packs.clear(true); packs.resetCamera(); slides.forEach(sl => { const m = sl.querySelector('img'); m.style.transform = ''; m.style.animation = ''; }); alive.clear(); player.classList.remove('alivehover');
  playing = false;
  stopListening(); toggleInfo(false);
  fx.stop(); sound.stop();
  slides.forEach(s => s.querySelector('video').pause());
  player.hidden = true;
  document.body.classList.remove('no-scroll');
  $('#hint').classList.remove('on');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  releaseWake(); closeSheet();
  $('#playBtn').focus();
  if (LIC_ID && LIC && $('#licGate').hidden) showStartGate();
}
function startMusic() {
  if (S.music === 'none') { sound.stop(); player.classList.add('muted'); return; }
  sound.setVolume(S.volume);
  if (String(S.music).startsWith('track:')) {
    const t = tracks.find(x => 'track:' + x.id === S.music);
    if (!t) { S.music = modeOf(S.mode).set.music; return startMusic(); }
    sound.setCustom(t.src); sound.play('custom');
  } else sound.play(S.music);
  player.classList.remove('muted');
}

async function show(i) {
  busy = true;
  alive.detach(); packs.clear();
  const work = list[i];
  const nextSlot = shown ? 1 - cur : cur;
  const incoming = slides[nextSlot];
  const ok = await loadInto(nextSlot, work);
  if (!ok) { busy = false; if (list.length > 1) { list.splice(i, 1); idx = i % list.length; buildStrip(); return show(idx); } return; }
  const r = placeSlide(nextSlot);
  const media = mediaOf(nextSlot);
  curItem = itemOf(work.id);
  curDur = (curItem && curItem.duration) || S.interval;
  if (work.type === 'video' && Number.isFinite(media.duration) && media.duration > curDur) curDur = Math.min(600, media.duration);
  let pal = paletteCache.get(work.id);
  if (!pal) { pal = extractPalette(media); if (pal && work.type !== 'video') paletteCache.set(work.id, pal); }
  if (pal) { fx.setPalette(pal); neon.style.setProperty('--neon', `rgb(${pal[0].join(',')})`); }
  let pts = pointCache.get(work.id);
  if (!pts) { pts = brightPoints(media); if (work.type !== 'video') pointCache.set(work.id, pts); }
  fx.setBloomPoints(pts);
  const na = 1 - ambCur;
  ambs[na].style.backgroundImage = `url("${work.thumb || work.src}")`;
  ambs[na].classList.add('on'); ambs[ambCur].classList.remove('on'); ambCur = na;
  setCaption(work, i, r);
  if (!$('#plInfo').hidden) fillInfo(work);
  markStrip(i);
  const from = shown ? slides[cur] : null;
  const fromMedia = from ? mediaOf(cur) : null;
  let kind = (curItem && curItem.transition) || S.transition;
  if (kind === 'random') kind = pickTransition(modeOf(S.mode).set.pool);
  if (reduced) kind = 'dissolve';
  media.style.setProperty('--kb-x', `${25 + Math.random() * 50}%`);
  media.style.setProperty('--kb-y', `${25 + Math.random() * 50}%`);
  media.style.setProperty('--kb-dur', `${curDur + 4}s`);
  incoming.classList.add('live');
  fx.setArtRect(r); placeNeon(r);
  // a transition package chosen in God mode (or a one-off preview) takes the place of the built-in one
  const trSet = god.previewTr || (curItem && curItem.tr) || null; god.previewTr = null;
  packs.setCamera(god.open ? god.cam : (curItem && curItem.cam) || null, media, r, neon); camT = 0;
  const tpk = trSet && transitionPack(trSet.id);
  await runTransition(kind, { from, to: incoming, fromImg: fromMedia, fromRect: from ? from.rect : null, rect: r, points: pts, W: stage.clientWidth, H: stage.clientHeight, fx, speed: Math.max(0.5, Math.min(1.3, curDur / 12)), pack: tpk, params: tpk ? paramsFor(tpk, trSet.p) : null });
  if (from) { from.classList.remove('live'); from.querySelector('video').pause(); if (fromMedia) { fromMedia.style.transform = ''; fromMedia.style.animation = ''; } }
  cur = nextSlot; shown = true; elapsed = 0; busy = false;
  wakeAlive();
  if (god.open) godLoad(); else applyChoreo();
  const nx = list[(i + 1) % list.length];
  if (nx && nx.type !== 'video') { const p = new Image(); p.decoding = 'async'; p.src = nx.src; }
  if (pending) { const p = pending; pending = null; p.to != null ? jump(p.to) : go(p.dir); }
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
  if (busy) { pending = { dir }; return; }
  let n = idx + dir;
  if (n >= list.length) { if (!S.display.loop && dir > 0 && playing) { setPaused(true); toast(T('endOfShow')); return; } n = 0; }
  if (n < 0) n = list.length - 1;
  if (n === idx && shown) return;
  idx = n; show(idx);
}
function jump(n) {
  if (busy) { pending = { to: n }; return; }
  if (n === idx || n < 0 || n >= list.length) return;
  idx = n; elapsed = 0; show(idx);
}
// Put the title in the dark margin around the artwork (below it, or beside it); overlay only when the work fills the screen
function positionCaption(r) {
  const cap = $('#caption'); if (!r) return;
  const W = stage.clientWidth, H = stage.clientHeight, narrow = W < 760;
  const minBottom = narrow ? 88 : 22;
  cap.style.left = ''; cap.style.bottom = ''; cap.style.maxWidth = ''; cap.classList.remove('over', 'side');
  const capH = cap.offsetHeight || 90;
  const below = H - (r.y + r.h), left = r.x;
  if (below >= capH + minBottom + 8) {
    cap.style.left = Math.max(16, r.x) + 'px';
    cap.style.maxWidth = Math.max(220, Math.min(r.w, W - 32)) + 'px';
    cap.style.bottom = Math.max(minBottom, (below - capH) / 2) + 'px';
  } else if (left >= 250) {
    cap.classList.add('side');
    cap.style.left = Math.max(20, left * 0.12) + 'px';
    cap.style.maxWidth = (left - Math.max(20, left * 0.12) - 28) + 'px';
    cap.style.bottom = Math.max(minBottom, H - (r.y + r.h)) + 'px';
  } else cap.classList.add('over');
}

function setCaption(work, i, rect) {
  const cap = $('#caption');
  cap.classList.add('off');
  clearTimeout(captionTimer);
  if (!S.display.captions) return;
  captionTimer = setTimeout(() => {
    $('#capTitle').textContent = titleOf(work);
    $('#capSub').textContent = subtitleOf(work);
    $('#capIndex').textContent = `${String(i + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`;
    const lab = S.display.label;
    $('#capLabel').textContent = lab ? metaOf(work) : '';
    $('#capStatement').textContent = '';
    positionCaption(rect || slides[cur].rect);
    cap.classList.remove('off');
    captionTimer = setTimeout(() => cap.classList.add('off'), lab ? 11000 : 6500);
  }, 1100);
}
function setPaused(p) {
  playing = !p;
  player.classList.toggle('paused', p);
  $('#pauseBtn').setAttribute('aria-label', p ? 'Play' : 'Pause');
  const v = mediaOf(cur); if (v.tagName === 'VIDEO') { if (p) v.pause(); else v.play().catch(() => {}); }
}

// ---------- R6: record a moving clip (IG / FB / live wallpaper) ----------
const recDialog = $('#recDialog');
const rec = { format: 'story', secs: 15, ctrl: null, blob: null, name: '', wasPlaying: false };
const recPane = (id) => ['recSetup', 'recProgress', 'recResult'].forEach(k => { $('#' + k).hidden = k !== id; });
function openRecord() {
  if (!canRecord()) { toast(T('recUnsupported')); return; }
  rec.wasPlaying = playing; setPaused(true);
  recPane('recSetup');
  recDialog.showModal();
}
$('#recFormats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-format]'); if (!b) return;
  rec.format = b.dataset.format;
  document.querySelectorAll('#recFormats [data-format]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  $('#recCaptions').disabled = rec.format === 'wallpaper';
});
$('#recSecs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-secs]'); if (!b) return;
  rec.secs = +b.dataset.secs;
  document.querySelectorAll('#recSecs [data-secs]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
});
function closeRecord() {
  if (rec.ctrl) rec.ctrl.abort();
  recDialog.close();
  const v = $('#recPreview'); v.pause(); if (v.src) { URL.revokeObjectURL(v.src); v.removeAttribute('src'); }
  if (!player.hidden && rec.wasPlaying) setPaused(false);
}
$('#recClose').addEventListener('click', closeRecord);
$('#recDone').addEventListener('click', closeRecord);
$('#recAbort').addEventListener('click', () => { if (rec.ctrl) rec.ctrl.abort(); });
$('#recAgain').addEventListener('click', () => recPane('recSetup'));
recDialog.addEventListener('cancel', (e) => { e.preventDefault(); closeRecord(); });
async function loadForClip(w) {
  if (w.type === 'video') {
    const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
    const ok = await loadVideo(v, w.src); if (!ok) return null;
    v.play().catch(() => {}); return v;
  }
  const im = new Image(); im.decoding = 'async';
  const ok = await loadImg(im, w.src); return ok ? im : null;
}
$('#recGo').addEventListener('click', async () => {
  const wallpaper = rec.format === 'wallpaper';
  const n = wallpaper ? 1 : Math.min(list.length, rec.secs <= 15 ? 4 : 7);
  const picks = Array.from({ length: n }, (_, k) => list[(idx + k) % list.length]);
  recPane('recProgress');
  $('#recStatus').textContent = T('recording', 0, rec.secs); $('#recBar').style.width = '0%';
  const ctrl = rec.ctrl = new AbortController();
  fx.stop();
  try {
    const items = [];
    for (const w of picks) {
      const el = await loadForClip(w); if (!el) continue;
      let pal = paletteCache.get(w.id); if (!pal) { pal = extractPalette(el); if (pal) paletteCache.set(w.id, pal); }
      let pts = pointCache.get(w.id); if (!pts) { pts = brightPoints(el); pointCache.set(w.id, pts); }
      items.push({ el, title: titleOf(w), sub: subtitleOf(w), meta: S.display.label ? metaOf(w) : '', points: pts, palette: pal });
    }
    if (!items.length) throw new Error('no works');
    const supported = ['innerbloom', 'dissolve', 'rings', 'bubbles'];
    const pool = modeOf(S.mode).set.pool.map(k => supported.includes(k) ? k : (k === 'ink' || k === 'bloom' ? 'innerbloom' : 'dissolve'));
    const transitions = [...new Set(['innerbloom', ...pool])];
    let audioStream = null;
    if (S.music !== 'none') { if (player.classList.contains('muted')) startMusic(); audioStream = sound.captureStream(); }
    const logo = $('.pl-mark img');
    const sh = currentShow();
    const small = Math.min(window.innerWidth, window.innerHeight) < 820 || (navigator.hardwareConcurrency || 8) <= 4;
    const out = await recordClip({
      works: items, format: rec.format, seconds: rec.secs, watermark: $('#recWatermark').checked, captions: $('#recCaptions').checked && !wallpaper,
      scale: small ? 2 / 3 : 1, effects: liveEffects(), density: INTENSITY_DENSITY[(S.intensity || 3) - 1], fxOpacity: INTENSITY_ALPHA[(S.intensity || 3) - 1], tempo: modeOf(S.mode).set.tempo || 1, transitions, logo, motto: T('motto'), lang,
      showTitle: sh ? showTitle(sh) : (ED ? (lang === 'zh' ? ED.title.zh || ED.title.en : ED.title.en || ED.title.zh) : 'AE Universe Creation'),
      audioStream, signal: ctrl.signal, monitor: $('#recMonitor'),
      onProgress: (t, total) => { $('#recStatus').textContent = T('recording', Math.floor(t), total); $('#recBar').style.width = (t / total * 100) + '%'; },
    });
    rec.blob = out.blob;
    const slug = (sh ? (sh.title.en || 'exhibition') : 'lumina').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lumina';
    rec.name = `AE-Universe-Creation-${slug}-${rec.format}-${rec.secs}s.${out.ext}`;
    const v = $('#recPreview'); v.src = URL.createObjectURL(out.blob); v.play().catch(() => {});
    $('#recInfo').textContent = `${out.width}×${out.height} · ${rec.secs}s · ${(out.blob.size / 1048576).toFixed(1)} MB · ${out.ext.toUpperCase()}`;
    const file = new File([out.blob], rec.name, { type: out.mime });
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    $('#recShare').hidden = !canShare;
    // on phones the photo album is what people look for: "save to Photos / share" first, the file download second
    $('#recShare').textContent = T(IS_IOS || IS_ANDROID ? 'saveToPhotos' : 'share');
    $('#recSave').textContent = T(IS_IOS || IS_ANDROID ? 'saveFile' : 'saveVideo');
    recPane('recResult');
    window.__lumina.lastClip = { size: out.blob.size, mime: out.mime, width: out.width, height: out.height, name: rec.name, audio: !!audioStream };
  } catch (err) {
    if (err.code !== 'ABORTED') { console.warn('record', err); toast(T('recFailed')); }
    recPane('recSetup');
  } finally {
    rec.ctrl = null;
    if (!player.hidden) fx.start();
  }
});
// where a downloaded file lands, said plainly (iPhone puts downloads in the Files app, not in Photos)
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const IS_ANDROID = /Android/.test(navigator.userAgent);
$('#recSave').addEventListener('click', () => {
  if (!rec.blob) return;
  const a = document.createElement('a'); a.href = URL.createObjectURL(rec.blob); a.download = rec.name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  toast(T(IS_IOS ? 'savedIOS' : IS_ANDROID ? 'savedAndroid' : 'savedDesktop', rec.name), 9000);
});
$('#recShare').addEventListener('click', async () => {
  if (!rec.blob) return;
  const file = new File([rec.blob], rec.name, { type: rec.blob.type });
  try { await navigator.share({ files: [file], title: 'AE Universe Creation', text: T('motto') }); } catch { /* user cancelled */ }
});
$('#recBtn').addEventListener('click', openRecord);
$('#recBtn').hidden = !canRecord();

// ---------- R8: bilingual note, opened on demand (never pops up by itself) ----------
function fillInfo(w) {
  $('#infoTitle').textContent = titleOf(w);
  $('#infoSub').textContent = subtitleOf(w);
  $('#infoMeta').textContent = metaOf(w);
  const zh = w.statement?.zh || '', en = w.statement?.en || '';
  $('#infoZh').textContent = zh || (en ? '' : T('infoEmpty'));
  $('#infoEn').textContent = en;
}
function toggleInfo(force) {
  const el = $('#plInfo'); const open = force != null ? force : el.hidden;
  if (open) fillInfo(list[idx]);
  el.hidden = !open; player.classList.toggle('info-open', open);
}
$('#infoBtn').addEventListener('click', () => toggleInfo());
$('#infoClose').addEventListener('click', () => toggleInfo(false));
$('#intensity').addEventListener('input', (e) => { S.intensity = +e.target.value; $('#intensityOut').textContent = S.intensity; S.adjusted = true; saveSettings(S, SKEY); applyLive(); });

// ---------- R8: sound reaction (microphone; analysed on this device only) ----------
const listener = new Listener();
async function startListening(fromGesture) {
  if (listener.on) return true;
  if (!Listener.supported()) { toast(T('micUnavailable')); return false; }
  try { sound.ensure(); await listener.start(sound.ctx); $('#micDot').hidden = player.hidden; return true; }
  catch (err) { if (fromGesture) toast(err && err.name === 'NotAllowedError' ? T('micDenied') : T('micUnavailable')); return false; }
}
function stopListening() { listener.stop(); $('#micDot').hidden = true; fx.setSound(0, null); }
async function setListen(on) {
  if (on) { const ok = await startListening(true); S.interact.listen = ok; }
  else { S.interact.listen = false; stopListening(); }
  S.adjusted = true; saveSettings(S, SKEY); renderSettings();
}

// ---------- R8: automatic lighter quality on slow devices (old TVs, tablets) ----------
let lowPower = false, fpsAcc = 0, fpsFrames = 0, slowWins = 0, lastFps = 0;
function trackFps(dt) {
  if (lowPower || !playing || !shown) return;
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc < 2) return;
  const f = fpsFrames / fpsAcc; fpsAcc = 0; fpsFrames = 0; lastFps = Math.round(f);
  if (f < 30) { if (++slowWins >= 2) enterLowPower(); } else slowWins = 0;
}
function enterLowPower() {
  lowPower = true; fx.maxDpr = 0.75; player.classList.add('lowpower');
  layout(); applyLive(); toast(T('lowPower'));
}

// never let the player (or its stage) be scrolled by focus or scrollIntoView
for (const el of [player, stage]) el.addEventListener('scroll', () => { if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; } });

// film strip
const strip = $('#strip');
function buildStrip() {
  strip.replaceChildren(...list.map((w, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pl-thumb'; b.dataset.i = i; b.setAttribute('aria-label', titleOf(w));
    if (w.thumb) { const im = document.createElement('img'); im.src = w.thumb; im.alt = ''; im.loading = 'lazy'; b.appendChild(im); }
    else { const sp = document.createElement('span'); sp.textContent = '▶'; b.appendChild(sp); }
    return b;
  }));
}
function markStrip(i) {
  strip.querySelectorAll('.pl-thumb').forEach((b, k) => b.classList.toggle('on', k === i));
  const on = strip.querySelector('.pl-thumb.on');
  if (on && !strip.hidden) strip.scrollTo({ left: on.offsetLeft - strip.clientWidth / 2 + on.offsetWidth / 2, behavior: 'smooth' });
}
strip.addEventListener('click', (e) => { const b = e.target.closest('.pl-thumb'); if (b) jump(+b.dataset.i); });
$('#stripBtn').addEventListener('click', () => { strip.hidden = !strip.hidden; player.classList.toggle('strip-open', !strip.hidden); markStrip(idx); });

// frame tick
const progressBar = $('#progressBar');
const breathEl = $('#breathGuide');
fx.onFrame = (dt) => {
  trackFps(dt); watchMusic(dt);
  sound.visualLead = Math.min(0.05, (sound.visualLead || 0.016) * 0.9 + dt * 0.1); // one frame ahead, averaged
  alive.frame(dt, playing);
  packs.frame(dt);
  // manual paging: the camera plays its move once and holds; God mode loops it; otherwise it follows the work's time
  if (packs.cam && shown) { const manual = S.advance === 'manual'; if (god.open || (manual && playing)) camT += dt; packs.cameraFrame(god.open ? (camT % curDur) / curDur : manual ? Math.min(1, camT / curDur) : elapsed / curDur); }
  // while the camera is close or at an angle, the title steps aside (like a documentary); it returns with the whole
  const cp = packs.camPose; player.classList.toggle('cam-close', !!cp && (cp.s > 1.12 || Math.abs(cp.ry) > 6 || Math.abs(cp.rx) > 6));
  if (listener.on) {
    const r = listener.update(dt);
    fx.setSound(r.level, r.kind);
    if (r.clap) fx.soundClap(Math.max(1, r.tier));
    listener.lead = sound.visualLead || 0.016;
    Object.assign(roomBeat, { locked: r.locked, lockCount: r.lockCount, pulse: r.pulse, bpm: r.bpm, hits: r.hitCount, hitAge: r.hitAge, kickAge: r.kickAge });
    if (r.locked ? r.lockBeat : (r.beat && r.kind === 'music')) { fx.soundBeat(Math.max(1, r.tier)); roomBeat.count++; roomBeat.at = performance.now() / 1000; roomBeat.level = r.level; if (!r.locked) roomBeat.rawAt = roomBeat.at; }
    const md = $('#micDot'); md.style.setProperty('--lv', r.level.toFixed(2)); md.dataset.kind = r.kind || '';
  }
  if (playing && shown && !busy && !loupeOn && !alive.pressing && !god.open && S.advance !== 'manual') { // the work stays while someone looks closely
    elapsed += dt;
    if (elapsed >= curDur) { elapsed = 0; go(1); }
  }
  progressBar.style.width = (shown && S.advance !== 'manual' ? Math.min(100, elapsed / curDur * 100) : 0) + '%';
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
const INTENSITY_ALPHA = [0.55, 0.72, 0.88, 1, 1], INTENSITY_DENSITY = [0.6, 0.8, 1, 1.15, 1.3];
const liveEffects = () => ({ ...S.effects, lasers: false }); // lasers are the prism laser package now (Night Party), landing on the painting
function applyLive() {
  fx.tempo = modeOf(S.mode).set.tempo || 1;
  const lvl = Math.max(1, Math.min(5, S.intensity || 3));
  fx.density = INTENSITY_DENSITY[lvl - 1] * (lowPower ? 0.6 : 1);
  $('#fx').style.opacity = INTENSITY_ALPHA[lvl - 1];
  fx.setEffects(liveEffects());
  fx.setInteract(S.interact);
  alive.gain = [0.6, 0.8, 1, 1.2, 1.4][lvl - 1];
  alive.maxDpr = lowPower ? 0.6 : 1; alive.quality = lowPower ? 0.5 : 1;
  alive.enabled = !!S.interact.alive;
  alive.rich = !!modeOf(S.mode).set.rich;
  syncTray();
  if (!player.hidden) { if (S.interact.alive) wakeAlive(); else alive.detach(); }
  sound.chimeOn = S.interact.chime;
  neon.classList.toggle('on', !!S.effects.neon && !S.display.camera);
  breathEl.classList.toggle('on', !!S.effects.breath);
  player.classList.toggle('nodrift', !S.display.drift || reduced);
  player.classList.toggle('camera', !!S.display.camera && !reduced);
  player.classList.toggle('grain', !!S.effects.lumiere);
  if (!S.display.captions) $('#caption').classList.add('off');
  if (!player.hidden && slides[cur] && slides[cur].rect) layout(); // the title strip may come or go
  if (!player.hidden && shown && !god.open) applyChoreo(); // a scene mode can bring its own packages (Night Party lasers)
}

// controls
$('#prevBtn').addEventListener('click', () => { go(-1); elapsed = 0; });
$('#nextBtn').addEventListener('click', () => { go(1); elapsed = 0; });
$('#pauseBtn').addEventListener('click', () => setPaused(playing));
$('#closeBtn').addEventListener('click', closePlayer);
$('#fxBtn').addEventListener('click', openSheet);
$('#musicBtn').addEventListener('click', () => {
  if (player.classList.contains('muted')) { if (S.music === 'none') { S.music = modeOf(S.mode).set.music === 'none' ? 'celestial' : modeOf(S.mode).set.music; saveSettings(S, SKEY); } startMusic(); }
  else { sound.stop(); player.classList.add('muted'); }
});
$('#fsBtn').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen?.().catch(() => {});
});
document.addEventListener('fullscreenchange', () => { if (!player.hidden) setTimeout(layout, 120); });
function showControls() {
  player.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (sheet.hidden && strip.hidden) player.classList.add('idle'); }, 3200);
}

let down = null;
// one-tap effects tray (homepage show): Glow, Gold coins, Laser
const tray = $('#fxTray'), trayBtn = $('#trayBtn');
function renderTray() {
  tray.replaceChildren();
  for (const pk of packsOf('burst')) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.burst = pk.id;
    b.innerHTML = `<i class="i-${pk.icon || pk.id}" aria-hidden="true"></i><span></span>`; b.querySelector('span').textContent = L(pk.name);
    b.addEventListener('click', (e) => { e.stopPropagation(); sound.ensure(); packs.fire(pk.id); showControls(); });
    tray.appendChild(b);
  }
}
function syncTray() { const on = !!S.interact.tray && !reduced; trayBtn.hidden = !on; if (!on) setTrayOpen(false); }
function setTrayOpen(open) { tray.hidden = !open; trayBtn.setAttribute('aria-expanded', String(open)); if (open) renderTray(); }
trayBtn.addEventListener('click', () => setTrayOpen(tray.hidden));

// how firmly the painting is touched: pen pressure, real touch pressure (some Android), or a wider fingertip
function forceOf(e) {
  let f = 0;
  if (e.pointerType === 'pen' && e.pressure > 0) f = e.pressure;
  else if (e.pointerType === 'touch') {
    if (e.pressure > 0 && e.pressure !== 0.5 && e.pressure !== 1) f = e.pressure;
    const area = (e.width || 0) * (e.height || 0); // contact size in CSS px²
    if (area > 500) f = Math.max(f, Math.min(1, (area - 500) / 1500));
  }
  return Math.max(0, Math.min(1, f));
}
const isUi = (el) => el.closest('.pl-controls, .lw-sheet, .pl-strip, .pl-info, .pl-tray, dialog');
// ---- magnifier (R9.1): long-press the work → a round lens; drag to look around; release to close ----
const loupe = $('#loupe'), loupeImg = loupe.querySelector('img');
const LOUPE_ZOOM = 2.6;
let loupeOn = false, loupeTimer = null;
function loupeSize() { const m = Math.min(player.clientWidth, player.clientHeight); return Math.round(Math.max(140, Math.min(260, m * 0.38))); }
function openLoupe(x, y, touch) {
  const sl = slides[cur], r = sl && sl.rect, el = sl && sl.querySelector('img:not([hidden])');
  if (!r || !el || !el.currentSrc || !shown) return;
  if (x < r.x - 8 || x > r.x + r.w + 8 || y < r.y - 8 || y > r.y + r.h + 8) return; // only on the work itself
  if (loupeImg.src !== el.currentSrc) loupeImg.src = el.currentSrc;
  const L = loupeSize(); loupe.style.setProperty('--ls', L + 'px');
  loupeImg.style.width = (r.w * LOUPE_ZOOM) + 'px'; loupeImg.style.height = (r.h * LOUPE_ZOOM) + 'px';
  loupeOn = { touch, L }; loupe.hidden = false; void loupe.offsetWidth; loupe.classList.add('on');
  moveLoupe(x, y);
}
function moveLoupe(x, y) {
  if (!loupeOn) return;
  const r = slides[cur].rect, L = loupeOn.L, W = player.clientWidth, H = player.clientHeight;
  const px = Math.max(0, Math.min(r.w, x - r.x)), py = Math.max(0, Math.min(r.h, y - r.y));
  // keep the lens above the finger so the finger never covers what is being looked at
  // always above the finger; near the top edge it simply rests against the edge (never flips below: no jumps)
  let lx = x - L / 2, ly = loupeOn.touch ? y - L - 28 : y - L / 2;
  lx = Math.max(8, Math.min(W - L - 8, lx)); ly = Math.max(8, Math.min(H - L - 8, ly));
  loupe.style.left = lx + 'px'; loupe.style.top = ly + 'px';
  loupeImg.style.transform = `translate(${(L / 2 - px * LOUPE_ZOOM).toFixed(1)}px, ${(L / 2 - py * LOUPE_ZOOM).toFixed(1)}px)`;
}
function closeLoupe() {
  clearTimeout(loupeTimer); loupeTimer = null;
  if (!loupeOn) return;
  loupeOn = false; loupe.classList.remove('on');
  setTimeout(() => { if (!loupeOn) loupe.hidden = true; }, 230);
}
player.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('img, video, .screen, .vw-stage')) e.preventDefault(); });
player.addEventListener('pointerdown', (e) => {
  showControls();
  if (isUi(e.target)) return;
  const r = player.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  down = { x, y, t: performance.now(), id: e.pointerId };
  clearTimeout(loupeTimer);
  // a living part of the painting → it answers the touch; anywhere else → hold to magnify
  if (S.interact.alive && alive.aliveAt(x, y) > 0.3) { down.alive = true; alive.press(e.pointerId, x, y, forceOf(e)); }
  else loupeTimer = setTimeout(() => { if (down && down.id === e.pointerId) openLoupe(down.lx ?? x, down.ly ?? y, e.pointerType !== 'mouse'); }, 450);
  sound.ensure();
  const hit = fx.pointerDown(x, y);
  if (hit.seed) sound.chime(x / r.width, y / r.height, true);
  else if (S.interact.ripple || S.interact.chime) sound.chime(x / r.width, y / r.height, false);
});
player.addEventListener('pointermove', (e) => {
  showControls();
  if (isUi(e.target)) return;
  const r = player.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  alive.look(x, y);
  if (loupeOn) { moveLoupe(x, y); return; }
  if (down && down.alive && down.id === e.pointerId) alive.move(e.pointerId, x, y, forceOf(e));
  if (e.pointerType === 'mouse' && !down) player.classList.toggle('alivehover', S.interact.alive && alive.setHover(x, y) > 0.3);
  if (down && down.id === e.pointerId) {
    down.lx = x; down.ly = y;
    if (Math.hypot(x - down.x, y - down.y) > 12) { clearTimeout(loupeTimer); loupeTimer = null; } // a swipe, not a long-press
  }
  if (e.pointerType === 'mouse' || down) fx.pointerMove(x, y);
});
const endPointer = (e) => {
  fx.pointerUp();
  alive.release(e.pointerId);
  if (loupeOn) { closeLoupe(); down = null; return; } // looking closely never turns the page
  clearTimeout(loupeTimer); loupeTimer = null;
  if (!down || down.id !== e.pointerId) { down = null; return; }
  const r = player.getBoundingClientRect();
  const dx = e.clientX - r.left - down.x, dy = e.clientY - r.top - down.y, dt = performance.now() - down.t;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 700) { go(dx < 0 ? 1 : -1); elapsed = 0; }
  down = null;
};
player.addEventListener('pointerup', endPointer);
player.addEventListener('pointercancel', endPointer);

document.addEventListener('keydown', (e) => {
  if (e.target.closest?.('dialog')) return;
  if (!viewer.hidden) {
    if (e.key === 'Escape') closeViewer();
    else if (e.key === 'ArrowRight') vwStep(1);
    else if (e.key === 'ArrowLeft') vwStep(-1);
    else if (e.key === '+' || e.key === '=') { const r = vwStage.getBoundingClientRect(); zoomAt(Z.s * 1.3, r.left + r.width / 2, r.top + r.height / 2); }
    else if (e.key === '-') { const r = vwStage.getBoundingClientRect(); zoomAt(Z.s / 1.3, r.left + r.width / 2, r.top + r.height / 2); }
    return;
  }
  if (player.hidden) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); return; }
  if (god.open && e.target.closest?.('#godPanel')) { if (e.key === 'Escape') closeGod(); return; }
  if (!sheet.hidden && e.target.closest?.('.lw-sheet')) { if (e.key === 'Escape') closeSheet(); return; }
  showControls();
  switch (e.key) {
    case 'ArrowRight': case 'PageDown': go(1); elapsed = 0; e.preventDefault(); break;
    case 'ArrowLeft': case 'PageUp': go(-1); elapsed = 0; e.preventDefault(); break;
    case ' ': case 'k': setPaused(playing); e.preventDefault(); break;
    case 'f': case 'F': $('#fsBtn').click(); break;
    case 'm': case 'M': $('#musicBtn').click(); break;
    case 't': case 'T': $('#stripBtn').click(); break;
    case 'r': case 'R': openRecord(); break;
    case 'i': case 'I': toggleInfo(); break;
    case 'Escape': if (god.open) closeGod(); else if (!sheet.hidden) closeSheet(); else if (!strip.hidden) $('#stripBtn').click(); else if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else closePlayer(); break;
  }
});

const canWake = () => 'wakeLock' in navigator && !(document.featurePolicy && !document.featurePolicy.allowsFeature('screen-wake-lock'));
async function requestWake() { try { if (canWake()) wakeLock = await navigator.wakeLock.request('screen'); } catch { wakeLock = null; } }
function releaseWake() { try { wakeLock?.release(); } catch { /* ignore */ } wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (player.hidden) return;
  if (document.hidden) sound.suspend(); else { sound.resume(); requestWake(); musicNudged = false; }
});
// the music must not quietly stop: phones interrupt web audio (calls, notifications, switching apps)
let musicWatch = 0, musicNudged = false;
function watchMusic(dt) {
  if ((musicWatch += dt) < 2) return;
  musicWatch = 0;
  if (player.hidden || !playing || document.hidden || S.music === 'none' || player.classList.contains('muted') || !sound.ctx) return;
  if (!sound.running) {
    sound.resume();
    setTimeout(() => { if (!sound.running && !player.hidden && !musicNudged) { musicNudged = true; toast(T('tapForMusic'), 4200); } }, 700);
  } else musicNudged = false;
}

// fine film grain for 絲緞光澤 (generated once, animated in CSS)
function makeGrain() {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const x = c.getContext('2d'); const img = x.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0);
    $('#grain').style.backgroundImage = `url(${c.toDataURL('image/png')})`;
  } catch { /* optional */ }
}

// ---------- licensed player (R11) ----------
const licGate = $('#licGate');
function deviceId() {
  let d = null; try { d = localStorage.getItem('ae-device'); } catch { /* private mode */ }
  if (!/^[a-f0-9]{32}$/.test(d || '')) { const b = new Uint8Array(16); crypto.getRandomValues(b); d = [...b].map(x => x.toString(16).padStart(2, '0')).join(''); try { localStorage.setItem('ae-device', d); } catch { /* ignore */ } }
  return d;
}
const licKey = () => 'ae-lic-' + LIC_ID;
// this launch's own id: if the computer is copied, the copies share the device id but never a running session
const LIC_SID = (() => { const b = new Uint8Array(12); crypto.getRandomValues(b); return [...b].map(x => x.toString(16).padStart(2, '0')).join(''); })();
// the last confirmed licence, kept on this machine so a restart without internet still plays (within the offline days AE allows)
const licCacheKey = () => 'ae-lic-cache-' + LIC_ID;
const licCached = () => { try { const c = JSON.parse(localStorage.getItem(licCacheKey()) || 'null'); return c && c.config && c.okAt ? c : null; } catch { return null; } };
const offlineLimit = (cfg) => Math.max(1, Math.min(30, Number(cfg && cfg.offlineDays) || 3)) * 86400e3;
const licToken = () => { try { return JSON.parse(localStorage.getItem(licKey()) || 'null'); } catch { return null; } };
function showLicGate(msg, { form = true, err = false, title, claim = false } = {}) {
  licGate.hidden = false; $('#startGate').hidden = true;
  $('#licTitle').textContent = title || T('licTitle');
  const m = $('#licMsg'); m.textContent = msg || ''; m.classList.toggle('err', err);
  $('#licClaim').hidden = !claim;
  $('#licForm').hidden = !form; $('.lw-lic-help').hidden = !form;
  if (form) setTimeout(() => $('#licCode').focus(), 50);
}
function showStartGate() {
  licGate.hidden = true;
  const gate = $('#startGate');
  $('#gateShow').textContent = currentShow() ? showTitle(currentShow()) : 'AE Universe Creation';
  const ge = $('#gateEdition'); ge.hidden = !LIC || !LIC.customer || !LIC.customer.name; if (LIC && LIC.customer) ge.textContent = [LIC.customer.name, LIC.customer.venue].filter(Boolean).join(' · ');
  gate.hidden = false;
  $('#gateBtn').onclick = () => { gate.hidden = true; openPlayer(null); };
}
let licOkAt = 0, licTimer = null, licBlocked = '', licOffline = false;
async function useLicence(cfg, { autoplay = false, okAt = 0 } = {}) {
  const changed = !LIC || LIC.version !== cfg.version;
  LIC = cfg; licOkAt = okAt || Date.now();
  if (!okAt) { try { localStorage.setItem(licCacheKey(), JSON.stringify({ config: cfg, okAt: licOkAt })); } catch { /* storage full: online checks still work */ } }
  precacheForOffline();
  if (changed) {
    if (!LIC.modes.includes(S.mode)) applyMode(modeOf(LIC.defaultMode), { quiet: true });
    await loadCatalog(); renderAll(); renderSettings();
  }
  if (licBlocked) { licBlocked = ''; if (autoplay && player.hidden) { licGate.hidden = true; openPlayer(null); return; } }
  if (player.hidden && licGate.hidden === false) showStartGate();
}
function licenceProblem(code) {
  const known = ['WRONG_CODE', 'DEVICE_TAKEN', 'DEVICE_CHANGED', 'PAUSED', 'REVOKED', 'EXPIRED', 'NOT_STARTED', 'NOT_FOUND', 'SUPERSEDED'];
  return known.includes(code) ? code : null;
}
async function checkLicence({ claim = false } = {}) {
  const t = licToken(); if (!t) return;
  if (licBlocked === 'SUPERSEDED' && !claim) return; // stays stopped until someone chooses to play here
  try {
    const { config } = await api('license-config', { method: 'POST', body: { token: t.token, device: deviceId(), sid: LIC_SID, claim } });
    licOffline = false;
    await useLicence(config, { autoplay: true });
  } catch (err) {
    const p = licenceProblem(err.code) || (err.code === 'BAD_TOKEN' ? 'DEVICE_CHANGED' : null);
    if (p) {
      licBlocked = p;
      if (!player.hidden) closePlayer();
      if (p === 'DEVICE_CHANGED' || p === 'NOT_FOUND') { try { localStorage.removeItem(licKey()); localStorage.removeItem(licCacheKey()); } catch { /* ignore */ } }
      if (p !== 'SUPERSEDED') { try { localStorage.removeItem(licCacheKey()); } catch { /* ignore */ } } // paused / revoked / expired: no offline play either
      showLicGate(T('lic_' + p), { form: p === 'DEVICE_CHANGED' || p === 'NOT_FOUND', err: true, claim: p === 'SUPERSEDED' });
    } else if (!LIC) { // no internet at start-up: play from the last confirmed licence if it is recent enough
      const c = licCached();
      if (c && Date.now() - c.okAt < offlineLimit(c.config)) { await useLicence(c.config, { okAt: c.okAt }); licOffline = true; }
      else showLicGate(T('lic_OFFLINE'), { form: false, err: true });
    } else if (Date.now() - licOkAt > offlineLimit(LIC)) { // offline longer than AE allows: stop politely; otherwise keep the show going
      if (!player.hidden) closePlayer();
      showLicGate(T('lic_OFFLINE'), { form: false, err: true });
    }
  }
}
// keep the program, the works and the music on this machine, so a restart without internet still plays
let swReady = null;
function precacheForOffline() {
  if (!('serviceWorker' in navigator) || !LIC) return;
  swReady = swReady || navigator.serviceWorker.register('/lumina-sw.js').then(() => navigator.serviceWorker.ready).catch(() => null);
  swReady.then((reg) => {
    if (!reg || !reg.active) return;
    const urls = new Set(performance.getEntriesByType('resource').map(e => e.name).filter(u => u.startsWith(location.origin) && !/\/api\/lumina\?a=(?!media)/.test(u)));
    urls.add(location.origin + '/gallery.html'); urls.add(location.href.split('#')[0]);
    for (const w of LIC.works || []) for (const u of [w.src, w.thumb, w.poster]) if (u) urls.add(new URL(u, location.href).href);
    for (const pk of LIC.packs || []) if (pk.src) urls.add(new URL(pk.src, location.href).href);
    reg.active.postMessage({ type: 'precache', urls: [...urls] });
  });
}
async function licenceBoot() {
  document.documentElement.classList.add('licensed');
  const q = new URLSearchParams(location.search);
  if (q.get('code')) $('#licCode').value = q.get('code');
  $('#licClaim').addEventListener('click', async () => { licBlocked = ''; await checkLicence({ claim: true }); if (LIC && !licBlocked && player.hidden) showStartGate(); });
  $('#licForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('#licCode').value.trim(); if (!code) return;
    $('#licGo').disabled = true; $('#licMsg').textContent = T('licChecking'); $('#licMsg').classList.remove('err');
    try {
      const r = await api('license-activate', { method: 'POST', body: { license: LIC_ID, code, device: deviceId(), sid: LIC_SID } });
      try { localStorage.setItem(licKey(), JSON.stringify({ token: r.token })); } catch { /* ignore */ }
      licBlocked = '';
      await useLicence(r.config); showStartGate();
    } catch (err) { showLicGate(T('lic_' + (licenceProblem(err.code) || 'WRONG_CODE')), { err: true }); }
    finally { $('#licGo').disabled = false; }
  });
  const every = Math.max(2, Math.min(600, Number(q.get('hb')) || 60)) * 1000; // the minute check (shorter only in tests)
  clearInterval(licTimer); licTimer = setInterval(checkLicence, every);
  if (licToken()) {
    showLicGate(T('licChecking'), { form: false });
    await checkLicence({ claim: true }); // starting up: this screen takes the licence
    if (LIC && !licBlocked) showStartGate();
  } else showLicGate(T('licWelcome', ''));
}

// ---------- client licences (AE Studio) ----------
const licDialog = $('#licDialog'), licForm = $('#licEdit');
let licences = [], licCur = null;
const licUrl = (l) => `${location.origin}/gallery?license=${l.id}`;
const addMonths = (d, m) => { const x = new Date(d + 'T00:00:00'); x.setMonth(x.getMonth() + m); return x.toISOString().slice(0, 10); };
const todayStr = () => new Date().toISOString().slice(0, 10);
async function refreshLicences() { const d = await api('license-list', { method: 'POST', body: {} }); licences = (d.licenses || []).sort((a, b) => b.created - a.created); renderLicList(); }
function renderLicList() {
  const ul = $('#licList'); ul.replaceChildren();
  for (const l of licences) {
    const li = document.createElement('li'), b = document.createElement('button'); b.type = 'button';
    b.className = 'st-' + l.status; b.setAttribute('aria-current', String(!!licCur && licCur.id === l.id)); b.dataset.lic = l.id;
    const sh = exhibitions.find(e => e.id === l.exhibitionId);
    b.innerHTML = '<b></b><small></small>'; b.querySelector('b').textContent = (l.customer && l.customer.name) || l.id;
    b.querySelector('small').textContent = `${sh ? showTitle(sh) : '—'} · ${T('lic_status_' + l.status)}${l.expires ? ' · ' + l.expires : ''}`;
    b.addEventListener('click', () => editLicence(l)); li.appendChild(b); ul.appendChild(li);
  }
}
function chipSet(box, items, selected, label) {
  box.replaceChildren();
  for (const id of items) {
    const b = chip(label(id), selected.includes(id), false, () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); if (box.id === 'licModes') syncDefaultMode(); });
    b.dataset.v = id; box.appendChild(b);
  }
}
const chosen = (box) => [...box.querySelectorAll('.lw-chip')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.v);
function syncDefaultMode() {
  const sel = licForm.elements.defaultMode, keep = sel.value, ms = chosen($('#licModes'));
  sel.replaceChildren(...ms.map(id => { const o = document.createElement('option'); o.value = id; o.textContent = L(modeOf(id)); return o; }));
  sel.value = ms.includes(keep) ? keep : ms[0] || '';
}
async function editLicence(l) {
  licCur = l; renderLicList();
  const f = licForm.elements;
  f.id.value = l ? l.id : ''; f.name.value = l ? (l.customer || {}).name || '' : ''; f.email.value = l ? (l.customer || {}).email || '' : ''; f.venue.value = l ? (l.customer || {}).venue || '' : '';
  f.exhibition.replaceChildren(...exhibitions.map(e => { const o = document.createElement('option'); o.value = e.id; o.textContent = showTitle(e); return o; }));
  f.exhibition.value = l ? l.exhibitionId || '' : (currentShow() ? currentShow().id : (exhibitions[0] || {}).id || '');
  const sh = exhibitions.find(e => e.id === f.exhibition.value);
  chipSet($('#licModes'), OPTIONS.modes.map(m => m.id), l ? l.modes : [sh ? sh.mode : 'online'], (id) => L(modeOf(id)));
  syncDefaultMode(); if (l) f.defaultMode.value = l.defaultMode;
  chipSet($('#licControls'), ['modes', 'intensity', 'volume', 'music', 'advance', 'listen', 'record'], l ? l.controls : ['modes', 'intensity', 'volume'], (id) => T('ctl_' + id));
  f.starts.value = l ? l.starts || '' : todayStr(); f.expires.value = l ? l.expires || '' : addMonths(todayStr(), 12); f.note.value = l ? l.note || '' : ''; f.offlineDays.value = String((l && l.offlineDays) || 3);
  const term = $('#licTerm'); term.replaceChildren(...[1, 3, 6, 12].map(m => chip(T('licTerm', m), false, false, () => { f.expires.value = addMonths(f.starts.value || todayStr(), m); })));
  $('#licSave').textContent = T(l ? 'licUpdate' : 'licSave');
  const out = $('#licOut'); out.hidden = !l;
  if (l) {
    $('#licOutCode').textContent = l.code; $('#licOutUrl').textContent = licUrl(l);
    const dev = l.device ? T('licDevOn', new Date(l.device.last || l.device.at).toLocaleString()) : T('licDevNone');
    $('#licOutState').textContent = T('licState', T('lic_status_' + l.status), dev);
    $('#licPause').textContent = T(l.status === 'paused' ? 'licResumeBtn' : 'licPauseBtn'); $('#licPause').hidden = l.status === 'revoked'; $('#licRevoke').hidden = l.status === 'revoked';
    try { const { qrSvg } = await import('./qr.js'); $('#licQr').innerHTML = qrSvg(`${licUrl(l)}&code=${encodeURIComponent(l.code)}`, 4); } catch { $('#licQr').textContent = ''; }
  }
}
async function saveLicence(patch) {
  try { const { license } = await api('license-save', { method: 'POST', body: { license: patch } }); await refreshLicences(); await editLicence(license); toast(T('licSaved')); return license; } catch (err) { studioError(err); return null; }
}
licForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!exhibitions.length) { toast(T('licNeedShow'), 5000); return; }
  const f = licForm.elements;
  await saveLicence({ id: f.id.value || undefined, customer: { name: f.name.value, email: f.email.value, venue: f.venue.value }, exhibitionId: f.exhibition.value, modes: chosen($('#licModes')), defaultMode: f.defaultMode.value, controls: chosen($('#licControls')), starts: f.starts.value, expires: f.expires.value, offlineDays: Number(f.offlineDays.value) || 3, note: f.note.value });
});
$('#openLicenses').addEventListener('click', async () => { if (!studio) return; licDialog.showModal(); try { await refreshLicences(); } catch (err) { studioError(err); } editLicence(licences[0] || null); });
$('#licNew').addEventListener('click', () => editLicence(null));
$('#licClose').addEventListener('click', () => licDialog.close());
$('#licPause').addEventListener('click', () => licCur && saveLicence({ id: licCur.id, status: licCur.status === 'paused' ? 'active' : 'paused' }));
$('#licRevoke').addEventListener('click', () => licCur && confirm(T('licRevoke') + '?') && saveLicence({ id: licCur.id, status: 'revoked' }));
$('#licReset').addEventListener('click', async () => { if (!licCur) return; try { await api('license-reset-device', { method: 'POST', body: { id: licCur.id } }); await refreshLicences(); editLicence(licences.find(x => x.id === licCur.id)); toast(T('licSaved')); } catch (err) { studioError(err); } });
const licText = (l) => {
  const sh = exhibitions.find(e => e.id === l.exhibitionId);
  return lang === 'zh'
    ? `${(l.customer || {}).name || ''} 您好：\n\n感謝您選擇 AE Universe Creation。您的展演「${sh ? showTitle(sh) : ''}」已準備好。\n\n1. 在要播放的螢幕（電視、電腦或平板）打開：\n${licUrl(l)}\n2. 輸入啟動碼：${l.code}\n3. 輕觸「開始展演」。\n\n一個授權綁定一台螢幕。授權期間：${l.starts || ''} 至 ${l.expires || ''}。\n如需更換螢幕，請回覆這封信。\n\nAE Universe Creation\n外在沉靜，內在綻放`
    : `Dear ${(l.customer || {}).name || ''},\n\nThank you for choosing AE Universe Creation. Your exhibition “${sh ? showTitle(sh) : ''}” is ready.\n\n1. On the screen that will play it (TV, computer or tablet) open:\n${licUrl(l)}\n2. Enter the activation code: ${l.code}\n3. Tap “Begin”.\n\nOne licence plays on one screen. Licence period: ${l.starts || ''} to ${l.expires || ''}.\nTo move to another screen, just reply to this email.\n\nAE Universe Creation\nOuter Calm · Inner Bloom`;
};
$('#licCopy').addEventListener('click', async () => { if (!licCur) return; try { await navigator.clipboard.writeText(`${licUrl(licCur)}\n${T('licCodeLabel')}: ${licCur.code}`); toast(T('licCopied')); } catch { toast(licCur.code, 6000); } });
$('#licMail').addEventListener('click', () => { if (!licCur) return; const subj = lang === 'zh' ? 'AE Universe Creation｜您的展演啟用資訊' : 'AE Universe Creation — your exhibition'; location.href = `mailto:${encodeURIComponent((licCur.customer || {}).email || '')}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(licText(licCur))}`; });
$('#licPrint').addEventListener('click', () => {
  if (!licCur) return;
  const w = window.open('', '_blank'); if (!w) return;
  const esc = (x) => String(x).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  w.document.write(`<!doctype html><meta charset="utf-8"><title>AE Universe Creation · ${esc(licCur.code)}</title><style>body{font-family:"Noto Serif TC",Georgia,serif;max-width:640px;margin:48px auto;color:#1b1f1c;line-height:1.8}h1{font-weight:500;letter-spacing:.06em}code{font-size:22px;letter-spacing:.16em}.qr svg{width:180px;height:180px}small{color:#666}</style><h1>AE Universe Creation</h1><p>外在沉靜，內在綻放 · Outer Calm · Inner Bloom</p><div class="qr">${$('#licQr').innerHTML}</div><p><b>${esc(T('licCodeLabel'))}</b><br><code>${esc(licCur.code)}</code></p><pre style="white-space:pre-wrap;font-family:inherit">${esc(licText(licCur))}</pre><small>${esc(licUrl(licCur))}</small><script>setTimeout(()=>print(),300)<\/script>`);
  w.document.close();
});

// ---------- boot (+ kiosk / shared links: ?show=&mode=&autoplay=1&lang=) ----------
(async function boot() {
  const q = new URLSearchParams(location.search);
  if (q.get('lang') === 'en' || q.get('lang') === 'zh') lang = q.get('lang');
  setStudio(studio && !LIC_ID);
  if (LIC_ID) { makeGrain(); applyLang(); await licenceBoot(); exposeHooks(); return; }
  await loadCatalog();
  if (q.get('show') && exhibitions.some(e => e.id === q.get('show'))) setView(q.get('show'), { applyShowMode: !q.get('mode') });
  if (q.get('mode') && OPTIONS.modes.some(m => m.id === q.get('mode'))) applyMode(modeOf(q.get('mode')), { quiet: true });
  applyLang();
  saveSettings(S, SKEY);
  makeGrain();
  if (ED) { document.documentElement.classList.add('edition'); document.title = `${(lang === 'zh' ? ED.title.zh || ED.title.en : ED.title.en || ED.title.zh) || 'AE Universe Creation'} · AE Universe Creation`; }
  if (q.get('autoplay') === '1' || ED) {
    const gate = $('#startGate');
    if (ED) { const ge = $('#gateEdition'); ge.hidden = false; ge.textContent = ED.kind === 'nft' && ED.edition && ED.edition.of > 1 ? `${T('kindName', ED.kind)} · ${ED.edition.no} / ${ED.edition.of}` : T('kindName', ED.kind); }
    $('#gateShow').textContent = currentShow() ? showTitle(currentShow()) : 'AE Universe Creation';
    gate.hidden = false;
    $('#gateBtn').addEventListener('click', () => { gate.hidden = true; openPlayer(null); }, { once: true });
  }
  exposeHooks();
})();
function exposeHooks() {
  window.__lumina = {
    get state() { return { lastFps, feat: listener.lastFeat, kind: listener.kind, lowPower, listen: listener.on, soundStats: { ...listener.stats, ...fx.soundStats }, info: !$('#plInfo').hidden, edition: !!ED, curId: list[idx] && list[idx].id, idx, playing, busy, shown, list: list.length, cur, works: works.length, view, exhibitions: exhibitions.length, curDur, selected: S.selected.length, settings: S, studio, cloud, blooms: fx.blooms.length, cuties: fx.cuties.length, audio: sound.ctx ? sound.ctx.state : 'none', laserMode: packs.laserMode || null, hits: { count: listener.hitCount || 0, times: listener.hitTimes ? listener.hitTimes.slice(-24) : [], flashes: packs.laserHits || 0, led: packs.ledHits || 0 }, lock: { locked: !!roomBeat.locked, bpm: +(roomBeat.bpm || 0).toFixed(1), beats: roomBeat.lockCount || 0, emitted: listener.lock ? listener.lock.emitted.slice(-24) : [], onsets: listener.lock ? listener.lock.onsets.slice(-16) : [] }, bursts: (packs.bursts || []).length, music: sound.preset, packs: packs.current(), cam: packs.cam ? packs.cam.pk.id : null, camPose: packs.camPose, god: god.open, alive: { ok: alive.ok, on: alive.on, amb: +(alive.amb || 0).toFixed(2), counts: alive.counts(), share: alive.map ? +alive.map.share.toFixed(2) : 0, strength: +alive.strength().toFixed(2), pressing: alive.pressing, stats: { ...alive.stats } }, loupe: !!loupeOn }; },
    beat: () => sound.beat(), beatClock: () => sound.lastBeatClock, setLatency: (v) => { if (sound.ctx) Object.defineProperty(sound.ctx, 'outputLatency', { configurable: true, get: () => v }); }, trackTime: () => (sound.customEl ? sound.customEl.currentTime : 0),
    registerOld: () => { try { registerPack({ ...PACKS.get('firefly'), version: 1 }); } catch { /* ignore */ } return PACKS.get('firefly') ? PACKS.get('firefly').version : 0; },
    rec, enterLowPower, packsList: () => [...PACKS.values()].map(p => ({ id: p.id, type: p.type })), aliveAt: (x, y) => alive.aliveAt(x, y), aliveRect: () => alive.rect, simulateFps: (f, secs) => { for (let k = 0; k < f * secs; k++) trackFps(1 / f); }, go, jump, openPlayer, closePlayer, reload: async () => { await loadCatalog(); renderAll(); }, checkLicence, licence: () => LIC, licState: () => ({ offline: licOffline, blocked: licBlocked, okAt: licOkAt }),
  };
}
