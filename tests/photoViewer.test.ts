import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';

const file = (path: string) => new URL(`../apps/web/src/${path}`, import.meta.url);
const source = (path: string) => readFileSync(file(path), 'utf8');

test('full-screen viewer is a native dialog with accessible photo actions', () => {
  assert.equal(existsSync(file('PhotoViewer.tsx')), true);
  const viewer = source('PhotoViewer.tsx');
  assert.match(viewer, /<dialog/);
  assert.match(viewer, /showModal\(\)/);
  assert.match(viewer, /aria-label="Закрыть"/);
  assert.match(viewer, /Действия с фото/);
  assert.match(viewer, /Пожаловаться на фото/);
  assert.match(viewer, /Скопировать ссылку/);
  assert.match(source('photoViewer.css'), /scroll-snap-type:\s*x mandatory/);
  assert.match(source('main.tsx'), /import '\.\/photoViewer\.css'/);
});

test('the shared viewer is the only photo preview and lives outside the profile scroller', () => {
  const tabs = source('ProfileTabs.tsx');
  const profile = source('ProfileMotion.tsx');
  assert.doesNotMatch(tabs, /\bModal\b|profile-photo-preview/);
  assert.match(
    tabs,
    /className="profile-photo-tile"[\s\S]*?onClick=\{\(\) => onOpenPhoto\(index\)\}/,
  );
  assert.doesNotMatch(profile, /<Portrait/);
  const mainEnd = profile.indexOf('</main>');
  assert.ok(mainEnd >= 0);
  assert.ok(profile.indexOf('<PhotoViewer') > mainEnd);
});
