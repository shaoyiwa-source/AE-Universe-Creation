/* Shared visitor entry for Eternal Sun pages (premium + Light Player). 2026-11-19
   Cover (artwork + one title) -> tap fades it out and starts sound -> painting with breathing
   gold dots and one faint hint line that leaves on the first tap. Mode row under the art,
   ending in a small text label 「說明」 that opens the explanation. No ? button, no text wall.
   Each page passes an adapter; the light/sound engines are not touched. */
(function (root) {
  'use strict';
  var CUES = [{ x: 0.22, y: 0.56 }, { x: 0.33, y: 0.30 }, { x: 0.76, y: 0.36 }, { x: 0.48, y: 0.74 }]; /* 11/19 16:03: nothing sits on the sun */
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function create(o) {
    var en = function () { return !!(o.isEn && o.isEn()); };
    var html = document.documentElement;
    var state = { cover: false, hint: false, started: false, help: false, firstTapAt: 0, coverTapAt: 0 };
    var Q = new URLSearchParams(location.search);
    html.classList.add('ae-ve');

    /* ---- cover ---- */
    var cover = null;
    var skipCover = Q.get('cover') === '0' || o.noCover;
    var pre = document.getElementById('aeCover');
    if (skipCover && pre) { pre.parentNode.removeChild(pre); pre = null; html.classList.remove('ae-cover-on'); }
    if (!skipCover) {
      cover = pre || el('div', { id: 'aeCover', role: 'button', tabindex: '0', 'aria-label': o.title + (en() ? ' — tap to enter' : ' — 點一下進入') },
        '<img class="aeCover-art" alt="" draggable="false" src="' + esc(o.artSrc) + '">' +
        '<div class="aeCover-veil" aria-hidden="true"></div>' +
        '<div class="aeCover-title"><span class="aeCover-rule" aria-hidden="true"></span><h1>' + esc(o.title) + '</h1><span class="aeCover-rule" aria-hidden="true"></span></div>');
      if (!pre) document.body.appendChild(cover);
      cover.setAttribute('aria-label', o.title + (en() ? ' — tap to enter' : ' — 點一下進入'));
      html.classList.add('ae-cover-on');
      state.cover = true;
      var stopEv = function (e) { e.stopPropagation(); };
      ['pointerdown', 'pointerup', 'touchstart', 'mousedown', 'mouseup'].forEach(function (ev) { cover.addEventListener(ev, stopEv); });
      /* iOS: no page scroll / rubber band behind the cover */
      cover.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
      var enter = function (e, quiet) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        if (!state.cover) return;
        state.cover = false;
        state.coverTapAt = performance.now();
        /* inside the user gesture: unlock + start audio */
        if (!quiet) { try { o.start && o.start(); state.started = true; } catch (err) { console.warn('[ae-ve] start', err); } }
        cover.classList.add('out');
        cover.setAttribute('aria-hidden', 'true');
        html.classList.remove('ae-cover-on');
        showHint();
        setTimeout(function () { if (cover && cover.parentNode) cover.parentNode.removeChild(cover); }, 700);
        try { document.dispatchEvent(new CustomEvent('ae-ve-enter')); } catch (err) {}
      };
      cover.addEventListener('click', function (e) { enter(e); });
      state.enterQuiet = function () { enter(null, true); };
      cover.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') enter(e); });
    }

    /* ---- faint hint ---- */
    var hint = el('div', { id: 'aeTapHint', 'aria-hidden': 'true' });
    function syncHintText() { hint.textContent = en() ? 'Tap the painting' : '輕觸畫面'; }
    syncHintText();
    (o.cueHost ? o.cueHost() : document.body).appendChild(hint);
    function showHint() { if (state.firstTapAt) return; state.hint = true; hint.classList.add('on'); }
    function firstTap(noStart) {
      if (state.cover) return;
      if (performance.now() - state.coverTapAt < 350) return; /* the cover tap itself */
      if (!state.firstTapAt) {
        state.firstTapAt = performance.now();
        state.hint = false;
        hint.classList.remove('on');
        hint.classList.add('gone');
        if (cues) cues.classList.add('ae-cues-soft');
        if (!state.started && o.start && !noStart) { try { o.start(); state.started = true; } catch (err) {} }
      }
    }
    function startOnce() { if (!state.started && o.start) { try { o.start(); state.started = true; } catch (err) {} } }
    if (!cover) showHint();

    /* ---- breathing gold dots ---- */
    var cues = el('div', { id: 'aeCues', 'aria-hidden': 'true' },
      CUES.map(function (c, i) { return '<span class="ae-cue" data-nx="' + c.x + '" data-ny="' + c.y + '" style="animation-delay:' + (i * 0.35) + 's"></span>'; }).join(''));
    (o.cueHost ? o.cueHost() : document.body).appendChild(cues);
    /* diagonal embossed watermark with the system name (Owner 11/19 11:04) */
    /* Owner 11/19 14:55: English page = English watermark + note, Chinese page = Chinese */
    var wmEn = false, wmFit = { key: '', k: 0 };
    var wm = el('div', { id: 'aeWatermark', 'aria-hidden': 'true' });
    (o.cueHost ? o.cueHost() : document.body).appendChild(wm);
    /* short self-dismissing note on entry: no button, never blocks taps */
    var toast = el('div', { id: 'aeToast', role: 'status', 'aria-live': 'polite' });
    (o.cueHost ? o.cueHost() : document.body).appendChild(toast);
    function langTexts() {
      wmEn = Q.get('wm') === 'en' || (Q.get('wm') !== 'zh' && en());
      var t = wmEn ? (o.titleEn || 'Eternal Sun Light & Sound Exhibition System').toUpperCase() : (o.title || '');
      if (wm.textContent !== t) { wm.textContent = t; wmFit.key = ''; }
      wm.classList.toggle('en', wmEn);
      var tParts = (en() ? (o.toastEn || '') : (o.toast || '')).split(/[:：]/);
      toast.innerHTML = tParts.length > 1 ? '<b>' + esc(tParts[0]) + '</b><span class="aeToast-sep" aria-hidden="true"></span><span>' + esc(tParts.slice(1).join('：')) + '</span>' : esc(tParts[0]);
    }
    langTexts();
    if (Q.get('toast') !== '0' && toast.textContent) {
      /* the ~3 s count starts once the painting has actually loaded, so a slow phone still sees the note */
      var showToast = function () {
        setTimeout(function () { placeToast(); toast.classList.add('on'); }, 250);
        setTimeout(function () { toast.classList.remove('on'); toast.classList.add('gone'); }, 250 + (o.toastMs || 3000));
      };
      if (document.readyState === 'complete') showToast(); else root.addEventListener('load', showToast, { once: true });
    }
    /* intro note: centred near the top of the painting, then nudged down/narrowed so it never covers
       a control (♫, ✦, back link, nav…) on any screen size */
    var toastFrame = 0;
    function placeToast(r) {
      r = r || (o.artRect && o.artRect());
      if (!r || !r.w) return;
      var host = toast.offsetParent || toast.parentNode, hr = host.getBoundingClientRect();
      var GAP = 8, maxW = Math.max(180, r.w - 28);
      toast.style.left = (r.x + r.w / 2) + 'px';
      toast.style.maxWidth = maxW + 'px';
      var top = r.y + Math.min(r.h * 0.06, 36);
      var ctrls = [], art = r.w * r.h;
      var els = document.querySelectorAll('a[href],button,[role="button"],input,select,summary');
      for (var i = 0; i < els.length; i++) {
        var e = els[i];
        if (toast.contains(e) || cues.contains(e) || (row && row.contains(e))) continue;
        var b = e.getBoundingClientRect();
        if (b.width < 2 || b.height < 2 || b.width * b.height > art * 0.4) continue;
        var cs = getComputedStyle(e);
        if (cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
        ctrls.push(b);
      }
      var w = toast.offsetWidth, h = toast.offsetHeight, L = hr.left + r.x + r.w / 2 - w / 2;
      function hits(T) {
        if (T < 4 || T + h > innerHeight - 4) return true;
        for (var j = 0; j < ctrls.length; j++) { var c = ctrls[j]; if (c.right + GAP > L && c.left - GAP < L + w && c.bottom + GAP > T && c.top - GAP < T + h) return true; }
        return false;
      }
      /* nearest free spot to the preferred one (searching down first, then up), so it never lands on a control
         and never gets pushed off screen (e.g. small painting in landscape) */
      var T0 = hr.top + top, best = null;
      for (var d = 0; d <= innerHeight; d += 4) {
        if (!hits(T0 + d)) { best = T0 + d; break; }
        if (d && !hits(T0 - d)) { best = T0 - d; break; }
      }
      if (best !== null) top = best - hr.top;
      toast.style.top = top + 'px';
    }
    function placeCues() {
      var r = o.artRect && o.artRect();
      if (!r || !r.w) return;
      var list = cues.querySelectorAll('.ae-cue');
      for (var i = 0; i < list.length; i++) {
        list[i].style.left = (r.x + r.w * +list[i].dataset.nx) + 'px';
        list[i].style.top = (r.y + r.h * +list[i].dataset.ny) + 'px';
      }
      var diag = Math.sqrt(r.w * r.w + r.h * r.h), ang = -Math.atan2(r.h, r.w) * 180 / Math.PI;
      var fs;
      if (wmEn) { /* long English name: fit it to ~78% of the diagonal */
        if (wmFit.key !== wm.textContent) { wm.style.fontSize = '20px'; var mw = wm.offsetWidth; wmFit.k = mw ? 20 / mw : 0.03; wmFit.key = wm.textContent; }
        fs = Math.max(10, Math.min(40, diag * 0.78 * wmFit.k));
      } else fs = Math.max(14, Math.min(72, diag * 0.068));
      wm.style.left = (r.x + r.w / 2) + 'px';
      wm.style.top = (r.y + r.h / 2) + 'px';
      wm.style.fontSize = fs.toFixed(1) + 'px';
      wm.style.transform = 'translate(-50%,-50%) rotate(' + ang.toFixed(2) + 'deg)';
      if (!toast.classList.contains('gone') && (toastFrame++ % 6 === 0)) placeToast(r);
      hint.style.left = (r.x + r.w / 2) + 'px';
      hint.style.top = (r.y + r.h * (o.hintY || 0.88)) + 'px';
    }

    /* ---- mode row + 說明 ---- */
    var row = el('div', { id: 'aeModes', role: 'group', 'aria-label': '光效模式' });
    function buildRow() {
      row.innerHTML = o.modes.map(function (m) {
        return '<button type="button" data-mode="' + esc(m.id) + '" aria-pressed="false">' + esc(en() ? m.en : m.zh) + '</button>';
      }).join('') + '<span class="aeModes-sep" aria-hidden="true"></span><button type="button" class="aeModes-help" data-help="1" aria-haspopup="dialog">' + (en() ? 'About' : '說明') + '</button>';
      row.setAttribute('aria-label', en() ? 'Light mode' : '光效模式');
      syncModes();
    }
    function syncModes() {
      var cur = o.current ? o.current() : null;
      var bs = row.querySelectorAll('button[data-mode]');
      for (var i = 0; i < bs.length; i++) {
        var on = bs[i].dataset.mode === cur;
        bs[i].classList.toggle('on', on);
        bs[i].setAttribute('aria-pressed', String(on));
      }
    }
    ['pointerdown', 'pointerup', 'touchstart'].forEach(function (ev) { row.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    row.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.help) { openHelp(); return; }
      if (o.setMode) o.setMode(b.dataset.mode);
      syncModes();
    });
    buildRow();
    if (o.mountRow) o.mountRow(row); else document.body.appendChild(row);

    /* ---- help sheet (opened only from 說明) ---- */
    var sheet = el('div', { id: 'aeHelpSheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'aeHelpTitle', hidden: '' });
    function buildSheet() {
      var items = en() ? o.help.en : o.help.zh;
      sheet.innerHTML = '<div class="aeHelp-card"><h2 id="aeHelpTitle">' + esc(o.title) + '</h2><ul>' +
        items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
        '</ul><button type="button" class="aeHelp-close">' + (en() ? 'Close' : '關閉') + '</button></div>';
    }
    buildSheet();
    document.body.appendChild(sheet);
    ['pointerdown', 'pointerup', 'touchstart', 'click'].forEach(function (ev) { sheet.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    sheet.addEventListener('touchmove', function (e) { if (!e.target.closest('.aeHelp-card')) e.preventDefault(); }, { passive: false });
    sheet.addEventListener('click', function (e) { if (e.target === sheet || e.target.closest('.aeHelp-close')) closeHelp(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.help) closeHelp(); });
    var lastFocus = null;
    function openHelp() {
      buildSheet();
      lastFocus = document.activeElement;
      sheet.removeAttribute('hidden');
      state.help = true;
      html.classList.add('ae-help-on');
      var c = sheet.querySelector('.aeHelp-close');
      setTimeout(function () { try { c.focus(); } catch (e) {} }, 30);
    }
    function closeHelp() {
      sheet.setAttribute('hidden', '');
      state.help = false;
      html.classList.remove('ae-help-on');
      try { lastFocus && lastFocus.focus && lastFocus.focus(); } catch (e) {}
    }

    function relang() { langTexts(); syncHintText(); buildRow(); if (state.help) buildSheet(); if (cover) { var h = cover.querySelector('h1'); if (h) h.textContent = o.title; } }

    var raf = 0;
    (function tick() { placeCues(); if (o.placeRow) o.placeRow(row); raf = requestAnimationFrame(tick); })();
    addEventListener('resize', placeCues);

    if (window.__aeCoverTapped && state.enterQuiet) state.enterQuiet(); /* tapped before the page script was ready */
    if (Q.has('help')) { if (state.enterQuiet) state.enterQuiet(); openHelp(); }

    /* a tap on or near a dot makes that dot flare, so the dots read as buttons */
    function tapAt(cx, cy) {
      var list = cues.querySelectorAll('.ae-cue'), best = null, bd = 1e9;
      for (var i = 0; i < list.length; i++) {
        var r = list[i].getBoundingClientRect(), dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = list[i]; }
      }
      if (best && bd <= 56 * 56) {
        best.classList.remove('hit'); void best.offsetWidth; best.classList.add('hit');
        setTimeout(function () { best.classList.remove('hit'); }, 720);
        return true;
      }
      return false;
    }
    var api = { tapAt: tapAt, firstTap: firstTap, startOnce: startOnce, watermark: wm, toast: toast, syncModes: syncModes, relang: relang, openHelp: openHelp, closeHelp: closeHelp, state: state, row: row, hint: hint, cues: cues, cover: function () { return cover; } };
    root.__aeVisitorEntry = api;
    return api;
  }
  root.AEVisitorEntry = { create: create, CUES: CUES };
})(window);
