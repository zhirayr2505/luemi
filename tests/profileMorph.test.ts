import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  clamp01,
  morphFrame,
  morphTravel,
  PROFILE_AVATAR_SIZE,
  PROFILE_SNAP_THRESHOLD,
} from '../apps/web/src/motion/profileMorph';

test('uniform 56px avatar uses independent fixed circular layer', () => {
  assert.equal(PROFILE_AVATAR_SIZE, 56);
  assert.equal(PROFILE_SNAP_THRESHOLD, 0.3);
  for (const width of [320, 360, 393, 480]) {
    const travel = morphTravel(width);
    assert.ok(travel >= 220 && travel <= 325);
    const open = morphFrame(0, travel);
    const closed = morphFrame(travel, travel);
    assert.equal(open.heroScale, 1);
    assert.equal(open.heroOpacity, 1);
    assert.equal(open.avatarOpacity, 0);
    assert.equal(closed.heroOpacity, 0);
    assert.equal(closed.avatarOpacity, 1);
    assert.equal(closed.compactOpacity, 1);
  }
});

test('read-only motion mapping is reversible, clamped and monotone', () => {
  for (const travel of [220, 295, 325]) {
    let previous = 1;
    for (let position = 0; position < travel + 200; position += 3) {
      const frame = morphFrame(position, travel);
      assert.deepEqual(frame, morphFrame(position, travel));
      assert.ok(frame.heroScale <= previous + 1e-10);
      assert.ok(frame.compactOpacity >= 0 && frame.compactOpacity <= 1);
      previous = frame.heroScale;
    }
  }
  assert.equal(clamp01(NaN), 0);
  assert.equal(morphFrame(NaN, 0).progress, 0);
});
