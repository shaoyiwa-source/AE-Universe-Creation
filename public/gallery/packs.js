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

export const PACKS = new Map();
export function registerPack(pk) {
  if (!pk || !/^[a-z0-9-]{1,40}$/.test(pk.id || '') || !['effect', 'transition'].includes(pk.type)) throw new Error('bad package');
  if (pk.type === 'effect' && typeof pk.create !== 'function') throw new Error('effect needs create()');
  if (pk.type === 'transition' && typeof pk.run !== 'function') throw new Error('transition needs run()');
  PACKS.set(pk.id, pk);
  return pk;
}
[wind, light, ribbons, fly, flip, zoom, curtain].forEach(registerPack);

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
  get palette() { return this.alive.palette && this.alive.palette.length ? this.alive.palette : [[236, 205, 140]]; }
  get reading() { return this.alive.readingMap; }
  sprite(rgb, soft) { return this.alive.spriteOf(rgb, soft); }
  colorAt(x, y) { return this.alive.colorOf(x, y); }
  flowAt(x, y) { return this.alive.dirAt(x, y); }
  livingPoint() { return this.alive.livingPoint(); }

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
  clear(now = false) { if (now) { this.active.forEach(a => a.inst.dispose && a.inst.dispose()); this.active = []; this.wind.x = this.wind.y = 0; } else this.active.forEach(a => { a.out = true; }); }
  frame(dt) {
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
