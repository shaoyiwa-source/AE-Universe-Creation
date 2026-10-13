const {
  PROVIDER, CREATE_PAYMENT_URL, getCredentials, parseJsonBody, postEncrypted, verifyOrderToken,
} = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const body = parseJsonBody(req);
    const payToken = String(body.pay_token || body.PayToken || '');
    if (!payToken || payToken.length > 128) return res.status(400).json({ error: 'PAY_TOKEN_REQUIRED' });
    const order = verifyOrderToken(body.order_token);
    const { merchantID } = getCredentials();
    const result = await postEncrypted(CREATE_PAYMENT_URL, {
      PlatformID: '',
      MerchantID: merchantID,
      PayToken: payToken,
      MerchantTradeNo: order.merchant_trade_no,
    });
    const d = result.data || {};
    if (Number(d.RtnCode) !== 1) {
      return res.status(402).json({ error: 'ECPAY_CREATE_PAYMENT_FAILED', provider_code: d.RtnCode, provider_message: d.RtnMsg || '' });
    }
    const paymentInfo = {
      payment_type: d.PaymentType || null,
      bank_code: d.BankCode || d.ATMBankCode || null,
      virtual_account: d.vAccount || d.VAccount || null,
      payment_no: d.PaymentNo || null,
      expire_date: d.ExpireDate || null,
      barcode1: d.Barcode1 || null,
      barcode2: d.Barcode2 || null,
      barcode3: d.Barcode3 || null,
      message: d.RtnMsg || null,
    };
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      provider: PROVIDER,
      environment: 'stage',
      order_id: order.order_id,
      status: 'PAYMENT_PENDING',
      three_d_url: d.ThreeDURL || null,
      union_pay_url: d.UnionPayURL || null,
      payment_type: d.PaymentType || null,
      payment_info: paymentInfo,
      fulfillment_enabled: Boolean(order.sku && order.sku !== 'CART'),
    });
  } catch (error) {
    console.error('ECPay CreatePayment error', error && error.message);
    return res.status(400).json({ error: 'INVALID_OR_EXPIRED_ORDER' });
  }
};
