import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authorizeBlikiAction, type BlikiStoryAccess } from '../src/bliki/bliki-social-access.js';

const base: BlikiStoryAccess = {
  storyId: 'story', authorId: 'author', viewerId: 'viewer',
  status: 'published', publishedAt: new Date('2026-10-27T10:00:00Z'),
  now: new Date('2026-10-27T11:00:00Z'), viewerEligible: true,
  authorEligible: true, blockedEitherDirection: false,
  authorVisibleInDiscovery: true, isMutualMatch: false,
};
test('authorized viewers can view and react; replies require a match', () => {
  assert.equal(authorizeBlikiAction('view', base), true);
  assert.equal(authorizeBlikiAction('react', base), true);
  assert.equal(authorizeBlikiAction('reply', base), false);
  assert.equal(authorizeBlikiAction('reply', { ...base, isMutualMatch: true }), true);
});
test('blocks, expired media, unpublished stories and hidden profiles deny access', () => {
  assert.equal(authorizeBlikiAction('view', { ...base, blockedEitherDirection: true }), false);
  assert.equal(authorizeBlikiAction('react', { ...base, viewerEligible: false }), false);
  assert.equal(authorizeBlikiAction('view', { ...base, status: 'processing' }), false);
  assert.equal(authorizeBlikiAction('view', { ...base, authorVisibleInDiscovery: false }), false);
  assert.equal(authorizeBlikiAction('view', {
    ...base, now: new Date('2026-10-28T10:00:00Z'),
  }), false);
});
test('only author can delete; author cannot react to or report own story', () => {
  assert.equal(authorizeBlikiAction('delete', base), false);
  assert.equal(authorizeBlikiAction('delete', { ...base, viewerId: 'author' }), true);
  assert.equal(authorizeBlikiAction('react', { ...base, viewerId: 'author' }), false);
  assert.equal(authorizeBlikiAction('report', { ...base, viewerId: 'author' }), false);
});
