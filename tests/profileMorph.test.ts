import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { clamp01, morphFrame, morphTravel, PROFILE_AVATAR_SIZE } from '../apps/web/src/motion/profileMorph';

test('one continuous photograph ends at exactly 56px for each screen width', () => {
  assert.equal(PROFILE_AVATAR_SIZE, 56);
  for(const width of [320,360,393,480]) {
    const travel = morphTravel(width), scale = 56 / width;
    const open = morphFrame(0,travel,scale), closed = morphFrame(travel,travel,scale);
    assert.equal(open.heroScale,1);
    assert.ok(Math.abs(closed.heroScale * width - 56) < .00001);
    assert.equal(closed.compactOpacity,1);
    assert.equal(closed.circleRimOpacity,1);
    assert.equal(closed.captionOpacity,0);
  }
});
test('morph always has a visible photograph, reversed gestures retrace one path', () => {
  for(const travel of [220,295,325]){
    let prev=1;
    for(let y=0;y<=travel+120;y+=3){
      const f=morphFrame(y,travel,.14);
      assert.ok(f.heroScale>0 && f.heroScale<=prev+1e-9);
      assert.deepEqual(f,morphFrame(y,travel,.14));
      prev=f.heroScale;
    }
  }
  assert.equal(clamp01(NaN),0);
  assert.equal(morphFrame(NaN,0).progress,0);
});
