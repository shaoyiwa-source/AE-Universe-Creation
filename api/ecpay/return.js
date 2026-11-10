'use strict';

const { paymentClosedResponse } = require('../_payment-gate');
const { getWallpaperSku, skuFromWallpaperTradeNo } = require('../_wallpaper-catalog');
const {
  createCheckMacValue,
  timingSafeEqualHex,
  parseRequestBody,
  getAioCredentials,
} = require('./_lib');
const { privateBlobReady, readOrderState, writeOrderState } = require('../payment/ecpay-v2/_lib');

async function persistPaid(state) {
  if (!privateBlobReady()) {
    const err = new Error('Private Blob store is not configured.');
    err.code = 'PRIVATE_STORAGE_NOT_READY';
    throw err;
  }
  const existing = await readOrderState(state.merchantTradeNo);
  if (existing && existing.paid_verified) {
    if (existing.sku !== state.sku || Number(existing.amount) !== Number(state.amount)) {
      const err = new Error('Paid order mismatch on replay.');
      err.code = 'ORDER_REPLAY_MISMATCH';
      throw err;
    }
    return { idempotent: true, existing };
  }
  await writeOrderState(state);
  return { idempotent: false };
}

module.exports = async function handler(req, res) {
  if (paymentClosedResponse(res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('0|METHOD_NOT_ALLOWED');
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');

  let creds;
  try {
    creds = getAioCredentials();
  } catch (_) {
    return res.status(403).send('0|PAYMENT_NOT_ENABLED');
  }

  const body = parseRequestBody(req);
  const received = String(body.CheckMacValue || '').toUpperCase();
  if (!received) return res.status(400).send('0|Missing CheckMacValue');

  const expected = createCheckMacValue(body, creds.hashKey, creds.hashIV);
  if (!timingSafeEqualHex(received, expected)) {
    console.error('ECPay AIO ReturnURL rejected: invalid CheckMacValue');
    return res.status(400).send('0|Invalid CheckMacValue');
  }

  if (String(body.MerchantID || '') !== creds.merchantID) {
    return res.status(400).send('0|Merchant mismatch');
  }

  const merchantTradeNo = String(body.MerchantTradeNo || '');
  const sku = skuFromWallpaperTradeNo(merchantTradeNo) || String(body.CustomField1 || '').toUpperCase();
  const record = getWallpaperSku(sku);
  if (!record || !record.fulfillment_enabled) {
    console.error('ECPay AIO ReturnURL unknown SKU', { merchantTradeNo });
    return res.status(200).send('1|OK');
  }

  const tradeAmt = Number.parseInt(String(body.TradeAmt || ''), 10);
  const amountOk = tradeAmt === record.amount;
  const success = String(body.RtnCode) === '1';
  const simulated = String(body.SimulatePaid || '0') === '1';

  if (!success || !amountOk || simulated) {
    console.log('ECPay AIO ReturnURL not fulfilled', {
      merchantTradeNo,
      sku: record.sku,
      rtnCode: body.RtnCode,
      tradeAmt,
      expected: record.amount,
      simulated,
    });
    return res.status(200).send('1|OK');
  }

  if (privateBlobReady()) {
    try {
      const stored = await readOrderState(merchantTradeNo);
      if (stored && (stored.sku !== record.sku || Number(stored.amount) !== record.amount)) {
        console.error('ECPay AIO ReturnURL order mismatch', { merchantTradeNo });
        return res.status(200).send('1|OK');
      }
      const result = await persistPaid({
        v: 1,
        provider: 'ecpay_aio',
        environment: creds.mode,
        merchantTradeNo,
        sku: record.sku,
        asset_manifest_id: record.asset.asset_manifest_id,
        filename: record.asset.filename,
        sha256: record.asset.sha256,
        amount: record.amount,
        currency: 'TWD',
        paid_verified: true,
        verified_at: (stored && stored.verified_at) || Date.now(),
        created_at: (stored && stored.created_at) || Date.now(),
        provider_trade_no: body.TradeNo || null,
        rtn_msg: body.RtnMsg || null,
      });
      console.log('ECPay AIO ReturnURL paid', {
        merchantTradeNo,
        sku: record.sku,
        idempotent: result.idempotent,
      });
    } catch (error) {
      console.error('ECPay AIO ReturnURL persist failed', error && error.code);
      return res.status(500).send('0|STORAGE');
    }
  } else {
    console.error('ECPay AIO ReturnURL storage not ready', { merchantTradeNo });
    return res.status(500).send('0|STORAGE');
  }

  return res.status(200).send('1|OK');
};
