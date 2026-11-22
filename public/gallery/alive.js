// AE Lumina Wall — "Living painting" (R10). The work itself starts still, then its own strokes begin to flow;
// touching a living part makes it answer — the longer / harder the touch, the bigger the answer.
//  analyse(img) → a small feature map read from the painting: stroke direction, how "alive" each area is
//                 (strong, coherent strokes / swirls / rays / confetti), sparkle, colour
//  WebGL       → the painting is redrawn with a flow map along its own strokes (continuous, no drift),
//                 touches stir it (swirl + ripple + faster flow) and light it with a soft champagne glow
// No WebGL → nothing is drawn and the static <img> underneath stays exactly as before.

const MAX_TOUCH = 6;
const VS = `attribute vec2 p; varying vec2 v; void main(){ v = vec2(p.x*.5+.5, .5-p.y*.5); gl_Position = vec4(p,0.,1.); }`;
const FS = `precision mediump float;
varying vec2 v;
uniform sampler2D u_img, u_feat;
uniform float u_t, u_amb, u_gain;
uniform vec2 u_px;            // art size / max side (aspect-correct distances)
uniform vec4 u_tp[${MAX_TOUCH}];  // touch: x, y (uv), radius, strength
uniform vec4 u_tq[${MAX_TOUCH}];  // touch: spin sign, ripple age, highlight, unused
uniform vec3 u_hover;         // x, y, strength
float hash(vec2 q){ return fract(sin(dot(q, vec2(12.9898,78.233))) * 43758.5453); }
float vnoise(vec2 q){ vec2 i = floor(q), f = fract(q); f = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x), mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), f.x), f.y); }
vec2 rot(vec2 q, vec2 c, float a){ float s = sin(a), co = cos(a); q -= c; return c + vec2(co*q.x - s*q.y, s*q.x + co*q.y); }
void main(){
  vec4 f = texture2D(u_feat, v);
  vec2 dir = f.rg * 2. - 1.;
  float alive = f.a, spark = f.b;
  float edge = smoothstep(0., .09, v.x) * smoothstep(0., .09, 1.-v.x) * smoothstep(0., .09, v.y) * smoothstep(0., .09, 1.-v.y);
  vec2 uv = v;
  float boost = 0., hl = 0.;
  for (int i = 0; i < ${MAX_TOUCH}; i++) {
    vec4 tp = u_tp[i]; vec4 tq = u_tq[i];
    if (tp.w <= 0.001) continue;
    vec2 d = (v - tp.xy) * u_px;
    float r = tp.z, dd = dot(d, d);
    float w = exp(-dd / (r*r)) * tp.w;
    boost += w;
    hl += exp(-dd / (r*r*1.6)) * tq.z;
    // stir: the paint turns around the finger (stronger near the centre)
    uv = rot(uv, tp.xy, tq.x * w * .3 * edge);
    // a ring of motion travels outwards from the touch
    float dl = sqrt(dd);
    float ring = sin(dl * 46. - tq.y * 9.) * exp(-dl / (r * 1.8)) * smoothstep(0., .25, tq.y) * exp(-tq.y * 1.3);
    uv += normalize(d + 1e-5) / u_px * ring * .004 * tp.w * edge;
  }
  float hd = length((v - u_hover.xy) * u_px);
  hl += u_hover.z * exp(-hd*hd / .012);
  // flow along the painting's own strokes (two-phase flow map: continuous, never drifts away)
  float L = (u_amb * alive * .009 + min(boost, 1.4) * (.006 + alive * .018)) * u_gain * edge;
  float ph = u_t * .16;
  float p0 = fract(ph), p1 = fract(ph + .5);
  float k = abs(1. - 2. * p0);
  vec4 c0 = texture2D(u_img, clamp(uv + dir * (p0 - .5) * L, .001, .999));
  vec4 c1 = texture2D(u_img, clamp(uv + dir * (p1 - .5) * L, .001, .999));
  vec4 col = mix(c0, c1, k);
  // confetti / dots twinkle
  float lum = dot(col.rgb, vec3(.299,.587,.114));
  float tw = pow(vnoise(v * u_px * 70. + vec2(u_t * .9, -u_t * .6)), 6.) * 3.;
  col.rgb *= 1. + spark * tw * (.5 + lum) * (.14 * u_amb + .3 * min(boost, 1.)) * u_gain;
  // the living part being touched (or hovered) warms up a little: "this one is alive"
  col.rgb += vec3(.95, .80, .52) * alive * min(hl, 1.2) * .2;
  col.rgb += vec3(.95, .80, .52) * min(boost, 1.5) * .05 * alive;
  gl_FragColor = vec4(col.rgb, 1.);
}`;

// ---------- reading the painting ----------
export function analysePainting(img) {
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh) return null;
  const S = 192, sc = S / Math.max(nw, nh);
  const w = Math.max(8, Math.round(nw * sc)), h = Math.max(8, Math.round(nh * sc));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  let px;
  try { px = x.getImageData(0, 0, w, h).data; } catch { return null; }
  const L = new Float32Array(w * h), Sat = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    L[i] = 0.299 * r + 0.587 * g + 0.114 * b; Sat[i] = mx ? (mx - mn) / mx : 0;
  }
  // grid of cells (≈ 36 on the long side)
  const GL = 36, cell = Math.max(w, h) / GL;
  const gw = Math.max(4, Math.round(w / cell)), gh = Math.max(4, Math.round(h / cell));
  const jxx = new Float32Array(gw * gh), jyy = new Float32Array(gw * gh), jxy = new Float32Array(gw * gh), sat = new Float32Array(gw * gh), cnt = new Float32Array(gw * gh);
  for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++) {
    const i = y * w + xx;
    const gx = (L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1]) - (L[i - w - 1] + 2 * L[i - 1] + L[i + w - 1]);
    const gy = (L[i + w - 1] + 2 * L[i + w] + L[i + w + 1]) - (L[i - w - 1] + 2 * L[i - w] + L[i - w + 1]);
    const c = Math.min(gw - 1, Math.floor(xx / w * gw)) + Math.min(gh - 1, Math.floor(y / h * gh)) * gw;
    jxx[c] += gx * gx; jyy[c] += gy * gy; jxy[c] += gx * gy; sat[c] += Sat[i]; cnt[c]++;
  }
  // smooth the tensor with the 8 neighbours (strokes span several cells)
  const blur = (a) => { const o = new Float32Array(a.length); for (let y = 0; y < gh; y++) for (let x2 = 0; x2 < gw; x2++) { let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x2 + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= gw || Y >= gh) continue; const wt = dx || dy ? 0.6 : 1; s += a[Y * gw + X] * wt; n += wt; } o[y * gw + x2] = s / n; } return o; };
  const Jxx = blur(jxx), Jyy = blur(jyy), Jxy = blur(jxy);
  const energy = new Float32Array(gw * gh), coh = new Float32Array(gw * gh), ang = new Float32Array(gw * gh);
  for (let c = 0; c < gw * gh; c++) {
    const n = Math.max(1, cnt[c]), a = Jxx[c] / n, b = Jyy[c] / n, d = Jxy[c] / n;
    energy[c] = a + b;
    coh[c] = Math.sqrt((a - b) * (a - b) + 4 * d * d) / (a + b + 1e-6);
    ang[c] = 0.5 * Math.atan2(2 * d, a - b) + Math.PI / 2; // stroke direction = across the gradient
    sat[c] /= n;
  }
  const sorted = Array.from(energy).sort((p, q) => p - q);
  const lo = sorted[Math.floor(sorted.length * 0.2)], hi = sorted[Math.floor(sorted.length * 0.92)] || 1;
  const feat = new Uint8Array(gw * gh * 4), alive = new Float32Array(gw * gh);
  // align the axial stroke directions with their neighbours so the flow does not cancel out between cells
  const dx = new Float32Array(gw * gh), dy = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x2 = 0; x2 < gw; x2++) {
    const c = y * gw + x2; let ux = Math.cos(ang[c]), uy = Math.sin(ang[c]);
    let rx = 0, ry = 0;
    if (x2 > 0) { rx += dx[c - 1]; ry += dy[c - 1]; }
    if (y > 0) { rx += dx[c - gw]; ry += dy[c - gw]; }
    if (rx * ux + ry * uy < 0) { ux = -ux; uy = -uy; }
    dx[c] = ux; dy[c] = uy;
  }
  for (let c = 0; c < gw * gh; c++) {
    const e = Math.max(0, Math.min(1, (energy[c] - lo) / (hi - lo + 1e-6)));
    const a = Math.max(0, Math.min(1, (e - 0.12) / 0.6)) * (0.45 + 0.55 * Math.min(1, coh[c] * 1.6));
    alive[c] = a;
    const sp = Math.max(0, Math.min(1, e * (1 - coh[c]) * (0.4 + sat[c]) * 1.4));
    feat[c * 4] = Math.round((dx[c] * 0.5 + 0.5) * 255);
    feat[c * 4 + 1] = Math.round((dy[c] * 0.5 + 0.5) * 255);
    feat[c * 4 + 2] = Math.round(sp * 255);
    feat[c * 4 + 3] = Math.round(a * 255);
  }
  const share = alive.filter(a => a > 0.3).length / alive.length;
  return { gw, gh, feat, alive, share };
}

// ---------- the living layer ----------
export class Alive {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pl-alive';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.enabled = true; this.gain = 1; this.maxDpr = 2;
    this.touches = []; this.hover = { x: 0, y: 0, s: 0, target: 0 };
    this.cache = new Map(); this.map = null; this.rect = null; this.t = 0; this.since = 0; this.on = false;
    this.stats = { presses: 0, taps: 0, frames: 0 };
    try { this._init(); } catch { this.gl = null; }
  }
  get ok() { return !!this.gl; }
  _init() {
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: false, antialias: false, preserveDrawingBuffer: false });
    if (!gl) return;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = (unit) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
    this.texImg = tex(0); this.texFeat = tex(1);
    const u = (n) => gl.getUniformLocation(pr, n);
    this.u = { img: u('u_img'), feat: u('u_feat'), t: u('u_t'), amb: u('u_amb'), gain: u('u_gain'), px: u('u_px'), tp: u('u_tp'), tq: u('u_tq'), hover: u('u_hover') };
    gl.uniform1i(this.u.img, 0); gl.uniform1i(this.u.feat, 1);
    this.gl = gl;
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
  }

  // show the living layer over a painting that has just appeared
  attach(slide, media, rect, id) {
    this.detach();
    if (!this.gl || !this.enabled || !media || media.tagName !== 'IMG' || !media.naturalWidth) return false;
    let map = this.cache.get(id);
    if (!map) { map = analysePainting(media); if (!map) return false; this.cache.set(id, map); }
    const gl = this.gl;
    try {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texImg);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texFeat);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, map.gw, map.gh, 0, gl.RGBA, gl.UNSIGNED_BYTE, map.feat);
    } catch { return false; } // e.g. a cross-origin image
    this.map = map; this.media = media; this.touches = []; this.since = 0; this.t0 = performance.now(); this.on = true;
    slide.appendChild(this.canvas);
    this.setRect(rect);
    this.canvas.classList.remove('on'); void this.canvas.offsetWidth; this.canvas.classList.add('on');
    return true;
  }
  detach() {
    this.on = false; this.touches = []; this.map = null;
    this.canvas.classList.remove('on');
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }
  setRect(r) {
    if (!r) return;
    this.rect = r;
    const m = this.media;
    Object.assign(this.canvas.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    if (m) for (const k of ['--kb-x', '--kb-y', '--kb-dur']) this.canvas.style.setProperty(k, m.style.getPropertyValue(k));
    const dpr = Math.min(this.maxDpr, window.devicePixelRatio || 1);
    const W = Math.max(2, Math.round(r.w * dpr)), H = Math.max(2, Math.round(r.h * dpr));
    if (this.canvas.width !== W || this.canvas.height !== H) { this.canvas.width = W; this.canvas.height = H; }
  }

  // how alive the painting is at a point of the player (0 … 1); used to decide: play with it, or magnify
  aliveAt(x, y) {
    const r = this.rect, m = this.map;
    if (!this.on || !r || !m || x < r.x || y < r.y || x > r.x + r.w || y > r.y + r.h) return 0;
    const gx = Math.min(m.gw - 1, Math.floor((x - r.x) / r.w * m.gw)), gy = Math.min(m.gh - 1, Math.floor((y - r.y) / r.h * m.gh));
    let best = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = gx + dx, Y = gy + dy; if (X >= 0 && Y >= 0 && X < m.gw && Y < m.gh) best = Math.max(best, m.alive[Y * m.gw + X] * (dx || dy ? 0.85 : 1)); }
    return best;
  }
  _uv(x, y) { const r = this.rect; return [(x - r.x) / r.w, (y - r.y) / r.h]; }

  // a finger / mouse goes down on a living part
  press(id, x, y, force = 0) {
    if (!this.on) return;
    const [u, v] = this._uv(x, y);
    this.touches = this.touches.filter(t => t.id !== id).slice(-(MAX_TOUCH - 1));
    this.touches.push({ id, u, v, down: true, hold: 0, s: 0, age: 0, rel: 0, spin: Math.random() < 0.5 ? -1 : 1, force, hl: 0 });
    this.stats.presses++;
  }
  move(id, x, y, force) {
    const t = this.touches.find(q => q.id === id && q.down); if (!t) return;
    const [u, v] = this._uv(x, y); t.u = u; t.v = v; if (force != null) t.force = Math.max(t.force, force);
  }
  release(id) {
    const t = this.touches.find(q => q.id === id && q.down); if (!t) return;
    t.down = false; t.rel = 0; t.peak = t.s;
    if (t.hold < 0.25) { t.peak = Math.max(t.s, 0.85); this.stats.taps++; } // a quick tap still gives a clear answer
  }
  setHover(x, y) {
    if (!this.on) return 0;
    const a = this.aliveAt(x, y);
    const [u, v] = this._uv(x, y); this.hover.x = u; this.hover.y = v; this.hover.target = a > 0.3 ? 1 : 0;
    return a;
  }
  clearHover() { this.hover.target = 0; }
  strength() { return this.touches.reduce((m, t) => Math.max(m, t.s), 0); }
  get pressing() { return this.touches.some(t => t.down); }

  frame(dt, playing) {
    if (!this.on || !this.gl || this.lost) return;
    this.t += dt; this.since = (performance.now() - this.t0) / 1000; // wall-clock: slow devices come alive on time too
    // still for the first moments, then the strokes begin to move by themselves
    const amb = playing ? Math.max(0, Math.min(1, (this.since - 2.2) / 2.8)) : Math.min(1, Math.max(0, (this.since - 2.2) / 2.8)) * 0.6;
    for (const t of this.touches) {
      t.age += dt;
      if (t.down) {
        t.hold += dt;
        // the longer (and harder) the press, the bigger the answer
        const target = Math.min(1.5, 0.6 + t.hold * 0.6 + t.force * 0.5);
        t.s += (target - t.s) * Math.min(1, dt * 6);
        t.hl += (1 - t.hl) * Math.min(1, dt * 8);
      } else {
        t.rel += dt;
        const k = Math.exp(-t.rel * 1.6);
        t.s = (t.peak || 0) * k * (1 + 0.25 * Math.sin(t.rel * 9) * k); // springs back, settles
        t.hl *= Math.exp(-dt * 3);
      }
    }
    this.touches = this.touches.filter(t => t.down || t.s > 0.01);
    this.hover.s += (this.hover.target - this.hover.s) * Math.min(1, dt * 7);
    this.amb = amb;
    this._draw(amb);
    this.stats.frames++;
  }
  _draw(amb) {
    const gl = this.gl, r = this.rect;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const mx = Math.max(r.w, r.h);
    gl.uniform1f(this.u.t, this.t); gl.uniform1f(this.u.amb, amb); gl.uniform1f(this.u.gain, this.gain);
    gl.uniform2f(this.u.px, r.w / mx, r.h / mx);
    const tp = new Float32Array(MAX_TOUCH * 4), tq = new Float32Array(MAX_TOUCH * 4);
    this.touches.slice(-MAX_TOUCH).forEach((t, i) => {
      const rad = 0.12 + Math.min(0.16, (t.down ? t.hold : t.hold + t.rel * 0.4) * 0.08) + t.force * 0.06;
      tp.set([t.u, t.v, rad, t.s], i * 4);
      tq.set([t.spin, t.age, t.hl, 0], i * 4);
    });
    gl.uniform4fv(this.u.tp, tp); gl.uniform4fv(this.u.tq, tq);
    gl.uniform3f(this.u.hover, this.hover.x, this.hover.y, this.hover.s);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
