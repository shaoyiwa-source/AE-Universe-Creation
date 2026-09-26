const assert = require('assert');
process.env.ECPAY_MODE = 'stage';
const lib = require('../api/payment/ecpay-v2/_lib');

// Official ECPay Embedded Checkout AES vector (uppercase URL encoding).
const cipher = lib.encryptData({Name:'Test',ID:'A123456789'}, 'pwFHCqoQZGmho4w6', 'EkRm7iFT261dpevs');
assert.strictEqual(cipher, 'o4TJSHkQBM1bogbn5BNFRofCVTfsQjoqv/TX8DKn757fe5AoYzoalYmrMsGXTiwxGpI8NsE2vu4tScAwISx8kw==');
assert.deepStrictEqual(lib.decryptData(cipher, 'pwFHCqoQZGmho4w6', 'EkRm7iFT261dpevs'), {Name:'Test',ID:'A123456789'});

for (const sku of ['ES-ORIGINAL','ES-GALLERY','ES-PHONE','ES-SQUARE']) {
  const {order, orderToken, skuRecord} = lib.makeOrderEnvelope(sku);
  assert.strictEqual(lib.skuFromMerchantTradeNo(order.merchant_trade_no), sku);
  assert.strictEqual(lib.verifyOrderToken(orderToken).sku, sku);
  assert.strictEqual(skuRecord.asset_manifest_id, null);
  assert.strictEqual(skuRecord.fulfillment_enabled, false);
  const cb = lib.validateCallbackData({RtnCode:1,MerchantID:'3002607',SimulatePaid:0,OrderInfo:{MerchantTradeNo:order.merchant_trade_no,TradeAmt:skuRecord.amount,TradeStatus:'1'}});
  assert.strictEqual(cb.paidVerified,true);
  assert.strictEqual(cb.sku,sku);
  assert.strictEqual(lib.validateQueryData({RtnCode:1,OrderInfo:{MerchantTradeNo:order.merchant_trade_no,TradeAmt:skuRecord.amount,TradeStatus:'1'}},cb).paidVerified,true);
}

const {order:o} = lib.makeOrderEnvelope('ES-PHONE');
assert.strictEqual(lib.validateCallbackData({RtnCode:1,MerchantID:'3002607',SimulatePaid:1,OrderInfo:{MerchantTradeNo:o.merchant_trade_no,TradeAmt:1,TradeStatus:'1'}}).paidVerified,false);
assert.strictEqual(lib.validateCallbackData({RtnCode:1,MerchantID:'3002607',SimulatePaid:0,OrderInfo:{MerchantTradeNo:o.merchant_trade_no,TradeAmt:999,TradeStatus:'1'}}).reason,'AMOUNT_MISMATCH');
assert.strictEqual(lib.validateCallbackData({RtnCode:1,MerchantID:'3002607',SimulatePaid:0,OrderInfo:{MerchantTradeNo:o.merchant_trade_no,TradeAmt:1,TradeStatus:'0'}}).reason,'CALLBACK_NOT_PAID');
console.log('PASS ECPay Embedded Checkout 2.0 Stage unit gates');
