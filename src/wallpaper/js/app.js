// AE動態桌布 — 主程式（四個步驟：底圖 → 裝飾 → 風格 → 完成）
import {
  W, H, FILTERS, THEMES, COMPONENTS, burst, applyFilterPixels, drawComponentIcon, defaultBackground,
} from './effects.js';
import { SOUNDS, playSound, audio, ensureAudio, music, setSfxVolume, recordingDestination, setCustomSound, hasCustomSound, onAudioRebuild } from './sound.js';
import {
  createScene, setBase, setFilter, coverCanvas, hitTest, renderScene, images, serializeScene,
  deserializeScene, serializeObjects, loadImage, canvasToBlob, textFont, hasStrokes, objHalfSize,
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

const ui = {
  sheet: null, afterProps: null, tool: 'select', drawMode: 'glow',
  color: '#FF7EB6', size: 16, textColor: '#FF7EB6', textFont: 'round', textOutline: '#fff', removeBg: false,
  selected: null, draft: null,
  recording: false, gallery: [], recDur: 15, recMusic: true, recStop: null, recReveal: true, reveal: null, liveRec: null,
};
const undoStack = [];
const redoStack = [];

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const pCanvas = $('#playerCanvas');
const pctx = pCanvas.getContext('2d');
const panel = $('#sheet');

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
function toast(msg, el = $('#toast'), ms = 2200) {
  el.classList.remove('act');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
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
  $$('[data-tip-key]').forEach((el) => { el.dataset.tip = t(el.dataset.tipKey); el.setAttribute('aria-label', el.dataset.tip); el.title = el.dataset.tip; });
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

// 與官網相同：預設淺色，選了深色（ae-theme=dark）才切換
function isDark() { return document.documentElement.dataset.theme === 'dark'; }
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
  items.push(['clear', 'mClear', 'mClearSub']);
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
  const clearAll = () => {
    closeMenu();
    if (!scene.objects.length || !confirm(t('confirmClear'))) return;
    pushHistory(); scene.objects = []; select(null); autosave();
  };
  ({ settings: showSettings, rotate: showRotation, lock: showLockGuide, shortcut: showSetWallpaperGuide, install: showInstallGuide, clear: clearAll })[b.dataset.menu]();
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
// showProps：在畫面上點選時打開屬性小面板；從工具面板新增物件時不切換面板
function select(o, quiet = false, showProps = false) {
  const changed = ui.selected !== o;
  ui.selected = o;
  if (quiet) return;
  if (o && showProps) {
    if (ui.sheet === 'props' && !changed) return;
    if (ui.sheet !== 'props') ui.afterProps = ui.sheet === 'draw' ? null : ui.sheet;
    ui.sheet = 'props';
    updateTool();
    renderSteps(); renderPanel();
  } else if (!o && ui.sheet === 'props') {
    ui.sheet = ui.afterProps || (isDesktop() ? 'photo' : null);
    ui.afterProps = null;
    renderSteps(); renderPanel();
  } else if (changed && ui.sheet === 'props') {
    renderPanel();
  }
}

function addObject(o) {
  pushHistory();
  o.id = uid();
  o.rot = o.rot || 0;
  o.scale = o.scale || 1;
  o.x = o.x ?? W / 2 + (Math.random() - 0.5) * 240;
  o.y = o.y ?? H * 0.55 + (Math.random() - 0.5) * 420;
  scene.objects.push(o);
  select(o, true);
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
  ensureAudio().catch(() => {});
  $('#toast').classList.remove('show');
  canvas.setPointerCapture(e.pointerId);
  const p = toCanvas(e);
  pointers.set(e.pointerId, p);
  if (pointers.size === 2 && ui.selected && ui.selected.type !== 'stroke' && ui.tool === 'select') {
    const [a, b] = [...pointers.values()];
    gesture = {
      type: 'pinch', d0: Math.hypot(b.x - a.x, b.y - a.y), a0: Math.atan2(b.y - a.y, b.x - a.x),
      s0: ui.selected.scale, r0: ui.selected.rot || 0, snap: snapshot(),
    };
    return;
  }
  if (pointers.size > 1) return;
  if (ui.tool === 'eraser') {
    gesture = { type: 'erase', snap: snapshot(), changed: false };
    eraseAt(p);
    return;
  }
  if (ui.tool === 'pen' || ui.tool === 'glow' || ui.tool === 'rainbow') {
    ui.draft = { type: 'stroke', id: uid(), mode: ui.tool, color: ui.color, size: ui.tool === 'pen' ? ui.size : ui.size * 1.4, points: [[p.x, p.y]] };
    gesture = { type: 'draw' };
    return;
  }
  const hit = hitTest(scene.objects, p.x, p.y);
  if (hit) select(hit);
  else if (ui.selected) select(null);
  gesture = hit ? dragGesture(hit, p, snapshot()) : null;
});

// 拖曳：一般物件移動中心點，筆畫整條平移
function dragGesture(o, p, snap) {
  return { type: 'drag', o, ox: (o.x ?? 0) - p.x, oy: (o.y ?? 0) - p.y, sx: p.x, sy: p.y, lx: p.x, ly: p.y, moved: false, snap };
}
function moveObject(g, p) {
  if (g.o.type === 'stroke') {
    const dx = p.x - g.lx, dy = p.y - g.ly;
    g.o.points.forEach((pt) => { pt[0] += dx; pt[1] += dy; });
  } else { g.o.x = p.x + g.ox; g.o.y = p.y + g.oy; }
  g.lx = p.x; g.ly = p.y;
}
function deleteSelected() {
  const o = ui.selected; if (!o) return;
  const i = scene.objects.indexOf(o);
  if (i < 0) return;
  pushHistory();
  scene.objects.splice(i, 1);
  select(null);
  if (ui.sheet === 'text') renderPanel();
  autosave();
  toast(t('deleted'));
}
// 選取物件時浮在畫布下方的小工具列（不會改變畫布大小）
function propAction(act) {
  const o = ui.selected; if (!o) return;
  if (act === 'edit') { ui.sheet = 'text'; ui.afterProps = null; updateTool(); renderSteps(); renderPanel(); setTimeout(() => $('#txtInput')?.focus(), 50); return; }
  if (act === 'more') { select(o, false, true); return; }
  if (act === 'del') { deleteSelected(); return; }
  pushHistory();
  const i = scene.objects.indexOf(o);
  if (act === 'dup') {
    const copy = JSON.parse(JSON.stringify(serializeObjects([o])[0]));
    copy.id = uid();
    if (copy.type === 'stroke') copy.points.forEach((pt) => { pt[0] += 60; pt[1] += 60; });
    else { copy.x += 60; copy.y += 60; }
    scene.objects.splice(i + 1, 0, copy);
    select(copy);
  } else if (act === 'flip') {
    o.flip = !o.flip;
  } else if (act === 'up' && i < scene.objects.length - 1) {
    scene.objects.splice(i, 1); scene.objects.splice(i + 1, 0, o);
  } else if (act === 'down' && i > 0) {
    scene.objects.splice(i, 1); scene.objects.splice(i - 1, 0, o);
  }
  autosave();
}
const FLOAT_ICONS = {
  edit: '<path d="M5 7V4h14v3M12 4v16M9 20h6"/>',
  more: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  dup: '<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>',
  flip: '<path d="M12 3v18"/><path d="M8 7L3 12l5 5zM16 7l5 5-5 5z"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  del: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
};
const FLOAT_LABEL = { edit: 'fEdit', more: 'fMore', dup: 'duplicate', flip: 'fFlip', up: 'fUp', down: 'fDown', del: 'delete' };
const selFloat = $('#selFloat');
let floatFor = undefined;
function renderSelFloat() {
  const o = ui.recording || ui.sheet === 'props' ? null : ui.selected;
  if (o === floatFor) return;
  floatFor = o;
  selFloat.hidden = !o;
  if (!o) { selFloat.innerHTML = ''; return; }
  const acts = [o.type === 'text' ? 'edit' : null, 'more', 'dup', o.type === 'stroke' ? null : 'flip', 'up', 'down', 'del'].filter(Boolean);
  selFloat.innerHTML = acts.map((a) => `<button type="button" data-fact="${a}" class="${a === 'del' ? 'del' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true">${FLOAT_ICONS[a]}</svg><span>${t(FLOAT_LABEL[a])}</span></button>`).join('');
}
selFloat.addEventListener('click', (e) => {
  const b = e.target.closest('[data-fact]'); if (b) propAction(b.dataset.fact);
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selected && !player.open && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) {
    e.preventDefault(); deleteSelected();
  }
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
    if (gesture.moved) moveObject(gesture, p);
  } else if (gesture.type === 'draw' && ui.draft) {
    const pts = ui.draft.points; const l = pts[pts.length - 1];
    if (Math.hypot(p.x - l[0], p.y - l[1]) > 4) pts.push([p.x, p.y]);
  } else if (gesture.type === 'erase') {
    eraseAt(p);
  }
});

// 橡皮擦：抹過的筆畫整條移除
function eraseAt(p) {
  const r = 36;
  const before = scene.objects.length;
  scene.objects = scene.objects.filter((o) => {
    if (o.type !== 'stroke') return true;
    const reach = r + o.size;
    return !o.points.some(([x, y]) => Math.abs(x - p.x) < reach && Math.abs(y - p.y) < reach && Math.hypot(x - p.x, y - p.y) < reach);
  });
  if (scene.objects.length !== before && gesture) gesture.changed = true;
}

function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (!gesture) return;
  if (gesture.type === 'draw') {
    if (ui.draft) { pushHistory(); scene.objects.push(ui.draft); ui.draft = null; autosave(); }
    gesture = null;
  } else if (gesture.type === 'erase') {
    if (gesture.changed) { pushHistory(gesture.snap); autosave(); renderPanel(); }
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
    if (ui.removeBg) removeWhiteBackground(cv);
    const small = await loadImage(cv.toDataURL('image/png'));
    const id = uid();
    images.set(id, small);
    addObject({ type: 'image', imgId: id, scale: 1.2 });
    toast(t('imageAdded'));
  } catch (err) { toast(t('badImage')); } finally { URL.revokeObjectURL(url); }
});

// 從圖片邊緣開始，把相連的白色（接近白、低彩度）背景變透明，邊緣柔化
function removeWhiteBackground(cv) {
  const c = cv.getContext('2d');
  const { width: w, height: h } = cv;
  const img = c.getImageData(0, 0, w, h);
  const d = img.data;
  const whiteness = (i) => {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mn >= 205 && mx - mn <= 40 ? (mn - 205) / 40 : -1; // -1 = 不是背景
  };
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
  while (stack.length) {
    const k = stack.pop();
    if (seen[k]) continue;
    seen[k] = 1;
    const v = whiteness(k * 4);
    if (v < 0) continue;
    d[k * 4 + 3] = Math.round(d[k * 4 + 3] * Math.max(0, 1 - Math.min(1, v * 1.6)));
    const x = k % w, y = (k - x) / w;
    if (x > 0) stack.push(k - 1);
    if (x < w - 1) stack.push(k + 1);
    if (y > 0) stack.push(k - w);
    if (y < h - 1) stack.push(k + w);
  }
  c.putImageData(img, 0, 0);
}

$('#fileMusic').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  await music.load(f);
  music.setVolume(S.musicVolume);
  toast(`♪ ${music.name}`);
  renderPanel();
});

// ======================================================================
// 工具列與小面板：平常畫布全螢幕，點工具才從底部滑出精簡面板
// ======================================================================
const TOOLS = [
  ['photo', 'tPhoto', '<rect x="3" y="4" width="18" height="16"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'],
  ['comp', 'tComp', '<circle cx="12" cy="12" r="8"/><path d="M9.5 14.5c1.4 1.2 3.6 1.2 5 0"/><path d="M9 10h.01M15 10h.01"/>'],
  ['sym', 'tSym', '<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/>'],
  ['text', 'tText', '<path d="M5 7V4h14v3M12 4v16M9 20h6"/>'],
  ['draw', 'tDraw', '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>'],
  ['image', 'tImage', '<rect x="3" y="3" width="18" height="18"/><path d="M12 8v8M8 12h8"/>'],
  ['theme', 'tTheme', '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>'],
  ['filter', 'tFilter', '<circle cx="9" cy="10" r="5"/><circle cx="15" cy="10" r="5"/><circle cx="12" cy="15" r="5"/>'],
  ['music', 'tMusic', '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'],
  ['voice', 'tVoice', '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'],
];
const SHEET_TITLE = { photo: 'tPhoto', comp: 'tComp', sym: 'tSym', text: 'tText', draw: 'tDraw', image: 'tImage', theme: 'tTheme', filter: 'tFilter', music: 'tMusic', voice: 'tVoice', finish: 'h4' };
const isDesktop = () => matchMedia('(min-width: 900px)').matches;

function renderSteps() {
  $('#dock').innerHTML = `
    <div class="dock-scroll">${TOOLS.map(([id, key, icon]) => `
      <button type="button" data-tool="${id}" class="${ui.sheet === id ? 'on' : ''}" aria-pressed="${ui.sheet === id}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${t(key)}</span>
      </button>`).join('')}</div>
    <button type="button" class="dock-finish ${ui.sheet === 'finish' ? 'on' : ''}" data-tool="finish">${t('tFinish')}</button>`;
}
$('#dock').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tool]'); if (b) openSheet(b.dataset.tool);
});

function openSheet(id) {
  if (ui.recording) return;
  if (ui.liveRec && id !== 'draw') ui.liveRec.stop();
  if (voice.recording && id !== 'voice') toggleVoiceRec();
  if (ui.sheet === id && !isDesktop()) return closeSheet();
  ui.sheet = id;
  ui.afterProps = null;
  if (ui.selected && id !== 'text') select(null, true);
  updateTool();
  renderSteps();
  renderPanel();
  panel.scrollTop = 0;
}
function closeSheet() {
  if (ui.liveRec) ui.liveRec.stop();
  if (voice.recording) toggleVoiceRec();
  ui.sheet = isDesktop() ? 'photo' : null;
  updateTool();
  renderSteps();
  renderPanel();
}
// 相容舊的呼叫
const goStep = (id) => openSheet(id === 'decorate' ? 'comp' : id === 'style' ? 'theme' : id);

// 畫筆只在畫筆面板打開時啟用，其他時候都是選取模式
function updateTool() {
  const drawing = ui.sheet === 'draw';
  // ui.drawMode: glow | rainbow | pen | eraser
  ui.tool = drawing ? ui.drawMode : 'select';
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

function renderPanel() {
  const id = ui.sheet;
  panel.hidden = !id;
  if (!id) { panel.innerHTML = ''; return; }
  const fn = SHEETS[id];
  const title = id === 'props' ? esc(t('selected', objName(ui.selected))) : t(SHEET_TITLE[id]);
  const close = id === 'props' ? t('deselect') : '';
  panel.className = `sheet sheet-${id}${id === 'finish' ? ' tall' : ''}`;
  panel.innerHTML = `
    <div class="sheet-head"><h4>${title}</h4>
      <button type="button" class="${close ? 'text-link muted' : 'icon-btn sheet-x'}" data-close aria-label="${t('close')}">${close || ICON_X}</button></div>
    ${fn.html()}`;
  $('[data-close]', panel).onclick = () => {
    if (id === 'props') { select(null); return; }
    closeSheet();
  };
  fn.bind && fn.bind(panel);
}

async function loadTextFont(o) {
  try { await document.fonts.load(textFont({ ...o, size: 96 }), o.text || 'AE'); } catch (e) { /* offline */ }
}

const OBJ_LABEL = { comp: 'objComp', text: 'objText', emoji: 'objEmoji', image: 'objImage', stroke: 'objStroke' };
function objName(o) {
  if (!o) return '';
  if (o.type === 'comp') return nm('comp', COMPONENTS.find((c) => c.id === o.kind)).name;
  if (o.type === 'emoji') return o.char;
  if (o.type === 'text') return `「${o.text.slice(0, 8)}${o.text.length > 8 ? '…' : ''}」`;
  return t(OBJ_LABEL[o.type]);
}

function textOptions(sel) {
  const font = sel ? (sel.font || 'round') : ui.textFont;
  const outline = sel ? (sel.outline || '#fff') : ui.textOutline;
  return `
    <div class="row nowrap"><span class="label">${t('fontLabel')}</span>
      ${[['round', 'fontRound'], ['serif', 'fontSerif'], ['sans', 'fontSans']].map(([id, k]) => `<button type="button" class="chip font-${id} ${font === id ? 'on' : ''}" data-font="${id}">${t(k)}</button>`).join('')}</div>
    <div class="row nowrap"><span class="label">${t('outlineLabel')}</span>
      ${[['#fff', 'outlineWhite'], ['#202622', 'outlineDark'], ['none', 'outlineNone']].map(([id, k]) => `<button type="button" class="chip ${outline === id ? 'on' : ''}" data-outline="${id}">${t(k)}</button>`).join('')}</div>
    <div class="row">${colorRow(sel ? sel.color : ui.textColor, 'tcolor')}</div>`;
}

function bindTextOptions(p) {
  p.querySelectorAll('[data-font]').forEach((b) => b.onclick = async () => {
    ui.textFont = b.dataset.font;
    const sel = ui.selected && ui.selected.type === 'text' ? ui.selected : null;
    if (sel) { pushHistory(); sel.font = ui.textFont; await loadTextFont(sel); autosave(); }
    renderPanel();
  });
  p.querySelectorAll('[data-outline]').forEach((b) => b.onclick = () => {
    ui.textOutline = b.dataset.outline;
    const sel = ui.selected && ui.selected.type === 'text' ? ui.selected : null;
    if (sel) { pushHistory(); sel.outline = ui.textOutline; autosave(); }
    renderPanel();
  });
  p.querySelectorAll('[data-tcolor]').forEach((b) => b.onclick = () => {
    ui.textColor = b.dataset.tcolor;
    if (ui.selected && ui.selected.type === 'text') { pushHistory(); ui.selected.color = ui.textColor; autosave(); }
    p.querySelectorAll('[data-tcolor]').forEach((x) => x.classList.toggle('on', x === b));
  });
}

const SHEETS = {
  // ---------------- 底圖 ----------------
  photo: {
    html() {
      const rot = rotationInfo();
      return `
      <div class="row">
        <button type="button" class="btn solid" id="pickBase">${t('importPhoto')}</button>
        <button type="button" class="btn quiet" id="useDefault">${t('defaultBg')}</button>
      </div>
      <div class="section-title"><h4>${t('myGallery')}</h4><small>${t('galleryCount', ui.gallery.length)}</small></div>
      ${ui.gallery.length ? `<div class="hscroll gallery-row">
        ${ui.gallery.map((g, i) => `<div class="g ${rot && rot.index === i ? 'current' : ''}" data-load="${g.id}" role="button" tabindex="0">
            <img src="${g.thumb}" alt="">
            <button type="button" class="del" data-del="${g.id}" aria-label="${t('delete')}">${ICON_X}</button>
            ${rot && rot.index === i ? `<span class="badge">${t('current')}</span>` : ''}
          </div>`).join('')}
      </div>` : `<p class="hint">${t('galleryEmpty')}</p>`}`;
    },
    bind(p) {
      $('#pickBase', p).onclick = () => $('#fileBase').click();
      $('#useDefault', p).onclick = () => { setBase(scene, DEFAULT_BG, false); filterThumbs = null; autosave(); };
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
      });
    },
  },

  // ---------------- 動態元件 ----------------
  comp: {
    html() {
      return `<div class="hscroll">${COMPONENTS.map((c) => `
        <button type="button" class="tile" data-comp="${c.id}">
          <canvas width="150" height="150" data-icon="${c.id}"></canvas>${esc(nm('comp', c).name)}
        </button>`).join('')}</div>
        <p class="hint">${t('compSoundHint')}</p>`;
    },
    bind(p) {
      p.querySelectorAll('[data-comp]').forEach((b) => b.onclick = () => {
        const o = addObject({ type: 'comp', kind: b.dataset.comp, seed: Math.random() * 10, scale: 1.4 });
        triggerTap(o);
      });
    },
  },

  // ---------------- 符號 ----------------
  sym: {
    html() {
      return `<div class="sym-row">${SYMBOLS.map((s) => `<button type="button" data-sym="${s[0]}" aria-label="${esc(symLabel(s))}"><div>${s[0]}<span>${esc(symLabel(s))}</span></div></button>`).join('')}</div>`;
    },
    bind(p) {
      p.querySelectorAll('[data-sym]').forEach((b) => b.onclick = () => addObject({ type: 'emoji', char: b.dataset.sym, scale: 1.6 }));
    },
  },

  // ---------------- 文字 ----------------
  text: {
    html() {
      const sel = ui.selected && ui.selected.type === 'text' ? ui.selected : null;
      return `
      <div class="row nowrap text-row">
        <input type="text" id="txtInput" placeholder="${esc(t('textPh'))}" value="${sel ? esc(sel.text) : ''}">
        <button type="button" class="btn solid" id="addText">${sel ? t('updateText') : t('addText')}</button>
      </div>
      ${sel ? `<div class="row"><button type="button" class="chip" id="newText">＋ ${t('newText')}</button><button type="button" class="chip danger" id="delText">${t('delete')}</button></div>` : ''}
      ${textOptions(sel)}`;
    },
    bind(p) {
      bindTextOptions(p);
      const submit = async () => {
        const text = $('#txtInput', p).value.trim();
        if (!text) return toast(t('needText'));
        if (ui.selected && ui.selected.type === 'text') {
          pushHistory(); ui.selected.text = text; await loadTextFont(ui.selected); autosave(); toast(t('textUpdated'));
        } else {
          const o = { type: 'text', text, color: ui.textColor, size: 120, font: ui.textFont, outline: ui.textOutline };
          await loadTextFont(o);
          const n = scene.objects.filter((x) => x.type === 'text').length;
          addObject({ ...o, x: W / 2, y: H * (0.42 + (n % 4) * 0.08) });
          renderPanel();
          return;
        }
        $('#txtInput', p).blur();
      };
      $('#newText', p)?.addEventListener('click', () => { select(null, true); renderPanel(); setTimeout(() => $('#txtInput')?.focus(), 50); });
      $('#delText', p)?.addEventListener('click', deleteSelected);
      $('#addText', p).onclick = submit;
      $('#txtInput', p).addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    },
  },

  // ---------------- 畫筆 ----------------
  draw: {
    html() {
      return `
      <div class="row nowrap">
        ${[['glow', 'glow'], ['rainbow', 'rainbow'], ['pen', 'pen'], ['eraser', 'eraser']].map(([id, k]) => `<button type="button" class="chip ${ui.drawMode === id ? 'on' : ''}" data-mode="${id}">${t(k)}</button>`).join('')}
      </div>
      ${ui.drawMode === 'eraser' ? `<p class="hint">${t('eraserHint')}</p>` : `
      ${ui.drawMode !== 'rainbow' ? `<div class="row">${colorRow(ui.color, 'color')}</div>` : ''}
      <div class="row"><span class="label">${t('brush')}</span><input type="range" id="size" min="4" max="48" value="${ui.size}"></div>`}
      ${pickMime() !== null ? `<div class="row rec-draw">
        <button type="button" class="btn ${ui.liveRec ? 'solid' : ''}" id="liveRec">${ui.liveRec ? `■ ${t('liveRecStop')}` : `● ${t('liveRecStart')}`}</button>
        <span id="liveRecOut">${ui.liveRec ? `<span class="rec">${t('liveRecOn')}</span>` : `<small class="hint">${t('liveRecHint')}</small>`}</span></div>` : ''}`;
    },
    bind(p) {
      p.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => { ui.drawMode = b.dataset.mode; updateTool(); renderPanel(); });
      p.querySelectorAll('[data-color]').forEach((b) => b.onclick = () => { ui.color = b.dataset.color; renderPanel(); });
      $('#size', p)?.addEventListener('input', (e) => { ui.size = +e.target.value; });
      $('#liveRec', p)?.addEventListener('click', toggleLiveRec);
    },
  },

  // ---------------- 圖片 ----------------
  image: {
    html() {
      return `
      <label class="set-item" style="padding-top:0"><div><b>${t('removeBg')}</b><small>${t('imageHint')}</small></div>
        <span class="switch"><input type="checkbox" id="removeBg" ${ui.removeBg ? 'checked' : ''}><span></span></span></label>
      <div class="row" style="margin-top:12px"><button type="button" class="btn solid" id="pickSticker">${t('importImage')}</button></div>`;
    },
    bind(p) {
      $('#pickSticker', p).onclick = () => $('#fileSticker').click();
      $('#removeBg', p).onchange = (e) => { ui.removeBg = e.target.checked; };
    },
  },

  // ---------------- 動態主題 ----------------
  theme: {
    html() {
      return `
      <div class="hscroll">${THEMES.map((th) => `
        <button type="button" class="tile ${scene.theme === th.id ? 'on' : ''}" data-theme="${th.id}">
          <div class="swatch" style="background:${THEME_SWATCH[th.id]}"></div>${esc(nm('theme', th).name)}
        </button>`).join('')}</div>
      <div class="row"><span class="label">${t('intensity')}</span><input type="range" id="intensity" min="0.1" max="1" step="0.05" value="${scene.intensity}"></div>`;
    },
    bind(p) {
      p.querySelectorAll('[data-theme]').forEach((b) => b.onclick = () => {
        scene.theme = b.dataset.theme; autosave();
        p.querySelectorAll('[data-theme]').forEach((x) => x.classList.toggle('on', x === b));
      });
      $('#intensity', p).addEventListener('input', (e) => { scene.intensity = +e.target.value; autosave(); });
    },
  },

  // ---------------- 濾鏡 ----------------
  filter: {
    html() {
      if (!filterThumbs) makeFilterThumbs();
      return `<div class="hscroll">${FILTERS.map((f) => `
        <button type="button" class="tile ${scene.filter === f.id ? 'on' : ''}" data-filter="${f.id}">
          <img class="swatch" src="${filterThumbs[f.id]}" alt="">${esc(nm('filter', f).name)}
        </button>`).join('')}</div>`;
    },
    bind(p) {
      p.querySelectorAll('[data-filter]').forEach((b) => b.onclick = () => {
        setFilter(scene, b.dataset.filter); autosave();
        p.querySelectorAll('[data-filter]').forEach((x) => x.classList.toggle('on', x === b));
      });
    },
  },

  // ---------------- 錄音（共用模組 /modules/audio-record） ----------------
  voice: {
    html() {
      if (!voice.supported) return `<p class="hint">${t('voiceNoSupport')}</p>`;
      const v = voice;
      return `
      <div class="row voice-rec">
        <button type="button" class="btn ${v.recording ? 'solid rec-on' : 'solid'}" id="vRec">${v.recording ? `■ ${t('voiceStop')}` : `● ${t(v.raw ? 'voiceAgain' : 'voiceStart')}`}</button>
        <span id="vStatus">${v.recording ? `<span class="rec">${t('voiceRecording', Math.floor(v.secs))}</span>` : `<small class="hint">${t(v.raw ? 'voicePick' : 'voiceHint')}</small>`}</span>
      </div>
      ${v.raw && !v.recording ? `
      <div class="row nowrap">${(v.mod?.VOICE_EFFECTS || []).map((e) => `<button type="button" class="chip ${v.fx === e.id ? 'on' : ''}" data-vfx="${e.id}">${esc(EN() ? e.en : e.zh)}</button>`).join('')}</div>
      <div class="row">
        <button type="button" class="btn" id="vPlay">▶ ${t('voicePlay')}</button>
        <button type="button" class="btn" id="vSave">${t('voiceSave')}</button>
        <button type="button" class="btn solid" id="vUse">${t('voiceUse')}</button>
      </div>
      ${switchItem('voiceInVideo', 'voiceInVideo', 'voiceInVideoSub')}
      <div class="row"><button type="button" class="text-link muted" id="vDel">${t('voiceDelete')}</button></div>` : ''}`;
    },
    bind(p) {
      $('#vRec', p)?.addEventListener('click', toggleVoiceRec);
      p.querySelectorAll('[data-vfx]').forEach((b) => b.onclick = async () => {
        voice.fx = b.dataset.vfx;
        p.querySelectorAll('[data-vfx]').forEach((x) => x.classList.toggle('on', x === b));
        await processVoice();
        playSound('voice');
        saveVoice();
      });
      $('#vPlay', p)?.addEventListener('click', () => playSound('voice'));
      $('#vSave', p)?.addEventListener('click', () => {
        if (voice.processed) shareOrDownload(voice.mod.toWav(voice.processed), `AE-Voice-${voice.fx}-${Date.now()}.wav`);
      });
      $('#vUse', p)?.addEventListener('click', () => {
        COMPONENTS.forEach((c) => { S.compSounds[c.id] = 'voice'; });
        persistSettings();
        toast(t('voiceUsed'));
      });
      p.querySelectorAll('[data-set]').forEach((el) => el.onchange = () => { S[el.dataset.set] = el.checked; persistSettings(); });
      $('#vDel', p)?.addEventListener('click', () => {
        if (!confirm(t('voiceDeleteConfirm'))) return;
        voice.raw = null; voice.processed = null;
        setCustomSound('voice', null);
        COMPONENTS.forEach((c) => { if (S.compSounds[c.id] === 'voice') S.compSounds[c.id] = c.sound; });
        persistSettings();
        kvSet('voice', null);
        renderPanel();
      });
    },
  },

  // ---------------- 音樂 ----------------
  music: {
    html() {
      return `
      ${music.el ? `<div class="music-card">
          <div class="eq ${music.playing ? 'on' : ''}"><i></i><i></i><i></i><i></i></div>
          <div class="name">${esc(music.name)}</div>
          <button type="button" class="btn solid" id="mToggle">${music.playing ? t('pause') : t('play')}</button>
        </div>` : `<p class="hint">${t('noMusic')}</p>`}
      <div class="row"><button type="button" class="btn ${music.el ? 'quiet' : 'solid'}" id="pickMusic">${music.el ? t('changeMusic') : t('importMusic')}</button></div>
      <div class="row"><span class="label">${t('musicVol')}</span><input type="range" id="mVol" min="0" max="1" step="0.05" value="${S.musicVolume}"></div>
      <div class="section-title"><h4>${t('sfx')}</h4></div>
      <div class="row nowrap">${SOUNDS.map((s) => `<button type="button" class="chip" data-try="${s.id}">${esc(nm('sound', s).name)}</button>`).join('')}</div>
      <div class="row"><span class="label">${t('sfxVol')}</span><input type="range" id="sVol" min="0" max="1" step="0.05" value="${S.sfxVolume}"></div>`;
    },
    bind(p) {
      $('#pickMusic', p).onclick = () => $('#fileMusic').click();
      $('#mToggle', p)?.addEventListener('click', () => { music.toggle(); setTimeout(renderPanel, 80); });
      $('#mVol', p).addEventListener('input', (e) => { S.musicVolume = +e.target.value; music.setVolume(S.musicVolume); persistSettings(); });
      $('#sVol', p).addEventListener('input', (e) => { S.sfxVolume = +e.target.value; setSfxVolume(S.sfxVolume); persistSettings(); });
      p.querySelectorAll('[data-try]').forEach((b) => b.onclick = () => playSound(b.dataset.try));
    },
  },

  // ---------------- 選取物件的屬性 ----------------
  props: {
    html() {
      const o = ui.selected;
      if (!o) return '';
      const deg = Math.round((((o.rot || 0) * 180) / Math.PI + 540) % 360 - 180);
      const isStroke = o.type === 'stroke';
      return `
      ${isStroke ? `<div class="row">${o.mode === 'rainbow' ? '' : colorRow(o.color, 'scolor')}</div>` : `
      <div class="row"><span class="label">${t('propSize')}</span><input type="range" data-slider="scale" min="0.2" max="4" step="0.02" value="${o.scale}"></div>
      <div class="row"><span class="label">${t('propRotate')}</span><input type="range" data-slider="rot" min="-180" max="180" step="1" value="${deg}"></div>`}
      <div class="row"><span class="label">${t('propOpacity')}</span><input type="range" data-slider="alpha" min="0.15" max="1" step="0.01" value="${o.alpha ?? 1}"></div>
      <div class="row nowrap">
        ${o.type === 'text' ? `<button type="button" class="chip" data-prop="edit">${t('updateText')}</button>` : ''}
        <button type="button" class="chip" data-prop="dup">${t('duplicate')}</button>
        ${isStroke ? '' : `<button type="button" class="chip" data-prop="flip">${t('flip')}</button>`}
        <button type="button" class="chip" data-prop="up">${t('forward')}</button>
        <button type="button" class="chip" data-prop="down">${t('backward')}</button>
        <button type="button" class="chip danger" data-prop="del">${t('delete')}</button>
      </div>
      ${o.type === 'comp' ? `<div class="section-title"><h4>${t('compSound')}</h4></div>
        <div class="row nowrap">${SOUNDS.map((s) => `<button type="button" class="chip ${S.compSounds[o.kind] === s.id ? 'on' : ''}" data-snd="${o.kind}:${s.id}">${esc(nm('sound', s).name)}</button>`).join('')}
          ${hasCustomSound('voice') ? `<button type="button" class="chip ${S.compSounds[o.kind] === 'voice' ? 'on' : ''}" data-snd="${o.kind}:voice">${t('myVoice')}</button>` : ''}
          <button type="button" class="chip ${S.compSounds[o.kind] === 'none' ? 'on' : ''}" data-snd="${o.kind}:none">${t('mute')}</button></div>` : ''}
      ${o.type === 'text' ? textOptions(o) : ''}`;
    },
    bind(p) {
      let sliding = false;
      p.querySelectorAll('[data-slider]').forEach((r) => {
        r.addEventListener('input', () => {
          const o = ui.selected; if (!o) return;
          if (!sliding) { pushHistory(); sliding = true; }
          const v = +r.value;
          if (r.dataset.slider === 'scale') o.scale = v;
          if (r.dataset.slider === 'rot') o.rot = (v * Math.PI) / 180;
          if (r.dataset.slider === 'alpha') o.alpha = v;
        });
        r.addEventListener('change', () => { sliding = false; autosave(); });
      });
      p.querySelectorAll('[data-snd]').forEach((b) => b.onclick = () => {
        const [kind, snd] = b.dataset.snd.split(':');
        S.compSounds[kind] = snd; persistSettings();
        playSound(snd);
        p.querySelectorAll('[data-snd]').forEach((x) => x.classList.toggle('on', x === b));
      });
      if (ui.selected && ui.selected.type === 'text') bindTextOptions(p);
      p.querySelectorAll('[data-scolor]').forEach((b) => b.onclick = () => {
        const o = ui.selected; if (!o) return;
        pushHistory(); o.color = b.dataset.scolor; autosave();
        p.querySelectorAll('[data-scolor]').forEach((x) => x.classList.toggle('on', x === b));
      });
      p.querySelectorAll('[data-prop]').forEach((b) => b.onclick = () => propAction(b.dataset.prop));
    },
  },

  // ---------------- 完成 ----------------
  finish: {
    html() {
      const canRec = pickMime() !== null && !!canvas.captureStream;
      return `
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
          <div class="row">${[10, 15, 30, 60].map((s) => `<button type="button" class="chip ${ui.recDur === s ? 'on' : ''}" data-dur="${s}">${t('sec', s)}</button>`).join('')}</div>
          ${music.el ? `<label class="set-item"><div><b>${t('recMusic')}</b><small id="recMusicNote">${ui.recMusic ? t('recMusicOn', esc(music.name)) : t('recMusicOff')}</small></div>
            <span class="switch"><input type="checkbox" id="recMusic" ${ui.recMusic ? 'checked' : ''}><span></span></span></label>`
          : `<div class="row"><small class="hint" id="recMusicNote">${t('recMusicNone')}</small><button type="button" class="btn quiet" id="recGoMusic">${t('tMusic')}</button></div>`}
          ${hasStrokes(scene) ? `<label class="set-item"><div><b>${t('recReveal')}</b><small>${t('recRevealSub')}</small></div>
            <span class="switch"><input type="checkbox" id="recReveal" ${ui.recReveal ? 'checked' : ''}><span></span></span></label>` : ''}
          <div class="row"><button type="button" class="btn" id="fVid">● ${t('recStart')}</button><span id="vidOut"></span></div>`
        : `<p class="hint">${t('noRec')}</p>`}
        <div class="row"><button type="button" class="btn quiet" id="fGallery">${t('saveGallery')}</button></div>
      </div>
      <div class="note">${NATIVE ? t('finishNoteNative') : t('finishNote')}</div>`;
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
      $('#recReveal', p)?.addEventListener('change', (e) => { ui.recReveal = e.target.checked; });
      $('#recMusic', p)?.addEventListener('change', (e) => {
        ui.recMusic = e.target.checked;
        $('#recMusicNote', p).innerHTML = ui.recMusic ? t('recMusicOn', esc(music.name)) : t('recMusicOff');
      });
      $('#recGoMusic', p)?.addEventListener('click', () => openSheet('music'));
      $('#fVid', p)?.addEventListener('click', () => startRecording(p, { reveal: ui.recReveal && hasStrokes(scene) }));
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
  if (ui.sheet === 'photo') renderPanel();
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
    <p class="hint">只需要做一次。之後按「完成」→「設為桌布」，就會把目前畫面設成 iPhone 桌布。</p>
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

// 錄音：功能都在共用模組 /modules/audio-record，這裡只做畫面
const voice = {
  mod: null, supported: true, recorder: null, recording: false, secs: 0,
  raw: null, processed: null, fx: 'chipmunk',
};
async function voiceModule() {
  if (!voice.mod) voice.mod = await import('/modules/audio-record/index.js');
  return voice.mod;
}
voiceModule().then((m) => { voice.supported = m.isRecordingSupported(); }).catch(() => { voice.supported = false; });

async function processVoice() {
  if (!voice.raw) return;
  const m = await voiceModule();
  voice.processed = await m.applyVoiceEffect(voice.raw, voice.fx);
  setCustomSound('voice', voice.processed);
}
async function saveVoice() {
  if (!voice.raw) return;
  const m = await voiceModule();
  kvSet('voice', { wav: m.toWav(voice.raw), fx: voice.fx });
}
async function loadVoice() {
  const saved = await kvGet('voice');
  if (!saved || !saved.wav) return;
  try {
    const m = await voiceModule();
    voice.raw = await m.decodeAudio(saved.wav, audio());
    voice.fx = saved.fx || 'chipmunk';
    await processVoice();
  } catch (e) { /* 舊資料讀不到就略過 */ }
}
async function toggleVoiceRec() {
  const m = await voiceModule();
  if (voice.recording) {
    const blob = await voice.recorder.stop();
    voice.recording = false;
    try {
      voice.raw = m.trimSilence(await m.decodeAudio(blob, audio()));
      await processVoice();
      saveVoice();
      playSound('voice');
    } catch (e) { toast(t('voiceFail')); }
    renderPanel();
    return;
  }
  voice.secs = 0;
  voice.recorder = m.createRecorder({
    maxSeconds: 15,
    onTick: (sec) => {
      voice.secs = sec;
      const st = $('#vStatus');
      if (st) st.innerHTML = `<span class="rec">${t('voiceRecording', Math.floor(sec))}</span>`;
      if (sec >= 15 && voice.recording) toggleVoiceRec();
    },
  });
  try {
    await voice.recorder.start();
    voice.recording = true;
  } catch (e) {
    toast(t('voiceDenied'));
  }
  renderPanel();
}

// 畫筆面板：邊畫邊錄，把手繪光紋的過程錄成影片
function toggleLiveRec() {
  if (ui.liveRec) { ui.liveRec.stop(); return; }
  if (ui.recording) return;
  const mime = pickMime();
  const stream = canvas.captureStream(30);
  try { recordingDestination().stream.getAudioTracks().forEach((tr) => stream.addTrack(tr)); } catch (e) { /* 無音訊 */ }
  let rec;
  try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: recBitrate(120) } : undefined); } catch (e) { rec = new MediaRecorder(stream); }
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  select(null, true);
  const limit = setTimeout(() => rec.state === 'recording' && rec.stop(), 120000);
  rec.onstop = () => {
    clearTimeout(limit);
    ui.liveRec = null;
    stream.getVideoTracks().forEach((tr) => tr.stop());
    const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
    const blob = new Blob(chunks, { type });
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    if (ui.sheet === 'draw') renderPanel();
    const save = () => shareOrDownload(blob, `AE-Drawing-${Date.now()}.${ext}`);
    const out = $('#liveRecOut');
    if (out) {
      out.innerHTML = `<button type="button" class="btn solid" id="saveLiveRec">${t('saveVideo')}</button>`;
      $('#saveLiveRec').onclick = save;
    } else {
      openModal(`<h2>${t('liveRecDone')}</h2><div class="row"><button type="button" class="btn solid" id="saveLiveRec">${t('saveVideo')}</button></div>`,
        (m) => { $('#saveLiveRec', m).onclick = save; });
    }
    toast(t('recDone'));
  };
  ui.liveRec = { stop: () => rec.state === 'recording' && rec.stop() };
  rec.start(250);
  renderPanel();
  toast(t('liveRecOn'));
}

// 30 秒以上降低畫質位元率，避免 60 秒影片太大
export const recBitrate = (seconds) => (seconds >= 30 ? 5_000_000 : 8_000_000);

function startRecording(root, opts = {}) {
  if (ui.recording) return;
  const seconds = opts.seconds || ui.recDur;
  const stillP = opts.withStill ? renderStillBlob() : null;
  const mime = pickMime();
  ensureAudio().catch(() => {});
  // 有匯入音樂且開關打開：從頭播放，錄完自動暫停（在點擊當下呼叫 play，iOS 才允許）
  const withMusic = !opts.withStill && ui.recMusic && !!music.el;
  if (withMusic) {
    try { music.el.currentTime = 0; } catch (e) { /* ignore */ }
    music.el.play().catch(() => {});
  }
  const stream = canvas.captureStream(30);
  try { recordingDestination().stream.getAudioTracks().forEach((tr) => stream.addTrack(tr)); } catch (e) { /* 無音訊 */ }
  let rec;
  const bits = recBitrate(seconds);
  try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: bits } : { videoBitsPerSecond: bits }); } catch (e) { rec = new MediaRecorder(stream); }
  ui.lastRec = { seconds, bits, opts: { mimeType: mime, videoBitsPerSecond: bits }, audioTracks: stream.getAudioTracks().length, withMusic, recorder: rec };
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const out = $(opts.out || '#vidOut', root);
  const btn = $(opts.btn || '#fVid', root);
  btn.disabled = true;
  rec.onstop = () => {
    ui.recording = false;
    ui.recStop = null;
    ui.reveal = null;
    if (withMusic && music.el) music.el.pause();
    if (ui.sheet === 'music') renderPanel();
    stream.getVideoTracks().forEach((tr) => tr.stop());
    const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
    const blob = new Blob(chunks, { type });
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    btn.disabled = false;
    setRecFocus(false);
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
    ui.lastRec.blob = blob;
    const why = ui.recStopReason; ui.recStopReason = null;
    toast(why ? t('recAutoStop') : t('recDone'));
  };
  ui.recording = true;
  ui.recStop = (why) => { if (rec.state === 'recording') { ui.recStopReason = why; rec.stop(); } };
  select(null);
  if (opts.reveal) ui.reveal = { start: performance.now(), dur: seconds * 1000 * 0.6 };
  rec.start(250);
  if (S.voiceInVideo && hasCustomSound('voice')) setTimeout(() => playSound('voice'), 400);
  let left = seconds;
  out.innerHTML = `<span class="rec">${t('recording', left)}</span>`;
  setRecFocus(true, () => { if (rec.state === 'recording') rec.stop(); }, left);
  const iv = setInterval(() => {
    left -= 1;
    if (left <= 0 || rec.state !== 'recording') { clearInterval(iv); if (rec.state === 'recording') rec.stop(); return; }
    out.innerHTML = `<span class="rec">${t('recording', left)}</span>`;
    setRecFocus(true, null, left);
  }, 1000);
}

// 錄影中切到背景（或音效環境被重建）就自動停止，保留已錄好的影片，不會錄出沒聲音的片段
// 用 window capture，比 sound.js 的 suspend 先執行
function autoStopRecording(why) {
  if (ui.recStop) ui.recStop(why);
  if (ui.liveRec) ui.liveRec.stop();
}
window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autoStopRecording('hidden'); }, true);
window.addEventListener('pagehide', () => autoStopRecording('hidden'), true);
onAudioRebuild(() => autoStopRecording('rebuild'));

// 錄影時收起面板與工具列，畫布放到最大，方便點元件互動
function setRecFocus(on, stop, left) {
  const app = $('#app'), bar = $('#recBar');
  app.classList.toggle('rec-focus', on);
  bar.hidden = !on;
  if (!on) { panel.hidden = !ui.sheet; return; }
  panel.hidden = true;
  if (stop) $('#recStop').onclick = stop;
  $('#recLeft').textContent = t('recording', left);
}

// ======================================================================
// 互動模式（全螢幕）
// ======================================================================
const player = { open: false, scene: null, rotIndex: -1, pressTimer: null, fabMenu: false, dimTimer: null, drag: null, tipsShown: false, delObj: null, delTimer: null };

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
  $('#toast').classList.remove('show');
  applyPlayerUi();
  updateClock();
  wakeBack();
  toast(t(player.scene === scene ? 'playerHint' : 'playerHintRot'), $('#playerToast'), 4200);
}
// 返回鍵：一段時間沒碰畫面就變淡，碰一下又出現
function wakeBack() {
  const b = $('#playerBack');
  b.classList.remove('dim');
  clearTimeout(player.dimTimer);
  player.dimTimer = setTimeout(() => b.classList.add('dim'), 3500);
}
$('#playerBack').onclick = () => { exitPlayer(); renderPanel(); };
function exitPlayer() {
  player.open = false;
  setFabMenu(false);
  player.drag = null;
  hideDel();
  $('#player').hidden = true;
  if (location.search.includes('mode=play')) history.replaceState?.(null, '', location.pathname);
}
function applyPlayerUi() {
  $('#fab').hidden = !S.showFab;
  $('#lockClock').hidden = !S.showClock;
  $('[data-fab="clock"]').classList.toggle('on', !!S.showClock);
  $('[data-fab="music"]').classList.toggle('on', !!(music.el && !music.el.paused));
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
  ensureAudio().catch(() => {});
  wakeBack();
  pCanvas.setPointerCapture?.(e.pointerId);
  const p = toPlayer(e);
  if (player.fabMenu) setFabMenu(false);
  const hit = hitTest(player.scene.objects, p.x, p.y);
  // 預覽時也能拖曳物件（只限正在編輯的作品；輪播中的收藏不改）
  player.drag = hit ? { ...dragGesture(hit, p, snapshot()), editable: player.scene === scene } : null;
  if (!hit && S.touchFx) burst(p.x, p.y, 'spark', 9, 0.8);
  clearTimeout(player.pressTimer);
  player.pressTimer = setTimeout(() => {
    if (player.drag && player.drag.moved) return;
    if (!S.showFab) { S.showFab = true; persistSettings(); applyPlayerUi(); toast(t('fabPeek'), $('#playerToast')); }
  }, 900);
});
pCanvas.addEventListener('pointermove', (e) => {
  const g = player.drag; if (!g || !g.editable) return;
  const p = toPlayer(e);
  if (!g.moved && Math.hypot(p.x - g.sx, p.y - g.sy) > 14) { g.moved = true; clearTimeout(player.pressTimer); }
  if (g.moved) moveObject(g, p);
});
function endPlayerPointer() {
  clearTimeout(player.pressTimer);
  const g = player.drag; player.drag = null;
  if (!g) return;
  if (g.moved) { pushHistory(g.snap); autosave(); }
  else {
    if (S.componentTap) triggerTap(g.o);
    if (g.editable) showDel(g.o);
  }
}

// ---------------- 預覽中點一下物件 → 右上角浮出「×」刪除 ----------------
function objScreenTopRight(o) {
  const r = pCanvas.getBoundingClientRect();
  const s = Math.max(r.width / W, r.height / H);
  const ox = r.left + (r.width - W * s) / 2, oy = r.top + (r.height - H * s) / 2;
  let right, top;
  if (o.type === 'stroke') {
    const pad = (o.size || 16) / 2;
    right = Math.max(...o.points.map((pt) => pt[0])) + pad;
    top = Math.min(...o.points.map((pt) => pt[1])) - pad;
  } else {
    const [hw, hh] = objHalfSize(o);
    const c = Math.abs(Math.cos(o.rot || 0)), sn = Math.abs(Math.sin(o.rot || 0));
    const ex = (hw * c + hh * sn) * o.scale, ey = (hw * sn + hh * c) * o.scale;
    right = o.x + ex; top = o.y - ey;
  }
  return { x: ox + right * s, y: oy + top * s };
}
function showDel(o) {
  if (!player.open || player.scene !== scene || ui.recording || !scene.objects.includes(o)) return hideDel();
  const b = $('#playerDel');
  const pr = $('#player').getBoundingClientRect();
  const size = 44;
  const p = objScreenTopRight(o);
  let x = p.x - pr.left - size / 2, y = p.y - pr.top - size / 2;
  x = Math.min(Math.max(x, 8), pr.width - size - 8);
  y = Math.min(Math.max(y, 8), pr.height - size - 8);
  // 不擋時鐘：會疊到時鐘就移到時鐘下方
  const clock = $('#lockClock');
  if (!clock.hidden) {
    const cr = clock.getBoundingClientRect();
    const cTop = cr.top - pr.top, cBot = cr.bottom - pr.top;
    if (y + size > cTop && y < cBot) y = Math.min(cBot + 6, pr.height - size - 8);
  }
  b.style.left = x + 'px'; b.style.top = y + 'px';
  b.hidden = false;
  player.delObj = o;
  clearTimeout(player.delTimer);
  player.delTimer = setTimeout(hideDel, 3000);
}
function hideDel() {
  clearTimeout(player.delTimer);
  player.delObj = null;
  const b = $('#playerDel'); if (b) b.hidden = true;
}
$('#player').addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#playerDel')) hideDel();
}, true);
$('#playerDel').onclick = (e) => {
  e.stopPropagation();
  const o = player.delObj;
  hideDel();
  if (!o || player.scene !== scene || ui.recording) return;
  const i = scene.objects.indexOf(o);
  if (i < 0) return;
  pushHistory(snapshot());
  scene.objects.splice(i, 1);
  if (ui.selected === o) select(null);
  autosave();
  const el = $('#playerToast');
  toast(t('deletedShort'), el, 4000);
  const ub = document.createElement('button');
  ub.type = 'button'; ub.className = 'toast-undo'; ub.textContent = t('undo');
  ub.onclick = (ev) => { ev.stopPropagation(); undo(); el.classList.remove('show', 'act'); };
  el.appendChild(ub);
  el.classList.add('act');
};
['pointerup', 'pointercancel'].forEach((ev) => pCanvas.addEventListener(ev, endPlayerPointer));

function setFabMenu(open) {
  player.fabMenu = open;
  const m = $('#fabMenu');
  m.hidden = !open;
  if (open) {
    applyPlayerUi();
    // 第一次打開時把每個圖示的說明都秀出來，之後滑鼠移上去／按住才出現
    if (!player.tipsShown) { player.tipsShown = true; m.classList.add('tips'); setTimeout(() => m.classList.remove('tips'), 2600); }
  }
}
$('#fab').onclick = () => { wakeBack(); setFabMenu(!player.fabMenu); };
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
    S.showFab = false; persistSettings(); setFabMenu(false);
    toast(t('fabHidden'), $('#playerToast'));
  }
  applyPlayerUi();
});

// ======================================================================
// 主迴圈
// ======================================================================
// 錄影時重播手繪過程：前 60% 的時間把筆畫一筆一筆畫出來
function revealAt(ms) {
  if (!ui.reveal) return null;
  return Math.min(1, (ms - ui.reveal.start) / ui.reveal.dur);
}
function loop(ms) {
  const time = ms / 1000;
  music.update();
  if (player.open && player.scene) {
    renderScene(pctx, player.scene, time);
  } else {
    renderScene(ctx, scene, time, { draft: ui.draft, selected: ui.recording ? null : ui.selected, reveal: revealAt(ms) });
    renderSelFloat();
    if (ui.sheet === 'comp') $$('canvas[data-icon]', panel).forEach((c) => drawComponentIcon(c, c.dataset.icon, time));
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
  loadVoice();
  applyStaticText();
  ui.sheet = isDesktop() ? 'photo' : null;
  renderSteps();
  renderPanel();
  if (!saved && !isDesktop()) setTimeout(() => toast(t('startHint')), 800);
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
