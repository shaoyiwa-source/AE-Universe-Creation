const { parseJsonBody, verifyOrderToken, readOrderState, privateBlobReady } = require('../payment/ecpay-v2/_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const body = parseJsonBody(req);
    const order = verifyOrderToken(body.order_token);
    if (!privateBlobReady()) {
      return res.status(503).json({
        order_id: order.order_id,
        sku: order.sku,
        status: 'PRIVATE_STORAGE_NOT_READY',
        paid_verified: false,
      });
    }
    const state = await readOrderState(order.merchant_trade_no);
    if (!state) {
      return res.status(200).json({
        order_id: order.order_id,
        sku: order.sku,
        status: 'PAYMENT_PENDING',
        paid_verified: false,
      });
    }
    if (state.sku !== order.sku || state.amount !== order.amount || state.currency !== order.currency) {
      return res.status(409).json({ error: 'ORDER_STATE_MISMATCH' });
    }
    return res.status(200).json({
      order_id: order.order_id,
      sku: order.sku,
      status: state.paid_verified ? 'PAID_VERIFIED' : 'PAYMENT_PENDING',
      paid_verified: Boolean(state.paid_verified),
      asset_manifest_id: state.asset_manifest_id || null,
    });
  } catch (error) {
    console.error('Order status error', error && error.message);
    return res.status(400).json({ error: 'INVALID_OR_EXPIRED_ORDER' });
  }
};
