const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const energy = require('../../src/ae-home-light-energy.js');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../src/ae-home-beats.js'), 'utf8'), sandbox);
const timeline = sandbox.window.aeHomeBeatTimeline;

test('speaker position follows the audio clock and does not accumulate frame debt', () => {
  const offset = 51.95;
  assert.equal(energy.audiblePosition(offset, 0.01, 0.04, 181.6), offset);
  assert.equal(energy.audiblePosition(offset, 10, 0.05, 181.6), offset + 10 - 0.05);
  // A dropped-frame jump of 2s lands on the audio clock, not on lastPaint+16ms.
  const jumped = energy.audiblePosition(offset, 13.2, 0.02, 181.6);
  assert.ok(Math.abs(jumped - (offset + 13.2 - 0.02)) < 1e-9);
  const dur = 181.6;
  const wrapped = energy.audiblePosition(10, dur, 0, dur);
  assert.ok(Math.abs(wrapped - 10) < 1e-9);
});

test('build, drop, and groove stay on the track clock after a time jump', () => {
  const rhythm = energy.createRhythm(timeline.events, timeline.accents, timeline.sections);
  const at = (time) => rhythm.update(0, time);
  assert.equal(at(60).stage, 'build');
  assert.equal(at(65.2).stage, 'drop');
  const groove = at(72);
  assert.equal(groove.stage, 'groove');
  const last = timeline.events.filter(t => t <= 72).at(-1);
  assert.ok(72 - last < 0.5, 'pulse age stays on the latest kick, not the build');
  assert.equal(groove.count, timeline.events.filter(t => t <= 72).length);
});

test('sparse frames across the drop do not leave the laser phase behind', () => {
  const rhythm = energy.createRhythm(timeline.events, timeline.accents, timeline.sections);
  const ages = [];
  for (let time = 66.5; time <= 90; time += 0.48) {
    const beat = rhythm.update(0, time);
    const last = timeline.events.filter(t => t <= time).at(-1);
    ages.push(time - last);
    assert.equal(beat.stage, time < 66.52 ? 'drop' : 'groove');
    assert.ok(time - last < 0.5);
    assert.equal(beat.count, timeline.events.filter(t => t <= time).length);
  }
  const growth = ages.at(-1) - ages[0];
  assert.ok(Math.abs(growth) < 0.5, 'phase error does not grow across the groove');
});

test('first music entry is the measured build, not a hardcoded zero', () => {
  assert.equal(energy.openingTime(timeline), timeline.sections[0].start);
  assert.ok(timeline.sections[0].drop > timeline.sections[0].start);
  assert.ok(timeline.sections[0].drop < timeline.sections[0].end);
});
