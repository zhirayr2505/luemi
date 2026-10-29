import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createBlikiSupabaseStore } from '../src/bliki/bliki-supabase-store.js';

const namespace = 'test';
const actor = '25f1d44d-35d2-4c55-8c9d-2bb2b7e021a1';
const media = 'c572a994-7122-4421-a23c-30e9d22086fd';
const key = namespace + '/' + actor + '/' + media;
const settings = {
  projectRef: 'abcdefghijklmnopqrst',
  secret: 'sb_secret_' + 'a'.repeat(32),
  bucket: 'luemi-bliki-private' as const,
  namespace,
};
test('private store rejects keys outside namespace before network', async () => {
  let calls = 0;
  const transport = (async () => { calls++; return new Response(null, { status: 204 }); }) as typeof fetch;
  const store = createBlikiSupabaseStore(settings, transport);
  await assert.rejects(store.remove('other/' + actor + '/' + media), /invalid_bliki_key/);
  await assert.rejects(store.remove('../' + key), /invalid_bliki_key/);
  assert.equal(calls, 0);
});
test('private media digest is verified by streamed read', async () => {
  const bytes = new Uint8Array([255, 216, 255, 224, 0, 0, 255, 217]);
  const transport = (async (url: string | URL | Request) => {
    assert.match(String(url), /authenticated\/luemi-bliki-private\/test\//);
    return new Response(bytes, { status: 200, headers: { 'content-type': 'image/jpeg' } });
  }) as typeof fetch;
  const store = createBlikiSupabaseStore(settings, transport);
  const result = await store.stat(key);
  assert.equal(result?.size, bytes.length);
  assert.equal(result?.sha256, createHash('sha256').update(bytes).digest('hex'));
});
test('private store refuses redirects', async () => {
  const transport = (async () => new Response(null, {
    status: 302, headers: { location: 'https://example.org' },
  })) as typeof fetch;
  const store = createBlikiSupabaseStore(settings, transport);
  await assert.rejects(store.remove(key), /storage_redirect_denied/);
});
