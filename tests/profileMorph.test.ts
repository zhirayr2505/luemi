import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { morphFrame, morphProgress, PROFILE_AVATAR_SIZE } from '../apps/web/src/motion/profileMorph';

test('open and closed profile geometry are exact', () => {
  const open = morphFrame(0, 360), closed = morphFrame(10_000, 360);
  assert.equal(open.scale, 1);
  assert.equal(open.radius, 27);
  assert.equal(open.heroOpacity, 1);
  assert.equal(open.compactOpacity, 0);
  assert.ok(Math.abs(closed.scale * 360 - PROFILE_AVATAR_SIZE) < 0.001);
  assert.equal(closed.radius, 180);
  assert.equal(closed.compactOpacity, 1);
  assert.equal(closed.heroOpacity, 0);
});

test('scroll position is reversible with no hysteresis or lag', () => {
  for (const width of [320, 360, 440, 480]) {
    for (const pos of [0, 12, 65, 130, 245, 335, 600]) {
      assert.deepEqual(morphFrame(pos, width), morphFrame(pos, width));
    }
    let lastScale = 1;
    for (let pos = 0; pos < 650; pos += 3) {
      const value = morphFrame(pos, width);
      assert.ok(value.scale <= lastScale + 1e-8);
      assert.ok(value.compactOpacity >= 0 && value.compactOpacity <= 1);
      lastScale = value.scale;
    }
  }
});

test('out of range offsets and invalid sizes are safe', () => {
  for (const x of [NaN, Infinity, -100, 0]) {
    assert.equal(morphProgress(x, 0), 0);
    assert.ok(Number.isFinite(morphFrame(x, 0).scale));
  }
  assert.equal(morphProgress(-10, 360), 0);
  assert.equal(morphProgress(900, 360), 1);
});