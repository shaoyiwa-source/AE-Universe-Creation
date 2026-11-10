'use strict';

// Fail closed for ECPay order creation, callbacks, tokens, and paid download.
// Unset ECPAY_MODE is not an open mode.
// Production stays closed unless ECPAY_MODE=live AND MerchantID/HashKey/HashIV are all set.
// Live mode without complete keys is always closed (preview or production).
// Stage is allowed only when ECPAY_MODE=stage and VERCEL_ENV is not production.

function paymentMode() {
  return String(process.env.ECPAY_MODE || '').trim().toLowerCase();
}

function vercelEnv() {
  return String(process.env.VERCEL_ENV || '').trim().toLowerCase();
}

function hasCompleteKeys() {
  const id = String(process.env.ECPAY_MERCHANT_ID || '').trim();
  const key = String(process.env.ECPAY_HASH_KEY || '').trim();
  const iv = String(process.env.ECPAY_HASH_IV || '').trim();
  return Boolean(id && key && iv);
}

function stageTestAllowed() {
  if (vercelEnv() === 'production') return false;
  return paymentMode() === 'stage';
}

function liveCheckoutAllowed() {
  return paymentMode() === 'live' && hasCompleteKeys();
}

function paymentAllowed() {
  return liveCheckoutAllowed() || stageTestAllowed();
}

function paymentClosedResponse(res) {
  if (paymentAllowed()) return false;
  const payload = { ok: false, error: 'PAYMENT_NOT_ENABLED' };
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-AE-Payment', 'disabled');
  if (typeof res.status === 'function') {
    const chained = res.status(403);
    if (chained && typeof chained.json === 'function') chained.json(payload);
    else if (chained && typeof chained.send === 'function') chained.send(JSON.stringify(payload));
    else res.end(JSON.stringify(payload));
    return true;
  }
  res.statusCode = 403;
  res.end(JSON.stringify(payload));
  return true;
}

module.exports = {
  paymentMode,
  hasCompleteKeys,
  stageTestAllowed,
  liveCheckoutAllowed,
  paymentAllowed,
  paymentClosedResponse,
};
