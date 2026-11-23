// AE Lumina Wall — packages (R10 "God mode"). Every effect and transition is a self-contained package:
//   { id, type: 'effect' | 'transition', version, name:{zh,en}, desc:{zh,en}, params:[…], create(host, p) | run(o, h, p) }
// The params list drives the control panel automatically (range / choice / toggle / color), so a new package
// brings its own controls. Built-in packages are listed here; more can be registered later (R10-2: import).
import wind from './pack-wind.js';
import light from './pack-light.js';
import ribbons from './pack-ribbons.js';
import fly from './pack-fly.js';
import flip from './pack-flip.js';
import zoom from './pack-zoom.js';
import curtain from './pack-curtain.js';
import laser from './pack-laser.js';
import camApproach from './pack-cam-approach.js';
import camTour from './pack-cam-tour.js';
import camOrbit from './pack-cam-orbit.js';
import camDocumentary from './pack-cam-documentary.js';
import camGaze from './pack-cam-gaze.js';
import glow from './pack-glow.js';
import coins from './pack-coins.js';
import sweep from './pack-sweep.js';
import led from './pack-led.js';
import depth from './pack-depth.js';
import frame from './pack-frame.js';

export const PACKS = new Map();
export const TYPES = ['effect', 'transition', 'camera', 'burst'];
export function registerPack(pk) {
  if (!pk || !/^[a-z0-9-]{1,40}$/.test(pk.id || '') || !TYPES.includes(pk.type)) throw new Error('bad package');
  if (pk.type === 'effect' && typeof pk.create !== 'function') throw new Error('effect needs create()');
  if (pk.type === 'transition' && typeof pk.run !== 'function') throw new Error('transition needs run()');
  if ((pk.type === 'camera' || pk.type === 'burst') && typeof pk.create !== 'function') throw new Error(pk.type + ' needs create()');
  if (!pk.name || typeof pk.name.zh !== 'string' || !Array.isArray(pk.params || [])) throw new Error('package needs a name and params');
  // versions: a package with the same id replaces the current one only if it is newer (or the same version re-imported)
  const cur = PACKS.get(pk.id);
  if (cur && (Number(pk.version) || 1) < (Number(cur.version) || 1)) return cur;
  PACKS.set(pk.id, pk);
  return pk;
}
[wind, light, ribbons, laser, led, depth, frame, fly, flip, zoom, curtain, camGaze, camApproach, camTour, camOrbit, camDocumentary, glow, coins, sweep].forEach(registerPack);
export const BUILTIN = new Set(PACKS.keys());

// a package file (self-contained module text with `export default { … }`) → the package object
// (packages come only from AE Studio; they are code, so nothing else may ever be loaded this way)
export function packFromSource(code) {
  const body = String(code).replace(/^\s*export\s+default\s+/m, 'return ');
  if (/^\s*(import|export)\s/m.test(body)) throw new Error('a package must be self-contained (no import / export besides export default)');
  const pk = new Function(body)();
  return pk;
}

export const packsOf = (type) => [...PACKS.values()].filter(p => p.type === type);
// parameters: defaults merged with saved values, every value checked against its definition
export function paramsFor(pk, saved = {}) {
  const out = {};
  for (const d of pk.params || []) {
    let v = saved[d.id];
    if (d.type === 'range') { v = Number(v); if (!Number.isFinite(v)) v = d.default; v = Math.max(d.min, Math.min(d.max, v)); }
    else if (d.type === 'toggle') v = typeof v === 'boolean' ? v : !!d.default;
    else if (d.type === 'choice') v = (d.options || []).some(o => o.id === v) ? v : d.default;
    else if (d.type === 'color') v = /^#[0-9a-f]{6}$/i.test(v || '') ? v : d.default;
    else v = d.default;
    out[d.id] = v;
  }
  return out;
}

// The host the effect packages draw with: the painting's reading, the two light layers of the living painting,
// shared wind, and small helpers. Packages fade in and out (k = presence 0…1) so works change without a cut.
export class PackHost {
  constructor(alive) {
    this.alive = alive; this.wind = { x: 0, y: 0 };
    this.active = []; // { pk, p, inst, k, out }
    alive.wind = this.wind;
  }
  get W() { return this.alive.W; }
  get H() { return this.alive.H; }
  get rect() { return this.alive.rect; }
  get front() { return this.alive.fx; }
  get back() { return this.alive.bx; }
  // a layer above the work that the camera never moves (screen-fixed light such as LED strips); made on first use
  get overlay() {
    if (!this._ov) {
      const f = this.alive.front; if (!f || !f.parentNode) return null;
      const c = document.createElement('canvas'); c.className = 'pl-led'; f.parentNode.insertBefore(c, f.nextSibling);
      this._ov = { c, x: c.getContext('2d') };
    }
    this._ovUsed = true;
    return this._ov.x;
  }
  get palette() { return this.alive.palette && this.alive.palette.length ? this.alive.palette : [[236, 205, 140]]; }
  get reading() { return this.alive.readingMap; }
  sprite(rgb, soft) { return this.alive.spriteOf(rgb, soft); }
  colorAt(x, y) { return this.alive.colorOf(x, y); }
  flowAt(x, y) { return this.alive.dirAt(x, y); }
  livingPoint() { return this.alive.livingPoint(); }
  chime(kind, i = 0) { try { this.chimeFn && this.chimeFn(kind, i); } catch { /* sound is optional */ } }
  // one-tap effects (burst packages): play once and end
  fire(id) {
    const pk = PACKS.get(id); if (!pk || pk.type !== 'burst' || !this.rect) return false;
    try { this.bursts = (this.bursts || []).concat({ id, inst: pk.create(this, paramsFor(pk)) }).slice(-6); return true; } catch (err) { console.warn('burst', id, err); return false; }
  }
  // the beat of the music (set by the player); { live, pulse 0…1, count }
  beat() { return this.beatFn ? this.beatFn() : { live: false, pulse: 0, count: 0 }; }
  // the painting's richest places (strong, living brushwork), well apart, in 0…1 painting coordinates
  focalPoints(n = 3) {
    const m = this.alive.readingMap; if (!m) return [[0.5, 0.5]];
    const cells = [];
    for (let c = 0; c < m.gw * m.gh; c++) {
      const x = ((c % m.gw) + 0.5) / m.gw, y = (Math.floor(c / m.gw) + 0.5) / m.gh;
      if (x < 0.18 || x > 0.82 || y < 0.18 || y > 0.82) continue; // keep details away from the edges
      cells.push({ x, y, a: m.alive[c] });
    }
    cells.sort((p, q) => q.a - p.a);
    const out = [];
    for (const c of cells) { if (out.length >= n) break; if (out.every(([x, y]) => Math.hypot(x - c.x, y - c.y) > 0.28)) out.push([c.x, c.y]); }
    return out.length ? out : [[0.5, 0.5]];
  }
  // how close the camera may come without showing pixels: never beyond the photo's own resolution (+20%)
  maxZoomFor(media, r) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const nw = media && media.naturalWidth || 0;
    if (!nw || !r || !r.w) return 1;
    return Math.max(1, Math.min(3, (nw / (r.w * dpr)) * 1.2));
  }

  // ---- camera (one at a time): moves the painting and its light layers together, like a film camera ----
  setCamera(spec, media, r, neon) {
    // the previous work keeps its last camera pose through the transition (the player clears it afterwards)
    for (const el of [this.alive.back, this.alive.front]) el.style.transform = '';
    if (neon) neon.style.transform = ''; // the neon frame belongs to the new work (no leftover pose)
    this.cam = null; this.camPose = null;
    const pk = spec && PACKS.get(spec.id);
    if (!pk || pk.type !== 'camera' || !media || !r) { this.cam = null; return; }
    const p = paramsFor(pk, spec.p);
    try { this.cam = { pk, p, inst: pk.create(this, p), media, r, neon, maxZoom: this.maxZoomFor(media, r) }; } catch (err) { console.warn('camera', spec.id, err); this.cam = null; return; }
    media.style.animation = 'none';
    this.cameraFrame(0);
  }
  cameraSet(p) { if (this.cam) { Object.assign(this.cam.p, p); this.cam.inst.set && this.cam.inst.set(this.cam.p); } }
  cameraFrame(q) {
    const c = this.cam; if (!c) return;
    let pose; try { pose = c.inst.pose(Math.max(0, Math.min(1, q))); } catch { return; }
    const r = c.r, W = this.alive.W || r.x * 2 + r.w, H = this.alive.H || r.y * 2 + r.h;
    const s = Math.max(0.3, Math.min(c.maxZoom, pose.s || 1)), pull = Math.max(0, Math.min(1, pose.pull || 0));
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const dx = ((pose.x ?? 0.5) - 0.5) * r.w, dy = ((pose.y ?? 0.5) - 0.5) * r.h;
    // the focal point is drawn towards the centre of the screen as the camera moves in
    const tx = (W / 2 - (cx + dx * s)) * pull, ty = (H / 2 - (cy + dy * s)) * pull;
    const tf = `perspective(1600px) translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) rotateX(${(pose.rx || 0).toFixed(2)}deg) rotateY(${(pose.ry || 0).toFixed(2)}deg) scale(${s.toFixed(4)})`;
    c.media.style.transformOrigin = '50% 50%'; c.media.style.transform = tf;
    // only the light over the work moves with it; the far layer (rays, veils, distant dust) stays in the room
    this.alive.front.style.transformOrigin = `${cx}px ${cy}px`; this.alive.front.style.transform = tf;
    if (c.neon) { c.neon.style.transformOrigin = '50% 50%'; c.neon.style.transform = tf; }
    this.camPose = { s: +s.toFixed(3), tx: Math.round(tx), ty: Math.round(ty), rx: +(pose.rx || 0).toFixed(1), ry: +(pose.ry || 0).toFixed(1), max: +c.maxZoom.toFixed(2) };
  }
  resetCamera() {
    const c = this.cam;
    if (c) { c.media.style.transform = ''; c.media.style.animation = ''; c.media.style.transformOrigin = ''; if (c.neon) c.neon.style.transform = ''; }
    for (const el of [this.alive.back, this.alive.front]) { el.style.transform = ''; }
    this.cam = null; this.camPose = null;
  }

  // the effects of the work now on screen: [{ id, p }]
  setEffects(list) {
    const want = (list || []).filter(e => PACKS.has(e.id) && PACKS.get(e.id).type === 'effect').slice(0, 4);
    for (const a of this.active) if (!want.some(w => w.id === a.pk.id)) a.out = true;
    for (const w of want) {
      const pk = PACKS.get(w.id), p = paramsFor(pk, w.p);
      const cur = this.active.find(a => a.pk.id === w.id && !a.out);
      if (cur) { cur.inst.set ? cur.inst.set(p) : Object.assign(cur.p, p); continue; }
      try { this.active.push({ pk, p, inst: pk.create(this, p), k: 0, out: false }); } catch (err) { console.warn('package', w.id, err); }
    }
  }
  current() { return this.active.filter(a => !a.out).map(a => ({ id: a.pk.id, p: { ...a.p } })); }
  // a new work: only effects the next work does not use fade out; the same effect keeps running through the change
  keep(ids) { for (const a of this.active) if (!ids.includes(a.pk.id)) a.out = true; }
  clear(now = false) { if (now) { this.active.forEach(a => a.inst.dispose && a.inst.dispose()); this.active = []; this.wind.x = this.wind.y = 0; } else this.active.forEach(a => { a.out = true; }); }
  frame(dt) {
    if (this.bursts && this.bursts.length && this.alive.W) {
      this.bursts = this.bursts.filter(b => { try { return b.inst.frame(dt) !== false; } catch { return false; } });
      const fc = this.front; if (fc) { fc.globalAlpha = 1; fc.globalCompositeOperation = 'source-over'; }
    }
    // the screen-fixed layer is cleared every frame and sized like the light layers
    if (this._ov) {
      const { c, x } = this._ov, W = this.alive.W, H = this.alive.H, dpr = Math.min(this.alive.maxDpr || 1, window.devicePixelRatio || 1);
      const w = Math.round(W * dpr), h = Math.round(H * dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      x.setTransform(dpr, 0, 0, dpr, 0, 0); if (this._ovUsed) x.clearRect(0, 0, W, H); this._ovUsed = false;
    }
    this.lightsOnly = 0;
    if (!this.alive.W || !this.active.length) return;
    for (const a of this.active) {
      a.k += ((a.out ? 0 : 1) - a.k) * Math.min(1, dt * 1.6);
      try { a.inst.frame(dt, a.k); } catch (err) { console.warn('package', a.pk.id, err); a.out = true; a.k = 0; }
    }
    const gone = this.active.filter(a => a.out && a.k < 0.02);
    gone.forEach(a => a.inst.dispose && a.inst.dispose());
    if (gone.length) this.active = this.active.filter(a => !gone.includes(a));
    const fc = this.front; if (fc) { fc.globalAlpha = 1; fc.globalCompositeOperation = 'source-over'; }
    const bc = this.back; if (bc) { bc.globalAlpha = 1; bc.globalCompositeOperation = 'source-over'; }
  }
}

// transition packages run with the same helpers as the built-in transitions
export function transitionPack(id) { const pk = PACKS.get(id); return pk && pk.type === 'transition' ? pk : null; }
