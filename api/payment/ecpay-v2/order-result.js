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

function page(res, title, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head><body style="font-family:Georgia,system-ui,sans-serif;background:#0b0b0b;color:#f5efe5;padding:40px"><main style="max-width:720px;margin:auto">${body}<p style="margin-top:2em"><a style="color:inherit" href="/shop">返回商店 / Back to shop</a></p></main></body></html>`);
}

module.exports = async function handler(req, res) {
  if (paymentClosedResponse(res)) return;
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).send('Method Not Allowed');
  }

  let creds;
  try {
    creds = getAioCredentials();
  } catch (_) {
    return page(res, '付款未開放', '<h1>付款未開放</h1><p>Payment is not enabled.</p>');
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
    return page(res, '付款結果', '<h1>付款結果已返回</h1><p>找不到對應商品。最終狀態以伺服器驗證為準。</p>');
  }

  if (!paid) {
    return page(res, '付款處理中', `<h1>付款結果處理中</h1><p>${escapeHtml(record.public_name)}</p><p>訂單編號：${escapeHtml(merchantTradeNo || '—')}</p><p>若你已完成付款，請稍候再重新整理本頁。此頁在伺服器確認綠界通知之前，不會提供下載。</p>`);
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

  return page(res, '付款成功', `
    <h1>付款成功</h1>
    <p>${escapeHtml(record.public_name)} · NT$${record.amount}</p>
    <p>訂單編號：${escapeHtml(merchantTradeNo)}</p>
    <p>請在 5 分鐘內下載。連結僅限這筆已付款訂單使用。</p>
    <p><a style="display:inline-block;padding:12px 18px;background:#f5efe5;color:#0b0b0b;text-decoration:none;border-radius:999px" href="${escapeHtml(downloadUrl)}">下載檔案 / Download</a></p>
    <form method="post" action="/api/order/download-token" style="display:none">
      <input type="hidden" name="order_token" value="${escapeHtml(orderToken)}">
    </form>
  `);
};
