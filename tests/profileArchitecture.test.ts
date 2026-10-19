import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';

const file = (path: string) => new URL(`../apps/web/src/${path}`, import.meta.url);
const source = (path: string) => readFileSync(file(path), 'utf8');

test('one native scroller, one physical photograph and photo-owned rim', () => {
  const component = source('ProfileMotion.tsx');
  assert.match(component, /profile-detail-root/);
  assert.match(component, /<main ref=\{scroller\} className="profile-detail-scroll"/);
  assert.match(component, /className="profile-morph-overlay"/);
  assert.doesNotMatch(component, /profile-morph-avatar|<Portrait/);
  assert.doesNotMatch(component, /profile-morph-circle-rim/);
  assert.equal((component.match(/className="profile-morph-photo"/g) ?? []).length, 1);
  assert.doesNotMatch(source('ProfileGallery.tsx'), /onPhotoChange/);
  assert.ok(component.indexOf('className="profile-morph-overlay"') > component.indexOf('</main>'));
});

test('CSS-only native snap, finite travel and timeline-driven compositing', () => {
  const css = source('profileMotion.css');
  assert.match(css, /\.profile-morph-photo::after/);
  assert.match(css, /@keyframes luemi-photo-rim/);
  assert.doesNotMatch(css, /profile-morph-circle-rim|luemi-reveal-rim/);
  assert.match(css, /scroll-snap-type:\s*y mandatory/);
  assert.match(css, /scroll-snap-stop:\s*always/);
  assert.match(css, /\.profile-snap-open/);
  assert.match(css, /\.profile-snap-closed/);
  assert.match(css, /scroll-timeline-name:\s*--luemi-profile-scroll/);
  assert.match(css, /animation-timeline:\s*--luemi-profile-scroll/);
  assert.match(css, /profile-detail-scroll::after/);
  assert.doesNotMatch(css, /position:\s*sticky/);
  // The static compact name island intentionally uses the owner's approved Liquid Glass blur.
  // Do not reintroduce animated blur, moving masks or layout-driven optical effects.
  assert.doesNotMatch(css, /mix-blend-mode|mask-image|@property/);
  assert.match(css, /\\.profile-morph-compact \\{[\\s\\S]*?backdrop-filter: blur\\(14px\\)/);
  assert.equal((css.match(/backdrop-filter:/g) ?? []).length, 2);
  assert.doesNotMatch(css, /will-change:\s*[^;]*border-radius/);
  assert.match(css, /@keyframes luemi-single-photo-morph/);
  assert.doesNotMatch(css, /profile-morph-avatar|luemi-fade-compact/);
  assert.match(css, /\.profile-morph-compact::before/);
  assert.match(css, /\.profile-morph-compact::after/);
});

test('no JS snap, animated radius, timers or frame-written scroll position', () => {
  const hook = source('motion/useProfilePhotoMorph.ts');
  const pure = source('motion/profileMorph.ts');
  assert.doesNotMatch(
    hook,
    /scrollTo\s*\(|setTimeout\s*\(|snapTarget|snapping|lastClosed|velocity/,
  );
  assert.doesNotMatch(hook, /\.style\.borderRadius|\.style\.boxShadow/);
  const hotPath = hook.slice(hook.indexOf('const drawFallback'), hook.indexOf('const queue'));
  assert.doesNotMatch(hotPath, /\.style\.setProperty|\.style\.borderRadius|\.style\.boxShadow/);
  assert.match(hook, /frame\.style\.setProperty\('--profile-final-scale'/);
  const writes = [...hook.matchAll(/scrollTop\s*=\s*([^;\n]+)/g)].map((match) => match[1].trim());
  assert.deepEqual(writes, ['0'], 'only the initial opening reset is permitted');
  assert.doesNotMatch(pure, /snapTarget/);
  assert.match(hook, /if \(!cssTimeline \|\| reducedMotion \|\| system\.matches\)/);
  assert.match(hook, /if \(reducedClosed !== next\)/);
  assert.match(hook, /scroller\.removeEventListener\('scroll', queue\)/);
  assert.match(hook, /galleryObserver\?\.disconnect\(\)/);
  assert.doesNotMatch(hook, /avatarRef|\.style\.opacity\s*=\s*String\(.*hero/i);
  assert.match(hook, /56 \/ width/);
});

test('logo is static raster with no animated filter/listeners', () => {
  const logo = source('LiquidLogo.tsx');
  const css = source('logo.css');
  assert.match(logo, /wordmark_static_rim_W06\.webp/);
  assert.doesNotMatch(logo, /feMorphology|mask-image|pointermove|scroll|useEffect|useId/);
  assert.doesNotMatch(css, /backdrop-filter|mask-image|mix-blend-mode|filter:/);
});

test('navigation and BackButton do not attach on every render', () => {
  const tg = source('telegram.ts');
  assert.match(tg, /const back = useRef\(onBack\)/);
  assert.match(tg, /\}, \[\]\);/);
  assert.match(tg, /\}, \[full\]\);/);
  const deck = source('motion/SlideDeck.tsx');
  assert.match(deck, /profileTransition/);
  assert.doesNotMatch(deck, /setVisited\(\[\.\.\.visited/);
});

test('old dead CSS absent and separate current style owners', () => {
  assert.equal(existsSync(file('style.css')), false);
  assert.doesNotMatch(
    source('styles.css'),
    /\.logo-island-glass|\.liquid-logo-body|\.profile-morph-stage/,
  );
  assert.match(source('main.tsx'), /import '\.\/logo\.css'/);
  assert.match(source('main.tsx'), /import '\.\/profileMotion\.css'/);
});
