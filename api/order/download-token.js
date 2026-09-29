const {
  parseJsonBody, verifyOrderToken, readOrderState, getAssetRecord,
  headPrivateAsset, signDownloadToken, privateBlobReady,
} = require('../payment/ecpay-v2/_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const body = parseJsonBody(req);
    const order = verifyOrderToken(body.order_token);
    const record = getAssetRecord(order.sku);
    if (!record) return res.status(409).json({ error: 'FULFILLMENT_MANIFEST_UNRESOLVED' });
    if (!privateBlobReady()) return res.status(503).json({ error: 'PRIVATE_STORAGE_NOT_READY' });

    const state = await readOrderState(order.merchant_trade_no);
    if (!state || !state.paid_verified) return res.status(402).json({ error: 'PAYMENT_NOT_VERIFIED' });
    if (state.sku !== order.sku ||
        state.asset_manifest_id !== record.asset_manifest_id ||
        state.filename !== record.filename ||
        state.sha256 !== record.sha256) {
      return res.status(409).json({ error: 'ENTITLEMENT_ASSET_MISMATCH' });
    }

    const blob = await headPrivateAsset(order.sku);
    if (!blob || !blob.meta) return res.status(503).json({ error: 'PRIVATE_ASSET_NOT_READY' });

    const downloadToken = signDownloadToken({
      order_id: order.order_id,
      sku: order.sku,
      filename: record.filename,
      sha256: record.sha256,
    });
    return res.status(200).json({
      order_id: order.order_id,
      sku: order.sku,
      asset_manifest_id: record.asset_manifest_id,
      filename: record.filename,
      sha256: record.sha256,
      download_token: downloadToken,
      expires_in_seconds: 300,
      download_url: `/api/download?token=${encodeURIComponent(downloadToken)}`,
    });
  } catch (error) {
    console.error('Download token error', error && error.message);
    return res.status(400).json({ error: 'INVALID_DOWNLOAD_REQUEST' });
  }
};
