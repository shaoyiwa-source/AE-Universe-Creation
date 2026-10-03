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

const {order, orderToken, skuRecord} = lib.makeOrderEnvelope('ES-PACK', {name:'王義軒',email:'buyer@example.com',phone:'0912345678'});
assert.strictEqual(skuRecord.public_name, 'Eternal Sun｜盛明四張組');
assert.strictEqual(lib.PACK_NAME, 'Eternal Sun｜盛明四張組');
assert.strictEqual(lib.skuFromMerchantTradeNo(order.merchant_trade_no), 'ES-PACK');
assert.strictEqual(lib.skuFromMerchantTradeNo('AE3ABCDEF'), null);
assert.strictEqual(lib.verifyOrderToken(orderToken).sku, 'ES-PACK');
assert.strictEqual(lib.verifyOrderToken(orderToken).buyer.email, 'buyer@example.com');
assert.strictEqual(lib.verifyOrderToken(orderToken).list_price, 444);
assert.strictEqual(skuRecord.asset_manifest_id, 'ES-ETERNAL-SUN-BUYER-PACK-V1');
assert.strictEqual(skuRecord.fulfillment_enabled, true);
assert.strictEqual(skuRecord.files.length, 4);
assert.deepStrictEqual(skuRecord.files.map((file) => file.sku), Object.keys(expectedAssets));
for (const file of skuRecord.files) {
  assert.deepStrictEqual(
    [file.filename, file.sha256, file.size],
    expectedAssets[file.sku]
  );
  const asset = lib.getAssetRecord(file.sku);
  const token = lib.signDownloadToken({
    order_id: order.order_id,
    sku: file.sku,
    filename: asset.filename,
    sha256: asset.sha256,
  });
  const decoded = lib.verifyDownloadToken(token);
  assert.strictEqual(decoded.sku, file.sku);
  assert.strictEqual(decoded.filename, asset.filename);
  assert.strictEqual(decoded.sha256, asset.sha256);
}
assert.strictEqual(lib.getSkuRecord('ES-PHONE'), null);
assert.strictEqual(lib.getSkuRecord('ES-ORIGINAL'), null);
assert.throws(() => lib.makeOrderEnvelope('ES-PHONE', {name:'王義軒',email:'buyer@example.com',phone:'0912345678'}));

const cb = lib.validateCallbackData({
  RtnCode:1,MerchantID:'3002607',SimulatePaid:0,
  OrderInfo:{MerchantTradeNo:order.merchant_trade_no,TradeAmt:skuRecord.amount,TradeStatus:'1'}
});
assert.strictEqual(cb.paidVerified,true);
assert.strictEqual(cb.sku,'ES-PACK');
assert.strictEqual(
  lib.validateQueryData({
    RtnCode:1,
    OrderInfo:{MerchantTradeNo:order.merchant_trade_no,TradeAmt:skuRecord.amount,TradeStatus:'1'}
  },cb).paidVerified,
  true
);

assert.strictEqual(lib.validateCallbackData({RtnCode:1,MerchantID:'3002607',SimulatePaid:1,OrderInfo:{MerchantTradeNo:order.merchant_trade_no,TradeAmt:1,TradeStatus:'1'}}).paidVerified,false);
assert.strictEqual(lib.validateCallbackData({RtnCode:1,MerchantID:'3002607',SimulatePaid:0,OrderInfo:{MerchantTradeNo:order.merchant_trade_no,TradeAmt:999,TradeStatus:'1'}}).reason,'AMOUNT_MISMATCH');
assert.strictEqual(lib.validateCallbackData({RtnCode:1,MerchantID:'3002607',SimulatePaid:0,OrderInfo:{MerchantTradeNo:order.merchant_trade_no,TradeAmt:order.amount,TradeStatus:'0'}}).reason,'CALLBACK_NOT_PAID');

const phone = lib.getAssetRecord('ES-PHONE');
let crossToken = lib.signDownloadToken({order_id:'X',sku:'ES-PHONE',filename:phone.filename,sha256:phone.sha256});
const [payload,sig] = crossToken.split('.');
const body = JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
body.sku='ES-SQUARE';
const tampered = Buffer.from(JSON.stringify(body),'utf8').toString('base64url')+'.'+sig;
assert.throws(()=>lib.verifyDownloadToken(tampered));


assert.throws(() => lib.makeOrderEnvelope('ES-PACK', {name:'',email:'a@b.co',phone:'0912345678'}));
assert.throws(() => lib.makeOrderEnvelope('ES-PACK', {name:'AE',email:'bad',phone:'0912345678'}));
assert.throws(() => lib.makeOrderEnvelope('ES-PACK', {name:'AE',email:'a@b.co',phone:'123'}));
assert.strictEqual(lib.FORMAL_LIST_PRICE_TWD, 444);

console.log('PASS ECPay Embedded Checkout 2.0 Stage + buyer-manifest unit gates');
