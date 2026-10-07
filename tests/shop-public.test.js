const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.ECPAY_MODE = 'stage';
process.env.AE_STAGE_ORDER_SECRET = 'local-test-secret-only';
process.env.ECPAY_STAGE_TEST_AMOUNT_TWD = '1';

const shop = require('../shop/catalog');
const lib = require('../api/payment/ecpay-v2/_lib');

assert.deepStrictEqual(shop.contacts.map((item) => item.email), [
  'ae.universe88@gmail.com',
  'shaoyiwa@gmail.com',
]);
const contact = shop.contactHtml();
assert.ok(contact.includes('聯絡方式 · Contact'));
assert.ok(contact.includes('ae.universe88@gmail.com'));
assert.ok(contact.includes('shaoyiwa@gmail.com'));
assert.ok(!contact.includes('09'));

assert.deepStrictEqual(shop.products.map((product) => product.sku), ['GRID-HEART', 'GRID-NIGHT', 'ES-4PACK']);
assert.deepStrictEqual(shop.products.map((product) => product.priceTwd), [555, 555, 444]);
assert.strictEqual(shop.formatTwd(555), 'NT$555');
assert.strictEqual(shop.formatTwd(444), 'NT$444');
for (const product of shop.products) {
  const card = shop.productCardHtml(product);
  assert.ok(card.includes('NT$' + product.priceTwd));
  assert.ok(card.includes('新台幣'));
  assert.ok(card.includes('加入購物車 · Add to cart'));
  assert.ok(card.includes('ae.universe88@gmail.com'));
  assert.ok(card.includes('shaoyiwa@gmail.com'));
  assert.ok(!/US\$|USD/.test(card));
  assert.ok(/NT\$\d+/.test(card));
  assert.ok(!/<a[^>]*class="button"[^>]*ko-fi\.com/i.test(card));
  assert.ok(!/<a[^>]*ko-fi\.com[^>]*class="button"/i.test(card));
  assert.ok(card.includes('data-add-sku="' + product.sku + '"'));
  assert.ok(card.includes('href="checkout.html"'));
  if (product.kofi) assert.ok(card.includes('Ko-fi 備用結帳'));
}
assert.strictEqual(shop.productBySku('ES-ORIGINAL'), null);
assert.throws(() => shop.quoteLines([{ sku: 'ES-ORIGINAL', qty: 1 }]), /UNKNOWN_SKU/);

const mixed = shop.quoteLines([
  { sku: 'GRID-HEART', qty: 1 },
  { sku: 'ES-4PACK', qty: 1 },
]);
assert.strictEqual(mixed.amount, 999);
assert.strictEqual(mixed.label, 'NT$999');
assert.strictEqual(mixed.currency, 'TWD');

assert.strictEqual(lib.getSkuRecord('GRID-HEART').amount, 555);
assert.strictEqual(lib.getSkuRecord('GRID-NIGHT').amount, 555);
assert.strictEqual(lib.getSkuRecord('ES-4PACK').amount, 444);
assert.strictEqual(lib.getSkuRecord('ES-4PACK').currency, 'TWD');
assert.strictEqual(lib.getSkuRecord('ES-PHONE').amount, 1);
assert.strictEqual(lib.getSkuRecord('ES-4PACK').asset_manifest_id, null);
assert.strictEqual(lib.getSkuRecord('CART'), null);

const envelope = lib.makeCartEnvelope([
  { sku: 'GRID-NIGHT', qty: 2 },
  { sku: 'ES-4PACK', qty: 1 },
]);
assert.strictEqual(envelope.order.amount, 555 * 2 + 444);
assert.strictEqual(envelope.order.currency, 'TWD');
assert.strictEqual(lib.amountFromCartTradeNo(envelope.order.merchant_trade_no), envelope.order.amount);
assert.strictEqual(lib.verifyOrderToken(envelope.orderToken).amount, envelope.order.amount);
const paid = lib.validateCallbackData({
  RtnCode: 1,
  MerchantID: '3002607',
  SimulatePaid: 0,
  OrderInfo: {
    MerchantTradeNo: envelope.order.merchant_trade_no,
    TradeAmt: envelope.order.amount,
    TradeStatus: '1',
  },
});
assert.strictEqual(paid.paidVerified, true);
assert.strictEqual(paid.sku, 'CART');
assert.strictEqual(lib.validateCallbackData({
  RtnCode: 1,
  MerchantID: '3002607',
  SimulatePaid: 0,
  OrderInfo: {
    MerchantTradeNo: envelope.order.merchant_trade_no,
    TradeAmt: 1,
    TradeStatus: '1',
  },
}).reason, 'AMOUNT_MISMATCH');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}
const eternal = read('eternal-sun.html');
assert.ok(eternal.includes('NT$444'));
assert.ok(eternal.includes('新台幣'));
assert.ok(!eternal.includes('US$'));
assert.ok(eternal.includes('data-add-sku="ES-4PACK"'));
assert.ok(eternal.includes('Ko-fi 備用結帳'));
assert.ok(!/class="button"[^>]*ko-fi\.com/.test(eternal));
assert.ok(!eternal.includes('ES-ORIGINAL'));

const shopPage = read('shop.html');
assert.ok(shopPage.includes('shop/catalog.js'));
assert.ok(shopPage.includes('data-ae-contact'));
assert.ok(!shopPage.includes('ko-fi.com/s/'));
assert.ok(!shopPage.includes('ES-ORIGINAL'));

const checkout = read('checkout.html');
assert.ok(checkout.includes('id="checkout-form"'));
assert.ok(checkout.includes('結帳 · Checkout'));
assert.ok(checkout.includes('data-ae-contact'));
assert.ok(!/class="button"[^>]*ko-fi\.com/.test(checkout));

const vercel = read('vercel.json');
assert.ok(vercel.includes('"/checkout"'));
assert.ok(vercel.includes('"/checkout.html"'));

console.log('PASS public shop NT$ cart catalog');
