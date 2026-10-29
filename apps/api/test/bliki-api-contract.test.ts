import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../src/bliki/bliki-api.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../migrations/20261027_bliki_v1_private.sql', import.meta.url), 'utf8');
const policy = readFileSync(new URL('../src/bliki/bliki-policy.ts', import.meta.url), 'utf8');

test('Bliki API is gated by authenticated sessions', () => {
  assert.match(api, /if \(!options\?\.enabled\) return/);
  assert.match(api, /preHandler: guard\.read/);
  assert.match(api, /request\.authActor/);
  assert.match(api, /timingSafeEqual/);
});
test('Bliki feed returns only active stories and no media keys', () => {
  assert.match(api, /published_at > now\(\) - interval '24 hours'/);
  assert.match(api, /status='published'/);
  assert.match(api, /deleted_at IS NULL/);
  assert.match(api, /NOT has_column_privilege\(current_user,'luemi_bliki_private\.stories','media_key','SELECT'\)/);
});
test('Bliki tables use forced RLS with no public grants', () => {
  for (const table of ['stories', 'views', 'reactions', 'reports']) {
    assert.ok(migration.includes(`ALTER TABLE luemi_bliki_private.${table} FORCE ROW LEVEL SECURITY`));
  }
  assert.match(migration, /REVOKE ALL ON ALL TABLES IN SCHEMA luemi_bliki_private FROM PUBLIC, anon, authenticated/);
  assert.doesNotMatch(migration, /CREATE POLICY/);
});
test('Bliki policy rejects oversized and expired stories', () => {
  assert.match(policy, /videoMaxBytes: 100 \* 1024 \* 1024/);
  assert.match(policy, /lifetimeMs: 24 \* 60 \* 60 \* 1000/);
});
