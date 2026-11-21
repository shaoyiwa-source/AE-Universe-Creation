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
      this.comp = comp;
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this._impulse(4.2, 2.6);
      this.wet = ctx.createGain(); this.wet.gain.value = 0.55;
      this.reverb.connect(this.wet).connect(this.master);
      this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0;
      this.musicBus.connect(this.master);
      this.musicBus.connect(this.reverb);
      this.beatBus = ctx.createGain(); this.beatBus.gain.value = 0; // dry (no reverb) for rhythm
      this.beatBus.connect(this.master);
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

  // A MediaStream of everything we play (music + chimes) — used to put sound into recorded clips
  captureStream() {
    if (!this.ensure()) return null;
    if (!this.capDest) { this.capDest = this.ctx.createMediaStreamDestination(); this.comp.connect(this.capDest); }
    return this.capDest.stream;
  }

  setVolume(v) {
    this.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  // src: a URL string (AE cloud track) or a Blob
  setCustom(src) {
    if (this.customUrl && this._ownUrl) URL.revokeObjectURL(this.customUrl);
    this._ownUrl = !!src && typeof src !== 'string';
    this.customUrl = !src ? null : typeof src === 'string' ? src : URL.createObjectURL(src);
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
    this.beatBus.gain.cancelScheduledValues(t);
    this.beatBus.gain.setValueAtTime(this.beatBus.gain.value, t);
    this.beatBus.gain.linearRampToValueAtTime(preset === 'pulse' ? 1 : 0, t + 2);
    if (preset === 'hall') this._hall();
    else if (preset === 'nature') this._nature();
    else if (preset === 'lounge') this._lounge();
    else if (preset === 'pulse') this._pulse();
    else if (preset === 'celestial') this._celestial();
    else if (preset === 'ocean') this._ocean();
    else if (preset === 'dawn') this._dawn();
    else if (preset === 'custom') this._custom();
  }

  stop(immediate = false) {
    this.timers.forEach(clearTimeout); this.timers = [];
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const fade = immediate ? 0.6 : 2;
    this.beatBus.gain.cancelScheduledValues(t);
    this.beatBus.gain.setValueAtTime(this.beatBus.gain.value, t);
    this.beatBus.gain.linearRampToValueAtTime(0, t + fade);
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

  _noise(seconds = 4) {
    if (this._noiseBuf) return this._noiseBuf;
    const ctx = this.ctx, len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2) * 0.9 + w * 0.04; }
    }
    return (this._noiseBuf = buf);
  }

  // 展廳迴響 Gallery Hall — almost silent, very slow drones and rare distant bells
  _hall() {
    const chords = [[36, 43, 52, 59], [33, 40, 48, 55], [29, 36, 45, 52], [31, 38, 47, 55]];
    let i = 0;
    const step = () => {
      if (this.preset !== 'hall') return;
      const t = this.ctx.currentTime + 0.05;
      chords[i % chords.length].forEach((m, k) => this._pad(midi(m + 12), t + k * 0.6, 17, k === 0 ? 0.03 : 0.018, 'sine', 800));
      i++; this._later(step, 16000);
    };
    const bell = () => {
      if (this.preset !== 'hall') return;
      this._bell(midi(72 + PENTA[Math.floor(Math.random() * 5)]), this.ctx.currentTime + 0.05, 0.014, 7);
      this._later(bell, 7000 + Math.random() * 8000);
    };
    step(); this._later(bell, 5000);
  }

  // 自然療癒 Nature — flowing stream, wind gusts and wind chimes
  _nature() {
    const ctx = this.ctx, t = ctx.currentTime;
    const out = ctx.createGain(); out.gain.value = 1; out.connect(this.musicBus);
    // stream
    const s1 = ctx.createBufferSource(); s1.buffer = this._noise(); s1.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.9;
    const sg = ctx.createGain(); sg.gain.value = 0.12;
    s1.connect(bp).connect(sg).connect(out);
    const s2 = ctx.createBufferSource(); s2.buffer = this._noise(); s2.loop = true; s2.playbackRate.value = 0.83;
    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 900;
    const sg2 = ctx.createGain(); sg2.gain.value = 0.09;
    s2.connect(lp2).connect(sg2).connect(out);
    // wind
    const w = ctx.createBufferSource(); w.buffer = this._noise(); w.loop = true; w.playbackRate.value = 0.6;
    const wl = ctx.createBiquadFilter(); wl.type = 'bandpass'; wl.frequency.value = 420; wl.Q.value = 0.5;
    const wg = ctx.createGain(); wg.gain.value = 0.02;
    w.connect(wl).connect(wg).connect(out);
    s1.start(t); s2.start(t + 0.7); w.start(t + 1.3);
    this._track(out, [s1, s2, w]);
    const babble = () => {
      if (this.preset !== 'nature') return;
      const n = this.ctx.currentTime;
      bp.frequency.setTargetAtTime(1300 + Math.random() * 1700, n, 0.05);
      sg.gain.setTargetAtTime(0.08 + Math.random() * 0.07, n, 0.07);
      this._later(babble, 90 + Math.random() * 140);
    };
    const chimes = (count) => {
      const n = this.ctx.currentTime + 0.05;
      for (let k = 0; k < count; k++) {
        const m = 84 + PENTA[Math.floor(Math.random() * 5)] + (Math.random() < 0.35 ? 12 : 0);
        this._bell(midi(m), n + k * (0.12 + Math.random() * 0.35), 0.018 + Math.random() * 0.02, 6.5);
      }
    };
    const gust = () => {
      if (this.preset !== 'nature') return;
      const n = this.ctx.currentTime, peak = 0.08 + Math.random() * 0.1, up = 2.5 + Math.random() * 2;
      wg.gain.cancelScheduledValues(n); wg.gain.setValueAtTime(wg.gain.value, n);
      wg.gain.linearRampToValueAtTime(peak, n + up); wg.gain.linearRampToValueAtTime(0.02, n + up + 4 + Math.random() * 3);
      wl.frequency.setTargetAtTime(500 + Math.random() * 600, n, up / 2);
      wl.frequency.setTargetAtTime(380, n + up, 2);
      this._later(() => { if (this.preset === 'nature') chimes(3 + Math.floor(Math.random() * 4)); }, up * 1000 - 400);
      this._later(gust, 9000 + Math.random() * 9000);
    };
    const drone = () => {
      if (this.preset !== 'nature') return;
      const n = this.ctx.currentTime + 0.05;
      [48, 55, 64].forEach((m, k) => this._pad(midi(m), n + k * 0.8, 20, 0.014, 'sine', 700));
      this._later(drone, 19000);
    };
    babble(); drone(); this._later(gust, 2500); this._later(() => chimes(2), 6000);
  }

  // 大廳雅韻 Lounge — warm electric-piano ninth chords with a soft walking bass
  _ep(freq, when, level, decay = 4) {
    const ctx = this.ctx, g = ctx.createGain();
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o.type = 'sine'; o2.type = 'sine'; o.frequency.value = freq; o2.frequency.value = freq * 2.001; g2.gain.value = 0.22;
    const trem = ctx.createOscillator(), tg = ctx.createGain(); trem.frequency.value = 4.6; tg.gain.value = level * 0.18;
    trem.connect(tg).connect(g.gain);
    o.connect(g); o2.connect(g2).connect(g); g.connect(this.musicBus);
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(level, when + 0.012);
    g.gain.exponentialRampToValueAtTime(level * 0.25, when + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    [o, o2, trem].forEach(x => { x.start(when); x.stop(when + decay + 0.1); });
    const v = this._track(g, [o, o2, trem]); o.onended = () => this.voices.delete(v);
  }
  _lounge() {
    const prog = [[50, 54, 57, 61, 64], [47, 50, 54, 57, 61], [43, 47, 50, 54, 57], [45, 49, 52, 55, 59]];
    let bar = 0;
    const play = () => {
      if (this.preset !== 'lounge') return;
      const t = this.ctx.currentTime + 0.05, ch = prog[bar % prog.length], beat = 0.95;
      ch.slice(1).forEach((m, k) => this._ep(midi(m), t + k * 0.03, 0.028, 4.2));
      ch.slice(2).forEach((m, k) => this._ep(midi(m), t + beat * 2.5 + k * 0.03, 0.018, 2.6));
      [0, 7, 12, 7].forEach((iv, k) => this._ep(midi(ch[0] - 12 + iv), t + k * beat, 0.04, 1.4));
      if (Math.random() < 0.6) this._bell(midi(ch[4] + 12), t + beat * 3, 0.012, 3.5);
      bar++; this._later(play, beat * 4 * 1000);
    };
    play();
  }

  // 夜光派對 Night Pulse — 116 BPM soft-house groove, still consonant with the touch chimes
  _kick(t) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.42, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g).connect(this.beatBus); o.start(t); o.stop(t + 0.4);
  }
  _hat(t, level) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this._noise();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(hp).connect(g).connect(this.beatBus); src.start(t, Math.random() * 3); src.stop(t + 0.06);
  }
  _bass(f, t, d) {
    const ctx = this.ctx, o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 420;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(lp).connect(g).connect(this.beatBus); o.start(t); o.stop(t + d + 0.05);
  }
  _pulse() {
    const ctx = this.ctx, beat = 60 / 116, sixteenth = beat / 4;
    const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    let next = ctx.currentTime + 0.15, step = 0;
    const sched = () => {
      if (this.preset !== 'pulse') return;
      while (next < this.ctx.currentTime + 0.35) {
        const s = step % 16, ch = prog[Math.floor(step / 16) % 4];
        if (s % 4 === 0) this._kick(next);
        if (s % 4 === 2) { this._hat(next, 0.07); this._bass(midi(ch[0] - 24), next, sixteenth * 1.8); }
        else if (s % 2 === 1) this._hat(next, 0.025);
        if (s === 0) ch.forEach((m, k) => this._pad(midi(m), next + k * 0.01, beat * 4 - 0.3, 0.02, 'triangle', 1500));
        if (s % 2 === 0 && Math.random() < 0.16) this._bell(midi(ch[Math.floor(Math.random() * 3)] + 24), next, 0.022, 1.4);
        next += sixteenth; step++;
      }
      this._later(sched, 90);
    };
    sched();
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
      try { this.customNode = this.ctx.createMediaElementSource(this.customEl); this.customNode.connect(this.master); } catch { /* fallback to element output */ }
    }
    clearInterval(this.fadeIv);
    const abs = new URL(this.customUrl, location.href).href;
    if (this.customEl.src !== abs) this.customEl.src = abs;
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
