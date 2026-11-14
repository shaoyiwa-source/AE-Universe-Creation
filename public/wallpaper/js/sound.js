// AE動態桌布 — 聲音：三款可愛音效（Web Audio 即時合成）＋匯入音樂與節奏偵測

export const SOUNDS = [
  { id: 'pop', name: '啵啵泡泡', emoji: '🫧', desc: '圓滾滾的泡泡破掉聲' },
  { id: 'bell', name: '叮叮鈴鐺', emoji: '🔔', desc: '清脆的小鈴鐺琶音' },
  { id: 'chirp', name: '啾啾小鳥', emoji: '🐤', desc: '小鳥啾啾兩聲' },
];

let ac = null;
let master = null;     // 所有聲音的總出口
let recDest = null;    // 錄影時的音訊出口

export function audio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 1;
    master.connect(ac.destination);
    // iOS：讓聲音在靜音開關打開時仍可播放（Safari 16.4+）
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ignore */ }
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

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

export function playSound(id) {
  if (!id || id === 'none') return;
  const a = audio();
  const t = a.currentTime + 0.01;
  const out = a.createGain();
  out.gain.value = sfxVolume;
  out.connect(master);

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

  load(file) {
    audio();
    if (!this.el) {
      this.el = new Audio();
      this.el.loop = true;
      this.el.playsInline = true;
      this.el.crossOrigin = 'anonymous';
      const src = ac.createMediaElementSource(this.el);
      this.analyser = ac.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.6;
      this.data = new Uint8Array(this.analyser.frequencyBinCount);
      src.connect(this.analyser);
      this.analyser.connect(master);
    }
    if (this._url) URL.revokeObjectURL(this._url);
    this._url = URL.createObjectURL(file);
    this.el.src = this._url;
    this.name = file.name.replace(/\.[^.]+$/, '');
    return this.el.play().catch(() => {});
  },
  toggle() {
    if (!this.el) return false;
    audio();
    if (this.el.paused) this.el.play().catch(() => {}); else this.el.pause();
    return this.playing;
  },
  setVolume(v) { if (this.el) this.el.volume = v; },
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
