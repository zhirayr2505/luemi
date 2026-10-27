import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeBlikiCursor, encodeBlikiCursor } from '../src/bliki/bliki-feed-cursor.js';
const now = Date.parse('2026-10-27T16:00:00.000Z');
const valid = {
  v: 1 as const, anchorMs: now-1000,
  beforeAt: '2026-10-27T15:59:58.123456Z',
  beforeId: '11111111-1111-4111-8111-111111111111',
};
test('opaque keyset cursor preserves microseconds and stable snapshot', () => {
  const encoded = encodeBlikiCursor(valid);
  assert.deepEqual(decodeBlikiCursor(encoded, now), valid);
});
test('invalid, old, future and malformed cursors reject closed', () => {
  for (const candidate of [
    '', 'garbage', 'a'.repeat(513),
    Buffer.from('{"v":1}').toString('base64url'),
    Buffer.from(JSON.stringify({...valid, anchorMs: now-90000000})).toString('base64url'),
    Buffer.from(JSON.stringify({...valid, anchorMs: now+6000})).toString('base64url'),
    Buffer.from(JSON.stringify({...valid, beforeId: 'not-an-id'})).toString('base64url'),
    Buffer.from(JSON.stringify({...valid, beforeAt: '2026-10-27T16:59:58.123456Z'})).toString('base64url'),
    Buffer.from(JSON.stringify({...valid, injected: true})).toString('base64url'),
  ]) {
    assert.equal(decodeBlikiCursor(candidate, now), null);
  }
});
