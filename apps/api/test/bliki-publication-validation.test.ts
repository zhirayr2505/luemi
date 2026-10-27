import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateBlikiSession, validateBlikiVideoDuration, publicationExpiry,
} from '../src/bliki/bliki-publication-validation.js';

const request = {
  draftId: '25f1d44d-35d2-4c55-8c9d-2bb2b7e021a1',
  operationId: 'c572a994-7122-4421-a23c-30e9d22086fd',
  mediaKind: 'image' as const,
  mimeType: 'image/jpeg',
  size: 2048,
};
test('accepts valid image session', () => {
  assert.deepEqual(validateBlikiSession(request), { ok: true, value: request });
});
test('rejects extra fields and wrong identifiers', () => {
  assert.equal(validateBlikiSession({ ...request, actorId: 'victim' }).ok, false);
  assert.equal(validateBlikiSession({ ...request, operationId: '../other' }).ok, false);
  assert.equal(validateBlikiSession({ ...request, draftId: '' }).ok, false);
});
test('rejects dangerous media types and size', () => {
  assert.equal(validateBlikiSession({ ...request, mimeType: 'image/svg+xml' }).ok, false);
  assert.equal(validateBlikiSession({ ...request, size: 0 }).ok, false);
  assert.equal(validateBlikiSession({ ...request, size: 26 * 1024 * 1024 }).ok, false);
  assert.equal(validateBlikiSession({ ...request, size: 2.5 }).ok, false);
});
test('enforces video duration limits', () => {
  assert.equal(validateBlikiVideoDuration(1000), true);
  assert.equal(validateBlikiVideoDuration(15000), true);
  assert.equal(validateBlikiVideoDuration(999), false);
  assert.equal(validateBlikiVideoDuration(15001), false);
  assert.equal(validateBlikiVideoDuration(NaN), false);
});
test('expires exactly 24 hours after confirmed publication', () => {
  assert.equal(publicationExpiry(new Date('2026-10-27T12:00:00Z')),
    '2026-10-28T12:00:00.000Z');
});
