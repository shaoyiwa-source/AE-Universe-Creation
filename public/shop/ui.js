(function () {
  const shop = window.AE_SHOP;
  if (!shop) return;
  const CART_KEY = 'ae-shop-cart-v1';

  function loadQuote() {
    let raw = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '{"items":[]}');
      raw = Array.isArray(parsed.items) ? parsed.items : [];
    } catch (error) {
      raw = [];
    }
    if (!raw.length) return { currency: 'TWD', amount: 0, lines: [], label: shop.formatTwd(0) };
    try {
      return shop.quoteLines(raw);
    } catch (error) {
      localStorage.removeItem(CART_KEY);
      return { currency: 'TWD', amount: 0, lines: [], label: shop.formatTwd(0) };
    }
  }

  function saveQuote(quote) {
    localStorage.setItem(CART_KEY, JSON.stringify({
      items: quote.lines.map(function (line) { return { sku: line.sku, qty: line.qty }; }),
    }));
    paintCartCount(quote);
  }

  function paintCartCount(quote) {
    const count = (quote || loadQuote()).lines.reduce(function (sum, line) { return sum + line.qty; }, 0);
    document.querySelectorAll('[data-cart-count]').forEach(function (node) {
      node.textContent = count ? ' (' + count + ')' : '';
    });
  }

  function mountContacts() {
    const html = shop.contactHtml();
    document.querySelectorAll('[data-ae-contact]').forEach(function (node) {
      node.innerHTML = html;
    });
  }

  function addSku(sku, trigger) {
    const current = loadQuote();
    const items = current.lines.map(function (line) { return { sku: line.sku, qty: line.qty }; });
    const found = items.find(function (line) { return line.sku === sku; });
    if (found) found.qty = Math.min(9, found.qty + 1);
    else items.push({ sku: sku, qty: 1 });
    const quote = shop.quoteLines(items);
    saveQuote(quote);
    const card = trigger && trigger.closest ? trigger.closest('.shop-card, .edition-purchase, .product-panel') : null;
    const toast = card && card.querySelector('[data-toast]');
    if (toast) {
      toast.hidden = false;
      toast.textContent = '已加入購物車 · Added on this site';
    }
    return quote;
  }

  function bindAddButtons() {
    document.querySelectorAll('[data-add-sku]').forEach(function (button) {
      if (button.dataset.bound === '1') return;
      button.dataset.bound = '1';
      button.addEventListener('click', function (event) {
        event.preventDefault();
        addSku(button.getAttribute('data-add-sku'), button);
      });
    });
  }

  function renderShop() {
    const grid = document.getElementById('shop-grid');
    if (!grid) return;
    grid.innerHTML = shop.products.map(shop.productCardHtml).join('');
    if (location.hash) {
      const node = document.querySelector(location.hash);
      if (node && node.scrollIntoView) node.scrollIntoView();
    }
  }

  function renderProduct() {
    const panel = document.getElementById('product-panel');
    if (!panel) return;
    const params = new URLSearchParams(location.search);
    const product = shop.productBySku(params.get('sku'));
    if (!product) {
      panel.innerHTML = '<p>找不到這個作品。請回到 <a class="text-link" href="shop.html">選購 · Shop</a>。</p>';
      return;
    }
    document.title = product.nameZh + ' · AE Universe Creation';
    panel.innerHTML = shop.productCardHtml(product);
  }

  function lineRow(line) {
    return '<tr data-sku="' + line.sku + '">' +
      '<td>' + shop.escapeHtml(line.nameZh) + '<br><span class="shop-en">' + shop.escapeHtml(line.nameEn) + '</span></td>' +
      '<td class="ae-price">' + shop.formatTwd(line.unit) + ' <span class="ae-currency">新台幣</span></td>' +
      '<td><button type="button" data-qty="-1" aria-label="減少數量">−</button> <span>' + line.qty + '</span> <button type="button" data-qty="1" aria-label="增加數量">+</button></td>' +
      '<td class="ae-price">' + shop.formatTwd(line.lineAmount) + ' <span class="ae-currency">新台幣</span></td>' +
      '<td><button type="button" data-remove>移除 · Remove</button></td>' +
    '</tr>';
  }

  function renderCartTable(targetId) {
    const target = document.getElementById(targetId);
    if (!target) return loadQuote();
    const quote = loadQuote();
    if (!quote.lines.length) {
      target.innerHTML = '<p>購物車還是空的。請回到 <a class="text-link" href="shop.html">選購 · Shop</a> 加入作品。</p>';
      return quote;
    }
    target.innerHTML = '<table class="cart-table"><thead><tr><th>作品</th><th>單價</th><th>數量</th><th>小計</th><th></th></tr></thead><tbody>' +
      quote.lines.map(lineRow).join('') +
      '</tbody></table><p class="cart-total">合計 · Total <span class="ae-price">' + quote.label + '</span> <span class="ae-currency">新台幣</span></p>';
    target.querySelectorAll('tbody tr').forEach(function (row) {
      const sku = row.getAttribute('data-sku');
      row.querySelector('[data-remove]').addEventListener('click', function () {
        const next = loadQuote().lines.filter(function (line) { return line.sku !== sku; });
        if (!next.length) localStorage.removeItem(CART_KEY);
        else saveQuote(shop.quoteLines(next));
        renderCartTable(targetId);
        const total = document.getElementById('checkout-total');
        if (total) paintCheckoutTotal();
      });
      row.querySelectorAll('[data-qty]').forEach(function (button) {
        button.addEventListener('click', function () {
          const delta = Number(button.getAttribute('data-qty'));
          const items = loadQuote().lines.map(function (line) {
            return { sku: line.sku, qty: line.sku === sku ? line.qty + delta : line.qty };
          }).filter(function (line) { return line.qty > 0; });
          try {
            if (!items.length) localStorage.removeItem(CART_KEY);
            else saveQuote(shop.quoteLines(items));
          } catch (error) {
            return;
          }
          renderCartTable(targetId);
          if (document.getElementById('checkout-total')) paintCheckoutTotal();
        });
      });
    });
    return quote;
  }

  function paintCheckoutTotal() {
    const quote = loadQuote();
    const total = document.getElementById('checkout-total');
    if (total) {
      total.textContent = quote.lines.length ? quote.label : shop.formatTwd(0);
    }
    return quote;
  }

  function showStatus(value) {
    const node = document.getElementById('checkout-status');
    if (!node) return;
    node.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    let payload = {};
    try { payload = await response.json(); } catch (error) { payload = { error: 'NON_JSON_RESPONSE' }; }
    if (!response.ok || payload.error === 'NON_JSON_RESPONSE') {
      const err = new Error(payload.error || ('HTTP ' + response.status));
      err.payload = payload.error === 'NON_JSON_RESPONSE'
        ? '結帳仍在本站。付款服務暫時沒有回應，購物車與 NT$ 合計都還在。'
        : payload;
      throw err;
    }
    return payload;
  }

  function bindCheckout() {
    const form = document.getElementById('checkout-form');
    if (!form) return;
    const pay = document.getElementById('checkout-pay');
    let orderToken = null;
    paintCheckoutTotal();
    if (window.ECPay && ECPay.initialize) {
      ECPay.initialize(ECPay.ServerType.Stage, 1, function (err) {
        if (err) showStatus('SDK init: ' + err);
      });
    }
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const quote = loadQuote();
      if (!quote.lines.length) {
        showStatus('購物車是空的。請先在本站加入作品。');
        return;
      }
      const email = String(document.getElementById('checkout-email').value || '').trim();
      pay.disabled = true;
      showStatus('正在本站建立結帳…');
      try {
        const created = await postJson('/api/checkout/create', {
          items: quote.lines.map(function (line) { return { sku: line.sku, qty: line.qty }; }),
          email: email,
        });
        orderToken = created.order_token;
        const payable = created.order && created.order.amount;
        if (payable !== quote.amount) {
          showStatus('金額與目錄不一致，已停止付款。');
          pay.disabled = false;
          return;
        }
        document.getElementById('checkout-total').textContent = shop.formatTwd(payable);
        if (!window.ECPay || !created.token) {
          showStatus(created);
          pay.disabled = false;
          return;
        }
        ECPay.createPayment(created.token, ECPay.Language.zhTW, function (err) {
          if (err) showStatus('createPayment UI: ' + err);
        }, 'V2');
        showStatus('請在本頁選擇付款方式（ATM／超商代碼／超商條碼）。合計 ' + shop.formatTwd(payable) + '。');
        pay.disabled = false;
        pay.dataset.ready = '1';
      } catch (error) {
        showStatus(error.payload || error.message);
        pay.disabled = false;
      }
    });
    pay.addEventListener('click', function () {
      if (pay.dataset.ready !== '1' || !window.ECPay) return;
      pay.disabled = true;
      ECPay.getPayToken(async function (info, err) {
        try {
          if (err) throw new Error(err);
          const paid = await postJson('/api/payment/ecpay-v2/create', {
            pay_token: info.PayToken,
            order_token: orderToken,
          });
          showStatus(paid.payment_info || paid);
        } catch (error) {
          showStatus(error.payload || error.message);
          pay.disabled = false;
        }
      });
    });
  }

  mountContacts();
  renderShop();
  renderProduct();
  if (document.getElementById('cart-lines')) renderCartTable('cart-lines');
  if (document.getElementById('checkout-lines')) renderCartTable('checkout-lines');
  bindAddButtons();
  bindCheckout();
  paintCartCount(loadQuote());
})();
