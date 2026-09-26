const { verifyDownloadToken, getAssetRecord, getPrivateAsset } = require('./payment/ecpay-v2/_lib');

function asciiFilename(value) {
  return String(value || 'download.heic').replace(/[^A-Za-z0-9._-]/g, '_');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method Not Allowed');
  }
  try {
    const token = String(req.query && req.query.token || '');
    const entitlement = verifyDownloadToken(token);
    const record = getAssetRecord(entitlement.sku);
    if (!record ||
        entitlement.filename !== record.filename ||
        entitlement.sha256 !== record.sha256) {
      return res.status(403).send('Entitlement mismatch');
    }

    const payload = await getPrivateAsset(entitlement.sku);
    if (!payload) return res.status(503).send('Private asset unavailable');

    res.setHeader('Content-Type', 'image/heic');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename(record.filename)}"; filename*=UTF-8''${encodeURIComponent(record.filename)}`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-AE-Asset-Manifest', record.asset_manifest_id);
    res.setHeader('X-AE-Asset-SHA256', record.sha256);

    const reader = payload.result.stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    return res.end();
  } catch (error) {
    console.error('Private download error', error && error.message);
    return res.status(403).send('Invalid or expired download token');
  }
};
