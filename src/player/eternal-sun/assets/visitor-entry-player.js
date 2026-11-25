/* Light Player visitor entry — adapter for the shared /assets/ae-visitor-entry.js (same cover, dots,
   hint, mode row and 「說明」 as /premium/eternal-sun/). 2026-11-19. Does not modify the player package
   (experience*.js); it only drives its existing mode <select> and sound() API. */
(function () {
  var root = document.getElementById('eternal-experience');
  var inst = window.eternalExperience;
  if (!root || !inst || !window.AEVisitorEntry) return;
  var en = function () { return (root.getAttribute('lang') || document.documentElement.lang || '').indexOf('en') === 0; };
  var pick = root.querySelector('[data-ae="mode"]');
  var art = root.querySelector('.ae-art');
  var img = root.querySelector('[data-ae="art"]');
  var stage = root.querySelector('.ae-stage');
  root.classList.add('ae-ve-player');
  var MODES = [
    { id: 'home', zh: '聲光秀', en: 'Show' },
    { id: 'rgb', zh: '三色照畫', en: 'RGB' },
    { id: 'backlight', zh: '魔法背光', en: 'Backlight' },
    { id: 'off', zh: '原畫', en: 'Art' }
  ];
  var HELP = {
    zh: [
      '這是可以互動的聲光畫作：碰畫面會發光，並播放音樂。',
      '下面這排可以切換光效模式。',
      '按住畫面再放開，光會跟著節拍綻放；左右滑可以移動聚光。',
      '右上角 ♫ 開關聲音；聲光秀模式可按 ✦ 加特效。',
      '三色照畫是數位燈光模擬，不是實體螢光。',
      '請打開聲音或戴上耳機。'
    ],
    en: [
      'An interactive light-and-sound painting: touching it makes light and plays music.',
      'Use the row below to switch light modes.',
      'Hold and release to bloom on the beat; slide sideways to move the spotlight.',
      '♫ (top right) turns sound on or off; in Show mode ✦ adds effects.',
      'RGB light is a digital lighting simulation, not physical fluorescence.',
      'Turn the sound on or use headphones.'
    ]
  };
  var ve = window.AEVisitorEntry.create({
    title: '盛明聲光展演系統',
    noCover: true,
    toast: '盛明聲光展演系統：可以互動的聲光畫作',
    toastEn: 'Eternal Sun Light & Sound Exhibition System: An interactive light-and-sound painting',
    artSrc: '/assets/eternal-sun-canonical-1110x1536.jpg',
    isEn: en,
    modes: MODES,
    help: HELP,
    hintY: 0.845,
    current: function () { return pick ? pick.value : 'home'; },
    setMode: function (id) {
      if (!pick || pick.value === id) return;
      pick.value = id;
      pick.dispatchEvent(new Event('change', { bubbles: true }));
    },
    start: function () { var r = inst.sound(true); if (r && r.catch) r.catch(function () {}); },
    cueHost: function () { return art; },
    artRect: function () {
      var w = art.clientWidth, h = art.clientHeight;
      if (!w || !h) return null;
      var nr = (img && img.naturalWidth) ? img.naturalWidth / img.naturalHeight : 1110 / 1536;
      var bw = w, bh = w / nr;
      if (bh > h) { bh = h; bw = h * nr; }
      return { x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh };
    },
    mountRow: function (row) { stage.parentNode.insertBefore(row, stage.nextSibling); }
  });
  art.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; ve.tapAt(e.clientX, e.clientY); ve.firstTap(true); }, { passive: true });
  /* start sound on click (iOS unlocks audio on touchend/click, not on pointerdown) */
  art.addEventListener('click', function (e) { if (e.target.closest('button')) return; ve.startOnce(); });
  /* 「原畫」 = lighting disabled. The player engine keeps mode==='rgb' in that case, so its own onState leaves the
     red/green/blue lamps showing. The engine sets data-illumination='off' whenever lighting is disabled; collapse the lamps then. */
  var lamps = root.querySelector('[data-ae="lamps"]');
  function collapseLamps() {
    if (!lamps || root.dataset.illumination !== 'off') return;
    if (lamps.getAttribute('aria-hidden') !== 'true') lamps.setAttribute('aria-hidden', 'true');
    if (lamps.style.visibility !== 'hidden') lamps.style.visibility = 'hidden';
    if (!lamps.inert) lamps.inert = true;
  }
  new MutationObserver(collapseLamps).observe(root, { attributes: true, attributeFilter: ['data-illumination', 'data-presentation'] });
  if (pick) pick.addEventListener('change', function () { ve.syncModes(); setTimeout(collapseLamps, 0); });
  collapseLamps();
  /* the player's lighting can change the select itself; keep the row in step */
  setInterval(function () { ve.syncModes(); collapseLamps(); }, 500);
})();
