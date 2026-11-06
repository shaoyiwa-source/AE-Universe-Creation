'use strict';

// Fail closed for ECPay order creation, callbacks, tokens, and paid download.
// Unset ECPAY_MODE is not stage. Vercel Production (including --prod --skip-domain)
// stays closed even if ECPAY_MODE=stage. Stage code below the gate is kept for a
// later explicit non-production test: ECPAY_MODE=stage and VERCEL_ENV is not production.

function stageTestAllowed() {
  const mode = String(process.env.ECPAY_MODE || '').trim().toLowerCase();
  const vercelEnv = String(process.env.VERCEL_ENV || '').trim().toLowerCase();
  if (vercelEnv === 'production') return false;
  return mode === 'stage';
}

function paymentClosedResponse(res) {
  if (stageTestAllowed()) return false;
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

module.exports = { stageTestAllowed, paymentClosedResponse };
