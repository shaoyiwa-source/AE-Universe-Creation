const { parseJsonBody, getSkuRecord } = require('../payment/ecpay-v2/_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const body = parseJsonBody(req);
  const record = getSkuRecord(body.sku);
  if (!record) return res.status(400).json({ error: 'UNKNOWN_SKU' });
  // Hard fail-closed until 008 publishes an authoritative asset_manifest_id for this SKU.
  return res.status(409).json({
    error: 'FULFILLMENT_MANIFEST_UNRESOLVED',
    sku: record.sku,
    entitlement_created: false,
    download_token: null,
  });
};
