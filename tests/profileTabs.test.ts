import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const source = (path: string) =>
  readFileSync(new URL(`../apps/web/src/${path}`, import.meta.url), 'utf8');

test('five LUEMI profile tabs are present and About keeps approved core fields', () => {
  const tabs = source('ProfileTabs.tsx');
  for (const name of ['О себе', 'Блики', 'Фото', 'Аккаунт', 'Подарки'])
    assert.ok(tabs.includes(name), name);
  assert.match(tabs, /Цель знакомства/);
  assert.match(tabs, /Интересы/);
  assert.match(tabs, /О себе/);
  assert.match(tabs, /Информация об аккаунте/);
});

test('owner profile exposes a clear route to the shared five-tab profile viewer', () => {
  const ownProfile = source('Profile.tsx');
  const entry = source('main.tsx');
  assert.match(ownProfile, /Открыть профиль и разделы/);
  for (const name of ['О себе', 'Блики', 'Фото', 'Аккаунт', 'Подарки'])
    assert.ok(ownProfile.includes(name), name);
  assert.match(entry, /import '\.\/profilePage\.css'/);
});

test('native finger-following horizontal snap is independent of vertical profile morph', () => {
  const css = source('profileTabs.css');
  const tabs = source('ProfileTabs.tsx');
  const profile = source('ProfileMotion.tsx');
  assert.match(css, /scroll-snap-type:\s*x mandatory/);
  assert.match(css, /overflow-x:\s*auto/);
  assert.match(css, /scroll-snap-align:\s*start/);
  assert.match(tabs, /new IntersectionObserver/);
  assert.match(tabs, /new ResizeObserver/);
  assert.doesNotMatch(
    tabs,
    /onPointerMove|setPointerCapture|requestAnimationFrame|scrollTo\s*\(|setTimeout\s*\(/,
  );
  assert.match(profile, /<ProfileTabs profile=\{profile\}/);
  assert.equal((profile.match(/<ProfileGallery/g) ?? []).length, 1);
  assert.doesNotMatch(profile, /profile-morph-avatar|<Portrait/);
  assert.match(source('main.tsx'), /import '\.\/profileTabs\.css'/);
});

test('tab navigation meets basic access needs and does not pretend feature launches', () => {
  const tabs = source('ProfileTabs.tsx');
  for (const role of ['tablist', 'tab', 'tabpanel']) assert.ok(tabs.includes(`role="${role}"`));
  assert.match(tabs, /aria-selected/);
  assert.match(tabs, /aria-controls/);
  assert.match(tabs, /aria-labelledby/);
  assert.match(tabs, /event\.key === 'ArrowRight'/);
  assert.match(tabs, /event\.key === 'ArrowLeft'/);
  assert.match(tabs, /event\.key === 'Home'/);
  assert.match(tabs, /event\.key === 'End'/);
  assert.match(tabs, /inert=\{active !== index\}/);
  assert.match(tabs, /Публикации пока не подключены/);
  assert.match(tabs, /оплата подарков пока не подключены/);
  assert.doesNotMatch(tabs, /fetch\s*\(|localStorage|Telegram\.WebApp|sendInvoice/);
});

test('Account tab does not expose private birth date or fabricated dates', () => {
  const tabs = source('ProfileTabs.tsx');
  assert.match(tabs, /ageAt\(profile\.birthDate\)/);
  assert.doesNotMatch(tabs, /profile\.birthDate\s*\}/);
  assert.doesNotMatch(tabs, /createdAt|lastSeenAt|telegramId/);
});

test('new tabs keep theme-specific styling without introducing live moving blur', () => {
  const css = source('profileTabs.css');
  assert.match(css, /data-luemi-theme='dark'/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /backdrop-filter|mix-blend-mode|mask-image|will-change/);
});
