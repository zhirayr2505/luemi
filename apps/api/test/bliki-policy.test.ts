import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BLIKI_LIMITS, validateBlikiUpload, expiresAtFromPublication,
  isBlikiActive, canViewBliki, canReplyToBliki,
} from '../src/bliki/bliki-policy.js';

test('photos accept supported MIME and enforce size', () => {
  assert.deepEqual(validateBlikiUpload({kind:'image',mime:'image/jpeg',size:1}), {ok:true});
  assert.deepEqual(validateBlikiUpload({kind:'image',mime:'image/webp',size:BLIKI_LIMITS.photoMaxBytes}), {ok:true});
  assert.equal(validateBlikiUpload({kind:'image',mime:'image/svg+xml',size:100}).ok, false);
  assert.equal(validateBlikiUpload({kind:'image',mime:'image/png',size:BLIKI_LIMITS.photoMaxBytes+1}).ok, false);
});
test('videos require MP4 and duration <=15s', () => {
  assert.deepEqual(validateBlikiUpload({kind:'video',mime:'video/mp4',size:1,durationMs:15000}), {ok:true});
  assert.equal(validateBlikiUpload({kind:'video',mime:'video/mp4',size:1,durationMs:15001}).ok, false);
  assert.equal(validateBlikiUpload({kind:'video',mime:'video/webm',size:1}).ok, false);
  assert.equal(validateBlikiUpload({kind:'video',mime:'video/mp4',size:0}).ok, false);
});
test('expiry is exactly 24h after successful publication', () => {
  const publishedAt = new Date('2026-10-27T12:00:00.000Z');
  const expiresAt = expiresAtFromPublication(publishedAt);
  assert.equal(expiresAt.toISOString(),'2026-10-28T12:00:00.000Z');
  assert.equal(isBlikiActive({status:'published',publishedAt,expiresAt,now:new Date('2026-10-28T11:59:59.999Z')}),true);
  assert.equal(isBlikiActive({status:'published',publishedAt,expiresAt,now:expiresAt}),false);
  assert.equal(isBlikiActive({status:'processing',publishedAt,expiresAt,now:publishedAt}),false);
});
test('blocked users cannot see stories, and self-view is permitted', () => {
  const context={viewerId:'viewer',authorId:'author',viewerEligible:true,authorEligible:true,
    blockedEitherDirection:false,authorVisibleInDiscovery:true};
  assert.equal(canViewBliki(context),true);
  assert.equal(canViewBliki({...context,blockedEitherDirection:true}),false);
  assert.equal(canViewBliki({...context,viewerEligible:false}),false);
  assert.equal(canViewBliki({...context,authorVisibleInDiscovery:false}),false);
  assert.equal(canViewBliki({...context,viewerId:'author',authorVisibleInDiscovery:false}),true);
});
test('replies require existing mutual match', () => {
  const context={viewerId:'viewer',authorId:'author',isMutualMatch:true,blockedEitherDirection:false};
  assert.equal(canReplyToBliki(context),true);
  assert.equal(canReplyToBliki({...context,isMutualMatch:false}),false);
  assert.equal(canReplyToBliki({...context,blockedEitherDirection:true}),false);
});
