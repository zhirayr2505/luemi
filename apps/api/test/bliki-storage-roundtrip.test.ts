import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBlikiSupabaseStore } from '../src/bliki/bliki-supabase-store.js';

const actor = '25f1d44d-35d2-4c55-8c9d-2bb2b7e021a1';
const objectId = 'c572a994-7122-4421-a23c-30e9d22086fd';
const key = 'stage/' + actor + '/' + objectId;
const settings = {
  projectRef: 'abcdefghijklmnopqrst',
  secret: 'sb_secret_' + 'a'.repeat(32),
  bucket: 'luemi-bliki-private' as const,
  namespace: 'stage',
};
test('canonical owner-scoped key works for upload, stat and delete', async () => {
  const methods: string[] = [];
  const transport = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    assert.ok(url.endsWith('/luemi-bliki-private/' + key));
    methods.push(init?.method ?? '');
    if (init?.method === 'GET') return new Response(new Uint8Array([1, 2, 3]), {
      status: 200, headers: { 'content-type': 'image/png' },
    });
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  const store = createBlikiSupabaseStore(settings, transport);
  await store.put(key, new Uint8Array([1, 2, 3]), 'image/png');
  const stat = await store.stat(key);
  assert.equal(stat?.size, 3);
  await store.remove(key);
  assert.deepEqual(methods, ['POST', 'GET', 'DELETE']);
});
test('rejects traversal and cross-namespace keys without any request', async () => {
  let calls = 0;
  const transport = (async () => {
    calls++;
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  const store = createBlikiSupabaseStore(settings, transport);
  await assert.rejects(store.remove('other/' + actor + '/' + objectId), /invalid_bliki_key/);
  await assert.rejects(store.remove('stage/../' + objectId), /invalid_bliki_key/);
  assert.equal(calls, 0);
});
