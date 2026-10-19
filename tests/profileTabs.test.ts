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
  assert.match(tabs, /Коротко/);
  assert.match(tabs, /Общие интересы/);
  assert.match(tabs, /Совпало/);
  assert.match(tabs, /Добавь интересы в свою анкету, и здесь появятся общие/);
  assert.match(tabs, /Все фото/);
  assert.match(tabs, /profile\.photos\.slice\(0, 3\)/);
});

test('profile collections use true empty states and actions stay below the native scroller', () => {
  const tabs = source('ProfileTabs.tsx');
  const css = source('profileTabs.css');
  const motion = source('ProfileMotion.tsx');
  const motionCss = source('profileMotion.css');
  assert.match(tabs, /profile-collection-ghosts/);
  assert.match(tabs, /aria-hidden="true"/);
  assert.doesNotMatch(css, /min-height:\s*340px/);
  assert.match(motion, /<main[\s\S]*?<\/main>[\s\S]*?profile-action-bar/);
  assert.match(motionCss, /\.has-profile-action \.profile-detail-scroll/);
  assert.match(css, /\.has-profile-action \.profile-tabs-root\s*\{\s*padding-bottom:\s*76px/);
  assert.doesNotMatch(motionCss, /profile-cta\s*\{[^}]*scroll-snap-align/);
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
  assert.doesNotMatch(tabs, /new ResizeObserver/);
  assert.doesNotMatch(tabs, /style\.height/);
  assert.match(tabs, /profile-tabs-glass/);
  assert.match(css, /animation-timeline:\s*--luemi-tabs-x/);
  assert.match(css, /@keyframes luemi-tab-glass/);
  assert.match(css, /align-items:\s*stretch/);
  assert.match(css, /scroll-margin-top:\s*calc\(100cqw - 2 \* var\(--profile-side\)/);
  assert.doesNotMatch(
    tabs,
    /onPointerMove|setPointerCapture|requestAnimationFrame|scrollTo\s*\(|setTimeout\s*\(/,
  );
  assert.match(profile, /<ProfileTabs profile=\{profile\}/);
  assert.equal((profile.match(/<ProfileGallery/g) ?? []).length, 1);
  assert.doesNotMatch(profile, /profile-morph-avatar|<Portrait/);
  assert.match(source('main.tsx'), /import '\.\/profileTabs\.css'/);
});

test('panel selection observes a horizontal marker instead of tall panel area', () => {
  const tabs = source('ProfileTabs.tsx');
  const css = source('profileTabs.css');
  assert.match(tabs, /observer\.observe\(marker\)/);
  const visibilityObserver = tabs.slice(
    tabs.indexOf('new IntersectionObserver'),
    tabs.indexOf('// Only the visible tab'),
  );
  assert.doesNotMatch(visibilityObserver, /observer\.observe\(panel\)/);
  assert.match(tabs, /className="profile-tabs-visibility-marker"/);
  assert.match(css, /\.profile-tabs-visibility-marker/);
  assert.match(css, /height:\s*1px/);
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
