import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const root = new URL('../apps/web/src/features/bliki/', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
test('Bliki draft uses IndexedDB and atomic initial transaction', () => {
  const code = read('drafts/draftRepository.ts');
  assert.match(code, /indexedDB\.open/);
  assert.match(code, /transaction\(\[DRAFTS, MEDIA\], 'readwrite'\)/);
  assert.match(code, /DRAFT_REVISION_CONFLICT/);
  assert.match(code, /ownerId !== ownerId/);
});
test('Bliki publication is not silently faked', () => {
  const code = read('publishing/blikPublishClient.ts');
  assert.match(code, /transport\.lookup\(operationId\)/);
  assert.match(code, /transport\.confirm\(operationId/);
  assert.doesNotMatch(code, /deleteBlikDraft/);
});
test('Bliki viewer navigation is isolated', () => {
  const code = read('viewer/blikNavigation.ts');
  assert.match(code, /nextAuthor/);
  assert.match(code, /nextBlik/);
  assert.match(code, /previousBlik/);
});
test('Bliki UI uses an explicit opt-in and preserves default Discovery gestures', () => {
  const app = read('../../App.tsx');
  const discovery = read('../../discovery/DiscoveryApp.tsx');
  const slot = read('BlikiDiscoverySlot.tsx');
  assert.match(app, /VITE_BLIKI_V1_ENABLED/);
  assert.match(discovery, /BlikiDiscoverySlot/);
  assert.match(slot, /fetchBlikiFeed/);
  assert.match(slot, /BlikDraftEditor/);
  assert.match(slot, /BlikViewer/);
  assert.doesNotMatch(app, /import.*BlikViewer/);
});
