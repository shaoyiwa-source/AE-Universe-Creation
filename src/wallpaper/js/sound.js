// AE動態桌布 — 聲音：三款可愛音效（Web Audio 即時合成）＋匯入音樂與節奏偵測

export const SOUNDS = [
  { id: 'pop', name: '啵啵泡泡', emoji: '🫧', desc: '圓滾滾的泡泡破掉聲' },
  { id: 'bell', name: '叮叮鈴鐺', emoji: '🔔', desc: '清脆的小鈴鐺琶音' },
  { id: 'chirp', name: '啾啾小鳥', emoji: '🐤', desc: '小鳥啾啾兩聲' },
  { id: 'boing', name: '彈簧蹦蹦', emoji: '🐰', desc: '軟Q的彈簧聲' },
  { id: 'harp', name: '豎琴滑音', emoji: '🌙', desc: '夢幻的豎琴上行' },
  { id: 'meow', name: '小貓喵喵', emoji: '🐱', desc: '撒嬌的一聲喵' },
];

let ac = null;
let master = null;     // 所有聲音的總出口
let recDest = null;    // 錄影時的音訊出口
let needsCheck = false; // 從背景回來後，下一次點擊要確認音訊真的在跑
let ensuring = null;    // 進行中的 ensureAudio（避免同時多次重建）

function setPlayback() {
  // iOS：讓聲音在靜音開關打開時仍可播放（Safari 16.4+）
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ }
}

function create() {
  const AC = window.AudioContext || window.webkitAudioContext;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = 1;
  master.connect(ac.destination);
  setPlayback();
}

// 同步取得 AudioContext（不在這裡 resume；resume 只在點擊時由 ensureAudio 處理）
export function audio() {
  if (!ac) create();
  setPlayback();
  return ac;
}

// iOS 從背景回來時，舊的 AudioContext 可能停在 interrupted，或顯示 running 卻沒有聲音：整個重建
const rebuildListeners = new Set();
export function onAudioRebuild(cb) { rebuildListeners.add(cb); return () => rebuildListeners.delete(cb); }
export const rebuildCount = { n: 0 };

export function rebuild() {
  const old = ac;
  const hadRec = !!recDest;
  ac = null; master = null; recDest = null;
  if (old) { try { old.close().catch(() => {}); } catch (e) { /* ignore */ } }
  create();
  // 錄影出口重新接上新的 master（下一次錄影直接用新的）
  if (hadRec) { recDest = ac.createMediaStreamDestination(); master.connect(recDest); }
  music._reattach();
  needsCheck = false;
  rebuildCount.n += 1;
  rebuildListeners.forEach((cb) => { try { cb(ac); } catch (e) { /* ignore */ } });
  return ac;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function unlockBlip(a) {
  // 播一個 1 sample 的靜音 buffer，讓 iOS 在使用者手勢中解鎖輸出
  try {
    const b = a.createBuffer(1, 1, a.sampleRate || 44100);
    const s = a.createBufferSource();
    s.buffer = b; s.connect(a.destination); s.start(0);
  } catch (e) { /* ignore */ }
}

// 在點擊（pointerdown/touchend）中呼叫，播放前 await
export function ensureAudio() {
  if (ensuring) return ensuring;
  ensuring = (async () => {
    let a = audio();
    if (a.state !== 'running') { try { await a.resume(); } catch (e) { /* ignore */ } }
    unlockBlip(a);
    let dead = a.state !== 'running';
    if (!dead && needsCheck) {
      const t0 = a.currentTime;
      await sleep(60);
      dead = !(a.currentTime > t0);
    }
    if (dead) {
      a = rebuild();
      try { await a.resume(); } catch (e) { /* ignore */ }
      unlockBlip(a);
    }
    needsCheck = false;
    return a;
  })().finally(() => { ensuring = null; });
  return ensuring;
}

export const recordingMaster = () => master;
export function recordingDestination() {
  audio();
  if (!recDest) {
    recDest = ac.createMediaStreamDestination();
    master.connect(recDest);
  }
  return recDest;
}

let sfxVolume = 0.7;
export function setSfxVolume(v) { sfxVolume = v; }

function env(g, t, peak, attack, decay) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

// 自訂音效（例如錄音模組錄下的「我的聲音」）
const custom = new Map();
export function setCustomSound(id, buffer) { if (buffer) custom.set(id, buffer); else custom.delete(id); }
export const hasCustomSound = (id) => custom.has(id);
export const soundOutput = () => { audio(); return master; };
export const audioState = () => ({ state: ac ? ac.state : 'none', time: ac ? ac.currentTime : 0, ctx: ac });

export async function playSound(id, retry = true) {
  if (!id || id === 'none') return;
  let a;
  try { a = await ensureAudio(); } catch (e) { a = audio(); }
  synth(a, id);
  // 150ms 後確認時間有在走；沒走代表這個 context 已經沒聲音 → 重建並重播這一聲
  const t0 = a.currentTime;
  setTimeout(() => {
    if (a !== ac || document.visibilityState !== 'visible') return;
    if (!(a.currentTime > t0) && retry) {
      const b = rebuild();
      b.resume().catch(() => {});
      unlockBlip(b);
      synth(b, id);
    }
  }, 150);
}

function synth(a, id) {
  const t = a.currentTime + 0.01;
  const out = a.createGain();
  out.gain.value = sfxVolume;
  out.connect(master);
  if (custom.has(id)) {
    const src = a.createBufferSource();
    src.buffer = custom.get(id);
    src.connect(out);
    src.start(t);
    return;
  }

  if (id === 'pop') {
    [0, 0.085].forEach((d, i) => {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(320 + i * 180, t + d);
      o.frequency.exponentialRampToValueAtTime(1100 + i * 380, t + d + 0.07);
      env(g, t + d, 0.9, 0.008, 0.11);
      o.connect(g).connect(out);
      o.start(t + d); o.stop(t + d + 0.16);
    });
  } else if (id === 'bell') {
    [1318.5, 1568, 2093, 2637].forEach((f, i) => {
      const d = i * 0.07;
      [1, 2.76].forEach((mult, k) => {
        const o = a.createOscillator();
        const g = a.createGain();
        o.type = k ? 'sine' : 'triangle';
        o.frequency.value = f * mult;
        env(g, t + d, k ? 0.12 : 0.5, 0.004, k ? 0.25 : 0.7);
        o.connect(g).connect(out);
        o.start(t + d); o.stop(t + d + 0.9);
      });
    });
  } else if (id === 'chirp') {
    [0, 0.13].forEach((d) => {
      const o = a.createOscillator();
      const g = a.createGain();
      const lfo = a.createOscillator();
      const lfoGain = a.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(2300, t + d);
      o.frequency.exponentialRampToValueAtTime(3600, t + d + 0.04);
      o.frequency.exponentialRampToValueAtTime(2500, t + d + 0.09);
      lfo.frequency.value = 38; lfoGain.gain.value = 180;
      lfo.connect(lfoGain).connect(o.frequency);
      env(g, t + d, 0.45, 0.006, 0.09);
      o.connect(g).connect(out);
      o.start(t + d); lfo.start(t + d);
      o.stop(t + d + 0.12); lfo.stop(t + d + 0.12);
    });
  } else if (id === 'boing') {
    const o = a.createOscillator();
    const g = a.createGain();
    const lfo = a.createOscillator();
    const lfoGain = a.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.42);
    lfo.frequency.value = 17; lfoGain.gain.value = 45;
    lfo.connect(lfoGain).connect(o.frequency);
    env(g, t, 0.75, 0.01, 0.42);
    o.connect(g).connect(out);
    o.start(t); lfo.start(t); o.stop(t + 0.5); lfo.stop(t + 0.5);
  } else if (id === 'harp') {
    [1046.5, 1174.7, 1318.5, 1568, 1760, 2093].forEach((f, i) => {
      const d = i * 0.045;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      env(g, t + d, 0.38, 0.004, 0.55);
      o.connect(g).connect(out);
      o.start(t + d); o.stop(t + d + 0.65);
    });
  } else if (id === 'meow') {
    const o = a.createOscillator();
    const g = a.createGain();
    const bp = a.createBiquadFilter();
    const lp = a.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(480, t);
    o.frequency.exponentialRampToValueAtTime(780, t + 0.13);
    o.frequency.exponentialRampToValueAtTime(460, t + 0.45);
    bp.type = 'bandpass'; bp.Q.value = 5;
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(1900, t + 0.12);
    bp.frequency.exponentialRampToValueAtTime(1000, t + 0.45);
    lp.type = 'lowpass'; lp.frequency.value = 3200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
    g.gain.setValueAtTime(0.5, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(bp).connect(lp).connect(g).connect(out);
    o.start(t); o.stop(t + 0.55);
  }
}

// ---------------- 音樂 ----------------
export const music = {
  el: null,
  name: '',
  analyser: null,
  data: null,
  level: 0,      // 平滑後 0..1 的音量
  beat: 0,       // 節拍脈衝 0..1
  _avg: 0,
  get playing() { return !!(this.el && !this.el.paused); },

  _volume: 1,
  _make() {
    // MediaElementSource 綁死在建立它的 AudioContext 上，所以每個 context 都要新的 <audio>
    this.el = new Audio();
    this.el.loop = true;
    this.el.playsInline = true;
    this.el.crossOrigin = 'anonymous';
    this.el.volume = this._volume;
    const src = ac.createMediaElementSource(this.el);
    this.analyser = ac.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.6;
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    src.connect(this.analyser);
    this.analyser.connect(master);
  },
  // rebuild() 後呼叫：用保存的 _url 重新載入，保留播放狀態、位置與音量
  _reattach() {
    const old = this.el;
    if (!old) return;
    const wasPlaying = !old.paused;
    const pos = old.currentTime || 0;
    try { old.pause(); old.removeAttribute('src'); old.load(); } catch (e) { /* ignore */ }
    this.el = null; this.analyser = null; this.data = null;
    if (!this._url) return;
    this._make();
    this.el.src = this._url;
    const el = this.el;
    const seek = () => { try { el.currentTime = pos; } catch (e) { /* ignore */ } };
    if (el.readyState >= 1) seek(); else el.addEventListener('loadedmetadata', seek, { once: true });
    if (wasPlaying) el.play().catch(() => {});
  },
  load(file) {
    audio();
    if (!this.el) this._make();
    if (this._url) URL.revokeObjectURL(this._url);
    this._url = URL.createObjectURL(file);
    this.el.src = this._url;
    this.name = file.name.replace(/\.[^.]+$/, '');
    return this.el.play().catch(() => {});
  },
  toggle() {
    if (!this.el) return false;
    ensureAudio().catch(() => {});
    if (this.el.paused) this.el.play().catch(() => {}); else this.el.pause();
    return this.playing;
  },
  setVolume(v) { this._volume = v; if (this.el) this.el.volume = v; },
  update() {
    if (!this.playing || !this.analyser) {
      this.level *= 0.9; this.beat *= 0.85; return;
    }
    this.analyser.getByteFrequencyData(this.data);
    let bass = 0, all = 0;
    for (let i = 0; i < this.data.length; i++) {
      all += this.data[i];
      if (i < 10) bass += this.data[i];
    }
    bass /= 10 * 255; all /= this.data.length * 255;
    this.level += (all - this.level) * 0.3;
    this._avg += (bass - this._avg) * 0.05;
    if (bass > this._avg * 1.25 && bass > 0.35) this.beat = 1; else this.beat *= 0.86;
  },
};

// iOS：進背景時主動 suspend；回前景時「不」在這裡 resume（不在手勢內 iOS 會卡住），只標記下一次點擊要檢查
document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.visibilityState === 'hidden') { ac.suspend().catch(() => {}); }
  else { needsCheck = true; }
});
// 任何點擊（pointerdown / touchend）都順手喚醒音訊；touchend 是 iOS 最可靠的解鎖手勢
['pointerdown', 'touchend'].forEach((ev) => document.addEventListener(ev, () => { if (ac) ensureAudio().catch(() => {}); }, { capture: true, passive: true }));
