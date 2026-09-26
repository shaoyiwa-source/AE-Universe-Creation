const {
  decodeEnvelope, parseJsonBody, validateCallbackData, queryOrder, validateQueryData,
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

    // Stage plumbing only. Even PAID_VERIFIED does not create an entitlement while asset_manifest_id is unresolved.
    console.log('ECPay Stage ReturnURL', {
      provider: 'ecpay_stage_embedded_v2',
      ...finalState,
      fulfillment: 'DENIED_ASSET_MANIFEST_UNRESOLVED',
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
