const {
  parseJsonBody, verifyOrderToken, readOrderState, getSkuRecord,
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
    const record = getSkuRecord(order.sku);
    if (!record || !record.files || record.files.length !== 4) {
      return res.status(409).json({ error: 'FULFILLMENT_MANIFEST_UNRESOLVED' });
    }
    if (!privateBlobReady()) return res.status(503).json({ error: 'PRIVATE_STORAGE_NOT_READY' });

    const state = await readOrderState(order.merchant_trade_no);
    if (!state || !state.paid_verified) return res.status(402).json({ error: 'PAYMENT_NOT_VERIFIED' });
    const stateFiles = Array.isArray(state.files) ? state.files : [];
    const filesMatch = record.files.every((file) => stateFiles.some((saved) =>
      saved.sku === file.sku && saved.filename === file.filename && saved.sha256 === file.sha256
    ));
    if (state.sku !== order.sku ||
        state.asset_manifest_id !== record.asset_manifest_id ||
        !filesMatch) {
      return res.status(409).json({ error: 'ENTITLEMENT_ASSET_MISMATCH' });
    }

    const downloads = [];
    for (const file of record.files) {
      const blob = await headPrivateAsset(file.sku);
      if (!blob || !blob.meta) return res.status(503).json({ error: 'PRIVATE_ASSET_NOT_READY' });
      const downloadToken = signDownloadToken({
        order_id: order.order_id,
        sku: file.sku,
        filename: file.filename,
        sha256: file.sha256,
      });
      downloads.push({
        sku: file.sku,
        filename: file.filename,
        sha256: file.sha256,
        download_token: downloadToken,
        download_url: `/api/download?token=${encodeURIComponent(downloadToken)}`,
      });
    }
    return res.status(200).json({
      order_id: order.order_id,
      sku: order.sku,
      public_name: record.public_name,
      asset_manifest_id: record.asset_manifest_id,
      expires_in_seconds: 300,
      downloads,
    });
  } catch (error) {
    console.error('Download token error', error && error.message);
    return res.status(400).json({ error: 'INVALID_DOWNLOAD_REQUEST' });
  }
};
