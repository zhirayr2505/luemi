import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBlikiSupabaseStore } from '../src/bliki/bliki-supabase-store.js';

const owner = '25f1d44d-35d2-4c55-8c9d-2bb2b7e021a1';
const id = 'c572a994-7122-4421-a23c-30e9d22086fd';
const key = 'stage/' + owner + '/' + id;
const settings = { projectRef: 'abcdefghijklmnopqrst',
  secret: 'sb_secret_' + 'a'.repeat(32),
  bucket: 'luemi-bliki-private' as const, namespace: 'stage' };
test('private range forwarding returns 206 without constructing any signed URL', async () => {
  let requestedRange = '';
  const upstream = (async (url: string | URL | Request, options?: RequestInit) => {
    assert.match(String(url), /object\/authenticated\/luemi-bliki-private/);
    requestedRange = new Headers(options?.headers).get('range') ?? '';
    return new Response(new Uint8Array([2, 3]), { status: 206, headers: {
      'content-type': 'video/mp4', 'content-length': '2', 'content-range': 'bytes 1-2/4',
    } });
  }) as typeof fetch;
  const store = createBlikiSupabaseStore(settings, upstream);
  const response = await store.open?.(key, { start: 1, end: 2 });
  assert.equal(requestedRange, 'bytes=1-2');
  assert.equal(response?.status, 206);
  assert.equal(response?.contentRange, 'bytes 1-2/4');
  await response?.body.cancel();
});
test('range is rejected if private Storage ignores it', async () => {
  const upstream = (async () => new Response(new Uint8Array([1, 2]), {
    status: 200, headers: { 'content-type': 'video/mp4', 'content-length': '2' },
  })) as typeof fetch;
  const store = createBlikiSupabaseStore(settings, upstream);
  await assert.rejects(store.open!(key, { start: 0 }), /range_unsupported/);
});
