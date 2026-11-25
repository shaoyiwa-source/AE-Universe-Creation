/* Shop category registry.
 * Adding a category = adding one entry to AE_SHOP_CATEGORIES.
 * Entries that are empty, coming soon, or enabled:false are not shown.
 */
(function (global) {
  'use strict';

  var AE_SHOP_CATEGORIES = [
    {
      id: 'wallpapers',
      href: '/shop/wallpapers',
      panel: 'shop-wallpapers',
      enabled: true,
      name_zh: '桌布',
      name_en: 'Wallpapers',
      how_zh: '手機桌布組合與數位版本，官網以新台幣半價、綠界結帳。',
      how_en: 'Phone wallpaper packs and digital editions at half-price in TWD. Official-site checkout is via ECPay (綠界).',
      image: '/assets/kofi/verdant-garden-cover.jpg',
      image_pos: '50% 42%',
      alt: 'Wallpapers, preview from VERDANT GARDEN',
      go_zh: '選購 →',
      go_en: 'Browse →',
      hasProducts: true
    }
  ];

  function visibleCategories() {
    return AE_SHOP_CATEGORIES.filter(function (cat) {
      if (!cat || !cat.id) return false;
      if (cat.enabled === false) return false;
      if (cat.comingSoon) return false;
      if (cat.hasProducts === false) return false;
      if (Array.isArray(cat.products) && cat.products.length === 0) return false;
      return true;
    });
  }

  function currentLang() {
    return document.documentElement.lang === 'zh-Hant' ? 'zh' : 'en';
  }

  function applyLang(root) {
    var lang = currentLang();
    (root || document).querySelectorAll('[data-en][data-zh]').forEach(function (el) {
      var value = el.getAttribute(lang === 'zh' ? 'data-zh' : 'data-en');
      if (value != null) el.textContent = value;
    });
  }

  function categoryIds() {
    var map = {};
    visibleCategories().forEach(function (cat) {
      map[cat.id] = cat;
    });
    return map;
  }

  function resolveView() {
    var path = (location.pathname || '').replace(/\/+$/, '') || '/shop';
    var hash = (location.hash || '').replace(/^#/, '');
    var queryCat = '';
    try { queryCat = new URLSearchParams(location.search).get('category') || ''; } catch (e) {}
    var m = /\/shop\/([^/]+)$/.exec(path);
    var id = (m && m[1]) || hash || queryCat || '';
    if (id === 'shop.html' || id === 'shop') id = '';
    var known = categoryIds();
    var view = known[id] ? id : 'overview';
    document.documentElement.dataset.shopView = view;
    document.documentElement.dataset.shopCategory = known[id] ? id : '';
    return view;
  }

  function padNum(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function render() {
    resolveView();
    var grid = document.getElementById('shop-category-grid');
    if (!grid) return;
    var cats = visibleCategories();
    var html = cats.map(function (cat, index) {
      var pos = esc(cat.image_pos || '50% 50%');
      var href = esc(cat.href || ('/shop/' + cat.id));
      return (
        '<a class="xp-card" id="shop-cat-' + esc(cat.id) + '" href="' + href + '">' +
          '<span class="xp-media">' +
            '<img class="xp-shot" style="--pos:' + pos + '" src="' + esc(cat.image) + '" alt="' + esc(cat.alt || '') + '" loading="eager" decoding="async">' +
          '</span>' +
          '<span class="xp-body">' +
            '<span class="xp-num">' + padNum(index + 1) + '</span>' +
            '<span class="xp-name" role="heading" aria-level="2" data-en="' + esc(cat.name_en) + '" data-zh="' + esc(cat.name_zh) + '">' + esc(cat.name_en) + '</span>' +
            '<span class="xp-how" data-en="' + esc(cat.how_en) + '" data-zh="' + esc(cat.how_zh) + '">' + esc(cat.how_en) + '</span>' +
            '<span class="xp-go" data-en="' + esc(cat.go_en || 'Browse →') + '" data-zh="' + esc(cat.go_zh || '選購 →') + '">' + esc(cat.go_en || 'Browse →') + '</span>' +
          '</span>' +
        '</a>'
      );
    }).join('');
    grid.innerHTML = html;
    applyLang(grid);
  }

  var AEShop = {
    categories: AE_SHOP_CATEGORIES,
    visibleCategories: visibleCategories,
    resolveView: resolveView,
    render: render,
    applyLang: applyLang
  };

  global.AE_SHOP_CATEGORIES = AE_SHOP_CATEGORIES;
  global.AEShop = AEShop;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})(window);
