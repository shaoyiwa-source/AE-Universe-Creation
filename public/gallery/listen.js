// AE Shinity — sound reaction (R8). Listens through the microphone and reacts with champagne-gold light.
// Privacy: audio is analysed on this device only, frame by frame; nothing is recorded, stored or uploaded.
//   clap  → a sharp, broadband transient          → gold burst + ring
//   voice → sustained, tonal, mid-frequency sound  → the work's inner light rises with the voice
//   music → sustained, broad sound with beats      → gold halo pulses on the beat
// Intensity is reported in five tiers (1–5) from the loudness.

// ---------- beat lock (like stage lasers in "sound active" mode, but phase-locked) ----------
// Kick onsets are timed on the audio thread (AudioWorklet, ~3 ms resolution). From a few steady kicks the tempo and
// the phase of the beat are found; then each next beat is PREDICTED and the light fires on it — not after hearing it.
// Every new kick nudges phase and tempo (a phase-locked loop); a new song re-locks; silence lets go.
const ONSET_WORKLET = `class AeOnset extends AudioWorkletProcessor {
  constructor() { super(); this.slow = 1e-5; this.hold = 0; this.prev = 0; this.prev2 = 0; this.prev3 = 0; this.prev4 = 0; this.pk = 0; this.pkT = 0; this.pkLeft = 0; this.floor = 2e-6; this.done = false;
    this.port.onmessage = (e) => { if (e.data && e.data.stop) this.done = true; else if (e.data && e.data.kickFloor) this.floor = e.data.kickFloor; }; }
  process(inputs) {
    if (this.done) return false;
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      let e = 0; for (let i = 0; i < ch.length; i++) e += ch[i] * ch[i]; e /= ch.length;
      const blockDur = ch.length / sampleRate;
      this.hold = Math.max(0, this.hold - blockDur);
      if (this.pkLeft > 0) { this.pk = Math.max(this.pk, e); if (--this.pkLeft === 0) this.port.postMessage({ peakOf: this.pkT, e: this.pk }); }
      // relative to the room's own bass level (quiet music, laptop and phone mics with little bass), never to digital zero
      const recent = Math.max(this.prev, this.prev2, this.prev3, this.prev4);
      if (e > Math.max(this.slow, this.floor) * 4 && e > recent * 1.8 && this.hold <= 0) { this.port.postMessage({ t: currentTime, e }); this.hold = 0.18; this.pk = e; this.pkT = currentTime; this.pkLeft = 8; }
      this.slow += (e - this.slow) * Math.min(1, blockDur / 0.6);
      this.prev4 = this.prev3; this.prev3 = this.prev2; this.prev2 = this.prev; this.prev = e;
    }
    return true;
  }
}
registerProcessor('ae-onset', AeOnset);
// claps, finger snaps, knocks: any sharp, bright sound (like an LED strip's "sound active" mode, but timed precisely)
class AeTransient extends AudioWorkletProcessor {
  constructor() { super(); this.slow = 1e-6; this.hold = 0; this.prev = 0; this.prev2 = 0; this.prev3 = 0; this.prev4 = 0; this.pk = 0; this.pkT = 0; this.pkLeft = 0; this.k = 5; this.floor = 2e-6;
    this.done = false;
    this.port.onmessage = (e) => { if (e.data && e.data.stop) this.done = true; else if (e.data && e.data.k) { this.k = e.data.k; this.floor = e.data.floor; } }; }
  process(inputs) {
    if (this.done) return false;
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      let e = 0; for (let i = 0; i < ch.length; i++) e += ch[i] * ch[i]; e /= ch.length;
      const blockDur = ch.length / sampleRate;
      this.hold = Math.max(0, this.hold - blockDur);
      const recent = Math.max(this.prev, this.prev2, this.prev3, this.prev4); // the last ~10 ms: a dropout (one empty block) is not a jump
      if (this.pkLeft > 0) { this.pk = Math.max(this.pk, e); if (--this.pkLeft === 0) this.port.postMessage({ peakOf: this.pkT, e: this.pk }); }
      if (e > Math.max(this.slow, this.floor) * this.k && e > recent * 2.2 && this.hold <= 0) { this.port.postMessage({ t: currentTime, e }); this.hold = 0.09; this.pk = e; this.pkT = currentTime; this.pkLeft = 4; }
      this.slow += (e - this.slow) * Math.min(1, blockDur / 0.4);
      this.prev4 = this.prev3; this.prev3 = this.prev2; this.prev2 = this.prev; this.prev = e;
    }
    return true;
  }
}
registerProcessor('ae-transient', AeTransient);`;

// 16 bands from bass to treble (40 Hz – 12 kHz, log-spaced), each following its own loudness so music at any volume
// makes the light dance: fast attack, softer fall, like an equaliser. Used for the microphone and for our own music.
export function makeBands() { return { bands: new Float32Array(16), pk: new Float32Array(16).fill(-60), fl: new Float32Array(16).fill(-90) }; }
export function updateBands(st, freq, binHz, dt) {
  for (let b = 0; b < 16; b++) {
    const f0 = 40 * Math.pow(300, b / 16), f1 = 40 * Math.pow(300, (b + 1) / 16);
    const i0 = Math.max(2, Math.floor(f0 / binHz)), i1 = Math.max(i0 + 1, Math.ceil(f1 / binHz));
    let e = 0, k = 0; for (let i = i0; i < i1 && i < freq.length; i++) { e += Math.pow(10, Math.max(-140, freq[i]) / 10); k++; }
    const bdb = 10 * Math.log10(e / Math.max(1, k) + 1e-14);
    st.pk[b] = Math.max(bdb, st.pk[b] - dt * 6);   // the band's recent peak (falls 6 dB/s)
    st.fl[b] = Math.min(bdb, st.fl[b] + dt * 3);   // and its floor (rises 3 dB/s)
    const span = Math.max(12, st.pk[b] - st.fl[b]);
    const v = Math.max(0, Math.min(1, (bdb - (st.pk[b] - span)) / span)) * (st.pk[b] > -95 ? 1 : 0);
    st.bands[b] = v > st.bands[b] ? v : st.bands[b] + (v - st.bands[b]) * Math.min(1, dt * 7);
  }
  return st.bands;
}

export class BeatLock {
  constructor() { this.reset(); }
  reset() { this.onsets = []; this.period = 0; this.next = 0; this.conf = 0; this.misses = 0; this.count = 0; this.lastBeat = -9; this.lastOnset = -9; this.emitted = []; this.recent = []; }
  get locked() { return this.conf >= 3 && this.period > 0; }
  get bpm() { return this.period ? 60 / this.period : 0; }
  // tempo from the recent kicks: every interval (and its halves/doubles) folded into 70–180 BPM, the strongest cluster wins
  _estimate(o = this.onsets) {
    if (o.length < 4) return 0;
    const hist = new Map();
    for (let i = 0; i < o.length; i++) for (let j = i + 1; j < Math.min(o.length, i + 5); j++) {
      let iv = (o[j] - o[i]) / (j - i); if (iv <= 0) continue;
      while (iv < 0.333) iv *= 2; while (iv > 0.857) iv /= 2;
      const bin = Math.round(iv * 200); // 5 ms bins
      for (const b of [bin - 1, bin, bin + 1]) hist.set(b, (hist.get(b) || 0) + (b === bin ? 1 : 0.5));
    }
    let best = 0, score = 0; for (const [b, v] of hist) if (v > score) { score = v; best = b; }
    // refine: mean of the intervals near the winner
    let sum = 0, n = 0;
    for (let i = 1; i < o.length; i++) { let iv = o[i] - o[i - 1]; if (iv <= 0) continue; while (iv < 0.333) iv *= 2; while (iv > 0.857) iv /= 2; if (Math.abs(iv - best / 200) < 0.012) { sum += iv; n++; } }
    return n ? sum / n : best / 200;
  }
  // the hits that sit on a grid of period p through t, and a straight-line fit through them (exact tempo and phase)
  _fit(list, p, t) {
    let fit = 0, sk = 0, sx = 0, skk = 0, skx = 0;
    for (const x of list) { const k = Math.round((x - t) / p); if (Math.abs(x - t - k * p) < p * 0.08) { fit++; sk += k; sx += x; skk += k * k; skx += k * x; } }
    const den = fit * skk - sk * sk, P = den > 0 ? (fit * skx - sk * sx) / den : p;
    const period = Math.abs(P - p) < p * 0.05 ? P : p;
    return { fit, period, phase: fit ? (sx - period * sk) / fit : t };
  }
  _lockTo(f) { this.period = f.period; this.next = f.phase + f.period; this.conf = 3; this.misses = 0; this.recent = []; }
  onset(t, src = 'kick') {
    if (!(t > this.lastOnset)) return; // time only moves forward (and a repeated time must never stall the estimate)
    this.lastOnset = t; this.src = src;
    this.onsets.push(t); while (this.onsets.length > 16 || (this.onsets.length && t - this.onsets[0] > 10)) this.onsets.shift();
    if (!this.locked) {
      const p = this._estimate(); if (!p) return;
      const f = this._fit(this.onsets, p, t);
      // most of what was heard lately must sit on the grid: scattered claps or talking never lock
      const near = this.onsets.filter(x => t - x < p * 8.5), fn = this._fit(near, p, t).fit;
      if (f.fit >= 6 && fn >= near.length * 0.75) this._lockTo(f); // six on the grid: talking or a TV does not lock by chance
      return;
    }
    // a new song at a new tempo: the newest six hits agree on a different grid → re-lock at once (no slow drift)
    const last = this.onsets.slice(-6);
    if (last.length === 6) {
      const p = this._estimate(last);
      if (p && Math.abs(p - this.period) > this.period * 0.02 && Math.abs(p * 2 - this.period) > this.period * 0.04 && Math.abs(p - this.period * 2) > this.period * 0.04) {
        const f = this._fit(last, p, t); if (f.fit >= 6) { this._lockTo(f); return; }
      }
    }
    // locked: compare the kick with the nearest predicted beat and correct softly
    const k = Math.round((t - this.next) / this.period), pred = this.next + k * this.period, e = t - pred;
    if (Math.abs(e) < this.period * 0.18) {
      this.next += e * 0.35;                    // phase
      this.period += (e * 0.12) / Math.max(1, Math.abs(k) + 1); // tempo
      this.conf = Math.min(10, this.conf + 1); this.misses = 0; this.recent.push(1);
    } else { this.misses++; this.recent.push(0); }
    if (this.recent.length > 8) this.recent.shift();
    // the music (or the clapping) changed: half of the latest hits miss the grid → let go and find it again from the newest ones
    if (this.misses > 5 || (this.recent.length >= 6 && this.recent.filter(x => !x).length >= 4)) { this.conf = 0; this.period = 0; this.recent = []; this.onsets = this.onsets.slice(-3); }
  }
  // called every frame with the audio clock: fires the predicted beats (lead = how early to draw for display)
  tick(now, lead = 0.016) {
    let fired = false;
    if (!this.locked) return false;
    // silence lets go: music may pause for a break; claps stop for good sooner
    if (now - this.lastOnset > (this.src === 'clap' ? Math.max(1.2, this.period * 2.2) : Math.max(2.5, this.period * 5))) { this.conf = 0; this.period = 0; return false; } // silence: let go
    while (now + lead >= this.next) { this.lastBeat = this.next; this.emitted.push(this.next); if (this.emitted.length > 64) this.emitted.shift(); this.next += this.period; this.count++; fired = true; }
    return fired;
  }
  pulse(now) { return this.lastBeat > 0 ? Math.exp(-Math.max(0, now - this.lastBeat) / 0.11) : 0; }
}

export class Listener {
  constructor() { this.on = false; this.stats = { claps: 0, voice: 0, music: 0, beats: 0, maxTier: 0 }; }

  static supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext)); }

  // one start at a time; a stop while the microphone permission is still open cancels it (no microphone left running)
  start(ctx) {
    if (this.on) return Promise.resolve(true);
    if (this.starting) return this.starting;
    this.cancel = false;
    this.starting = this._start(ctx).finally(() => { this.starting = null; });
    return this.starting;
  }
  async _start(ctx) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    if (this.cancel) { stream.getTracks().forEach(t => t.stop()); return false; }
    this.stream = stream; const gen = this.gen = (this.gen || 0) + 1;
    this.ctx = ctx;
    this.src = ctx.createMediaStreamSource(this.stream);
    this.an = ctx.createAnalyser(); this.an.fftSize = 2048; this.an.smoothingTimeConstant = 0.2;
    this.src.connect(this.an); // analysis only — never routed to the speakers
    // precise kick onsets on the audio thread (low band only), for the beat lock
    this.lock = new BeatLock();
    try {
      if (!Listener.workletReady || Listener.workletCtx !== ctx) {
        const url = URL.createObjectURL(new Blob([ONSET_WORKLET], { type: 'text/javascript' }));
        await ctx.audioWorklet.addModule(url); Listener.workletReady = true; Listener.workletCtx = ctx;
      }
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 35;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140; lp.Q.value = 0.7;
      this.onsetNode = new AudioWorkletNode(ctx, 'ae-onset');
      const mute = ctx.createGain(); mute.gain.value = 0; // keeps the node running without sending anything to the speakers
      this.src.connect(hp).connect(lp).connect(this.onsetNode).connect(mute).connect(ctx.destination);
      this.onsetChain = [hp, lp, this.onsetNode, mute];
      // the microphone's own delay (when the browser reports it), so the beat lands when the kick is heard in the room
      const st = this.stream.getAudioTracks()[0]; const lat = st && st.getSettings ? Number(st.getSettings().latency) : NaN;
      this.inLat = Number.isFinite(lat) && lat > 0 && lat < 0.3 ? lat : 0.012;
      // a clap has a little low end and a kick has a little click: when both detectors fire together (±50 ms), the band
      // that dominates decides — mostly bass is a kick, mostly brightness is a clap. Decided 60 ms later, off the light's path.
      const near = (a, b) => Math.abs((a || -9) - b) < 0.05;
      this.onsetNode.port.onmessage = (ev) => {
        if (!this.on) return;
        if (ev.data.peakOf != null) { if (ev.data.peakOf === this.lastLowRaw) this.lastLowE = ev.data.e; return; }
        const t = ev.data.t; this.lastLowRaw = t; this.lastLowE = ev.data.e;
        setTimeout(() => {
          if (!this.on || this.gen !== gen || (near(this.lastHitRaw, t) && this.lastHitE > this.lastLowE * 2)) return; // a clap
          this.lastKickAt = t; this.lock.onset(t - this.inLat - LOCK_BIAS, 'kick');
        }, 60);
      };
      // the bright band: claps and snaps light the show at once; clapped in time, they become the beat too
      const hb = ctx.createBiquadFilter(); hb.type = 'highpass'; hb.frequency.value = 1500;
      this.hitNode = new AudioWorkletNode(ctx, 'ae-transient');
      const mute2 = ctx.createGain(); mute2.gain.value = 0;
      this.src.connect(hb).connect(this.hitNode).connect(mute2).connect(ctx.destination);
      this.onsetChain.push(hb, this.hitNode, mute2);
      // any sound at all — low thump, mid knock, high clap — flashes the light (like a multi-band LED controller):
      // three bands, each with its own sense of the room's level, so a loud bass never hides the hi-hat after it.
      // Triggers from different bands within 60 ms are one sound.
      const anyHit = (raw) => {
        if (!this.on || Math.abs(raw - (this.lastAnyRaw ?? -9)) < 0.06) return;
        this.lastAnyRaw = raw; const t = raw - this.inLat - LOCK_BIAS * 0.5;
        this.hitCount++; this.lastHit = t; this.hitTimes.push(t); if (this.hitTimes.length > 64) this.hitTimes.shift();
      };
      this.bandNodes = [];
      for (const [lo, hi] of [[40, 200], [200, 1500]]) {
        const a = ctx.createBiquadFilter(); a.type = 'highpass'; a.frequency.value = lo;
        const b2 = ctx.createBiquadFilter(); b2.type = 'lowpass'; b2.frequency.value = hi;
        const n = new AudioWorkletNode(ctx, 'ae-transient'), m = ctx.createGain(); m.gain.value = 0;
        this.src.connect(a).connect(b2).connect(n).connect(m).connect(ctx.destination);
        this.onsetChain.push(a, b2, n, m); this.bandNodes.push(n);
        n.port.onmessage = (ev) => { if (ev.data.peakOf == null) anyHit(ev.data.t); };
      }
      this.anyHit = anyHit;
      this.setSensitivity(this.sensitivity || 2);
      this.hitCount = this.hitCount || 0; this.hitTimes = this.hitTimes || []; // only ever counts up (the lights compare with what they saw)
      this.hitNode.port.onmessage = (ev) => {
        if (!this.on) return;
        if (ev.data.peakOf != null) { if (ev.data.peakOf === this.lastHitRaw) this.lastHitE = ev.data.e; return; }
        const raw = ev.data.t; this.lastHitRaw = raw; this.lastHitE = ev.data.e;
        this.anyHit(raw); // the bright band is one of the three
        const t = raw - this.inLat - LOCK_BIAS * 0.5;
        setTimeout(() => { // decided after the bass's own peak is known (one sound never feeds the lock twice)
          if (!this.on || this.gen !== gen || (near(this.lastLowRaw, raw) && this.lastLowE * 2 >= this.lastHitE)) return; // a kick's click, not a clap
          if (!(this.lastKickAt > raw - 3)) this.lock.onset(t, 'clap'); // no drum in the room: the claps keep the time
        }, 90);
      };
    } catch { this.onsetNode = null; } // no AudioWorklet: the light still follows the (frame-timed) kicks
    this.time = new Float32Array(this.an.fftSize);
    this.freq = new Float32Array(this.an.frequencyBinCount);
    this.slow = 0.002; this.fast = 0; this.low = 0; this.lowSlow = 0.0005;
    this.sustain = 0; this.cool = 0; this.beatCool = 0; this.kind = null; this.level = 0;
    this.on = true;
    if (this.cancel) { this.stop(); return false; } // turned off while the audio modules were loading
    return true;
  }

  // 1 = only clear claps, 2 = claps and snaps (default), 3 = every little knock
  setSensitivity(level) {
    this.sensitivity = level;
    const k = level >= 3 ? 3.5 : level <= 1 ? 8 : 5, floor = level >= 3 ? 6e-7 : level <= 1 ? 2e-5 : 2e-6;
    for (const n of [this.hitNode, ...(this.bandNodes || [])]) if (n) n.port.postMessage({ k, floor });
    if (this.onsetNode) this.onsetNode.port.postMessage({ kickFloor: floor });
  }

  // after the audio clock stood still (app in the background, a call): the old beat phase means nothing any more
  resync() { if (this.lock) this.lock.reset(); this.lastKickAt = this.lastAnyRaw = this.lastLowRaw = this.lastHitRaw = undefined; }

  stop() {
    this.cancel = true; // a start still waiting for permission will not open the microphone
    if (!this.on) return;
    this.gen = (this.gen || 0) + 1; // late decisions of this session are ignored
    for (const n of [this.onsetNode, this.hitNode, ...(this.bandNodes || [])]) if (n) { try { n.port.postMessage({ stop: true }); n.port.onmessage = null; } catch { /* ignore */ } }
    this.onsetNode = this.hitNode = null; this.bandNodes = [];
    this.resync();
    try { this.src.disconnect(); } catch { /* ignore */ }
    (this.onsetChain || []).forEach(n => { try { n.disconnect(); } catch { /* ignore */ } }); this.onsetChain = null;
    if (this.lock) this.lock.reset();
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
    if (!this.bandState) this.bandState = makeBands();
    this.bands = updateBands(this.bandState, this.freq, binHz, dt);
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
    // the locked beat (predicted, on time) when the room plays steady music
    let lockBeat = false, locked = false, bpm = 0, pulse = 0;
    if (this.lock && this.onsetNode) { lockBeat = this.lock.tick(this.ctx.currentTime, this.lead || 0.016); locked = this.lock.locked; bpm = this.lock.bpm; pulse = this.lock.pulse(this.ctx.currentTime); if (lockBeat) this.stats.lockBeats = (this.stats.lockBeats || 0) + 1; }
    return { level: this.level, tier, kind, clap, beat, lockBeat, locked, bpm, lockCount: this.lock ? this.lock.count : 0, pulse, hitCount: this.hitCount || 0, hitAge: this.lastHit ? this.ctx.currentTime - this.lastHit : 9, kickAge: this.lastKickAt ? this.ctx.currentTime - this.lastKickAt : 99 };
  }
}
// detection bias of the onset detector (energy rises over a block or two) — calibrated in tests/lock.test.mjs
export const LOCK_BIAS = 0.012;
