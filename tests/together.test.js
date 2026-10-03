const assert = require('assert');
const handler = require('../api/together');

function call(method, { query = {}, body = {} } = {}) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); },
    };
    Promise.resolve(handler({ method, query, body }, res)).catch(reject);
  });
}

(async () => {
  handler._reset();
  const code = 'LP-23456789';
  const handA = 'h234567';
  const handB = 'h89ABC2';

  const bad = await call('POST', { body: { code: 'nope', hand: handA, art: 0, symbol: '♥', id: 'm23456789' } });
  assert.strictEqual(bad.status, 400);

  const created = await call('GET', { query: { code, hand: handA } });
  assert.strictEqual(created.status, 200);
  assert.strictEqual(created.body.code, code);
  assert.strictEqual(created.body.others, 0);
  assert.deepStrictEqual(created.body.marks, []);

  const markA = await call('POST', { body: { code, hand: handA, art: 4, symbol: '✦', id: 'm23456789' } });
  assert.strictEqual(markA.status, 200);
  assert.strictEqual(markA.body.marks.length, 1);
  assert.strictEqual(markA.body.marks[0].yours, true);
  assert.strictEqual(markA.body.marks[0].art, 4);

  const seen = await call('GET', { query: { code, hand: handB } });
  assert.strictEqual(seen.status, 200);
  assert.strictEqual(seen.body.others, 1);
  assert.strictEqual(seen.body.marks.length, 1);
  assert.strictEqual(seen.body.marks[0].yours, false);
  assert.strictEqual(seen.body.marks[0].symbol, '✦');

  const markB = await call('POST', { body: { code, hand: handB, art: 4, symbol: '❀', id: 'mABCDEF23' } });
  assert.strictEqual(markB.body.marks.length, 2);
  const again = await call('GET', { query: { code, hand: handA } });
  assert.strictEqual(again.body.others, 1);
  assert.strictEqual(again.body.marks.filter((mark) => mark.yours).length, 1);
  assert.strictEqual(again.body.marks.filter((mark) => !mark.yours).length, 1);

  const dup = await call('POST', { body: { code, hand: handA, art: 1, symbol: '♥', id: 'm23456789' } });
  assert.strictEqual(dup.body.marks.length, 2);

  const sun = await call('POST', { body: { code, hand: handA, art: 0, symbol: '☀', id: 'm2345678A' } });
  assert.strictEqual(sun.status, 400);

  const off = await call('POST', { body: { code, hand: handA, art: 9, symbol: '♥', id: 'm2345678B' } });
  assert.strictEqual(off.status, 400);

  console.log('together tests ok');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
