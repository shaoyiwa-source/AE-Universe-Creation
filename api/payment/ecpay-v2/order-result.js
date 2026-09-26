const { parseJsonBody } = require('./_lib');

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

module.exports = async function handler(req, res) {
  const body = parseJsonBody(req);
  const message = body.ResultData || body.TransMsg || 'Payment result received. Server verification may still be pending.';
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AE Stage Payment Result</title><body style="font-family:system-ui;background:#0b0b0b;color:#f5efe5;padding:40px"><main style="max-width:700px;margin:auto"><p>AE Universe Creation · Stage</p><h1>付款結果已返回</h1><p>${escapeHtml(message)}</p><p>此頁不是交付憑證。最終狀態以伺服器 ReturnURL 驗證與訂單查詢為準。</p><a style="color:inherit" href="/checkout-stage.html">Back to Stage checkout</a></main></body></html>`);
};
