'use strict';

const crypto = require('crypto');
const { paymentClosedResponse } = require('../_payment-gate');
const { getWallpaperSku, makeWallpaperTradeNo } = require('../_wallpaper-catalog');
const {
  createCheckMacValue,
  parseRequestBody,
  formatTaipeiDate,
  getBaseUrl,
  autoSubmitForm,
  getAioCredentials,
} = require('./_lib');
const { privateBlobReady, writeOrderState, signOrder } = require('../payment/ecpay-v2/_lib');

module.exports = async function handler(req, res) {
  if (paymentClosedResponse(res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  let creds;
  try {
    creds = getAioCredentials();
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(403).json({ ok: false, error: 'PAYMENT_NOT_ENABLED' });
  }

  const body = parseRequestBody(req);
  const sku = String(body.sku || body.productId || '').trim().toUpperCase();
  const record = getWallpaperSku(sku);
  if (!record || !record.active) {
    return res.status(400).json({ ok: false, error: 'UNKNOWN_SKU' });
  }
  if (!record.fulfillment_enabled) {
    return res.status(409).json({ ok: false, error: 'FULFILLMENT_NOT_READY', sku: record.sku });
  }

  // Server-side price only. Ignore body.amount / body.price / body.TotalAmount.
  const amount = record.amount;
  const baseUrl = getBaseUrl(req);
  const returnURL = process.env.ECPAY_RETURN_URL || `${baseUrl}/api/ecpay/return`;
  const orderResultURL = process.env.ECPAY_ORDER_RESULT_URL || `${baseUrl}/api/payment/ecpay-v2/order-result`;
  const clientBackURL = process.env.ECPAY_CLIENT_BACK_URL || `${baseUrl}/shop`;
  if (!returnURL.startsWith('https://') || !orderResultURL.startsWith('https://')) {
    return res.status(500).send('ECPay callback URLs must be HTTPS.');
  }

  const merchantTradeNo = makeWallpaperTradeNo(record.sku, crypto);
  const now = Date.now();
  const order = {
    v: 1,
    provider: 'ecpay_aio',
    environment: creds.mode,
    order_id: merchantTradeNo,
    merchant_trade_no: merchantTradeNo,
    sku: record.sku,
    amount,
    currency: 'TWD',
    status: 'CREATED',
    issued: now,
    expires: now + 30 * 60 * 1000,
  };

  if (privateBlobReady()) {
    try {
      await writeOrderState({
        v: 1,
        provider: 'ecpay_aio',
        environment: creds.mode,
        merchantTradeNo,
        sku: record.sku,
        asset_manifest_id: record.asset.asset_manifest_id,
        filename: record.asset.filename,
        sha256: record.asset.sha256,
        amount,
        currency: 'TWD',
        paid_verified: false,
        created_at: now,
      });
    } catch (error) {
      console.error('Order create persist failed', error && error.code);
      return res.status(503).json({ ok: false, error: 'ORDER_PERSIST_FAILED' });
    }
  }

  const fields = {
    MerchantID: creds.merchantID,
    MerchantTradeNo: merchantTradeNo,
    MerchantTradeDate: formatTaipeiDate(),
    PaymentType: 'aio',
    TotalAmount: String(amount),
    TradeDesc: 'AE wallpaper pack',
    ItemName: record.item_name,
    ReturnURL: returnURL,
    OrderResultURL: orderResultURL,
    ClientBackURL: clientBackURL,
    ChoosePayment: 'ALL',
    EncryptType: '1',
    CustomField1: record.sku,
    CustomField2: String(amount),
  };
  fields.CheckMacValue = createCheckMacValue(fields, creds.hashKey, creds.hashIV);

  const accept = String(req.headers.accept || '');
  if (accept.includes('application/json') && !accept.includes('text/html')) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: true,
      mode: creds.mode,
      sku: record.sku,
      amount,
      currency: 'TWD',
      merchant_trade_no: merchantTradeNo,
      order_token: signOrder(order),
      checkout_url: creds.checkoutUrl,
      fields,
    });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(autoSubmitForm(creds.checkoutUrl, fields));
};
