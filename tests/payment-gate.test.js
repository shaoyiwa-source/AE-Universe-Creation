'use strict';
const assert = require('assert');
const fs = require('fs');

const saved = {
  ECPAY_MODE: process.env.ECPAY_MODE,
  VERCEL_ENV: process.env.VERCEL_ENV,
};

function setEnv(vercelEnv, mode) {
  if (vercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = vercelEnv;
  if (mode === undefined) delete process.env.ECPAY_MODE;
  else process.env.ECPAY_MODE = mode;
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    send(payload) { this.body = payload; return this; },
    end(payload) { if (payload !== undefined) this.body = payload; return this; },
  };
}

function textOf(res) {
  if (res.body == null) return '';
  return typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
}

function isClosed(res) {
  const text = textOf(res);
  let parsed = null;
  try { parsed = typeof res.body === 'object' ? res.body : JSON.parse(text); } catch (_) {}
  return res.statusCode === 403
    && parsed
    && parsed.ok === false
    && parsed.error === 'PAYMENT_NOT_ENABLED'
    && !/1\|OK/.test(text)
    && !/ecpay\.com/i.test(text)
    && !/CheckMacValue/i.test(text)
    && !/paid_verified"\s*:\s*true/.test(text)
    && !/download_token/.test(text)
    && !/order_token/.test(text)
    && !/PAYMENT_PENDING/.test(text)
    && !/PAID_VERIFIED/.test(text);
}

const routes = {
  createOrder: () => require('../api/ecpay/create-order'),
  ecpayReturn: () => require('../api/ecpay/return'),
  checkoutCreate: () => require('../api/checkout/create'),
  download: () => require('../api/download'),
  downloadToken: () => require('../api/order/download-token'),
  orderStatus: () => require('../api/order/status'),
  v2Create: () => require('../api/payment/ecpay-v2/create'),
  v2Return: () => require('../api/payment/ecpay-v2/return'),
  orderResult: () => require('../api/payment/ecpay-v2/order-result'),
};

const closedCalls = [
  ['createOrder', 'POST', { body: {} }],
  ['createOrder', 'GET', { body: {} }],
  ['ecpayReturn', 'POST', { body: { CheckMacValue: 'NO', RtnCode: '1' } }],
  ['checkoutCreate', 'POST', { body: { sku: 'ES-PHONE', email: 'qa@example.com' } }],
  ['download', 'GET', { query: { token: 'not-a-token' } }],
  ['download', 'POST', { body: {} }],
  ['downloadToken', 'POST', { body: { order_token: 'x.y' } }],
  ['orderStatus', 'POST', { body: { order_token: 'x.y' } }],
  ['v2Create', 'POST', { body: { pay_token: 'tok', order_token: 'x.y' } }],
  ['v2Return', 'POST', { body: { MerchantID: 'x', TransCode: 1, Data: 'aabb' } }],
  ['orderResult', 'POST', { body: { ResultData: 'paid ok' } }],
  ['orderResult', 'GET', {}],
];

const matrix = [
  ['production-missing', 'production', undefined, false],
  ['production-stage', 'production', 'stage', false],
  ['production-blank', 'production', '  ', false],
  ['production-prod-mode', 'production', 'production', false],
  ['preview-missing', 'preview', undefined, false],
  ['development-missing', 'development', undefined, false],
  ['local-missing', undefined, undefined, false],
  ['preview-production-word', 'preview', 'production', false],
  ['preview-stage', 'preview', 'stage', true],
  ['development-stage', 'development', 'stage', true],
  ['preview-stage-trimmed', 'preview', ' Stage ', true],
  ['local-stage', undefined, 'stage', true],
];

async function invoke(name, method, extra) {
  const handler = routes[name]();
  const res = mockRes();
  const req = {
    method,
    headers: { 'content-type': 'application/json', host: 'qa.local' },
    query: extra.query || {},
    body: extra.body || {},
  };
  await handler(req, res);
  return res;
}

(async () => {
  const fetchCalls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    fetchCalls.push(String(url).slice(0, 80));
    throw new Error('network blocked by payment-gate test');
  };

  const evidence = [];
  let failed = 0;
  try {
    for (const [label, vercelEnv, mode, allow] of matrix) {
      setEnv(vercelEnv, mode);
      const gate = require('../api/_payment-gate');
      delete require.cache[require.resolve('../api/_payment-gate')];
      const live = require('../api/_payment-gate');
      assert.strictEqual(live.stageTestAllowed(), allow, label + ' stageTestAllowed');

      if (!allow) {
        for (const [route, method, extra] of closedCalls) {
          const before = fetchCalls.length;
          const res = await invoke(route, method, extra);
          const row = {
            context: label,
            route,
            method,
            status: res.statusCode,
            error: res.body && res.body.error,
            closed: isClosed(res),
            fetchDelta: fetchCalls.length - before,
          };
          evidence.push(row);
          if (!row.closed || row.fetchDelta !== 0) {
            failed += 1;
            console.error('FAIL', row);
          }
        }
      }
    }

    // Deliberate non-production stage keeps the stage handlers, but these probes
    // stop before trade creation, token issuance, callbacks, and Blob reads.
    setEnv('preview', 'stage');
    const openProbes = [];
    {
      const before = fetchCalls.length;
      const res = await invoke('createOrder', 'POST', { body: {} });
      const text = textOf(res);
      openProbes.push({
        route: 'createOrder',
        status: res.statusCode,
        stageForm: res.statusCode === 200 && /payment-stage\.ecpay\.com\.tw/.test(text) && /<form/i.test(text),
        fetchDelta: fetchCalls.length - before,
      });
      assert.strictEqual(openProbes[0].stageForm, true);
      assert.strictEqual(openProbes[0].fetchDelta, 0);
    }
    {
      const before = fetchCalls.length;
      const res = await invoke('v2Create', 'POST', { body: {} });
      openProbes.push({
        route: 'v2Create-empty',
        status: res.statusCode,
        error: res.body && res.body.error,
        fetchDelta: fetchCalls.length - before,
      });
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.error, 'PAY_TOKEN_REQUIRED');
      assert.strictEqual(fetchCalls.length, before);
    }
    {
      const before = fetchCalls.length;
      const res = await invoke('checkoutCreate', 'POST', { body: {} });
      openProbes.push({
        route: 'checkoutCreate-empty',
        status: res.statusCode,
        error: res.body && res.body.error,
        fetchDelta: fetchCalls.length - before,
      });
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.error, 'UNKNOWN_SKU');
      assert.strictEqual(fetchCalls.length, before);
    }
    {
      const before = fetchCalls.length;
      const res = await invoke('v2Return', 'POST', { body: {} });
      openProbes.push({
        route: 'v2Return-invalid',
        status: res.statusCode,
        ack: textOf(res) === '1|OK',
        fetchDelta: fetchCalls.length - before,
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(textOf(res), '1|OK');
      assert.strictEqual(fetchCalls.length, before);
    }
    {
      const before = fetchCalls.length;
      const res = await invoke('download', 'GET', { query: { token: 'not-a-token' } });
      openProbes.push({
        route: 'download-bad-token',
        status: res.statusCode,
        notEnabled: textOf(res).includes('PAYMENT_NOT_ENABLED'),
        fetchDelta: fetchCalls.length - before,
      });
      assert.notStrictEqual(res.statusCode, 200);
      assert.strictEqual(textOf(res).includes('PAYMENT_NOT_ENABLED'), false);
      assert.strictEqual(fetchCalls.length, before);
    }
    {
      const libPath = require.resolve('../api/payment/ecpay-v2/_lib');
      delete require.cache[libPath];
      const lib = require('../api/payment/ecpay-v2/_lib');
      setEnv('production', 'stage');
      assert.throws(() => lib.getCredentials(), (err) => err && err.code === 'PAYMENT_NOT_ENABLED');
      setEnv('preview', undefined);
      assert.throws(() => lib.getCredentials(), (err) => err && err.code === 'PAYMENT_NOT_ENABLED');
      setEnv('preview', 'stage');
      const creds = lib.getCredentials();
      assert.strictEqual(typeof creds.merchantID, 'string');
      assert.ok(creds.merchantID.length > 0);
      openProbes.push({ route: 'getCredentials', previewStage: true, productionStageThrows: true, previewMissingThrows: true });
    }

    const shop = fs.readFileSync(require('path').join(__dirname, '../src/shop.html'), 'utf8');
    const ending = fs.readFileSync(require('path').join(__dirname, '../src/ae-experience-ending.js'), 'utf8');
    assert.ok(shop.includes('ko-fi.com'));
    assert.ok(!/\/api\/ecpay|\/api\/payment|\/api\/download/.test(shop));
    assert.ok(ending.includes('Save wallpaper (free)'));
    assert.ok(ending.includes('https://ko-fi.com/s/'));

    const closedCount = evidence.filter((row) => row.closed && row.fetchDelta === 0).length;
    const summary = {
      closedChecks: closedCount,
      expectedClosed: closedCalls.length * matrix.filter((row) => !row[3]).length,
      openProbes: openProbes.map((row) => ({ route: row.route, status: row.status, error: row.error, stageForm: row.stageForm, ack: row.ack, fetchDelta: row.fetchDelta })),
      fetchTotal: fetchCalls.length,
      failed,
    };
    assert.strictEqual(summary.closedChecks, summary.expectedClosed);
    assert.strictEqual(failed, 0);
    assert.strictEqual(fetchCalls.length, 0);
    const out = '/opt/cursor/artifacts/ae-release-20261106/qa/payment-gate-evidence.json';
    fs.mkdirSync(require('path').dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ summary, evidence }, null, 2));
    console.log('PASS payment gate');
    console.log(JSON.stringify(summary));
  } finally {
    global.fetch = originalFetch;
    if (saved.ECPAY_MODE === undefined) delete process.env.ECPAY_MODE;
    else process.env.ECPAY_MODE = saved.ECPAY_MODE;
    if (saved.VERCEL_ENV === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = saved.VERCEL_ENV;
  }
  if (failed) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
