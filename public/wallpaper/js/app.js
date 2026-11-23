// AE動態桌布 — 主程式（四個步驟：底圖 → 裝飾 → 風格 → 完成）
import {
  W, H, FILTERS, THEMES, COMPONENTS, burst, applyFilterPixels, drawComponentIcon, defaultBackground,
} from './effects.js';
import { SOUNDS, playSound, audio, music, setSfxVolume, recordingDestination } from './sound.js';
import {
  createScene, setBase, setFilter, coverCanvas, hitTest, renderScene, images, serializeScene,
  deserializeScene, serializeObjects, loadImage, canvasToBlob,
} from './scene.js';
import { kvGet, kvSet, galleryAll, galleryPut, galleryDel, loadSettings, saveSettings } from './store.js';
import { t, nm, getLang, setLang, SYMBOLS, symLabel } from './i18n.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const EN = () => getLang() === 'en';

// 在原生 iPhone App（WKWebView）中執行時，可呼叫原生功能
const NATIVE = !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.ae);
function native(action, data = {}) { return window.webkit.messageHandlers.ae.postMessage({ action, ...data }); }
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

const S = loadSettings();
S.compSounds = { ...Object.fromEntries(COMPONENTS.map((c) => [c.id, c.sound])), ...(S.compSounds || {}) };
setSfxVolume(S.sfxVolume);

const DEFAULT_BG = defaultBackground();
let scene = createScene();
setBase(scene, DEFAULT_BG, false);

const STEPS = ['photo', 'decorate', 'style', 'finish'];
const STEP_LABEL = { photo: 's1', decorate: 's2', style: 's3', finish: 's4' };
const ui = {
  step: 'photo', sub: { decorate: 'comp', style: 'theme' }, tool: 'select', drawMode: 'glow',
  color: '#FF7EB6', size: 16, textColor: '#FF7EB6', selected: null, draft: null,
  recording: false, gallery: [], recDur: 10, visited: new Set(['photo']),
};
const undoStack = [];
const redoStack = [];

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const pCanvas = $('#playerCanvas');
const pctx = pCanvas.getContext('2d');
const panel = $('#panel');

const COLORS = ['#FF7EB6', '#FF4D6D', '#FFB347', '#FFD93D', '#7ED957', '#4DD4C6', '#5AA9FF', '#9B7BFF', '#FFFFFF', '#4A3550'];
const THEME_SWATCH = {
  none: 'linear-gradient(135deg,var(--paper),var(--line))',
  laser: 'conic-gradient(from 200deg at 50% 100%,#1a0033,#ff2fd0,#1a0033,#2fd5ff,#1a0033,#b6ff2f,#1a0033)',
  breeze: 'linear-gradient(160deg,#fff6d8,#ffd6e7 45%,#c9f0d8)',
  sparkle: 'radial-gradient(circle at 30% 30%,#fff 0 3%,transparent 4%),radial-gradient(circle at 70% 60%,#fff 0 2%,transparent 3%),linear-gradient(160deg,#ffe7a8,#ffc2e2 50%,#c8b6ff)',
  snow: 'linear-gradient(160deg,#ffffff,#dcebff 55%,#b9d4f5)',
  bubbles: 'radial-gradient(circle at 35% 35%,#fff 0 6%,transparent 7%),radial-gradient(circle at 65% 62%,rgba(255,255,255,.8) 0 4%,transparent 5%),linear-gradient(140deg,#ffd6f0,#d6f0ff 50%,#e9d6ff)',
  aurora: 'linear-gradient(180deg,#071433,#0b3a4a 45%,#36d39a 72%,#7b5cff)',
};
const ICON_X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

// ======================================================================
// 小工具
// ======================================================================
let toastTimer;
function toast(msg, el = $('#toast')) {
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function openModal(html, bind) {
  closeMenu();
  $('#modalBody').innerHTML = html;
  $('#modal').hidden = false;
  if (bind) bind($('#modalBody'));
}
function closeModal() { $('#modal').hidden = true; $('#modalBody').innerHTML = ''; }
$('#modalX').onclick = closeModal;
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

function persistSettings() { saveSettings(S); }

let saveTimer;
function autosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => { kvSet('current', await serializeScene(scene)); }, 700);
}

function now() { return performance.now() / 1000; }

// ---------------- 復原／重做 ----------------
function snapshot() { return JSON.parse(JSON.stringify(serializeObjects(scene.objects))); }
function pushHistory(snap = snapshot()) {
  undoStack.push(snap);
  if (undoStack.length > 50) undoStack.shift();
  redoStack.length = 0;
  updateHistoryButtons();
}
function undo() {
  if (!undoStack.length) return toast(t('noUndo'));
  redoStack.push(snapshot());
  scene.objects = undoStack.pop();
  afterHistory();
}
function redo() {
  if (!redoStack.length) return toast(t('noRedo'));
  undoStack.push(snapshot());
  scene.objects = redoStack.pop();
  afterHistory();
}
function afterHistory() {
  select(null);
  autosave();
  updateHistoryButtons();
  renderPanel();
}
function updateHistoryButtons() {
  $('#btnUndo').disabled = !undoStack.length;
  $('#btnRedo').disabled = !redoStack.length;
}
$('#btnUndo').onclick = undo;
$('#btnRedo').onclick = redo;

// ======================================================================
// 頁首：選單、語言、深色外觀（與官網共用設定）
// ======================================================================
function applyStaticText() {
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  $('#btnLang').textContent = t('langSwitch');
  $('#btnLang').setAttribute('aria-label', EN() ? '切換至中文' : 'Switch to English');
  document.documentElement.lang = EN() ? 'en' : 'zh-Hant';
  renderMenu();
}

$('#btnLang').onclick = () => {
  setLang(EN() ? 'zh' : 'en');
  applyStaticText();
  renderSteps();
  renderPanel();
};

function isDark() {
  const root = document.documentElement;
  return (root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
}
function toggleDark() {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('ae-theme', next); } catch (e) { /* ignore */ }
  renderMenu();
}
$('#btnDark').onclick = toggleDark;
$('#btnThemeTop').onclick = toggleDark;

function renderMenu() {
  const items = [
    ['settings', 'mSettings', 'mSettingsSub'], ['rotate', 'mRotate', 'mRotateSub'],
    ['lock', 'mLock', 'mLockSub'], ['shortcut', 'mShortcut', 'mShortcutSub'],
  ];
  if (!NATIVE) items.push(['install', 'mInstall', 'mInstallSub']);
  $('#menuList').innerHTML = items.map(([id, a, b]) => `<button data-menu="${id}" type="button">${t(a)}<small>${t(b)}</small></button>`).join('')
    + `<a href="/">${t('mSite')}<small>${t('mSiteSub')}</small></a>`;
  $('#btnDark').textContent = isDark() ? t('darkOff') : t('darkOn');
}
function closeMenu() { $('#menu').hidden = true; $('#btnMenu').setAttribute('aria-expanded', 'false'); }
$('#btnMenu').onclick = () => {
  const open = $('#menu').hidden;
  $('#menu').hidden = !open;
  $('#btnMenu').setAttribute('aria-expanded', String(open));
};
$('#menuList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-menu]'); if (!b) return;
  ({ settings: showSettings, rotate: showRotation, lock: showLockGuide, shortcut: showSetWallpaperGuide, install: showInstallGuide })[b.dataset.menu]();
});

// ======================================================================
// 點擊元件：動起來＋發聲
// ======================================================================
function triggerTap(o, withSound = true) {
  o.tapT = now();
  if (o.type === 'comp') {
    const def = COMPONENTS.find((c) => c.id === o.kind);
    burst(o.x, o.y - 40 * o.scale, def.burst, 12, o.scale);
    if (withSound) playSound(S.compSounds[o.kind]);
  } else {
    burst(o.x, o.y, 'spark', 7, 0.7);
  }
}

// ======================================================================
// 選取：依物件類型自動切到對應的面板
// ======================================================================
function select(o) {
  const changed = ui.selected !== o;
  ui.selected = o;
  $('#selBar').hidden = !o;
  if (!changed) return;
  if (o && ui.step === 'decorate') {
    if (o.type === 'comp') ui.sub.decorate = 'comp';
    else if (o.type === 'text') ui.sub.decorate = 'text';
  }
  if (ui.step === 'decorate') renderPanel();
}

$('#selBar').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || !ui.selected) return;
  const o = ui.selected;
  const act = b.dataset.sel;
  pushHistory();
  if (act === 'smaller') o.scale = Math.max(0.2, o.scale * 0.85);
  if (act === 'bigger') o.scale = Math.min(6, o.scale * 1.18);
  if (act === 'rotl') o.rot = (o.rot || 0) - Math.PI / 12;
  if (act === 'rotr') o.rot = (o.rot || 0) + Math.PI / 12;
  if (act === 'front') { scene.objects.splice(scene.objects.indexOf(o), 1); scene.objects.push(o); }
  if (act === 'delete') { scene.objects.splice(scene.objects.indexOf(o), 1); select(null); }
  autosave();
});

function addObject(o) {
  pushHistory();
  o.id = uid();
  o.rot = o.rot || 0;
  o.scale = o.scale || 1;
  o.x = o.x ?? W / 2 + (Math.random() - 0.5) * 240;
  o.y = o.y ?? H * 0.55 + (Math.random() - 0.5) * 420;
  scene.objects.push(o);
  select(o);
  autosave();
  return o;
}

// ======================================================================
// 畫布觸控：拖曳、雙指縮放旋轉、手寫、光紋
// ======================================================================
function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}
const pointers = new Map();
let gesture = null;

canvas.addEventListener('pointerdown', (e) => {
  audio();
  canvas.setPointerCapture(e.pointerId);
  const p = toCanvas(e);
  pointers.set(e.pointerId, p);
  if (pointers.size === 2 && ui.selected && ui.tool === 'select') {
    const [a, b] = [...pointers.values()];
    gesture = {
      type: 'pinch', d0: Math.hypot(b.x - a.x, b.y - a.y), a0: Math.atan2(b.y - a.y, b.x - a.x),
      s0: ui.selected.scale, r0: ui.selected.rot || 0, snap: snapshot(),
    };
    return;
  }
  if (pointers.size > 1) return;
  if (ui.tool === 'pen' || ui.tool === 'glow') {
    ui.draft = { type: 'stroke', id: uid(), mode: ui.tool, color: ui.color, size: ui.tool === 'glow' ? ui.size * 1.4 : ui.size, points: [[p.x, p.y]] };
    gesture = { type: 'draw' };
    return;
  }
  const hit = hitTest(scene.objects, p.x, p.y);
  if (hit !== ui.selected) select(hit);
  gesture = hit ? { type: 'drag', o: hit, ox: hit.x - p.x, oy: hit.y - p.y, sx: p.x, sy: p.y, moved: false, snap: snapshot() } : null;
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const p = toCanvas(e);
  pointers.set(e.pointerId, p);
  if (!gesture) return;
  if (gesture.type === 'pinch' && pointers.size >= 2 && ui.selected) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    ui.selected.scale = Math.min(6, Math.max(0.2, gesture.s0 * (d / gesture.d0)));
    ui.selected.rot = gesture.r0 + Math.atan2(b.y - a.y, b.x - a.x) - gesture.a0;
    gesture.changed = true;
  } else if (gesture.type === 'drag') {
    if (Math.hypot(p.x - gesture.sx, p.y - gesture.sy) > 14) gesture.moved = true;
    if (gesture.moved) { gesture.o.x = p.x + gesture.ox; gesture.o.y = p.y + gesture.oy; }
  } else if (gesture.type === 'draw' && ui.draft) {
    const pts = ui.draft.points; const l = pts[pts.length - 1];
    if (Math.hypot(p.x - l[0], p.y - l[1]) > 4) pts.push([p.x, p.y]);
  }
});

function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (!gesture) return;
  if (gesture.type === 'draw') {
    if (ui.draft) { pushHistory(); scene.objects.push(ui.draft); ui.draft = null; autosave(); }
    gesture = null;
  } else if (gesture.type === 'drag') {
    if (gesture.moved) { pushHistory(gesture.snap); autosave(); } else triggerTap(gesture.o);
    gesture = null;
  } else if (gesture.type === 'pinch' && pointers.size === 0) {
    if (gesture.changed) { pushHistory(gesture.snap); autosave(); }
    gesture = null;
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  if (!ui.selected) return;
  e.preventDefault();
  ui.selected.scale = Math.min(6, Math.max(0.2, ui.selected.scale * (e.deltaY < 0 ? 1.06 : 0.94)));
  autosave();
}, { passive: false });

// ======================================================================
// 檔案匯入
// ======================================================================
$('#fileBase').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  const url = URL.createObjectURL(f);
  try {
    const img = await loadImage(url);
    setBase(scene, coverCanvas(img), true);
    filterThumbs = null;
    autosave();
    toast(t('photoIn'));
    renderPanel();
  } catch (err) { toast(t('badImage')); } finally { URL.revokeObjectURL(url); }
});

$('#fileSticker').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  const url = URL.createObjectURL(f);
  try {
    const img = await loadImage(url);
    const s = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const small = await loadImage(cv.toDataURL('image/png'));
    const id = uid();
    images.set(id, small);
    addObject({ type: 'image', imgId: id, scale: 1.2 });
    toast(t('imageAdded'));
  } catch (err) { toast(t('badImage')); } finally { URL.revokeObjectURL(url); }
});

$('#fileMusic').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  await music.load(f);
  music.setVolume(S.musicVolume);
  toast(`♪ ${music.name}`);
  renderPanel();
});

// ======================================================================
// 步驟與面板
// ======================================================================
function renderSteps() {
  $('#steps').innerHTML = STEPS.map((s, i) => `
    <button type="button" data-step="${s}" class="${ui.step === s ? 'on' : ''}" aria-current="${ui.step === s ? 'step' : 'false'}">
      <b>0${i + 1}</b><span>${t(STEP_LABEL[s])}</span>${ui.step === s ? `<i class="chev" aria-hidden="true">${panel.classList.contains('collapsed') ? '▲' : '▼'}</i>` : ''}
    </button>`).join('');
}
$('#steps').addEventListener('click', (e) => {
  const b = e.target.closest('[data-step]'); if (b) goStep(b.dataset.step);
});

function goStep(step) {
  if (ui.recording) return;
  // 再點一次目前的步驟：收起／展開面板，讓畫布變大
  if (step === ui.step && panel.innerHTML) {
    panel.classList.toggle('collapsed');
    renderSteps();
    return;
  }
  panel.classList.remove('collapsed');
  ui.step = step;
  ui.visited.add(step);
  updateTool();
  if (step !== 'decorate') select(null);
  renderSteps();
  renderPanel();
  panel.scrollTop = 0;
}

// 畫筆只在「裝飾 → 畫筆」時啟用，其他時候都是選取模式
function updateTool() {
  const drawing = ui.step === 'decorate' && ui.sub.decorate === 'draw';
  ui.tool = drawing ? ui.drawMode : 'select';
  if (drawing) select(null);
}

let filterThumbs = null;
function makeFilterThumbs() {
  const src = document.createElement('canvas');
  src.width = 120; src.height = 200;
  const base = scene.baseRaw || DEFAULT_BG;
  src.getContext('2d').drawImage(base, 0, base.height * 0.2, base.width, base.width * (200 / 120), 0, 0, 120, 200);
  filterThumbs = {};
  FILTERS.forEach((f) => { filterThumbs[f.id] = applyFilterPixels(src, f.id).toDataURL('image/jpeg', 0.8); });
}

function rotationInfo() {
  const n = ui.gallery.length;
  if (!S.rotateOn || !n) return null;
  const period = S.rotateEvery * (S.rotateUnit === 'hour' ? 3600e3 : 86400e3);
  const k = Math.floor((Date.now() - S.rotateAnchor) / period);
  return { index: ((k % n) + n) % n, next: S.rotateAnchor + (k + 1) * period };
}

function colorRow(current, attr) {
  return `<div class="colors">${COLORS.map((c) => `<button type="button" data-${attr}="${c}" class="${c === current ? 'on' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>`;
}

function head(n, h, p) {
  return `<div class="step-head"><div class="eyebrow">${t('stepOf', n)}</div><h3>${t(h)}</h3>${p ? `<p>${t(p)}</p>` : ''}</div>`;
}
function subtabs(group, list) {
  return `<div class="subtabs" role="tablist">${list.map(([id, key]) => `<button type="button" role="tab" data-sub="${group}:${id}" class="${ui.sub[group] === id ? 'on' : ''}" aria-selected="${ui.sub[group] === id}">${t(key)}</button>`).join('')}</div>`;
}
function foot(i) {
  const prev = i > 0 ? `<button type="button" class="text-link muted" data-go="${STEPS[i - 1]}">${t('back')}</button>` : '<span></span>';
  const next = i < STEPS.length - 1
    ? `<button type="button" class="btn solid" data-go="${STEPS[i + 1]}">${t('next', t(STEP_LABEL[STEPS[i + 1]]))} →</button>`
    : `<button type="button" class="text-link muted" data-go="photo">${t('startOver')}</button>`;
  return `<div class="step-foot">${prev}${next}</div>`;
}

function renderPanel() {
  const fn = PANELS[ui.step];
  panel.innerHTML = fn.html();
  panel.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => goStep(b.dataset.go));
  panel.querySelectorAll('[data-sub]').forEach((b) => b.onclick = () => {
    const [group, id] = b.dataset.sub.split(':');
    ui.sub[group] = id;
    updateTool();
    renderPanel();
  });
  fn.bind && fn.bind(panel);
}

const PANELS = {
  // ---------------- 01 底圖 ----------------
  photo: {
    html() {
      const rot = rotationInfo();
      return `
      ${head(1, 'h1', 'p1')}
      <div class="row">
        <button type="button" class="btn solid" id="pickBase">${t('importPhoto')}</button>
        <button type="button" class="btn quiet" id="useDefault">${t('defaultBg')}</button>
      </div>
      <p class="hint">${scene.hasPhoto ? t('usingPhoto') : t('usingDefault')}</p>
      <div class="section-title"><h4>${t('myGallery')}</h4><small>${t('galleryCount', ui.gallery.length)}</small></div>
      ${ui.gallery.length ? `<div class="gallery">
        ${ui.gallery.map((g, i) => `<div class="g ${rot && rot.index === i ? 'current' : ''}" data-load="${g.id}" role="button" tabindex="0">
            <img src="${g.thumb}" alt="">
            <button type="button" class="del" data-del="${g.id}" aria-label="${t('delete')}">${ICON_X}</button>
            ${rot && rot.index === i ? `<span class="badge">${t('current')}</span>` : ''}
          </div>`).join('')}
      </div><p class="hint">${t('galleryHint')}</p>` : `<div class="empty">${t('galleryEmpty')}</div>`}
      ${foot(0)}`;
    },
    bind(p) {
      $('#pickBase', p).onclick = () => $('#fileBase').click();
      $('#useDefault', p).onclick = () => { setBase(scene, DEFAULT_BG, false); filterThumbs = null; autosave(); renderPanel(); };
      p.querySelectorAll('[data-del]').forEach((b) => b.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm(t('confirmDelete'))) return;
        await galleryDel(b.dataset.del);
        await refreshGallery();
      });
      p.querySelectorAll('[data-load]').forEach((b) => b.onclick = async () => {
        const item = ui.gallery.find((g) => g.id === b.dataset.load);
        if (!item) return;
        pushHistory();
        scene = await deserializeScene(item.data, DEFAULT_BG);
        filterThumbs = null; select(null); autosave();
        toast(t('loaded'));
        renderPanel();
      });
    },
  },

  // ---------------- 02 裝飾 ----------------
  decorate: {
    html() {
      const sub = ui.sub.decorate;
      let body = '';
      if (sub === 'comp') {
        const sel = ui.selected && ui.selected.type === 'comp' ? ui.selected : null;
        body = `
        <div class="grid">${COMPONENTS.map((c) => { const n = nm('comp', c); return `
          <button type="button" class="tile ${sel && sel.kind === c.id ? 'on' : ''}" data-comp="${c.id}">
            <canvas width="150" height="150" data-icon="${c.id}"></canvas>${esc(n.name)}<small>${esc(n.desc)}</small>
          </button>`; }).join('')}</div>
        ${sel ? `<div class="section-title"><h4>${t('compSound')}</h4><small>${esc(nm('comp', COMPONENTS.find((c) => c.id === sel.kind)).name)}</small></div>
          <div class="row">${SOUNDS.map((s) => `<button type="button" class="chip ${S.compSounds[sel.kind] === s.id ? 'on' : ''}" data-snd="${sel.kind}:${s.id}">${esc(nm('sound', s).name)}</button>`).join('')}
            <button type="button" class="chip ${S.compSounds[sel.kind] === 'none' ? 'on' : ''}" data-snd="${sel.kind}:none">${t('mute')}</button></div>`
          : `<p class="hint">${t('compSoundHint')}</p>`}`;
      } else if (sub === 'sym') {
        body = `<div class="sym-grid">${SYMBOLS.map((s) => `<button type="button" data-sym="${s[0]}" aria-label="${esc(symLabel(s))}"><div>${s[0]}<span>${esc(symLabel(s))}</span></div></button>`).join('')}</div>`;
      } else if (sub === 'text') {
        const sel = ui.selected && ui.selected.type === 'text' ? ui.selected : null;
        body = `
        <textarea id="txtInput" rows="2" placeholder="${esc(t('textPh'))}">${sel ? esc(sel.text) : ''}</textarea>
        <div class="row" style="margin-top:10px">${colorRow(sel ? sel.color : ui.textColor, 'tcolor')}</div>
        <div class="row"><button type="button" class="btn solid" id="addText">${sel ? t('updateText') : t('addText')}</button></div>`;
      } else if (sub === 'draw') {
        body = `
        <div class="row">
          <button type="button" class="chip ${ui.drawMode === 'glow' ? 'on' : ''}" data-mode="glow">${t('glow')}</button>
          <button type="button" class="chip ${ui.drawMode === 'pen' ? 'on' : ''}" data-mode="pen">${t('pen')}</button>
        </div>
        <div class="row">${colorRow(ui.color, 'color')}</div>
        <div class="row"><span class="label">${t('brush')}</span><input type="range" id="size" min="4" max="48" value="${ui.size}"></div>
        <p class="hint">${t('drawHint')}</p>`;
      } else if (sub === 'image') {
        body = `
        <div class="row"><button type="button" class="btn solid" id="pickSticker">${t('importImage')}</button></div>
        <p class="hint">${t('imageHint')}</p>`;
      }
      return `
      ${head(2, 'h2', 'p2')}
      ${subtabs('decorate', [['comp', 'subComp'], ['sym', 'subSym'], ['text', 'subText'], ['draw', 'subDraw'], ['image', 'subImage']])}
      ${body}
      ${scene.objects.length ? `<div class="row"><button type="button" class="text-link muted" id="clearAll">${t('clearAll')}</button></div>` : ''}
      ${foot(1)}`;
    },
    bind(p) {
      p.querySelectorAll('[data-comp]').forEach((b) => b.onclick = () => {
        const o = addObject({ type: 'comp', kind: b.dataset.comp, seed: Math.random() * 10, scale: 1.4 });
        triggerTap(o);
      });
      p.querySelectorAll('[data-snd]').forEach((b) => b.onclick = () => {
        const [kind, snd] = b.dataset.snd.split(':');
        S.compSounds[kind] = snd; persistSettings();
        playSound(snd);
        renderPanel();
      });
      p.querySelectorAll('[data-sym]').forEach((b) => b.onclick = () => addObject({ type: 'emoji', char: b.dataset.sym, scale: 1.6 }));
      p.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { ui.drawMode = b.dataset.mode; updateTool(); renderPanel(); });
      p.querySelectorAll('[data-color]').forEach((b) => b.onclick = () => { ui.color = b.dataset.color; renderPanel(); });
      $('#size', p)?.addEventListener('input', (e) => { ui.size = +e.target.value; });
      p.querySelectorAll('[data-tcolor]').forEach((b) => b.onclick = () => {
        ui.textColor = b.dataset.tcolor;
        if (ui.selected && ui.selected.type === 'text') { pushHistory(); ui.selected.color = ui.textColor; autosave(); }
        p.querySelectorAll('[data-tcolor]').forEach((x) => x.classList.toggle('on', x === b));
      });
      const addText = $('#addText', p);
      if (addText) addText.onclick = async () => {
        const text = $('#txtInput', p).value.trim();
        if (!text) return toast(t('needText'));
        try { await document.fonts.load('900 96px "Zen Maru Gothic"', text); } catch (e) { /* offline */ }
        if (ui.selected && ui.selected.type === 'text') {
          pushHistory(); ui.selected.text = text; autosave(); toast(t('textUpdated'));
        } else {
          addObject({ type: 'text', text, color: ui.textColor, size: 120, y: H * 0.55, x: W / 2 });
        }
        renderPanel();
      };
      $('#pickSticker', p)?.addEventListener('click', () => $('#fileSticker').click());
      $('#clearAll', p)?.addEventListener('click', () => {
        if (!confirm(t('confirmClear'))) return;
        pushHistory(); scene.objects = []; select(null); autosave(); renderPanel();
      });
    },
  },

  // ---------------- 03 風格 ----------------
  style: {
    html() {
      const sub = ui.sub.style;
      let body = '';
      if (sub === 'theme') {
        body = `
        <div class="grid four">${THEMES.map((th) => { const n = nm('theme', th); return `
          <button type="button" class="tile ${scene.theme === th.id ? 'on' : ''}" data-theme="${th.id}">
            <div class="swatch" style="background:${THEME_SWATCH[th.id]}"></div>${esc(n.name)}<small>${esc(n.desc)}</small>
          </button>`; }).join('')}</div>
        <div class="row"><span class="label">${t('intensity')}</span><input type="range" id="intensity" min="0.1" max="1" step="0.05" value="${scene.intensity}"></div>`;
      } else if (sub === 'filter') {
        if (!filterThumbs) makeFilterThumbs();
        body = `
        <div class="grid four">${FILTERS.map((f) => { const n = nm('filter', f); return `
          <button type="button" class="tile ${scene.filter === f.id ? 'on' : ''}" data-filter="${f.id}">
            <img class="swatch" src="${filterThumbs[f.id]}" alt="">${esc(n.name)}<small>${esc(n.desc)}</small>
          </button>`; }).join('')}</div>`;
      } else if (sub === 'music') {
        body = `
        ${music.el ? `<div class="music-card">
            <div class="eq ${music.playing ? 'on' : ''}"><i></i><i></i><i></i><i></i></div>
            <div class="name">${esc(music.name)}</div>
            <button type="button" class="btn solid" id="mToggle">${music.playing ? t('pause') : t('play')}</button>
          </div>` : `<p class="hint">${t('noMusic')}</p>`}
        <div class="row"><button type="button" class="btn ${music.el ? 'quiet' : 'solid'}" id="pickMusic">${music.el ? t('changeMusic') : t('importMusic')}</button></div>
        <div class="row"><span class="label">${t('musicVol')}</span><input type="range" id="mVol" min="0" max="1" step="0.05" value="${S.musicVolume}"></div>
        <div class="section-title"><h4>${t('sfx')}</h4></div>
        <div class="row">${SOUNDS.map((s) => `<button type="button" class="chip" data-try="${s.id}">${esc(nm('sound', s).name)}</button>`).join('')}</div>
        <div class="row"><span class="label">${t('sfxVol')}</span><input type="range" id="sVol" min="0" max="1" step="0.05" value="${S.sfxVolume}"></div>
        <p class="hint">${t('musicHint')}</p>`;
      }
      return `
      ${head(3, 'h3', 'p3')}
      ${subtabs('style', [['theme', 'subTheme'], ['filter', 'subFilter'], ['music', 'subMusic']])}
      ${body}
      ${foot(2)}`;
    },
    bind(p) {
      p.querySelectorAll('[data-theme]').forEach((b) => b.onclick = () => { scene.theme = b.dataset.theme; autosave(); renderPanel(); });
      $('#intensity', p)?.addEventListener('input', (e) => { scene.intensity = +e.target.value; autosave(); });
      p.querySelectorAll('[data-filter]').forEach((b) => b.onclick = () => { setFilter(scene, b.dataset.filter); autosave(); renderPanel(); });
      $('#pickMusic', p)?.addEventListener('click', () => $('#fileMusic').click());
      $('#mToggle', p)?.addEventListener('click', () => { music.toggle(); setTimeout(renderPanel, 80); });
      $('#mVol', p)?.addEventListener('input', (e) => { S.musicVolume = +e.target.value; music.setVolume(S.musicVolume); persistSettings(); });
      $('#sVol', p)?.addEventListener('input', (e) => { S.sfxVolume = +e.target.value; setSfxVolume(S.sfxVolume); persistSettings(); });
      p.querySelectorAll('[data-try]').forEach((b) => b.onclick = () => playSound(b.dataset.try));
    },
  },

  // ---------------- 04 完成 ----------------
  finish: {
    html() {
      const canRec = pickMime() !== null && !!canvas.captureStream;
      return `
      ${head(4, 'h4', 'p4')}
      <div class="row"><button type="button" class="btn block" id="fPlay">
        <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;stroke:none"><path d="M8 5v14l11-7z"/></svg>${t('fullPreview')}</button></div>

      <div class="card">
        <h4>${t('setTitle')}</h4>
        <p>${t('setText')}</p>
        <div class="row">
          <button type="button" class="btn solid" id="fSet">${t('setBtn')}</button>
          <button type="button" class="text-link" id="fSetGuide">${t('setGuide')}</button>
        </div>
      </div>

      ${NATIVE ? `<div class="card">
        <h4>${t('liveTitle')}</h4>
        <p>${t('liveText')}</p>
        <div class="row"><button type="button" class="btn solid" id="fLive">${t('liveBtn')}</button><span id="liveOut"></span></div>
      </div>` : ''}

      <div class="card">
        <h4>${t('saveTitle')}</h4>
        <p>${t('saveText')}</p>
        <div class="row"><button type="button" class="btn" id="fPng">${t('saveImage')}</button><span id="pngOut"></span></div>
        <div class="section-title" style="margin-top:6px"><h4>${t('recTitle')}</h4></div>
        ${canRec ? `
          <div class="row">${[5, 10, 15].map((s) => `<button type="button" class="chip ${ui.recDur === s ? 'on' : ''}" data-dur="${s}">${t('sec', s)}</button>`).join('')}</div>
          <div class="row"><button type="button" class="btn" id="fVid">● ${t('recStart')}</button><span id="vidOut"></span></div>`
        : `<p class="hint">${t('noRec')}</p>`}
        <div class="row"><button type="button" class="btn quiet" id="fGallery">${t('saveGallery')}</button></div>
      </div>
      <div class="note">${NATIVE ? t('finishNoteNative') : t('finishNote')}</div>
      ${foot(3)}`;
    },
    bind(p) {
      $('#fPlay', p).onclick = enterPlayer;
      $('#fSet', p).onclick = () => setAsWallpaper();
      $('#fSetGuide', p).onclick = showSetWallpaperGuide;
      $('#fPng', p).onclick = async () => {
        $('#pngOut', p).textContent = t('making');
        const blob = await renderStillBlob();
        $('#pngOut', p).innerHTML = `<button type="button" class="btn solid" id="savePng">${t('saveShare')}</button>`;
        $('#savePng', p).onclick = () => shareOrDownload(blob, `AE-Live-Wallpaper-${Date.now()}.png`);
      };
      p.querySelectorAll('[data-dur]').forEach((b) => b.onclick = () => {
        ui.recDur = +b.dataset.dur;
        p.querySelectorAll('[data-dur]').forEach((x) => x.classList.toggle('on', x === b));
      });
      $('#fVid', p)?.addEventListener('click', () => startRecording(p));
      $('#fLive', p)?.addEventListener('click', () => startRecording(p, {
        seconds: 3, out: '#liveOut', btn: '#fLive', withStill: true,
        onDone: async (video, still) => {
          await native('saveLivePhoto', { video: await blobToBase64(video), image: await blobToBase64(still) });
        },
      }));
      $('#fGallery', p).onclick = saveToGallery;
    },
  },
};

// ======================================================================
// 收藏
// ======================================================================
async function refreshGallery() {
  ui.gallery = await galleryAll();
  if (ui.step === 'photo') renderPanel();
}

async function makeThumb(sc) {
  const full = document.createElement('canvas'); full.width = W; full.height = H;
  renderScene(full.getContext('2d'), sc, now(), { dt: 0 });
  const th = document.createElement('canvas'); th.width = 180; th.height = 390;
  th.getContext('2d').drawImage(full, 0, 0, 180, 390);
  return th.toDataURL('image/jpeg', 0.8);
}

async function saveToGallery() {
  select(null);
  const item = { id: uid(), created: Date.now(), thumb: await makeThumb(scene), data: await serializeScene(scene) };
  try {
    await galleryPut(item);
    toast(t('savedGallery'));
  } catch (e) { toast(t('saveFail')); }
  await refreshGallery();
}

// ======================================================================
// 設定與說明
// ======================================================================
function playUrl() { return NATIVE ? 'aewallpaper://play' : `${location.origin}/wallpaper/?mode=play`; }
function copyBtn(text) {
  return `<div class="code"><span>${esc(text)}</span><button type="button" class="btn" data-copy="${esc(text)}">${t('copy')}</button></div>`;
}
function bindCopy(root) {
  root.querySelectorAll('[data-copy]').forEach((b) => b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast(t('copied')); } catch (e) { toast(t('copyFail')); }
  });
}
function switchItem(key, title, sub) {
  return `<label class="set-item"><div><b>${t(title)}</b><small>${t(sub)}</small></div>
    <span class="switch"><input type="checkbox" data-set="${key}" ${S[key] ? 'checked' : ''}><span></span></span></label>`;
}

function showSettings() {
  openModal(`
    <h2>${t('setHead')}</h2>
    ${switchItem('componentTap', 'tapComp', 'tapCompSub')}
    ${switchItem('touchFx', 'touchFx', 'touchFxSub')}
    ${switchItem('showFab', 'showFab', 'showFabSub')}
    ${switchItem('showClock', 'showClock', 'showClockSub')}`, (root) => {
    root.querySelectorAll('[data-set]').forEach((inp) => inp.onchange = () => { S[inp.dataset.set] = inp.checked; persistSettings(); });
  });
}

function showRotation() {
  const fmt = (d) => new Date(d).toLocaleString(EN() ? 'en-GB' : 'zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const info = () => {
    const rot = rotationInfo();
    if (!S.rotateOn) return t('rotOff');
    if (!ui.gallery.length) return t('rotEmpty');
    return t('rotNow', rot.index + 1, ui.gallery.length, fmt(rot.next));
  };
  openModal(`
    <h2>${t('rotHead')}</h2>
    ${switchItem('rotateOn', 'rotOn', 'rotOnSub')}
    <div class="row" style="margin-top:14px">
      <span>${t('every')}</span>
      <input type="number" id="rotEvery" min="1" max="99" value="${S.rotateEvery}" style="width:72px">
      <select id="rotUnit">
        <option value="hour" ${S.rotateUnit === 'hour' ? 'selected' : ''}>${t('hour')}</option>
        <option value="day" ${S.rotateUnit === 'day' ? 'selected' : ''}>${t('day')}</option>
      </select>
      <span>${t('once')}</span>
    </div>
    <p class="hint" id="rotInfo">${info()}</p>
    <button type="button" class="btn quiet block" id="rotGuide">${t('rotGuideBtn')}</button>`, (root) => {
    const refresh = () => { $('#rotInfo', root).textContent = info(); };
    root.querySelector('[data-set]').onchange = (e) => { S.rotateOn = e.target.checked; if (S.rotateOn) S.rotateAnchor = Date.now(); persistSettings(); refresh(); };
    $('#rotEvery', root).onchange = (e) => { S.rotateEvery = Math.max(1, Math.min(99, Math.round(+e.target.value) || 1)); S.rotateAnchor = Date.now(); persistSettings(); refresh(); };
    $('#rotUnit', root).onchange = (e) => { S.rotateUnit = e.target.value; S.rotateAnchor = Date.now(); persistSettings(); refresh(); };
    $('#rotGuide', root).onclick = showRotateGuide;
  });
}

function showLockGuide() {
  if (NATIVE) {
    openModal(EN() ? `
    <h2>Lock Screen button</h2>
    <p class="hint">The app includes an “AE互動” control (iOS 18+). Press it and unlock to open interactive mode.</p>
    <h4>Add it</h4>
    <ol><li>Touch and hold the Lock Screen → Customise → Lock Screen</li><li>Tap “–” on the bottom-left or bottom-right control</li><li>Tap “+” → search “AE” → choose “AE互動”</li></ol>
    <h4>Hide it</h4>
    <ul><li>Remove it the same way from the Lock Screen.</li><li>In the app, turn off “Show the AE button” in Interaction.</li></ul>` : `
    <h2>鎖定畫面按鈕</h2>
    <p class="hint">App 內建「AE互動」按鈕（iOS 18 以上）。按下並解鎖後，會直接進入互動模式。</p>
    <h4>加入按鈕</h4>
    <ol><li>在鎖定畫面長按 →「自訂」→ 選「鎖定畫面」</li><li>點左下或右下按鈕上的「－」移除原本的</li><li>點「＋」→ 搜尋「AE」→ 選擇「AE互動」</li></ol>
    <h4>隱藏這個按鈕</h4>
    <ul><li>鎖定畫面：同樣進入「自訂」，按「－」移除。</li><li>App 內：在「互動設定」關閉「顯示互動按鈕」。</li></ul>`);
    return;
  }
  openModal(EN() ? `
    <h2>Lock Screen button</h2>
    <p class="hint">On iOS 18 you can put a shortcut in the Lock Screen controls. Press it and unlock to open AE Live Wallpaper in interactive mode.</p>
    <h4>1 · Create the shortcut</h4>
    <ol><li>Open Shortcuts → tap “+”</li><li>Add the “Open URLs” action and paste the link below</li><li>Name it “AE互動”</li></ol>
    ${copyBtn(playUrl())}
    <h4>2 · Put it on the Lock Screen</h4>
    <ol><li>Touch and hold the Lock Screen → Customise → Lock Screen</li><li>Tap “–” on the bottom-left or bottom-right control</li><li>Tap “+” → Shortcut → choose “AE互動”</li></ol>
    <h4>Hide it</h4>
    <ul><li>Remove it the same way from the Lock Screen.</li><li>In interactive mode, turn off “Show the AE button” in Interaction (long-press the screen to bring it back).</li></ul>` : `
    <h2>鎖定畫面按鈕</h2>
    <p class="hint">iPhone（iOS 18 以上）可以把「捷徑」放到鎖定畫面下方的控制項。按下後解鎖，就會直接打開動態桌布的互動模式。</p>
    <h4>步驟 1 · 建立捷徑</h4>
    <ol><li>打開「捷徑」App → 右上角「＋」</li><li>加入動作「打開 URL」，貼上下面的網址</li><li>把捷徑命名為「AE互動」</li></ol>
    ${copyBtn(playUrl())}
    <h4>步驟 2 · 放到鎖定畫面</h4>
    <ol><li>在鎖定畫面長按 →「自訂」→ 選「鎖定畫面」</li><li>點左下或右下按鈕上的「－」移除原本的</li><li>點「＋」→ 搜尋「捷徑」→ 選擇「AE互動」</li></ol>
    <h4>隱藏這個按鈕</h4>
    <ul><li>鎖定畫面：同樣進入「自訂」，按「－」移除。</li><li>互動模式：在「互動設定」關閉「顯示互動按鈕」（長按畫面 1 秒可暫時叫回）。</li></ul>`, bindCopy);
}

function showRotateGuide() {
  openModal(EN() ? `
    <h2>Rotate the iPhone wallpaper</h2>
    <p class="hint">iOS does not let apps change the wallpaper in the background. These two ways keep it changing on a schedule:</p>
    <h4>A · Photo Shuffle (recommended)</h4>
    <ol><li>Save the wallpapers you like as images and put them in one album</li><li>Settings → Wallpaper → Add New Wallpaper → Photo Shuffle</li><li>Choose the album and set the frequency to Hourly or Daily</li></ol>
    <h4>B · Shortcuts automation + rotation here</h4>
    <ol><li>Turn on “Rotate wallpapers” in Wallpaper rotation</li><li>Shortcuts → Automation → Time of Day → action “Open URLs” with the link below</li><li>At that time, interactive mode opens with the wallpaper that is due</li></ol>
    ${copyBtn(playUrl())}` : `
    <h2>系統桌布自動更換</h2>
    <p class="hint">iOS 不允許任何 App 在背景替你換系統桌布。下面兩種做法可以讓 iPhone 依頻率自動更新：</p>
    <h4>方法 A · 相片隨機顯示（推薦）</h4>
    <ol><li>把喜歡的桌布存成圖片，放進同一本相簿</li><li>設定 → 背景圖片 →「＋ 新增背景圖片」→「相片隨機顯示」</li><li>選擇那本相簿，頻率選「每小時」或「每天」</li></ol>
    <h4>方法 B · 捷徑自動化＋這裡的輪播</h4>
    <ol><li>在「桌布更新頻率」開啟「自動更換桌布」</li><li>捷徑 App → 自動化 →「特定時間」→ 動作「打開 URL」，貼上下面網址</li><li>到點會打開互動模式，顯示該輪到的那張桌布</li></ol>
    ${copyBtn(playUrl())}`, bindCopy);
}

// ---------------- 一鍵設為桌布（剪貼簿＋捷徑） ----------------
const SHORTCUT_NAME = 'AE設桌布';

function renderStillBlob() {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  renderScene(cv.getContext('2d'), scene, now(), { dt: 0 });
  return canvasToBlob(cv, 'image/png');
}

async function setAsWallpaper() {
  select(null);
  if (NATIVE) {
    try {
      const data = await blobToBase64(await renderStillBlob());
      toast(t('openingNative'));
      await native('setWallpaper', { data, shortcut: SHORTCUT_NAME });
    } catch (e) { toast(`${e.message || e}`); }
    return;
  }
  // ClipboardItem 必須在點擊當下建立，圖片用 Promise 傳入（iOS Safari 的要求）
  const blobP = renderStillBlob();
  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error('no clipboard');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP })]);
  } catch (e) {
    toast(t('clipFail'));
    shareOrDownload(await blobP, `AE-Live-Wallpaper-${Date.now()}.png`);
    return;
  }
  toast(t('opening'));
  location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}`;
}

function showSetWallpaperGuide() {
  openModal(EN() ? `
    <h2>Create the “${SHORTCUT_NAME}” shortcut</h2>
    <p class="hint">Do this once. After that, “Set as wallpaper” sets the current design as your iPhone wallpaper.</p>
    <ol>
      <li>Open Shortcuts → tap “+”</li>
      <li>Add the action <b>Get Clipboard</b></li>
      <li>Add the action <b>Set Wallpaper</b> and choose which wallpaper to change</li>
      <li>Expand Set Wallpaper and turn off <b>Show Preview</b></li>
      <li>Name the shortcut exactly as below</li>
    </ol>
    ${copyBtn(SHORTCUT_NAME)}
    <div class="note">The first time it runs, iPhone asks for permission to read the clipboard and change the wallpaper — choose “Always Allow”.</div>` : `
    <h2>建立「${SHORTCUT_NAME}」捷徑</h2>
    <p class="hint">只需要做一次。之後在第四步按「設為桌布」，就會把目前畫面設成 iPhone 桌布。</p>
    <ol>
      <li>打開「捷徑」App → 右上角「＋」</li>
      <li>點「加入動作」，搜尋「<b>取得剪貼板</b>」並加入</li>
      <li>再搜尋「<b>設定背景圖片</b>」並加入，選擇要套用的背景圖片</li>
      <li>點「設定背景圖片」旁的箭頭，關閉「<b>顯示預覽</b>」</li>
      <li>把捷徑名稱改成下面這個名字（要一模一樣）</li>
    </ol>
    ${copyBtn(SHORTCUT_NAME)}
    <div class="note">第一次執行時，iPhone 會詢問是否允許讀取剪貼板、更改背景圖片，請選「一律允許」。</div>`, bindCopy);
}

function showInstallGuide() {
  openModal(EN() ? `
    <h2>Add to Home Screen</h2>
    <ol><li>Open this page in Safari on iPhone</li><li>Tap the Share button</li><li>Choose “Add to Home Screen” → Add</li></ol>
    <p class="hint">It opens full screen like an app. Your designs stay on your phone and are never uploaded.</p>
    ${copyBtn(`${location.origin}/wallpaper/`)}` : `
    <h2>加到主畫面</h2>
    <ol><li>用 iPhone 的 Safari 打開這個網頁</li><li>點下方的「分享」按鈕</li><li>選「加入主畫面」→「新增」</li></ol>
    <p class="hint">加入後會像 App 一樣全螢幕開啟，作品都存在你的手機裡，不會上傳。</p>
    ${copyBtn(`${location.origin}/wallpaper/`)}`, bindCopy);
}

// ======================================================================
// 匯出：圖片、影片
// ======================================================================
async function shareOrDownload(blob, name) {
  if (NATIVE) {
    try {
      await native(blob.type.startsWith('video') ? 'saveVideo' : 'saveImage', { data: await blobToBase64(blob), mime: blob.type });
      toast(t('savedPhotos'));
    } catch (e) { toast(t('saveErr', e.message || e)); }
    return;
  }
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'AE Live Wallpaper' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function pickMime() {
  if (!window.MediaRecorder) return null;
  const list = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  return list.find((m) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
}

function startRecording(root, opts = {}) {
  if (ui.recording) return;
  const seconds = opts.seconds || ui.recDur;
  const stillP = opts.withStill ? renderStillBlob() : null;
  const mime = pickMime();
  const stream = canvas.captureStream(30);
  try { recordingDestination().stream.getAudioTracks().forEach((tr) => stream.addTrack(tr)); } catch (e) { /* 無音訊 */ }
  let rec;
  try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined); } catch (e) { rec = new MediaRecorder(stream); }
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const out = $(opts.out || '#vidOut', root);
  const btn = $(opts.btn || '#fVid', root);
  btn.disabled = true;
  rec.onstop = () => {
    ui.recording = false;
    stream.getVideoTracks().forEach((tr) => tr.stop());
    const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
    const blob = new Blob(chunks, { type });
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    btn.disabled = false;
    if (opts.onDone) {
      out.textContent = t('processing');
      stillP.then((still) => opts.onDone(blob, still))
        .then(() => { out.textContent = t('savedPhotos'); toast(t('liveSaved')); })
        .catch((e) => { out.textContent = t('failed', e.message || e); });
      return;
    }
    btn.textContent = `● ${t('recAgain')}`;
    out.innerHTML = `<button type="button" class="btn solid" id="saveVid">${t('saveVideo')}</button>`;
    $('#saveVid', root).onclick = () => shareOrDownload(blob, `AE-Live-Wallpaper-${Date.now()}.${ext}`);
    toast(t('recDone'));
  };
  ui.recording = true;
  select(null);
  rec.start(250);
  let left = seconds;
  out.innerHTML = `<span class="rec">${t('recording', left)}</span>`;
  const iv = setInterval(() => {
    left -= 1;
    if (left <= 0 || rec.state !== 'recording') { clearInterval(iv); if (rec.state === 'recording') rec.stop(); return; }
    out.innerHTML = `<span class="rec">${t('recording', left)}</span>`;
  }, 1000);
}

// ======================================================================
// 互動模式（全螢幕）
// ======================================================================
const player = { open: false, scene: null, rotIndex: -1, pressTimer: null, fabMenu: false };

async function sceneForPlayer() {
  const rot = rotationInfo();
  if (rot) {
    const item = ui.gallery[rot.index];
    if (player.rotIndex === rot.index && player.scene) return player.scene;
    player.rotIndex = rot.index;
    try { return await deserializeScene(item.data, DEFAULT_BG); } catch (e) { /* fall through */ }
  }
  player.rotIndex = -1;
  return scene;
}

async function enterPlayer() {
  select(null);
  closeMenu();
  audio();
  player.scene = await sceneForPlayer();
  player.open = true;
  $('#player').hidden = false;
  applyPlayerUi();
  updateClock();
  if (S.componentTap || S.touchFx) toast(t('tapHint'), $('#playerToast'));
}
function exitPlayer() {
  player.open = false;
  player.fabMenu = false;
  $('#fabMenu').hidden = true;
  $('#player').hidden = true;
  if (location.search.includes('mode=play')) history.replaceState?.(null, '', location.pathname);
}
function applyPlayerUi() {
  $('#fab').hidden = !S.showFab;
  $('#lockClock').hidden = !S.showClock;
  if (!S.showFab) { $('#fabMenu').hidden = true; player.fabMenu = false; }
}
$('#btnPlay').onclick = enterPlayer;

function updateClock() {
  const d = new Date();
  const loc = EN() ? 'en-GB' : 'zh-TW';
  $('#lcTime').textContent = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', hour12: false });
  $('#lcDate').textContent = d.toLocaleDateString(loc, { month: 'long', day: 'numeric', weekday: 'long' });
}
setInterval(async () => {
  if (!player.open) return;
  updateClock();
  const rot = rotationInfo();
  if (rot && rot.index !== player.rotIndex) {
    player.scene = await sceneForPlayer();
    toast(t('rotated'), $('#playerToast'));
  }
}, 15000);

function toPlayer(e) {
  const r = pCanvas.getBoundingClientRect();
  const s = Math.max(r.width / W, r.height / H);
  return { x: (e.clientX - r.left - (r.width - W * s) / 2) / s, y: (e.clientY - r.top - (r.height - H * s) / 2) / s };
}

pCanvas.addEventListener('pointerdown', (e) => {
  audio();
  const p = toPlayer(e);
  if (player.fabMenu) { player.fabMenu = false; $('#fabMenu').hidden = true; }
  const hit = hitTest(player.scene.objects, p.x, p.y);
  if (hit && S.componentTap) triggerTap(hit);
  else if (S.touchFx) { burst(p.x, p.y, 'spark', 9, 0.8); }
  clearTimeout(player.pressTimer);
  player.pressTimer = setTimeout(() => {
    if (!S.showFab) { $('#fab').hidden = false; toast(t('fabPeek'), $('#playerToast')); }
  }, 900);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => pCanvas.addEventListener(ev, () => clearTimeout(player.pressTimer)));

$('#fab').onclick = () => { player.fabMenu = !player.fabMenu; $('#fabMenu').hidden = !player.fabMenu; };
$('#fabMenu').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const act = b.dataset.fab;
  if (act === 'theme') {
    const ids = THEMES.map((th) => th.id);
    const sc = player.scene;
    sc.theme = ids[(ids.indexOf(sc.theme) + 1) % ids.length];
    toast(t('themeIs', nm('theme', THEMES.find((th) => th.id === sc.theme)).name), $('#playerToast'));
    if (sc === scene) autosave();
  } else if (act === 'music') {
    if (!music.el) toast(t('needMusic'), $('#playerToast'));
    else toast(music.toggle() ? `♪ ${music.name}` : t('musicPaused'), $('#playerToast'));
  } else if (act === 'clock') {
    S.showClock = !S.showClock; persistSettings(); applyPlayerUi();
  } else if (act === 'hide') {
    S.showFab = false; persistSettings(); applyPlayerUi();
    toast(t('fabHidden'), $('#playerToast'));
  } else if (act === 'exit') {
    exitPlayer(); renderPanel();
  }
  if (act !== 'exit' && act !== 'hide') { player.fabMenu = false; $('#fabMenu').hidden = true; }
});

// ======================================================================
// 主迴圈
// ======================================================================
function loop(ms) {
  const time = ms / 1000;
  music.update();
  if (player.open && player.scene) {
    renderScene(pctx, player.scene, time);
  } else {
    renderScene(ctx, scene, time, { draft: ui.draft, selected: ui.recording ? null : ui.selected });
    if (ui.step === 'decorate' && ui.sub.decorate === 'comp') $$('canvas[data-icon]', panel).forEach((c) => drawComponentIcon(c, c.dataset.icon, time));
  }
  requestAnimationFrame(loop);
}

// ======================================================================
// 啟動
// ======================================================================
async function boot() {
  let saved = null;
  try {
    saved = await kvGet('current');
    if (saved) scene = await deserializeScene(saved, DEFAULT_BG);
  } catch (e) { saved = null; }
  if (!saved) {
    // 第一次打開：放上三個元件示範
    scene.theme = 'sparkle';
    scene.objects.push(
      { id: uid(), type: 'comp', kind: 'cloud', x: W * 0.3, y: H * 0.62, scale: 1.3, rot: 0, seed: 1 },
      { id: uid(), type: 'comp', kind: 'star', x: W * 0.72, y: H * 0.72, scale: 1.2, rot: 0, seed: 2 },
      { id: uid(), type: 'comp', kind: 'heart', x: W * 0.45, y: H * 0.84, scale: 1.1, rot: 0, seed: 3 },
    );
  }
  ui.gallery = await galleryAll();
  applyStaticText();
  renderSteps();
  renderPanel();
  updateHistoryButtons();
  requestAnimationFrame(loop);
  try { await document.fonts.load('900 96px "Zen Maru Gothic"', 'AE動態桌布'); } catch (e) { /* offline */ }
  if (new URLSearchParams(location.search).get('mode') === 'play') enterPlayer();
}

const booted = boot();
// 原生 App 的鎖定畫面按鈕會呼叫這個
window.AE = { enterPlayer: () => booted.then(() => { if (!player.open) enterPlayer(); }) };

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/wallpaper/sw.js', { scope: '/wallpaper/' }).catch(() => {});
}
