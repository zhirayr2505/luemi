import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {morphFrame,morphTravel,snapTarget,PROFILE_AVATAR_SIZE} from '../apps/web/src/motion/profileMorph';
test('open photo, closed circle, uninterrupted natural proportions',()=>{
 for(const width of [320,356,390,460]){
  const a=morphFrame(0,width),b=morphFrame(10000,width);
  assert.equal(a.scale,1);assert.equal(a.radius,27);
  assert.ok(Math.abs(b.scale*width-PROFILE_AVATAR_SIZE)<.00001);
  assert.equal(b.radius,width/2);
  // 1.45px visual rim remains 1.45px across any scale.
  assert.ok(Math.abs(b.rimSourceWidth*b.scale-1.45)<.00001);
  assert.equal(b.heroOpacity,0);assert.equal(b.compactOpacity,1);
  // Content starts after untransformed hero in normal flow; rapid image shrink
  // stays ahead of cards across morph range.
  for(let y=0;y<=morphTravel(width);y+=2){
   const f=morphFrame(y,width);
   assert.ok(width*f.scale <= width-y+20,'photo must not substantially cover first card');
   assert.deepEqual(f,morphFrame(y,width),'reverse path must be deterministic');
  }
 }
});
test('30% close threshold, 30% opening hysteresis, and fast flick',()=>{
 const width=360,travel=morphTravel(width);
 assert.equal(snapTarget(travel*.299,width,false),0);
 assert.equal(snapTarget(travel*.300,width,false),travel);
 assert.equal(snapTarget(travel*.701,width,true),travel);
 assert.equal(snapTarget(travel*.699,width,true),0);
 assert.equal(snapTarget(travel*.12,width,false,.7),travel);
 assert.equal(snapTarget(travel*.88,width,true,-.7),0);
 assert.equal(snapTarget(travel+30,width,true),null);
 assert.equal(snapTarget(0,width,false),0);
});
test('geometry is safe for invalid widths and offsets',()=>{
 for(const width of [0,NaN,Infinity,-10])for(const y of [0,NaN,Infinity,-20]){
  const f=morphFrame(y,width);
  assert.ok(Number.isFinite(f.scale));assert.ok(Number.isFinite(f.translateY));
 }
});