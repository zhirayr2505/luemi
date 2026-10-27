import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  blikiPublicationStatus, confirmBlikiPublication, sameBlikiOperation,
  type BlikiPublicationRecord,
} from '../src/bliki/bliki-publication-state.js';

const actor = '25f1d44d-35d2-4c55-8c9d-2bb2b7e021a1';
const other = '25f1d44d-35d2-4c55-8c9d-2bb2b7e021a2';
const record: BlikiPublicationRecord = {
  actorId: actor, draftId: 'c572a994-7122-4421-a23c-30e9d22086fd',
  operationId: 'a572a994-7122-4421-a23c-30e9d22086fd',
  storyId: 'b572a994-7122-4421-a23c-30e9d22086fd',
  state: 'processing', uploadedSha256: 'a'.repeat(64),
  ticket: {
    actorId: actor, operationId: 'a572a994-7122-4421-a23c-30e9d22086fd',
    key: 'test/' + actor + '/a572a994-7122-4421-a23c-30e9d22086fd',
    mimeType: 'image/jpeg', mediaKind: 'image', size: 1024, expiresAt: 10000,
  },
};
test('same operation must match actor, draft and media', () => {
  assert.equal(sameBlikiOperation(record, actor, record.draftId, record.ticket), true);
  assert.equal(sameBlikiOperation(record, other, record.draftId, record.ticket), false);
  assert.equal(sameBlikiOperation(record, actor, 'other', record.ticket), false);
  assert.equal(sameBlikiOperation(record, actor, record.draftId, { ...record.ticket, size: 9 }), false);
});
test('cannot publish before upload verification or as another actor', () => {
  const now = new Date('2026-10-27T10:00:00.000Z');
  assert.throws(() => confirmBlikiPublication(record, {
    actorId: other, editor: {}, now,
  }), /not_found/);
  assert.throws(() => confirmBlikiPublication({ ...record, state: 'uploading' }, {
    actorId: actor, editor: {}, now,
  }), /not_verified/);
  assert.throws(() => confirmBlikiPublication({ ...record, uploadedSha256: undefined }, {
    actorId: actor, editor: {}, now,
  }), /not_verified/);
});
test('publishes once, preserves identity and expires exactly 24h later', () => {
  const now = new Date('2026-10-27T10:00:00.000Z');
  const published = confirmBlikiPublication(record, { actorId: actor, editor: {}, now });
  assert.equal(published.state, 'published');
  const status = blikiPublicationStatus(published, actor);
  assert.equal(status.state, 'published');
  if (status.state === 'published') assert.equal(status.expiresAt, '2026-10-28T10:00:00.000Z');
  assert.deepEqual(confirmBlikiPublication(published, {
    actorId: actor, editor: { changed: true }, now: new Date('2026-10-27T11:00:00.000Z'),
  }), published);
  assert.throws(() => blikiPublicationStatus(published, other), /not_found/);
});
test('video must have verified duration 1-15 seconds', () => {
  const video: BlikiPublicationRecord = {
    ...record, ticket: { ...record.ticket, mediaKind: 'video', mimeType: 'video/mp4' },
  };
  const now = new Date('2026-10-27T10:00:00.000Z');
  assert.throws(() => confirmBlikiPublication(video, {
    actorId: actor, editor: {}, now,
  }), /invalid_video_duration/);
  assert.throws(() => confirmBlikiPublication(video, {
    actorId: actor, editor: {}, now, durationMs: 15001,
  }), /invalid_video_duration/);
  assert.equal(confirmBlikiPublication(video, {
    actorId: actor, editor: {}, now, durationMs: 15000,
  }).state, 'published');
});
