// AE Lumina Wall — generative healing soundscapes + touch chimes (Web Audio, no external files)
// Everything is tuned to C major pentatonic so music and touch chimes are always consonant.

const PENTA = [0, 2, 4, 7, 9]; // C D E G A
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.preset = 'none';
    this.volume = 0.6;
    this.timers = [];
    this.voices = new Set();
    this.customEl = null;
    this.customUrl = null;
    this.customNode = null;
    this.chimeOn = true;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain();
      this.master.gain.value = this.volume;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.4;
      this.master.connect(comp).connect(ctx.destination);
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this._impulse(4.2, 2.6);
      this.wet = ctx.createGain(); this.wet.gain.value = 0.55;
      this.reverb.connect(this.wet).connect(this.master);
      this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0;
      this.musicBus.connect(this.master);
      this.musicBus.connect(this.reverb);
      this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.5;
      this.sfxBus.connect(this.master);
      this.sfxBus.connect(this.reverb);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  }

  _impulse(seconds, decay) {
    const ctx = this.ctx, rate = ctx.sampleRate, len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  setVolume(v) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  setCustom(blob) {
    if (this.customUrl) URL.revokeObjectURL(this.customUrl);
    this.customUrl = blob ? URL.createObjectURL(blob) : null;
    if (this.customEl) { this.customEl.pause(); this.customEl.src = this.customUrl || ''; }
  }

  play(preset) {
    if (!this.ensure()) return;
    this.stop(true);
    this.preset = preset;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, t);
    this.musicBus.gain.linearRampToValueAtTime(preset === 'custom' ? 1 : 0.9, t + 3);
    if (preset === 'celestial') this._celestial();
    else if (preset === 'ocean') this._ocean();
    else if (preset === 'dawn') this._dawn();
    else if (preset === 'custom') this._custom();
  }

  stop(immediate = false) {
    this.timers.forEach(clearTimeout); this.timers = [];
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const fade = immediate ? 0.6 : 2;
    for (const v of this.voices) {
      try { v.gain.gain.cancelScheduledValues(t); v.gain.gain.setValueAtTime(v.gain.gain.value, t); v.gain.gain.linearRampToValueAtTime(0, t + fade); v.stopAt(t + fade + 0.1); } catch { /* ignore */ }
    }
    this.voices.clear();
    if (this.customEl && !this.customEl.paused) {
      const el = this.customEl;
      const start = el.volume; let k = 0;
      clearInterval(this.fadeIv);
      this.fadeIv = setInterval(() => { k++; el.volume = Math.max(0, start * (1 - k / 10)); if (k >= 10) { clearInterval(this.fadeIv); el.pause(); el.volume = 1; } }, fade * 100);
    }
    this.preset = 'none';
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }

  _later(fn, ms) { const id = setTimeout(fn, ms); this.timers.push(id); return id; }

  _track(gain, nodes) {
    const v = { gain, stopAt: (when) => nodes.forEach(n => { try { n.stop(when); } catch { /* ignore */ } }) };
    this.voices.add(v);
    return v;
  }

  // Warm detuned pad voice
  _pad(freq, start, dur, level = 0.05, type = 'sine', cutoff = 1400) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.3;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = type; o2.type = 'triangle';
    o1.frequency.value = freq; o2.frequency.value = freq * 1.003;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.08 + Math.random() * 0.1; lfoG.gain.value = freq * 0.002;
    lfo.connect(lfoG).connect(o1.frequency);
    const g2 = ctx.createGain(); g2.gain.value = 0.45;
    o1.connect(f); o2.connect(g2).connect(f); f.connect(g).connect(this.musicBus);
    const atk = Math.min(4, dur * 0.4);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(level, start + atk);
    g.gain.setValueAtTime(level, start + dur - atk);
    g.gain.linearRampToValueAtTime(0, start + dur + 1.5);
    [o1, o2, lfo].forEach(o => { o.start(start); o.stop(start + dur + 1.7); });
    const v = this._track(g, [o1, o2, lfo]);
    o1.onended = () => this.voices.delete(v);
  }

  _bell(freq, when, level = 0.05, decay = 3.2, bus = this.musicBus) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o.type = 'sine'; o2.type = 'sine';
    o.frequency.value = freq; o2.frequency.value = freq * 2.756;
    g2.gain.value = 0.18;
    o.connect(g); o2.connect(g2).connect(g); g.connect(bus);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(level, when + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    o.start(when); o2.start(when); o.stop(when + decay + 0.1); o2.stop(when + decay + 0.1);
    if (bus === this.musicBus) { const v = this._track(g, [o, o2]); o.onended = () => this.voices.delete(v); }
  }

  // 星河冥想 Celestial Meditation — slow major-seventh pads + sparse pentatonic bells
  _celestial() {
    const chords = [
      [48, 55, 59, 62, 64], // Cmaj9
      [45, 52, 55, 59, 60], // Am9
      [41, 48, 52, 57, 59], // Fmaj7#11
      [43, 50, 57, 60, 64], // G6/9sus
    ];
    let i = 0;
    const step = () => {
      if (this.preset !== 'celestial') return;
      const t = this.ctx.currentTime + 0.05;
      chords[i % chords.length].forEach((m, k) => this._pad(midi(m), t + k * 0.12, 11, k === 0 ? 0.05 : 0.032, 'sine', 1100));
      i++;
      this._later(step, 9500);
    };
    const bells = () => {
      if (this.preset !== 'celestial') return;
      const m = 72 + PENTA[Math.floor(Math.random() * 5)] + (Math.random() < 0.3 ? 12 : 0);
      this._bell(midi(m), this.ctx.currentTime + 0.05, 0.028 + Math.random() * 0.02, 4.5);
      this._later(bells, 1800 + Math.random() * 3800);
    };
    step(); this._later(bells, 2500);
  }

  // 海潮呼吸 Ocean Breath — filtered noise swelling on a 10s (6 breaths/min) cycle + low drone
  _ocean() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2) * 0.9; }
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.1;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.09;
    const lfoF = ctx.createGain(); lfoF.gain.value = 380;
    const base = ctx.createConstantSource ? ctx.createConstantSource() : null;
    lfo.connect(lfoGain).connect(g.gain);
    lfo.connect(lfoF).connect(f.frequency);
    const out = ctx.createGain(); out.gain.value = 1;
    src.connect(f).connect(g).connect(out).connect(this.musicBus);
    const t = ctx.currentTime;
    if (base) { base.offset.value = 0.11; base.connect(g.gain); base.start(t); }
    src.start(t); lfo.start(t);
    this._track(out, [src, lfo, base].filter(Boolean));
    const drone = () => {
      if (this.preset !== 'ocean') return;
      const s = this.ctx.currentTime + 0.05;
      [36, 43, 52].forEach((m, k) => this._pad(midi(m), s + k * 0.4, 18, 0.028, 'sine', 700));
      this._later(drone, 17000);
    };
    const gull = () => {
      if (this.preset !== 'ocean') return;
      const m = 79 + PENTA[Math.floor(Math.random() * 5)];
      this._bell(midi(m), this.ctx.currentTime + 0.05, 0.016, 6);
      this._later(gull, 5000 + Math.random() * 7000);
    };
    drone(); this._later(gull, 4000);
  }

  // 晨光花園 Dawn Garden — gentle arpeggiated music-box over a soft pad
  _dawn() {
    const prog = [[60, 64, 67, 72, 76], [57, 60, 64, 69, 72], [53, 57, 60, 65, 69], [55, 59, 62, 67, 74]];
    let bar = 0;
    const play = () => {
      if (this.preset !== 'dawn') return;
      const t = this.ctx.currentTime + 0.05;
      const ch = prog[bar % prog.length];
      this._pad(midi(ch[0] - 12), t, 7.6, 0.035, 'sine', 900);
      this._pad(midi(ch[2] - 12), t + 0.2, 7.6, 0.022, 'sine', 900);
      const order = [0, 2, 1, 3, 4, 3, 2, 1];
      order.forEach((n, k) => { if (Math.random() < 0.88) this._bell(midi(ch[n] + 12), t + k * 0.95 + Math.random() * 0.04, 0.022, 3.6); });
      bar++;
      this._later(play, 7600);
    };
    play();
  }

  _custom() {
    if (!this.customUrl) return;
    if (!this.customEl) {
      this.customEl = new Audio();
      this.customEl.loop = true;
      this.customEl.crossOrigin = 'anonymous';
      try { this.customNode = this.ctx.createMediaElementSource(this.customEl); this.customNode.connect(this.master); } catch { /* fallback to element output */ }
    }
    clearInterval(this.fadeIv);
    if (this.customEl.src !== this.customUrl) this.customEl.src = this.customUrl;
    this.customEl.volume = 1;
    this.customEl.play().catch(() => {});
  }

  // Touch chime: x (0..1) picks pentatonic degree, y (0..1) picks octave
  chime(x, y, chord = false) {
    if (!this.chimeOn || !this.ensure()) return;
    const deg = Math.min(9, Math.floor(x * 10));
    const oct = y < 0.33 ? 84 : y < 0.66 ? 72 : 60;
    const m = oct + PENTA[deg % 5] + (deg >= 5 ? 12 : 0) - (oct === 84 ? 12 : 0);
    const t = this.ctx.currentTime + 0.01;
    this._bell(midi(m), t, 0.11, 2.8, this.sfxBus);
    if (chord) {
      this._bell(midi(m + 7), t + 0.09, 0.07, 3.2, this.sfxBus);
      this._bell(midi(m + 12), t + 0.18, 0.06, 3.6, this.sfxBus);
    }
  }
}
