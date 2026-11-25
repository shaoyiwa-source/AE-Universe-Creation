'use strict';

// ECPay AIO helpers for the production shop.
// MerchantID, HashKey and HashIV are never stored in this file.
// Production needs:
//   ECPAY_MODE=live
//   ECPAY_MERCHANT_ID
//   ECPAY_HASH_KEY
//   ECPAY_HASH_IV
// Stage previews use the same three credential variables with ECPAY_MODE=stage.
// Checkout host is chosen from ECPAY_MODE. It is not a secret.

const crypto = require('crypto');
const querystring = require('querystring');
const { paymentAllowed, paymentMode } = require('../_payment-gate');

const LIVE_AIO_CHECKOUT = 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';
const STAGE_AIO_CHECKOUT = 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5';

function phpUrlEncode(value) {
  // Match the encoding ECPay documents for AioCheckOut CheckMacValue:
  // PHP urlencode/RFC1866 style (space => +), with ECPay's accepted safe chars.
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(/%7E/gi, '~')
    .replace(/'/g, '%27');
}

function normalizeEcpayEncoding(encoded) {
  // ECPay's .NET-compatible conversion keeps these characters unescaped.
  return encoded
    .replace(/%2D/gi, '-')
    .replace(/%5F/gi, '_')
    .replace(/%2E/gi, '.')
    .replace(/%21/gi, '!')
    .replace(/%2A/gi, '*')
    .replace(/%28/gi, '(')
    .replace(/%29/gi, ')');
}

function createCheckMacValue(params, hashKey, hashIV) {
  const clean = Object.entries(params)
    .filter(([key, value]) => key !== 'CheckMacValue' && value !== undefined && value !== null)
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()));

  const pairs = clean.map(([key, value]) => `${key}=${String(value)}`).join('&');
  const raw = `HashKey=${hashKey}&${pairs}&HashIV=${hashIV}`;
  const encoded = normalizeEcpayEncoding(phpUrlEncode(raw)).toLowerCase();
  return crypto.createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase();
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return crypto.timingSafeEqual(ab, bb);
}

function parseRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    const type = String(req.headers['content-type'] || '').toLowerCase();
    if (type.includes('application/json')) {
      try { return JSON.parse(req.body); } catch (_) { return {}; }
    }
    return querystring.parse(req.body);
  }
  return {};
}

function formatTaipeiDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function getBaseUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host) return '';
  return `${proto}://${host}`;
}

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function autoSubmitForm(action, fields) {
  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${htmlEscape(k)}" value="${htmlEscape(v)}">`)
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Redirecting to ECPay…</title></head><body><p>Redirecting to ECPay… / 正在前往綠界付款頁…</p><form id="ecpay" method="post" action="${htmlEscape(action)}">${inputs}<noscript><button type="submit">Continue / 繼續</button></noscript></form><script>document.getElementById('ecpay').submit();</script></body></html>`;
}

function credentialsFromEnv() {
  return {
    merchantID: String(process.env.ECPAY_MERCHANT_ID || '').trim(),
    hashKey: String(process.env.ECPAY_HASH_KEY || '').trim(),
    hashIV: String(process.env.ECPAY_HASH_IV || '').trim(),
  };
}

function getAioCredentials() {
  if (!paymentAllowed()) {
    const err = new Error('ECPay checkout is not enabled.');
    err.code = 'PAYMENT_NOT_ENABLED';
    throw err;
  }
  const mode = paymentMode() === 'live' ? 'live' : 'stage';
  const creds = credentialsFromEnv();
  if (!creds.merchantID || !creds.hashKey || !creds.hashIV) {
    const err = new Error('ECPay keys are missing.');
    err.code = 'PAYMENT_NOT_ENABLED';
    throw err;
  }
  return {
    mode,
    merchantID: creds.merchantID,
    hashKey: creds.hashKey,
    hashIV: creds.hashIV,
    checkoutUrl: mode === 'live' ? LIVE_AIO_CHECKOUT : STAGE_AIO_CHECKOUT,
  };
}

module.exports = {
  createCheckMacValue,
  timingSafeEqualHex,
  parseRequestBody,
  formatTaipeiDate,
  getBaseUrl,
  autoSubmitForm,
  getAioCredentials,
  LIVE_AIO_CHECKOUT,
  STAGE_AIO_CHECKOUT,
};
