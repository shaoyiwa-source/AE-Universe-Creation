'use strict';

process.env.ECPAY_MODE = 'stage';
process.env.VERCEL_ENV = 'preview';
process.env.AE_ORDER_STORE = 'memory';
process.env.AE_ORDER_SECRET = 'wallpaper-unit-test-secret';
delete process.env.ECPAY_MERCHANT_ID;
delete process.env.ECPAY_HASH_KEY;
delete process.env.ECPAY_HASH_IV;

const assert = require('assert');
const { createCheckMacValue, getAioCredentials } = require('../api/ecpay/_lib');
const { getWallpaperSku, listSkus } = require('../api/_wallpaper-catalog');
const lib = require('../api/payment/ecpay-v2/_lib');
const createOrder = require('../api/ecpay/create-order');
const returnHandler = require('../api/ecpay/return');
const download = require('../api/download');
const downloadToken = require('../api/order/download-token');

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    chunks: [],
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    send(payload) { this.body = payload; return this; },
    write(chunk) { this.chunks.push(Buffer.from(chunk)); },
    end(payload) {
      if (payload !== undefined) this.body = payload;
      return this;
    },
  };
}

function textOf(res) {
  if (res.body == null) return '';
  return typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
}

async function invoke(handler, method, extra) {
  const res = mockRes();
  const req = {
    method,
    headers: Object.assign({
      'content-type': 'application/x-www-form-urlencoded',
      host: 'qa-preview.example.com',
      'x-forwarded-proto': 'https',
    }, extra.headers || {}),
    query: extra.query || {},
    body: extra.body || {},
  };
  await handler(req, res);
  return res;
}

function signedNotification(overrides) {
  const creds = getAioCredentials();
  const fields = Object.assign({
    MerchantID: creds.merchantID,
    MerchantTradeNo: 'AEW02TEST000000001',
    RtnCode: '1',
    RtnMsg: 'OK',
    TradeNo: 'STAGE0001',
    TradeAmt: '133',
    PaymentDate: '2026/11/10 20:00:00',
    PaymentType: 'Credit_CreditCard',
    TradeDate: '2026/11/10 19:59:00',
    SimulatePaid: '0',
    CustomField1: 'WP-VERDANT-GARDEN',
    CustomField2: '133',
  }, overrides);
  fields.CheckMacValue = createCheckMacValue(fields, creds.hashKey, creds.hashIV);
  return fields;
}

(async () => {
  const catalog = listSkus();
  assert.strictEqual(catalog.length, 14);
  assert.strictEqual(getWallpaperSku('WP-VERDANT-GARDEN').amount, 133);
  assert.strictEqual(getWallpaperSku('WP-AE-COLOR-UNIVERSE-9').amount, 199);
  assert.strictEqual(getWallpaperSku('WP-ETERNAL-SUN-4').amount, 233);
  assert.strictEqual(getWallpaperSku('WP-AE-HEART-UNIVERSE-9').amount, 266);
  assert.strictEqual(getWallpaperSku('WP-AE-HEART-UNIVERSE-9').fulfillment_enabled, false);
  assert.strictEqual(getWallpaperSku('ES-PHONE'), null);
  assert.strictEqual(lib.getSkuRecord('ES-PHONE'), null);

  // create-order: unknown / missing sku
  let res = await invoke(createOrder, 'POST', { body: {} });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.error, 'UNKNOWN_SKU');

  res = await invoke(createOrder, 'POST', { body: { sku: 'ES-PHONE', amount: 1 } });
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.error, 'UNKNOWN_SKU');

  res = await invoke(createOrder, 'POST', { body: { sku: 'WP-AE-HEART-UNIVERSE-9' } });
  assert.strictEqual(res.statusCode, 409);
  assert.strictEqual(res.body.error, 'FULFILLMENT_NOT_READY');

  // Client price is ignored; server uses NT$133.
  res = await invoke(createOrder, 'POST', {
    headers: { accept: 'text/html' },
    body: { sku: 'WP-VERDANT-GARDEN', amount: 1, price: 999, TotalAmount: 1 },
  });
  const html = textOf(res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(/payment-stage\.ecpay\.com\.tw/.test(html));
  assert.ok(/name="TotalAmount" value="133"/.test(html));
  assert.ok(!/name="TotalAmount" value="1"/.test(html));
  assert.ok(/name="MerchantID" value="3002607"/.test(html));
  assert.ok(/name="CustomField1" value="WP-VERDANT-GARDEN"/.test(html));
  const tradeNo = html.match(/name="MerchantTradeNo" value="([^"]+)"/)[1];
  assert.ok(/^AEW02/.test(tradeNo));

  const created = await lib.readOrderState(tradeNo);
  assert.ok(created);
  assert.strictEqual(created.paid_verified, false);
  assert.strictEqual(created.amount, 133);
  assert.strictEqual(created.sku, 'WP-VERDANT-GARDEN');

  // JSON create for another pack at 199
  res = await invoke(createOrder, 'POST', {
    headers: { accept: 'application/json' },
    body: { sku: 'WP-AE-COLOR-UNIVERSE-9', amount: 1 },
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.amount, 199);
  assert.strictEqual(res.body.fields.TotalAmount, '199');
  const trade199 = res.body.merchant_trade_no;

  // Anonymous download
  res = await invoke(download, 'GET', { query: {} });
  assert.strictEqual(res.statusCode, 403);

  res = await invoke(downloadToken, 'POST', {
    headers: { 'content-type': 'application/json' },
    body: { order_token: 'nope' },
  });
  assert.notStrictEqual(res.statusCode, 200);

  // Invalid CheckMac
  const valid = signedNotification({ MerchantTradeNo: tradeNo, CustomField1: 'WP-VERDANT-GARDEN', TradeAmt: '133' });
  const badMac = Object.assign({}, valid, { CheckMacValue: '0'.repeat(64) });
  res = await invoke(returnHandler, 'POST', { body: badMac });
  assert.strictEqual(res.statusCode, 400);
  assert.ok(/Invalid CheckMacValue/.test(textOf(res)));
  assert.strictEqual((await lib.readOrderState(tradeNo)).paid_verified, false);

  // Amount tampered, but remade mac (attacker who somehow resigns? we simulate signed tampered amount)
  // Without the key a remade mac would fail. Here we resign with the stage key to prove
  // the handler still rejects amount mismatch against the catalog / created order.
  const tampered = signedNotification({ MerchantTradeNo: tradeNo, CustomField1: 'WP-VERDANT-GARDEN', TradeAmt: '1' });
  res = await invoke(returnHandler, 'POST', { body: tampered });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(textOf(res), '1|OK');
  assert.strictEqual((await lib.readOrderState(tradeNo)).paid_verified, false);

  // Valid notification
  res = await invoke(returnHandler, 'POST', { body: valid });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(textOf(res), '1|OK');
  const paid = await lib.readOrderState(tradeNo);
  assert.strictEqual(paid.paid_verified, true);
  assert.strictEqual(paid.amount, 133);
  const verifiedAt = paid.verified_at;

  // Replay
  res = await invoke(returnHandler, 'POST', { body: valid });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(textOf(res), '1|OK');
  const replayed = await lib.readOrderState(tradeNo);
  assert.strictEqual(replayed.paid_verified, true);
  assert.strictEqual(replayed.verified_at, verifiedAt);

  // Download only after paid
  const orderToken = lib.signOrder({
    v: 1,
    provider: 'ecpay_aio',
    order_id: tradeNo,
    merchant_trade_no: tradeNo,
    sku: 'WP-VERDANT-GARDEN',
    amount: 133,
    currency: 'TWD',
    expires: Date.now() + 30 * 60 * 1000,
  });
  res = await invoke(downloadToken, 'POST', {
    headers: { 'content-type': 'application/json' },
    body: { order_token: orderToken },
  });
  // unpaid second order must not download
  const unpaidToken = lib.signOrder({
    v: 1,
    provider: 'ecpay_aio',
    order_id: trade199,
    merchant_trade_no: trade199,
    sku: 'WP-AE-COLOR-UNIVERSE-9',
    amount: 199,
    currency: 'TWD',
    expires: Date.now() + 30 * 60 * 1000,
  });
  const unpaid = await invoke(downloadToken, 'POST', {
    headers: { 'content-type': 'application/json' },
    body: { order_token: unpaidToken },
  });
  assert.strictEqual(unpaid.statusCode, 402);

  lib.memoryPutAsset('WP-VERDANT-GARDEN', Buffer.from('PK\x03\x04fake-zip-bytes'));
  res = await invoke(downloadToken, 'POST', {
    headers: { 'content-type': 'application/json' },
    body: { order_token: orderToken },
  });
  assert.strictEqual(res.statusCode, 200, textOf(res));
  assert.ok(res.body.download_token);
  const dl = await invoke(download, 'GET', { query: { token: res.body.download_token } });
  assert.strictEqual(dl.statusCode, 200);
  assert.strictEqual(dl.headers['content-type'], 'application/zip');
  const bytes = Buffer.concat(dl.chunks);
  assert.ok(bytes.length > 0);

  console.log('PASS ecpay-aio-wallpaper');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
