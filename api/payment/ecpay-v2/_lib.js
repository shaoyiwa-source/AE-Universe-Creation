const crypto = require('crypto');

const PROVIDER = 'ecpay_stage_embedded_v2';
const STAGE_MERCHANT_ID = '3002607';
const STAGE_HASH_KEY = 'pwFHCqoQZGmho4w6';
const STAGE_HASH_IV = 'EkRm7iFT261dpevs';
const STAGE_HOST = 'https://ecpg-stage.ecpay.com.tw';
const GET_TOKEN_URL = `${STAGE_HOST}/Merchant/GetTokenbyTrade`;
const CREATE_PAYMENT_URL = `${STAGE_HOST}/Merchant/CreatePayment`;
const QUERY_TRADE_URL = 'https://ecpayment-stage.ecpay.com.tw/1.0.0/Cashier/QueryTrade';

const SKU_CODE = {
  'ES-ORIGINAL': '1',
  'ES-GALLERY': '2',
  'ES-PHONE': '3',
  'ES-SQUARE': '4',
};
const CODE_SKU = Object.fromEntries(Object.entries(SKU_CODE).map(([sku, code]) => [code, sku]));
const SKU_NAMES = {
  'ES-ORIGINAL': 'Eternal Sun · Original Painting Edition',
  'ES-GALLERY': 'Eternal Sun · Gallery Edition',
  'ES-PHONE': 'Eternal Sun · Phone Wallpaper Edition',
  'ES-SQUARE': 'Eternal Sun · Square Edition',
};

function requireStageMode() {
  const mode = String(process.env.ECPAY_MODE || 'stage').toLowerCase();
  if (mode !== 'stage') {
    const err = new Error('Only ECPay Stage is enabled in this Preview adapter.');
    err.code = 'STAGE_ONLY';
    throw err;
  }
}

function getCredentials() {
  requireStageMode();
  return {
    merchantID: process.env.ECPAY_STAGE_MERCHANT_ID || STAGE_MERCHANT_ID,
    hashKey: process.env.ECPAY_STAGE_HASH_KEY || STAGE_HASH_KEY,
    hashIV: process.env.ECPAY_STAGE_HASH_IV || STAGE_HASH_IV,
  };
}

function stageAmountForSku(sku) {
  if (!SKU_CODE[sku]) return null;
  const specific = process.env[`ECPAY_STAGE_AMOUNT_${sku.replace(/-/g, '_')}`];
  const raw = specific || process.env.ECPAY_STAGE_TEST_AMOUNT_TWD || '1';
  const amount = Number.parseInt(raw, 10);
  if (!Number.isInteger(amount) || amount < 1 || amount > 1000000) {
    throw new Error(`Invalid Stage amount for ${sku}`);
  }
  return amount;
}

function getSkuRecord(sku) {
  const clean = String(sku || '').toUpperCase();
  if (!SKU_CODE[clean]) return null;
  return {
    sku: clean,
    public_name: SKU_NAMES[clean],
    currency: 'TWD',
    amount: stageAmountForSku(clean),
    asset_manifest_id: null,
    active: true,
    fulfillment_enabled: false,
  };
}

function urlEncodeJson(value) {
  // JavaScript encodeURIComponent matches ECPay's documented uppercase URL-encoding vector.
  return encodeURIComponent(JSON.stringify(value));
}

function encryptData(value, hashKey, hashIV) {
  const encoded = urlEncodeJson(value);
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(hashKey, 'utf8'), Buffer.from(hashIV, 'utf8'));
  return Buffer.concat([cipher.update(encoded, 'utf8'), cipher.final()]).toString('base64');
}

function decryptData(ciphertext, hashKey, hashIV) {
  const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(hashKey, 'utf8'), Buffer.from(hashIV, 'utf8'));
  const encoded = Buffer.concat([
    decipher.update(Buffer.from(String(ciphertext), 'base64')),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(decodeURIComponent(encoded));
}

function ecpayEnvelope(data) {
  const { merchantID, hashKey, hashIV } = getCredentials();
  return {
    MerchantID: merchantID,
    RqHeader: { Timestamp: Math.floor(Date.now() / 1000) },
    Data: encryptData(data, hashKey, hashIV),
  };
}

function decodeEnvelope(envelope) {
  const { merchantID, hashKey, hashIV } = getCredentials();
  if (!envelope || String(envelope.MerchantID || '') !== merchantID) {
    throw new Error('ECPay MerchantID mismatch.');
  }
  if (Number(envelope.TransCode) !== 1) {
    const err = new Error(`ECPay transport rejected: ${envelope.TransMsg || envelope.TransCode}`);
    err.code = 'ECPAY_TRANSPORT_REJECTED';
    throw err;
  }
  return decryptData(envelope.Data, hashKey, hashIV);
}

async function postEncrypted(url, data, fetchImpl = global.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch unavailable');
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(ecpayEnvelope(data)),
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch (_) {
    throw new Error(`ECPay returned non-JSON HTTP ${response.status}`);
  }
  if (!response.ok) throw new Error(`ECPay HTTP ${response.status}`);
  return { outer: body, data: decodeEnvelope(body) };
}

function makeMerchantTradeNo(sku) {
  const code = SKU_CODE[sku];
  if (!code) throw new Error('Unknown SKU');
  const stamp = Date.now().toString(36).toUpperCase().slice(-9);
  const rnd = crypto.randomBytes(3).toString('hex').toUpperCase();
  return (`AE${code}${stamp}${rnd}`).slice(0, 20);
}

function skuFromMerchantTradeNo(value) {
  const tradeNo = String(value || '');
  if (!/^AE[1-4][A-Z0-9]+$/.test(tradeNo) || tradeNo.length > 20) return null;
  return CODE_SKU[tradeNo[2]] || null;
}

function formatTaipeiDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function getBaseUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return host ? `${proto}://${host}` : '';
}

function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}

function hmacSecret() {
  // Stage-only order envelope integrity. Production must use a separate private secret.
  return process.env.AE_STAGE_ORDER_SECRET || getCredentials().hashKey;
}

function signOrder(order) {
  const payload = Buffer.from(JSON.stringify(order), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', hmacSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyOrderToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) throw new Error('Invalid order token.');
  const expected = crypto.createHmac('sha256', hmacSecret()).update(payload).digest('base64url');
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Invalid order token signature.');
  const order = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!order.expires || Date.now() > order.expires) throw new Error('Order token expired.');
  const sku = getSkuRecord(order.sku);
  if (!sku || sku.amount !== order.amount || order.currency !== 'TWD') throw new Error('Order token/config mismatch.');
  return order;
}

function makeOrderEnvelope(sku) {
  const record = getSkuRecord(sku);
  if (!record) throw new Error('Unknown SKU');
  const merchantTradeNo = makeMerchantTradeNo(record.sku);
  const now = Date.now();
  const order = {
    v: 1,
    provider: PROVIDER,
    order_id: merchantTradeNo,
    merchant_trade_no: merchantTradeNo,
    sku: record.sku,
    amount: record.amount,
    currency: record.currency,
    status: 'CREATED',
    issued: now,
    expires: now + 30 * 60 * 1000,
  };
  return { order, orderToken: signOrder(order), skuRecord: record };
}

async function queryOrder(merchantTradeNo, fetchImpl = global.fetch) {
  const { merchantID } = getCredentials();
  return postEncrypted(QUERY_TRADE_URL, {
    PlatformID: '',
    MerchantID: merchantID,
    MerchantTradeNo: merchantTradeNo,
  }, fetchImpl);
}

function validateCallbackData(data) {
  const { merchantID } = getCredentials();
  if (!data || Number(data.RtnCode) !== 1) return { paidVerified: false, reason: 'RTN_CODE_NOT_SUCCESS' };
  if (String(data.MerchantID || '') !== merchantID) return { paidVerified: false, reason: 'MERCHANT_MISMATCH' };
  if (Number(data.SimulatePaid || 0) === 1) return { paidVerified: false, reason: 'SIMULATED_PAYMENT' };
  const info = data.OrderInfo || {};
  const sku = skuFromMerchantTradeNo(info.MerchantTradeNo);
  const record = sku && getSkuRecord(sku);
  if (!record) return { paidVerified: false, reason: 'UNKNOWN_ORDER_SKU' };
  if (Number(info.TradeAmt) !== record.amount) return { paidVerified: false, reason: 'AMOUNT_MISMATCH', sku };
  if (String(info.TradeStatus || '') !== '1') return { paidVerified: false, reason: 'CALLBACK_NOT_PAID', sku };
  return { paidVerified: true, reason: 'CALLBACK_VALID', sku, record, merchantTradeNo: info.MerchantTradeNo };
}

function validateQueryData(queryData, expected) {
  if (!queryData || Number(queryData.RtnCode) !== 1) return { paidVerified: false, reason: 'QUERY_FAILED' };
  const info = queryData.OrderInfo || {};
  if (String(info.MerchantTradeNo || '') !== expected.merchantTradeNo) return { paidVerified: false, reason: 'QUERY_ORDER_MISMATCH' };
  if (String(info.TradeStatus || '') !== '1') return { paidVerified: false, reason: 'QUERY_NOT_PAID' };
  if (Number(info.TradeAmt) !== expected.record.amount) return { paidVerified: false, reason: 'QUERY_AMOUNT_MISMATCH' };
  return { paidVerified: true, reason: 'QUERY_CONFIRMED' };
}

module.exports = {
  PROVIDER,
  STAGE_HOST,
  GET_TOKEN_URL,
  CREATE_PAYMENT_URL,
  QUERY_TRADE_URL,
  getCredentials,
  getSkuRecord,
  encryptData,
  decryptData,
  ecpayEnvelope,
  decodeEnvelope,
  postEncrypted,
  makeMerchantTradeNo,
  skuFromMerchantTradeNo,
  formatTaipeiDate,
  getBaseUrl,
  parseJsonBody,
  signOrder,
  verifyOrderToken,
  makeOrderEnvelope,
  queryOrder,
  validateCallbackData,
  validateQueryData,
};
