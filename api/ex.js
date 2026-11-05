// /ex and /ex/<slug> — published AE 線上展覽 pages (server-rendered). Public index lists only published + public exhibitions.
'use strict';
const L = require('./_curate-lib.js');
const { esc } = L;

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&family=Noto+Serif+TC:wght@400;500;600&display=swap" rel="stylesheet">';
function shell(title, body, extraHead) {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title><link rel="icon" href="/favicon.svg">${FONTS}<link rel="stylesheet" href="/curate/ex-ae-light.css?v=1">${extraHead || ''}</head><body class="exl">${body}</body></html>`;
}
function imgSrc(im) { if (!im) return ''; return im.kind === 'blob' ? '/api/curate?a=img&id=' + encodeURIComponent(im.id) : im.url; }
function para(s) { return esc(s).split(/\n+/).map(x => `<p>${x}</p>`).join(''); }
function fmtDate(d) { if (!d) return ''; const [y, m, day] = d.split('-'); return `${y} 年 ${Number(m)} 月 ${Number(day)} 日`; }

function renderAeLight(e, isOwnerPreview) {
  const works = e.works.map((w, i) => `
<figure class="exl-work" data-i="${i}">
  ${w.image ? `<button type="button" class="exl-frame" data-lb="${i}" aria-label="放大觀看：${esc(w.title)}"><img src="${esc(imgSrc(w.image))}" alt="${esc(w.title)}" loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async" referrerpolicy="no-referrer" draggable="false"></button>` : '<div class="exl-frame exl-noimg" aria-hidden="true">✦</div>'}
  <figcaption><span class="exl-no">${String(i + 1).padStart(2, '0')}</span><h3>${esc(w.title)}</h3>${w.story ? `<div class="exl-story">${para(w.story)}</div>` : ''}</figcaption>
</figure>`).join('');
  const first = e.works.find(w => w.image);
  return `
${isOwnerPreview ? `<div class="exl-banner">${e.status === 'published' ? '' : '草稿預覽：只有你看得到。'}${e.visibility === 'private' ? '不公開展覽：只有拿到連結的人能看見。' : ''}<a href="/curate">回到策展室</a></div>` : ''}
<main>
<section class="exl-hero">
  <div class="exl-grid" aria-hidden="true"></div>
  <canvas id="exlLight" aria-hidden="true"></canvas>
  ${first ? `<div class="exl-hero-art" aria-hidden="true" style="background-image:url('${esc(imgSrc(first.image)).replace(/'/g, '%27')}')"></div>` : ''}
  <header class="exl-header"><a href="/" class="exl-brand" aria-label="AE Universe Creation 首頁"><img src="/assets/ae-three-rings-transparent.webp" alt="AE Universe Creation"></a>
  <button type="button" id="exlSound" class="exl-sound" aria-pressed="false" aria-label="聲音 開/關">♫ 聲光</button></header>
  <audio id="exlAudio" src="/media/aurelia-techno-eternal-148bpm.m4a" preload="none" loop></audio>
  <div class="exl-hero-inner">
    <p class="exl-kicker">AE 線上展覽 · ONLINE EXHIBITION</p>
    <h1>${esc(e.title)}</h1>
    <p class="exl-sub">策展人 ${esc(e.curatorName || e.owner)}${e.openingDate ? ` ｜ ${fmtDate(e.openingDate)} 開展` : ''}</p>
    <span class="exl-rainbow">和我們一起，在光影裡看見作品</span>
    <a class="exl-enter" href="#works"><span aria-hidden="true">✦</span><span>進入展覽<small>${e.works.length} 件作品</small></span><span aria-hidden="true">→</span></a>
  </div>
</section>
${e.description || e.curatorIntro ? `<section class="exl-intro"><div class="exl-intro-grid">
  <div><p class="exl-sk" data-no="01">ABOUT THE EXHIBITION</p><h2>展覽介紹</h2></div>
  <div class="exl-copy">${para(e.description)}${e.curatorIntro ? `<div class="exl-curator"><p class="exl-sk">CURATOR</p><h3>${esc(e.curatorName || e.owner)}</h3>${para(e.curatorIntro)}</div>` : ''}</div>
</div></section>` : ''}
<section class="exl-ivory" id="works"><div class="exl-container">
  <p class="exl-sk" data-no="02">WORKS</p><h2>展出作品</h2>
  <div class="exl-works">${works}</div>
</div></section>
<section class="exl-manifesto"><div class="exl-label">AE Universe Creation</div><blockquote>Make it a better world<br>Action Creates Infinity</blockquote>
<div class="exl-links">${e.visibility === 'public' ? '<a href="/ex">更多線上展覽</a>' : ''}<a href="/premium/eternal-sun/">AE 聲光體驗</a><a href="/">AE 首頁</a></div></section>
</main>
<footer class="exl-footer">AE UNIVERSE CREATION · 線上展覽 · 作品版權屬於原創作者</footer>
<div class="exl-lb" id="exlLb" hidden><button type="button" class="exl-lb-x" aria-label="關閉">×</button><button type="button" class="exl-lb-p" aria-label="上一件">‹</button><figure><img alt=""><figcaption></figcaption></figure><button type="button" class="exl-lb-n" aria-label="下一件">›</button></div>
<script src="/curate/ex-ae-light.js?v=1" defer></script>`;
}

function renderIndex(items) {
  const cards = items.map(e => {
    const f = e.works.find(w => w.image);
    return `<a class="exl-card" href="/ex/${esc(e.id)}">${f ? `<img src="${esc(imgSrc(f.image))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '<span class="exl-noimg">✦</span>'}<span class="exl-card-body"><small>${esc(e.curatorName || e.owner)}${e.openingDate ? ' · ' + esc(e.openingDate) : ''}</small><strong>${esc(e.title)}</strong><em>${e.works.length} 件作品 →</em></span></a>`;
  }).join('');
  return `<main><section class="exl-hero exl-hero-sm"><div class="exl-grid" aria-hidden="true"></div>
<header class="exl-header"><a href="/" class="exl-brand" aria-label="AE Universe Creation 首頁"><img src="/assets/ae-three-rings-transparent.webp" alt="AE Universe Creation"></a></header>
<div class="exl-hero-inner"><p class="exl-kicker">AE ONLINE EXHIBITIONS</p><h1>線上展覽</h1><p class="exl-sub">由受邀策展人策劃的展覽，慢慢看，好好感受。</p></div></section>
<section class="exl-ivory"><div class="exl-container">${cards ? `<div class="exl-cards">${cards}</div>` : '<p class="exl-empty">目前還沒有公開的展覽，敬請期待。</p>'}</div></section></main>
<footer class="exl-footer">AE UNIVERSE CREATION · 線上展覽</footer>`;
}

function html(res, status, s, cache) { res.statusCode = status; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', cache || 'no-store'); res.setHeader('X-Robots-Tag', 'noindex, nofollow'); res.setHeader('Referrer-Policy', 'no-referrer'); res.end(s); }

module.exports = async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const slug = String(url.searchParams.get('slug') || '').replace(/[^A-Za-z0-9_-]/g, '');
  try {
    if (!slug) {
      const items = (await L.listJSON('ex/')).filter(e => e.status === 'published' && e.visibility === 'public').sort((a, b) => b.updatedAt - a.updatedAt);
      return html(res, 200, shell('AE 線上展覽', renderIndex(items)), 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
    }
    const e = await L.getJSON('ex/' + slug + '.json');
    const me = e ? await L.currentUser(req).catch(() => null) : null;
    const owner = !!(me && e && me.username === e.owner);
    if (!e || (e.status !== 'published' && !owner)) return html(res, 404, shell('找不到展覽', '<main class="exl-404"><h1>找不到這個展覽</h1><p>連結可能已變更，或展覽尚未開放。</p><a href="/ex">看看其他展覽</a></main>'));
    return html(res, 200, shell(e.title + '｜AE 線上展覽', renderAeLight(e, owner)));
  } catch (err) {
    return html(res, 503, shell('暫時無法顯示', '<main class="exl-404"><h1>展覽暫時無法顯示</h1><p>請稍後再試。</p></main>'));
  }
};
