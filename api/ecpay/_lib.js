const crypto = require('crypto');
const querystring = require('querystring');

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

function makeMerchantTradeNo() {
  // <=20 chars, alphanumeric, unique enough for stage; prefix identifies AE.
  const now = Date.now().toString(36).toUpperCase();
  const rnd = crypto.randomBytes(3).toString('hex').toUpperCase();
  return (`AE${now}${rnd}`).slice(0, 20);
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
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Redirecting to ECPay…</title></head><body><p>Redirecting to ECPay Stage… / 正在前往綠界測試付款頁…</p><form id="ecpay" method="post" action="${htmlEscape(action)}">${inputs}<noscript><button type="submit">Continue / 繼續</button></noscript></form><script>document.getElementById('ecpay').submit();</script></body></html>`;
}

module.exports = {
  createCheckMacValue,
  timingSafeEqualHex,
  parseRequestBody,
  formatTaipeiDate,
  makeMerchantTradeNo,
  getBaseUrl,
  autoSubmitForm,
};
