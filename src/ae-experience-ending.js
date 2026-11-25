/* AE experience unified result ending.
 * Free basic wallpaper is NEVER gated on share/follow/invite.
 * Bonus reward unlocks on trust-based "I shared / I followed" only.
 */
(() => {
  'use strict';
  const IG_URL = 'https://www.instagram.com/aeuniversecreation/';
  const KOFI = {
    eternalSun: { url: 'https://ko-fi.com/s/e3991964e5', nameZh: '盛明 Eternal Sun', nameEn: 'Eternal Sun', price: 'US$14' },
    heartUniverse: { url: 'https://ko-fi.com/s/9b9703d58b', nameZh: 'AE心宇宙', nameEn: 'AE Heart Universe', price: 'US$16' },
    colorUniverse: { url: 'https://ko-fi.com/s/f68079f3cc', nameZh: 'AE色彩宇宙', nameEn: 'AE Color Universe', price: 'US$12' }
  };

  /* Sensible artwork → product mapping (Owner-approved product set only). */
  const ART_MAP = {
    'eternal-sun': 'eternalSun',
    'sheng-ming': 'eternalSun',
    '盛明': 'eternalSun',
    'ae-sun': 'eternalSun',
    'love-embrace': 'heartUniverse',
    'flower-heart-bloom': 'heartUniverse',
    'heart-fly': 'heartUniverse',
    'heart-energy': 'heartUniverse',
    'heart-rebuild': 'heartUniverse',
    'heart-recovery': 'heartUniverse',
    'love-energy-field': 'colorUniverse',
    'colorful-flow': 'colorUniverse',
    'fun-universe': 'colorUniverse',
    'marvellous-energy-world': 'colorUniverse',
    'expansion': 'colorUniverse',
    'natures-strength': 'colorUniverse',
    'infinite-love-strength': 'heartUniverse',
    // Touch Moment board slots 1–9 → colour / heart packs by visual family
    'ae-exp-01': 'colorUniverse',
    'ae-exp-02': 'heartUniverse',
    'ae-exp-03': 'colorUniverse',
    'ae-exp-04': 'colorUniverse',
    'ae-exp-05': 'heartUniverse',
    'ae-exp-06': 'colorUniverse',
    'ae-exp-07': 'heartUniverse',
    'ae-exp-08': 'colorUniverse',
    'ae-exp-09': 'heartUniverse'
  };

  const BONUS_LINES = [
    { zh: '你掌心那一道細光，今晚替你守門。', en: 'The thin light in your palm keeps watch for you tonight.' },
    { zh: '把這一點暖，悄悄放進明天的口袋。', en: 'Slip this little warmth into tomorrow’s pocket.' },
    { zh: '光沒有趕路；它只是與你同行。', en: 'Light is not rushing — it is walking with you.' },
    { zh: '你被看見的那一角，正慢慢發亮。', en: 'The corner of you that was seen is quietly brightening.' },
    { zh: '收好這枚光紋；它認得回家的路。', en: 'Keep this lightprint — it knows the way home.' }
  ];

  /* Bonus pool: exclusive phone wallpapers MORE attractive than the free card wallpaper.
   * texture_* = high-res detail crops of existing AE art (original pixels only).
   * lightprint_* = portrait fit of existing AE art + overlay-only gold frame/glow (painting unaltered).
   * See /assets/experience-bonus/MANIFEST.json for source + crop boxes. Avoids 盛明 overuse. */
  const BONUS_WALLPAPERS = [
    { url: '/assets/experience-bonus/bonus-lightprint-exp08.webp', tier: 'lightprint', labelZh: '光紋限定桌布', labelEn: 'Lightprint exclusive wallpaper' },
    { url: '/assets/experience-bonus/bonus-lightprint-flower-heart.webp', tier: 'lightprint', labelZh: '光紋限定桌布', labelEn: 'Lightprint exclusive wallpaper' },
    { url: '/assets/experience-bonus/bonus-lightprint-color-flow.webp', tier: 'lightprint', labelZh: '光紋限定桌布', labelEn: 'Lightprint exclusive wallpaper' },
    { url: '/assets/experience-bonus/bonus-texture-exp04-center.webp', tier: 'texture', labelZh: '高解析紋理特寫桌布', labelEn: 'Hi-res texture close-up wallpaper' },
    { url: '/assets/experience-bonus/bonus-texture-exp06-lower.webp', tier: 'texture', labelZh: '高解析紋理特寫桌布', labelEn: 'Hi-res texture close-up wallpaper' },
    { url: '/assets/experience-bonus/bonus-texture-exp02-heart.webp', tier: 'texture', labelZh: '高解析紋理特寫桌布', labelEn: 'Hi-res texture close-up wallpaper' },
    { url: '/assets/experience-bonus/bonus-texture-natures-core.webp', tier: 'texture', labelZh: '高解析紋理特寫桌布', labelEn: 'Hi-res texture close-up wallpaper' }
  ];

  function lang() {
    const L = (document.documentElement.lang || '').toLowerCase();
    if (L.startsWith('zh')) return 'zh';
    try { return localStorage.getItem('ae-language') === 'zh' ? 'zh' : 'en'; } catch (e) { return 'en'; }
  }
  function t(en, zh) { return lang() === 'zh' ? zh : en; }

  function isFromIG() {
    try {
      const q = new URLSearchParams(location.search);
      const src = ((q.get('utm_source') || '') + ' ' + (q.get('from') || '')).toLowerCase();
      if (/\b(ig|instagram)\b/.test(src)) return true;
      const ref = (document.referrer || '').toLowerCase();
      if (ref.includes('instagram.com') || ref.includes('l.instagram.com')) return true;
    } catch (e) {}
    return false;
  }

  function resolveKofi(keyOrArt) {
    if (!keyOrArt) return KOFI.colorUniverse;
    if (KOFI[keyOrArt]) return KOFI[keyOrArt];
    const raw = String(keyOrArt).toLowerCase();
    const base = raw.split('/').pop().replace(/\.(webp|png|jpe?g|gif)$/i, '');
    const mapped = ART_MAP[base] || ART_MAP[raw] || null;
    if (mapped && KOFI[mapped]) return KOFI[mapped];
    // numeric touch-moment index 0–8
    const n = Number(keyOrArt);
    if (Number.isFinite(n) && n >= 0 && n < 9) {
      const k = ART_MAP['ae-exp-' + String(n + 1).padStart(2, '0')];
      return KOFI[k] || KOFI.colorUniverse;
    }
    return KOFI.colorUniverse;
  }

  function withUtm(url, campaign) {
    try {
      const u = new URL(url, location.origin);
      if (!u.searchParams.get('utm_source')) u.searchParams.set('utm_source', 'ae_experience');
      if (!u.searchParams.get('utm_medium')) u.searchParams.set('utm_medium', 'share');
      if (campaign && !u.searchParams.get('utm_campaign')) u.searchParams.set('utm_campaign', campaign);
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  async function shareCard(opts) {
    const title = opts.title || 'AE Universe Creation';
    const text = opts.text || t('A light moment from AE.', 'AE 給你的一道光。');
    const url = withUtm(opts.url || location.href, opts.campaign || 'share_card');
    const status = opts.statusEl;
    if (navigator.share) {
      try {
        const data = { title, text, url };
        if (opts.file && navigator.canShare && navigator.canShare({ files: [opts.file] })) {
          data.files = [opts.file];
        }
        await navigator.share(data);
        if (status) status.textContent = t('Shared — thank you.', '已分享——謝謝你。');
        return 'shared';
      } catch (err) {
        if (err && err.name === 'AbortError') {
          if (status) status.textContent = t('Share closed.', '分享已關閉。');
          return 'abort';
        }
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      if (status) status.textContent = t('Link copied. Paste it anywhere you like.', '連結已複製，可貼到任何地方。');
      return 'copied';
    } catch (e) {
      if (status) status.textContent = url;
      return 'fallback';
    }
  }

  async function downloadUrl(url, filename, statusEl) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      const blob = await res.blob();
      const a = document.createElement('a');
      const obj = URL.createObjectURL(blob);
      a.href = obj;
      a.download = filename || 'AE-wallpaper.webp';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(obj), 2000);
      if (statusEl) statusEl.textContent = t('Download started.', '已開始下載。');
      return true;
    } catch (e) {
      // Fallback: open in new tab so long-press save still works
      window.open(url, '_blank', 'noopener');
      if (statusEl) statusEl.textContent = t('Opened the image — long-press to save.', '已開啟圖片——長按即可儲存。');
      return false;
    }
  }

  function pickBonus(excludeUrl) {
    const pool = BONUS_WALLPAPERS.filter(item => {
      const u = item.url || item;
      if (!excludeUrl) return true;
      const leaf = String(u).split('/').pop();
      return leaf && !String(excludeUrl).includes(leaf);
    });
    const list = pool.length ? pool : BONUS_WALLPAPERS;
    // Prefer lightprint tier ~60% of the time so bonus feels clearly "exclusive"
    const prefer = list.filter(i => (i.tier || '') === 'lightprint');
    const bag = (prefer.length && Math.random() < 0.6) ? prefer : list;
    const item = bag[Math.floor(Math.random() * bag.length)];
    const line = BONUS_LINES[Math.floor(Math.random() * BONUS_LINES.length)];
    return {
      art: item.url || item,
      tier: item.tier || 'texture',
      labelZh: item.labelZh || '加贈桌布',
      labelEn: item.labelEn || 'Bonus wallpaper',
      line
    };
  }

  /**
   * Mount unified ending into container.
   * opts: {
   *   onSaveWallpaper: async (ev) => {},  // REQUIRED free path — caller provides
   *   share: { title, text, url, campaign, file? },
   *   kofiKeyOrArt: string|number,
   *   moreNodes: HTMLElement[] | HTMLElement,  // existing buttons to fold into More
   *   resultArtUrl: string,  // to avoid reusing same bonus art
   *   experienceId: string
   * }
   */
  function mount(container, opts) {
    if (!container || container.dataset.aeEndMounted === '1') return null;
    container.dataset.aeEndMounted = '1';
    const o = opts || {};
    const kofi = resolveKofi(o.kofiKeyOrArt);
    const fromIg = isFromIG();

    const root = document.createElement('div');
    root.className = 'ae-end';
    root.setAttribute('data-ae-end', o.experienceId || 'experience');

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'ae-end-primary';
    saveBtn.textContent = t('Save wallpaper (free)', '儲存桌布（免費）');
    saveBtn.title = t(
      'Your free full-phone wallpaper from this moment — never gated on sharing.',
      '這一刻的免費完整手機桌布——從不需要分享才能下載。'
    );
    saveBtn.addEventListener('click', async (ev) => {
      status.textContent = t('Preparing…', '準備中…');
      try {
        if (typeof o.onSaveWallpaper === 'function') await o.onSaveWallpaper(ev);
        else status.textContent = t('Save is not ready yet.', '儲存尚未就緒。');
      } catch (err) {
        status.textContent = t('Could not save — please try again.', '無法儲存，請再試一次。');
      }
    });

    const row = document.createElement('div');
    row.className = 'ae-end-row';

    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'ae-end-btn';
    shareBtn.textContent = t('Share this card', '分享這張卡');
    shareBtn.addEventListener('click', () => shareCard(Object.assign({ statusEl: status }, o.share || {})));

    const kofiA = document.createElement('a');
    kofiA.className = 'ae-end-btn ae-end-kofi';
    kofiA.href = kofi.url;
    kofiA.target = '_blank';
    kofiA.rel = 'noopener';
    kofiA.textContent = t('Love this painting?', '喜歡這幅畫？');
    kofiA.title = `${lang() === 'zh' ? kofi.nameZh : kofi.nameEn} · ${kofi.price}`;

    row.appendChild(shareBtn);
    row.appendChild(kofiA);

    const moreWrap = document.createElement('div');
    moreWrap.className = 'ae-end-more-wrap';
    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'ae-end-btn';
    moreBtn.setAttribute('aria-expanded', 'false');
    moreBtn.textContent = t('More', '更多');
    const morePanel = document.createElement('div');
    morePanel.className = 'ae-end-more-panel';
    morePanel.hidden = false;
    // fold in more nodes
    const extras = [].concat(o.moreNodes || []).filter(Boolean);
    extras.forEach((node) => {
      if (!node) return;
      if (node.parentNode) node.parentNode.removeChild(node);
      if (node.classList) node.classList.add('ae-end-btn');
      morePanel.appendChild(node);
    });
    // Always offer a quiet Ko-fi product link inside More as well (named)
    const kofiNamed = document.createElement('a');
    kofiNamed.className = 'ae-end-btn';
    kofiNamed.href = kofi.url;
    kofiNamed.target = '_blank';
    kofiNamed.rel = 'noopener';
    kofiNamed.textContent = t(
      `${kofi.nameEn} on Ko-fi · ${kofi.price}`,
      `Ko-fi｜${kofi.nameZh} · ${kofi.price}`
    );
    morePanel.appendChild(kofiNamed);

    moreBtn.addEventListener('click', () => {
      const open = !moreWrap.classList.contains('open');
      moreWrap.classList.toggle('open', open);
      moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    moreWrap.appendChild(moreBtn);
    moreWrap.appendChild(morePanel);

    // Bonus invite
    const bonus = document.createElement('div');
    bonus.className = 'ae-end-bonus';
    const h = document.createElement('h4');
    const p = document.createElement('p');
    const actions = document.createElement('div');
    actions.className = 'ae-end-bonus-actions';
    const igLink = document.createElement('a');
    igLink.className = 'ae-end-btn';
    igLink.href = IG_URL;
    igLink.target = '_blank';
    igLink.rel = 'noopener';
    const trustBtn = document.createElement('button');
    trustBtn.type = 'button';
    trustBtn.className = 'ae-end-btn';
    if (fromIg) {
      h.textContent = t('Share this light with a friend?', '把這道光傳給一位朋友？');
      p.textContent = t(
        'If you share this card with a friend, an exclusive gift opens: a hi-res texture or Lightprint-framed wallpaper (more special than the free one) plus a personal light-pattern line. Trust-based — we do not check.',
        '若你把這張卡分享給朋友，會開啟限定加贈：高解析紋理或光紋框桌布（比免費桌布更特別），外加一句專屬光紋語。信任制，不做驗證。'
      );
      igLink.textContent = t('Open share…', '去分享…');
      igLink.addEventListener('click', (ev) => {
        ev.preventDefault();
        shareCard(Object.assign({ statusEl: status, campaign: 'bonus_share_friend' }, o.share || {}));
      });
      trustBtn.textContent = t('I shared it', '我已分享');
    } else {
      h.textContent = t('Like AE on Instagram?', '在 IG 追蹤 AE？');
      p.textContent = t(
        'Follow or like AE Universe Creation on Instagram, then tap below — unlock an exclusive hi-res / Lightprint wallpaper (beyond the free one) and a personal light-pattern line. Trust-based; nothing is verified.',
        '在 Instagram 追蹤或按讚 AE Universe Creation，再點下方——解鎖比免費桌布更特別的高解析／光紋限定桌布，與一句專屬光紋語。信任制，不做驗證。'
      );
      igLink.textContent = t('Open Instagram', '開啟 Instagram');
      trustBtn.textContent = t('I followed / liked', '我已追蹤／按讚');
    }
    const reward = document.createElement('div');
    reward.className = 'ae-end-bonus-reward';
    reward.hidden = true;
    const unlock = () => {
      if (!reward.hidden) return;
      const b = pickBonus(o.resultArtUrl);
      reward.hidden = false;
      reward.innerHTML = '';
      const label = document.createElement('p');
      label.style.margin = '0';
      label.style.fontSize = '13px';
      label.textContent = t(
        'Unlocked — an exclusive gift beyond the free wallpaper:',
        '已開啟——比免費桌布更特別的限定加贈：'
      );
      const tier = document.createElement('p');
      tier.style.margin = '6px 0 8px';
      tier.style.fontSize = '14px';
      tier.style.fontWeight = '600';
      tier.style.color = '#c9a24a';
      tier.textContent = lang() === 'zh' ? b.labelZh : b.labelEn;
      const preview = document.createElement('img');
      preview.src = b.art;
      preview.alt = tier.textContent;
      preview.loading = 'lazy';
      preview.decoding = 'async';
      preview.style.cssText = 'display:block;width:min(200px,46vw);aspect-ratio:9/16;object-fit:cover;border-radius:12px;margin:0 0 10px;box-shadow:0 10px 28px rgba(0,0,0,.28)';
      const line = document.createElement('p');
      line.className = 'ae-end-line';
      line.textContent = lang() === 'zh' ? b.line.zh : b.line.en;
      const saveBonus = document.createElement('button');
      saveBonus.type = 'button';
      saveBonus.className = 'ae-end-primary';
      saveBonus.textContent = t('Save exclusive wallpaper', '儲存限定桌布');
      saveBonus.addEventListener('click', () => downloadUrl(b.art, 'AE-Exclusive-Bonus-Wallpaper.webp', status));
      reward.appendChild(label);
      reward.appendChild(tier);
      reward.appendChild(preview);
      reward.appendChild(line);
      reward.appendChild(saveBonus);
      try { sessionStorage.setItem('ae_end_bonus_' + (o.experienceId || 'x'), '1'); } catch (e) {}
      status.textContent = t('Bonus unlocked — thank you.', '加贈已開啟——謝謝你。');
    };
    trustBtn.addEventListener('click', unlock);
    actions.appendChild(igLink);
    actions.appendChild(trustBtn);
    bonus.appendChild(h);
    bonus.appendChild(p);
    bonus.appendChild(actions);
    bonus.appendChild(reward);

    const status = document.createElement('p');
    status.className = 'ae-end-status';
    status.setAttribute('aria-live', 'polite');

    root.appendChild(saveBtn);
    root.appendChild(row);
    root.appendChild(moreWrap);
    root.appendChild(bonus);
    root.appendChild(status);
    container.appendChild(root);

    // Re-label on language toggle
    const syncLang = () => {
      saveBtn.textContent = t('Save wallpaper (free)', '儲存桌布（免費）');
      saveBtn.title = t(
        'Your free full-phone wallpaper from this moment — never gated on sharing.',
        '這一刻的免費完整手機桌布——從不需要分享才能下載。'
      );
      shareBtn.textContent = t('Share this card', '分享這張卡');
      kofiA.textContent = t('Love this painting?', '喜歡這幅畫？');
      kofiA.title = `${lang() === 'zh' ? kofi.nameZh : kofi.nameEn} · ${kofi.price}`;
      moreBtn.textContent = t('More', '更多');
      kofiNamed.textContent = t(
        `${kofi.nameEn} on Ko-fi · ${kofi.price}`,
        `Ko-fi｜${kofi.nameZh} · ${kofi.price}`
      );
      if (fromIg) {
        h.textContent = t('Share this light with a friend?', '把這道光傳給一位朋友？');
        trustBtn.textContent = t('I shared it', '我已分享');
      } else {
        h.textContent = t('Like AE on Instagram?', '在 IG 追蹤 AE？');
        trustBtn.textContent = t('I followed / liked', '我已追蹤／按讚');
        igLink.textContent = t('Open Instagram', '開啟 Instagram');
      }
    };
    new MutationObserver(syncLang).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

    return { root, status, kofi, fromIg, refresh: syncLang };
  }

  window.AEExperienceEnding = {
    mount,
    shareCard,
    resolveKofi,
    isFromIG,
    withUtm,
    KOFI,
    ART_MAP,
    BONUS_WALLPAPERS,
    downloadUrl
  };
})();
