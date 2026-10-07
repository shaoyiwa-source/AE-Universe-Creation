const {
  PROVIDER, GET_TOKEN_URL, getCredentials, getSkuRecord, makeOrderEnvelope, makeCartEnvelope,
  formatTaipeiDate, getBaseUrl, parseJsonBody, postEncrypted,
} = require('../payment/ecpay-v2/_lib');

function publicPaymentFields() {
  return {
    ChoosePaymentList: '3,4,5',
    ATMInfo: { ExpireDate: 3 },
    CVSInfo: { StoreExpireDate: 10080, CVSCode: 'CVS' },
    BarcodeInfo: { StoreExpireDate: 7 },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const body = parseJsonBody(req);
    const email = String(body.email || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'VALID_EMAIL_REQUIRED' });
    const cartRequest = Array.isArray(body.items);
    let order;
    let orderToken;
    let record;
    let paymentFields;
    try {
      if (cartRequest) {
        const envelope = makeCartEnvelope(body.items);
        order = envelope.order;
        orderToken = envelope.orderToken;
        record = envelope.skuRecord;
        paymentFields = publicPaymentFields();
      } else {
        record = getSkuRecord(body.sku);
        if (!record || !record.active) return res.status(400).json({ error: 'UNKNOWN_SKU' });
        const envelope = makeOrderEnvelope(record.sku);
        order = envelope.order;
        orderToken = envelope.orderToken;
        paymentFields = {
          ChoosePaymentList: '1',
          CardInfo: {
            OrderResultURL: '',
            CreditInstallment: '',
          },
        };
      }
    } catch (error) {
      const code = error && (error.code === 'UNKNOWN_SKU' || error.code === 'EMPTY_CART' || error.code === 'INVALID_QTY' || error.code === 'DUPLICATE_SKU')
        ? error.code
        : 'UNKNOWN_SKU';
      return res.status(400).json({ error: code });
    }

    const baseUrl = getBaseUrl(req);
    if (!baseUrl.startsWith('https://')) return res.status(500).json({ error: 'HTTPS_REQUIRED' });
    if (paymentFields.CardInfo) {
      paymentFields.CardInfo.OrderResultURL = `${baseUrl}/api/payment/ecpay-v2/order-result`;
    }
    const { merchantID } = getCredentials();
    const payload = {
      PlatformID: '',
      MerchantID: merchantID,
      RememberCard: 0,
      PaymentUIType: 2,
      ...paymentFields,
      OrderInfo: {
        MerchantTradeNo: order.merchant_trade_no,
        MerchantTradeDate: formatTaipeiDate(),
        TotalAmount: order.amount,
        ReturnURL: `${baseUrl}/api/payment/ecpay-v2/return`,
        TradeDesc: cartRequest ? 'AE Universe Creation' : 'AE Eternal Sun Stage Checkout',
        ItemName: record.public_name,
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
      order: {
        id: order.order_id,
        sku: order.sku,
        amount: order.amount,
        currency: order.currency,
        total_label: `NT$${order.amount}`,
        lines: record.lines || [{ sku: order.sku, qty: 1, unit: order.amount }],
      },
      fulfillment_enabled: Boolean(record.asset_manifest_id),
      fulfillment_reason: record.asset_manifest_id ? 'BUYER_PACKAGE_MAPPED_PRIVATE_STORAGE_REQUIRED' : 'ASSET_MANIFEST_UNRESOLVED',
      asset_manifest_id: record.asset_manifest_id,
    });
  } catch (error) {
    console.error('Stage checkout token error', error && error.message);
    return res.status(500).json({ error: 'STAGE_CHECKOUT_ERROR' });
  }
};
