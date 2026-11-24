/* Visitor-facing entry for /premium/eternal-sun/ — adapter for the shared /assets/ae-visitor-entry.js.
   2026-11-19: cover with title only, tap starts the music; faint 「輕觸畫面」; gold dots; mode row under
   the art ending in 「說明」. The 11/17 ? button and first-visit intro are gone. Engine untouched. */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const Q = new URLSearchParams(location.search);
  const MODES = [
    { id: 'calm', zh: '原畫', en: 'Art' },
    { id: 'home', zh: '聲光', en: 'Show' },
    { id: 'club', zh: '夜店', en: 'Club' },
    { id: 'breath', zh: '柔光', en: 'Soft' },
    { id: 'gem', zh: '寶石', en: 'Gem' }
  ];
  const HELP = {
    zh: [
      '這是可以互動的聲光畫作：碰畫面會發光，並播放音樂。',
      '下面這排可以切換光效模式。',
      '跟著節拍點畫面，光會更亮。',
      '雙指可以放大；左右滑可以換畫。',
      '右下角 ⚙ 可以調整更多設定。',
      '請打開聲音或戴上耳機。'
    ],
    en: [
      'An interactive light-and-sound painting: touching it makes light and plays music.',
      'Use the row below to switch light modes.',
      'Tap on the beat for stronger light.',
      'Pinch to zoom; swipe left or right to change the painting.',
      'The ⚙ button (bottom right) has more settings.',
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
      title: '盛明聲光展演系統',
      noCover: true,
      toast: '盛明聲光展演系統：可以互動的聲光畫作',
      toastEn: 'Eternal Sun Light & Sound Exhibition System: An interactive light-and-sound painting',
      artSrc: '/assets/eternal-sun-canonical-1110x1536.jpg',
      isEn,
      modes: MODES,
      help: HELP,
      hintY: 0.845,
      current: () => (P.S && P.S.preset) || 'calm',
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
    if (typeof _ap === 'function') P.applyPreset = function (k) { const r = _ap.apply(this, arguments); ve.syncModes(); return r; };
    document.body.setAttribute('data-ae-preset', (P.S && P.S.preset) || 'calm');
  }
  waitPremium(boot);
})();
