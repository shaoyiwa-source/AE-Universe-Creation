// AE動態桌布 — 主程式
import {
  W, H, FILTERS, THEMES, COMPONENTS, burst, applyFilterPixels, drawComponentIcon, defaultBackground,
} from './effects.js';
import { SOUNDS, playSound, audio, music, setSfxVolume, recordingDestination } from './sound.js';
import {
  createScene, setBase, setFilter, coverCanvas, hitTest, renderScene, images, serializeScene,
  deserializeScene, serializeObjects, loadImage, canvasToBlob, FONT,
} from './scene.js';
import { kvGet, kvSet, galleryAll, galleryPut, galleryDel, loadSettings, saveSettings } from './store.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);

const S = loadSettings();
S.compSounds = { cloud: 'pop', star: 'bell', heart: 'chirp', ...(S.compSounds || {}) };
setSfxVolume(S.sfxVolume);

const DEFAULT_BG = defaultBackground();
let scene = createScene();
setBase(scene, DEFAULT_BG, false);

const ui = {
  tab: 'photo', tool: 'select', color: '#FF7EB6', size: 16, textColor: '#FF7EB6',
  selected: null, draft: null, recording: false, gallery: [],
};
const undoStack = [];

const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
const pCanvas = $('#playerCanvas');
const pctx = pCanvas.getContext('2d');

const COLORS = ['#FF7EB6', '#FF4D6D', '#FFB347', '#FFD93D', '#7ED957', '#4DD4C6', '#5AA9FF', '#9B7BFF', '#FFFFFF', '#4A3550'];
const SYMBOLS = [
  ['❤️', '愛心'], ['🌙', '月亮'], ['☀️', '太陽'], ['⭐', '星星'], ['♾️', '無限'], ['🌸', '花'],
  ['🌳', '樹'], ['🐦', '鳥'], ['🐟', '魚'], ['🐶', '狗'], ['🐱', '貓'], ['🌈', '彩虹'],
  ['☁️', '雲'], ['🍀', '幸運草'], ['🦋', '蝴蝶'], ['🐰', '兔兔'], ['🍓', '草莓'], ['🎀', '蝴蝶結'],
  ['✨', '閃亮'], ['💖', '心心'], ['🌷', '鬱金香'], ['🐻', '熊熊'], ['🍰', '蛋糕'], ['🪐', '星球'],
];
const THEME_SWATCH = {
  none: 'linear-gradient(135deg,#f7f1f5,#ece3ea)',
  laser: 'conic-gradient(from 200deg at 50% 100%,#1a0033,#ff2fd0,#1a0033,#2fd5ff,#1a0033,#b6ff2f,#1a0033)',
  breeze: 'linear-gradient(160deg,#fff6d8,#ffd6e7 45%,#c9f0d8)',
  sparkle: 'radial-gradient(circle at 30% 30%,#fff 0 3%,transparent 4%),radial-gradient(circle at 70% 60%,#fff 0 2%,transparent 3%),linear-gradient(160deg,#ffe7a8,#ffc2e2 50%,#c8b6ff)',
};
const THEME_ICON = { none: '⭕', laser: '🪩', breeze: '🍃', sparkle: '🌟' };

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

function snapshot() { return JSON.parse(JSON.stringify(serializeObjects(scene.objects))); }
function pushHistory(snap = snapshot()) {
  undoStack.push(snap);
  if (undoStack.length > 50) undoStack.shift();
}
function undo() {
  if (!undoStack.length) return toast('沒有可以復原的步驟');
  scene.objects = undoStack.pop();
  select(null);
  autosave();
  if (ui.tab === 'edit') renderPanel();
}
$('#btnUndo').onclick = undo;

function now() { return performance.now() / 1000; }

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
// 選取
// ======================================================================
function select(o) {
  ui.selected = o;
  $('#selBar').hidden = !o;
  $('#selEdit').hidden = !(o && o.type === 'text');
  if (ui.tab === 'edit' || ui.tab === 'comp') renderPanel();
}

$('#selBar').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || !ui.selected) return;
  const o = ui.selected;
  const act = b.dataset.sel;
  if (act === 'edit') { setTab('edit'); setTimeout(() => $('#txtInput')?.focus(), 50); return; }
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
  o.x = o.x ?? W / 2 + (Math.random() - 0.5) * 200;
  o.y = o.y ?? H / 2 + (Math.random() - 0.5) * 300;
  scene.objects.push(o);
  ui.tool = 'select';
  select(o);
  autosave();
  return o;
}

// ======================================================================
// 畫布觸控：拖曳、縮放旋轉、手寫、光紋
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
    toast('已匯入桌布照片 ✨');
    renderPanel();
  } catch (err) { toast('無法讀取這張圖片'); } finally { URL.revokeObjectURL(url); }
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
    toast('已加入可愛圖片');
  } catch (err) { toast('無法讀取這張圖片'); } finally { URL.revokeObjectURL(url); }
});

$('#fileMusic').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  await music.load(f);
  music.setVolume(S.musicVolume);
  toast(`🎵 ${music.name}`);
  renderPanel();
});

// ======================================================================
// 面板
// ======================================================================
let filterThumbs = null;
function makeFilterThumbs() {
  const src = document.createElement('canvas');
  src.width = 120; src.height = 260;
  src.getContext('2d').drawImage(scene.baseRaw || DEFAULT_BG, 0, 0, 120, 260);
  filterThumbs = {};
  FILTERS.forEach((f) => { filterThumbs[f.id] = applyFilterPixels(src, f.id).toDataURL('image/jpeg', 0.8); });
}

function setTab(tab) {
  ui.tab = tab;
  $$('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  if (tab !== 'edit' && ui.tool !== 'select') ui.tool = 'select';
  renderPanel();
}
$('#tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (b) setTab(b.dataset.tab);
});

const panel = $('#panel');
function renderPanel() {
  const fn = PANELS[ui.tab];
  panel.innerHTML = fn.html();
  fn.bind && fn.bind(panel);
}

function colorRow(current, attr) {
  return `<div class="colors">${COLORS.map((c) => `<button data-${attr}="${c}" class="${c === current ? 'on' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>`;
}

function rotationInfo() {
  const n = ui.gallery.length;
  if (!S.rotateOn || !n) return null;
  const period = S.rotateEvery * (S.rotateUnit === 'hour' ? 3600e3 : 86400e3);
  const k = Math.floor((Date.now() - S.rotateAnchor) / period);
  return { index: ((k % n) + n) % n, next: S.rotateAnchor + (k + 1) * period };
}

const PANELS = {
  photo: {
    html() {
      const rot = rotationInfo();
      return `
      <h3>桌布照片 <small>${scene.hasPhoto ? '已匯入照片' : '目前使用預設底圖'}</small></h3>
      <div class="row">
        <button class="btn solid" id="pickBase">📷 匯入照片</button>
        <button class="btn blue" id="useDefault">🌸 預設底圖</button>
      </div>
      <p class="hint">建議使用直式照片，會自動裁成 iPhone 全螢幕比例（1080×2340）。</p>
      <h3>我的桌布收藏 <small>${ui.gallery.length} 張・輪播用</small></h3>
      <div class="gallery">
        ${ui.gallery.map((g, i) => `<div class="g ${rot && rot.index === i ? 'current' : ''}" data-load="${g.id}">
            <img src="${g.thumb}" alt="桌布 ${i + 1}">
            <button class="del" data-del="${g.id}" aria-label="刪除">✕</button>
            ${rot && rot.index === i ? '<span class="badge">目前</span>' : ''}
          </div>`).join('')}
      </div>
      <button class="btn block" id="saveGallery">💾 把目前作品存進收藏</button>
      <p class="hint">點收藏縮圖可載入編輯。在「設定」開啟自動更換後，互動模式會依頻率輪流顯示收藏的桌布。</p>`;
    },
    bind(p) {
      $('#pickBase', p).onclick = () => $('#fileBase').click();
      $('#useDefault', p).onclick = () => { setBase(scene, DEFAULT_BG, false); filterThumbs = null; autosave(); renderPanel(); };
      $('#saveGallery', p).onclick = saveToGallery;
      p.querySelectorAll('[data-del]').forEach((b) => b.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm('要刪除這張收藏的桌布嗎？')) return;
        await galleryDel(b.dataset.del);
        await refreshGallery();
      });
      p.querySelectorAll('[data-load]').forEach((b) => b.onclick = async () => {
        const item = ui.gallery.find((g) => g.id === b.dataset.load);
        if (!item) return;
        pushHistory();
        scene = await deserializeScene(item.data, DEFAULT_BG);
        filterThumbs = null; select(null); autosave();
        toast('已載入收藏的桌布');
        renderPanel();
      });
    },
  },

  edit: {
    html() {
      const sel = ui.selected && ui.selected.type === 'text' ? ui.selected : null;
      return `
      <h3>編輯工具 <small>${ui.tool === 'select' ? '點選物件可移動・雙指縮放旋轉' : '在畫面上直接畫'}</small></h3>
      <div class="row">
        <button class="chip ${ui.tool === 'select' ? 'on' : ''}" data-tool="select">👆 選取移動</button>
        <button class="chip ${ui.tool === 'pen' ? 'on' : ''}" data-tool="pen">✍️ 手寫字</button>
        <button class="chip ${ui.tool === 'glow' ? 'on' : ''}" data-tool="glow">🌈 手畫光紋</button>
      </div>
      ${ui.tool !== 'select' ? `
        <div class="row">${colorRow(ui.color, 'color')}</div>
        <div class="row"><span class="label">筆刷粗細</span><input type="range" id="size" min="4" max="48" value="${ui.size}"></div>` : ''}
      <h3>文字方塊</h3>
      <textarea id="txtInput" rows="2" placeholder="輸入想寫的字，例如：今天也要開心 ♡">${sel ? esc(sel.text) : ''}</textarea>
      <div class="row" style="margin-top:8px">${colorRow(sel ? sel.color : ui.textColor, 'tcolor')}</div>
      <div class="row"><button class="btn solid" id="addText">${sel ? '更新文字' : '＋ 加入文字'}</button></div>
      <h3>可愛小符號</h3>
      <div class="sym-grid">${SYMBOLS.map(([c, n]) => `<button data-sym="${c}" aria-label="${n}"><div>${c}<span>${n}</span></div></button>`).join('')}</div>
      <div class="row">
        <button class="btn blue" id="pickSticker">🖼 匯入可愛圖片</button>
        <button class="btn" id="clearAll">🧹 清除全部編輯</button>
      </div>`;
    },
    bind(p) {
      p.querySelectorAll('[data-tool]').forEach((b) => b.onclick = () => {
        ui.tool = b.dataset.tool;
        if (ui.tool !== 'select') select(null);
        renderPanel();
      });
      p.querySelectorAll('[data-color]').forEach((b) => b.onclick = () => { ui.color = b.dataset.color; renderPanel(); });
      $('#size', p)?.addEventListener('input', (e) => { ui.size = +e.target.value; });
      p.querySelectorAll('[data-tcolor]').forEach((b) => b.onclick = () => {
        ui.textColor = b.dataset.tcolor;
        if (ui.selected && ui.selected.type === 'text') { pushHistory(); ui.selected.color = ui.textColor; autosave(); }
        p.querySelectorAll('[data-tcolor]').forEach((x) => x.classList.toggle('on', x === b));
      });
      $('#addText', p).onclick = async () => {
        const text = $('#txtInput', p).value.trim();
        if (!text) return toast('先輸入文字喔');
        try { await document.fonts.load(`900 96px "Zen Maru Gothic"`, text); } catch (e) { /* offline */ }
        if (ui.selected && ui.selected.type === 'text') {
          pushHistory(); ui.selected.text = text; autosave(); toast('已更新文字');
        } else {
          addObject({ type: 'text', text, color: ui.textColor, size: 120, y: H * 0.55 });
        }
        renderPanel();
      };
      p.querySelectorAll('[data-sym]').forEach((b) => b.onclick = () => addObject({ type: 'emoji', char: b.dataset.sym, scale: 1.6 }));
      $('#pickSticker', p).onclick = () => $('#fileSticker').click();
      $('#clearAll', p).onclick = () => {
        if (!scene.objects.length) return;
        if (!confirm('要清除畫面上全部的文字、符號、筆畫與元件嗎？（可按 ↶ 復原）')) return;
        pushHistory(); scene.objects = []; select(null); autosave();
      };
    },
  },

  comp: {
    html() {
      return `
      <h3>動態可愛元件 <small>點一下加到桌布</small></h3>
      <div class="grid">${COMPONENTS.map((c) => `
        <button class="tile" data-comp="${c.id}">
          <canvas width="160" height="160" data-icon="${c.id}"></canvas>${c.name}<small>${c.desc}</small>
        </button>`).join('')}</div>
      <h3>元件聲音 <small>點元件時播放</small></h3>
      ${COMPONENTS.map((c) => `
        <div class="row nowrap"><span class="label">${c.name}</span>
          ${SOUNDS.map((s) => `<button class="chip ${S.compSounds[c.id] === s.id ? 'on' : ''}" data-snd="${c.id}:${s.id}">${s.emoji} ${s.name}</button>`).join('')}
          <button class="chip ${S.compSounds[c.id] === 'none' ? 'on' : ''}" data-snd="${c.id}:none">🔇 無聲</button>
        </div>`).join('')}
      <p class="hint">在畫面上點一下元件就能看它動、聽它叫；拖曳可移動，雙指可縮放旋轉。</p>`;
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
    },
  },

  filter: {
    html() {
      if (!filterThumbs) makeFilterThumbs();
      return `
      <h3>濾鏡 <small>會動的動態濾鏡</small></h3>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">${FILTERS.map((f) => `
        <button class="tile ${scene.filter === f.id ? 'on' : ''}" data-filter="${f.id}">
          <img class="swatch" style="aspect-ratio:120/200;object-fit:cover" src="${filterThumbs[f.id]}" alt="">${f.name}<small>${f.desc}</small>
        </button>`).join('')}</div>`;
    },
    bind(p) {
      p.querySelectorAll('[data-filter]').forEach((b) => b.onclick = () => {
        setFilter(scene, b.dataset.filter); autosave(); renderPanel();
      });
    },
  },

  theme: {
    html() {
      return `
      <h3>動態桌面主題</h3>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">${THEMES.map((t) => `
        <button class="tile ${scene.theme === t.id ? 'on' : ''}" data-theme="${t.id}">
          <div class="swatch" style="background:${THEME_SWATCH[t.id]};display:grid;place-items:center;font-size:28px">${THEME_ICON[t.id]}</div>${t.name}<small>${t.desc}</small>
        </button>`).join('')}</div>
      <div class="row"><span class="label">效果強度</span><input type="range" id="intensity" min="0.1" max="1" step="0.05" value="${scene.intensity}"></div>
      <p class="hint">匯入音樂並播放時，雷射、風、星光會跟著音樂的節奏變化。</p>`;
    },
    bind(p) {
      p.querySelectorAll('[data-theme]').forEach((b) => b.onclick = () => { scene.theme = b.dataset.theme; autosave(); renderPanel(); });
      $('#intensity', p).addEventListener('input', (e) => { scene.intensity = +e.target.value; autosave(); });
    },
  },

  music: {
    html() {
      return `
      <h3>背景音樂</h3>
      ${music.el ? `<div class="music-card">
          <div class="eq ${music.playing ? 'on' : ''}"><i></i><i></i><i></i><i></i></div>
          <div class="name">${esc(music.name)}</div>
          <button class="btn solid" id="mToggle">${music.playing ? '⏸ 暫停' : '▶ 播放'}</button>
        </div>` : '<p class="hint">還沒有音樂。匯入一首歌，動態主題會跟著節奏閃動！</p>'}
      <div class="row"><button class="btn ${music.el ? 'blue' : 'solid'}" id="pickMusic">🎵 ${music.el ? '換一首' : '匯入音樂'}</button></div>
      <div class="row"><span class="label">音樂音量</span><input type="range" id="mVol" min="0" max="1" step="0.05" value="${S.musicVolume}"></div>
      <h3>可愛音效</h3>
      <div class="row">${SOUNDS.map((s) => `<button class="chip" data-try="${s.id}">${s.emoji} ${s.name}</button>`).join('')}</div>
      <div class="row"><span class="label">音效音量</span><input type="range" id="sVol" min="0" max="1" step="0.05" value="${S.sfxVolume}"></div>
      <p class="hint">支援 mp3、m4a、wav 等格式。錄製動態影片時，音樂與音效會一起錄進去。</p>`;
    },
    bind(p) {
      $('#pickMusic', p).onclick = () => $('#fileMusic').click();
      $('#mToggle', p) && ($('#mToggle', p).onclick = () => { music.toggle(); setTimeout(renderPanel, 80); });
      $('#mVol', p).addEventListener('input', (e) => { S.musicVolume = +e.target.value; music.setVolume(S.musicVolume); persistSettings(); });
      $('#sVol', p).addEventListener('input', (e) => { S.sfxVolume = +e.target.value; setSfxVolume(S.sfxVolume); persistSettings(); });
      p.querySelectorAll('[data-try]').forEach((b) => b.onclick = () => playSound(b.dataset.try));
    },
  },

  settings: {
    html() {
      const rot = rotationInfo();
      const sw = (key, title, sub) => `
        <label class="set-item"><div><b>${title}</b><small>${sub}</small></div>
          <span class="switch"><input type="checkbox" data-set="${key}" ${S[key] ? 'checked' : ''}><span></span></span></label>`;
      return `
      <h3>使用者互動模式</h3>
      ${sw('componentTap', '點元件互動', '點可愛元件會跳動並發出聲音')}
      ${sw('touchFx', '觸碰特效', '點畫面任何地方會噴出星星')}
      ${sw('showFab', '顯示互動按鈕', '互動模式右下角的 AE 按鈕（隱藏後長按畫面可叫回）')}
      ${sw('showClock', '預覽鎖定畫面時鐘', '互動模式中顯示時間，方便對照版面')}
      <div class="row" style="margin-top:8px"><button class="btn solid block" id="lockGuide">🔒 設定「鎖定畫面按鈕」叫出 App</button></div>
      <h3 style="margin-top:14px">桌布更新頻率</h3>
      ${sw('rotateOn', '自動更換桌布', '從「我的桌布收藏」依序輪播')}
      <div class="row">
        <span class="label">每</span>
        <input type="number" id="rotEvery" min="1" max="99" value="${S.rotateEvery}" style="width:72px">
        <select id="rotUnit">
          <option value="hour" ${S.rotateUnit === 'hour' ? 'selected' : ''}>小時</option>
          <option value="day" ${S.rotateUnit === 'day' ? 'selected' : ''}>天</option>
        </select>
        <span style="font-size:13px">更新一次</span>
      </div>
      <p class="hint">${!S.rotateOn ? '開啟後才會輪播。' : !ui.gallery.length ? '收藏裡還沒有桌布，先到「桌布」分頁存幾張吧。' : `目前顯示第 ${rot.index + 1} / ${ui.gallery.length} 張・下次更新：${new Date(rot.next).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}</p>
      <h3 style="margin-top:14px">一鍵設為桌布</h3>
      <div class="row"><button class="btn solid block" id="setGuide">📱 建立「${SHORTCUT_NAME}」捷徑</button></div>
      <div class="row"><button class="btn blue block" id="rotGuide">📱 讓 iPhone 系統桌布也自動更換</button></div>
      <div class="row"><button class="btn block" id="installGuide">⬇️ 把 AE動態桌布 加到主畫面</button></div>`;
    },
    bind(p) {
      p.querySelectorAll('[data-set]').forEach((inp) => inp.onchange = () => {
        S[inp.dataset.set] = inp.checked;
        if (inp.dataset.set === 'rotateOn' && inp.checked) S.rotateAnchor = Date.now();
        persistSettings(); renderPanel();
      });
      $('#rotEvery', p).onchange = (e) => { S.rotateEvery = Math.max(1, Math.min(99, Math.round(+e.target.value) || 1)); S.rotateAnchor = Date.now(); persistSettings(); renderPanel(); };
      $('#rotUnit', p).onchange = (e) => { S.rotateUnit = e.target.value; S.rotateAnchor = Date.now(); persistSettings(); renderPanel(); };
      $('#lockGuide', p).onclick = showLockGuide;
      $('#rotGuide', p).onclick = showRotateGuide;
      $('#setGuide', p).onclick = showSetWallpaperGuide;
      $('#installGuide', p).onclick = showInstallGuide;
    },
  },
};

// ======================================================================
// 收藏
// ======================================================================
async function refreshGallery() {
  ui.gallery = await galleryAll();
  if (ui.tab === 'photo' || ui.tab === 'settings') renderPanel();
}

async function makeThumb(sc) {
  const full = document.createElement('canvas'); full.width = W; full.height = H;
  renderScene(full.getContext('2d'), sc, now(), { dt: 0 });
  const th = document.createElement('canvas'); th.width = 180; th.height = 390;
  th.getContext('2d').drawImage(full, 0, 0, 180, 390);
  return th.toDataURL('image/jpeg', 0.8);
}

async function saveToGallery() {
  const item = { id: uid(), created: Date.now(), thumb: await makeThumb(scene), data: await serializeScene(scene) };
  try {
    await galleryPut(item);
    toast('已存進我的桌布收藏 💾');
  } catch (e) { toast('儲存失敗，可能是空間不足'); }
  await refreshGallery();
}

// ======================================================================
// 說明對話框
// ======================================================================
function playUrl() { return `${location.origin}/wallpaper/?mode=play`; }
function copyBtn(text) {
  return `<div class="code"><span>${esc(text)}</span><button class="btn" data-copy="${esc(text)}">複製</button></div>`;
}
function bindCopy(root) {
  root.querySelectorAll('[data-copy]').forEach((b) => b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('已複製'); } catch (e) { toast('請長按網址手動複製'); }
  });
}

function showLockGuide() {
  openModal(`
    <h2>🔒 鎖定畫面按鈕</h2>
    <p class="hint">iPhone（iOS 18 以上）可以把「捷徑」放到鎖定畫面下方的控制項按鈕。按下後解鎖，就會直接打開 AE動態桌布 的互動模式。</p>
    <h4>步驟 1：建立捷徑</h4>
    <ol>
      <li>打開「捷徑」App → 右上角「＋」新增捷徑</li>
      <li>加入動作「打開 URL」，貼上下面的網址</li>
      <li>把捷徑命名為「AE互動」，可選可愛的圖示</li>
    </ol>
    ${copyBtn(playUrl())}
    <h4>步驟 2：放到鎖定畫面</h4>
    <ol>
      <li>在鎖定畫面長按 → 「自訂」→ 選「鎖定畫面」</li>
      <li>點左下或右下按鈕上的「－」移除原本的（手電筒／相機）</li>
      <li>點「＋」→ 搜尋「捷徑」→ 選擇「AE互動」→ 完成</li>
    </ol>
    <h4>隱藏這個按鈕</h4>
    <ul>
      <li>鎖定畫面：同樣進入「自訂」，按「－」把 AE互動 按鈕移除即可。</li>
      <li>App 內：在「設定」關閉「顯示互動按鈕」，互動模式就不會出現 AE 浮動按鈕（長按畫面 1 秒可暫時叫回）。</li>
    </ul>`, bindCopy);
}

function showRotateGuide() {
  openModal(`
    <h2>📱 系統桌布自動更換</h2>
    <p class="hint">基於 iOS 的安全限制，任何 App 都不能在背景直接替你換掉系統桌布。下面兩種做法可以讓 iPhone 依頻率自動更新：</p>
    <h4>方法 A：iPhone 內建「相片隨機顯示」（最推薦）</h4>
    <ol>
      <li>在本 App 匯出你喜歡的桌布（匯出 → 儲存靜態桌布），存到「照片」並放進同一本相簿</li>
      <li>設定 → 背景圖片 → 「＋ 新增背景圖片」→「相片隨機顯示」</li>
      <li>選擇那本相簿，頻率選「每小時」或「每天」</li>
    </ol>
    <h4>方法 B：捷徑自動化＋本 App 輪播</h4>
    <ol>
      <li>在「設定」開啟「自動更換桌布」，選好每幾小時／幾天</li>
      <li>捷徑 App → 自動化 → 新增「特定時間」，動作選「打開 URL」貼上下面網址</li>
      <li>到點會打開互動模式，自動顯示當下該輪到的那張桌布</li>
    </ol>
    ${copyBtn(playUrl())}
    <div class="note">小提醒：動態效果（雷射、星光、元件動畫、音效）需在 App 的互動模式中才會播放；設成系統桌布時是靜態圖或 Live Photo。</div>`, bindCopy);
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
  // ClipboardItem 必須在點擊當下建立，圖片用 Promise 傳入（iOS Safari 的要求）
  const blobP = renderStillBlob();
  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error('no clipboard');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP })]);
  } catch (e) {
    toast('無法複製圖片，改用「儲存／分享」');
    shareOrDownload(await blobP, `AE動態桌布-${Date.now()}.png`);
    return;
  }
  toast('桌布已複製，正在打開捷徑…');
  location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}`;
}

function showSetWallpaperGuide() {
  openModal(`
    <h2>📱 建立「${SHORTCUT_NAME}」捷徑</h2>
    <p class="hint">只需要做一次。之後在 App 按「📱 設為桌布」，就會自動把畫面設成 iPhone 桌布。</p>
    <ol>
      <li>打開「捷徑」App → 右上角「＋」</li>
      <li>點「加入動作」，搜尋「<b>取得剪貼板</b>」並加入</li>
      <li>再搜尋「<b>設定背景圖片</b>」並加入（在「設定背景圖片」動作裡選擇要套用的背景圖片）</li>
      <li>點「設定背景圖片」動作旁的箭頭，關閉「<b>顯示預覽</b>」，會更快完成</li>
      <li>把捷徑名稱改成下面這個名字（要一模一樣）</li>
    </ol>
    ${copyBtn(SHORTCUT_NAME)}
    <div class="note">
      第一次執行時，iPhone 會詢問是否允許「${SHORTCUT_NAME}」讀取剪貼板、更改背景圖片，請選「一律允許」。<br>
      「設為桌布」設定的是靜態圖片；iPhone 不讓捷徑或 App 直接設定原況照片（Live Photo）。
    </div>`, bindCopy);
}

function showInstallGuide() {
  openModal(`
    <h2>⬇️ 加到主畫面</h2>
    <ol>
      <li>用 iPhone 的 Safari 打開這個網頁</li>
      <li>點下方的「分享」按鈕 <b>⎋</b></li>
      <li>選「加入主畫面」→「新增」</li>
    </ol>
    <p class="hint">加入後會像一般 App 一樣全螢幕開啟，作品與收藏都存在你的手機裡，不會上傳。</p>
    ${copyBtn(`${location.origin}/wallpaper/`)}`, bindCopy);
}

// ======================================================================
// 匯出：靜態圖、動態影片
// ======================================================================
async function shareOrDownload(blob, name) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'AE動態桌布' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function pickMime() {
  if (!window.MediaRecorder) return null;
  const list = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  return list.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
}

let exportDur = 10;
function showExport() {
  select(null);
  const canRec = pickMime() !== null && !!canvas.captureStream;
  openModal(`
    <h2>匯出桌布</h2>
    <h4>📱 一鍵設為 iPhone 桌布</h4>
    <p class="hint">透過 iPhone「捷徑」直接把目前畫面設成鎖定畫面＋主畫面桌布。第一次使用要先建立捷徑。</p>
    <div class="row">
      <button class="btn solid" id="exSet">📱 設為桌布</button>
      <button class="btn blue" id="exSetGuide">第一次使用？建立捷徑</button>
    </div>
    <h4>🖼 靜態桌布（PNG）</h4>
    <p class="hint">1080×2340 高畫質，可直接設為 iPhone 桌布。</p>
    <div class="row"><button class="btn solid" id="exPng">產生靜態桌布</button><span id="pngOut"></span></div>
    <h4>🎬 動態桌布影片（含音樂與音效）</h4>
    ${canRec ? `
      <div class="row">${[5, 10, 15].map((s) => `<button class="chip ${exportDur === s ? 'on' : ''}" data-dur="${s}">${s} 秒</button>`).join('')}</div>
      <div class="row"><button class="btn solid" id="exVid">● 開始錄製</button><span id="vidOut"></span></div>
      <p class="hint">錄製時可以點畫面上的元件，互動也會被錄進去。</p>`
    : '<p class="hint">這個瀏覽器不支援錄影，請使用 iPhone Safari（iOS 14.5 以上）或 Chrome。</p>'}
    <h4>💾 存進我的桌布收藏</h4>
    <div class="row"><button class="btn blue" id="exGallery">存進收藏</button></div>
    <div class="note">
      <b>不用捷徑也可以：</b>把靜態桌布存到照片 → 打開該照片 → 分享 → 「設為背景圖片」。<br>
      <b>想讓鎖定畫面會動：</b>把影片用「intoLive」等 App 轉成 Live Photo，再於 設定 → 背景圖片 選擇該 Live Photo（長按鎖定畫面即可播放）。
    </div>`, (root) => {
    $('#exSet', root).onclick = () => setAsWallpaper();
    $('#exSetGuide', root).onclick = showSetWallpaperGuide;
    $('#exPng', root).onclick = async () => {
      $('#pngOut', root).textContent = '產生中…';
      const blob = await renderStillBlob();
      $('#pngOut', root).innerHTML = '<button class="btn" id="savePng">⬇ 儲存／分享</button>';
      $('#savePng', root).onclick = () => shareOrDownload(blob, `AE動態桌布-${Date.now()}.png`);
    };
    root.querySelectorAll('[data-dur]').forEach((b) => b.onclick = () => {
      exportDur = +b.dataset.dur;
      root.querySelectorAll('[data-dur]').forEach((x) => x.classList.toggle('on', x === b));
    });
    $('#exVid', root) && ($('#exVid', root).onclick = () => startRecording(root));
    $('#exGallery', root).onclick = async () => { await saveToGallery(); };
  });
}
$('#btnExport').onclick = showExport;

function startRecording(root) {
  if (ui.recording) return;
  const mime = pickMime();
  const stream = canvas.captureStream(30);
  try { recordingDestination().stream.getAudioTracks().forEach((tr) => stream.addTrack(tr)); } catch (e) { /* 無音訊 */ }
  let rec;
  try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined); } catch (e) { rec = new MediaRecorder(stream); }
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const out = $('#vidOut', root);
  const btn = $('#exVid', root);
  btn.disabled = true;
  rec.onstop = () => {
    ui.recording = false;
    stream.getVideoTracks().forEach((t) => t.stop());
    const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
    const blob = new Blob(chunks, { type });
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    btn.disabled = false; btn.textContent = '● 重新錄製';
    out.innerHTML = '<button class="btn" id="saveVid">⬇ 儲存／分享影片</button>';
    $('#saveVid', root).onclick = () => shareOrDownload(blob, `AE動態桌布-${Date.now()}.${ext}`);
    toast('錄製完成 🎬');
  };
  ui.recording = true;
  select(null);
  rec.start(250);
  let left = exportDur;
  out.innerHTML = `<span class="rec">錄製中 ${left}s</span>`;
  const iv = setInterval(() => {
    left -= 1;
    if (left <= 0 || rec.state !== 'recording') { clearInterval(iv); if (rec.state === 'recording') rec.stop(); return; }
    out.innerHTML = `<span class="rec">錄製中 ${left}s</span>`;
  }, 1000);
  // 讓使用者看得到畫面：收起對話框
  $('#modal').hidden = true;
  toast(`錄製 ${exportDur} 秒中… 可以點元件互動`);
  setTimeout(() => { if ($('#modalBody').contains(out)) $('#modal').hidden = false; }, exportDur * 1000 + 600);
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
  audio();
  player.scene = await sceneForPlayer();
  player.open = true;
  $('#player').hidden = false;
  applyPlayerUi();
  updateClock();
  if (S.componentTap || S.touchFx) toast('點點看畫面上的元件 ✨', $('#playerToast'));
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
  $('#lcTime').textContent = d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
  $('#lcDate').textContent = d.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' });
}
setInterval(async () => {
  if (!player.open) return;
  updateClock();
  const rot = rotationInfo();
  if (rot && rot.index !== player.rotIndex) {
    player.scene = await sceneForPlayer();
    toast('桌布已依頻率更新 ✨', $('#playerToast'));
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
    if (!S.showFab) { $('#fab').hidden = false; toast('互動按鈕暫時出現囉', $('#playerToast')); }
  }, 900);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => pCanvas.addEventListener(ev, () => clearTimeout(player.pressTimer)));

$('#fab').onclick = () => { player.fabMenu = !player.fabMenu; $('#fabMenu').hidden = !player.fabMenu; };
$('#fabMenu').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const act = b.dataset.fab;
  if (act === 'theme') {
    const ids = THEMES.map((t) => t.id);
    const sc = player.scene;
    sc.theme = ids[(ids.indexOf(sc.theme) + 1) % ids.length];
    toast(`主題：${THEMES.find((t) => t.id === sc.theme).name}`, $('#playerToast'));
    if (sc === scene) autosave();
  } else if (act === 'music') {
    if (!music.el) toast('先到「音樂」分頁匯入音樂喔', $('#playerToast'));
    else toast(music.toggle() ? `🎵 ${music.name}` : '音樂暫停', $('#playerToast'));
  } else if (act === 'clock') {
    S.showClock = !S.showClock; persistSettings(); applyPlayerUi();
  } else if (act === 'hide') {
    S.showFab = false; persistSettings(); applyPlayerUi();
    toast('已隱藏，長按畫面可叫回', $('#playerToast'));
  } else if (act === 'exit') {
    exitPlayer(); renderPanel();
  }
  if (act !== 'exit' && act !== 'hide') { player.fabMenu = false; $('#fabMenu').hidden = true; }
});

// ======================================================================
// 主迴圈
// ======================================================================
function loop(ms) {
  const t = ms / 1000;
  music.update();
  if (player.open && player.scene) {
    renderScene(pctx, player.scene, t);
  } else {
    renderScene(ctx, scene, t, { draft: ui.draft, selected: ui.recording ? null : ui.selected });
    if (ui.tab === 'comp') $$('canvas[data-icon]', panel).forEach((c) => drawComponentIcon(c, c.dataset.icon, t));
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
  renderPanel();
  requestAnimationFrame(loop);
  try { await document.fonts.load('900 96px "Zen Maru Gothic"', 'AE動態桌布'); } catch (e) { /* offline */ }
  if (new URLSearchParams(location.search).get('mode') === 'play') enterPlayer();
}

boot();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/wallpaper/sw.js', { scope: '/wallpaper/' }).catch(() => {});
}
