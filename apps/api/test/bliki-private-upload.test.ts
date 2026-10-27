import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import {
  createBlikiUploadTicket, storeBlikiUpload, hasBlikiMediaSignature, type BlikiPrivateMediaStore,
} from '../src/bliki/bliki-private-upload.js';

const actorId = '25f1d44d-35d2-4c55-8c9d-2bb2b7e021a1';
const operationId = 'c572a994-7122-4421-a23c-30e9d22086fd';
function ticket(size = 4) {
  return createBlikiUploadTicket({
    actorId, operationId, namespace: 'luemi_test', mediaKind: 'image',
    mimeType: 'image/jpeg', size,
  }, 1000);
}
test('ticket is private, owner scoped and expires after ten minutes', () => {
  const result = ticket();
  assert.ok(result.key.startsWith('luemi_test/' + actorId + '/'));
  assert.equal(result.expiresAt, 601000);
  assert.ok(!result.key.includes(operationId));
});
test('upload checks private storage integrity', async () => {
  const bytes = new Uint8Array([255, 216, 255, 217]);
  let stored: Uint8Array | undefined;
  const store: BlikiPrivateMediaStore = {
    async put(_key, value) { stored = value; },
    async stat() {
      return stored ? {
        size: stored.length, mimeType: 'image/jpeg',
        sha256: createHash('sha256').update(stored).digest('hex'),
      } : null;
    },
    async remove() { stored = undefined; },
  };
  const result = await storeBlikiUpload(store, ticket(), bytes, 1001);
  assert.equal(result.size, 4);
  assert.equal(result.sha256.length, 64);
  await assert.rejects(storeBlikiUpload(store, ticket(), bytes, 601000), /expired/);
  await assert.rejects(storeBlikiUpload(store, ticket(5), bytes, 1001), /size_mismatch/);
});
test('tampered storage is removed and never confirmed', async () => {
  let removed = false;
  const store: BlikiPrivateMediaStore = {
    async put() {},
    async stat() { return { size: 4, mimeType: 'image/jpeg', sha256: '0'.repeat(64) }; },
    async remove() { removed = true; },
  };
  await assert.rejects(storeBlikiUpload(
    store, ticket(), new Uint8Array([255, 216, 255, 217]), 1001,
  ), /integrity_failed/);
  assert.equal(removed, true);
});

test('rejects media disguised as an image or video', () => {
  const fake = new TextEncoder().encode('<script>alert(1)</script>');
  assert.equal(hasBlikiMediaSignature('image/jpeg', fake), false);
  assert.equal(hasBlikiMediaSignature('image/png', fake), false);
  assert.equal(hasBlikiMediaSignature('image/webp', fake), false);
  assert.equal(hasBlikiMediaSignature('video/mp4', fake), false);
  assert.equal(hasBlikiMediaSignature('image/jpeg',
    new Uint8Array([255, 216, 255, 217])), true);
});
