import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/bliki/bliki-publication-api.ts', import.meta.url), 'utf8');
const transport = readFileSync(new URL('../../web/src/features/bliki/publishing/blikHttpTransport.ts', import.meta.url), 'utf8');
const client = readFileSync(new URL('../../web/src/features/bliki/publishing/blikPublishClient.ts', import.meta.url), 'utf8');
const rail = readFileSync(new URL('../../web/src/features/bliki/feed/BlikiAvatarRail.tsx', import.meta.url), 'utf8');

test('publication and read routes are registered only with their own opts', () => {
  assert.match(app, /registerBlikiPublicationApi\(app, guards, config\.blikiPublication\)/);
  assert.match(app, /registerBlikiApi\(app, guards, config\.bliki\)/);
  assert.match(api, /if \(!options\?\.enabled\) return/);
});
test('interrupted upload can resume from uploading, not fake processing', () => {
  assert.match(api, /row\.status === 'uploading'/);
  assert.match(transport, /item\.state === 'uploading'/);
  assert.match(client, /prior\.state === 'processing'/);
  assert.match(client, /prior\.state === 'rejected'/);
});
test('the owner can create when the authorized feed is empty', () => {
  assert.doesNotMatch(rail, /if \(!feed\.entries\.length\) return null/);
  assert.match(rail, /onClick=\{onCreate\}/);
  assert.match(rail, /bliki-rail-scroll/);
});
