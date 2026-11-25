const assert = require('assert');
const { createCheckMacValue } = require('../api/ecpay/_lib');

const params = {
  TradeDesc: '促銷方案',
  PaymentType: 'aio',
  MerchantTradeDate: '2023/03/12 15:30:23',
  MerchantTradeNo: 'ecpay20230312153023',
  MerchantID: '3002607',
  ReturnURL: 'https://www.ecpay.com.tw/receive.php',
  ItemName: 'Apple iphone 15',
  TotalAmount: '30000',
  ChoosePayment: 'ALL',
  EncryptType: '1',
};

const actual = createCheckMacValue(params, 'pwFHCqoQZGmho4w6', 'EkRm7iFT261dpevs');
const expected = '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840';
assert.strictEqual(actual, expected);
console.log('PASS ECPay official CheckMacValue vector:', actual);
