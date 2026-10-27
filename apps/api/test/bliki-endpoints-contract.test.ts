import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/app.ts');
const reader = read('../src/bliki/bliki-api.ts');
const media = read('../src/bliki/bliki-media-api.ts');
const writer = read('../src/bliki/bliki-publication-api.ts');
const social = read('../src/bliki/bliki-interaction-api.ts');

test('every private API is registered behind an explicit config gate', () => {
  for (const route of ['registerBlikiApi', 'registerBlikiPublicationApi',
    'registerBlikiMediaApi', 'registerBlikiInteractionApi']) assert.match(app, new RegExp(route + '\\(app, guards,'));
});
test('feed uses RLS, real author projection and same-origin media paths', () => {
  assert.match(reader, /pg_has_role\(current_user,'luemi_bliki_reader','member'\)/);
  assert.match(reader, /luemi_private\.public_profiles/);
  assert.match(reader, /luemi_chats\.matches/);
  assert.match(reader, /luemi_chats\.likes/);
  assert.match(reader, /\/api\/v1\/bliki\/media\//);
  assert.match(reader, /serverNow: new Date\(now\)\.toISOString\(\)/);
  assert.doesNotMatch(reader, /SELECT.*s\.media_key/);
});
test('private streaming requires second RLS lookup and bounded byte ranges', () => {
  assert.match(media, /registerBlikiMediaApi/);
  assert.match(media, /bliki_media_reader/);
  assert.match(media, /await lookup\(req, reply, req\.params\.storyId\)/);
  assert.match(media, /limitedStream\(opened\.body, opened\.length\)/);
  assert.match(media, /invalid_range/);
});
test('writes require published identity and social actions are scoped', () => {
  assert.match(writer, /published_profile_required/);
  assert.match(writer, /status='deleted',deleted_at=clock_timestamp\(\)/);
  assert.match(social, /luemi_bliki_interaction/);
  assert.match(social, /ON CONFLICT DO NOTHING/);
  assert.match(social, /preHandler: guard!\.mutation/);
});
