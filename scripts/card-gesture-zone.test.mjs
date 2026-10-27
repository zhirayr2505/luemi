import assert from 'node:assert/strict';
import {cardGestureZone} from '../apps/web/src/discovery/card-gesture-zone.ts';

for(const [top,height] of [[0,600],[73,351],[47,827]]){
 assert.equal(cardGestureZone(top+height*.849,top,height),'photo');
 assert.equal(cardGestureZone(top+height*.85,top,height),'browse');
 assert.equal(cardGestureZone(top+height*.99,top,height),'browse');
 assert.equal(cardGestureZone(top-1,top,height),null);
 assert.equal(cardGestureZone(top+height+1,top,height),null);
}
assert.equal(cardGestureZone(1,0,0),null);
console.log('card gesture zone: PASS');
