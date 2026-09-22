const {
  createCheckMacValue,
  timingSafeEqualHex,
  parseRequestBody,
} = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const body = parseRequestBody(req);
  const received = String(body.CheckMacValue || '').toUpperCase();
  if (!received) return res.status(400).send('0|Missing CheckMacValue');

  const hashKey = process.env.ECPAY_HASH_KEY || 'ejCk326UnaZWKisg';
  const hashIV = process.env.ECPAY_HASH_IV || 'q9jcZX8Ib9LM8wYk';
  const expected = createCheckMacValue(body, hashKey, hashIV);

  if (!timingSafeEqualHex(received, expected)) {
    console.error('ECPay callback rejected: invalid CheckMacValue');
    return res.status(400).send('0|Invalid CheckMacValue');
  }

  const stage = (process.env.ECPAY_MODE || 'stage') === 'stage';
  const summary = {
    stage,
    merchantTradeNo: body.MerchantTradeNo,
    tradeNo: body.TradeNo,
    rtnCode: body.RtnCode,
    paymentType: body.PaymentType,
    tradeAmt: body.TradeAmt,
    simulatePaid: body.SimulatePaid,
  };
  console.log('ECPay verified callback', summary);

  // Stage-only integration: verify and acknowledge; do NOT grant download entitlement yet.
  // SimulatePaid=1 is explicitly not a real production payment.
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send('1|OK');
};
