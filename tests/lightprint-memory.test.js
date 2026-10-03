const assert = require('assert');
const fs = require('fs');

const root = fs.readFileSync('lightprint-memory.html', 'utf8');
const pub = fs.readFileSync('public/lightprint-memory.html', 'utf8');

assert.strictEqual(root, pub, 'root and public lightprint-memory pages stay the same');

[
  '光紋記憶',
  'Make this world a better place.',
  'Actions create infinity.',
  'Save the card',
  '儲存這張卡',
  'Download the card',
  '下載這張卡',
  'One dollar buys this card only',
  'not charity',
  'not public fundraising',
  'does not open a next level',
  '不是慈善',
  '不是公開募款',
  '也不會打開下一關',
  'ae_lightprint_memory',
  'A card is saved on this device.'
].forEach((line) => {
  assert.ok(root.includes(line), 'missing: ' + line);
});

assert.ok(!/Face ID|Bluetooth|phone fingerprint|\bchip\b|\blogin\b/i.test(root));
assert.ok(!root.includes('Give $1'));
assert.ok(!root.includes('A $1 gift'));
assert.ok(root.includes('id="lmSave"'));
assert.ok(root.includes('id="lmDownload"'));
assert.ok(root.includes('function paintCardFile'));

console.log('lightprint-memory copy checks passed');
