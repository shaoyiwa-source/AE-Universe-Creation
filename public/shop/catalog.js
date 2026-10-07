(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AE_SHOP = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const contacts = [
    { email: 'ae.universe88@gmail.com' },
    { email: 'shaoyiwa@gmail.com' },
  ];

  // Public shop only. Eternal Sun singles stay off this list.
  const products = [
    {
      sku: 'GRID-HEART',
      code: '5',
      priceTwd: 555,
      nameZh: '花花世界心宇宙',
      nameEn: 'Flower Heart Universe',
      detailZh: '九宮格數位收藏。手繪的花與心，留給日常的螢幕。',
      detailEn: 'A nine-piece digital collection. Hand-painted flowers and hearts for everyday screens.',
      image: 'assets/d9416a6d494ad899.webp',
      eyebrow: '九宮格 · Nine-piece',
      kofi: 'https://ko-fi.com/s/9b9703d58b',
    },
    {
      sku: 'GRID-NIGHT',
      code: '6',
      priceTwd: 555,
      nameZh: '暗夜繽紛美宇宙',
      nameEn: 'Night Bloom Universe',
      detailZh: '九宮格數位收藏。暗夜裡的色彩，仍是同一片宇宙。',
      detailEn: 'A nine-piece digital collection. Colour held inside the night, still one universe.',
      image: 'assets/1e93d5cbab71795e.webp',
      eyebrow: '九宮格 · Nine-piece',
      kofi: '',
    },
    {
      sku: 'ES-4PACK',
      code: '7',
      priceTwd: 444,
      nameZh: 'Eternal Sun｜盛明四張組',
      nameEn: 'Eternal Sun · four-piece set',
      detailZh: '盛明數位四張組：原作完整版、畫廊展示版、手機桌布版、正方形版。',
      detailEn: 'Four digital editions of Eternal Sun: original, gallery, phone, and square.',
      image: 'assets/4e0991885a9649ea.webp',
      eyebrow: '盛明 · Eternal Sun',
      kofi: 'https://ko-fi.com/s/e3991964e5',
    },
  ];

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function formatTwd(amount) {
    const n = Number(amount);
    if (!Number.isInteger(n) || n < 0) throw new Error('Invalid TWD amount');
    return 'NT$' + n;
  }

  function productBySku(sku) {
    const clean = String(sku || '').toUpperCase();
    return products.find(function (product) { return product.sku === clean; }) || null;
  }

  function quoteLines(lines) {
    if (!Array.isArray(lines) || lines.length < 1 || lines.length > 12) {
      const err = new Error('EMPTY_CART');
      err.code = 'EMPTY_CART';
      throw err;
    }
    const seen = new Set();
    const normalized = [];
    let amount = 0;
    lines.forEach(function (line) {
      const sku = String(line && line.sku || '').toUpperCase();
      const product = productBySku(sku);
      if (!product) {
        const err = new Error('UNKNOWN_SKU');
        err.code = 'UNKNOWN_SKU';
        throw err;
      }
      if (seen.has(sku)) {
        const err = new Error('DUPLICATE_SKU');
        err.code = 'DUPLICATE_SKU';
        throw err;
      }
      seen.add(sku);
      const qty = Number(line.qty == null ? 1 : line.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > 9) {
        const err = new Error('INVALID_QTY');
        err.code = 'INVALID_QTY';
        throw err;
      }
      const lineAmount = product.priceTwd * qty;
      amount += lineAmount;
      normalized.push({
        sku: product.sku,
        qty: qty,
        unit: product.priceTwd,
        lineAmount: lineAmount,
        nameZh: product.nameZh,
        nameEn: product.nameEn,
      });
    });
    if (amount < 1 || amount > 200000) {
      const err = new Error('INVALID_TOTAL');
      err.code = 'INVALID_TOTAL';
      throw err;
    }
    return { currency: 'TWD', amount: amount, lines: normalized, label: formatTwd(amount) };
  }

  function contactHtml() {
    const items = contacts.map(function (contact) {
      const email = escapeHtml(contact.email);
      return '<li><a href="mailto:' + email + '">' + email + '</a></li>';
    }).join('');
    return '<section class="ae-contact" aria-label="聯絡方式 Contact"><p class="eyebrow">聯絡方式 · Contact</p><ul>' + items + '</ul></section>';
  }

  function backupLink(product) {
    if (!product.kofi) return '';
    return '<a class="text-link backup-link" href="' + escapeHtml(product.kofi) + '" target="_blank" rel="noopener">Ko-fi 備用結帳 · Ko-fi backup</a>';
  }

  function productCardHtml(product) {
    return '<article class="shop-card" id="sku-' + product.sku + '" data-sku="' + product.sku + '">' +
      '<img src="' + escapeHtml(product.image) + '" alt="' + escapeHtml(product.nameZh) + '">' +
      '<p class="eyebrow">' + escapeHtml(product.eyebrow) + '</p>' +
      '<h2><a href="product.html?sku=' + product.sku + '">' + escapeHtml(product.nameZh) + '</a></h2>' +
      '<p class="shop-en">' + escapeHtml(product.nameEn) + '</p>' +
      '<p>' + escapeHtml(product.detailZh) + '</p>' +
      '<p class="shop-en">' + escapeHtml(product.detailEn) + '</p>' +
      '<p class="price"><span class="ae-price">' + formatTwd(product.priceTwd) + '</span> <span class="ae-currency">新台幣</span></p>' +
      '<div class="shop-actions">' +
        '<button type="button" class="button" data-add-sku="' + product.sku + '">加入購物車 · Add to cart</button>' +
        '<a class="text-link" href="cart.html">購物車 · Cart</a>' +
        '<a class="text-link" href="checkout.html">結帳 · Checkout</a>' +
        backupLink(product) +
      '</div>' +
      '<p class="ae-toast" data-toast hidden></p>' +
      contactHtml() +
    '</article>';
  }

  return {
    contacts: contacts,
    products: products,
    escapeHtml: escapeHtml,
    formatTwd: formatTwd,
    productBySku: productBySku,
    quoteLines: quoteLines,
    contactHtml: contactHtml,
    productCardHtml: productCardHtml,
  };
});
