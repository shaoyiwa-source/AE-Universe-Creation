const assert = require('assert');
process.env.ECPAY_MODE = 'stage';
process.env.AE_STAGE_ORDER_SECRET = 'local-test-secret-only';
const lib = require('../api/payment/ecpay-v2/_lib');

// Official ECPay Embedded Checkout AES vector (uppercase URL encoding).
const cipher = lib.encryptData({Name:'Test',ID:'A123456789'}, 'pwFHCqoQZGmho4w6', 'EkRm7iFT261dpevs');
assert.strictEqual(cipher, 'o4TJSHkQBM1bogbn5BNFRofCVTfsQjoqv/TX8DKn757fe5AoYzoalYmrMsGXTiwxGpI8NsE2vu4tScAwISx8kw==');
assert.deepStrictEqual(lib.decryptData(cipher, 'pwFHCqoQZGmho4w6', 'EkRm7iFT261dpevs'), {Name:'Test',ID:'A123456789'});

// Individual Eternal Sun editions stay closed on official-site checkout.
for (const sku of ['ES-ORIGINAL', 'ES-GALLERY', 'ES-PHONE', 'ES-SQUARE']) {
  assert.strictEqual(lib.getSkuRecord(sku), null);
  assert.throws(() => lib.makeOrderEnvelope(sku), /Unknown SKU/);
  const asset = lib.getAssetRecord(sku);
  assert.ok(asset, 'private ES assets remain catalogued for existing storage');
  assert.ok(asset.sha256);
}

const { order, orderToken, skuRecord } = lib.makeOrderEnvelope('WP-VERDANT-GARDEN');
assert.strictEqual(skuRecord.amount, 133);
assert.strictEqual(lib.verifyOrderToken(orderToken).sku, 'WP-VERDANT-GARDEN');
assert.strictEqual(skuRecord.fulfillment_enabled, true);

const asset = lib.getAssetRecord('WP-VERDANT-GARDEN');
const token = lib.signDownloadToken({
  order_id: order.order_id,
  sku: 'WP-VERDANT-GARDEN',
  filename: asset.filename,
  sha256: asset.sha256,
});
const decoded = lib.verifyDownloadToken(token);
assert.strictEqual(decoded.sku, 'WP-VERDANT-GARDEN');
assert.strictEqual(decoded.sha256, asset.sha256);

const [payload, sig] = token.split('.');
const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
body.sku = 'WP-NIGHT-SWIRLS';
const tampered = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url') + '.' + sig;
assert.throws(() => lib.verifyDownloadToken(tampered));

console.log('PASS ECPay v2 helpers + ES SKUs remain unpurchasable');
