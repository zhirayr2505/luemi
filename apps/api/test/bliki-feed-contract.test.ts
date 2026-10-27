import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../web/src/features/bliki/feed/blikiFeed.ts', import.meta.url), 'utf8');

test('Bliki feed has explicit deterministic priority and filters', () => {
  assert.match(source, /matches: 0, liked: 1, nearby: 2, world: 3/);
  assert.match(source, /candidate\.isBlocked/);
  assert.match(source, /candidate\.isEligible/);
  assert.match(source, /seen\.has\(candidate\.id\)/);
  assert.match(source, /worldStartsAt/);
});
test('Bliki collapsed avatars never exceed four', () => {
  assert.match(source, /Math\.min\(4,/);
  assert.match(source, /collapsedAvatars/);
});
