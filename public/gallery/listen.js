// AE Lumina Wall — sound reaction (R8). Listens through the microphone and reacts with champagne-gold light.
// Privacy: audio is analysed on this device only, frame by frame; nothing is recorded, stored or uploaded.
//   clap  → a sharp, broadband transient          → gold burst + ring
//   voice → sustained, tonal, mid-frequency sound  → the work's inner light rises with the voice
//   music → sustained, broad sound with beats      → gold halo pulses on the beat
// Intensity is reported in five tiers (1–5) from the loudness.

export class Listener {
  constructor() { this.on = false; this.stats = { claps: 0, voice: 0, music: 0, beats: 0, maxTier: 0 }; }

  static supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext)); }

  async start(ctx) {
    if (this.on) return true;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    this.ctx = ctx;
    this.src = ctx.createMediaStreamSource(this.stream);
    this.an = ctx.createAnalyser(); this.an.fftSize = 2048; this.an.smoothingTimeConstant = 0.2;
    this.src.connect(this.an); // analysis only — never routed to the speakers
    this.time = new Float32Array(this.an.fftSize);
    this.freq = new Float32Array(this.an.frequencyBinCount);
    this.slow = 0.002; this.fast = 0; this.low = 0; this.lowSlow = 0.0005;
    this.sustain = 0; this.cool = 0; this.beatCool = 0; this.kind = null; this.level = 0;
    this.on = true;
    return true;
  }

  stop() {
    if (!this.on) return;
    try { this.src.disconnect(); } catch { /* ignore */ }
    this.stream.getTracks().forEach(t => t.stop());
    this.on = false; this.level = 0; this.kind = null;
  }

  // call once per frame; returns { level 0..1, tier 0..5, kind, clap, beat }
  update(dt) {
    if (!this.on) return { level: 0, tier: 0, kind: null, clap: false, beat: false };
    const an = this.an, sr = this.ctx.sampleRate;
    an.getFloatTimeDomainData(this.time);
    let sum = 0; for (let i = 0; i < this.time.length; i++) sum += this.time[i] * this.time[i];
    const rms = Math.sqrt(sum / this.time.length);
    an.getFloatFrequencyData(this.freq);
    const binHz = sr / an.fftSize;
    let total = 0, hi = 0, mid = 0, low = 0, cen = 0, logSum = 0, n = 0;
    for (let i = 2; i < this.freq.length; i++) {
      const db = Math.max(-140, this.freq[i]); const p = Math.pow(10, db / 10); const f = i * binHz;
      total += p; cen += p * f; logSum += db * Math.LN10 / 10; n++;
      if (f >= 2500) hi += p; if (f >= 250 && f < 3000) mid += p; if (f >= 30 && f < 95) low += p; // kick-drum band (below most voices)
    }
    const centroid = total > 0 ? cen / total : 0;
    const flat = total > 0 ? Math.min(1, Math.exp(logSum / n) / (total / n)) : 0; // 0 tonal … 1 noisy
    const hiRatio = total > 0 ? hi / total : 0, midRatio = total > 0 ? mid / total : 0;

    this.fast = rms;
    const db = 20 * Math.log10(rms + 1e-9);
    const level = Math.max(0, Math.min(1, (db + 58) / 46));
    this.level += (level - this.level) * Math.min(1, dt * 10);
    const tier = this.level < 0.1 ? 0 : Math.min(5, Math.ceil(this.level * 5));

    this.cool = Math.max(0, this.cool - dt); this.beatCool = Math.max(0, this.beatCool - dt);
    const onset = rms > this.slow * 3 && rms > 0.02;
    let clap = false, beat = false;
    if (onset && this.cool <= 0 && hiRatio > 0.18 && flat > 0.12) { clap = true; this.cool = 0.16; this.stats.claps++; }
    // low-band beat (kick drum) for music
    this.lowSlow += (low - this.lowSlow) * Math.min(1, dt * 1.5);
    const lowShare = total > 0 ? low / total : 0;
    this.clock = (this.clock || 0) + dt;
    if (low > this.lowSlow * 2.4 && lowShare > 0.35 && level > 0.25 && this.beatCool <= 0) {
      // a kick only counts as a musical beat when it repeats at a steady tempo (speech is not rhythmic like a drum)
      this.beatCool = 0.25;
      const iv = this.clock - (this.lastBeatAt ?? -9); this.lastBeatAt = this.clock;
      if (iv > 0.25 && iv < 1.25 && this.lastIv && Math.abs(iv - this.lastIv) < this.lastIv * 0.25) { beat = true; this.stats.beats++; }
      this.lastIv = iv;
    }
    this.slow += (rms - this.slow) * Math.min(1, dt * 2.2);

    this.sustain = level > 0.22 && !clap ? this.sustain + dt : Math.max(0, this.sustain - dt * 2);
    this.recentBeat = beat ? 1.5 : Math.max(0, (this.recentBeat || 0) - dt);
    let kind = null;
    if (this.sustain > 0.25) {
      const tonalVoice = flat < 0.25 && centroid > 120 && centroid < 2800 && midRatio > 0.4;
      kind = this.recentBeat <= 0 && tonalVoice ? 'voice' : 'music';
    }
    this.lastFeat = { centroid: Math.round(centroid), flat: +flat.toFixed(3), hi: +hiRatio.toFixed(2), mid: +midRatio.toFixed(2), level: +this.level.toFixed(2) };
    if (kind === 'voice') this.stats.voice++; else if (kind === 'music') this.stats.music++;
    if (clap) kind = 'clap';
    this.kind = kind;
    this.stats.maxTier = Math.max(this.stats.maxTier, tier);
    return { level: this.level, tier, kind, clap, beat };
  }
}
