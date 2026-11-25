'use strict';

const { paymentClosedResponse } = require('../../_payment-gate');
const { getWallpaperSku, skuFromWallpaperTradeNo } = require('../../_wallpaper-catalog');
const {
  createCheckMacValue,
  timingSafeEqualHex,
  parseRequestBody,
  getAioCredentials,
  getBaseUrl,
} = require('../../ecpay/_lib');
const {
  privateBlobReady,
  readOrderState,
  signOrder,
  signDownloadToken,
  getAssetRecord,
} = require('./_lib');

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function detectLang(req) {
  const query = req.query || {};
  const q = String(query.lang || query.language || '').toLowerCase();
  if (q === 'zh' || q === 'en') return q;
  const accept = String((req.headers && (req.headers['accept-language'] || req.headers['Accept-Language'])) || '').toLowerCase();
  if (/(?:^|,|;|\s)zh\b/.test(accept)) return 'zh';
  return 'en';
}

function t(lang, en, zh) {
  const value = lang === 'zh' ? zh : en;
  return `<span data-en="${escapeHtml(en)}" data-zh="${escapeHtml(zh)}">${escapeHtml(value)}</span>`;
}

const LANG_SCRIPT = `<script>
(function(){
  var lang = document.documentElement.lang === 'zh-Hant' ? 'zh' : 'en';
  try {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'zh' || q === 'en') lang = q;
    else {
      var stored = localStorage.getItem('ae-language');
      if (stored === 'zh' || stored === 'en') lang = stored;
    }
  } catch (e) {}
  function render() {
    document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
    document.querySelectorAll('[data-en][data-zh]').forEach(function (el) {
      var value = el.getAttribute(lang === 'zh' ? 'data-zh' : 'data-en');
      if (value != null) el.textContent = value;
    });
    document.querySelectorAll('[data-language]').forEach(function (el) {
      el.textContent = lang === 'zh' ? 'EN' : '\\u4e2d\\u6587';
      el.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '\\u5207\\u63db\\u81f3\\u4e2d\\u6587');
    });
    try { localStorage.setItem('ae-language', lang); } catch (e) {}
  }
  document.querySelectorAll('[data-language]').forEach(function (el) {
    el.addEventListener('click', function () {
      lang = lang === 'en' ? 'zh' : 'en';
      render();
    });
  });
  render();
})();
</script>`;

function page(res, lang, titleEn, titleZh, body) {
  const title = lang === 'zh' ? titleZh : titleEn;
  const toggleLabel = lang === 'zh' ? 'EN' : '中文';
  const toggleAria = lang === 'zh' ? 'Switch to English' : '切換至中文';
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(`<!doctype html>
<html lang="${lang === 'zh' ? 'zh-Hant' : 'en'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title data-en="${escapeHtml(titleEn)}" data-zh="${escapeHtml(titleZh)}">${escapeHtml(title)}</title>
<style>
  body{font-family:Georgia,system-ui,sans-serif;background:#0b0b0b;color:#f5efe5;padding:40px;margin:0}
  main{max-width:720px;margin:auto}
  .lang-bar{display:flex;justify-content:flex-end;margin:0 0 1.2em}
  .lang-bar button{background:transparent;border:0;color:inherit;font:inherit;font-size:15px;cursor:pointer;padding:6px 2px}
  a{color:inherit}
  h1{font-size:2em;font-weight:600;margin:0 0 .7em}
  h2{font-size:1.15em;font-weight:600;margin:0 0 .6em}
  h3{font-size:1.05em;font-weight:600;margin:1.2em 0 .5em}
  .dl{display:inline-block;padding:12px 18px;background:#f5efe5;color:#0b0b0b;text-decoration:none;border-radius:999px}
  .howto{margin-top:2em;padding-top:1.4em;border-top:1px solid rgba(245,239,229,.25);line-height:1.65;font-size:16px}
  ol{margin:0;padding-left:1.2em}
  .back{margin-top:2em}
</style>
</head>
<body>
  <main>
    <div class="lang-bar"><button type="button" data-language aria-label="${escapeHtml(toggleAria)}">${escapeHtml(toggleLabel)}</button></div>
    ${body}
  </main>
  ${LANG_SCRIPT}
</body>
</html>`);
}

module.exports = async function handler(req, res) {
  if (paymentClosedResponse(res)) return;
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).send('Method Not Allowed');
  }

  const lang = detectLang(req);

  let creds;
  try {
    creds = getAioCredentials();
  } catch (_) {
    return page(res, lang, 'Payment unavailable', '付款未開放',
      `<h1>${t(lang, 'Payment unavailable', '付款未開放')}</h1><p>${t(lang, 'Payment is not enabled.', '付款尚未開放。')}</p><p class="back"><a href="/shop">${t(lang, 'Back to shop', '返回商店')}</a></p>`);
  }

  const body = req.method === 'POST' ? parseRequestBody(req) : (req.query || {});
  const merchantTradeNo = String(body.MerchantTradeNo || body.merchant_trade_no || '');
  const skuHint = skuFromWallpaperTradeNo(merchantTradeNo) || String(body.CustomField1 || body.sku || '').toUpperCase();
  const record = getWallpaperSku(skuHint);

  let macOk = false;
  const received = String(body.CheckMacValue || '').toUpperCase();
  if (received && req.method === 'POST') {
    const expected = createCheckMacValue(body, creds.hashKey, creds.hashIV);
    macOk = timingSafeEqualHex(received, expected) && String(body.MerchantID || '') === creds.merchantID;
  }

  let paid = false;
  let state = null;
  if (merchantTradeNo && privateBlobReady()) {
    try { state = await readOrderState(merchantTradeNo); } catch (_) { state = null; }
    if (state && state.paid_verified && record && state.sku === record.sku && Number(state.amount) === record.amount) {
      paid = true;
    }
  }

  if (!paid && macOk && String(body.RtnCode) === '1' && record && Number.parseInt(String(body.TradeAmt || ''), 10) === record.amount && String(body.SimulatePaid || '0') !== '1') {
    // ReturnURL may still be in flight; do not claim paid until the stored order says so.
  }

  if (!record) {
    return page(res, lang, 'Payment result', '付款結果',
      `<h1>${t(lang, 'Payment result received', '付款結果已返回')}</h1><p>${t(lang, 'We could not find a matching product. The final status is determined by server verification.', '找不到對應商品。最終狀態以伺服器驗證為準。')}</p><p class="back"><a href="/shop">${t(lang, 'Back to shop', '返回商店')}</a></p>`);
  }

  const productName = t(lang, record.name_en || record.public_name, record.name_zh || record.public_name);

  if (!paid) {
    return page(res, lang, 'Payment processing', '付款處理中',
      `<h1>${t(lang, 'Payment is being processed', '付款結果處理中')}</h1>
       <p>${productName}</p>
       <p>${t(lang, 'Order number: ', '訂單編號：')}${escapeHtml(merchantTradeNo || '—')}</p>
       <p>${t(lang, 'If you have already paid, please refresh this page in a moment. This page will not offer a download until the server has confirmed the ECPay (綠界) notification.', '若你已完成付款，請稍候再重新整理本頁。此頁在伺服器確認綠界通知之前，不會提供下載。')}</p>
       <p class="back"><a href="/shop">${t(lang, 'Back to shop', '返回商店')}</a></p>`);
  }

  const asset = getAssetRecord(record.sku);
  const order = {
    v: 1,
    provider: 'ecpay_aio',
    order_id: merchantTradeNo,
    merchant_trade_no: merchantTradeNo,
    sku: record.sku,
    amount: record.amount,
    currency: 'TWD',
    expires: Date.now() + 30 * 60 * 1000,
  };
  const orderToken = signOrder(order);
  const downloadToken = signDownloadToken({
    order_id: merchantTradeNo,
    sku: record.sku,
    filename: asset.filename,
    sha256: asset.sha256,
  });
  const downloadUrl = `${getBaseUrl(req)}/api/download?token=${encodeURIComponent(downloadToken)}`;

  return page(res, lang, 'Payment successful', '付款成功', `
    <h1>${t(lang, 'Payment successful', '付款成功')}</h1>
    <p>${productName} · NT$${record.amount}</p>
    <p>${t(lang, 'Order number: ', '訂單編號：')}${escapeHtml(merchantTradeNo)}</p>
    <p>${t(lang, 'Please download from this page within 5 minutes. This link is only for this paid order.', '請在 5 分鐘內從這個頁面下載。連結僅限這筆已付款訂單使用。')}</p>
    <p><a class="dl" href="${escapeHtml(downloadUrl)}">${t(lang, 'Download', '下載檔案')}</a></p>
    <section class="howto">
      <h2>${t(lang, 'After you download', '下載後怎麼用')}</h2>
      <p>${t(lang, 'Your download is a ZIP file. Tap Download on this page first, then unzip it on your device to see the wallpapers and the readme.', '下載的是一個 ZIP 壓縮檔。請先在這個頁面點「下載檔案」，下載完成後再解壓縮，就可以看到裡面的桌布與說明。')}</p>
      <h3>${t(lang, 'Save on iPhone', '在 iPhone 上儲存')}</h3>
      <ol>
        <li>${t(lang, 'Tap Download and save the ZIP in the Files app.', '點「下載檔案」，把 ZIP 存到「檔案」App。')}</li>
        <li>${t(lang, 'Open Files and tap the ZIP to unzip it.', '打開「檔案」，點那個 ZIP 即可解壓縮。')}</li>
        <li>${t(lang, 'Open an image, tap Share, then Save Image or Use as Wallpaper.', '打開其中一張圖片，點分享，再選「儲存影像」或「用作桌布」。')}</li>
        <li>${t(lang, 'When setting the wallpaper, pinch and move to fit. Taller screens may crop slightly.', '設為桌布時可縮放、移動以符合螢幕；較長的螢幕可能會有少許裁切。')}</li>
      </ol>
    </section>
    <p class="back"><a href="/shop">${t(lang, 'Back to shop', '返回商店')}</a></p>
    <form method="post" action="/api/order/download-token" style="display:none">
      <input type="hidden" name="order_token" value="${escapeHtml(orderToken)}">
    </form>
  `);
};
