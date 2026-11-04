/* 盛明 Eternal Sun — Premium Edition dynamic wallpaper (site v2476.76, Preview trial).
   ART RULE: the painting is a plain, untouched <img>. Every effect is a separate layer behind it
   (wall / back-glow / gold frame) or a toggleable overlay above it (LED, aura, UV, glints).
   With all effects off the painting pixels are exactly the original image. */
const $ = s => document.querySelector(s);
const Q = new URLSearchParams(location.search);
const SUN = { x: 0.515, y: 0.50 };            // sun focal point of the painting (normalized)
const AR0 = 1110 / 1536; let AR = AR0;
/* v2476.80 換畫 / 換歌: real AE works already hosted on the site (artwall works list, names as published there). No new / generated art or music. */
const ARTS = [
  { id: 'sun', zh: '盛明', en: 'Eternal Sun', src: '/assets/eternal-sun-canonical-1110x1536.jpg', thumb: '/assets/artwall/t-4e0991885a9649ea.webp', w: 1110, h: 1536, sun: [0.515, 0.5], looks: true },
  { id: 'flower-heart-bloom', en: 'Flower Heart Bloom', src: '/assets/selected-works-v2/flower-heart-bloom.webp', w: 1106, h: 1536,
    // v81 signature effect (data-driven): ♾️ ribbon joining the two hearts. a/b = heart centres located by eye on the original (fraction of width/height)
    fx: [{ type: 'infinity', a: [0.335, 0.508], b: [0.778, 0.41], sy: 1.15 }] },
  { id: 'heart-energy', en: 'Heart Energy', src: '/assets/selected-works-v2/heart-energy.webp', w: 1098, h: 1536 },
  { id: 'infinite-love-strength', en: 'Infinite Love Strength', src: '/assets/selected-works-v2/infinite-love-strength.webp', w: 1152, h: 1536 },
  { id: 'natures-strength', en: 'Nature’s Strength', src: '/assets/selected-works-v2/natures-strength.webp', w: 1096, h: 1536 },
  { id: 'heart-recovery', en: 'Heart Recovery', src: '/assets/selected-works-v2/heart-recovery.webp', w: 1040, h: 1536 },
  { id: 'love-embrace', en: 'Love Embrace', src: '/assets/selected-works-v2/love-embrace.webp', w: 1536, h: 1120 },
  { id: 'colorful-flow', en: 'Colorful Flow', src: '/assets/selected-works-v2/colorful-flow.webp', w: 1536, h: 1035 },
  { id: 'fun-universe', en: 'Fun Universe', src: '/assets/selected-works-v2/fun-universe.webp', w: 1536, h: 1025 },
  { id: 'marvellous-energy-world', en: 'Marvellous Energy World', src: '/assets/selected-works-v2/marvellous-energy-world.webp', w: 1536, h: 1043 },
  { id: 'expansion', en: 'Expansion', src: '/assets/selected-works-v2/expansion.webp', w: 1536, h: 1018 },
  { id: 'heart-rebuild', en: 'Heart Rebuild', src: '/assets/selected-works-v2/heart-rebuild.webp', w: 1536, h: 1014 },
  { id: 'heart-fly', en: 'Heart Fly', src: '/assets/selected-works-v2/heart-fly.webp', w: 1536, h: 1027 },
  { id: 'love-energy-field', en: 'Love Energy Field', src: '/assets/selected-works-v2/love-energy-field.webp', w: 1536, h: 1055 }
].map(a => ({ thumb: '/assets/artwall/t-' + a.id + '.webp', zh: a.en, ...a }));
const TRACKS = [ // only one distinct song is hosted (the homepage /media/aurelia-techno-eternal-148bpm.m4a is the same audio, sample-identical loudness curve)
  { id: 'eternal', zh: '盛明 Eternal Sun · Techno', en: 'Eternal Sun · Techno', src: '/player/eternal-sun/assets/ae-eternal-stream.m4a', beats: 'timeline', cue: 58.3 },
  { id: 'calm-ambient', zh: '靜謐漫步 Calm Ambient', en: 'Calm Ambient (lyrical)', src: '/premium/eternal-sun/assets/audio/calm-ambient-3-v84.m4a', beats: 'live', cue: 0, gain: 1.35, calm: true, credit: 'cynicmusic · CC0' } // v83: slow/lyrical test track (CC0, OpenGameArt cynicmusic)
];
if (Q.has('tracktest')) TRACKS.push({ id: 'live-test', zh: '測試 · 即時節拍分析', en: 'Test · live beat analysis', src: '/player/eternal-sun/assets/ae-eternal-stream.m4a', beats: 'live', cue: 0 });
const pickIdx = (list, key, q) => { const v = Q.get(q) || (() => { try { return localStorage.getItem(key); } catch (e) { return null; } })(); const i = list.findIndex(x => x.id === v); return i < 0 ? 0 : i; };
let ART = ARTS[pickIdx(ARTS, 'ae-premium-art', 'art')], TR = TRACKS[pickIdx(TRACKS, 'ae-premium-track', 'track')];
AR = ART.w / ART.h;
const S = {
  lang: Q.get('lang') === 'en' ? 'en' : 'zh', mode: 'natural', intensity: 0.7, speed: 1,
  frame: true, led: true, aura: true, glint: true, laser: false, bloom: true, rgbStyle: 'bar', lamp: 'auto', preset: 'home', look: '', impact: true,
  engine: 'webgl', playing: false, home: true,
  search: false, dip: true, tapfx: true, lw: (() => { try { return localStorage.getItem('ae-premium-lw84') || 'thin'; } catch (e) { return 'thin'; } })() /* v84: default 細 (new key so the v83 極細 default no longer sticks) */ // v75: 探照燈 / beat-dip / 雷射粗細
};
if (Q.get('fx') === '0') Object.assign(S, { search: false, dip: false, frame: false, led: false, aura: false, glint: false, laser: false, bloom: false });
if (['rgb', 'uv'].includes(Q.get('mode'))) S.mode = 'rgb'; 

/* ---------- i18n ---------- */
function applyLang() {
  document.documentElement.lang = S.lang === 'en' ? 'en' : 'zh-Hant';
  document.querySelectorAll('[data-zh]').forEach(el => { el.textContent = el.dataset[S.lang]; });
  $('#lang').textContent = S.lang === 'en' ? '中文' : 'EN';
  updatePlayLabel(); updateEngineNote();
}
function updatePlayLabel() {
  const d = $('#dplay'); if (d) { d.classList.toggle('playing', !!S.playing); d.setAttribute('aria-label', S.playing ? (S.lang === 'en' ? 'Pause' : '暫停') : (S.lang === 'en' ? 'Play' : '播放')); }
  const b = $('#play'); if (b) b.textContent = S.playing ? (S.lang === 'en' ? '❚❚ Pause' : '❚❚ 暫停') : b.dataset[S.lang];
}
function updateEngineNote() {
  $('#engine').textContent = (S.engine === 'webgl' ? 'WebGL' : 'Canvas 2D') + ' · ' +
    (S.lang === 'en' ? 'effects are overlays — the original painting is never altered' : '所有光效皆為圖層 · 原作畫面不做任何修改');
}

/* ---------- layout ---------- */
const L = { W: 0, H: 0, dpr: 1, p: { x: 0, y: 0, w: 0, h: 0 }, F: 10 };
function safeInsets() { let d = $('#sa80'); if (!d) { d = document.createElement('div'); d.id = 'sa80'; d.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0'; document.body.appendChild(d); } const cs = getComputedStyle(d); return { t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 }; }
function layout() {
  L.W = innerWidth; L.H = innerHeight; L.dpr = Math.min(devicePixelRatio || 1, 2);
  const portrait = L.H > L.W, sa = safeInsets();
  // v80: reserve the top (painting switcher) and bottom (play dock) bands so the painting's tap area never sits under a control
  const top = sa.t + (portrait ? 96 : 118), bot = sa.b + (portrait ? 156 : 158), mx = portrait ? 0.12 : 0.1;
  let w = L.W * (1 - mx), h = w / AR; const availH = Math.max(120, L.H - top - bot);
  if (h > availH) { h = availH; w = h * AR; }
  w = Math.round(w); h = Math.round(h);
  L.p = { x: Math.round((L.W - w) / 2), y: Math.round(top + (availH - h) / 2), w, h };
  L.F = Math.max(9, Math.round(w * 0.03));
  const a = $('#art').style;
  a.left = L.p.x + 'px'; a.top = L.p.y + 'px'; a.width = w + 'px'; a.height = h + 'px';
  for (const c of [$('#front'), $('#back'), $('#coin')]) { c.width = L.W * L.dpr; c.height = L.H * L.dpr; }
  if (gl) gl.resize(); 
}

/* ---------- audio / beat ---------- */
const CK = { base: 0, at: 0, last: -1, ok: 0, err: 0 };
// Output latency (v2476.64): read from an AudioContext created on the play gesture (not routed; reading only).
// Media elements and Web Audio share the same output device, so baseLatency + outputLatency is the delay from decoder to speaker.
const OM = (() => { const o = window.aePremiumOnsets; return o ? { sub: o.sub, st: o.subS, i: 0, n: 0, since: 9, hits: 0, last: -1 } : { sub: null }; })();
const SYNC = { off: (() => { try { const v = +localStorage.getItem('ae-premium-sync-ms'); return Number.isFinite(v) ? Math.max(-200, Math.min(200, v)) : 0; } catch (e) { return 0; } })() };
document.addEventListener('visibilitychange', () => { CK.ok = 0; });
const LAT = { ctx: null, v: 0, frame: 0.012, read: 0, src: 'none', override: null };
function measureLatency() {
  try { if (!LAT.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { LAT.ctx = new AC({ latencyHint: 'playback' }); LAT.ctx.resume && LAT.ctx.resume(); } } } catch (e) {}
  const c = LAT.ctx; if (!c) return; const o = Number(c.outputLatency) || 0, b = Number(c.baseLatency) || 0;
  LAT.out = o; LAT.base = b; LAT.src = o ? 'outputLatency+baseLatency' : (b ? 'baseLatency' : 'none'); LAT.v = Math.min(0.5, Math.max(0, o + b)); LAT.read = performance.now();
}
function latency() { if (LAT.override != null) return LAT.override; if (performance.now() - LAT.read > 2000) measureLatency(); return Math.max(0, LAT.v - LAT.frame); }
const QL = new URLSearchParams(location.search).get('lat'); if (QL != null && QL !== '' && !isNaN(+QL)) LAT.override = +QL / 1000;
const A = { count: 0, t: 0, phase: 0, ctx: null, an: null, buf: null, bass: 0, avg: 0, level: 0, lastKick: 0, kick: 0 };
const audio = $('#music');
for (const ev of ['waiting', 'stalled', 'seeking']) audio.addEventListener(ev, () => { CK.stall = 1; CK.ok = 0; });
for (const ev of ['playing', 'seeked', 'canplay']) audio.addEventListener(ev, () => { CK.stall = 0; CK.ok = 0; });

async function togglePlay() {
  const tnow = performance.now(); if (tnow - (A.tpAt || 0) < 250) return; A.tpAt = tnow; // v84: debounce double taps -> no duplicate starts
  // v83: back from the background the media element may still report playing while the WebAudio output is suspended/interrupted -> one tap = resume
  if (!audio.paused && A.mg && A.mg.c && A.mg.c.state !== 'running') { USER.want = true; try { A.mg.c.resume(); } catch (e) {} const p = audio.play(); if (p && p.catch) p.catch(() => {}); syncPlay(); return; }
  // v2476.69: start the media element FIRST, synchronously inside the tap (iOS Safari refuses play() issued after an await → stall)
  USER.want = audio.paused; if (audio.paused) try { routeMusic(); } catch (e) {}
  let early = null; if (audio.paused) { if (!A.started) { A.started = 1; startAtCue(); } try { early = audio.play(); if (early && early.catch) early.catch(() => {}); } catch (e) {} }
  measureLatency();
  if (TR.beats !== 'timeline' && !A.an) {
    ensureGraph(true);
    try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().catch(() => {}); } catch (e) {}
  }
  try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission && !A.asked) { A.asked = 1; DeviceOrientationEvent.requestPermission().catch(() => {}); } } catch (e) {}
  if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume().catch(() => {});
  if (early) { try { await early; } catch (e) {} syncPlay(); return; }
  if (audio.paused) { if (!A.started) { A.started = 1; startAtCue(); } try { await audio.play(); } catch (e) {} }
  else audio.pause();
  syncPlay();
}
// v2476.60: the button always mirrors the REAL audio state (iOS pauses media when you leave Safari) -> one tap resumes
const CUE = 58.3; // v2476.61: first play starts at the climax (0:58)
function startAtCue() { const go = () => { try { audio.currentTime = TR.cue || 0; } catch (e) {} }; if (audio.readyState >= 1) go(); else { go(); audio.addEventListener('loadedmetadata', go, { once: true }); } }
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
let seeking = false, progAt = 0;
function updateProg(now) { if (now - progAt < 250) return; progAt = now; const d = audio.duration; $('#tdur').textContent = Number.isFinite(d) ? fmt(d) : '0:00'; if (!seeking) { $('#tcur').textContent = fmt(audio.currentTime); $('#seek').value = Number.isFinite(d) && d > 0 ? Math.round(audio.currentTime / d * 1000) : 0; } }
const USER = { want: false }; const HID83 = { paused: 0 }; // v78: user's play intent; nothing may start the music unless the user asked for it
const MUSICVOL = 0.5; const mv84 = () => MUSICVOL * ((TR && TR.gain) || 1); // v84: per-track gain (quiet ambient track lifted)
 // v79: music -6 dB (v78 -3 dB) for kick headroom (iOS: via WebAudio gain, see routeMusic)
audio.addEventListener('play', () => { if (!USER.want) { try { audio.pause(); } catch (e) {} } });
audio.addEventListener('pause', () => { if (!document.hidden && !audio.ended) USER.want = false; }); // a pause while visible (button, headset, OS) = user paused
try { if (navigator.mediaSession) { navigator.mediaSession.setActionHandler('play', () => { USER.want = true; audio.play().catch(() => {}); }); navigator.mediaSession.setActionHandler('pause', () => { USER.want = false; audio.pause(); }); } } catch (e) {}
function ensureGraph(needAn) { // v80: ONE MediaElementSource for the element (a second one throws): src -> gain(MUSICVOL) -> out, + analyser tap for live-beat tracks
  const c = acx(); if (!A.src) { A.src = c.createMediaElementSource(audio); const g = c.createGain(); g.gain.value = mv84(); const fg = c.createGain(); fg.gain.value = audio.paused ? 0 : 1; A.src.connect(fg); fg.connect(g); g.connect(c.destination); A.mg = { g, c, fg }; audio.volume = 1; DUCK.base = null; }
  if (needAn && !A.an) { A.ctx = c; A.an = c.createAnalyser(); A.an.fftSize = 1024; A.an.smoothingTimeConstant = 0.5; const z = c.createGain(); z.gain.value = 0; A.src.connect(A.an); A.an.connect(z); z.connect(c.destination); A.buf = new Uint8Array(A.an.frequencyBinCount); }
  if (c.state === 'suspended') c.resume().catch(() => {}); }
function routeMusic() { // iOS ignores audio.volume -> put the element through a WebAudio gain (created inside the play gesture)
  if (A.mg && A.mg.g) { if (TR.beats !== 'timeline' && !A.an) try { ensureGraph(true); } catch (e) {} return; } audio.volume = mv84(); // v84: always via WebAudio gain so resume/hide can ramp (no pops)
  try { ensureGraph(false); } catch (e) { A.mg = { el: true }; } }
function syncPlay() { S.playing = !audio.paused && !audio.ended && !(A.mg && A.mg.c && (A.mg.c.state === 'suspended' || A.mg.c.state === 'interrupted') && document.hidden); updatePlayLabel(); }
// v83: leaving the app pauses the music for real (element paused, intent cleared) so the button shows ▶ and ONE tap resumes
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (!audio.paused) { USER.want = false; HID83.paused = 1; fade84(0, 0.12, 'hide'); clearTimeout(HID83.tm); HID83.tm = setTimeout(() => { if (document.hidden || !USER.want) try { audio.pause(); } catch (e) {} }, 140); } } else { clearTimeout(HID83.tm); if (!USER.want && !audio.paused) try { audio.pause(); } catch (e) {} fade84(0, 0, 'show-mute'); try { if (A.mg && A.mg.c && A.mg.c.state !== 'running' && A.mg.c.state !== 'closed') A.mg.c.resume().catch(() => {}); } catch (e) {} } syncPlay(); });
// v84: fade stage (src -> fg -> volume gain). Every start fades in ~250 ms; hide fades out before pausing; the context is never resumed with full gain.
var FADE84 = { log: [] };
function fade84(v, sec, why) { const m = A.mg; if (!m || !m.fg) return; try { const g = m.fg.gain, t = m.c.currentTime, from = g.value; g.cancelScheduledValues(t); g.setValueAtTime(from, t); if (sec > 0) g.linearRampToValueAtTime(v, t + sec); else g.setValueAtTime(v, t); FADE84.log.push({ t: Math.round(performance.now()), why, from: +from.toFixed(3), to: v, ms: Math.round(sec * 1000), ctx: m.c.state }); if (FADE84.log.length > 80) FADE84.log.shift(); } catch (e) {} }
audio.addEventListener('play', () => { if (USER.want) { fade84(0, 0, 'play-start'); fade84(1, 0.25, 'fade-in'); } });
addEventListener('pagehide', () => { fade84(0, 0, 'pagehide'); if (!audio.paused) { USER.want = false; HID83.paused = 1; try { audio.pause(); } catch (e) {} } });
['play', 'playing', 'pause', 'ended', 'emptied', 'stalled', 'suspend', 'waiting'].forEach(ev => audio.addEventListener(ev, syncPlay));
document.addEventListener('visibilitychange', syncPlay); addEventListener('pageshow', syncPlay); addEventListener('focus', syncPlay);
let rings = [];
// v2476.60: same pre-measured kick timeline + bass energy as the homepage sound-light (ae-home-beats.js / ae-home-light-energy.js).
// Driven by audio.currentTime, so it works on iPhone even when the live analyser returns silence.
const EN = window.aeHomeAudioEnergy, TL = window.aeHomeBeatTimeline;
const RH = EN && TL && TL.events ? EN.createRhythm(TL.events, TL.accents || [], TL.sections || []) : null;
function analyse(now) {
  let bass = 0;
  if (RH && TR.beats === 'timeline' && S.playing) {
    // v2476.60 sync: beat time = audio.currentTime every frame (smoothed between coarse currentTime updates, re-locked if off by >40 ms).
    // Independent of the Speed slider and of frame rate, so it cannot drift over long playback or after seeking / looping.
    const ct = audio.currentTime, rate = audio.playbackRate || 1;
    // v2476.64: phase-locked clock (slews toward every fresh currentTime instead of tolerating 40 ms before re-locking),
    // then shifted back by the measured output latency so lights land on what is HEARD, not what the decoder has reached.
    if (ct !== CK.last || !CK.ok) { const pred = CK.base + (now - CK.at) / 1000 * rate, d = ct - pred; if (!CK.ok || Math.abs(d) > 0.12 || ct < CK.last) { CK.base = ct; CK.at = now; } else { CK.base = pred + d * 0.2; CK.at = now; } CK.err = d; CK.last = ct; CK.ok = 1; }
    let tt = CK.base + (now - CK.at) / 1000 * rate; if (Math.abs(tt - ct) > 0.25) { CK.base = tt = ct; CK.at = now; }
    // v2476.65 robustness: never extrapolate while the element is seeking / buffering (the CUE seek on first play and
    // mobile stalls kept the old clock running ahead of the frozen audio), and never more than 0.35 s past the last real update.
    if (audio.seeking || audio.readyState < 3 || CK.stall) { CK.base = tt = ct; CK.at = now; }
    else if (tt - ct > 0.35) { CK.base = tt = ct; CK.at = now; }
    tt = Math.max(0, tt - latency() - SYNC.off / 1000); // + offset = lights later
    CK.tt = tt;
    A.t = tt; bass = Math.min(1, EN.energyAt(TL, tt));
    const b = RH.update(bass, tt);
    if (b.count < A.count) A.count = b.count; // loop / seek back
    if (b.beat) { A.count = b.count; onKick(now, 0.6 + 0.4 * bass); const hv75 = isHeavy(b, tt, bass); v75Beat(now, bass, hv75, b); if (hv75) { IMP.t = now; IMP.at = TL.events[b.count - 1]; IMP.n++; partyHeavy(now); } if (b.stage !== 'build' || b.accentBeat) { if (b.stage !== 'build') launchDepth(null, null, now, b.count); for (let i = 0; i < 3; i++) { musicSpots.push({ ...hpDest(i * 2, b.sweep, now), born: now }); } if (musicSpots.length > 9) musicSpots.splice(0, musicSpots.length - 9); } partyBeat(b, now); }
    A.b = b; A.since = b.count ? Math.max(0, tt - TL.events[b.count - 1]) : 9; // seconds since the last grid kick (audio time)
    A.bass = bass; A.level += (bass - A.level) * 0.25; A.kick = A.kickQ = Math.exp(-A.since / 0.095); // quarter-note kick (grid)
    // v2476.65 onset map: the builds accelerate to 8th/16th snare rolls and the bass goes double-time after each drop.
    // A quarter-only grid felt like the lights "could not keep up" as the music sped up, so every measured onset now punches too.
    if (OM.sub) { const ss = OM.sub; let k = OM.i; if (k > 0 && ss[k - 1] > tt) k = 0; while (k < ss.length && ss[k] <= tt) k++; OM.i = k;
      if (k) { const ds = tt - ss[k - 1]; OM.since = ds; OM.n = k; const sub = Math.exp(-ds / 0.075) * (0.35 + 0.4 * OM.st[k - 1]); if (ds < 0.012 && OM.last !== k) { OM.last = k; OM.hits++; } A.kick = Math.max(A.kick, sub); } } A.drop = b.dropPulse || 0; A.phase = b.phase; return;
  }
  CK.ok = 0;
  if (TR.beats !== 'timeline' && S.playing) { liveBeat83(now); return; }
  {
    // idle: slow breathing, a gentle ring every ~3.2 s
    bass = 0.25 + 0.15 * Math.sin(now / 900);
    if (now - A.lastKick > 3200 / S.speed) onKick(now, 0.5);
  }
  A.bass = bass; A.level += (bass - A.level) * 0.15;
  A.kick *= 0.9;
}
/* v83 live beat tracker for every track without a beat map (imported songs, Calm Ambient).
   Root cause of the v80-82 "floating cities" bug: onsets were only accepted when the <140 Hz bass jumped 15 % + 0.03 above its
   own slow average. Slow/ambient songs have a sustained bass pad (no kick transients) -> zero beats while playing, so lamps,
   pulses and RGB (which step on beats) froze; with the music stopped the idle clock kept animating them.
   Now: broadband + bass spectral flux with an adaptive (mean + k·sd) threshold, an inter-onset tempo estimator (reset per song),
   and a phase-locked beat "flywheel" on audio.currentTime so visuals keep the song's tempo between soft onsets, plus a
   clock fallback when the analyser returns silence (some iOS routes). */
function newLB83() { return { beat: false, count: 0, pulse: 0, phase: 0, interval: 0.6, stage: 'groove', dropPulse: 0, buildProgress: 0, accentCount: 0, sweep: 0, last: -9, grid: -9, pk: 0.3,
  fm: 0, fv: 0.0004, on: [], onsets: 0, bpm: 0, conf: 0, zero: 0, silent: 0, lvl: 0, lvlAvg: 0, prev: null, t0: -1, lastOn: -9, ct: -1, mode: 'onset' }; }
function tempo83(LB) { const o = LB.on; if (o.length < 5) return; const H = new Float32Array(68); // 0.33..1.0 s in 10 ms bins (60..180 BPM)
  for (let i = 0; i < o.length; i++) for (let j = i + 1; j < Math.min(o.length, i + 5); j++) { let v = o[j] - o[i]; if (v < 0.12 || v > 2.4) continue; while (v < 0.33) v *= 2; while (v > 1.0) v /= 2; const k = Math.round((v - 0.33) * 100); for (let d = -2; d <= 2; d++) if (k + d >= 0 && k + d < 68) H[k + d] += Math.exp(-d * d / 2) / (j - i); }
  let bk = 0; for (let k = 1; k < 68; k++) if (H[k] > H[bk]) bk = k; let tot = 0; for (let k = 0; k < 68; k++) tot += H[k];
  const iv = 0.33 + bk / 100; LB.conf = tot ? H[bk] / tot : 0; LB.interval += (iv - LB.interval) * (LB.bpm ? 0.25 : 1); LB.bpm = Math.round(60 / LB.interval); }
function liveBeat83(now) {
  const LB = A.lb || (A.lb = newLB83()), tt = audio.currentTime, dtA = LB.ct < 0 ? 0 : Math.max(0, Math.min(0.1, tt - LB.ct)); LB.ct = tt; A.t = tt; LB.beat = false;
  if (tt + 0.05 < LB.last) { LB.last = LB.grid = tt - LB.interval; LB.lastOn = tt - 1; } // loop / seek back
  let bass = 0, lvl = 0, flux = 0;
  if (A.an && A.buf) {
    if (A.an.smoothingTimeConstant !== 0.2) A.an.smoothingTimeConstant = 0.2;
    A.an.getByteFrequencyData(A.buf); const B = A.buf, hz = A.ctx.sampleRate / A.an.fftSize, nb = Math.max(2, Math.round(150 / hz)), nt = Math.min(B.length - 1, Math.round(6000 / hz));
    let sum = 0; for (let i = 1; i <= nb; i++) bass += B[i]; for (let i = 1; i <= nt; i++) sum += B[i]; bass /= nb * 255; lvl = sum / (nt * 255);
    const P = LB.prev || (LB.prev = new Uint8Array(B.length)); let fb = 0, ft = 0; for (let i = 1; i <= nt; i++) { const d = B[i] - P[i]; if (d > 0) { if (i <= nb) fb += d; ft += d; } } P.set(B);
    flux = 0.55 * fb / (nb * 255) + 0.45 * ft / (nt * 255) * 3;
    if (sum === 0 && dtA > 0) LB.zero += dtA; else if (sum > 0) LB.zero = 0;
    LB.silent = LB.zero > 1.5 ? 1 : 0;
  } else LB.silent = 1;
  if (dtA <= 0 && !LB.silent) { /* element clock not advancing (buffering) */ }
  // adaptive threshold on flux
  const d0 = flux - LB.fm; LB.fm += d0 * 0.03; LB.fv += (d0 * d0 - LB.fv) * 0.03; const sd = Math.sqrt(Math.max(1e-6, LB.fv));
  LB.lvl = lvl; LB.lvlAvg += (lvl - LB.lvlAvg) * 0.01;
  const onset = !LB.silent && dtA > 0 && flux > LB.fm + 1.2 * sd && flux > 0.003 && tt - LB.lastOn > Math.max(0.16, LB.interval * 0.45);
  if (onset) { LB.lastOn = tt; LB.onsets++; LB.on.push(tt); if (LB.on.length > 32) LB.on.shift(); if (LB.onsets >= 5) tempo83(LB); }
  // beat flywheel: ticks every interval on the song clock; onsets near a tick pull its phase
  if (LB.grid < 0 && onset) LB.grid = tt - LB.interval;
  if (LB.grid < -1) LB.grid = tt - LB.interval;
  if (onset) { const ph = tt - (LB.grid + LB.interval); if (Math.abs(ph) < LB.interval * 0.3) LB.grid += ph * 0.5; }
  if (dtA > 0 && tt >= LB.grid + LB.interval) { LB.grid = Math.max(LB.grid + LB.interval, tt - LB.interval * 0.25); LB.last = LB.grid; LB.count++; LB.beat = true; }
  if (LB.silent) { bass = 0.3 + 0.25 * Math.exp(-Math.max(0, tt - LB.last) / 0.2); lvl = bass; }
  const lv = Math.max(bass, lvl * 1.4); A.avg = A.avg * 0.96 + lv * 0.04; LB.pk = Math.max(lv, LB.pk * 0.995);
  if (LB.beat) { A.count = LB.count; const k = Math.min(1, 0.45 + lv); onKick(now, k); const heavy = !(V83 && V83.soft) && LB.count % 4 === 1 && lv > LB.pk * 0.7; v75Beat(now, lv, heavy, LB); if (heavy) { IMP.t = now; IMP.n++; partyHeavy(now); } if (LB.count % 2 === 0) launchDepth(null, null, now, LB.count); }
  const since = Math.max(0, tt - LB.last); LB.pulse = Math.exp(-since / 0.12); LB.phase = Math.min(1, since / LB.interval); LB.sweep = (LB.count % 8) / 8 + LB.phase / 8;
  A.b = LB; A.since = since; A.kick = A.kickQ = Math.exp(-since / 0.095); A.phase = LB.phase; A.bass = lv; A.level += (lv - A.level) * 0.25;
  if (window.__beatLog83) { const L8 = window.__beatLog83; if (LB.beat) L8.push({ t: +tt.toFixed(2), n: LB.count, bpm: LB.bpm, iv: +LB.interval.toFixed(3), on: LB.onsets, silent: LB.silent }); }
}
const IMP = { t: -1e9, n: 0, s: 1 };
const GROOVE = [[64.871, 116.79], [129.736, 1e9]];
function isHeavy(b, t, bass) { // v2476.62: heavy downbeats felt through the WHOLE song (bar downbeats with strong bass), strongest on the drops + climax grooves
  if ((b.dropPulse || 0) > 0.3) { IMP.s = 1; return true; }
  const g = GROOVE.find(r => t >= r[0] && t < r[1]), beatLen = 60 / 148.02;
  if (g) { const idx = Math.round((t - g[0]) / beatLen); if (idx % 4 === 0 && bass > 0.55) { IMP.s = 0.85; return true; } return false; }
  if (b.count % 4 === 0 && bass > 0.7) { IMP.s = 0.55; return true; }
  return false;
}
// impE: audio-time envelope while playing, shorter than one beat (0.405 s) so it never smears into the next kick
function impE(now) { if (!S.impact) return 0; const q = S.playing && IMP.at != null ? (A.t - IMP.at) / 0.34 : (now - IMP.t) / 650; return q < 0 || q > 1 ? 0 : (1 - q) * (1 - q) * (IMP.s || 1); }
function drawImpact(c, now) { // v2476.62: refined — soft light swell from the sun, gentle fading rays, slight brightness lift. No ripple rings.
  const e = impE(now); if (e <= 0.002) return;
  const p = L.p, cx = p.x + p.w * SUN.x, cy = p.y + p.h * SUN.y, I = 0.6 + 0.5 * S.intensity, R = p.w * (0.55 + 0.15 * e);
  c.save(); c.globalCompositeOperation = 'source-over';
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, `rgba(255,244,214,${0.42 * e * I})`); g.addColorStop(0.35, `rgba(255,226,170,${0.16 * e * I})`); g.addColorStop(1, 'rgba(255,220,160,0)');
  c.fillStyle = g; c.fillRect(0, 0, L.W, L.H);                                                   // lens-like glow swell from the sun
  c.globalAlpha = 0.07 * e * I; c.fillStyle = 'rgb(255,240,215)'; c.fillRect(p.x, p.y, p.w, p.h);  // slight overall brightness lift
  c.globalAlpha = 1; const n = 14, rot = (IMP.n * 0.37) % 6.2832;
  for (let i = 0; i < n; i++) { const an = rot + i * 6.2832 / n, len = p.w * (0.35 + 0.25 * ((i * 7) % 5) / 5);
    const lg = c.createLinearGradient(cx, cy, cx + Math.cos(an) * len, cy + Math.sin(an) * len); lg.addColorStop(0, `rgba(255,248,230,${0.22 * e * I})`); lg.addColorStop(1, 'rgba(255,248,230,0)');
    c.strokeStyle = lg; c.lineWidth = 1; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(an) * len, cy + Math.sin(an) * len); c.stroke(); } // fine fading rays
  c.restore();
}
function onKick(now, k) { A.lastKick = now; if (!S.playing) A.kick = 1; RG.beats++; const n = S.playing ? A.count : RG.beats; LZ.hit = now; if (S.laser && n % 8 === 0) LZ.pat = (LZ.pat + 1) % 3; if (S.glint) { sparkle(now, S.playing ? 1 : 1); if (S.playing && n % 16 === 0) sheen(now); } if (S.bloom && n % 4 === 0) autoBloom(now); }

/* ---------- pointer / tilt ---------- */
const T = { tx: 0, ty: 0, x: 0, y: 0, px: -1, py: -1 };
function onPointer(e) {
  T.tx = (e.clientX / L.W - 0.5) * 2; T.ty = (e.clientY / L.H - 0.5) * 2;
  T.px = e.clientX - L.p.x; T.py = e.clientY - L.p.y;
}
addEventListener('deviceorientation', e => {
  if (!Number.isFinite(e.gamma) || !Number.isFinite(e.beta)) return;
  T.tx = Math.max(-1, Math.min(1, e.gamma / 25)); T.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
});

/* ---------- RGB tri-colour light wash (restored from Light Player 三色照畫, /player/eternal-sun/ experience-lighting.js).
   Simulates red / green / blue-violet LED lamps shining on the painting (owner ref IMG_1681.MOV).
   The response images are built once into SEPARATE canvases and drawn on the #rgb overlay; the <img> is never touched. */
const LAMPS = ['green', 'red', 'blue'], LAMP_RGB = { red: [255, 120, 140], green: [85, 255, 125], blue: [120, 80, 255] };
const RG = { masks: {}, beats: 0, cur: 'green', from: 'green', changed: -1e9, lastKey: '' };
function lampResponse(r, g, b, c) {
  const fl = Math.max(0, g - r * .45 - b * .25), w = (r + g + b) / 3;
  if (c === 'red') return [r * .70 + g * .16 + b * .08 + 62, g * .36 + r * .14 + 26, b * .42 + r * .16 + 40]; // softer, paler red
  if (c === 'green') return [r * .30 + w * .1, g * .92 + w * .25 + fl * .25, b * .18];
  return [r * .22 + b * .25 + 20, g * .10 + fl * 1.25, b * .80 + r * .25 + w * .25 + 40];   // blue-violet: greens fluoresce
}
function buildRGB(img) {
  const w = AR >= 1 ? 768 : Math.round(768 * AR), h = AR >= 1 ? Math.round(768 / AR) : 768, t = document.createElement('canvas'); t.width = w; t.height = h;
  const x = t.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
  const src = x.getImageData(0, 0, w, h).data;
  for (const col of LAMPS) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const o = c.getContext('2d'), d = o.createImageData(w, h);
    for (let i = 0; i < src.length; i += 4) {
      const v = lampResponse(src[i], src[i + 1], src[i + 2], col);
      d.data[i] = Math.min(255, v[0]); d.data[i + 1] = Math.min(255, v[1]); d.data[i + 2] = Math.min(255, v[2]); d.data[i + 3] = 255;
    }
    o.putImageData(d, 0, 0); RG.masks[col] = c;
  }
  const rc = $('#rgb'); rc.width = w; rc.height = h;
}
function lampNow(now) {
  if (S.lamp !== 'auto') return S.lamp;
  const step = S.playing ? Math.floor(A.count / 2) : Math.floor(now * S.speed / 3500);
  return LAMPS[((step % 3) + 3) % 3];
}
function drawRGB(now) {
  const rc = $('#rgb'); const on = S.mode === 'rgb' && RG.masks.red;
  rc.classList.toggle('on', !!on); if (!on) return;
  const col = lampNow(now);
  if (col !== RG.cur) { RG.from = RG.cur; RG.cur = col; RG.changed = now; RG.changedT = A.t; }
  const mix = Math.min(1, S.playing ? Math.max(0, A.t - (RG.changedT || 0)) / 0.26 : (now - RG.changed) / 900), c = rc.getContext('2d'), op = k => (k === 'red' ? .78 : .86) * (0.55 + 0.5 * S.intensity);
  c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, rc.width, rc.height);
  if (mix < 1) { c.globalAlpha = op(RG.from) * (1 - mix); c.drawImage(RG.masks[RG.from], 0, 0); }
  c.globalAlpha = op(RG.cur) * (mix < 1 ? mix : 1); c.drawImage(RG.masks[RG.cur], 0, 0);
  // beat shimmer: lamp brightens slightly on each kick
  // night room: dim the lit painting between beats, flash back up on every kick (stronger while music plays)
  c.globalCompositeOperation = 'source-atop'; c.globalAlpha = Math.max(0, (S.playing ? 0.5 : 0.3) - (S.playing ? 0.45 : 0.2) * A.kick); c.fillStyle = '#05040a'; c.fillRect(0, 0, rc.width, rc.height);
  if (S.rgbStyle !== 'wash' && S.rgbStyle !== 'even') { c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 1; const vg = c.createLinearGradient(0, 0, 0, rc.height); vg.addColorStop(0, 'rgba(5,4,10,0)'); vg.addColorStop(.45, 'rgba(5,4,10,0.12)'); vg.addColorStop(1, 'rgba(5,4,10,0.42)'); c.fillStyle = vg; c.fillRect(0, 0, rc.width, rc.height); }
  c.globalCompositeOperation = 'screen'; const L2 = lampColor(now);
  c.globalAlpha = 0.16 * A.kick + 0.04 * A.level; c.fillStyle = `rgb(${L2.join(',')})`; c.fillRect(0, 0, rc.width, rc.height);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}
function lampColor(now) {
  const a = LAMP_RGB[RG.from], b = LAMP_RGB[RG.cur], m = Math.min(1, S.playing ? Math.max(0, A.t - (RG.changedT || 0)) / 0.26 : (now - RG.changed) / 900);
  return a.map((v, i) => Math.round(v * (1 - m) + b[i] * m));
}

/* ---------- Club lasers (v2476.60): thin crisp beams from fixed emitters above the painting.
   patterns rotate every 8 kicks: fan sheet sweep / single-beam scan / crossing twin fans.
   On the beat the beams strobe hard on, then gate down; faint haze scatter along each beam; tips fade out. ---------- */
/* Lasers (v2476.63): faithful port of the homepage sound-light lasers (ae-home-light.js, GPT handoff 8b64dbf, unchanged in
   site v2476.26): six prismatic beams from off-frame origins onto the painting, refracted ray fans at each landing point,
   soft light pools, beat rings; flying depth bolts on each kick; small music spots. Coordinates mapped to the painting rect. */
const LASER = ['#ff416d', '#57ffa0', '#ffe28d', '#65dbff', '#c987ff', '#ffac68'];
const LZ = { pat: 0, hit: -1e9 };
const LWM = { xthin: 0.6, thin: 1, mid: 1.9, thick: 2.5 }; const lwk = () => LWM[S.lw] || 1; // v83: 極細 default // v75 雷射粗細 細/中/粗
const tb78 = () => Math.min(lwk(), 2.2) * 0.5; // v78: tap beams half width at 中, 粗 capped
const gk76 = () => lwk() > 2.2 ? .6 : 1; // v76: 粗 toned down + weaker halo (v77: restored lwk, which v76 had commented out -> ReferenceError froze the loop in non-歡樂派對 modes)
let bolts = [], musicSpots = [], spots = [];
function fireBolts() {}
const variation = seed => { const n = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return n - Math.floor(n); };
function hpGeom() { const p = L.p; return { X0: p.x, W: p.w, T: p.y, H: p.h, sx: p.x + p.w * SUN.x, sy: p.y + p.h * SUN.y }; }
function hpDest(i, phase, now) {
  const G = hpGeom(), group = Math.floor((A.count || RG.beats) / 4), angle = i * Math.PI / 3 + phase * .24 + variation(group + 1) * 1.7 + now / 1000 * 1.9 * (1 + .12 * i) * (i % 2 ? 1 : -1) + Math.sin(now / 1000 * 3.1 + i * 1.7) * .35; // v84 quicker sweeps; v83: lasers scan faster than searchlights
  const t = { x: G.X0 + G.W * (.16 + .68 * (.5 + .5 * Math.sin(angle))), y: G.T + Math.max(30, G.H * (.20 + .60 * (.5 + .5 * Math.cos(angle * 1.3)))) };
  const impact = S.playing ? Math.min(1, (A.drop || 0) * 1.8) : 0;
  return { x: t.x * (1 - impact) + G.sx * impact, y: t.y * (1 - impact) + G.sy * impact };
}
function launchDepth(x, y, now, seed) {
  if (!S.laser) return; const G = hpGeom(), st = A.b ? A.b.stage : 'groove', number = S.playing ? (st === 'drop' ? 6 : 2) : 6;
  for (let i = 0; i < number; i++) {
    const edge = i % 3, ox = edge === 0 ? G.X0 - G.W * .12 : edge === 1 ? G.X0 + G.W * 1.12 : G.X0 + G.W * (.1 + ((i + seed) % 5) * .2), oy = edge === 2 ? G.T - 30 : G.T + G.H * (.1 + ((i + seed) % 5) * .16);
    const tg = x === null ? hpDest(i, seed, now) : { x, y };
    bolts.push({ ox, oy, x: tg.x, y: tg.y, born: now + (S.playing ? 0 : i * 12), life: S.playing ? 180 : 650, musical: S.playing, color: LASER[i] });
  }
  if (bolts.length > 36) bolts.splice(0, bolts.length - 36);
}
/* v2476.68: like the homepage, the sweep is NOT auto-fired during music any more (v67 stacked it on heavy beats + drops on top
   of the six music beams = up to 18 beams + 18 pools at once -> cluttered). It stays available as a manual effect only.
   v2476.67: lite v0.1.0 "laser show" sweep — six beams from off-frame emitters sweep across the art for 1.65 s, flaring on each
   beat of the audio grid (lite used a 0.405 s wall clock; here the flare is A.since from the real beat grid). Fired on heavy beats. */
const LSW = []; function laserShow(now) { LSW.push({ born: now, life: 1650, seed: variation(now % 1000) * 6 }); if (LSW.length > 2) LSW.shift(); }
function drawLaserShow(ctx, now, G, lite) {
  for (let n = LSW.length - 1; n >= 0; n--) if (now - LSW[n].born > LSW[n].life) LSW.splice(n, 1);
  for (const w of LSW) {
    const t = (now - w.born) / 1000, life = (now - w.born) / w.life, env = Math.sin(Math.PI * Math.min(1, life)) ** .5, pulse = S.playing ? Math.exp(-(A.since || 0) / 0.11) : (1 - ((t / .405) % 1)) ** 3;
    ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const ox = i % 3 === 0 ? G.X0 - G.W * .06 : i % 3 === 1 ? G.X0 + G.W * 1.06 : G.X0 + G.W * (.2 + i * .11), oy = i % 3 === 2 ? G.T - 16 : G.T + G.H * (.12 + (i % 4) * .2);
      const ph = t * (1.1 + i * .13) + i * 1.7 + w.seed, tx = G.X0 + G.W * (.5 + .4 * Math.sin(ph)), ty = G.T + Math.max(24, G.H * (.3 + .42 * (.5 + .5 * Math.cos(ph * 1.3))));
      const col = LASER[i], power = Math.min(1, env * (.35 + .65 * pulse));
      ctx.shadowColor = col; ctx.shadowBlur = lite ? 0 : 16 + pulse * 18; ctx.strokeStyle = col; ctx.globalAlpha = power; ctx.lineWidth = 1.2 + pulse * 2.4;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.shadowBlur = lite ? 0 : 4; ctx.strokeStyle = '#fff9df'; ctx.lineWidth = .7; ctx.globalAlpha = power * .8; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      const pool = ctx.createRadialGradient(tx, ty, 1, tx, ty, 30 + pulse * 34); pool.addColorStop(0, `rgba(255,249,218,${power * .7})`); pool.addColorStop(.2, col + Math.round(power * 90).toString(16).padStart(2, '0')); pool.addColorStop(1, col + '00');
      ctx.fillStyle = pool; ctx.fillRect(tx - 70, ty - 70, 140, 140);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
  }
}
function drawLasers(ctx, now) {
  if (S.home && document.body.dataset.original !== '1') return; // v71: with 歡樂派對 on, 雷射 = the homepage lasers only (no stacked premium set)
  const G = hpGeom(), lite = S.engine === 'lite' || PERF.low; // v77: drop shadowBlur once the device is struggling
  ctx.save(); ctx.beginPath(); ctx.rect(G.X0, G.T, G.W, G.H); ctx.clip();
  if (S.laser) {
    const b = S.playing && A.b ? A.b : { count: RG.beats, pulse: A.kick, phase: 0, stage: 'groove', dropPulse: 0, buildProgress: 0, sweep: now / 405 };
    const pulse = S.playing ? (A.b ? A.b.pulse : A.kickQ) : A.kick, colors = LASER, sweep = b.sweep || 0; // v2476.68: homepage beat.pulse envelope
    // v2476.67 (AE Player lite v0.1.0, ecbfd41): warm sun glow breathing under the beams, and a beat-locked laser show sweep on heavy beats.
    if (S.playing) { const en = Math.max(A.level, (LZ.en || 0) * .84); LZ.en = en; const R0 = Math.min(G.W * .42, 190) * Math.max(1, G.W / 460);
      const sg = ctx.createRadialGradient(G.sx, G.sy, 3, G.sx, G.sy, R0); sg.addColorStop(0, `rgba(255,223,115,${en * .16 + pulse * .35})`); sg.addColorStop(.45, `rgba(243,178,48,${en * .08 + pulse * .18})`); sg.addColorStop(1, 'rgba(240,170,45,0)');
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = sg; ctx.fillRect(G.X0, G.T, G.W, G.H); }
    drawLaserShow(ctx, now, G, lite);
    ctx.globalCompositeOperation = 'screen';
    const group = Math.floor(b.count / 4), pattern = Math.floor(variation(group + 3) * 3), beamCount = b.stage === 'build' ? (b.buildProgress > .7 ? 5 : 3) : 6;
    LZ.pat = pattern; const energy = A.level;
    for (let i = 0; i < beamCount; i++) {
      const originX = i % 3 === 0 ? G.X0 - G.W * .08 : i % 3 === 1 ? G.X0 + G.W * 1.08 : G.X0 + G.W * (.15 + i * .12), originY = i % 3 === 2 ? G.T - 20 : G.T + G.H * (.15 + (i % 4) * .20);
      const tg = hpDest(i, sweep, now), targetX = tg.x, targetY = tg.y;
      const power = Math.min(1, ((b.stage === 'build' ? .06 + b.buildProgress * .06 : .07) + energy * .035 + pulse * .85 + (b.dropPulse || 0) * .12) * Math.min(1, 0.6 + 0.6 * S.intensity) + (S.playing ? 0 : .12));
      const W0 = (1.2 + pulse * 2.4) * lwk(); if (window.aeClubBeam) window.aeClubBeam(ctx, originX, originY, targetX, targetY, colors[i], W0, Math.min(1, power * 1.3 + .12), lite, now, i, pulse); // v84 nightclub beam + big crisp hotspot
      ctx.strokeStyle = colors[i]; ctx.lineWidth = .7; ctx.globalAlpha = pulse * .6; ctx.beginPath(); ctx.arc(targetX, targetY, Math.max(0, 8 + Math.min(1, b.phase) * 28), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
    bolts = bolts.filter(q => now - q.born < q.life);
    ctx.globalCompositeOperation = 'screen';
    for (const q of bolts) {
      const pr = Math.max(0, (now - q.born) / q.life), tail = Math.max(0, pr - .32), near = (1 - pr) ** 2, back = (1 - tail) ** 2;
      const opacity = q.musical ? EN.flightPower((now - q.born) / 1000) : Math.sin(Math.PI * pr);
      const tipX = q.x + (q.ox - q.x) * near, tipY = q.y + (q.oy - q.y) * near, startX = q.x + (q.ox - q.x) * back, startY = q.y + (q.oy - q.y) * back;
      const streak = ctx.createLinearGradient(startX, startY, tipX, tipY); streak.addColorStop(0, q.color + '00'); streak.addColorStop(1, q.color);
      ctx.strokeStyle = streak; ctx.lineWidth = (1.4 + (1 - pr) * 7) * tb78(); ctx.shadowColor = q.color; ctx.shadowBlur = lite ? 0 : 12; ctx.globalAlpha = opacity * .95;
      ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.strokeStyle = '#fff9e9'; ctx.lineWidth = (.7 + (1 - pr) * 1.5) * Math.sqrt(Math.max(tb78(), .6)); ctx.globalAlpha = opacity * .85;
      ctx.beginPath(); ctx.moveTo(startX + (tipX - startX) * .5, startY + (tipY - startY) * .5); ctx.lineTo(tipX, tipY); ctx.stroke();
      ctx.fillStyle = '#fff6d2'; ctx.beginPath(); ctx.arc(tipX, tipY, Math.max(0, 1.5 + (1 - pr) * 2), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    const st = A.b ? A.b.stage : 'groove', musicLife = st === 'build' ? 90 : 150;
    musicSpots = musicSpots.filter(s => now - s.born < musicLife);
    for (const s of musicSpots) {
      const life = (now - s.born) / musicLife, opacity = (1 - life) * (st === 'build' ? .55 + (A.b.buildProgress || 0) * .25 : .65), radius = st === 'build' ? 24 + life * 44 : 18 + life * 38;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius); g.addColorStop(0, `rgba(255,247,207,${opacity})`); g.addColorStop(1, 'rgba(255,210,80,0)');
      ctx.fillStyle = g; ctx.fillRect(s.x - radius, s.y - radius, radius * 2, radius * 2);
    }
  } else { bolts.length = 0; musicSpots.length = 0; }
  ctx.restore(); ctx.globalAlpha = 1;
}
/* homepage tap response (ring + soft gold pool, 1.1 s) + gold burst element; in gallery/glint presets the stars also scatter from the finger */
let tapStars = [];
function drawTaps(ctx, now) {
  const touchLife = 1100; spots = spots.filter(s => now - s.born < touchLife);
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (const s of spots) {
    const life = (now - s.born) / touchLife, opacity = 1 - life, radius = 35 + life * 90;
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius); g.addColorStop(0, `rgba(255,249,210,${opacity})`); g.addColorStop(.22, `rgba(255,217,108,${opacity * .8})`); g.addColorStop(1, 'rgba(245,180,45,0)');
    ctx.fillStyle = g; ctx.fillRect(s.x - radius, s.y - radius, radius * 2, radius * 2);
    ctx.strokeStyle = `rgba(255,222,127,${opacity})`; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(0, 8 + life * 55), 0, Math.PI * 2); ctx.stroke();
  }
  tapStars = tapStars.filter(q => now - q.t < q.life);
  for (const q of tapStars) {
    const u = (now - q.t) / q.life, e = 1 - (1 - u) ** 3, x = q.x + q.vx * e, y = q.y + q.vy * e + 12 * u * u, a = (1 - u) ** 1.5, r = q.s * (1 - .5 * u);
    const mg = ctx.createRadialGradient(x, y, 0, x, y, r); mg.addColorStop(0, `rgba(255,250,236,${a * .85})`); mg.addColorStop(.4, `rgba(255,222,160,${a * .35})`); mg.addColorStop(1, 'rgba(255,210,140,0)');
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
function artTap(x, y) { // x,y in stage (un-zoomed) coordinates
  V75.focus = { x, y, t: performance.now() }; V75.foci = (V75.foci || 0) + 1; // v76: searchlights swing to the tap point
  if (window.aeHomeReplica && document.body.dataset.original !== '1') window.aeHomeReplica.tap(x, y); // v70: homepage tap beams + gold ripple in ALL modes
  if (S.home && window.aeHomeReplica) { if (!A.started && !S.playing) togglePlay(); RG.taps = (RG.taps || 0) + 1; tapSound(x); return; } // v2476.69: homepage tap (beams + gold ripples)
  if (!A.started && !S.playing) { togglePlay(); tapSound(x); return; } // v2476.65: first tap on the painting starts the music
  if (S.playing) beatTap(x, y);
  const now = performance.now(); RG.taps = (RG.taps || 0) + 1; // ring + gold burst now come from the global homepage tap layer
  if (S.glint || S.preset === 'gallery') for (let i = 0; i < 10; i++) { const an = Math.random() * 6.2832, d = 30 + Math.random() * 90; tapStars.push({ t: now, x, y, vx: Math.cos(an) * d, vy: Math.sin(an) * d, s: 3 + Math.random() * 5, life: 700 + Math.random() * 600 }); }
  tapSound(x);
}
/* v2476.65 beat taps: while playing, a tap is judged against the audio beat grid (same clock as the lights).
   on-beat (<=70 ms, perfect <=35 ms): warm halo + a soft bell note from C# minor pentatonic (the song's key), climbing with the combo;
   off-beat: just the normal ring. Consecutive on-beat taps build a combo (shown as a small fading ×N), dragging leaves a light trail. */
const GAME = { combo: 0, best: 0, last: 0, hits: 0, perfect: 0, taps: 0, marks: [], trail: [], ac: null };
const PENTA = [554.37, 659.25, 739.99, 830.61, 987.77, 1108.73, 1318.51, 1479.98];
function beatErr() { if (TR.beats !== 'timeline') { const lb = A.lb; if (!lb) return 9; const d = audio.currentTime - lb.last, iv = lb.interval; return Math.abs(d) < iv / 2 ? d : d - iv; } const ev = TL && TL.events; if (!ev || !ev.length) return 9; const t = CK.tt != null ? CK.tt : A.t; let lo = 0, hi = ev.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m] <= t) lo = m + 1; else hi = m; } const a = lo ? t - ev[lo - 1] : 9, b = lo < ev.length ? ev[lo] - t : 9; return a < b ? a : -b; }
// v2476.66 tap sounds: only the song's tonic C# and its fifth G#, very quiet, high-passed so they sit above the mix
// like a glass/coin "ting"; plus a 4 ms filtered click. No scale climbing, nothing that can clash with the track.
const TONE = { root: 1108.73, fifth: 1661.22, vol: 0.022 };
function acx() { const c = GAME.ac || (GAME.ac = LAT.ctx || new (window.AudioContext || window.webkitAudioContext)()); if (c.state === 'suspended') c.resume(); return c; }
function ting(perfect) {
  try { const c = acx(), t = c.currentTime + 0.005, out = c.createGain(), hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900; out.gain.value = TONE.vol * (perfect ? 1 : 0.6); hp.connect(out); out.connect(c.destination);
    const notes = perfect ? [[TONE.root, 1, 0.9], [TONE.fifth, 0.45, 0.7]] : [[TONE.root, 0.8, 0.55]];
    for (const [f, g, d] of notes) for (const [m, k] of [[1, 1], [2.756, .18]]) { const o = c.createOscillator(), v = c.createGain(); o.type = 'sine'; o.frequency.value = f * m; v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g * k, t + .004); v.gain.exponentialRampToValueAtTime(0.0001, t + d * (m > 1 ? .35 : 1)); o.connect(v); v.connect(hp); o.start(t); o.stop(t + d + .05); }
    const n = c.createBuffer(1, Math.round(c.sampleRate * 0.004), c.sampleRate), dd = n.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = (Math.random() * 2 - 1) * (1 - i / dd.length);
    const ns = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain(); ns.buffer = n; bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 1.2; ng.gain.value = perfect ? 0.5 : 0.35; ns.connect(bp); bp.connect(ng); ng.connect(hp); ns.start(t);
    GAME.sounds = (GAME.sounds || 0) + 1;
  } catch (e) {}
}
/* v72 tap sound setting: 音階 (scale chime / ting, as before) or EDM kick 輕/中/重 — short, tight, sub-heavy, ducked under the track */
const TAPSND = { mode: (() => { try { return localStorage.getItem('ae-premium-tapsnd') || 'scale'; } catch (e) { return 'scale'; } })(), n: 0 };
/* v75 808-style kick: deep sub sine sweep (~155→45 Hz) with a long tail, a separate 45 Hz sub layer, a click transient;
   輕/中/重 differ in length, sub weight and click; 重 adds tanh saturation + the longest boom. All kicks go through a
   compressor + brick-wall limiter bus so stacked taps never clip. */
/* v76 kick: louder than v75 (at least as loud as the track), a low-mid body (2nd/3rd harmonics ~90–140 Hz so phone speakers
   reproduce the punch), saturation on every level (輕 light → 重 heavy), the track is ducked ~2.5 dB for ~0.25 s under each kick
   (audio.volume; iOS Safari ignores element volume, so there the kick is just louder). Compressor + limiter bus prevents clipping. */
const KICKS = { // v79: phone-speaker kick - beater (1-3 kHz) + 150-300 Hz thud carry the loudness; sub kept small so it doesn't eat limiter headroom
  k1: { f0: 120, f1: 60, pd: 0.06, d: 0.25, g: 1.7, sub: 0.2, thud: 0.9, td: 0.1, beat: 0.55, duck: 0.5 },
  k2: { f0: 120, f1: 56, pd: 0.07, d: 0.4, g: 2.3, sub: 0.3, thud: 1.3, td: 0.15, beat: 0.75, duck: 0.4 },
  k3: { f0: 120, f1: 52, pd: 0.075, d: 0.6, g: 3.0, sub: 0.4, thud: 1.7, td: 0.27, beat: 0.95, duck: 0.32 } }; // duck: -6 / -8 / -10 dB
const KV = []; // live voices (cap 4)
function kbus(c) { if (GAME.kbus && GAME.kbus.context === c) return GAME.kbus;
  const pre = c.createGain(); pre.gain.value = 1;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -8; comp.knee.value = 4; comp.ratio.value = 2.5; comp.attack.value = 0.003; comp.release.value = 0.12; // light glue only
  const mk = c.createGain(); mk.gain.value = 1.5;
  const lim = c.createDynamicsCompressor(); lim.threshold.value = -1.5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.06;
  const sc = c.createWaveShaper(), cv = new Float32Array(2048); for (let i = 0; i < 2048; i++) { const x = i / 1024 - 1, a = Math.abs(x); cv[i] = Math.sign(x) * (a < 0.8 ? a : 0.8 + 0.19 * Math.tanh((a - 0.8) / 0.19)); } sc.curve = cv; sc.oversample = '4x'; // v79 safety ceiling 0.99 (only touches overshoots the 1 ms limiter misses)
  pre.connect(comp); comp.connect(mk); mk.connect(lim); lim.connect(sc); sc.connect(c.destination); if (!(c instanceof (window.OfflineAudioContext || Object))) GAME.kbus = pre; return pre; }
const DUCK = { until: 0, base: null, n: 0 };
function duckMusic(f) { if (!S.playing || audio.muted) return; if (A.mg && A.mg.g) { const g = A.mg.g.gain, t = A.mg.c.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(mv84() * f, t + 0.01); g.setValueAtTime(mv84() * f, t + 0.2); g.linearRampToValueAtTime(mv84(), t + 0.32); DUCK.n++; return; } if (DUCK.base == null) DUCK.base = audio.volume; const v = DUCK.base * f; audio.volume = Math.min(audio.volume, v); DUCK.n++; DUCK.until = performance.now() + 200;
  clearTimeout(DUCK.tm); const rel = () => { const left = DUCK.until - performance.now(); if (left > 0) { DUCK.tm = setTimeout(rel, left); return; } let k = 0; const step = () => { k++; audio.volume = Math.min(DUCK.base, audio.volume + (DUCK.base - audio.volume) * 0.35 + 0.01); if (k < 12 && audio.volume < DUCK.base - 0.005) DUCK.tm = setTimeout(step, 16); else { audio.volume = DUCK.base; DUCK.base = null; } }; step(); }; DUCK.tm = setTimeout(rel, 260); }
function kick(lv, ctxOverride) {
  try { const K = KICKS[lv] || KICKS.k2, c = ctxOverride || acx(), t = c.currentTime + 0.004, out = c.createGain();
    // rapid taps: cap 4 overlapping voices, fade the oldest quickly, slight per-voice trim when stacking
    if (!ctxOverride) { for (let i = KV.length - 1; i >= 0; i--) if (KV[i].end < t) KV.splice(i, 1); while (KV.length >= 4) { const o = KV.shift(); try { o.g.gain.cancelScheduledValues(t); o.g.gain.setValueAtTime(o.g.gain.value, t); o.g.gain.linearRampToValueAtTime(0, t + 0.012); } catch (e) {} } }
    const vg = K.g * (ctxOverride ? 1 : 1 / Math.sqrt(1 + 0.35 * KV.length)); out.gain.value = vg; out.connect(kbus(c)); if (!ctxOverride) KV.push({ g: out, end: t + K.d });
    const env = (g, peak, hold, d, at = 0.0015) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + at); g.gain.setValueAtTime(peak, t + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + d); };
    // sub/body: fast 120 -> ~55 Hz drop, low-passed, small share
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160; lp.Q.value = -3; lp.connect(out);
    const o = c.createOscillator(), v = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(K.f0, t); o.frequency.exponentialRampToValueAtTime(K.f1, t + K.pd); env(v, K.sub, 0.03, K.d); o.connect(v); v.connect(lp); o.start(t); o.stop(t + K.d + 0.02);
    // thud: 150-300 Hz body (what a phone speaker actually plays) - pitch-dropping so it never rings as a tone
    const tl = c.createBiquadFilter(); tl.type = 'lowpass'; tl.frequency.value = 420; tl.Q.value = -3; tl.connect(out);
    const h = c.createOscillator(), hg = c.createGain(); h.type = 'sine'; h.frequency.setValueAtTime(300, t); h.frequency.exponentialRampToValueAtTime(170, t + 0.06); env(hg, K.thud, 0.015, K.td); h.connect(hg); hg.connect(tl); h.start(t); h.stop(t + K.td + 0.02);
    // gentle parallel saturation on the thud only (soft tanh, adds 300-600 Hz presence; low-passed so it cannot ring)
    const ws = c.createWaveShaper(), cv = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 256 - 1; cv[i] = Math.tanh(x * 2) / Math.tanh(2); } ws.curve = cv; const sg = c.createGain(); sg.gain.value = 0.35; hg.connect(ws); ws.connect(sg); sg.connect(tl);
    // noise thud (150-400 Hz band): body without a pitch, so a longer thud can't ring as a note
    const nb = c.createBuffer(1, Math.round(c.sampleRate * (K.td + 0.02)), c.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const nbs = c.createBufferSource(), nbp = c.createBiquadFilter(), nbg = c.createGain(); nbs.buffer = nb; nbp.type = 'bandpass'; nbp.frequency.value = 260; nbp.Q.value = 0.7; env(nbg, K.thud * 0.9, 0.01, K.td); nbs.connect(nbp); nbp.connect(nbg); nbg.connect(out); nbs.start(t);
    // beater: 1-3 kHz knock, ~8 ms noise + 5 ms falling blip
    const n = c.createBuffer(1, Math.round(c.sampleRate * 0.012), c.sampleRate), dd = n.getChannelData(0); for (let i = 0; i < dd.length; i++) dd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * 0.003));
    const ns = c.createBufferSource(), bp = c.createBiquadFilter(), ng = c.createGain(); ns.buffer = n; bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8; ng.gain.value = K.beat * 1.4; ns.connect(bp); bp.connect(ng); ng.connect(out); ns.start(t);
    const bo = c.createOscillator(), bg = c.createGain(); bo.type = 'triangle'; bo.frequency.setValueAtTime(2600, t); bo.frequency.exponentialRampToValueAtTime(900, t + 0.008); env(bg, K.beat * 0.5, 0.001, 0.012, 0.0005); bo.connect(bg); bg.connect(out); bo.start(t); bo.stop(t + 0.02);
    if (!ctxOverride) { duckMusic(K.duck); TAPSND.n++; GAME.sounds = (GAME.sounds || 0) + 1; }
  } catch (e) {}
}
function tapSound(x) { if (TAPSND.mode !== 'scale') { kick(TAPSND.mode); return true; } if (!S.playing && window.aeChime && window.aeChime.tap) try { window.aeChime.tap((x - L.p.x) / Math.max(L.p.w, 1)); } catch (e) {} return false; }
function setTapSound(m) { TAPSND.mode = m; try { localStorage.setItem('ae-premium-tapsnd', m); } catch (e) {} document.querySelectorAll('.ts').forEach(b => { b.classList.toggle('on', b.dataset.s === m); b.setAttribute('aria-pressed', String(b.dataset.s === m)); }); if (m !== 'scale') kick(m); }
function beatTap(x, y) {
  const now = performance.now(), e = beatErr(), ae = Math.abs(e); GAME.taps++; GAME.lastErr = Math.round(e * 1000);
  if (ae <= 0.07) { GAME.combo = now - GAME.last < 2600 ? GAME.combo + 1 : 1; GAME.last = now; GAME.hits++; const perfect = ae <= 0.035; if (perfect) GAME.perfect++;
    GAME.best = Math.max(GAME.best, GAME.combo); if (perfect) bloom(now, x, y);
    if (TAPSND.mode === 'scale') ting(perfect);
    GAME.marks.push({ t: now, x, y, n: GAME.combo, perfect }); if (GAME.marks.length > 4) GAME.marks.shift();
  } else { GAME.combo = 0; }
}
function drawGame(c, now) {
  GAME.marks = GAME.marks.filter(m => now - m.t < 1300); GAME.trail = GAME.trail.filter(q => now - q.t < 650);
  c.save(); c.globalCompositeOperation = 'screen';
  for (let i = 1; i < GAME.trail.length; i++) { const a = GAME.trail[i - 1], b = GAME.trail[i]; if (b.t - a.t > 80) continue; const k = 1 - (now - b.t) / 650;
    c.strokeStyle = `rgba(255,226,160,${k * .5})`; c.lineWidth = 1 + 5 * k; c.lineCap = 'round'; c.shadowColor = 'rgba(255,200,120,.9)'; c.shadowBlur = 10 * k; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
  c.shadowBlur = 0;
  cxC.setTransform(1, 0, 0, 1, 0, 0); cxC.clearRect(0, 0, cxC.canvas.width, cxC.canvas.height); cxC.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  drawConfetti(cxC, now);
  for (const m of GAME.marks) drawCoin(cxC, now, m);
  c.restore();
}
/* v2476.66 reward coin: a small rendered gold coin (rim, embossed sun, specular sweep) that pops, rises a little and shimmers.
   perfect = larger, brighter, soft halo + 'Perfect'; good = smaller, dimmer + 'Nice'. Labels are thin, small, semi-transparent. */
function drawCoin(c, now, m) {
  // v2476.67: a flat struck coin — circular face, visible milled edge (thickness) as it tilts, reeded rim, engraved sun,
  // dark hairline outline + contact shadow so it reads on the brightest parts of the painting.
  const u = (now - m.t) / 1300; if (u < 0 || u > 1) return;
  const pop = u < .16 ? 1 - (1 - u / .16) ** 3 : 1 + .06 * Math.sin(Math.min(1, (u - .16) / .22) * Math.PI) * (1 - u);
  const R0 = (m.perfect ? 17 : 12) * Math.max(.85, Math.min(1.3, L.p.w / 520)), r = R0 * Math.max(.01, pop), a = u < .7 ? 1 : 1 - (u - .7) / .3;
  const x = m.x, y = m.y - 26 - 22 * Math.sqrt(u);
  const ue = Math.min(1, u / .42), th = 1.05 * (1 - ue) ** 2 + .12 * Math.sin(u * 9) * (1 - u), cs = Math.cos(th), T = r * .24 * Math.sin(Math.abs(th)), rx = r * cs; // tilt about the vertical axis
  c.save(); c.globalAlpha = a;
  if (m.perfect) { const h = c.createRadialGradient(x, y, r * .4, x, y, r * 3.2); h.addColorStop(0, 'rgba(255,220,140,.30)'); h.addColorStop(1, 'rgba(255,200,110,0)'); c.globalCompositeOperation = 'screen'; c.fillStyle = h; c.beginPath(); c.arc(x, y, r * 3.2, 0, 6.2832); c.fill(); c.globalCompositeOperation = 'source-over'; }
  // soft contact shadow (helps on bright paint)
  c.fillStyle = 'rgba(20,10,0,.28)'; c.beginPath(); c.ellipse(x + T * .5 + 1.5, y + r * .12 + 2.5, rx + T + 1.5, r + 1.5, 0, 0, 6.2832); c.fill();
  // edge / thickness: back face + band, reeded
  const eg = c.createLinearGradient(x - rx, 0, x + rx + T, 0); eg.addColorStop(0, '#6b4512'); eg.addColorStop(.5, '#b9852f'); eg.addColorStop(1, '#5a3a0f');
  c.fillStyle = eg; c.beginPath(); c.ellipse(x + T, y, rx, r, 0, -Math.PI / 2, Math.PI / 2); c.lineTo(x, y + r); c.ellipse(x, y, rx, r, 0, Math.PI / 2, -Math.PI / 2, true); c.closePath(); c.fill();
  if (T > .8) { c.strokeStyle = 'rgba(60,36,6,.55)'; c.lineWidth = .6; for (let k = -8; k <= 8; k++) { const yy = y + (k / 9) * r, w = Math.sqrt(Math.max(0, 1 - (k / 9) ** 2)); c.beginPath(); c.moveTo(x + rx * w, yy); c.lineTo(x + rx * w + T, yy); c.stroke(); } }
  // face
  c.save(); c.translate(x, y); c.scale(Math.max(.05, cs), 1);
  const rim = c.createLinearGradient(-r, -r, r, r); rim.addColorStop(0, '#fff1c0'); rim.addColorStop(.4, '#e2b45a'); rim.addColorStop(.75, '#9c6b22'); rim.addColorStop(1, '#efcb78');
  c.fillStyle = rim; c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.fill();
  c.strokeStyle = 'rgba(110,70,16,.6)'; c.lineWidth = Math.max(.5, r * .035); for (let k = 0; k < 48; k++) { const an = k / 48 * 6.2832; c.beginPath(); c.moveTo(Math.cos(an) * r * .86, Math.sin(an) * r * .86); c.lineTo(Math.cos(an) * r * .97, Math.sin(an) * r * .97); c.stroke(); } // reeded rim
  const face = c.createRadialGradient(-r * .3, -r * .35, r * .08, 0, 0, r * .82); face.addColorStop(0, '#ffefbd'); face.addColorStop(.55, '#e6b85d'); face.addColorStop(1, '#b17d2d');
  c.fillStyle = face; c.beginPath(); c.arc(0, 0, r * .8, 0, 6.2832); c.fill();
  c.strokeStyle = 'rgba(255,244,210,.7)'; c.lineWidth = Math.max(.5, r * .03); c.beginPath(); c.arc(0, 0, r * .8, -2.4, -0.6); c.stroke(); // bevel light
  c.strokeStyle = 'rgba(110,70,16,.7)'; c.lineWidth = Math.max(.6, r * .045); c.beginPath(); c.arc(0, 0, r * .22, 0, 6.2832); c.stroke(); // engraved sun
  for (let k = 0; k < 12; k++) { const an = k * .5236; c.beginPath(); c.moveTo(Math.cos(an) * r * .3, Math.sin(an) * r * .3); c.lineTo(Math.cos(an) * r * (k % 2 ? .45 : .56), Math.sin(an) * r * (k % 2 ? .45 : .56)); c.stroke(); }
  c.strokeStyle = 'rgba(255,246,214,.55)'; c.lineWidth = Math.max(.4, r * .02); c.beginPath(); c.arc(-r * .01, -r * .015, r * .22, 3.4, 5.2); c.stroke();
  c.save(); c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.clip(); const sx = -r * 1.6 + r * 3.2 * ((u * 1.6) % 1);
  const sg = c.createLinearGradient(sx - r * .3, -r, sx + r * .3, r); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, `rgba(255,255,250,${m.perfect ? .6 : .4})`); sg.addColorStop(1, 'rgba(255,255,255,0)');
  c.globalCompositeOperation = 'screen'; c.fillStyle = sg; c.fillRect(-r, -r, r * 2, r * 2); c.restore();
  c.strokeStyle = 'rgba(40,22,4,.75)'; c.lineWidth = 1 / Math.max(.3, cs); c.beginPath(); c.arc(0, 0, r, 0, 6.2832); c.stroke(); // dark hairline outline
  c.restore(); c.restore();
  const la = Math.max(0, 1 - u / .8) * (m.perfect ? .95 : .78);
  if (la > 0) { c.save(); c.globalAlpha = la; c.font = `italic 500 ${m.perfect ? 13 : 12}px "Cormorant Garamond", Georgia, serif`; c.textAlign = 'center'; if (c.letterSpacing !== undefined) c.letterSpacing = '1.5px';
    const txt = (m.perfect ? 'Perfect' : 'Nice') + (m.n >= 2 ? '  ×' + m.n : ''), ty = y - R0 - 10 - 6 * u;
    c.lineJoin = 'round'; c.strokeStyle = 'rgba(30,16,2,.45)'; c.lineWidth = 2.2; c.strokeText(txt, x, ty); c.fillStyle = '#fff4d6'; c.fillText(txt, x, ty); c.restore(); }
}
/* v2476.67 派對 party layer (overlay only, all timing from the audio beat grid + onset map):
   drops/climax -> coloured light motes + gold confetti burst from the frame edges; heavy beats -> soft coloured sweep;
   bar downbeats -> faint multicolour bloom from the sun. Confetti is drawn on the normal-blend coin layer so gold reads as foil. */
const PT = { motes: [], conf: [], sweeps: [], blooms: [], bursts: 0, lastDrop: -1, lastOn: -1 };
const PCOL = ['#ff5c8a', '#5effb0', '#ffe08a', '#6fd8ff', '#c98bff', '#ffb070'];
function partyBurst(now, big) {
  const p = L.p, n = big ? 46 : 18, m = big ? 30 : 10; PT.bursts++;
  for (let i = 0; i < n; i++) { const side = i % 4, u = Math.random(); const [x, y, an] = side === 0 ? [p.x + p.w * u, p.y, Math.PI / 2] : side === 1 ? [p.x + p.w, p.y + p.h * u, Math.PI] : side === 2 ? [p.x + p.w * u, p.y + p.h, -Math.PI / 2] : [p.x, p.y + p.h * u, 0];
    const a2 = an + (Math.random() - .5) * 1.3, v = (160 + Math.random() * 300) * Math.max(.7, p.w / 520);
    PT.motes.push({ t: now, x, y, vx: Math.cos(a2) * v, vy: Math.sin(a2) * v, col: PCOL[i % PCOL.length], r: 3 + Math.random() * 4, life: 1100 + Math.random() * 900 }); }
  for (let i = 0; i < m; i++) { const side = i % 2, u = Math.random(), x = side ? p.x + p.w - 4 : p.x + 4, y = p.y + p.h * (.05 + .35 * u);
    const v = (220 + Math.random() * 300) * Math.max(.7, p.w / 520), a2 = (side ? Math.PI - .35 : .35) + (Math.random() - .5) * .9;
    PT.conf.push({ t: now, x, y, vx: Math.cos(a2) * v, vy: Math.sin(a2) * v - 80, w: 8 + Math.random() * 6, h: 4 + Math.random() * 3, rot: Math.random() * 6, vr: (Math.random() - .5) * 14, flip: Math.random() * 6, vf: 6 + Math.random() * 8, tone: i % 3, life: 2200 + Math.random() * 900 }); }
  if (PT.motes.length > 160) PT.motes.splice(0, PT.motes.length - 160); if (PT.conf.length > 90) PT.conf.splice(0, PT.conf.length - 90);
}
function partyHeavy(now) { if (!S.party || !S.playing) return; PT.sweeps.push({ t: now, dir: (IMP.n % 2) ? 1 : -1, col: PCOL[IMP.n % PCOL.length] }); if (PT.sweeps.length > 3) PT.sweeps.shift(); }
function partyBeat(b, now) {
  if (!S.party || !S.playing) return;
  if (b.count % 4 === 1 && b.stage !== 'build') { PT.blooms.push({ t: now, c1: PCOL[(b.count >> 2) % 6], c2: PCOL[((b.count >> 2) + 3) % 6] }); if (PT.blooms.length > 2) PT.blooms.shift(); }
  const secs = (TL && TL.sections) || []; for (let k = 0; k < secs.length; k++) { const d = secs[k].drop; if (PT.lastDrop === k && A.t < d - 1) PT.lastDrop = -1; if (PT.lastDrop !== k && A.t >= d - 0.02 && A.t < d + 0.6) { PT.lastDrop = k; partyBurst(now, true); } }
  const gr = GROOVE.find(r => A.t >= r[0] && A.t < r[1]); if ((b.stage === 'drop' || gr) && b.count % 16 === 0) partyBurst(now, false); // drop + climax grooves: smaller edge bursts every 4 bars
}
function drawParty(c, now) { // screen layer: motes, sweeps, blooms
  if (!S.party) { PT.motes.length = PT.sweeps.length = PT.blooms.length = 0; return; }
  const p = L.p, dt = Math.min(.05, (now - (PT.lt || now)) / 1000); PT.lt = now;
  // onset-map sparkle: small motes from the edges on fast onsets during drops
  if (S.playing && OM.n !== PT.lastOn && A.b && (A.b.stage === 'drop' || GROOVE.some(r => A.t >= r[0] && A.t < r[1]))) { PT.lastOn = OM.n; if (Math.random() < .5) { const u = Math.random(), top = Math.random() < .5; PT.motes.push({ t: now, x: p.x + p.w * u, y: top ? p.y : p.y + p.h, vx: (Math.random() - .5) * 60, vy: (top ? 1 : -1) * (60 + Math.random() * 80), col: PCOL[OM.n % 6], r: 1.6 + Math.random() * 2, life: 700 }); } }
  c.save(); c.beginPath(); c.rect(p.x - 40, p.y - 40, p.w + 80, p.h + 80); c.clip(); c.globalCompositeOperation = 'screen';
  PT.blooms = PT.blooms.filter(q => now - q.t < 900);
  for (const q of PT.blooms) { const u = (now - q.t) / 900, a = Math.sin(Math.PI * Math.min(1, u * 2.2)) * (1 - u) * .32, R = p.w * (.18 + .5 * u), X = p.x + p.w * SUN.x, Y = p.y + p.h * SUN.y;
    const g = c.createRadialGradient(X, Y, 0, X, Y, R); g.addColorStop(0, `rgba(255,250,235,${a})`); g.addColorStop(.35, q.c1 + Math.round(a * 200).toString(16).padStart(2, '0')); g.addColorStop(.7, q.c2 + Math.round(a * 120).toString(16).padStart(2, '0')); g.addColorStop(1, q.c2 + '00'); c.fillStyle = g; c.beginPath(); c.arc(X, Y, R, 0, 6.2832); c.fill(); }
  PT.sweeps = PT.sweeps.filter(q => now - q.t < 700);
  for (const q of PT.sweeps) { const u = (now - q.t) / 700, e = u * u * (3 - 2 * u), a = Math.sin(Math.PI * u) * .16, w = p.w * .18, cx = q.dir > 0 ? p.x - w + (p.w + 2 * w) * e : p.x + p.w + w - (p.w + 2 * w) * e;
    c.save(); c.beginPath(); c.rect(p.x, p.y, p.w, p.h); c.clip(); c.translate(cx, p.y + p.h / 2); c.rotate(q.dir * .32); const lg = c.createLinearGradient(-w, 0, w, 0); lg.addColorStop(0, q.col + '00'); lg.addColorStop(.5, q.col + Math.round(a * 255).toString(16).padStart(2, '0')); lg.addColorStop(1, q.col + '00'); c.fillStyle = lg; c.fillRect(-w, -p.h, 2 * w, 2 * p.h); c.restore(); }
  c.restore();
}
function drawConfetti(c, now) { // normal blend: light motes + gold foil confetti with a two-tone flip
  if (!S.party) { PT.conf.length = 0; return; } const dt = Math.min(.05, (now - (PT.ct || now)) / 1000); PT.ct = now;
  PT.motes = PT.motes.filter(q => now - q.t < q.life);
  for (const q of PT.motes) { q.vx *= (1 - 1.3 * dt); q.vy *= (1 - 1.3 * dt); q.x += q.vx * dt; q.y += q.vy * dt; const u = (now - q.t) / q.life, a = (1 - u) ** 1.2 * (.75 + .25 * Math.sin(now / 60 + q.r * 9)), R = q.r * 2.4;
    c.globalAlpha = a; const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, R); g.addColorStop(0, '#ffffff'); g.addColorStop(.28, q.col); g.addColorStop(.62, q.col + '88'); g.addColorStop(1, q.col + '00'); c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, R, 0, 6.2832); c.fill(); }
  c.globalAlpha = 1;

  PT.conf = PT.conf.filter(q => now - q.t < q.life);
  for (const q of PT.conf) { q.vy += 260 * dt; q.vx *= (1 - 1.2 * dt); q.vy *= (1 - 1.0 * dt); q.x += q.vx * dt + Math.sin(now / 300 + q.rot) * 14 * dt; q.y += q.vy * dt; q.rot += q.vr * dt; q.flip += q.vf * dt;
    const u = (now - q.t) / q.life, a = Math.min(1, (1 - u) * 2.5), f = Math.cos(q.flip), lit = f > 0;
    c.save(); c.globalAlpha = a; c.translate(q.x, q.y); c.rotate(q.rot); c.scale(1, Math.max(.12, Math.abs(f)));
    c.fillStyle = q.tone === 2 ? (lit ? '#f6f1e6' : '#b9b2a2') : (lit ? (q.tone ? '#ffe3a0' : '#f2c75f') : (q.tone ? '#b98a35' : '#9a6c22'));
    c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); if (f > .9) { c.fillStyle = `rgba(255,255,245,${(f - .9) * 9})`; c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); } c.strokeStyle = 'rgba(50,30,6,.55)'; c.lineWidth = .5; c.strokeRect(-q.w / 2, -q.h / 2, q.w, q.h); c.restore(); }
}
/* v2476.66 光紋 (light pattern): optional mode — finger strokes on the painting persist, breathe with the beat, and can be
   saved as a personal card (painting crop + the drawn light, composited in a new image; the page's artwork is never touched). */
const GLOW = { on: false, strokes: [], cur: null, saved: 0 };
function glowDown(e) { if (!GLOW.on || Z.pts.size !== 1) return; const q = toArt(e); if (!q) return; GLOW.cur = { pts: [q], hue: GLOW.strokes.length % 3 }; GLOW.strokes.push(GLOW.cur); if (GLOW.strokes.length > 60) GLOW.strokes.shift(); }
function glowMove(e) { if (!GLOW.on || !GLOW.cur || Z.pts.size !== 1) { GLOW.cur = null; return; } const q = toArt(e); if (!q) return; const l = GLOW.cur.pts[GLOW.cur.pts.length - 1]; if (Math.hypot(q.u - l.u, q.v - l.v) > 0.004) GLOW.cur.pts.push(q); }
function toArt(e) { const x = (e.clientX - Z.x) / Z.s, y = (e.clientY - Z.y) / Z.s, p = L.p; if (x < p.x || x > p.x + p.w || y < p.y || y > p.y + p.h) return null; return { u: (x - p.x) / p.w, v: (y - p.y) / p.h }; }
const GLOW_COL = [[255, 214, 140], [255, 236, 196], [255, 190, 120]];
function strokeGlow(c, p, ox, oy, sc, now, breath) {
  c.save(); c.globalCompositeOperation = 'screen'; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const st of GLOW.strokes) { if (st.pts.length < 2) continue; const col = GLOW_COL[st.hue].join(',');
    for (const [w, a, bl] of [[9, .10, 18], [3.2, .38, 8], [1.1, .85, 0]]) { c.strokeStyle = `rgba(${col},${a * breath})`; c.lineWidth = w * sc * (0.85 + 0.3 * (breath - .6)); c.shadowColor = `rgba(${col},.9)`; c.shadowBlur = bl * sc;
      c.beginPath(); st.pts.forEach((q, i) => { const X = ox + q.u * p.w, Y = oy + q.v * p.h; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.stroke(); } }
  c.restore();
}
function drawGlow(c, now) { if (!GLOW.strokes.length) return; const breath = S.playing ? 0.62 + 0.38 * A.kick : 0.72 + 0.12 * Math.sin(now / 900); strokeGlow(c, L.p, L.p.x, L.p.y, 1, now, breath); }
function saveGlowCard() {
  const img = $('#painting'); if (!img || !img.naturalWidth || !GLOW.strokes.length) return null;
  let u0 = 1, v0 = 1, u1 = 0, v1 = 0; for (const st of GLOW.strokes) for (const q of st.pts) { u0 = Math.min(u0, q.u); v0 = Math.min(v0, q.v); u1 = Math.max(u1, q.u); v1 = Math.max(v1, q.v); }
  const NW = img.naturalWidth, NH = img.naturalHeight, pad = .06; let cw = Math.max(.35, u1 - u0 + 2 * pad) * NW, ch = Math.max(.35, v1 - v0 + 2 * pad) * NH;
  if (cw / ch > .8) ch = cw / .8; else cw = ch * .8; cw = Math.min(NW, cw); ch = Math.min(NH, ch);
  let cx = ((u0 + u1) / 2) * NW - cw / 2, cy = ((v0 + v1) / 2) * NH - ch / 2; cx = Math.max(0, Math.min(NW - cw, cx)); cy = Math.max(0, Math.min(NH - ch, cy));
  const OW = 1080, sc = OW / cw, OH = Math.round(ch * sc), M = 70, FOOT = 120, cv = document.createElement('canvas'); cv.width = OW + 2 * M; cv.height = OH + 2 * M + FOOT;
  const c = cv.getContext('2d'); c.fillStyle = '#0b0907'; c.fillRect(0, 0, cv.width, cv.height);
  c.drawImage(img, cx, cy, cw, ch, M, M, OW, OH); // painting crop, untouched
  c.save(); c.beginPath(); c.rect(M, M, OW, OH); c.clip(); strokeGlow(c, { w: NW * sc, h: NH * sc }, M - cx * sc, M - cy * sc, sc * NW / Math.max(1, L.p.w), performance.now(), 1); c.restore();
  c.strokeStyle = 'rgba(214,178,106,.65)'; c.lineWidth = 2; c.strokeRect(M - 10, M - 10, OW + 20, OH + 20);
  c.fillStyle = '#e9d7a6'; c.textAlign = 'center'; c.font = '300 34px "Cormorant Garamond", Georgia, serif'; c.fillText('光繪  ·  盛明 Eternal Sun', cv.width / 2, OH + 2 * M + 40);
  c.globalAlpha = .6; c.font = '300 20px "Cormorant Garamond", Georgia, serif'; const d = new Date(); c.fillText('AE UNIVERSE CREATION  ·  ' + d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0'), cv.width / 2, OH + 2 * M + 78);
  GLOW.saved++; GLOW.last = { w: cv.width, h: cv.height };
  // v2476.67: iOS Safari ignores <a download> -> build the file synchronously (keeps the tap's user activation) and use the
  // share sheet (保存影像); if sharing is unavailable/declined, show the card full-screen with a long-press-to-save hint.
  const url = cv.toDataURL('image/png'); GLOW.url = url; let file = null;
  try { const bin = atob(url.split(',')[1]), arr = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k); file = new File([arr], 'AE-光繪卡-EternalSun.png', { type: 'image/png' }); } catch (e) {}
  const show = () => { GLOW.method = GLOW.method || 'view'; $('#cardimg').src = url; document.body.classList.add('card-open'); };
  const touch = matchMedia('(pointer: coarse)').matches;
  if (file && navigator.canShare && navigator.canShare({ files: [file] }) && touch) { GLOW.method = 'share'; navigator.share({ files: [file], title: '光繪卡 · 盛明 Eternal Sun' }).catch(err => { if (!err || err.name !== 'AbortError') { GLOW.method = 'view'; show(); } }); }
  else if (touch) { GLOW.method = 'view'; show(); }
  else { GLOW.method = 'download'; const a = document.createElement('a'); a.href = url; a.download = 'AE-光繪卡-EternalSun.png'; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 1000); show(); }
  return cv;
}
function setGlow(on) { GLOW.on = on; if (!on) { GLOW.strokes.length = 0; GLOW.cur = null; } document.body.classList.toggle('glow-on', on); $('#glowbtn') && $('#glowbtn').classList.toggle('on', on); frontVis(); }
function gameTrail(e) { if (!S.playing || Z.pts.size !== 1) return; const x = (e.clientX - Z.x) / Z.s, y = (e.clientY - Z.y) / Z.s, p = L.p; if (x < p.x || x > p.x + p.w || y < p.y || y > p.y + p.h) return; GAME.trail.push({ x, y, t: performance.now() }); if (GAME.trail.length > 40) GAME.trail.shift(); }
/* sun bloom (restored from Light Player 'glow' / homepage tap bloom): tap the painting or press ✦ */
let blooms = [];
function bloom(now, x, y) { blooms.push({ t: now, x, y }); if (blooms.length > 4) blooms.shift(); if (S.laser) fireBolts(now, { x, y }, 6); }
function autoBloom(now) { const p = L.p; bloom(now, p.x + p.w * SUN.x, p.y + p.h * SUN.y); }
function drawBlooms(c, now) {
  blooms = blooms.filter(b => now - b.t < 1800); c.save(); c.beginPath(); c.rect(0, 0, L.W, L.H); c.clip();
  for (const b of blooms) {
    const q = (now - b.t) / 1800, a = Math.sin(Math.PI * Math.min(1, q * 1.4)) * (1 - q) * (0.6 + .5 * S.intensity), r = L.p.w * (.12 + .3 * q);
    const col = S.mode === 'rgb' ? lampColor(now) : [255, 214, 120];
    const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, r); g.addColorStop(0, `rgba(255,250,230,${a})`); g.addColorStop(.35, `rgba(${col.join(',')},${a * .6})`); g.addColorStop(1, `rgba(${col.join(',')},0)`);
    c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, r, 0, 6.2832); c.fill();
    const R2 = r * 1.9, h = c.createRadialGradient(b.x, b.y, r * .3, b.x, b.y, R2); h.addColorStop(0, `rgba(${col.join(',')},${a * .35})`); h.addColorStop(1, `rgba(${col.join(',')},0)`);
    c.fillStyle = h; c.beginPath(); c.arc(b.x, b.y, R2, 0, 6.2832); c.fill();
    c.lineCap = 'round';
    for (let i = 0; i < 16; i++) { const an = i * .3927 + q * .4, len = (i % 2 ? 1.25 : 1.9) * r;
      const lg = c.createLinearGradient(b.x, b.y, b.x + Math.cos(an) * len, b.y + Math.sin(an) * len); lg.addColorStop(0, `rgba(255,252,240,${a})`); lg.addColorStop(1, 'rgba(255,240,200,0)');
      c.strokeStyle = lg; c.lineWidth = i % 2 ? 1.5 : 3; c.beginPath(); c.moveTo(b.x + Math.cos(an) * r * .12, b.y + Math.sin(an) * r * .12); c.lineTo(b.x + Math.cos(an) * len, b.y + Math.sin(an) * len); c.stroke(); }
    c.strokeStyle = `rgba(255,246,220,${a * .9})`; c.lineWidth = 2; c.beginPath(); c.arc(b.x, b.y, L.p.w * (.06 + .55 * q), 0, 6.2832); c.stroke();
  }
  c.restore();
}
/* RGB mode (v2476.60): a fixed gallery picture light. The fixture never moves; only its colour changes with the beat.
   styles: 'bar'  = one emissive light bar above the frame washing down the painting
           'spot' = three fixed pin spotlights on a rail, soft round pools
           'wash' = no fixture, soft even colour wash (previous look) */
function fixture(p) { const fw = p.w * .78, fh = Math.max(6, p.w * .022), fy = Math.max(6, p.y - (S.frame ? L.F : 0) - fh - Math.max(8, p.w * .03)); return { x: p.x + (p.w - fw) / 2, y: fy, w: fw, h: fh }; }
function drawCones(c, now) {
  if (S.mode !== 'rgb' || S.rgbStyle === 'wash' || S.rgbStyle === 'even') return;
  const p = L.p, col = lampColor(now), cs = col.join(','), I = 0.5 + S.intensity, k = A.kick, F = fixture(p);
  const glow = (.55 + .45 * k) * I;
  if (S.rgbStyle === 'bar') {
    // light falling down: fixed trapezoid, brightest just under the bar
    const g = c.createLinearGradient(0, F.y + F.h, 0, p.y + p.h * .85); g.addColorStop(0, `rgba(${cs},${.30 * glow})`); g.addColorStop(.35, `rgba(${cs},${.12 * glow})`); g.addColorStop(1, `rgba(${cs},0)`);
    c.fillStyle = g; c.beginPath(); c.moveTo(F.x, F.y + F.h); c.lineTo(F.x + F.w, F.y + F.h); c.lineTo(p.x + p.w * 1.06, p.y + p.h * .85); c.lineTo(p.x - p.w * .06, p.y + p.h * .85); c.closePath(); c.fill();
  } else {
    for (const u of [.2, .5, .8]) {
      const x = p.x + p.w * u, y0 = F.y + F.h, cy = p.y + p.h * .34, rr = p.w * .26;
      const g = c.createLinearGradient(0, y0, 0, cy + rr); g.addColorStop(0, `rgba(${cs},${.22 * glow})`); g.addColorStop(1, `rgba(${cs},0)`);
      c.fillStyle = g; c.beginPath(); c.moveTo(x - 3, y0); c.lineTo(x + 3, y0); c.lineTo(x + rr, cy); c.lineTo(x - rr, cy); c.closePath(); c.fill();
      const pg = c.createRadialGradient(x, cy, 0, x, cy, rr); pg.addColorStop(0, `rgba(${cs},${.20 * glow})`); pg.addColorStop(1, `rgba(${cs},0)`);
      c.fillStyle = pg; c.beginPath(); c.ellipse(x, cy, rr, rr * .7, 0, 0, 6.2832); c.fill();
    }
  }
  // coloured spill on the wall around the frame (static)
  const cx = p.x + p.w / 2, sg = c.createRadialGradient(cx, p.y, p.w * .1, cx, p.y + p.h * .2, p.w * 1.1);
  sg.addColorStop(0, `rgba(${cs},${.20 * I})`); sg.addColorStop(1, `rgba(${cs},0)`);
  c.save(); c.beginPath(); c.rect(0, 0, L.W, L.H); c.rect(p.x, p.y, p.w, p.h); c.clip('evenodd'); c.fillStyle = sg; c.fillRect(0, 0, L.W, L.H); c.restore();
}
/* the fixture itself, drawn normally (not screen) so it reads as a physical brass bar that glows */
function drawFixture(c, now) {
  if (S.mode !== 'rgb') return;
  if (S.rgbStyle === 'even') return; // v84 全幅柔光: no fixture, no arc — even full-frame glow
  if (S.rgbStyle === 'wash') { drawBarOnly(c, now); return; } // v2476.67: 柔光呼吸 too — coloured light always comes from a visible fixture
  const p = L.p, F = fixture(p), col = lampColor(now), cs = col.join(','), k = A.kick, I = 0.5 + S.intensity;
  c.save();
  // wall arm
  c.fillStyle = '#2a2016'; c.fillRect(p.x + p.w / 2 - 2, F.y + F.h * .5, 4, Math.max(0, p.y - F.y - F.h * .5));
  // halo
  c.shadowColor = `rgba(${cs},${Math.min(1, (.7 + .3 * k) * I)})`; c.shadowBlur = (18 + 18 * k) * L.dpr;
  if (S.rgbStyle === 'bar') {
    const bg = c.createLinearGradient(0, F.y, 0, F.y + F.h); bg.addColorStop(0, '#d9b46a'); bg.addColorStop(.45, '#7a5a2a'); bg.addColorStop(1, '#3a2a14');
    c.fillStyle = bg; rr(c, F.x, F.y, F.w, F.h, F.h / 2); c.fill(); c.shadowBlur = 0;
    // emissive diffuser along the underside
    const lg = c.createLinearGradient(F.x, 0, F.x + F.w, 0); lg.addColorStop(0, `rgba(${cs},0.35)`); lg.addColorStop(.5, 'rgba(255,252,244,0.95)'); lg.addColorStop(1, `rgba(${cs},0.35)`);
    c.fillStyle = lg; c.globalAlpha = Math.min(1, (.75 + .25 * k)); rr(c, F.x + F.h * .4, F.y + F.h * .55, F.w - F.h * .8, F.h * .38, F.h * .19); c.fill();
    c.globalAlpha = Math.min(1, (.55 + .45 * k) * I); c.fillStyle = `rgba(${cs},0.9)`; rr(c, F.x + F.h * .4, F.y + F.h * .62, F.w - F.h * .8, F.h * .26, F.h * .13); c.fill();
  } else {
    c.restore(); drawBarOnly(c, now); c.save(); c.shadowColor = `rgba(${cs},${Math.min(1, (.7 + .3 * k) * I)})`; // spot heads hang under the bar
    F.y += F.h * 1.05;
    for (const u of [.2, .5, .8]) {
      const x = p.x + p.w * u, s = F.h * 1.1;
      c.shadowBlur = (14 + 14 * k) * L.dpr; c.fillStyle = '#6b4f26'; rr(c, x - s * .55, F.y, s * 1.1, s * 1.2, s * .3); c.fill();
      c.shadowBlur = 0; c.globalAlpha = Math.min(1, (.6 + .4 * k) * I); const lg = c.createRadialGradient(x, F.y + s * 1.15, 0, x, F.y + s * 1.15, s * .6);
      lg.addColorStop(0, 'rgba(255,252,244,1)'); lg.addColorStop(1, `rgba(${cs},0.8)`); c.fillStyle = lg; c.beginPath(); c.ellipse(x, F.y + s * 1.15, s * .5, s * .22, 0, 0, 6.2832); c.fill(); c.globalAlpha = 1;
    }
  }
  c.restore();
}
// v2476.66: every preset that throws R/G/B light gets the gallery's brass picture-light bar (柔光呼吸 unchanged).
function drawBarOnly(c, now) {
  const p = L.p, F = fixture(p), col = lampColor(now), cs = col.join(','), k = A.kick, I = 0.5 + S.intensity;
  c.save(); c.fillStyle = '#2a2016'; c.fillRect(p.x + p.w / 2 - 2, F.y + F.h * .5, 4, Math.max(0, p.y - F.y - F.h * .5));
  c.shadowColor = `rgba(${cs},${Math.min(1, (.7 + .3 * k) * I)})`; c.shadowBlur = (18 + 18 * k) * L.dpr;
  const bg = c.createLinearGradient(0, F.y, 0, F.y + F.h); bg.addColorStop(0, '#d9b46a'); bg.addColorStop(.45, '#7a5a2a'); bg.addColorStop(1, '#3a2a14');
  c.fillStyle = bg; rr(c, F.x, F.y, F.w, F.h, F.h / 2); c.fill(); c.shadowBlur = 0;
  const lg = c.createLinearGradient(F.x, 0, F.x + F.w, 0); lg.addColorStop(0, `rgba(${cs},0.35)`); lg.addColorStop(.5, 'rgba(255,252,244,0.95)'); lg.addColorStop(1, `rgba(${cs},0.35)`);
  c.fillStyle = lg; c.globalAlpha = Math.min(1, (.75 + .25 * k)); rr(c, F.x + F.h * .4, F.y + F.h * .55, F.w - F.h * .8, F.h * .38, F.h * .19); c.fill();
  c.globalAlpha = Math.min(1, (.55 + .45 * k) * I); c.fillStyle = `rgba(${cs},0.9)`; rr(c, F.x + F.h * .4, F.y + F.h * .62, F.w - F.h * .8, F.h * .26, F.h * .13); c.fill();
  c.restore(); FX.bar = (FX.bar || 0) + 1;
}
const FX = {};
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
/* glints (v2476.65): soft specular highlights + varnish sheen (replaces the 4-point star sparkles) */
let sparks = [];
function sparkle(now, n) {
  for (let i = 0; i < n; i++) sparks.push({ t: now + i * 60, u: Math.random(), onSun: Math.random() < .45, a: Math.random() * 6.28, d: .05 + Math.random() * .2, s: .7 + Math.random() * .6 });
  if (sparks.length > 24) sparks.splice(0, sparks.length - 24);
}
function drawSparks(c, now, ox, oy) {
  // v2476.65 閃光 = specular light, not star symbols: a soft anisotropic highlight (like light catching wet varnish /
  // a lens glint seen out of focus) that swells and fades, plus an occasional slow sheen sweeping across the varnish.
  const p = L.p, I = S.intensity, g = S.frame ? L.F * 0.5 : 2, r = { x: p.x - g + ox, y: p.y - g + oy, w: p.w + 2 * g, h: p.h + 2 * g }, life = 1500;
  sparks = sparks.filter(q => now - q.t < life);
  c.save(); c.beginPath(); c.rect(r.x - 30, r.y - 30, r.w + 60, r.h + 60); c.clip();
  for (const q of sparks) {
    if (now < q.t) continue;
    const f = (now - q.t) / life, env = Math.sin(Math.PI * Math.min(1, f)) ** 2, a = env * (0.22 + .18 * I);
    const [x, y] = q.onSun ? [p.x + p.w * SUN.x + Math.cos(q.a) * p.w * q.d * 1.6, p.y + p.h * SUN.y + Math.sin(q.a) * p.w * q.d * 1.6] : perimeterPoint(q.u, r);
    const s = Math.max(10, p.w * .03) * q.s;
    c.save(); c.translate(x, y); c.rotate(-0.62 + q.a * 0.08); c.scale(2.6, 0.55); // elongated along a fixed "light direction"
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, s); gr.addColorStop(0, `rgba(255,252,242,${a})`); gr.addColorStop(.35, `rgba(255,236,200,${a * .45})`); gr.addColorStop(1, 'rgba(255,220,170,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(0, 0, s, 0, 6.2832); c.fill(); c.restore();
    const core = c.createRadialGradient(x, y, 0, x, y, s * .28); core.addColorStop(0, `rgba(255,255,252,${a * 1.2})`); core.addColorStop(1, 'rgba(255,248,230,0)');
    c.fillStyle = core; c.beginPath(); c.arc(x, y, s * .28, 0, 6.2832); c.fill();
  }
  c.restore();
  if (SH.t && now - SH.t < SH.dur) { // varnish sheen: a wide, very faint diagonal band crossing the canvas
    const u = (now - SH.t) / SH.dur, e = u * u * (3 - 2 * u), a = Math.sin(Math.PI * u) * (0.07 + 0.05 * I), w = p.w * 0.22;
    const cx = p.x + ox - w * 2 + (p.w + w * 4) * e;
    c.save(); c.beginPath(); c.rect(p.x + ox, p.y + oy, p.w, p.h); c.clip(); c.translate(cx, p.y + oy + p.h / 2); c.rotate(0.38);
    const lg = c.createLinearGradient(-w, 0, w, 0); lg.addColorStop(0, 'rgba(255,240,210,0)'); lg.addColorStop(.5, `rgba(255,248,232,${a})`); lg.addColorStop(1, 'rgba(255,240,210,0)');
    c.fillStyle = lg; c.fillRect(-w, -p.h, w * 2, p.h * 2); c.restore();
  }
}
const SH = { t: 0, dur: 2600 };
function sheen(now) { if (!SH.t || now - SH.t > SH.dur + 3000) SH.t = now; }

/* ---------- colours ---------- */
const GOLD = [[255, 196, 92], [255, 150, 70], [255, 222, 150], [214, 120, 255], [120, 230, 170]];
function ledColor(u, t) { // smooth chase gradient around perimeter, warm-biased
  const v = (u + t) % 1 * GOLD.length, i = Math.floor(v), f = v - i;
  const a = GOLD[i % GOLD.length], b = GOLD[(i + 1) % GOLD.length], s = f * f * (3 - 2 * f);
  return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
}

/* ---------- front overlay (Canvas 2D, screen-blended): LED strip, aura rings, glints ---------- */
const fx = $('#front').getContext('2d');
const cxC = $('#coin').getContext('2d'); // v2476.66 coins: normal blending so the gold reads as solid metal (front layer is screen-blended)
$('#front').style.mixBlendMode = 'screen';
let glints = [];
function perimeterPoint(u, r) { // u in [0,1) along rect r
  const P = 2 * (r.w + r.h); let d = u * P;
  if (d < r.w) return [r.x + d, r.y]; d -= r.w;
  if (d < r.h) return [r.x + r.w, r.y + d]; d -= r.h;
  if (d < r.w) return [r.x + r.w - d, r.y + r.h]; d -= r.w;
  return [r.x, r.y + r.h - d];
}
function drawFront(now) {
  const c = fx, k = L.dpr, I = S.intensity, p = L.p;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, c.canvas.width, c.canvas.height); c.setTransform(k, 0, 0, k, 0, 0);
  const t = now / 1000 * 0.06 * S.speed;
  const ox = T.x * 3, oy = T.y * 3;
  if (S.led) {
    const g = S.frame ? L.F + 2.5 : 3, r = { x: p.x - g + ox, y: p.y - g + oy, w: p.w + 2 * g, h: p.h + 2 * g };
    const e = 0.2 + 0.4 * A.level + 0.95 * A.kick + 1.1 * impE(now), N = 160; // flashes on every kick
    c.lineCap = 'round';
    for (const [lw, al, blur] of [[9, 0.10, 0], [2.2, 0.9, 6]]) {
      c.lineWidth = lw; c.shadowBlur = blur * k;
      for (let i = 0; i < N; i++) {
        const u0 = i / N, u1 = (i + 1) / N, col = ledColor(u0, t);
        const a = Math.min(1, al * e * (0.4 + I));
        c.strokeStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${a})`; c.shadowColor = c.strokeStyle;
        const [x0, y0] = perimeterPoint(u0, r), [x1, y1] = perimeterPoint(u1, r);
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      }
    }
    c.shadowBlur = 0;
  }
  drawRings81(c, now, I); drawSig81(c, now, I);
  if (S.glint) {
    if (Math.random() < 0.0025 * S.speed * (0.5 + I)) sparkle(now, 1); if (!S.playing && Math.random() < 0.0007) sheen(now); if (false) glints.push({ t: now, u: Math.random(), s: 0.6 + Math.random() * 0.6 });
    const g = S.frame ? L.F * 0.5 : 2, r = { x: p.x - g + ox, y: p.y - g + oy, w: p.w + 2 * g, h: p.h + 2 * g };
    glints = glints.filter(q => now - q.t < 900);
    for (const q of glints) {
      const f = (now - q.t) / 900, a = Math.sin(f * Math.PI) * 0.85 * I, [x, y] = perimeterPoint(q.u, r), s = Math.max(8, L.F * 0.55) * q.s;
      if (!Number.isFinite(x + y + s + a)) continue;
      const gr = c.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, `rgba(255,250,235,${a})`); gr.addColorStop(1, 'rgba(255,230,180,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, s, 0, 6.2832); c.fill();
      c.strokeStyle = `rgba(255,248,225,${a * 0.8})`; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(x - s * 1.4, y); c.lineTo(x + s * 1.4, y); c.moveTo(x, y - s * 1.4); c.lineTo(x, y + s * 1.4); c.stroke();
    }
    drawSparks(c, now, ox, oy);
  } else { glints.length = 0; sparks.length = 0; }
  drawCones(c, now); drawLasers(c, now); drawTaps(c, now); drawParty(c, now); drawGlow(c, now); drawGame(c, now);
  c.save(); c.globalCompositeOperation = 'source-over'; drawFixture(c, now); c.restore();
  drawBlooms(c, now);
  c.globalAlpha = 1; c.shadowBlur = 0;
}

/* ---------- back layer: WebGL (Three.js) or Canvas 2D fallback ---------- */
let gl = null;
async function initWebGL() {
  const THREE = await import('./three.module.min.js');
  const canvas = $('#back');
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!r.getContext()) throw new Error('no webgl');
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x060505);
  const cam = new THREE.PerspectiveCamera(30, 1, 10, 20000); const D = 1600;
  // environment for metallic gold: soft warm studio gradient
  const ec = document.createElement('canvas'); ec.width = 512; ec.height = 256; const ex = ec.getContext('2d');
  const eg = ex.createLinearGradient(0, 0, 0, 256); eg.addColorStop(0, '#2a2218'); eg.addColorStop(0.42, '#fff1cf'); eg.addColorStop(0.5, '#6b5434'); eg.addColorStop(1, '#0a0806');
  ex.fillStyle = eg; ex.fillRect(0, 0, 512, 256); ex.fillStyle = 'rgba(255,240,210,.9)'; ex.fillRect(120, 60, 60, 40); ex.fillRect(330, 70, 40, 30);
  const et = new THREE.CanvasTexture(ec); et.mapping = THREE.EquirectangularReflectionMapping; et.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromEquirectangular(et).texture;
  const goldM = new THREE.MeshStandardMaterial({ color: 0xd4a85a, metalness: 1, roughness: 0.3 });
  const goldDark = new THREE.MeshStandardMaterial({ color: 0x8a6430, metalness: 1, roughness: 0.45 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x0d0b09, roughness: 1, metalness: 0 }));
  scene.add(wall);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xfff1d6, 1.4); key.position.set(-0.6, 1, 1.2); scene.add(key);
  // back-panel glow texture
  const gc = document.createElement('canvas'); gc.width = gc.height = 256; const gx = gc.getContext('2d');
  // v84: even rounded-rect backlight (a blurred rectangle a little larger than the painting) so all four edges AND corners glow; the old radial ellipse left corners dark
  gx.shadowColor = '#fff'; gx.shadowBlur = 34; gx.shadowOffsetX = 1000; gx.fillStyle = '#fff'; gx.fillRect(128 - 70 - 1000, 128 - 70, 140, 140);
  const glowM = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffc070 });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowM); scene.add(glow);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.9 })); scene.add(panel);
  const frame = new THREE.Group(); scene.add(frame);
  let depth = 20;
  function buildFrame() {
    frame.clear();
    const p = L.p, F = L.F; depth = F * 1.5;
    const W = p.w, H = p.h, zf = F * 0.25;
    const bar = (w, h, x, y, m, d, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); frame.add(b); };
    // outer moulding (front face slightly raised), inner fine lip, darker side depth
    bar(W + 2 * F, F, 0, H / 2 + F / 2, goldM, depth, zf - depth / 2); bar(W + 2 * F, F, 0, -H / 2 - F / 2, goldM, depth, zf - depth / 2);
    bar(F, H, -W / 2 - F / 2, 0, goldM, depth, zf - depth / 2); bar(F, H, W / 2 + F / 2, 0, goldM, depth, zf - depth / 2);
    const l = F * 0.28;
    bar(W + 2 * l, l, 0, H / 2 + l / 2, goldDark, l, zf + l / 2); bar(W + 2 * l, l, 0, -H / 2 - l / 2, goldDark, l, zf + l / 2);
    bar(l, H, -W / 2 - l / 2, 0, goldDark, l, zf + l / 2); bar(l, H, W / 2 + l / 2, 0, goldDark, l, zf + l / 2);
    const cx = p.x + W / 2 - L.W / 2, cy = -(p.y + H / 2 - L.H / 2);
    frame.position.set(cx, cy, 0);
    panel.position.set(cx, cy, -depth); panel.scale.set(W * 0.98, H * 0.98, 1);
    glow.position.set(cx, cy, -depth - 1); glow.scale.set(W * 256 / 128, H * 256 / 128, 1); // v84: texture inner rect = 0.55 of the plane -> glow rect ≈ 1.09× painting
    wall.position.set(0, 0, -depth - 2); wall.scale.set(L.W * 4, L.H * 4, 1);
  }
  function resize() { r.setPixelRatio(L.dpr); r.setSize(L.W, L.H, false); buildFrame(); }
  function render(now) {
    // off-axis projection: the z=0 plane (painting) stays pinned to the screen; only depth layers shift (parallax)
    const ox = T.x * 60, oy = -T.y * 60, n = 10, s = n / D;
    cam.position.set(ox, oy, D); cam.rotation.set(0, 0, 0); cam.updateMatrixWorld();
    cam.projectionMatrix.makePerspective((-L.W / 2 - ox) * s, (L.W / 2 - ox) * s, (L.H / 2 - oy) * s, (-L.H / 2 - oy) * s, n, 20000);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    frame.visible = S.frame;
    const e = S.frame ? (0.35 + 0.6 * A.level + 0.4 * A.kick) * (0.3 + S.intensity) : 0;
    const col = S.mode === 'rgb' ? lampColor(now) : ledColor(0, now / 1000 * 0.06 * S.speed);
    glowM.color.setRGB(col[0] / 255, col[1] / 255, col[2] / 255); glowM.opacity = Math.min(1, 0.55 * e);
    glow.visible = S.frame; panel.visible = S.frame;
    r.render(scene, cam);
  }
  gl = { resize, render, kind: 'webgl' };
}
function initLite() {
  const c = $('#back').getContext('2d');
  gl = {
    kind: 'lite', resize() {},
    render(now) {
      const k = L.dpr, p = L.p, F = L.F; c.setTransform(k, 0, 0, k, 0, 0);
      c.fillStyle = '#060505'; c.fillRect(0, 0, L.W, L.H);
      if (!S.frame) return;
      const e = (0.35 + 0.6 * A.level + 0.4 * A.kick) * (0.3 + S.intensity), col = S.mode === 'rgb' ? lampColor(now) : ledColor(0, now / 1000 * 0.06 * S.speed);
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      c.save(); const ga = Math.min(0.6, 0.38 * e), cs0 = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${ga})`; c.shadowColor = cs0; c.shadowBlur = Math.max(p.w, p.h) * 0.16 * k; c.fillStyle = cs0; c.fillRect(p.x - F, p.y - F, p.w + 2 * F, p.h + 2 * F); c.restore(); void cx; void cy; // v84 even backlight incl. corners
      // side depth: trapezoids shifted by parallax
      const dx = -T.x * F * 0.9, dy = -T.y * F * 0.9, x0 = p.x - F, y0 = p.y - F, x1 = p.x + p.w + F, y1 = p.y + p.h + F;
      c.fillStyle = '#5a4120';
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y0); c.lineTo(x1 + dx, y0 + dy); c.lineTo(x0 + dx, y0 + dy); c.fill();
      c.beginPath(); c.moveTo(x0, y1); c.lineTo(x1, y1); c.lineTo(x1 + dx, y1 + dy); c.lineTo(x0 + dx, y1 + dy); c.fill();
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0, y1); c.lineTo(x0 + dx, y1 + dy); c.lineTo(x0 + dx, y0 + dy); c.fill();
      c.beginPath(); c.moveTo(x1, y0); c.lineTo(x1, y1); c.lineTo(x1 + dx, y1 + dy); c.lineTo(x1 + dx, y0 + dy); c.fill();
      const gg = c.createLinearGradient(x0, y0, x1, y1);
      gg.addColorStop(0, '#f3d79a'); gg.addColorStop(0.35, '#b8873e'); gg.addColorStop(0.55, '#f8e3b0'); gg.addColorStop(1, '#8c6630');
      c.fillStyle = gg; c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.rect(p.x, p.y, p.w, p.h); c.fill('evenodd');
      c.strokeStyle = 'rgba(70,48,18,.8)'; c.lineWidth = 1; c.strokeRect(p.x - F * 0.28, p.y - F * 0.28, p.w + F * 0.56, p.h + F * 0.56);
    }
  };
}
function weakDevice() {
  if (Q.get('lite') === '1') return true;
  if ((navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2) return true;
  try { const t = document.createElement('canvas'); return !(t.getContext('webgl2') || t.getContext('webgl')); } catch (e) { return true; }
}
function swapToLite() { // auto-fallback when WebGL is slow; replace the canvas so it can take a 2D context
  const old = $('#back'), n = document.createElement('canvas'); n.id = 'back'; n.setAttribute('aria-hidden', 'true');
  old.replaceWith(n); S.engine = 'lite'; initLite(); layout(); updateEngineNote();
}

/* ---------- UI ---------- */
let uiTimer = 0;
const UI_MS = 60000; // v83: panel closes on outside tap / ✕ (auto-close only after 60 s idle)
function hideUI(force) { clearTimeout(uiTimer); if (force !== true && document.body.classList.contains('adv-open')) return; document.body.classList.remove('ui', 'adv-open'); $('#adv').setAttribute('aria-expanded', 'false'); } // v72: 進階 open -> panel stays until ✕
function bumpUI() { if (document.body.classList.contains('ui')) { clearTimeout(uiTimer); uiTimer = setTimeout(hideUI, UI_MS); } }
function showUI() { document.body.classList.add('ui'); $('#panel').hidden = false; clearTimeout(uiTimer); uiTimer = setTimeout(hideUI, UI_MS); } // auto-close after 5 s without interaction (no :hover check — it sticks on touch screens)
/* 琥珀 Amber / 寶石 Gem (v2476.61): AE Living Wallpaper looks (琉璃 glass + 寶石 gem shaders, looks.js) on their own canvas
   above the painting; phase flows continuously and surges on every beat. 原畫 hides the canvas -> painting pixels untouched. */
const LK = { ph: 0, ready: false, draws: 0, idx: { gem: 1, amber: 2 } };
function drawLook(now, dt) {
  const cv = $('#look'), on = !!S.look && LK.ready && !!ART.looks; // v80: gem/amber masks exist for 盛明 only -> other works keep frame/LED/lasers/searchlights
  if (cv.style.display !== (on ? 'block' : 'none')) cv.style.display = on ? 'block' : 'none';
  if (!on) return;
  const w = Math.round(L.p.w * L.dpr * (L.W < 600 ? 0.8 : 0.7)), h = Math.round(w / AR); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const k = A.kick || 0, hv = S.impact ? Math.max(0, 1 - (now - IMP.t) / 500) : 0;
  LK.ph = (LK.ph + Math.min(50, dt) / 12000 * S.speed * (1 + 2.5 * k + 3 * hv)) % 1;
  const c = cv.getContext('2d'); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.drawImage($('#painting'), 0, 0, w, h);
  const I = 0.6 + S.intensity * 0.6;
  const vals = S.look === 'gem' ? { amt: Math.min(1.6, I + 0.5 * k + 0.4 * hv), spk: Math.min(2.5, 0.8 + 1.6 * k + 1.2 * hv), hue: 0, cut: 1 }
                                : { amt: Math.max(0.3, 0.42 + 0.25 * S.intensity + 0.15 * k + 0.15 * hv), line: 0.3 + 0.06 * k, hue: 0, spd: 1 };
  if (window.AELooks.draw(c, w, h, { x: 0, y: 0, w, h }, LK.ph, LK.idx[S.look], 1, false, 1, vals)) LK.draws++;
}
function frontVis() { // nothing to draw above the painting -> remove the overlay layer entirely, so the <img> is composited exactly as on its own
  const any = (S.impact && performance.now() - IMP.t < 800) || spots.length > 0 || tapStars.length > 0 || GAME.marks.length > 0 || GAME.trail.length > 0 || GLOW.strokes.length > 0 || S.party || PT.conf.length > 0 || S.led || S.aura || (RE81 && (RE81.on || (S.sig && ART.fx))) || S.glint || S.laser || S.bloom || blooms.length > 0 || S.mode !== 'natural';
  const d = any ? '' : 'none'; if ($('#front').style.display !== d) $('#front').style.display = d;
}
function syncButtons() {
  if ($('#partybtn')) { $('#partybtn').classList.toggle('on', !!S.party); $('#partybtn').setAttribute('aria-pressed', String(!!S.party)); }
  document.querySelectorAll('.tg').forEach(b => { b.classList.toggle('on', !!S[b.dataset.k]); b.setAttribute('aria-pressed', String(!!S[b.dataset.k])); });
  for (const [id, m] of [['#mNat', 'natural'], ['#mRgb', 'rgb']]) { $(id).classList.toggle('on', S.mode === m); $(id).setAttribute('aria-pressed', String(S.mode === m)); }
  $('#lamps').hidden = S.mode !== 'rgb'; $('#styles').hidden = S.mode !== 'rgb';
  document.querySelectorAll('.lp').forEach(b => b.classList.toggle('on', b.dataset.c === S.lamp));
  $('#orig').classList.toggle('on', !!saved); $('#orig').setAttribute('aria-pressed', String(!!saved));
  // nothing to draw above the painting -> remove the overlay layers entirely, so the <img> is composited exactly as on its own
  frontVis();
  $('#burst').classList.toggle('on', !!S.bloom); $('#burst').setAttribute('aria-pressed', String(!!S.bloom));
  document.querySelectorAll('.st').forEach(b => b.classList.toggle('on', b.dataset.s === S.rgbStyle));
  document.querySelectorAll('.pr[data-p]').forEach(b => { const on = b.dataset.p === S.preset; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  if (S.mode !== 'rgb') { $('#rgb').classList.remove('on'); }
  $('#rgb').style.display = S.mode === 'rgb' ? '' : 'none';
  document.body.dataset.mode = S.mode; document.body.dataset.original = saved ? '1' : '0';
}
let saved = null; const KEYS = ['search', 'dip', 'frame', 'led', 'aura', 'glint', 'laser', 'bloom', 'mode', 'look', 'impact'];
function setOriginal() { // toggle: 1st press = untouched original art, 2nd press = restore previous effects
  if (saved) { Object.assign(S, saved); saved = null; }
  else { saved = Object.fromEntries(KEYS.map(k => [k, S[k]])); Object.assign(S, { frame: false, led: false, aura: false, glint: false, laser: false, bloom: false, mode: 'natural', look: '', impact: false }); T.tx = T.ty = 0; rings.length = 0; bolts.length = 0; blooms.length = 0; }
  syncButtons();
}
function leaveOriginal() { saved = null; }
/* pinch-zoom + pan of the art stage only (page itself stays fixed); effects zoom together. Double-tap or ⟲ resets. */
const Z = { s: 1, x: 0, y: 0, pts: new Map(), st: null, lastTap: 0 };
function applyZoom() {
  Z.s = Math.min(6, Math.max(1, Z.s)); if (Z.s === 1) { Z.x = Z.y = 0; }
  const mx = L.W * (Z.s - 1), my = L.H * (Z.s - 1); Z.x = Math.min(0, Math.max(-mx, Z.x)); Z.y = Math.min(0, Math.max(-my, Z.y));
  const st = $('#stage').style; st.transformOrigin = '0 0'; st.transform = Z.s === 1 ? '' : `translate(${Z.x}px,${Z.y}px) scale(${Z.s})`;
  document.body.classList.toggle('zoomed', Z.s > 1); $('#zreset').hidden = Z.s === 1;
}
function resetZoom() { Z.s = 1; applyZoom(); }
function zoomAt(cx, cy, ns) { const ux = (cx - Z.x) / Z.s, uy = (cy - Z.y) / Z.s; Z.s = Math.min(6, Math.max(1, ns)); Z.x = cx - ux * Z.s; Z.y = cy - uy * Z.s; applyZoom(); }
function bindZoom() {
  const st = $('#stage');
  st.addEventListener('pointerdown', e => { Z.pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); Z.st = null; if (Z.pts.size === 1) Z.g = { x: e.clientX, y: e.clientY, t: Date.now(), multi: false }; if (Z.pts.size >= 2) { Z.pinching = true; if (Z.g) Z.g.multi = true; } });
  st.addEventListener('pointermove', e => { if (!Z.pts.has(e.pointerId)) return; const pr = Z.pts.get(e.pointerId); Z.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Z.pts.size === 2) { const [a, b] = [...Z.pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      if (!Z.st) Z.st = { d, s: Z.s, cx, cy }; else { Z.x += cx - Z.st.cx; Z.y += cy - Z.st.cy; Z.st.cx = cx; Z.st.cy = cy; zoomAt(cx, cy, Z.st.s * d / Z.st.d); } }
    else if (Z.pts.size === 1 && Z.s > 1 && !GLOW.on) { Z.x += e.clientX - pr.x; Z.y += e.clientY - pr.y; applyZoom(); } });
  const up = e => { Z.pts.delete(e.pointerId); Z.st = null; if (!Z.pts.size) setTimeout(() => { Z.pinching = false; }, 50); };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => st.addEventListener(ev, up));
  st.addEventListener('pointerup', e => { const n = Date.now(), g = Z.g; if (!g || Z.pts.size) return; Z.g = null; const tap = !g.multi && n - g.t < 280 && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 12; if (!tap) { Z.lastTap = 0; return; } if (!Z.consumed) { const x = (e.clientX - Z.x) / Z.s, y = (e.clientY - Z.y) / Z.s, p = L.p; if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) artTap(x, y); else if (!A.started && !S.playing) togglePlay(); else if (Z.s === 1) showUI(); } if (n - Z.lastTap < 320 && Z.s > 1) { resetZoom(); Z.lastTap = 0; } else Z.lastTap = n; });
  st.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Z.s * Math.exp(-e.deltaY * 0.002)); }, { passive: false });
  $('#zreset').onclick = e => { e.stopPropagation(); resetZoom(); };
}
function bindUI() {
  bindZoom();
  const st = $('#stage');
  // v2476.63: the painting is for art interaction only. Panel opens from ⚙ or a tap on the empty area beside the painting;
  // while it is open a tap anywhere outside it (backdrop) closes it.
  st.addEventListener('pointerdown', e => { onPointer(e); if ((document.body.classList.contains('ui') || performance.now() - (window.__closedAt83 || 0) < 400) && Z.pts.size <= 1) { hideUI(); Z.consumed = true; } else if (Z.pts.size <= 1) Z.consumed = false; });
  st.addEventListener('pointermove', e => { onPointer(e); if (GLOW.on) glowMove(e); else gameTrail(e); });
  st.addEventListener('pointerdown', e => { if (GLOW.on) setTimeout(() => glowDown(e), 0); });
  ['pointerup', 'pointercancel'].forEach(ev => st.addEventListener(ev, () => { GLOW.cur = null; }));
  $('#glowbtn').onclick = e => { e.stopPropagation(); setGlow(!GLOW.on); hideUI(true); };
  $('#glowclear').onclick = e => { e.stopPropagation(); GLOW.strokes.length = 0; frontVis(); };
  $('#glowsave').onclick = e => { e.stopPropagation(); saveGlowCard(); };
  $('#glowdone').onclick = e => { e.stopPropagation(); setGlow(false); };
  $('#cardclose').onclick = e => { e.stopPropagation(); document.body.classList.remove('card-open'); };
  $('#partybtn').onclick = e => { e.stopPropagation(); S.party = !S.party; syncButtons(); };
  $('#open').onclick = e => { e.stopPropagation(); showUI(); };
  if ($('#openhint')) { $('#openhint').onclick = e => { e.stopPropagation(); showUI(); document.body.classList.add('adv-open'); $('#adv').setAttribute('aria-expanded', 'true'); }; $('#openhint').addEventListener('pointerdown', e => e.stopPropagation()); } // v73: hint opens settings with 進階 shown
  $('#panel').addEventListener('pointerdown', e => { e.stopPropagation(); showUI(); });
  $('#play').onclick = togglePlay;
  $('#mNat').onclick = () => { S.preset = ''; leaveOriginal(); S.mode = 'natural'; syncButtons(); };
  $('#mRgb').onclick = () => { S.preset = ''; leaveOriginal(); S.mode = 'rgb'; syncButtons(); };
  document.querySelectorAll('.lp').forEach(b => b.onclick = () => { S.lamp = b.dataset.c; syncButtons(); });
  $('#burst').onclick = () => { S.bloom = !S.bloom; if (S.bloom) autoBloom(performance.now()); syncButtons(); }; // toggle: periodic bloom every 4 beats (works over 原畫 too); tapping the painting still blooms
  document.querySelectorAll('.st').forEach(b => b.onclick = () => { S.rgbStyle = b.dataset.s; syncButtons(); });
  $('#lang').onclick = () => { S.lang = S.lang === 'en' ? 'zh' : 'en'; applyLang(); };
  $('#int').oninput = e => { S.intensity = +e.target.value; S.preset = ''; syncButtons(); };
  const sk = $('#seek'); sk.addEventListener('pointerdown', () => { seeking = true; }); sk.addEventListener('input', () => { seeking = true; const d = audio.duration; if (Number.isFinite(d)) { $('#tcur').textContent = fmt(sk.value / 1000 * d); } });
  sk.addEventListener('change', () => { const d = audio.duration; if (Number.isFinite(d)) { A.started = 1; audio.currentTime = sk.value / 1000 * d; } seeking = false; progAt = 0; });
  document.querySelectorAll('.pr[data-p]').forEach(b => b.onclick = () => applyPreset(b.dataset.p));
  document.querySelectorAll('.ts').forEach(b => b.onclick = e => { e.stopPropagation(); setTapSound(b.dataset.s); }); setTapSound.init = 1;
  $('#close').onclick = e => { e.stopPropagation(); hideUI(true); };
  ['pointerdown', 'pointermove', 'input', 'keydown', 'wheel'].forEach(ev => $('#panel').addEventListener(ev, bumpUI, { passive: true }));
  document.querySelectorAll('.tg').forEach(b => b.onclick = () => { leaveOriginal(); S[b.dataset.k] = !S[b.dataset.k]; syncButtons(); });
  $('#orig').onclick = setOriginal;
  addEventListener('resize', layout);
  // page zoom locked: iOS ignores user-scalable=no, so also cancel its pinch / double-tap gestures (painting always fits the screen)
  ['gesturestart', 'gesturechange', 'gestureend', 'dblclick'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  let lastTouch = 0; document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTouch < 300) e.preventDefault(); lastTouch = n; }, { passive: false });
}

/* ---------- 7 curated presets (模式), each with its own tuned motion speed (no speed slider) ---------- */
const BASE = { tapfx: true, search: false, dip: true, party: false, frame: true, led: false, aura: false, glint: false, bloom: false, laser: false, look: '', impact: false, rgbStyle: 'bar', lamp: 'auto' };
const PRESETS = { // v83: 原畫風情 (calm, default) first; then the v72 four modes
  calm:   { ...BASE, mode: 'natural', frame: true, dip: false, laser: false, search: false, spots3: false, idle: false, tapfx: false, look: '', intensity: 0.6, speed: 0.5, night: false }, // 原畫風情 ✧: only the soft backlight behind the painting slowly changes colour
  home:   { ...BASE, mode: 'natural', frame: true, laser: true, search: true, spots3: true, idle: true, look: '', intensity: 0.7, speed: 1, night: false },                        // 歡樂派對 ☀: homepage sound-light replica
  club:   { ...BASE, mode: 'rgb', rgbStyle: 'bar', lamp: 'auto', frame: true, laser: true, led: true, spots3: false, idle: false, intensity: 0.85, speed: 1.1, night: true }, // 沈浸夜店 ☾: dark club, clean lasers + RGB light bar on beat
  breath: { ...BASE, mode: 'rgb', rgbStyle: 'even', lamp: 'blue', frame: true, aura: true, spots3: false, idle: false, intensity: 0.55, speed: 0.45, night: true },   // 柔光呼吸 ☾: calm dark, soft breathing wash + aura, gentle frame light, no lasers
  gem:    { ...BASE, mode: 'natural', look: 'gem', frame: true, led: true, glint: true, impact: true, spots3: false, idle: false, intensity: 0.75, speed: 1, night: false } // 尊榮寶石 ☀: bright, gold frame + gem/pearl sparkle + gallery light, no lasers
};
function applyPreset(k) { if (!PRESETS[k]) k = 'calm'; saved = null; Object.assign(S, PRESETS[k]); S.preset = k; S.home = k === 'home'; // v70: 歡樂派對 is a base layer that stays on under every other preset/toggle; 只留燈光 turns it off
  $('#int').value = S.intensity; syncButtons(); }
function homeSync() { const orig = document.body.dataset.original === '1', on = S.home && !orig; document.body.classList.toggle('home-mode', on); /* v72: 三光點/待機漣漪 work in every mode */ const R = window.aeHomeReplica; if (!R) return; if (R.active === orig) R.setActive(!orig); if (R.ambient !== on) R.setAmbient(on); if (R.setLasers && R.lasers !== !!S.laser) R.setLasers(!!S.laser); if (R.setSpots && R.spots3 !== !!S.spots3) R.setSpots(!!S.spots3); if (R.setIdle && R.idle !== !!S.idle) R.setIdle(!!S.idle); if (R.setTapBeams && R.tapBeams !== (S.tapfx !== false)) R.setTapBeams(S.tapfx !== false); if (!R.ready83) R.ready83 = R.setReady && R.setReady(true); document.body.classList.toggle('look-night', !orig && !!S.night); document.body.classList.toggle('look-day', !orig && !S.night); } // v70: tap-beam layer global in every mode; homepage ambient show only while 歡樂派對 is on

/* ---------- loop ---------- */
let slow = 0, frames = 0, lastT = 0;
const PERF = { ema: 16, slowN: 0, low: Q.has('perflow') ? 1 : 0, errs: 0, coarse: matchMedia('(pointer: coarse)').matches };
const LOOPSTEPS = [function analyseS(n) { analyse(n); }, function homeSyncS() { homeSync(); }, function glS(n) { gl.render(n); }, function rgbS(n) { drawRGB(n); }, function lookS(n, d) { drawLook(n, d); },
  function frontS(n) { frontVis(); drawFront(n); }, function impactS(n) { drawImpact(fx, n); }, function v75S(n) { drawV75(n); }, function progS(n) { updateProg(n); }];
function loop(now) {
  const dt = now - (lastT || now); lastT = now;
  if (!Number.isFinite(T.tx)) T.tx = 0; if (!Number.isFinite(T.ty)) T.ty = 0;
  T.x += (T.tx - T.x) * 0.06; T.y += (T.ty - T.y) * 0.06;
  PERF.ema += (Math.min(dt || 16, 200) - PERF.ema) * 0.05; if (!PERF.low && PERF.ema > 30 && ++PERF.slowN > 90) PERF.low = 1; else if (PERF.ema <= 30) PERF.slowN = 0;
  // v77: every stage guarded - one throwing layer must never kill the rAF chain (that was the mode-switch freeze)
  for (const f of LOOPSTEPS) { try { f(now, dt); } catch (e) { PERF.errs++; if (PERF.errs < 6) console.error('[premium loop]', f.name, e); } }
  if (gl.kind === 'webgl' && !Q.has('nofallback') && document.visibilityState === 'visible') {
    frames++; if (dt > 45) slow++;
    if (frames === 240) { if (slow > 150) swapToLite(); frames = 0; slow = 0; }
  }
  requestAnimationFrame(loop);
}

async function start() {
  bindUI(); applyLang(); if (Q.get('fx') !== '0') { const qp = Q.get('preset'); applyPreset(PRESETS[qp] ? qp : 'calm'); } syncButtons();
  if (weakDevice()) { S.engine = 'lite'; initLite(); }
  else { try { await initWebGL(); } catch (e) { console.warn('WebGL unavailable, using Canvas 2D', e && e.message); swapToLite(); } }
  layout(); updateEngineNote();
  const img = $('#painting'); if (img.complete && img.naturalWidth) buildRGB(img); else img.addEventListener('load', () => buildRGB(img), { once: true });
  if (window.AELooks) window.AELooks.prepare(img).then(ok => { LK.ready = !!ok; });
  // v2476.64: no text/image selection, callout, drag or tap highlight on the artwork (pinch zoom is our own pointer handler).
for (const ev of ['selectstart', 'dragstart', 'contextmenu']) document.addEventListener(ev, e => { if (!e.target.closest || !e.target.closest('#panel input')) e.preventDefault(); });
document.querySelectorAll('#stage img, #art img').forEach(im => { im.draggable = false; im.setAttribute('draggable', 'false'); });
$('#stage').addEventListener('touchstart', e => { if (e.touches.length > 1 || e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault());
// v2476.65: 對拍微調 slider (advanced panel), saved to localStorage
(() => { const r = $('#syncoff'), o = $('#syncval'); if (!r) return; const show = () => { o.textContent = (SYNC.off > 0 ? '+' : '') + SYNC.off + ' ms'; }; r.value = SYNC.off; show();
  r.addEventListener('input', () => { SYNC.off = Math.round(+r.value); show(); try { localStorage.setItem('ae-premium-sync-ms', String(SYNC.off)); } catch (e) {} }); })();
// v2476.65: elegant play glyph over the painting until the first playback starts
function syncGlyph() { const g = $('#artplay'); if (!g) return; const p = L.p; g.style.left = (p.x + p.w / 2) + 'px'; g.style.top = (p.y + p.h / 2) + 'px'; g.classList.toggle('gone', !!(A.started || S.playing)); }
audio.addEventListener('play', syncGlyph); addEventListener('resize', () => setTimeout(syncGlyph, 50)); setTimeout(syncGlyph, 0); setInterval(syncGlyph, 1000);
// v2476.64: main panel = presets + 只留燈光; 進階 reveals the full fine-control set (advanced panel).
$('#adv').addEventListener('click', e => { e.stopPropagation(); const on = document.body.classList.toggle('adv-open'); $('#adv').setAttribute('aria-expanded', String(on)); });
document.querySelectorAll('.ts').forEach(b => b.classList.toggle('on', b.dataset.s === TAPSND.mode));
document.querySelectorAll('.lw').forEach(b => b.onclick = e => { e.stopPropagation(); setLw(b.dataset.w); }); setLw(S.lw, true);
window.__premium = { ARTS, TRACKS, setArt: (...a) => setArt(...a), setTrack: (...a) => setTrack(...a), art: () => ART, track: () => TR, liveBeat: () => (TR.beats !== 'timeline' && S.playing ? A.lb : null), USER, MUSICVOL, KV, PERF, DUCK, KICKS, V75, setLw, TAPSND, kick, setTapSound, hideUI, L, S, PT, partyBurst, laserShow, LSW, FX, GLOW, setGlow, saveGlowCard, drawCoin, ting, TONE, OM, GAME, SYNC, beatErr, beatTap, sheen, SH, LAT, latency, artTap, spotsN: () => spots.length, tapStarsN: () => tapStars.length, boltsN: () => bolts.length, Z, zoomAt, resetZoom, A, IMP, LK, LZ, audio, CUE, RG, beatTimeline: !!RH, S, setOriginal, syncButtons, engine: () => S.engine, applyPreset, PRESETS, CK, stats: () => ({ sparks: sparks.length, bolts: bolts.length, blooms: blooms.length, rings: rings.length, lamp: RG.cur, rgbReady: !!RG.masks.red, playing: S.playing, t: audio.currentTime, looksOk: LK.ready, lookDraws: LK.draws, impacts: IMP.n }) };
  document.body.dataset.ready = '1';
  requestAnimationFrame(loop);
}

/* ---------- v2476.75 overlays (never touch the painting pixels) ----------
   探照燈 searchlights: 2–4 wide soft cones sweeping up from below the frame, swaying slowly with the music.
   beat-dip: day modes stay fully bright, but a strong beat briefly lays a 10–15 % dark veil (≈120 ms) over the art so the lasers pop.
   閃光 strobe: a short white flash on heavy beats (max ~2/s, off with prefers-reduced-motion). */
const V75 = { dip: { t: -1e9, a: 0 }, strobe: { t: -1e9, last: -1e9, n: 0 }, dips: 0, sway: 0, lastNow: 0 };
const RM75 = matchMedia('(prefers-reduced-motion: reduce)');
function setLw(w, quiet) { if (!LWM[w]) w = 'thin'; S.lw = w; if (!quiet) try { localStorage.setItem('ae-premium-lw84', w); } catch (e) {} document.querySelectorAll('.lw').forEach(b => { b.classList.toggle('on', b.dataset.w === w); b.setAttribute('aria-pressed', String(b.dataset.w === w)); }); }
function v75Beat(now, bass, heavy, b) {
  if (document.body.dataset.original === '1') return;
  const strong = heavy || (b && (b.dropPulse || 0) > 0.3) || bass > 0.78;
  if (strong && S.dip && !S.night && (heavy || now - V75.dip.t > 1500)) { V75.dip.t = now; V75.dip.a = heavy ? 0.15 : 0.1; V75.dips++; } // heavy beats, otherwise at most one light dip per 1.5 s
  if ((heavy || (b && (b.dropPulse || 0) > 0.3)) && S.glint && !RM75.matches && now - V75.strobe.last >= 450) { V75.strobe.last = V75.strobe.t = now; V75.strobe.n++; }
}
const fx75 = (() => { const c = document.createElement('canvas'); c.id = 'fx75'; c.setAttribute('aria-hidden', 'true'); c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none'; const st = $('#stage'), co = $('#coin'); st.insertBefore(c, co); return c.getContext('2d'); })();
const dip75 = (() => { const d = document.createElement('div'); d.id = 'dip75'; d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:absolute;inset:0;pointer-events:none;background:#000;opacity:0'; $('#art').appendChild(d); return d; })();
function focusT(now) { const F = V75.focus; if (!F) return 0; const t = now - F.t; if (t < 0) return 0; if (t < 2000) return 1; if (t < 3000) { const u = 1 - (t - 2000) / 1000; return u * u * (3 - 2 * u); } return 0; } // v77 target weight: only the hold timer resets on re-tap
function focusW(now) { const F = V75.focus; if (!F) return 0; const t = now - F.t, e = u => u * u * (3 - 2 * u); if (t < 0) return 0; if (t < 450) return e(t / 450); if (t < 2000) return 1; if (t < 3000) return e(1 - (t - 2000) / 1000); return 0; } // v76: swing in 0.45 s, hold to 2 s, ease back by 3 s
function drawV75(now) {
  const c = fx75, cv = c.canvas, k = Math.min(L.dpr || 1, PERF.low ? 1 : PERF.coarse ? 1.5 : 2), orig = document.body.dataset.original === '1';
  const W = Math.round(L.W * k), H = Math.round(L.H * k); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  // beat-dip veil (art only, below the light layers)
  let da = 0; if (!orig && S.dip && !S.night) { const q = (now - V75.dip.t) / 120; da = q >= 0 && q < 1 ? V75.dip.a * (q < 0.25 ? q / 0.25 : 1 - (q - 0.25) / 0.75) : 0; }
  dip75.style.opacity = da.toFixed(3); V75.dipNow = da;
  const st = V75.strobe, sq = (now - st.t) / 90, strobing = !orig && S.glint && !RM75.matches && sq >= 0 && sq < 1;
  if (!S.search && !strobing || orig) { if (V75.drawn) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); V75.drawn = 0; } cv.style.display = orig ? 'none' : ''; return; }
  cv.style.display = ''; V75.drawn = 1;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.setTransform(k, 0, 0, k, 0, 0);
  const p = L.p, dt = Math.min(0.05, (now - (V75.lastNow || now)) / 1000); V75.lastNow = now;
  if (S.search) {
    const lvl = S.playing ? A.level : 0.25, kk = S.playing ? A.kick : 0;
    V75.sway += dt * (S.playing ? 0.5 + 0.9 * lvl : 0.35) * (RM75.matches ? 0.15 : 1);
    const n = p.w < 420 ? 2 : p.w < 700 ? 3 : 4, by = p.y + p.h + Math.max(20, p.w * 0.06), len = p.h * 1.35 + 60;
    c.save(); c.beginPath(); c.rect(0, 0, L.W, L.H); c.clip(); c.globalCompositeOperation = S.night ? 'screen' : 'source-over'; // day: a warm haze over the bright art (additive would vanish into the light colours)
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0.5 : i / (n - 1), bx = p.x + p.w * (0.12 + 0.76 * u), base = -(u - 0.5) * 0.38;
      let ang = -Math.PI / 2 + base + Math.sin(V75.sway * (0.8 + i * 0.17) + i * 1.9) * 0.32, half = 0.1 + 0.025 * Math.sin(V75.sway * 0.6 + i);
      // v77: persistent per-cone state eased toward its target, so a re-tap retargets from the CURRENT angle (no snap back to rest)
      const C = (V75.cones || (V75.cones = []))[i] || (V75.cones[i] = { ang, L: len, w: 0 }), wT = focusT(now), F = V75.focus, ke = 1 - Math.exp(-dt / 0.14);
      let tA = ang, tL = len; if (F && wT > 0) { const at = Math.atan2(F.y - by, F.x - bx); tA = ang + (at - ang) * wT; tL = len * (1 - wT) + Math.hypot(F.x - bx, F.y - by) * 1.08 * wT; }
      C.ang += (tA - C.ang) * ke; C.L += (tL - C.L) * ke; C.w += (wT - C.w) * ke; ang = C.ang; const fw = C.w; half *= 1 - 0.4 * fw; let L0 = C.L, fa = 1 + 0.7 * fw;
      const a = fa * Math.min(0.7, (0.3 + 0.18 * lvl + 0.2 * kk) * (0.7 + 0.45 * S.intensity));
      const ex = bx + Math.cos(ang) * L0, ey = by + Math.sin(ang) * L0;
      const g = c.createLinearGradient(bx, by, ex, ey); g.addColorStop(0, `rgba(255,248,226,${a})`); g.addColorStop(0.35, `rgba(255,240,205,${a * 0.6})`); g.addColorStop(1, 'rgba(255,236,200,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(bx + Math.cos(ang + Math.PI / 2) * 6, by + Math.sin(ang + Math.PI / 2) * 6);
      c.lineTo(bx + Math.cos(ang - half) * L0, by + Math.sin(ang - half) * L0); c.lineTo(bx + Math.cos(ang + half) * L0, by + Math.sin(ang + half) * L0);
      c.lineTo(bx + Math.cos(ang - Math.PI / 2) * 6, by + Math.sin(ang - Math.PI / 2) * 6); c.closePath(); c.fill();
      // soft inner core so the cone has a brighter centre line
      const g2 = c.createLinearGradient(bx, by, ex, ey); g2.addColorStop(0, `rgba(255,252,240,${a * 0.7})`); g2.addColorStop(0.5, `rgba(255,250,235,${a * 0.25})`); g2.addColorStop(1, 'rgba(255,250,235,0)');
      c.fillStyle = g2; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + Math.cos(ang - half * 0.35) * L0, by + Math.sin(ang - half * 0.35) * L0); c.lineTo(bx + Math.cos(ang + half * 0.35) * L0, by + Math.sin(ang + half * 0.35) * L0); c.closePath(); c.fill();
      const lg = c.createRadialGradient(bx, by, 0, bx, by, 26); lg.addColorStop(0, `rgba(255,252,240,${Math.min(1, a * 2)})`); lg.addColorStop(1, 'rgba(255,240,210,0)'); c.fillStyle = lg; c.fillRect(bx - 26, by - 26, 52, 52); // lamp head
    }
    const C0 = V75.cones && V75.cones[0], fw = C0 ? C0.w : 0; if (V75.focus) { const F = V75.focus, P = V75.fp || (V75.fp = { x: F.x, y: F.y }), ke = 1 - Math.exp(-dt / 0.14); P.x += (F.x - P.x) * ke; P.y += (F.y - P.y) * ke; } if (fw > 0.01) { const F = V75.fp, R = Math.min(p.w * 0.16, 110), g = c.createRadialGradient(F.x, F.y, 0, F.x, F.y, R); g.addColorStop(0, `rgba(255,252,238,${0.55 * fw})`); g.addColorStop(0.45, `rgba(255,242,210,${0.25 * fw})`); g.addColorStop(1, 'rgba(255,240,205,0)'); c.fillStyle = g; c.fillRect(F.x - R, F.y - R, R * 2, R * 2); }
    c.restore();
  }
  if (strobing) { c.save(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.5 * (1 - sq) ** 1.5; c.fillStyle = '#fff'; c.fillRect(p.x, p.y, p.w, p.h); c.restore(); }
}
start(); // v75: after the v75 overlay declarations

/* ---------- v2476.80 換畫 / 換歌 + bottom play dock ---------- */
const SW = { tok: 0, busy: false, lum: 0.5 };
function artLum(img) { try { const c = document.createElement('canvas'); c.width = 32; c.height = 32; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, 32, 32); const d = x.getImageData(0, 0, 32, 32).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (d.length / 4) / 255; } catch (e) { return 0.5; } }
const preload = a => { if (!a || a._img) return a && a._img; const i = new Image(); i.decoding = 'async'; i.src = a.src; a._img = i; return i; };
function artLabel() { const n = $('#artname'); if (n) n.textContent = S.lang === 'en' || ART.zh === ART.en ? ART.en : ART.zh + ' ' + ART.en; document.querySelectorAll('#artstrip button').forEach(b => { const on = b.dataset.id === ART.id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); }
function trackLabel() { const n = $('#trackname'); if (n) n.textContent = S.lang === 'en' ? TR.en : TR.zh; const one = TRACKS.length < 2; for (const id of ['#dprev', '#dnext']) { const b = $(id); if (b) { b.disabled = one; b.title = one ? (S.lang === 'en' ? 'only one song for now' : '目前只有一首歌') : ''; } } }
function applyArtGeometry(img) {
  AR = ART.w / ART.h; const sp = ART.sun || [0.5, 0.5]; SUN.x = sp[0]; SUN.y = sp[1];
  layout(); dispatchEvent(new Event('resize')); if (V75) { V75.cones = null; V75.fp = null; V75.focus = null; }
  try { if (img && img.naturalWidth) buildRGB(img); } catch (e) {}
  SW.lum = img ? artLum(img) : 0.5; document.body.dataset.artLum = SW.lum < 0.35 ? 'dark' : SW.lum > 0.65 ? 'bright' : 'mid'; document.body.dataset.art = ART.id; if (RE81) try { loadRings81(); sigSync81(); } catch (e) {}
  const t = $('#title'); if (t) { t.dataset.zh = (ART.zh === ART.en ? ART.en : ART.zh) + ' · 精裝版'; t.dataset.en = ART.en + ' · Premium'; t.textContent = t.dataset[S.lang]; }
}
async function setArt(i, instant) {
  const n = ARTS.length; i = ((i % n) + n) % n; const a = ARTS[i]; if (a === ART && !instant) return; const tok = ++SW.tok;
  const img = preload(a); try { await (img.decode ? img.decode() : new Promise(r => { img.onload = r; })); } catch (e) { if (!img.naturalWidth) return; }
  if (tok !== SW.tok) return; const veil = $('#swap80'), pimg = $('#painting');
  if (!instant && veil) { veil.classList.add('on'); await new Promise(r => setTimeout(r, 230)); if (tok !== SW.tok) return; }
  ART = a; pimg.src = a.src; pimg.alt = (a.zh === a.en ? a.en : a.zh + ' ' + a.en) + ' — original painting';
  try { await (pimg.decode ? pimg.decode() : Promise.resolve()); } catch (e) {}
  applyArtGeometry(pimg); artLabel(); if (!a.user) try { localStorage.setItem('ae-premium-art', a.id); } catch (e) {}
  if (!S.home && S.look && !a.looks) {} // gem/amber shader quietly off for works without masks (drawLook guard)
  requestAnimationFrame(() => veil && veil.classList.remove('on'));
  preload(ARTS[(i + 1) % n]); preload(ARTS[(i - 1 + n) % n]);
}
function setTrack(i) {
  const n = TRACKS.length; i = ((i % n) + n) % n; const t = TRACKS[i]; if (t === TR) return;
  const wasPlaying = (RP84.force || !audio.paused) && USER.want; TR = t; if (!t.user) try { localStorage.setItem('ae-premium-track', t.id); } catch (e) {}
  CK.ok = 0; CK.last = -1; A.count = 0; A.b = null; A.lb = null; if (OM.sub) { OM.i = 0; OM.last = -1; }
  audio.src = t.src; audio.load(); trackLabel();
  if (t.beats !== 'timeline' && A.started) try { ensureGraph(true); } catch (e) {}
  if (wasPlaying) { USER.want = true; A.started = 1; if (t.cue) startAtCue(); else { try { audio.currentTime = 0; } catch (e) {} } const p = audio.play(); if (p && p.catch) p.catch(() => {}); }
  else { if (A.started) startAtCue(); syncPlay(); } // paused stays paused (cue position prepared, no play())
}
(function dock80() {
  const veil = document.createElement('div'); veil.id = 'swap80'; veil.setAttribute('aria-hidden', 'true'); $('#stage').appendChild(veil);
  const top = document.createElement('div'); top.id = 'artsw'; top.innerHTML = '<button id="aprev" aria-label="上一幅畫 previous painting">‹</button><span class="lab80" data-zh="換畫" data-en="Painting"></span><span id="artname"></span><button id="anext" aria-label="下一幅畫 next painting">›</button>';
  document.body.appendChild(top);
  const d = document.createElement('div'); d.id = 'dock'; d.innerHTML = '<div id="trackname"></div><div class="btns"><button id="dprev" aria-label="上一首 previous song">⏮</button><button id="dplay" aria-label="播放"><svg viewBox="0 0 100 100" aria-hidden="true"><path class="pl" d="M38 28 L74 50 L38 72 Z"/><path class="pa" d="M33 28h11v44H33zM56 28h11v44H56z"/></svg></button><button id="dnext" aria-label="下一首 next song">⏭</button></div>';
  document.body.appendChild(d);
  const strip = document.createElement('div'); strip.className = 'row artrow'; strip.innerHTML = '<span class="lab" data-zh="換畫" data-en="Painting"></span><div id="artstrip"></div>';
  ARTS.forEach(a => { const b = document.createElement('button'); b.dataset.id = a.id; b.title = a.en; b.innerHTML = `<img src="${a.thumb}" alt="${a.en}" loading="lazy" decoding="async">`; b.onclick = e => { e.stopPropagation(); setArt(ARTS.indexOf(a)); }; strip.lastChild.appendChild(b); });
  const pr = $('#panel .presets'); pr.parentNode.insertBefore(strip, pr.nextSibling);
  const stop = e => e.stopPropagation();
  for (const el of [top, d]) { el.addEventListener('pointerdown', stop); el.addEventListener('pointerup', stop); el.addEventListener('click', stop); }
  $('#aprev').onclick = () => setArt(ARTS.indexOf(ART) - 1); $('#anext').onclick = () => setArt(ARTS.indexOf(ART) + 1);
  $('#dplay').onclick = () => togglePlay(); $('#dprev').onclick = () => setTrack(TRACKS.indexOf(TR) - 1); $('#dnext').onclick = () => setTrack(TRACKS.indexOf(TR) + 1);
  addEventListener('keydown', e => { if (e.target && e.target.closest && e.target.closest('input')) return; if (e.key === 'ArrowRight') setArt(ARTS.indexOf(ART) + 1); else if (e.key === 'ArrowLeft') setArt(ARTS.indexOf(ART) - 1); else if (e.key === ' ') { e.preventDefault(); togglePlay(); } });
  $('#lang').addEventListener('click', () => setTimeout(() => { artLabel(); trackLabel(); updatePlayLabel(); top.querySelector('.lab80').textContent = top.querySelector('.lab80').dataset[S.lang]; }, 0));
  top.querySelector('.lab80').textContent = top.querySelector('.lab80').dataset[S.lang]; strip.firstChild.textContent = strip.firstChild.dataset[S.lang];
  if (audio.getAttribute('src') !== TR.src) { audio.src = TR.src; }
  artLabel(); trackLabel(); updatePlayLabel();
  if (ART.id !== 'sun') setArt(ARTS.indexOf(ART), true); else { const pi = $('#painting'); const go = () => applyArtGeometry(pi); if (pi.complete && pi.naturalWidth) go(); else pi.addEventListener('load', go, { once: true }); preload(ARTS[1]); }
})();

/* ---------- v2476.81: movable / resizable / duplicable 柔光呼吸 rings, local import, per-painting signature effects ---------- */
var RE81 = { on: false, list: [], sel: 0, pts: new Map(), g: null, fxu: 0, fxt: 0, n: 0 };
S.sig = true;
const ringKey = () => 'ae-premium-rings-' + ART.id;
const defRings = () => [{ x: SUN.x, y: SUN.y, r: 0.30 }];
function loadRings81() { let l = null; try { l = JSON.parse(localStorage.getItem(ringKey()) || 'null'); } catch (e) {} RE81.list = Array.isArray(l) && l.length && l.every(q => [q.x, q.y, q.r].every(Number.isFinite)) ? l.slice(0, 6) : defRings(); RE81.sel = Math.min(RE81.sel, RE81.list.length - 1); }
function saveRings81() { if (ART.user) return; try { localStorage.setItem(ringKey(), JSON.stringify(RE81.list.map(q => ({ x: +q.x.toFixed(4), y: +q.y.toFixed(4), r: +q.r.toFixed(4) })))); } catch (e) {} }
function drawRings81(c, now, I) {
  if (!RE81 || (!S.aura && !RE81.on)) return; const p = L.p, k = L.dpr;
  RE81.list.forEach((q, n) => {
    const cx = p.x + p.w * q.x, cy = p.y + p.h * q.y, off = n * 0.9; // each copy breathes with the beat, slightly staggered
    const br = S.playing ? 0.5 + 0.5 * Math.cos(6.2832 * ((A.count + Math.min(1, A.phase)) / 8) + off) : 0.5 + 0.5 * Math.sin(now / 1000 * 1.4 * S.speed + off);
    const rad = p.w * (q.r + 0.012 * br + 0.022 * A.kick) * (q.r / 0.30 < 1 ? 1 : 1), a = Math.min(1, (0.55 + 0.15 * br + 0.4 * A.kick) * (0.5 + I));
    const gr = c.createRadialGradient(cx, cy, rad * 0.82, cx, cy, rad * 1.12);
    gr.addColorStop(0, 'rgba(255,214,150,0)'); gr.addColorStop(0.5, `rgba(255,226,170,${a * 0.6})`); gr.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, rad * 1.12, 0, 6.2832); c.fill();
    c.strokeStyle = `rgba(255,250,232,${a})`; c.lineWidth = Math.max(2, p.w * .006); c.shadowColor = 'rgba(255,220,150,1)'; c.shadowBlur = PERF.low ? 0 : 14 * k;
    c.beginPath(); c.arc(cx, cy, rad, 0, 6.2832); c.stroke(); c.shadowBlur = 0;
    if (RE81.on) { const R = q.r * p.w, on = n === RE81.sel; c.save(); c.setLineDash([6, 6]); c.lineWidth = on ? 2 : 1; c.strokeStyle = on ? 'rgba(140,220,255,.95)' : 'rgba(140,220,255,.45)'; c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.stroke(); c.setLineDash([]);
      c.fillStyle = on ? 'rgba(140,220,255,.95)' : 'rgba(140,220,255,.5)'; c.beginPath(); c.arc(cx, cy, 5, 0, 6.2832); c.fill();
      if (on) { const hx = cx + R * .7071, hy = cy + R * .7071; c.beginPath(); c.arc(hx, hy, 11, 0, 6.2832); c.fill(); c.strokeStyle = '#0a0806'; c.lineWidth = 2; c.beginPath(); c.moveTo(hx - 5, hy - 5); c.lineTo(hx + 5, hy + 5); c.moveTo(hx + 1, hy + 5); c.lineTo(hx + 5, hy + 5); c.lineTo(hx + 5, hy + 1); c.stroke(); }
      c.restore(); }
  });
}
/* signature effects: registry keyed by ART.fx[].type, so other paintings can get their own later */
const FXR81 = {
  infinity(c, p, f, now, I, E, dt) {
    const ax = p.x + f.a[0] * p.w, ay = p.y + f.a[1] * p.h, bx = p.x + f.b[0] * p.w, by = p.y + f.b[1] * p.h;
    const mx = (ax + bx) / 2, my = (ay + by) / 2, hl = Math.hypot(bx - ax, by - ay) / 2, an = Math.atan2(by - ay, bx - ax), ca = Math.cos(an), sa = Math.sin(an);
    const Sx = hl / 0.62, Sy = Sx * (f.sy || 1.1), sc = p.w / 400;
    const pt = t => { const s1 = Math.sin(t), c1 = Math.cos(t), d = 1 + s1 * s1, X = c1 / d * Sx, Y = s1 * c1 / d * Sy; return [mx + X * ca - Y * sa, my + X * sa + Y * ca]; }; // lemniscate: lobes centred on the two hearts
    const hue0 = (now * 0.03 + (A.count || 0) * 28) % 360, N = PERF.low ? 72 : 132, CH = 18, P = []; for (let i = 0; i <= N; i++) P.push(pt(i / N * 6.2832));
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [lw, al] of [[9 * sc, .10 + .14 * E], [3.2 * sc, .30 + .30 * E], [1.2 * sc, .65 + .35 * E]]) {
      c.lineWidth = lw; for (let k = 0; k < CH; k++) { const i0 = Math.floor(k * N / CH), i1 = Math.floor((k + 1) * N / CH); c.strokeStyle = `hsla(${(hue0 + k / CH * 360) % 360},100%,66%,${Math.min(1, al * (0.5 + I))})`; c.beginPath(); c.moveTo(P[i0][0], P[i0][1]); for (let i = i0 + 1; i <= i1; i++) c.lineTo(P[i][0], P[i][1]); c.stroke(); } }
    RE81.fxu = (RE81.fxu + Math.min(dt, 100) / 1000 * (0.045 + 0.06 * S.speed + 0.35 * E)) % 1; // flow speeds up on every beat
    const M = PERF.low ? 16 : 30;
    for (let j = 0; j < M; j++) { const u = (j / M + RE81.fxu) % 1, big = j % 5 === 0, hue = (hue0 + u * 360 + 180) % 360;
      for (let tr = 0; tr < (PERF.low ? 2 : 4); tr++) { const [x, y] = pt((u - tr * 0.006) * 6.2832), rr = (big ? 2.6 : 1.5) * sc * (1 + 1.2 * E) * (1 - tr * 0.22), a = (0.75 + 0.25 * E) * (1 - tr * 0.28);
        c.fillStyle = `hsla(${hue},100%,${tr ? 70 : 88}%,${a})`; c.beginPath(); c.arc(x, y, rr, 0, 6.2832); c.fill(); if (!tr && big) { c.fillStyle = `hsla(${hue},100%,70%,${.18 + .25 * E})`; c.beginPath(); c.arc(x, y, rr * 4, 0, 6.2832); c.fill(); } } }
    c.restore();
  }
};
function drawSig81(c, now, I) { if (!RE81) return; const dt = now - (RE81.fxt || now); RE81.fxt = now; if (!S.sig || !ART.fx || saved) return; const E = S.playing ? Math.min(1, A.kick) : 0.25 + 0.15 * Math.sin(now / 700);
  for (const f of ART.fx) { const fn = FXR81[f.type]; if (fn) fn(c, L.p, f, now, I, E, dt); } }
function sigSync81() { let v = null; try { v = localStorage.getItem('ae-premium-sig-' + ART.id); } catch (e) {} S.sig = v !== '0'; const row = $('#sigrow'), b = $('#sigbtn'); if (row) row.hidden = !ART.fx; if (b) { b.classList.toggle('on', S.sig); b.setAttribute('aria-pressed', String(S.sig)); } }
function toast81(zh, en) { const t = $('#toast81'); if (!t) return; t.textContent = S.lang === 'en' ? en : zh; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 4200); }
function ringEdit81(on) { RE81.on = !!on; document.body.classList.toggle('ringedit', RE81.on); if (RE81.on) { S.aura = true; resetZoom(); hideUI(true); syncButtons(); } else saveRings81(); ringBar81(); }
function ringBar81() { const n = RE81.list.length; const d = $('#rdup'), x = $('#rdel'); if (d) d.disabled = n >= 6; if (x) x.disabled = n <= 1; const c = $('#rcount'); if (c) c.textContent = n + '/6'; }
function toStage81(e) { const r = $('#stage').getBoundingClientRect(); return { x: (e.clientX - r.left) * L.W / (r.width || 1), y: (e.clientY - r.top) * L.H / (r.height || 1) }; }
function thumb81(a) { const b = document.createElement('button'); b.dataset.id = a.id; b.title = a.en; const im = document.createElement('img'); im.src = a.thumb; im.alt = a.en; im.loading = 'lazy'; im.decoding = 'async'; b.appendChild(im); b.onclick = e => { e.stopPropagation(); setArt(ARTS.indexOf(a)); }; const st = $('#artstrip'); if (st) st.appendChild(b); }
function importImage81(f) {
  const heic = /hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name), base = f.name.replace(/\.[^.]+$/, '').slice(0, 28) || 'image', url = URL.createObjectURL(f), img = new Image();
  img.onload = () => { const a = { id: 'user-img-' + (++RE81.n), zh: '我的圖片 · ' + base, en: 'My image · ' + base, src: url, thumb: url, w: img.naturalWidth, h: img.naturalHeight, user: true }; a._img = img; ARTS.push(a); thumb81(a); setArt(ARTS.length - 1); toast81('已載入「' + base + '」— 只在你的裝置上，不會上傳', 'Loaded "' + base + '" — stays on your device, never uploaded'); };
  img.onerror = () => { URL.revokeObjectURL(url); if (heic) toast81('這個瀏覽器無法開啟 HEIC 圖片，請先轉成 JPG 或 PNG 再匯入', 'This browser can’t open HEIC — please convert to JPG or PNG first'); else toast81('無法開啟這個圖片檔', 'Couldn’t open this image file'); };
  img.src = url;
}
function importSong81(f) {
  const base = f.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'song', url = URL.createObjectURL(f);
  if (f.type && !audio.canPlayType(f.type) && !/\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|webm|mp4)$/i.test(f.name)) { URL.revokeObjectURL(url); toast81('這個瀏覽器無法播放這種音訊格式', 'This browser can’t play this audio format'); return; }
  const t = { id: 'user-song-' + (++RE81.n), zh: '我的歌 · ' + base, en: 'My song · ' + base, src: url, beats: 'live', cue: 0, user: true }; TRACKS.push(t); setTrack(TRACKS.length - 1);
  toast81('已加入「' + base + '」— 即時節拍分析，只在你的裝置上', 'Added "' + base + '" — live beat sync, stays on your device');
}
(function ui81() {
  const ov = document.createElement('div'); ov.id = 'ringedit'; document.body.appendChild(ov);
  const bar = document.createElement('div'); bar.id = 'ringbar'; bar.innerHTML = '<button id="rdup" data-zh="＋ 複製光環" data-en="＋ Duplicate ring"></button><button id="rdel" data-zh="刪除" data-en="Delete"></button><button id="rreset" data-zh="重設" data-en="Reset"></button><span id="rcount"></span><button id="rdone" data-zh="✓ 完成" data-en="✓ Done"></button><div class="rtip" data-zh="拖曳移動 · 雙指或拖曳藍點縮放 · 滾輪也可縮放" data-en="Drag to move · pinch or drag the blue dot to resize · wheel resizes"></div>';
  document.body.appendChild(bar);
  const tst = document.createElement('div'); tst.id = 'toast81'; tst.setAttribute('role', 'status'); document.body.appendChild(tst);
  const fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'image/*,.heic,.heif'; fi.hidden = true; fi.id = 'fimg';
  const fa = document.createElement('input'); fa.type = 'file'; fa.accept = 'audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac'; fa.hidden = true; fa.id = 'fsong';
  document.body.append(fi, fa);
  const rows = document.createElement('div'); rows.innerHTML =
    '<div class="row presets r81" id="ringrow"><span class="lab" data-zh="光環" data-en="Rings"></span><button class="pr b81" id="redit" data-zh="✥ 編輯光環（移動 / 縮放 / 複製）" data-en="✥ Edit rings (move / resize / copy)"></button></div>' +
    '<div class="row presets r81" id="sigrow"><span class="lab" data-zh="專屬" data-en="Signature"></span><button class="pr b81" id="sigbtn" data-zh="♾️ 專屬光效" data-en="♾️ Signature light"></button></div>' +
    '<div class="row presets r81" id="improw"><span class="lab" data-zh="匯入" data-en="Import"></span><button class="pr b81" id="isong" data-zh="🎵 匯入歌曲" data-en="🎵 Import song"></button><button class="pr b81" id="iimg" data-zh="🖼 匯入圖片" data-en="🖼 Import image"></button><div class="note81" id="impnote84" data-zh="檔案只在你的裝置上播放與顯示，不會上傳到伺服器。" data-en="Files stay on your device and are never uploaded."></div></div>';
  const after = $('#panel .artrow') || $('#panel .presets'); let ref = after; for (const el of [...rows.children]) { ref.parentNode.insertBefore(el, ref.nextSibling); ref = el; }
  const lab = () => document.querySelectorAll('#ringbar [data-zh], .r81 [data-zh]').forEach(e => { e.textContent = e.dataset[S.lang] || e.dataset.zh; });
  lab(); $('#lang').addEventListener('click', () => setTimeout(lab, 0));
  for (const el of [bar, tst]) { el.addEventListener('pointerdown', e => e.stopPropagation()); el.addEventListener('click', e => e.stopPropagation()); }
  $('#redit').onclick = e => { e.stopPropagation(); ringEdit81(true); };
  $('#rdone').onclick = () => ringEdit81(false);
  $('#rdup').onclick = () => { if (RE81.list.length >= 6) return; const q = RE81.list[RE81.sel] || defRings()[0]; RE81.list.push({ x: Math.min(.95, q.x + .08), y: Math.min(.95, q.y + .06), r: Math.max(.06, q.r * .7) }); RE81.sel = RE81.list.length - 1; saveRings81(); ringBar81(); };
  $('#rdel').onclick = () => { if (RE81.list.length <= 1) return; RE81.list.splice(RE81.sel, 1); RE81.sel = Math.max(0, RE81.sel - 1); saveRings81(); ringBar81(); };
  $('#rreset').onclick = () => { RE81.list = defRings(); RE81.sel = 0; try { localStorage.removeItem(ringKey()); } catch (e) {} ringBar81(); };
  $('#sigbtn').onclick = e => { e.stopPropagation(); S.sig = !S.sig; try { localStorage.setItem('ae-premium-sig-' + ART.id, S.sig ? '1' : '0'); } catch (er) {} sigSync81(); };
  $('#isong').onclick = e => { e.stopPropagation(); fa.click(); }; $('#iimg').onclick = e => { e.stopPropagation(); fi.click(); };
  fi.onchange = () => { const f = fi.files && fi.files[0]; if (f) importImage81(f); fi.value = ''; };
  fa.onchange = () => { const f = fa.files && fa.files[0]; if (f) importSong81(f); fa.value = ''; };
  audio.addEventListener('error', () => { if (TR.user) toast81('無法播放這個音訊檔', 'Couldn’t play this audio file'); });
  // edit-mode gestures live on their own layer, so dragging never fires tap lasers
  const hit = pt => { const p = L.p; for (let n = RE81.list.length - 1; n >= 0; n--) { const q = RE81.list[n], cx = p.x + p.w * q.x, cy = p.y + p.h * q.y, R = q.r * p.w; if (n === RE81.sel && Math.hypot(pt.x - (cx + R * .7071), pt.y - (cy + R * .7071)) < 24) return { n, m: 'resize' }; if (Math.hypot(pt.x - cx, pt.y - cy) < Math.max(30, R * 1.08)) return { n, m: 'move', dx: pt.x - cx, dy: pt.y - cy }; } return null; };
  ov.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { ov.setPointerCapture(e.pointerId); } catch (er) {} const pt = toStage81(e); RE81.pts.set(e.pointerId, pt);
    if (RE81.pts.size === 1) { const h = hit(pt); if (h) RE81.sel = h.n; RE81.g = h; }
    else if (RE81.pts.size === 2) { const [a, b] = [...RE81.pts.values()]; const q = RE81.list[RE81.sel]; RE81.g = { m: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, r0: q ? q.r : .3 }; } });
  ov.addEventListener('pointermove', e => { if (!RE81.pts.has(e.pointerId)) return; const pt = toStage81(e); RE81.pts.set(e.pointerId, pt); const g = RE81.g, q = RE81.list[RE81.sel], p = L.p; if (!g || !q) return;
    if (g.m === 'move') { q.x = Math.min(1.05, Math.max(-.05, (pt.x - g.dx - p.x) / p.w)); q.y = Math.min(1.05, Math.max(-.05, (pt.y - g.dy - p.y) / p.h)); }
    else if (g.m === 'resize') q.r = Math.min(.8, Math.max(.04, Math.hypot(pt.x - (p.x + p.w * q.x), pt.y - (p.y + p.h * q.y)) / p.w));
    else if (g.m === 'pinch' && RE81.pts.size >= 2) { const [a, b] = [...RE81.pts.values()]; q.r = Math.min(.8, Math.max(.04, g.r0 * Math.hypot(a.x - b.x, a.y - b.y) / g.d0)); } });
  const up = e => { RE81.pts.delete(e.pointerId); if (!RE81.pts.size) { RE81.g = null; saveRings81(); } else if (RE81.g && RE81.g.m === 'pinch') RE81.g = null; };
  ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
  ov.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); const q = RE81.list[RE81.sel]; if (q) { q.r = Math.min(.8, Math.max(.04, q.r * Math.exp(-e.deltaY * 0.0015))); clearTimeout(RE81.wt); RE81.wt = setTimeout(saveRings81, 300); } }, { passive: false });
  ov.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  addEventListener('keydown', e => { if (e.key === 'Escape' && RE81.on) ringEdit81(false); });
  loadRings81(); sigSync81(); ringBar81();
})();
(function ex81() { if (window.__premium) Object.assign(window.__premium, { RE81, ringEdit81, importImage81, importSong81, FXR81, sigSync81, saveRings81, loadRings81 }); else setTimeout(ex81, 50); })();
// ===== v82: 一般/進階 label, ring-spin reward game, imported-song trim loop =====
(function adv82() {
  const b = $('#adv'); if (!b) return;
  const sync = () => { const on = document.body.classList.contains('adv-open'); b.dataset.zh = on ? '‹ 一般設定' : '進階設定 ›'; b.dataset.en = on ? '‹ Basic settings' : 'Advanced settings ›'; const t = b.dataset[S.lang] || b.dataset.zh; if (b.textContent !== t) b.textContent = t; };
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const lg = $('#lang'); if (lg) lg.addEventListener('click', () => setTimeout(sync, 0));
  sync();
})();
var SPIN82 = { s: null, last: 0, hits: [], tiers: [
  { n: 5, win: 6000, zh: '🎉 達成：光環旋風 5 圈！', en: '🎉 Unlocked: Halo Whirl ×5!', gzh: '小星星精靈', gen: 'Little Star Sprite', img: 'star', notes: [72, 76, 79, 84] },
  { n: 10, win: 12000, zh: '💖 達成：光環龍捲風 10 圈！', en: '💖 Unlocked: Halo Tornado ×10!', gzh: '愛心小熊', gen: 'Heart Bear', img: 'bear', notes: [67, 71, 74, 79, 83, 86] },
  { n: 20, win: 24000, zh: '🌸 傳說達成：光環銀河 20 圈！', en: '🌸 Legendary: Halo Galaxy ×20!', gzh: '永恆之花', gen: 'Eternal Flower', img: 'flower', notes: [60, 64, 67, 72, 76, 79, 84, 88] }] };
function spinStart82(cx, cy, x, y) { SPIN82.s = { cx, cy, a: Math.atan2(y - cy, x - cx), acc: 0, t0: performance.now(), tm: performance.now(), got: 0 }; }
function spinMove82(x, y) { try { const s = SPIN82.s; if (!s) return; const now = performance.now(); if (Math.hypot(x - s.cx, y - s.cy) < 8) return;
  const a = Math.atan2(y - s.cy, x - s.cx); let d = a - s.a; if (d > Math.PI) d -= 6.2832; else if (d < -Math.PI) d += 6.2832; s.a = a; if (Math.abs(d) > 2.3) { if (Math.abs(s.acc) > 1.5 && Math.sign(d) !== Math.sign(s.acc)) d += Math.sign(s.acc) * 6.2832; else return; } // janky frame: big jump continues the current direction
  if (Math.abs(d) > 0.004) { if (s.acc && Math.sign(d) !== Math.sign(s.acc) && Math.abs(s.acc) > 1) { spinStart82(s.cx, s.cy, x, y); return; } s.acc += d; s.tm = now; }
  else if (now - s.tm > 1200) { spinStart82(s.cx, s.cy, x, y); return; }
  (s.h || (s.h = [])).push([now, s.acc]); while (s.h.length > 2 && now - s.h[0][0] > 25000) s.h.shift();
  for (let k = SPIN82.tiers.length - 1; k >= s.got; k--) { const T = SPIN82.tiers[k]; let base = s.h[0]; if (now - s.t0 > T.win) { for (const hh of s.h) if (now - hh[0] <= T.win) { base = hh; break; } } else base = [s.t0, 0];
    if (Math.abs(s.acc - base[1]) / 6.2832 >= T.n && now - SPIN82.last > 2500) { s.got = k + 1; reward82(k); break; } }
  } catch (e) { SPIN82.s = null; } }
function spinEnd82() { SPIN82.s = null; }
function chime82(notes) { try { const c = acx(), t0 = c.currentTime + 0.03; const out = c.createGain(); out.gain.value = 0.55; const cmp = c.createDynamicsCompressor(); cmp.threshold.value = -18; cmp.ratio.value = 4; out.connect(cmp); cmp.connect(c.destination);
  notes.forEach((m, i) => { const f = 440 * Math.pow(2, (m - 69) / 12), t = t0 + i * 0.095;
    [['sine', 1, 0.32], ['triangle', 2, 0.06]].forEach(([ty, mul, g0]) => { const o = c.createOscillator(), g = c.createGain(); o.type = ty; o.frequency.value = f * mul; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(g0, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1); o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.2); }); });
  const tl = t0 + notes.length * 0.095; [0, 4, 7, 12].forEach(s => { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = 440 * Math.pow(2, (notes[0] + s - 69) / 12); g.gain.setValueAtTime(0.0001, tl); g.gain.exponentialRampToValueAtTime(0.09, tl + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, tl + 1.8); o.connect(g); g.connect(out); o.start(tl); o.stop(tl + 1.9); });
  } catch (e) {} }
function giftSVG82(kind) {
  if (kind === 'bear') return '<svg viewBox="0 0 120 120" width="120" height="120"><circle cx="34" cy="32" r="14" fill="#d9a06b"/><circle cx="86" cy="32" r="14" fill="#d9a06b"/><circle cx="34" cy="32" r="7" fill="#f6c9a8"/><circle cx="86" cy="32" r="7" fill="#f6c9a8"/><circle cx="60" cy="62" r="38" fill="#e3b07c"/><ellipse cx="60" cy="74" rx="17" ry="13" fill="#f8dcc0"/><circle cx="46" cy="56" r="4.5" fill="#3a2418"/><circle cx="74" cy="56" r="4.5" fill="#3a2418"/><circle cx="47.5" cy="54.5" r="1.4" fill="#fff"/><circle cx="75.5" cy="54.5" r="1.4" fill="#fff"/><ellipse cx="60" cy="69" rx="5" ry="3.6" fill="#3a2418"/><path d="M54 77q6 5 12 0" stroke="#3a2418" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="38" cy="70" r="5" fill="#ff9bb0" opacity=".6"/><circle cx="82" cy="70" r="5" fill="#ff9bb0" opacity=".6"/><path d="M60 112c-14-9-22-16-22-24a8 8 0 0 1 22-5a8 8 0 0 1 22 5c0 8-8 15-22 24z" fill="#ff4f7a"/></svg>';
  if (kind === 'flower') { let p = ''; for (let i = 0; i < 8; i++) p += `<ellipse cx="60" cy="30" rx="13" ry="24" fill="${i % 2 ? '#ffb3d1' : '#ffd36e'}" transform="rotate(${i * 45} 60 60)"/>`; return '<svg viewBox="0 0 120 120" width="120" height="120">' + p + '<circle cx="60" cy="60" r="20" fill="#fff3c4"/><circle cx="53" cy="57" r="3" fill="#3a2418"/><circle cx="67" cy="57" r="3" fill="#3a2418"/><path d="M53 66q7 6 14 0" stroke="#3a2418" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="47" cy="64" r="3.5" fill="#ff8fab" opacity=".7"/><circle cx="73" cy="64" r="3.5" fill="#ff8fab" opacity=".7"/></svg>'; }
  return '<svg viewBox="0 0 120 120" width="120" height="120"><path d="M60 8l14 30 33 4-24 23 6 33-29-16-29 16 6-33-24-23 33-4z" fill="#ffd84d" stroke="#ffb400" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="56" r="4" fill="#3a2418"/><circle cx="70" cy="56" r="4" fill="#3a2418"/><circle cx="51.3" cy="54.6" r="1.3" fill="#fff"/><circle cx="71.3" cy="54.6" r="1.3" fill="#fff"/><path d="M53 66q7 6 14 0" stroke="#3a2418" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="43" cy="64" r="4" fill="#ff8fab" opacity=".7"/><circle cx="77" cy="64" r="4" fill="#ff8fab" opacity=".7"/></svg>';
}
var BURST82 = { cv: null, ps: [], raf: 0 };
function burst82(k) { try {
  let cv = BURST82.cv; if (!cv) { cv = BURST82.cv = document.createElement('canvas'); cv.id = 'burst82'; cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(cv); }
  const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
  const N = [70, 110, 160][k], cols = ['#ffd84d', '#ff6f9f', '#8fe3ff', '#b28bff', '#7dffb2', '#fff'];
  for (let i = 0; i < N; i++) { const a = Math.random() * 6.2832, v = 3 + Math.random() * 7; BURST82.ps.push({ x: W / 2, y: H * 0.42, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, r: 3 + Math.random() * 4, c: cols[i % cols.length], s: i % 3, rot: Math.random() * 6, life: 0, max: 70 + Math.random() * 60 }); }
  if (!BURST82.raf) { let prev = performance.now(); const step = now => { try { const f = Math.min(3, (now - prev) / 16.7); prev = now; const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
      BURST82.ps = BURST82.ps.filter(p => (p.life += f) < p.max); for (const p of BURST82.ps) { p.vy += 0.16 * f; p.vx *= Math.pow(0.985, f); p.x += p.vx * f; p.y += p.vy * f; p.rot += 0.1 * f; c.globalAlpha = Math.max(0, 1 - p.life / p.max); c.fillStyle = p.c; c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        if (p.s === 0) c.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); else if (p.s === 1) { c.beginPath(); for (let j = 0; j < 10; j++) { const rr = j % 2 ? p.r * .45 : p.r * 1.3, aa = j * 0.6283; c.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } c.fill(); } else { const r = p.r * .9; c.beginPath(); c.moveTo(0, r * .8); c.bezierCurveTo(-r * 1.6, -r * .2, -r * .6, -r * 1.4, 0, -r * .5); c.bezierCurveTo(r * .6, -r * 1.4, r * 1.6, -r * .2, 0, r * .8); c.fill(); }
        c.restore(); }
      c.globalAlpha = 1; if (BURST82.ps.length) BURST82.raf = requestAnimationFrame(step); else { BURST82.raf = 0; c.clearRect(0, 0, W, H); } } catch (e) { BURST82.raf = 0; BURST82.ps = []; } }; BURST82.raf = requestAnimationFrame(step); }
  } catch (e) {} }
function reward82(k) { try { const T = SPIN82.tiers[k]; SPIN82.last = performance.now(); SPIN82.hits.push({ k, t: Date.now() });
  burst82(k); chime82(T.notes); toast81(T.zh, T.en);
  let g = $('#gift82'); if (!g) { g = document.createElement('div'); g.id = 'gift82'; g.setAttribute('role', 'dialog'); document.body.appendChild(g); ['pointerdown', 'pointerup', 'click', 'touchstart'].forEach(ev => g.addEventListener(ev, e => e.stopPropagation())); }
  const en = S.lang === 'en'; g.dataset.tier = k + 1;
  g.innerHTML = '<div class="g82in"><div class="g82t">' + (en ? 'Gift · Tier ' + (k + 1) : '獎勵 · 第 ' + (k + 1) + ' 階') + '</div>' + giftSVG82(T.img) + '<div class="g82n">' + (en ? T.gen : T.gzh) + '</div><div class="g82s">' + (en ? T.n + ' turns' + (k < 2 ? ' — keep spinning for more!' : ' — legendary!') : '光環轉了 ' + T.n + ' 圈' + (k < 2 ? ' — 繼續轉還有更多驚喜！' : ' — 傳說級成就！')) + '</div><button id="g82x">' + (en ? 'Collect ✓' : '收下 ✓') + '</button></div>';
  g.classList.add('on'); g.querySelector('#g82x').onclick = () => g.classList.remove('on'); clearTimeout(g._h); g._h = setTimeout(() => g.classList.remove('on'), 9000);
  } catch (e) {} }
(function spinHooks82() { // angles are measured in client (screen) px so beat shake / zoom of #stage can't break the count
  const cl = (sx, sy) => { const r = $('#stage').getBoundingClientRect(); return [r.left + sx * (r.width || 1) / L.W, r.top + sy * (r.height || 1) / L.H]; };
  const ov = $('#ringedit'); if (ov) {
    ov.addEventListener('pointerdown', e => { if (RE81.pts.size !== 1) { spinEnd82(); return; } const q = RE81.list[RE81.sel], p = L.p; if (q && RE81.g) { const [cx, cy] = cl(p.x + p.w * q.x, p.y + p.h * q.y); spinStart82(cx, cy, e.clientX, e.clientY); } });
    ov.addEventListener('pointermove', e => { if (RE81.pts.size === 1 && SPIN82.s) spinMove82(e.clientX, e.clientY); });
    ['pointerup', 'pointercancel'].forEach(ev => ov.addEventListener(ev, spinEnd82)); }
  const st = $('#stage'); if (st) { // simple drag on a visible ring (outside edit mode): observe only
    st.addEventListener('pointerdown', e => { try { if (RE81.on || !S.aura || !e.isPrimary) return; const pt = toStage81(e), p = L.p; for (const q of RE81.list) { const cx = p.x + p.w * q.x, cy = p.y + p.h * q.y, R = q.r * p.w; if (Math.hypot(pt.x - cx, pt.y - cy) < Math.max(40, R * 1.25)) { const [x, y] = cl(cx, cy); spinStart82(x, y, e.clientX, e.clientY); return; } } } catch (er) {} });
    st.addEventListener('pointermove', e => { if (!RE81.on && SPIN82.s && e.isPrimary) spinMove82(e.clientX, e.clientY); });
    ['pointerup', 'pointercancel'].forEach(ev => st.addEventListener(ev, () => { if (!RE81.on) spinEnd82(); })); }
})();
// --- imported song trim loop (session only) ---
const fmt82 = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); };
function trimGet82() { const d = audio.duration; if (!TR || !TR.user || !Number.isFinite(d)) return null; const t = TR.trim || (TR.trim = { a: 0, b: d }); t.b = Math.min(t.b, d); return t; }
function trimSet82(a, b) { const d = audio.duration; if (!TR || !TR.user || !Number.isFinite(d)) return; a = Math.max(0, Math.min(d - 0.5, a)); b = Math.max(a + 0.5, Math.min(d, b)); TR.trim = { a, b }; TR.cue = a; if (audio.currentTime < a || audio.currentTime > b) try { audio.currentTime = a; } catch (e) {} trimUI82(); }
function trimUI82() { const row = $('#trimrow'); if (!row) return; const t = trimGet82(); row.hidden = !t; if (!t) return; const d = audio.duration, A = $('#trA'), B = $('#trB');
  A.max = B.max = d.toFixed(1); if (document.activeElement !== A) A.value = t.a.toFixed(1); if (document.activeElement !== B) B.value = t.b.toFixed(1); $('#trAv').textContent = fmt82(t.a); $('#trBv').textContent = fmt82(t.b); $('#trLen').textContent = (S.lang === 'en' ? 'Loop ' : '循環 ') + fmt82(t.b - t.a); }
function trimTick82() { try { const t = TR && TR.user && TR.trim; if (!t || audio.paused) return; const ct = audio.currentTime; if (ct >= t.b - 0.03) { if (RP84.mode === 'one' || (TRACKS.length < 2 && RP84.mode !== 'stop')) audio.currentTime = t.a; else end84('trim'); } else if (ct < t.a - 0.25) audio.currentTime = t.a; } catch (e) {} }
(function trim82() {
  const imp = $('#improw'); if (!imp) return; const row = document.createElement('div'); row.className = 'row presets r81'; row.id = 'trimrow'; row.hidden = true;
  row.innerHTML = '<span class="lab" data-zh="剪輯" data-en="Trim"></span><div class="tr82"><label><span data-zh="開始" data-en="Start"></span> <b id="trAv">0:00.0</b><input id="trA" type="range" min="0" step="0.1" value="0" aria-label="trim start"></label><button class="pr b81" id="trAn" data-zh="⤓ 設為目前位置" data-en="⤓ Set from current"></button>' +
    '<label><span data-zh="結束" data-en="End"></span> <b id="trBv">0:00.0</b><input id="trB" type="range" min="0" step="0.1" value="0" aria-label="trim end"></label><button class="pr b81" id="trBn" data-zh="⤒ 設為目前位置" data-en="⤒ Set from current"></button>' +
    '<span id="trLen"></span><button class="pr b81" id="trX" data-zh="↺ 整首" data-en="↺ Whole song"></button><div class="note81" data-zh="只循環播放選取的段落（例如副歌）；只在這次瀏覽有效，檔案不會上傳。" data-en="Loops only the chosen part (e.g. the chorus); this session only, never uploaded."></div></div>';
  imp.parentNode.insertBefore(row, imp.nextSibling);
  const lab = () => row.querySelectorAll('[data-zh]').forEach(e => { e.textContent = e.dataset[S.lang] || e.dataset.zh; }); lab(); $('#lang').addEventListener('click', () => setTimeout(() => { lab(); trimUI82(); }, 0));
  ['pointerdown', 'click'].forEach(ev => row.addEventListener(ev, e => e.stopPropagation()));
  $('#trA').addEventListener('input', e => { const t = trimGet82(); if (t) { trimSet82(+e.target.value, t.b); try { audio.currentTime = TR.trim.a; } catch (er) {} } });
  $('#trB').addEventListener('input', e => { const t = trimGet82(); if (t) { trimSet82(t.a, +e.target.value); try { audio.currentTime = Math.max(TR.trim.a, TR.trim.b - 2); } catch (er) {} } });
  $('#trAn').onclick = () => { const t = trimGet82(); if (t) trimSet82(audio.currentTime, t.b); };
  $('#trBn').onclick = () => { const t = trimGet82(); if (t) trimSet82(t.a, audio.currentTime); };
  $('#trX').onclick = () => { if (TR && TR.user) { TR.trim = null; TR.cue = 0; trimUI82(); } };
  ['loadedmetadata', 'durationchange', 'emptied'].forEach(ev => audio.addEventListener(ev, trimUI82));
  audio.addEventListener('timeupdate', trimTick82); setInterval(trimTick82, 60);
  // v84: 'ended' handled by the repeat modes (end84)
  audio.addEventListener('play', () => { const t = TR && TR.user && TR.trim; if (t && (audio.currentTime < t.a || audio.currentTime >= t.b)) try { audio.currentTime = t.a; } catch (e) {} });
})();
(function ex82() { if (window.__premium) Object.assign(window.__premium, { SPIN82, reward82, spinStart82, spinMove82, trimSet82, trimGet82 }); else setTimeout(ex82, 50); })();

/* ===================== v2476.83 =====================
   原畫風情 default · tabs · outside-tap close · swipe / side buttons · first-visit hint · slideshow + transitions ·
   overview grid · multi-song import · tempo-aware softening + slow-song suggestion. Painting pixels are never altered:
   transitions only move / fade the whole <img> display, every light is still an overlay. */
var V83 = { soft: false, sug: {}, pt: 0, lastT: 0, ss: { on: false, iv: 15, tr: 'fade', t: 0 }, grid: 'ratio', swipes: 0, busy: false };
const tx83 = (zh, en) => S.lang === 'en' ? en : zh;
const ls83 = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
const stopAll83 = el => ['pointerdown', 'pointerup', 'click', 'touchstart'].forEach(ev => el.addEventListener(ev, e => e.stopPropagation()));
const lab83 = root => (root || document).querySelectorAll('[data-zh]').forEach(e => { e.textContent = e.dataset[S.lang] || e.dataset.zh; });
try { const o = JSON.parse(ls83('ae-premium-ss83') || 'null'); if (o) Object.assign(V83.ss, { iv: [8, 15, 30].includes(o.iv) ? o.iv : 15, tr: ['fade', 'slide', 'zoom', 'glow'].includes(o.tr) ? o.tr : 'fade', on: false }); } catch (e) {}
V83.grid = ls83('ae-premium-grid83') === 'square' ? 'square' : 'ratio';

/* ---- painting change with a whole-image transition ---- */
async function goArt83(i, dir, tr) {
  if (V83.busy) return; const n = ARTS.length; i = ((i % n) + n) % n; if (ARTS[i] === ART) return; tr = tr || V83.ss.tr; dir = dir || 1;
  V83.busy = true; V83.ss.t = performance.now();
  try {
    const img = preload(ARTS[i]); try { await (img.decode ? img.decode() : Promise.resolve()); } catch (e) {}
    const art = $('#art'), old = $('#painting'), p = { ...L.p }, gh = document.createElement('img');
    gh.className = 'ghost83'; gh.alt = ''; gh.draggable = false; gh.src = old.currentSrc || old.src; Object.assign(gh.style, { left: p.x + 'px', top: p.y + 'px', width: p.w + 'px', height: p.h + 'px' }); art.after(gh);
    art.style.opacity = '0'; await setArt(i, true); art.style.opacity = '';
    const D = tr === 'glow' ? 1200 : tr === 'slide' ? 620 : 900, ez = 'cubic-bezier(.4,0,.2,1)', W = innerWidth * (dir < 0 ? -1 : 1);
    let ka, kb, del = 0;
    if (tr === 'slide') { ka = [{ transform: 'translateX(0)' }, { transform: `translateX(${-W}px)` }]; kb = [{ transform: `translateX(${W}px)` }, { transform: 'translateX(0)' }]; }
    else if (tr === 'zoom') { ka = [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.08)', opacity: 0 }]; kb = [{ transform: 'scale(.93)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }]; }
    else if (tr === 'glow') { ka = [{ opacity: 1 }, { opacity: 0 }]; kb = [{ opacity: 0 }, { opacity: 1 }]; del = D * 0.3; }
    else { ka = [{ opacity: 1 }, { opacity: 0 }]; kb = [{ opacity: 0 }, { opacity: 1 }]; }
    const a1 = gh.animate(ka, { duration: tr === 'glow' ? D * 0.55 : D, easing: ez, fill: 'forwards' }); art.animate(kb, { duration: tr === 'glow' ? D * 0.7 : D, delay: del, easing: ez, fill: 'backwards' });
    if (tr === 'glow') { const f = document.createElement('div'); f.className = 'flash83'; const q = L.p, R = Math.max(q.w, q.h) * 0.75; Object.assign(f.style, { left: (q.x + q.w / 2 - R) + 'px', top: (q.y + q.h / 2 - R) + 'px', width: 2 * R + 'px', height: 2 * R + 'px' }); $('#stage').appendChild(f);
      f.animate([{ opacity: 0, transform: 'scale(.55)' }, { opacity: .9, transform: 'scale(1)', offset: .42 }, { opacity: 0, transform: 'scale(1.2)' }], { duration: D, easing: 'ease-in-out' }).onfinish = () => f.remove(); }
    a1.onfinish = () => gh.remove(); setTimeout(() => gh.remove(), D + 300);
    await new Promise(r => setTimeout(r, Math.min(D, 500)));
  } finally { V83.busy = false; V83.ss.t = performance.now(); gridMark83(); }
}

/* ---- tabs in the settings panel + outside tap closes it ---- */
(function tabs83() {
  const panel = $('#panel'); if (!panel) return;
  const T = [['mode', '模式 / 燈光', 'Mode / Light'], ['music', '音樂', 'Music'], ['art', '畫作', 'Paintings'], ['fx', '進階 / 特效', 'Advanced / FX']];
  const bar = document.createElement('div'); bar.className = 'tabs83'; bar.setAttribute('role', 'tablist');
  bar.innerHTML = T.map(([k, zh, en]) => `<button role="tab" data-tab="${k}" data-zh="${zh}" data-en="${en}"></button>`).join('');
  $('#close').after(bar);
  // music tab: song list, tempo readout, credit
  const songs = document.createElement('div'); songs.className = 'row presets'; songs.id = 'songs83'; songs.innerHTML = '<span class="lab" data-zh="歌曲" data-en="Songs"></span><div id="songlist83"></div><div id="tempo83" class="note81"></div><div class="note81" id="credit83"></div>';
  // art tab: overview + slideshow
  const artc = document.createElement('div'); artc.className = 'row presets'; artc.id = 'ss83';
  artc.innerHTML = '<span class="lab" data-zh="瀏覽" data-en="Browse"></span><button class="pr b81" id="gridbtn83" data-zh="▦ 總覽" data-en="▦ Overview"></button><button class="pr b81" id="sson83" aria-pressed="false" data-zh="▶ 自動播放" data-en="▶ Slideshow"></button>' +
    '<div class="seg83" id="ssiv83" role="group"><button data-v="8">8s</button><button data-v="15">15s</button><button data-v="30">30s</button></div>' +
    '<div class="seg83" id="sstr83" role="group"><button data-v="fade" data-zh="淡入淡出" data-en="Crossfade"></button><button data-v="slide" data-zh="滑動" data-en="Slide"></button><button data-v="zoom" data-zh="縮放漸變" data-en="Zoom fade"></button><button data-v="glow" data-zh="光暈過場" data-en="Glow"></button></div>' +
    '<div class="note81" data-zh="手機：在畫上左右滑動換畫 · 電腦：畫作兩側 ‹ › 或鍵盤 ← →" data-en="Phone: swipe left/right on the art · Desktop: ‹ › beside the art or ← → keys"></div>';
  const artrow = $('#panel .artrow'); if (artrow) artrow.after(artc); else panel.appendChild(artc);
  const imp = $('#improw'); if (imp) { imp.before(songs); const ib = $('#iimg'); if (ib) artc.querySelector('#sson83').before(ib); const lb = imp.querySelector('.lab'); if (lb) { lb.dataset.zh = '匯入'; lb.dataset.en = 'Import'; } const sb = $('#isong'); if (sb) { sb.dataset.zh = '🎵 匯入歌曲（可多選）'; sb.dataset.en = '🎵 Import songs (multi-select)'; } } else panel.appendChild(songs);
  const set = (sel, k) => document.querySelectorAll(sel).forEach(r => { r.dataset.t83 = k; });
  set('#panel .row', 'fx');
  const pres = [...document.querySelectorAll('#panel .row.presets')].find(r => r.querySelector('.pr[data-p]')); if (pres) pres.dataset.t83 = 'mode';
  set('#panel .keeprow, #panel #lamps, #panel #styles', 'mode'); const ir = $('#int') && $('#int').closest('.row'); if (ir) ir.dataset.t83 = 'mode';
  set('#panel .row.prog, #panel .row.sync, #panel #improw, #panel #trimrow, #panel #songs83', 'music');
  set('#panel .artrow, #panel #ss83', 'art');
  // redundant controls removed: 進階 › toggle (replaced by tabs), the duplicate ▶ button (dock has play), the "tap to customize" pill (first-visit hint replaces it)
  for (const id of ['#adv', '#play', '#openhint']) { const el = $(id); if (el) el.hidden = true; }
  document.body.classList.add('tabs83');
  const pick = k => { panel.dataset.tab = k; bar.querySelectorAll('button').forEach(b => { const on = b.dataset.tab === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }); ls83('ae-premium-tab83', k); panel.scrollTop = 0; };
  bar.addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) { e.stopPropagation(); pick(b.dataset.tab); } });
  pick(['mode', 'music', 'art', 'fx'].includes(ls83('ae-premium-tab83')) ? ls83('ae-premium-tab83') : 'mode');
  V83.pickTab = pick;
  // outside tap / click closes the panel (capture: runs before the painting gets the tap; that tap is then swallowed)
  document.addEventListener('pointerdown', e => { if (!document.body.classList.contains('ui')) return; const t = e.target; if (t && t.closest && t.closest('#panel,#open,#hint83,#grid83,#sug83,#toast81,#gift82,#ringbar,#cardview')) return; window.__closedAt83 = performance.now(); hideUI(true); }, true);
  lab83(panel);
})();

/* ---- song list, multi import, tempo readout ---- */
function songs83() {
  const box = $('#songlist83'); if (!box) return; box.innerHTML = '';
  TRACKS.forEach((t, i) => { const b = document.createElement('button'); b.className = 'pr b81 song83' + (t === TR ? ' on' : ''); b.textContent = (t === TR ? '♪ ' : '') + (S.lang === 'en' ? t.en : t.zh); b.onclick = e => { e.stopPropagation(); setTrack(i); }; box.appendChild(b); });
  const c = $('#credit83'); if (c) c.textContent = TR.credit ? (S.lang === 'en' ? 'Music: Calm Ambient 3 by cynicmusic — CC0 (public domain)' : '音樂：Calm Ambient 3 · cynicmusic — CC0 公眾領域') : '';
}
function tempoNote83() { const n = $('#tempo83'); if (!n) return; if (TR.beats === 'timeline') { n.textContent = tx83('節奏：內建節拍圖 148 BPM', 'Tempo: built-in beat map 148 BPM'); return; }
  const lb = A.lb; n.textContent = !S.playing || !lb ? tx83('節奏：播放時即時偵測', 'Tempo: detected live while playing') : tx83('即時節奏 ≈ ', 'Live tempo ≈ ') + (lb.bpm || '…') + ' BPM' + (lb.silent ? tx83('（時脈模式）', ' (clock mode)') : '') + (V83.soft ? tx83(' · 慢歌：派對光效已柔化', ' · slow song: party lights softened') : ''); }
function importSong83(f, select) {
  const base = f.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'song';
  if (f.type && !audio.canPlayType(f.type) && !/\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|webm|mp4)$/i.test(f.name)) return 0;
  const url = URL.createObjectURL(f), t = { id: 'user-song-' + (++RE81.n), zh: '我的歌 · ' + base, en: 'My song · ' + base, src: url, beats: 'live', cue: 0, user: true, size: f.size }; TRACKS.push(t); if (select) setTrack(TRACKS.length - 1); return 1;
}
(function import83() {
  const fa = $('#fsong'), fi = $('#fimg'); if (fa) { fa.multiple = true; fa.onchange = () => { const fs = [...(fa.files || [])]; let ok = 0; fs.forEach(f => { ok += importSong83(f, ok === 0); }); fa.value = ''; songs83();
    if (ok) toast81('已加入 ' + ok + ' 首歌 — 切歌時會重新偵測每首歌的節奏；只在你的裝置上', 'Added ' + ok + ' song(s) — tempo is re-detected for each song; stays on your device'); else if (fs.length) toast81('這個瀏覽器無法播放這種音訊格式', 'This browser can’t play this audio format'); }; }
  if (fi) { fi.multiple = true; fi.onchange = () => { const fs = [...(fi.files || [])]; fs.forEach(f => importImage81(f)); fi.value = ''; setTimeout(() => { gridRender83(); }, 800); }; }
  const _st = setTrack; setTrack = function (i) { _st(i); V83.soft = false; V83.pt = 0; document.body.classList.remove('soft83'); hideSug83(); songs83(); tempoNote83(); }; // A.lb (tempo estimator) is reset inside setTrack
  songs83(); $('#lang').addEventListener('click', () => setTimeout(() => { songs83(); tempoNote83(); gridLabels83(); }, 0));
})();

/* ---- tempo-aware softening + slow-song suggestion (never force-switches) ---- */
function hideSug83() { const s = $('#sug83'); if (s) s.classList.remove('on'); }
function showSug83() {
  let s = $('#sug83'); if (!s) { s = document.createElement('div'); s.id = 'sug83'; s.setAttribute('role', 'status'); document.body.appendChild(s); stopAll83(s); }
  s.innerHTML = `<span>${tx83('這首歌節奏較慢，建議用「原畫風情」模式', 'This song is slow — try the “Pure art” mode')}</span><button id="sugy83">${tx83('切換', 'Switch')}</button><button id="sugx83" aria-label="close">✕</button>`;
  s.querySelector('#sugy83').onclick = () => { applyPreset('calm'); hideSug83(); }; s.querySelector('#sugx83').onclick = hideSug83;
  s.classList.add('on'); clearTimeout(s._h); s._h = setTimeout(hideSug83, 12000);
}
setInterval(() => { try {
  const now = performance.now(), dt = V83.lastT ? (now - V83.lastT) / 1000 : 0; V83.lastT = now; if (S.playing) V83.pt += dt;
  if (S.playing && TR.beats !== 'timeline' && A.lb && V83.pt > 7) {
    const lb = A.lb, rate = lb.onsets / Math.max(1, V83.pt), slow = !!TR.calm || (lb.bpm && lb.bpm < 95) || lb.lvlAvg < 0.1 || rate < 0.9;
    if (slow !== V83.soft) { V83.soft = slow; document.body.classList.toggle('soft83', slow); }
    if (slow && !V83.sug[TR.id] && !['calm', 'breath'].includes(S.preset)) { V83.sug[TR.id] = 1; V83.sugShown = (V83.sugShown || 0) + 1; showSug83(); }
  }
  tempoNote83();
} catch (e) {} }, 1000);

/* ---- swipe (phone) + side buttons (desktop) ---- */
(function swipe83() {
  const st = $('#stage'); if (!st) return; const G = {};
  st.addEventListener('pointerdown', e => { if (!e.isPrimary) { if (G.g) G.g.multi = 1; return; } G.g = { x: e.clientX, y: e.clientY, t: performance.now(), spin: !!(SPIN82 && SPIN82.s), multi: Z.pts.size > 1 ? 1 : 0 }; });
  st.addEventListener('pointermove', e => { if (G.g && Z.pts.size > 1) G.g.multi = 1; });
  st.addEventListener('pointerup', e => { const g = G.g; G.g = null; if (!g || !e.isPrimary || g.multi || g.spin || RE81.on || GLOW.on || Z.s > 1.01 || Z.pinching) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y, dt = performance.now() - g.t;
    void dx; void dy; void dt; /* v84: swipes are handled live by the sheet drag */ });
  const mk = (id, txt, d, aria) => { const b = document.createElement('button'); b.id = id; b.className = 'side83'; b.textContent = txt; b.setAttribute('aria-label', aria); stopAll83(b); b.onclick = () => sheetGo84(d); document.body.appendChild(b); return b; };
  const l = mk('sprev83', '‹', -1, '上一幅畫 previous painting'), r = mk('snext83', '›', 1, '下一幅畫 next painting');
  let key = ''; const pos = () => { const p = L.p, F = L.F || 10, y = p.y + p.h / 2, k = [p.x, p.y, p.w, p.h, innerWidth].join(); if (k === key) return; key = k;
    l.style.top = r.style.top = y + 'px'; l.style.left = Math.max(8, p.x - F - 58) + 'px'; r.style.left = Math.min(innerWidth - 56, p.x + p.w + F + 10) + 'px'; };
  pos(); setInterval(pos, 250); addEventListener('resize', () => setTimeout(pos, 80));
  const ap = $('#aprev'), an = $('#anext'); if (ap) ap.onclick = () => sheetGo84(-1); if (an) an.onclick = () => sheetGo84(1);
  const gb = document.createElement('button'); gb.id = 'agrid83'; gb.textContent = '▦'; gb.setAttribute('aria-label', '總覽 overview'); gb.title = '總覽 / Overview'; gb.onclick = e => { e.stopPropagation(); openGrid83(); }; const sw = $('#artsw'); if (sw) sw.appendChild(gb);
})();

/* ---- slideshow ---- */
(function ss83() {
  const on = $('#sson83'), ivs = $('#ssiv83'), trs = $('#sstr83'); if (!on) return;
  const save = () => ls83('ae-premium-ss83', JSON.stringify({ iv: V83.ss.iv, tr: V83.ss.tr }));
  const sync = () => { on.classList.toggle('on', V83.ss.on); on.setAttribute('aria-pressed', String(V83.ss.on)); on.dataset.zh = V83.ss.on ? '❚❚ 停止自動播放' : '▶ 自動播放'; on.dataset.en = V83.ss.on ? '❚❚ Stop slideshow' : '▶ Slideshow'; on.textContent = on.dataset[S.lang];
    ivs.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === V83.ss.iv)); trs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === V83.ss.tr)); document.body.classList.toggle('ss83', V83.ss.on); };
  on.onclick = e => { e.stopPropagation(); V83.ss.on = !V83.ss.on; V83.ss.t = performance.now(); sync(); };
  ivs.onclick = e => { const b = e.target.closest('button'); if (!b) return; e.stopPropagation(); V83.ss.iv = +b.dataset.v; save(); sync(); };
  trs.onclick = e => { const b = e.target.closest('button'); if (!b) return; e.stopPropagation(); V83.ss.tr = b.dataset.v; save(); sync(); };
  V83.ssSync = sync; sync();
  setInterval(() => { if (!V83.ss.on || document.hidden || RE81.on || GLOW.on || document.body.classList.contains('grid83-open') || V83.busy) return; if (performance.now() - V83.ss.t >= V83.ss.iv * 1000) goArt83(ARTS.indexOf(ART) + 1, 1); }, 250);
})();

/* ---- overview grid (依比例 / 正方形) ---- */
function gridLabels83() { const g = $('#grid83'); if (g) lab83(g); }
function gridMark83() { const g = $('#grid83'); if (!g) return; g.querySelectorAll('.cell83').forEach(c => c.classList.toggle('on', ARTS[+c.dataset.i] === ART)); }
function gridRender83() {
  const g = $('#grid83'); if (!g) return; const box = g.querySelector('.g83b'); box.innerHTML = ''; g.dataset.layout = V83.grid;
  g.querySelectorAll('.g83seg button').forEach(b => { const on = b.dataset.g === V83.grid; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  ARTS.forEach((a, i) => { const ar = (a.w && a.h) ? a.w / a.h : 1, c = document.createElement('button'); c.className = 'cell83'; c.dataset.i = i; c.title = a.zh === a.en ? a.en : a.zh + ' ' + a.en;
    if (V83.grid === 'ratio') { c.style.flexGrow = ar.toFixed(3); c.style.flexBasis = (ar * 120).toFixed(0) + 'px'; c.style.aspectRatio = ar.toFixed(4); }
    const im = document.createElement('img'); im.src = a.thumb || a.src; im.alt = a.en; im.loading = 'lazy'; im.decoding = 'async'; im.draggable = false; c.appendChild(im);
    c.onclick = e => { e.stopPropagation(); closeGrid83(); goArt83(i, i >= ARTS.indexOf(ART) ? 1 : -1); }; box.appendChild(c); });
  if (V83.grid === 'ratio') { const sp = document.createElement('i'); sp.className = 'fill83'; box.appendChild(sp); }
  gridMark83();
}
function openGrid83() {
  let g = $('#grid83');
  if (!g) { g = document.createElement('div'); g.id = 'grid83'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-label', 'overview');
    g.innerHTML = '<div class="g83h"><b data-zh="總覽" data-en="Overview"></b><div class="g83seg seg83" role="group"><button data-g="ratio" data-zh="依比例" data-en="Aspect"></button><button data-g="square" data-zh="正方形" data-en="Square"></button></div><button class="g83x" aria-label="close">✕</button></div><div class="g83b"></div>';
    document.body.appendChild(g); stopAll83(g);
    g.querySelector('.g83seg').onclick = e => { const b = e.target.closest('button'); if (!b) return; V83.grid = b.dataset.g; ls83('ae-premium-grid83', V83.grid); gridRender83(); };
    g.querySelector('.g83x').onclick = closeGrid83; addEventListener('keydown', e => { if (e.key === 'Escape') closeGrid83(); }); }
  lab83(g); gridRender83(); hideUI(true); document.body.classList.add('grid83-open'); g.classList.add('on');
}
function closeGrid83() { const g = $('#grid83'); if (g) g.classList.remove('on'); document.body.classList.remove('grid83-open'); }
{ const gb = $('#gridbtn83'); if (gb) gb.onclick = e => { e.stopPropagation(); openGrid83(); }; }

/* ---- first-visit hint (once) ---- */
(function hint83() {
  if (ls83('ae-premium-hint83') === '1' && !Q.has('hint')) return;
  setTimeout(() => {
    const h = document.createElement('div'); h.id = 'hint83'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-label', 'tips');
    h.innerHTML = '<div class="h83t" data-zh="歡迎欣賞 ✧" data-en="Welcome ✧"></div>' +
      '<p data-zh="點右下角 ⚙ 設定，可切換「原畫風情」「歡樂派對」等模式，欣賞畫作在不同燈光下的美。" data-en="Open ⚙ Settings (bottom right) to switch modes like “Pure art” and “Joyful party” and enjoy the painting under different lighting."></p>' +
      '<p data-zh="在畫上用手指左右滑動即可換畫（電腦可按畫作兩側的 ‹ ›）；點畫作播放音樂。" data-en="Swipe left/right on the painting to change it (desktop: ‹ › beside the art); tap the art to play music."></p>' +
      '<div class="h83b"><button id="h83set" data-zh="開啟設定" data-en="Open settings"></button><button id="h83ok" data-zh="知道了" data-en="Got it"></button></div>';
    document.body.appendChild(h); stopAll83(h); lab83(h); requestAnimationFrame(() => h.classList.add('on'));
    const done = () => { ls83('ae-premium-hint83', '1'); h.classList.remove('on'); setTimeout(() => h.remove(), 400); };
    h.querySelector('#h83ok').onclick = done; h.querySelector('#h83set').onclick = () => { done(); showUI(); if (V83.pickTab) V83.pickTab('mode'); };
  }, Q.has('hint') ? 300 : 1400);
})();
(function ex83() { if (window.__premium) Object.assign(window.__premium, { V83, goArt83, openGrid83, closeGrid83, importSong83, songs83, newLB83 }); else setTimeout(ex83, 50); })();

/* ===================== v2476.84 =====================
   repeat modes · grid corner radius · IG-style sheet swipe · local IndexedDB persistence of imports (opt-out, clearable).
   Painting pixels are never altered: the sheet transition only moves whole displayed images. */
var RP84 = { mode: ['all', 'one', 'shuffle', 'stop'].includes(ls83('ae-premium-repeat84')) ? ls83('ae-premium-repeat84') : 'all', force: 0, endAt: 0, log: [] };
const RPL84 = { all: ['↻', '全部循環', 'Repeat all'], one: ['↻¹', '單曲循環', 'Repeat one'], shuffle: ['⤨', '隨機播放', 'Shuffle'], stop: ['→|', '播完停止', 'Stop after song'] };
function applyLoop84() { audio.removeAttribute('loop'); audio.loop = RP84.mode === 'one' && !(TR.user && TR.trim); }
function end84(why) {
  const now = performance.now(); if (now - RP84.endAt < 700) return; RP84.endAt = now; if (!USER.want) return;
  const n = TRACKS.length, i = TRACKS.indexOf(TR), start = () => { try { audio.currentTime = TR.trim ? TR.trim.a : (TR.cue || 0); } catch (e) {} const p = audio.play(); if (p && p.catch) p.catch(() => {}); };
  RP84.log.push({ why, mode: RP84.mode, from: TR.id });
  if (RP84.mode === 'stop') { USER.want = false; try { audio.pause(); audio.currentTime = TR.trim ? TR.trim.a : 0; } catch (e) {} syncPlay(); return; }
  if (RP84.mode === 'one' || n < 2) { start(); return; }
  let j = i + 1; if (RP84.mode === 'shuffle') { j = Math.floor(Math.random() * (n - 1)); if (j >= i) j++; }
  RP84.force = 1; try { setTrack(j); } finally { RP84.force = 0; }
  RP84.log[RP84.log.length - 1].to = TR.id;
}
audio.addEventListener('ended', () => end84('ended'));
function setRepeat84(m) { if (!RPL84[m]) m = 'all'; RP84.mode = m; ls83('ae-premium-repeat84', m); applyLoop84(); syncRepeat84(); }
function syncRepeat84() { const L0 = RPL84[RP84.mode], b = $('#drep84'); if (b) { b.textContent = L0[0]; b.title = S.lang === 'en' ? L0[2] : L0[1]; b.setAttribute('aria-label', L0[1] + ' ' + L0[2]); b.classList.toggle('on', RP84.mode !== 'stop'); }
  document.querySelectorAll('#rep84 button').forEach(x => x.classList.toggle('on', x.dataset.v === RP84.mode)); }
(function repeatUI84() {
  const btns = $('#dock .btns'); if (btns) { const b = document.createElement('button'); b.id = 'drep84'; b.className = 'mini84'; b.onclick = e => { e.stopPropagation(); const k = Object.keys(RPL84), m = k[(k.indexOf(RP84.mode) + 1) % k.length]; setRepeat84(m); toast81(RPL84[m][1], RPL84[m][2]); }; btns.prepend(b);
    const sp = document.createElement('span'); sp.className = 'mini84 sp84'; sp.setAttribute('aria-hidden', 'true'); btns.append(sp); }
  const row = $('#songs83'); if (row) { const seg = document.createElement('div'); seg.className = 'seg83'; seg.id = 'rep84'; seg.setAttribute('role', 'group'); seg.innerHTML = Object.entries(RPL84).map(([k, v]) => `<button data-v="${k}" data-zh="${v[1]}" data-en="${v[2]}"></button>`).join(''); const tn = $('#tempo83'); row.insertBefore(seg, tn || null); seg.onclick = e => { const x = e.target.closest('button'); if (!x) return; e.stopPropagation(); setRepeat84(x.dataset.v); }; lab83(seg); }
  $('#lang').addEventListener('click', () => setTimeout(() => { syncRepeat84(); const sg = $('#rep84'); if (sg) lab83(sg); }, 0));
  const _st = setTrack; setTrack = function (i) { _st(i); applyLoop84(); try { if (A.mg && A.mg.g) { const g = A.mg.g.gain, t = A.mg.c.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(mv84(), t + 0.05); } else audio.volume = mv84(); } catch (e) {} };
  const _ts = trimSet82; trimSet82 = function (a, b) { _ts(a, b); applyLoop84(); persistTrim84(); };
  applyLoop84(); syncRepeat84();
})();

/* ---- overview grid corner radius (直角 / 小圓角 / 大圓角 + 0–24 px), saved ---- */
var GR84 = { r: (() => { const v = +ls83('ae-premium-gridr84'); return Number.isFinite(v) && ls83('ae-premium-gridr84') !== null ? Math.max(0, Math.min(24, v)) : 4; })() };
function gridRadius84(r, save) { GR84.r = Math.max(0, Math.min(24, Math.round(+r || 0))); const g = $('#grid83'); if (g) { g.style.setProperty('--r84', GR84.r + 'px'); const s = g.querySelector('#gr84s'); if (s && +s.value !== GR84.r) s.value = GR84.r; const o = g.querySelector('#gr84v'); if (o) o.textContent = GR84.r + 'px'; g.querySelectorAll('.gr84 button').forEach(b => b.classList.toggle('on', +b.dataset.r === GR84.r)); } if (save) ls83('ae-premium-gridr84', String(GR84.r)); }
{ const _og = openGrid83; openGrid83 = function () { _og(); const g = $('#grid83'); if (g && !g.querySelector('.gr84')) { const h = g.querySelector('.g83h'), d = document.createElement('div'); d.className = 'gr84';
    d.innerHTML = '<div class="seg83" role="group"><button data-r="0" data-zh="直角" data-en="Square"></button><button data-r="6" data-zh="小圓角" data-en="Small"></button><button data-r="16" data-zh="大圓角" data-en="Large"></button></div><label><span data-zh="圓角" data-en="Radius"></span><input id="gr84s" type="range" min="0" max="24" step="1" aria-label="corner radius"><output id="gr84v"></output></label>';
    h.after(d); lab83(d); d.addEventListener('click', e => { const b = e.target.closest('button[data-r]'); if (b) gridRadius84(+b.dataset.r, true); }); d.querySelector('#gr84s').addEventListener('input', e => gridRadius84(e.target.value, true)); }
  gridRadius84(GR84.r); };
  const gb = $('#gridbtn83'); if (gb) gb.onclick = e => { e.stopPropagation(); openGrid83(); }; const ab = $('#agrid83'); if (ab) ab.onclick = e => { e.stopPropagation(); openGrid83(); }; }

/* ---- IG-style sheet swipe: the exhibit follows the finger, the neighbour slides in, spring settle ---- */
var SH84 = { g: null, drag: false, sheet: null, dir: 0, busy: false, frames: 0 };
function fitRect84(ar) { const portrait = L.H > L.W, sa = safeInsets(), top = sa.t + (portrait ? 96 : 118), bot = sa.b + (portrait ? 156 : 158), mx = portrait ? 0.12 : 0.1; let w = L.W * (1 - mx), h = w / ar; const availH = Math.max(120, L.H - top - bot); if (h > availH) { h = availH; w = h * ar; } w = Math.round(w); h = Math.round(h); return { x: Math.round((L.W - w) / 2), y: Math.round(top + (availH - h) / 2), w, h }; }
function mkSheet84(dir) { const n = ARTS.length, a = ARTS[(((ARTS.indexOf(ART) + dir) % n) + n) % n]; preload(a); const r = fitRect84((a.w || 1) / (a.h || 1)), s = document.createElement('div'); s.className = 'sheet84'; s.setAttribute('aria-hidden', 'true');
  Object.assign(s.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' }); s.style.setProperty('--f', Math.max(9, Math.round(r.w * 0.03)) + 'px'); const im = document.createElement('img'); im.src = a.src; im.alt = ''; im.draggable = false; s.appendChild(im); document.body.appendChild(s); return s; }
function place84(dx) { const st = $('#stage'), W = L.W; st.style.translate = dx ? dx.toFixed(1) + 'px 0' : ''; const s = SH84.sheet; if (s) { const p = Math.min(1, Math.abs(dx) / W); s.style.translate = (dx + SH84.dir * W).toFixed(1) + 'px 0'; s.style.scale = String(0.94 + 0.06 * p); } SH84.frames++; }
async function settle84(commit) {
  const st = $('#stage'), s = SH84.sheet, dir = SH84.dir, W = L.W, from = parseFloat(st.style.translate) || 0; SH84.busy = true; SH84.drag = false;
  const to = commit ? -dir * W : 0, D = commit ? 520 : 420, ez = 'cubic-bezier(.2,.95,.3,1.08)'; // spring-like settle with a small overshoot
  const p0 = Math.min(1, Math.abs(from) / W);
  const a1 = st.animate([{ translate: from + 'px 0' }, { translate: to + 'px 0' }], { duration: D, easing: ez, fill: 'forwards' });
  if (s) s.animate([{ translate: (from + dir * W) + 'px 0', scale: 0.94 + 0.06 * p0 }, { translate: (to + dir * W) + 'px 0', scale: commit ? 1 : 0.94 }], { duration: D, easing: ez, fill: 'forwards' });
  SH84.anim = { from, to, D, t0: performance.now(), commit };
  try { await a1.finished; } catch (e) {}
  if (commit) { try { await setArt(ARTS.indexOf(ART) + dir, true); } catch (e) {} V83.swipes++; }
  st.style.translate = ''; a1.cancel(); if (s) s.remove(); SH84.sheet = null; document.body.classList.remove('drag84'); SH84.busy = false; V83.ss.t = performance.now(); try { gridMark83(); } catch (e) {}
}
function sheetGo84(dir) { if (SH84.busy || SH84.drag || V83.busy || ARTS.length < 2) return; SH84.dir = dir; SH84.sheet = mkSheet84(dir); document.body.classList.add('drag84'); place84(0); return settle84(true); }
(function sheet84() {
  const st = $('#stage'); if (!st) return;
  const blocked = () => RE81.on || GLOW.on || Z.s > 1.01 || Z.pinching || Z.pts.size > 1 || (SPIN82 && SPIN82.s) || SH84.busy || V83.busy || document.body.classList.contains('grid83-open') || ARTS.length < 2;
  st.addEventListener('pointerdown', e => { if (!e.isPrimary || blocked()) { if (SH84.drag) settle84(false); SH84.g = null; return; } SH84.g = { x: e.clientX, y: e.clientY, h: [[performance.now(), e.clientX]] }; });
  st.addEventListener('pointermove', e => { const g = SH84.g; if (!g || !e.isPrimary) return; if (Z.pts.size > 1 || Z.pinching || (SPIN82 && SPIN82.s)) { if (SH84.drag) settle84(false); SH84.g = null; return; }
    const dx = e.clientX - g.x, dy = e.clientY - g.y; g.h.push([performance.now(), e.clientX]); if (g.h.length > 8) g.h.shift();
    if (!SH84.drag) { if (Math.abs(dx) > 12 && Math.abs(dx) > 1.3 * Math.abs(dy)) { SH84.drag = true; SH84.dir = dx < 0 ? 1 : -1; SH84.sheet = mkSheet84(SH84.dir); document.body.classList.add('drag84'); } else return; }
    const d = dx < 0 ? 1 : -1; if (d !== SH84.dir && Math.abs(dx) > 2) { if (SH84.sheet) SH84.sheet.remove(); SH84.dir = d; SH84.sheet = mkSheet84(d); }
    place84(dx); });
  const up = e => { const g = SH84.g; SH84.g = null; if (!g || !SH84.drag) return; const dx = e.clientX - g.x, h = g.h, a = h[0], b = h[h.length - 1], v = (b[1] - a[1]) / Math.max(1, b[0] - a[0]);
    const commit = e.type !== 'pointercancel' && (Math.abs(dx) > L.W * 0.2 || (Math.abs(v) > 0.45 && Math.sign(v) === Math.sign(dx))); settle84(commit); };
  st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  addEventListener('keydown', e => { if (e.target && e.target.closest && e.target.closest('input')) return; if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); if (!document.body.classList.contains('grid83-open')) sheetGo84(e.key === 'ArrowRight' ? 1 : -1); } }, true);
})();

/* ---- imports: optional local persistence (IndexedDB on this device only; nothing is uploaded) ---- */
var IDB84 = { on: ls83('ae-premium-persist84') !== '0', p: null, n: 0, restored: { img: 0, song: 0 }, est: null };
function idb84() { return IDB84.p || (IDB84.p = new Promise((res, rej) => { try { const r = indexedDB.open('ae-premium-imports', 1); r.onupgradeneeded = () => r.result.createObjectStore('items', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } })); }
async function idbTx84(mode, fn) { const db = await idb84(); return new Promise((res, rej) => { const tx = db.transaction('items', mode), os = tx.objectStore('items'); let out; const r = fn(os); if (r) r.onsuccess = () => { out = r.result; }; tx.oncomplete = () => res(out); tx.onerror = tx.onabort = () => rej(tx.error); }); }
const idbPut84 = rec => IDB84.on ? idbTx84('readwrite', os => os.put(rec)).then(() => { try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {} quota84(); }).catch(e => { toast81('無法保存到這台裝置（空間不足或瀏覽器限制）', 'Couldn’t save on this device (storage full or blocked)'); }) : Promise.resolve();
async function quota84() { const n = $('#q84'); let txt = ''; try { const all = await idbTx84('readonly', os => os.getAll()); const sz = (all || []).reduce((s, r) => s + ((r.blob && r.blob.size) || 0), 0); IDB84.count = (all || []).length; IDB84.bytes = sz;
    if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); IDB84.est = { usage: e.usage, quota: e.quota }; }
    const mb = x => (x / 1048576).toFixed(x > 1048576 * 100 ? 0 : 1) + ' MB'; txt = tx83(`已保存 ${IDB84.count} 項（${mb(sz)}）`, `${IDB84.count} item(s) saved (${mb(sz)})`) + (IDB84.est ? tx83(` · 瀏覽器空間 已用 ${mb(IDB84.est.usage)} / 約 ${mb(IDB84.est.quota)}`, ` · browser storage ${mb(IDB84.est.usage)} used of ~${mb(IDB84.est.quota)}`) : '');
  } catch (e) { txt = tx83('此瀏覽器無法使用本機保存', 'Local saving is unavailable in this browser'); } if (n) n.textContent = txt; return IDB84.est; }
function persistTrim84() { const t = TR; if (!t || !t.pid || !IDB84.on) return; clearTimeout(IDB84.tt); IDB84.tt = setTimeout(() => { idbTx84('readwrite', os => { const g = os.get(t.pid); g.onsuccess = () => { const r = g.result; if (r) { r.trim = t.trim || null; os.put(r); } }; return null; }).catch(() => {}); }, 400); }
function addImg84(blob, name, pid, fromDb) { return new Promise(res => { const base = (name || 'image').replace(/\.[^.]+$/, '').slice(0, 28) || 'image', url = URL.createObjectURL(blob), img = new Image(), heic = /hei[cf]/i.test(blob.type || '') || /\.hei[cf]$/i.test(name || '');
  img.onload = () => { const a = { id: 'user-img-' + (++RE81.n), pid, zh: '我的圖片 · ' + base, en: 'My image · ' + base, src: url, thumb: url, w: img.naturalWidth, h: img.naturalHeight, user: true }; a._img = img; ARTS.push(a); thumb81(a); res(a); };
  img.onerror = () => { URL.revokeObjectURL(url); if (!fromDb) toast81(heic ? '這個瀏覽器無法開啟 HEIC 圖片，請先轉成 JPG 或 PNG 再匯入' : '無法開啟這個圖片檔', heic ? 'This browser can’t open HEIC — please convert to JPG or PNG first' : 'Couldn’t open this image file'); res(null); }; img.src = url; }); }
function addSong84(blob, name, pid, trim) { const base = (name || 'song').replace(/\.[^.]+$/, '').slice(0, 32) || 'song', url = URL.createObjectURL(blob), t = { id: 'user-song-' + (++RE81.n), pid, zh: '我的歌 · ' + base, en: 'My song · ' + base, src: url, beats: 'live', cue: trim ? trim.a : 0, user: true, size: blob.size, trim: trim || null }; TRACKS.push(t); return t; }
const newPid84 = k => k + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
importImage81 = function (f) { const pid = newPid84('img'); addImg84(f, f.name, pid).then(a => { if (!a) return; setArt(ARTS.length - 1); idbPut84({ id: pid, kind: 'img', name: f.name, type: f.type, blob: f, t: Date.now() }); toast81('已載入「' + a.en.replace('My image · ', '') + '」— 只在你的裝置上，不會上傳' + (IDB84.on ? '（已保存在此裝置）' : ''), 'Loaded — stays on your device, never uploaded' + (IDB84.on ? ' (saved on this device)' : '')); try { gridRender83(); } catch (e) {} }); };
importSong83 = function (f, select) { if (f.type && !audio.canPlayType(f.type) && !/\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|webm|mp4)$/i.test(f.name)) return 0; const pid = newPid84('song'); addSong84(f, f.name, pid); if (select) setTrack(TRACKS.length - 1); idbPut84({ id: pid, kind: 'song', name: f.name, type: f.type, blob: f, t: Date.now() }); return 1; };
async function restore84() { if (!IDB84.on || !window.indexedDB) { quota84(); return; } let all = []; try { all = await idbTx84('readonly', os => os.getAll()) || []; } catch (e) { quota84(); return; }
  all.sort((a, b) => (a.t || 0) - (b.t || 0)); for (const r of all) { if (!r.blob) continue; if (r.kind === 'img') { if (await addImg84(r.blob, r.name, r.id, true)) IDB84.restored.img++; } else if (r.kind === 'song') { addSong84(r.blob, r.name, r.id, r.trim); IDB84.restored.song++; } }
  try { songs83(); trackLabel(); gridRender83(); } catch (e) {} quota84(); IDB84.done = 1; }
async function clear84() { try { await idbTx84('readwrite', os => os.clear()); } catch (e) {}
  if (TR.user) setTrack(0); if (ART.user) await setArt(0, true);
  for (let i = ARTS.length - 1; i >= 0; i--) if (ARTS[i].user) { try { URL.revokeObjectURL(ARTS[i].src); } catch (e) {} ARTS.splice(i, 1); }
  for (let i = TRACKS.length - 1; i >= 0; i--) if (TRACKS[i].user) { try { URL.revokeObjectURL(TRACKS[i].src); } catch (e) {} TRACKS.splice(i, 1); }
  document.querySelectorAll('#artstrip button').forEach(b => { if (/^user-/.test(b.dataset.id)) b.remove(); }); try { songs83(); trackLabel(); gridRender83(); artLabel(); } catch (e) {} quota84(); toast81('已清除所有匯入的圖片與歌曲', 'All imported images and songs cleared'); }
(function persistUI84() {
  const row = $('#improw'); if (!row) return; const d = document.createElement('div'); d.className = 'p84';
  d.innerHTML = '<button class="pr b81" id="pst84" aria-pressed="true"></button><button class="pr b81" id="clr84" data-zh="🗑 清除已匯入" data-en="🗑 Clear imported"></button><div class="note81" id="q84"></div>';
  const note = $('#impnote84'); row.insertBefore(d, note || null); lab83(d);
  const sync = () => { const b = $('#pst84'); b.dataset.zh = IDB84.on ? '💾 保存在此裝置：開' : '💾 保存在此裝置：關'; b.dataset.en = IDB84.on ? '💾 Keep on this device: on' : '💾 Keep on this device: off'; b.textContent = b.dataset[S.lang]; b.classList.toggle('on', IDB84.on); b.setAttribute('aria-pressed', String(IDB84.on));
    if (note) { note.dataset.zh = IDB84.on ? '匯入的檔案保存在這台裝置的瀏覽器（IndexedDB），重新整理後仍在；不會上傳到伺服器。' : '保存已關閉：檔案只在這次瀏覽有效，重新整理後需再匯入；不會上傳。'; note.dataset.en = IDB84.on ? 'Imports are kept in this browser on this device (IndexedDB) and survive reloads; never uploaded.' : 'Saving off: imports last for this visit only; never uploaded.'; note.textContent = note.dataset[S.lang]; } };
  $('#pst84').onclick = async e => { e.stopPropagation(); IDB84.on = !IDB84.on; ls83('ae-premium-persist84', IDB84.on ? '1' : '0'); if (IDB84.on) { for (const a of ARTS) if (a.user && a.pid && a._img) { try { const b = await (await fetch(a.src)).blob(); await idbPut84({ id: a.pid, kind: 'img', name: a.en.replace('My image · ', ''), type: b.type, blob: b, t: Date.now() }); } catch (er) {} } for (const t of TRACKS) if (t.user && t.pid) { try { const b = await (await fetch(t.src)).blob(); await idbPut84({ id: t.pid, kind: 'song', name: t.en.replace('My song · ', ''), type: b.type, blob: b, trim: t.trim || null, t: Date.now() }); } catch (er) {} } } sync(); quota84(); };
  $('#clr84').onclick = e => { e.stopPropagation(); if (confirm(tx83('清除所有匯入的圖片與歌曲？（只影響這台裝置）', 'Clear all imported images and songs? (this device only)'))) clear84(); };
  ['pointerdown', 'click'].forEach(ev => d.addEventListener(ev, e => e.stopPropagation()));
  $('#lang').addEventListener('click', () => setTimeout(() => { lab83(d); sync(); quota84(); }, 0)); sync();
  restore84();
})();
(function ex84() { if (window.__premium) Object.assign(window.__premium, { RP84, setRepeat84, end84, FADE84, fade84, GR84, gridRadius84, SH84, sheetGo84, IDB84, restore84, clear84, quota84, mv84 }); else setTimeout(ex84, 50); })();
