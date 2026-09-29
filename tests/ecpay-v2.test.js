const assert = require('assert');
process.env.ECPAY_MODE = 'stage';
process.env.AE_STAGE_ORDER_SECRET = 'local-test-secret-only';
const lib = require('../api/payment/ecpay-v2/_lib');

const expectedAssets = {
  'ES-ORIGINAL': ['IMG_3497.heic','2d9ed50275218ddfac57788510fc6d99b2905d7ae9674b99c40fc1bd7340d09e',4579084],
  'ES-GALLERY': ['IMG_3497 3.heic','ee5e4c8bd1e0131831e231f19e9bc29ef464a8c5b8abd43cea5f114b4e5120d2',2029109],
  'ES-PHONE': ['IMG_3497 4.heic','bd4bef3d724754fd9ebf4128eac6e796a46bf09e3cb6807dc75fee94f7d70e49',1836236],
  'ES-SQUARE': ['IMG_3497 2.heic','04ff2a0b1cf4998915fff1ed80c69a714b45abef1d8c2540eedaf6340f2b0de7',2018837],
};

// Official ECPay Embedded Checkout AES vector (uppercase URL encoding).
const cipher = lib.encryptData({Name:'Test',ID:'A123456789'}, 'pwFHCqoQZGmho4w6', 'EkRm7iFT261dpevs');
assert.strictEqual(cipher, 'o4TJSHkQBM1bogbn5BNFRofCVTfsQjoqv/TX8DKn757fe5AoYzoalYmrMsGXTiwxGpI8NsE2vu4tScAwISx8kw==');
assert.deepStrictEqual(lib.decryptData(cipher, 'pwFHCqoQZGmho4w6', 'EkRm7iFT261dpevs'), {Name:'Test',ID:'A123456789'});

for (const sku of Object.keys(expectedAssets)) {
  const {order, orderToken, skuRecord} = lib.makeOrderEnvelope(sku);
  assert.strictEqual(lib.skuFromMerchantTradeNo(order.merchant_trade_no), sku);
  assert.strictEqual(lib.verifyOrderToken(orderToken).sku, sku);
  assert.strictEqual(skuRecord.asset_manifest_id, 'ES-ETERNAL-SUN-BUYER-PACK-V1');
  assert.strictEqual(skuRecord.fulfillment_enabled, true);
  assert.deepStrictEqual(
    [skuRecord.asset.filename, skuRecord.asset.sha256, skuRecord.asset.size],
    expectedAssets[sku]
  );

  const cb = lib.validateCallbackData({
    RtnCode:1,MerchantID:'3002607',SimulatePaid:0,
    OrderInfo:{MerchantTradeNo:order.merchant_trade_no,TradeAmt:skuRecord.amount,TradeStatus:'1'}
  });
  assert.strictEqual(cb.paidVerified,true);
  assert.strictEqual(cb.sku,sku);
  assert.strictEqual(
    lib.validateQueryData({
      RtnCode:1,
      OrderInfo:{MerchantTradeNo:order.merchant_trade_no,TradeAmt:skuRecord.amount,TradeStatus:'1'}
    },cb).paidVerified,
    true
  );

  const asset = lib.getAssetRecord(sku);
  const token = lib.signDownloadToken({
    order_id: order.order_id,
    sku,
    filename: asset.filename,
    sha256: asset.sha256,
  });
  const decoded = lib.verifyDownloadToken(token);
  assert.strictEqual(decoded.sku, sku);
  assert.strictEqual(decoded.filename, asset.filename);
  assert.strictEqual(decoded.sha256, asset.sha256);
}

const {order:o} = lib.makeOrderEnvelope('ES-PHONE');
assert.strictEqual(lib.validateCallbackData({RtnCode:1,MerchantID:'3002607',SimulatePaid:1,OrderInfo:{MerchantTradeNo:o.merchant_trade_no,TradeAmt:1,TradeStatus:'1'}}).paidVerified,false);
assert.strictEqual(lib.validateCallbackData({RtnCode:1,MerchantID:'3002607',SimulatePaid:0,OrderInfo:{MerchantTradeNo:o.merchant_trade_no,TradeAmt:999,TradeStatus:'1'}}).reason,'AMOUNT_MISMATCH');
assert.strictEqual(lib.validateCallbackData({RtnCode:1,MerchantID:'3002607',SimulatePaid:0,OrderInfo:{MerchantTradeNo:o.merchant_trade_no,TradeAmt:1,TradeStatus:'0'}}).reason,'CALLBACK_NOT_PAID');

const phone = lib.getAssetRecord('ES-PHONE');
let crossToken = lib.signDownloadToken({order_id:'X',sku:'ES-PHONE',filename:phone.filename,sha256:phone.sha256});
const [payload,sig] = crossToken.split('.');
const body = JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
body.sku='ES-SQUARE';
const tampered = Buffer.from(JSON.stringify(body),'utf8').toString('base64url')+'.'+sig;
assert.throws(()=>lib.verifyDownloadToken(tampered));

console.log('PASS ECPay Embedded Checkout 2.0 Stage + buyer-manifest unit gates');
