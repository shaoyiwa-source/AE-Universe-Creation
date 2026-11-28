/* Visitor-facing entry for /premium/eternal-sun/ — adapter for the shared /assets/ae-visitor-entry.js.
   2026-11-19: cover with title only, tap starts the music; faint 「輕觸畫面」; gold dots; mode row under
   the art ending in 「說明」. The 11/17 ? button and first-visit intro are gone. Engine untouched. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const Q = new URLSearchParams(location.search);
  const MODES = [
    { id: 'home', zh: '聲光', en: 'Show' },
    { id: 'club', zh: '夜店', en: 'Club' },
    { id: 'breath', zh: '柔光', en: 'Soft' },
    { id: 'gem', zh: '寶石', en: 'Gem' },
    { id: 'calm', zh: '原畫', en: 'Art' }
  ]; /* 11/28 Owner: Show (聲光) first, Art last; others shift. Labels unchanged. */
  /* R3 11/28 林星宇: each mode answers the tap with one everyday line (shown under the row, and printed on the light card) */
  const MODE_LINE = {
    home: { zh: '跟著節拍，讓整幅畫醒來', en: 'Let the whole painting wake up to the beat' },
    club: { zh: '今晚的心跳，大聲一點', en: 'Tonight, let the heartbeat be a little louder' },
    breath: { zh: '慢慢呼吸，讓光陪你放鬆', en: 'Breathe slowly; the light keeps you company' },
    gem: { zh: '把閃亮留給今天的自己', en: 'Keep some sparkle for yourself today' },
    calm: { zh: '安靜看一幅畫，也是一種休息', en: 'Quietly looking at a painting is rest too' }
  };
  const HELP = {
    zh: [
      '這是一幅會出聲、會發光的畫：點一下畫面，音樂和光就會陪著你。',
      '下面這排有 5 種心情：聲光、夜店、柔光、寶石、原畫，點一下就換。',
      '跟著節拍點畫面，光會更亮。',
      '右下角「✦ 光繪卡」：用手指在畫上畫光，做成一張你自己的卡，可以下載或長按存圖。',
      '雙指可以放大；左右滑可以換畫。',
      '請打開聲音或戴上耳機。'
    ],
    en: [
      'A painting that glows and sings: tap it and the music and light keep you company.',
      'The row below has 5 moods: Show, Club, Soft, Gem, Art. Tap to switch.',
      'Tap on the beat for stronger light.',
      '「✦ Light card」 (bottom right): draw light on the painting with your finger and turn it into your own card to download or save.',
      'Pinch to zoom; swipe left or right to change the painting.',
      'Turn the sound on or use headphones.'
    ]
  };
  const isEn = () => {
    const S = window.__premium && window.__premium.S;
    if (S && S.lang) return S.lang === 'en';
    return document.documentElement.lang === 'en';
  };

  function hideOldChrome() {
    document.documentElement.classList.add('ae-intro-seen');
    const intro = $('#aeIntro');
    if (intro) { intro.setAttribute('hidden', ''); intro.setAttribute('aria-hidden', 'true'); intro.classList.remove('on'); }
    const hint = $('#hint'); if (hint) hint.setAttribute('hidden', '');
    const oh = $('#openhint'); if (oh) oh.setAttribute('hidden', '');
    const old = $('#aeHelp'); if (old) old.remove();
  }

  function waitPremium(fn) {
    if (window.__premium && window.__premium.applyPreset && window.__premium.L) { fn(); return; }
    let n = 0;
    const t = setInterval(() => {
      n++;
      if ((window.__premium && window.__premium.applyPreset && window.__premium.L) || n > 120) { clearInterval(t); fn(); }
    }, 50);
  }

  if (Q.get('advanced') === '1' || Q.get('exhibitor') === '1') document.documentElement.classList.add('es-adv');
  /* R3: read the visitor's strokes (u,v on the painting) — direction relative to the sun, length, how many */
  function strokeKind(st, sun) {
    const pts = st.pts; if (!pts || pts.length < 2) return 'dot';
    let len = 0, sweep = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].u - pts[i - 1].u, pts[i].v - pts[i - 1].v);
      let a = Math.atan2(pts[i].v - sun[1], pts[i].u - sun[0]) - Math.atan2(pts[i - 1].v - sun[1], pts[i - 1].u - sun[0]);
      if (a > Math.PI) a -= 2 * Math.PI; if (a < -Math.PI) a += 2 * Math.PI; sweep += a;
    }
    const d0 = Math.hypot(pts[0].u - sun[0], pts[0].v - sun[1]), d1 = Math.hypot(pts[pts.length - 1].u - sun[0], pts[pts.length - 1].v - sun[1]);
    if (len < 0.05) return 'dot';
    if (Math.abs(sweep) > 2.2) return 'around';
    if (d1 - d0 > 0.12) return 'out';
    if (d0 - d1 > 0.12) return 'in';
    if (len > 0.7) return 'long';
    return 'wave';
  }
  const KIND = {
    out: { zh: '光從中心向外綻放', en: 'light blooming outward from the centre' },
    in: { zh: '光向中心慢慢聚攏', en: 'light gathering toward the centre' },
    around: { zh: '光繞著太陽流動', en: 'light flowing around the sun' },
    long: { zh: '一道光流過整幅畫', en: 'one long line of light across the painting' },
    wave: { zh: '光在畫上輕輕起伏', en: 'light gently rising and falling' },
    dot: { zh: '幾點星光輕輕亮起', en: 'a few stars lighting up' }
  };
  const sunOf = () => { const P = window.__premium, a = P && P.art && P.art(); return (a && a.sun) || [0.5, 0.5]; };
  window.__esCard = {
    kind: st => strokeKind(st, sunOf()),
    info(strokes, preset) {
      const en = isEn(), live = (strokes || []).filter(st => st.pts && st.pts.length > 1), sun = sunOf(), cnt = {};
      live.forEach(st => { const k = strokeKind(st, sun); cnt[k] = (cnt[k] || 0) + 1; });
      let top = 'dot', best = -1; Object.keys(cnt).forEach(k => { if (cnt[k] > best) { best = cnt[k]; top = k; } });
      const m = MODES.find(x => x.id === preset), ml = MODE_LINE[preset] || MODE_LINE.home;
      return { n: live.length, kind: top, line: KIND[top].zh, mode: m ? m.zh : '', modeLine: ml.zh, lineEn: KIND[top].en, modeLineEn: ml.en, en };
    }
  };
  if (Q.get('exhibitor') === '1') {
    document.documentElement.classList.add('ae-intro-seen');
    const intro = $('#aeIntro'); if (intro) intro.remove();
    return;
  }
  hideOldChrome();

  let ve = null;
  function rowFloorTop(row) {
    /* lowest allowed top = the 11/17 fixed slot above the transport controls */
    const sb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sab')) || 0;
    return innerHeight - Math.max(14, sb) - 108 - row.offsetHeight;
  }
  function boot() {
    const P = window.__premium || {};
    ve = window.AEVisitorEntry.create({
      title: '盛明・會發光的畫',
      titleEn: 'Eternal Sun · a painting that glows',
      noCover: true,
      toast: '盛明：一幅會出聲、會發光的畫，點一下就能放鬆',
      toastEn: 'Eternal Sun: a painting that sings and glows. Tap once to relax',
      toastMs: 4200,
      artSrc: '/assets/eternal-sun-canonical-1110x1536.jpg',
      isEn,
      modes: MODES,
      help: HELP,
      hintY: 0.845,
      current: () => (P.S && P.S.preset) || 'home',
      setMode: id => { if (typeof P.applyPreset === 'function') P.applyPreset(id); },
      start: () => {
        /* same path as a real tap on the painting: starts the music in this gesture and shows a burst */
        const p = P.L && P.L.p;
        if (p && p.w && typeof P.artTap === 'function') P.artTap(p.x + p.w * 0.515, p.y + p.h * 0.5);
        else if (P.audio && P.audio.paused) { const r = P.audio.play(); if (r && r.catch) r.catch(() => {}); }
      },
      cueHost: () => document.getElementById('stage') || document.body,
      artRect: () => { const p = P.L && P.L.p; return p && p.w ? { x: p.x, y: p.y, w: p.w, h: p.h } : null; },
      mountRow: row => document.body.appendChild(row),
      placeRow: row => {
        const p = P.L && P.L.p;
        if (!p || !p.w) return;
        const st = document.getElementById('stage');
        const top0 = st ? st.getBoundingClientRect().top : 0;
        const want = top0 + p.y + p.h + 8;
        const top = Math.round(Math.min(want, rowFloorTop(row)));
        if (row.style.top !== top + 'px') { row.style.top = top + 'px'; row.style.bottom = 'auto'; }
        /* Owner 11/19 14:55: 經典首頁 "Hand-painted art" sat too high — anchor it (and ✦) just above the painting's bottom edge / the mode row */
        const copy = document.querySelector('#hp89 .hp89-copy'), dock = document.querySelector('#hp89 .ae-fx-dock');
        if (copy && document.body.classList.contains('home-mode')) {
          /* landscape phone: the painting is small, so size the copy to the painting instead of the screen */
          const land = innerWidth > innerHeight && innerHeight <= 520, h1 = copy.querySelector('h1'), kk = copy.querySelector('.kicker');
          const want = land ? [Math.round((st ? st.getBoundingClientRect().left : 0) + p.x + 12) + 'px', Math.round(p.w - 24) + 'px', Math.round(p.w * 0.105) + 'px', Math.max(9, Math.round(p.w * 0.042)) + 'px'] : ['', '', '', ''];
          if (copy.style.width !== want[1] || copy.style.left !== want[0]) { copy.style.left = want[0]; copy.style.width = want[1]; if (h1) h1.style.fontSize = want[2]; if (kk) kk.style.display = land ? 'none' : ''; }
          if (dock && land) { const sl = st ? st.getBoundingClientRect().left : 0, l = Math.round(sl + p.x + p.w + 10) + 'px', t2 = Math.round(top0 + p.y + p.h - 52) + 'px'; if (dock.style.left !== l || dock.style.top !== t2) { dock.style.left = l; dock.style.top = t2; dock.style.right = 'auto'; dock.style.bottom = 'auto'; } }
          else if (dock && dock.style.left) { dock.style.left = ''; dock.style.top = ''; dock.style.right = ''; dock.style.bottom = ''; }
          const edge = Math.min(top0 + p.y + p.h, top) - (land ? 8 : 6), cr = copy.getBoundingClientRect();
          if (cr.height && Math.abs(cr.bottom - edge) > 1) {
            const b = Math.max(12, Math.round(parseFloat(getComputedStyle(copy).bottom) + (cr.bottom - edge))) + 'px';
            copy.style.bottom = b; if (dock && innerWidth <= 520 && !land) { dock.style.bottom = b; dock.style.top = 'auto'; }
          }
        }
      }
    });
    document.addEventListener('ae-premium-tap', e => {
      const st = document.getElementById('stage'), r = st ? st.getBoundingClientRect() : { left: 0, top: 0 };
      if (e.detail && performance.now() - ve.state.coverTapAt > 350) ve.tapAt(r.left + e.detail.x, r.top + e.detail.y);
      /* the real tap already went through premium's own artTap (music + burst); only clear the hint here */
      ve.firstTap(true);
    });
    const lang = $('#lang');
    if (lang) lang.addEventListener('click', () => setTimeout(() => ve.relang(), 0));
    const _ap = P.applyPreset;
    if (typeof _ap === 'function') P.applyPreset = function (k) { const r = _ap.apply(this, arguments); ve.syncModes(); showLine(modeLine((P.S && P.S.preset) || k), 2600); return r; };
    setupR3(P);
    document.body.setAttribute('data-ae-preset', (P.S && P.S.preset) || 'calm');
  }
  /* ---- R3: one line under the mode row (first-visit how-to, then each mode's answer) ---- */
  let lineT = 0;
  function lineEl() { return document.getElementById('esFirst'); }
  function placeLine() {
    const el = lineEl(), row = document.getElementById('aeModes'); if (!el || !row) return;
    const r = row.getBoundingClientRect(); if (!r.height) return;
    const t = Math.round(r.bottom + 6) + 'px'; if (el.style.top !== t) el.style.top = t;
  }
  function showLine(text, ms) {
    const el = lineEl(); if (!el || !text) return;
    el.textContent = text; el.hidden = false; placeLine();
    requestAnimationFrame(() => el.classList.add('on'));
    clearTimeout(lineT); if (ms) lineT = setTimeout(() => el.classList.remove('on'), ms);
  }
  function modeLine(id) {
    const m = MODES.find(x => x.id === id), l = MODE_LINE[id]; if (!m || !l) return '';
    return isEn() ? m.en + ' · ' + l.en : m.zh + '｜' + l.zh;
  }
  function setupR3(P) {
    const html = document.documentElement, btn = document.getElementById('esCardBtn'), msg = document.getElementById('glowmsg');
    (function loop() { placeLine(); requestAnimationFrame(loop); })();
    let seen = false; try { seen = localStorage.getItem('ae-es-r3-seen') === '1'; } catch (e) {}
    if (!seen && Q.get('first') !== '0') {
      const firstText = isEn() ? 'Tap the art to play · pick a mood below · ✦ make your light card' : '點畫面開始・下排換心情・✦ 畫光做成卡';
      setTimeout(() => showLine(firstText, 0), 900);
      try { localStorage.setItem('ae-es-r3-seen', '1'); } catch (e) {}
      let done = false;
      const end = () => { if (done) return; done = true; setTimeout(() => { const el = lineEl(); if (el && el.textContent === firstText) el.classList.remove('on'); }, 2200); };
      document.addEventListener('ae-premium-tap', end, { once: true });
      setTimeout(end, 12000);
    }
    document.addEventListener('ae-premium-tap', () => { if (btn && !btn.dataset.pulsed) { btn.dataset.pulsed = '1'; btn.classList.add('pulse'); } }, { once: true });
    const say = (t, flash) => { if (!msg) return; msg.textContent = t; if (flash) { msg.classList.add('flash'); setTimeout(() => msg.classList.remove('flash'), 600); } };
    let seenStrokes = 0;
    if (btn) {
      ['pointerdown', 'pointerup', 'touchstart'].forEach(ev => btn.addEventListener(ev, e => e.stopPropagation()));
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (typeof P.setGlow === 'function') P.setGlow(true);
        if (typeof P.hideUI === 'function') P.hideUI(true);
        seenStrokes = 0; say(isEn() ? 'Draw a line of light on the art' : '用手指在畫上畫一道光');
      });
    }
    document.addEventListener('pointerup', () => {
      setTimeout(() => {
        const G = P.GLOW; if (!G || !G.on) return;
        const live = G.strokes.filter(st => st.pts && st.pts.length > 1);
        if (live.length > seenStrokes) {
          const k = window.__esCard.kind(live[live.length - 1]);
          say((isEn() ? 'Light ' + live.length + ': ' : '第 ' + live.length + ' 道光：') + (isEn() ? KIND[k].en : KIND[k].zh), true);
          try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
        }
        seenStrokes = live.length;
      }, 0);
    }, true);
    const clr = document.getElementById('glowclear');
    if (clr) clr.addEventListener('click', () => { seenStrokes = 0; say(isEn() ? 'Cleared. Draw again' : '已清除，再畫一道光'); });
    document.addEventListener('es-card-empty', () => say(isEn() ? 'Draw one line of light first' : '先畫一道光，再做成卡', true));
    document.addEventListener('es-card-made', () => { seenStrokes = (P.GLOW && P.GLOW.strokes.length) || 0; });
    void html;
  }
  waitPremium(boot);
})();
