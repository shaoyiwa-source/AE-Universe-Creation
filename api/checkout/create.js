const {
  PROVIDER, GET_TOKEN_URL, getCredentials, getSkuRecord, makeOrderEnvelope,
  formatTaipeiDate, getBaseUrl, parseJsonBody, postEncrypted,
} = require('../payment/ecpay-v2/_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const body = parseJsonBody(req);
    const record = getSkuRecord(body.sku);
    if (!record || !record.active) return res.status(400).json({ error: 'UNKNOWN_SKU' });
    const email = String(body.email || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'VALID_EMAIL_REQUIRED' });

    const baseUrl = getBaseUrl(req);
    if (!baseUrl.startsWith('https://')) return res.status(500).json({ error: 'HTTPS_REQUIRED' });
    const { merchantID } = getCredentials();
    const { order, orderToken } = makeOrderEnvelope(record.sku);
    const payload = {
      PlatformID: '',
      MerchantID: merchantID,
      RememberCard: 0,
      PaymentUIType: 2,
      ChoosePaymentList: '1',
      OrderInfo: {
        MerchantTradeNo: order.merchant_trade_no,
        MerchantTradeDate: formatTaipeiDate(),
        TotalAmount: order.amount,
        ReturnURL: `${baseUrl}/api/payment/ecpay-v2/return`,
        TradeDesc: 'AE Eternal Sun Stage Checkout',
        ItemName: record.public_name,
      },
      CardInfo: {
        OrderResultURL: `${baseUrl}/api/payment/ecpay-v2/order-result`,
        CreditInstallment: '',
      },
      ConsumerInfo: { Email: email },
    };

    const result = await postEncrypted(GET_TOKEN_URL, payload);
    if (Number(result.data.RtnCode) !== 1 || !result.data.Token) {
      console.error('ECPay GetToken failed', { RtnCode: result.data.RtnCode, RtnMsg: result.data.RtnMsg });
      return res.status(502).json({ error: 'ECPAY_TOKEN_FAILED', provider_code: result.data.RtnCode });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      provider: PROVIDER,
      environment: 'stage',
      sdk_version: 'V2',
      token: result.data.Token,
      token_expires_at: result.data.TokenExpireDate || null,
      order_token: orderToken,
      order: { id: order.order_id, sku: order.sku, amount: order.amount, currency: order.currency },
      fulfillment_enabled: false,
      fulfillment_reason: 'ASSET_MANIFEST_UNRESOLVED',
    });
  } catch (error) {
    console.error('Stage checkout token error', error && error.message);
    return res.status(500).json({ error: 'STAGE_CHECKOUT_ERROR' });
  }
};
