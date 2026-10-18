import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {morphFrame,morphTravel,snapTarget,PROFILE_AVATAR_SIZE} from '../apps/web/src/motion/profileMorph';

test('photo reduces uniformly to exactly 56px and preserves 1.45px glass rim',()=>{
 for(const width of [320,360,393,480]){
  const open=morphFrame(0,width),shut=morphFrame(morphTravel(width),width);
  assert.equal(open.scale,1);
  assert.ok(Math.abs(shut.scale*width-PROFILE_AVATAR_SIZE)<.001);
  assert.ok(Math.abs(shut.rimWidth*shut.scale-1.45)<.001);
  assert.equal(open.captionOpacity,1);
  assert.equal(shut.captionOpacity,0);
  assert.equal(shut.compactOpacity,1);
 }
});
test('snap at 30 percent when opening and 70 percent when closing',()=>{
 const w=360,t=morphTravel(w);
 assert.equal(snapTarget(.29*t,w,false,0),0);
 assert.equal(snapTarget(.30*t,w,false,0),t);
 assert.equal(snapTarget(.69*t,w,true,0),0);
 assert.equal(snapTarget(.70*t,w,true,0),t);
 assert.equal(snapTarget(t+50,w,true,0),null);
 assert.equal(snapTarget(t*.2,w,false,1.2),t);
 assert.equal(snapTarget(t*.8,w,true,-1.2),0);
});
test('monotone reversible finite transform, including invalid scroll',()=>{
 for(const w of [320,360,480]){
  let previous=1;
  for(let i=0;i<=700;i+=2){
   const f=morphFrame(i,w);
   assert.ok(f.scale<=previous+1e-10);
   assert.deepEqual(f,morphFrame(i,w));
   previous=f.scale;
  }
 }
 assert.equal(morphFrame(NaN,0).scale,1);
});