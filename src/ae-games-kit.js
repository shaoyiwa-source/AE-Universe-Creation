/* AE games kit 2026-10-30 — shared by /together (雙生共創 Twin Flame) and /dream-giver (夢想給予 Dream Giver).
   Overlay-only light: particles and glows are drawn on a separate canvas ABOVE the page.
   Artwork images are never filtered, transformed or redrawn with effects; exported cards place the
   original painting file unaltered (contain-fit, no crop, no filter) inside a frame. No network calls. */
(()=>{
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FONT_ZH = '"Noto Serif TC","Noto Serif CJK TC","PingFang TC","Songti TC","Microsoft JhengHei",serif';
  const FONT_EN = '"Cormorant Garamond",Georgia,"Times New Roman",serif';

  /* ---------- particles (overlay canvas, pointer-events:none) ---------- */
  let fx = null, fctx = null, parts = [], running = false;
  function ensureFx(){
    if (fx) return;
    fx = document.createElement('canvas');
    fx.setAttribute('aria-hidden','true');
    fx.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:60';
    document.body.appendChild(fx);
    fctx = fx.getContext('2d');
    const size = () => { const d = Math.min(2, devicePixelRatio || 1); fx.width = innerWidth * d; fx.height = innerHeight * d; fctx.setTransform(d,0,0,d,0,0); };
    size(); addEventListener('resize', size);
  }
  function loop(){
    if (!parts.length){ running = false; fctx.clearRect(0,0,innerWidth,innerHeight); return; }
    running = true;
    fctx.clearRect(0,0,innerWidth,innerHeight);
    fctx.globalCompositeOperation = 'lighter';
    parts = parts.filter(p => p.life > 0);
    for (const p of parts){
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= .985; p.vy *= .985; p.life -= p.decay;
      const a = Math.max(0, p.life);
      const r = p.r * (0.6 + a * 0.6);
      const grd = fctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*3);
      grd.addColorStop(0, `rgba(${p.c},${a})`); grd.addColorStop(1, `rgba(${p.c},0)`);
      fctx.fillStyle = grd; fctx.beginPath(); fctx.arc(p.x,p.y,r*3,0,Math.PI*2); fctx.fill();
    }
    fctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(loop);
  }
  const COLORS = { gold:'255,214,130', blue:'120,170,255', teal:'140,255,226', white:'255,250,238', rose:'255,170,205' };
  function burst(x, y, opts){
    if (reduce) return;
    ensureFx();
    const o = Object.assign({ n: 26, colors: ['gold','white'], speed: 3.2, size: 2.4, gravity: .02, decay: .016 }, opts||{});
    for (let i = 0; i < o.n; i++){
      const a = Math.random() * Math.PI * 2, s = o.speed * (0.35 + Math.random());
      parts.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - (o.lift||0), g: o.gravity, r: o.size*(0.5+Math.random()), life: 1, decay: o.decay*(0.7+Math.random()*0.6), c: COLORS[o.colors[i % o.colors.length]] || o.colors[0] });
    }
    if (!running) requestAnimationFrame(loop);
  }
  function burstAt(el, opts){
    const r = el.getBoundingClientRect();
    burst(r.left + r.width/2, r.top + r.height/2, opts);
  }

  /* ---------- sound + touch feedback ---------- */
  function chime(kind, x){
    try {
      if (!window.aeChime) return;
      if (kind === 'glow') window.aeChime.glow(); else window.aeChime.tap(x == null ? .5 : x);
    } catch(e){}
  }
  function buzz(ms){ try { if (navigator.vibrate) navigator.vibrate(ms || 12); } catch(e){} }

  /* ---------- canvas helpers ---------- */
  function loadImg(src){
    return new Promise((ok, no) => { const im = new Image(); im.decoding = 'async'; im.onload = () => ok(im); im.onerror = () => no(new Error('img ' + src)); im.src = src; });
  }
  async function fontsReady(){
    try {
      await Promise.race([
        Promise.all([document.fonts.load('600 40px "Noto Serif TC"'), document.fonts.load('500 40px "Cormorant Garamond"'), document.fonts.load('italic 500 40px "Cormorant Garamond"')]),
        new Promise(r => setTimeout(r, 1500))
      ]);
    } catch(e){}
  }
  function wrap(ctx, text, maxW){
    const out = []; let line = '';
    const tokens = /[\u3000-\u9fff\uff00-\uffef]/.test(text) ? [...text] : text.split(/(\s+)/);
    for (const t of tokens){
      const next = line + t;
      if (ctx.measureText(next).width > maxW && line.trim()){ out.push(line.trim()); line = t.trimStart ? t.trimStart() : t; }
      else line = next;
    }
    if (line.trim()) out.push(line.trim());
    return out;
  }
  function text(ctx, str, x, y, o){
    ctx.save();
    ctx.font = o.font; ctx.fillStyle = o.color || '#f6f1e8'; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'alphabetic';
    if (o.spacing && 'letterSpacing' in ctx) ctx.letterSpacing = o.spacing + 'px';
    const lines = o.maxW ? wrap(ctx, str, o.maxW) : [str];
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * (o.lh || 0)));
    ctx.restore();
    return y + (lines.length - 1) * (o.lh || 0);
  }
  /* Place the ORIGINAL painting, unaltered, contain-fit inside a box, with a thin gold frame. */
  function paintingInBox(ctx, im, bx, by, bw, bh){
    const s = Math.min(bw / im.naturalWidth, bh / im.naturalHeight);
    const w = Math.round(im.naturalWidth * s), h = Math.round(im.naturalHeight * s);
    const x = Math.round(bx + (bw - w) / 2), y = Math.round(by + (bh - h) / 2);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.drawImage(im, x, y, w, h);
    ctx.save(); ctx.strokeStyle = 'rgba(231,189,103,.75)'; ctx.lineWidth = 2; ctx.strokeRect(x - 10, y - 10, w + 20, h + 20); ctx.restore();
    return { x, y, w, h };
  }
  function cardBackground(ctx, W, H){
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#16120e'); g.addColorStop(.55, '#0d0b09'); g.addColorStop(1, '#090807');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r = ctx.createRadialGradient(W/2, H*0.08, 0, W/2, H*0.08, W*0.9);
    r.addColorStop(0, 'rgba(231,189,103,.16)'); r.addColorStop(1, 'rgba(231,189,103,0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.strokeStyle = 'rgba(231,189,103,.35)'; ctx.lineWidth = 2; ctx.strokeRect(36, 36, W - 72, H - 72); ctx.restore();
  }

  /* ---------- save + share ---------- */
  function saveCanvas(canvas, filename){
    return new Promise(res => {
      canvas.toBlob(async blob => {
        if (!blob) return res(false);
        const file = new File([blob], filename, { type: 'image/png' });
        const touch = matchMedia('(pointer: coarse)').matches;
        if (touch && navigator.canShare && navigator.canShare({ files: [file] })){
          try { await navigator.share({ files: [file] }); return res(true); } catch(e){ if (e && e.name === 'AbortError') return res(false); }
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        res(true);
      }, 'image/png');
    });
  }
  async function shareLink(url, title, textLine){
    try { if (navigator.share){ await navigator.share({ title, text: textLine, url }); return 'shared'; } } catch(e){ if (e && e.name === 'AbortError') return 'cancel'; }
    try { await navigator.clipboard.writeText(url); return 'copied'; } catch(e){}
    return 'manual';
  }
  function hash32(s){ let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function mix(h, i){ let x = (h + Math.imul(i + 1, 2654435761)) >>> 0; x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0; x ^= x >>> 16; return x >>> 0; }
  function cleanName(v){ return String(v || '').replace(/[<>&"'`\u0000-\u001f]/g, '').trim().slice(0, 12); }
  function today(){ const d = new Date(); return d.getFullYear() + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + String(d.getDate()).padStart(2,'0'); }

  window.aeGames = { reduce, FONT_ZH, FONT_EN, burst, burstAt, chime, buzz, loadImg, fontsReady, wrap, text, paintingInBox, cardBackground, saveCanvas, shareLink, hash32, mix, cleanName, today, COLORS };
})();
