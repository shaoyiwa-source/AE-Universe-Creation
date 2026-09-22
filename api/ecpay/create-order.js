const {
  createCheckMacValue,
  parseRequestBody,
  formatTaipeiDate,
  makeMerchantTradeNo,
  getBaseUrl,
  autoSubmitForm,
} = require('./_lib');

const STAGE_ENDPOINT = 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const mode = process.env.ECPAY_MODE || 'stage';
  if (mode !== 'stage') return res.status(503).send('Production checkout is not enabled.');

  const body = parseRequestBody(req);
  const productId = String(body.productId || 'pack-a-color-universe-9');
  if (productId !== 'pack-a-color-universe-9') return res.status(400).send('Unknown product.');

  // Stage fixture only. Final production price must be explicitly configured later.
  const amount = Number.parseInt(process.env.ECPAY_STAGE_TEST_AMOUNT_TWD || '1', 10);
  if (!Number.isInteger(amount) || amount < 1) return res.status(500).send('Invalid stage test amount.');

  const merchantID = process.env.ECPAY_MERCHANT_ID || '2000132';
  const hashKey = process.env.ECPAY_HASH_KEY || 'ejCk326UnaZWKisg';
  const hashIV = process.env.ECPAY_HASH_IV || 'q9jcZX8Ib9LM8wYk';

  const baseUrl = getBaseUrl(req);
  const returnURL = process.env.ECPAY_RETURN_URL || `${baseUrl}/api/ecpay/return`;
  const clientBackURL = process.env.ECPAY_CLIENT_BACK_URL || `${baseUrl}/ecpay-result.html?stage=1`;
  if (!returnURL.startsWith('https://')) return res.status(500).send('ECPAY_RETURN_URL must be HTTPS.');

  const fields = {
    MerchantID: merchantID,
    MerchantTradeNo: makeMerchantTradeNo(),
    MerchantTradeDate: formatTaipeiDate(),
    PaymentType: 'aio',
    TotalAmount: amount,
    TradeDesc: 'AE Color Universe 9 Fragments Stage Test',
    ItemName: 'AE Color Universe 9 Fragments',
    ReturnURL: returnURL,
    ChoosePayment: 'ALL',
    EncryptType: 1,
    ClientBackURL: clientBackURL,
  };
  fields.CheckMacValue = createCheckMacValue(fields, hashKey, hashIV);

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(autoSubmitForm(STAGE_ENDPOINT, fields));
};
