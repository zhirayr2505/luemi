import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const icons = [
  'tab-discover',
  'tab-likes',
  'tab-chats',
  'tab-profile',
  'action-save',
  'action-skip',
  'action-like',
  'action-special',
  'action-undo',
  'utility-photo-add',
  'utility-location',
  'utility-microphone',
];
test('all 24 W05 approved icons are present as independent theme-specific SVGs', () => {
  for (const theme of ['light', 'dark'])
    for (const icon of icons) {
      const file = join(
        root,
        'apps',
        'web',
        'public',
        'assets',
        'icons',
        'core',
        theme,
        icon + '.svg',
      );
      assert.equal(existsSync(file), true, `Missing ${theme}/${icon}`);
      const svg = readFileSync(file, 'utf8');
      assert.match(svg, /<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
      assert.match(svg, /viewBox="0 0 24 24"/);
      assert.match(svg, /<title>.+<\/title>/);
      assert.doesNotMatch(svg, /<script\b|\sonload=|<foreignObject\b|<image\b|xlink:href=/i);
    }
});
test('W06 preview bytes retained; original brand remains recorded in handoff', () => {
  const img = readFileSync(
    join(root, 'apps/web/public/assets/brand/derivatives/wordmark_W06_preview.webp'),
  );
  assert.equal(img.toString('ascii', 0, 4), 'RIFF');
  assert.equal(img.toString('ascii', 8, 12), 'WEBP');
  assert.equal(
    createHash('sha256').update(img).digest('hex'),
    'f6347ecc35cc668e24d429d6ca028de6ea0e223ee67f9e191076d4c1b722343d',
  );
});
