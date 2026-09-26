const {
  decodeEnvelope, parseJsonBody, validateCallbackData, queryOrder, validateQueryData,
  getAssetRecord, writeOrderState, privateBlobReady,
} = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('0|METHOD_NOT_ALLOWED');
  }
  try {
    const outer = parseJsonBody(req);
    const callback = decodeEnvelope(outer);
    const initial = validateCallbackData(callback);
    let finalState = { paidVerified: false, reason: initial.reason };

    if (initial.paidVerified) {
      try {
        const query = await queryOrder(initial.merchantTradeNo);
        const confirmed = validateQueryData(query.data, initial);
        finalState = confirmed.paidVerified
          ? { paidVerified: true, reason: 'PAID_VERIFIED', sku: initial.sku, merchantTradeNo: initial.merchantTradeNo }
          : confirmed;
      } catch (queryError) {
        finalState = { paidVerified: false, reason: 'QUERY_RECONCILIATION_FAILED' };
      }
    }

    let fulfillment = 'DENIED_PAYMENT_NOT_VERIFIED';
    if (finalState.paidVerified) {
      const asset = getAssetRecord(finalState.sku);
      if (!asset) {
        fulfillment = 'DENIED_ASSET_MANIFEST_UNRESOLVED';
      } else if (!privateBlobReady()) {
        fulfillment = 'DENIED_PRIVATE_STORAGE_NOT_READY';
      } else {
        await writeOrderState({
          v: 1,
          provider: 'ecpay_stage_embedded_v2',
          merchantTradeNo: finalState.merchantTradeNo,
          sku: finalState.sku,
          asset_manifest_id: asset.asset_manifest_id,
          filename: asset.filename,
          sha256: asset.sha256,
          amount: initial.record.amount,
          currency: initial.record.currency,
          paid_verified: true,
          verified_at: Date.now(),
          provider_trade_no: callback.TradeNo || null,
        });
        fulfillment = 'ORDER_STATE_PERSISTED_PRIVATE';
      }
    }
    console.log('ECPay Stage ReturnURL', {
      provider: 'ecpay_stage_embedded_v2',
      ...finalState,
      fulfillment,
    });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send('1|OK');
  } catch (error) {
    console.error('ECPay ReturnURL rejected', error && error.message);
    // Acknowledge receipt to prevent retry storms; fulfillment remains fail-closed because verification failed.
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send('1|OK');
  }
};
