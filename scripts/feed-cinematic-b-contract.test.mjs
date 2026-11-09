import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const card=read("apps/web/src/discovery/FeedCard.tsx");
const css=read("apps/web/src/discovery/feed-v2.css");
const chrome=read("apps/web/src/discovery/feed-glass-v1.css");
const header=read("apps/web/src/discovery/GlobalHeader.tsx");
const real=read("apps/web/src/discovery/RealDiscoveryHome.tsx");
const demo=read("apps/web/src/discovery/DiscoveryApp.tsx");
const carousel=read("apps/web/src/ui/PhotoCarousel.tsx");
const lens=read("apps/web/src/ui/liquid-glass.css");
const deck=read("apps/web/src/discovery/deck-v3.css");

test("approved LUEMI wordmark is the original raster, centered below Telegram safe area",()=>{
 assert.match(header,/wordmark_original_raster_alpha_W06\.webp/);
 assert.match(chrome,/\.lh-browse \.lh-island img\{filter:brightness\(0\) invert\(1\)\}/);
 assert.match(css,/--feed-header-top:max\(calc\(var\(--top-safe\) \+ 8px\),26px\)/);
 assert.match(css,/\.lh-header\.lh-browse \.lh-center\{[\s\S]*?left:50%/);
 assert.match(css,/transform:translateX\(-50%\)/);
 assert.doesNotMatch(header,/>\s*LUEMI\s*</);
 assert.ok(header.indexOf('onClick={onFilters}')<header.indexOf('onClick={onSaved}'));
});

test("photo fills the entire feed and continues beneath all transparent chrome",()=>{
 assert.match(real,/data-feed-visible=\{mainTab==="discover"/);
 assert.match(demo,/data-feed-visible=\{mainTab==="discover"/);
 assert.match(css,/\.discovery-main-panels>\.discovery-panel\.discovery-browse-panel\{[\s\S]*?top:0;bottom:0;height:100%/);
 assert.match(css,/\.discovery-page\[aria-label="Лента"\]\{\s*padding:0/);
 assert.match(css,/\.feed-v2-card\{[\s\S]*?border:0;border-radius:0/);
 assert.match(css,/\.feed-v2-photo\{[\s\S]*?inset:0/);
 assert.match(css,/object-fit:cover/);
 assert.doesNotMatch(css,/\.feed-v2-card\{[^}]*box-shadow:0 14px 30px/s);
});

test("three real browse routes remain distinct and tabs have only text plus thin moving underline",()=>{
 assert.match(real,/\["feed","Лента"\],\["for-you","Для тебя"\],\["nearby","Мир"\]/);
 assert.match(demo,/\["feed","Лента"\],\["for-you","Для тебя"\],\["nearby","Мир"\]/);
 assert.match(real,/tab==="for-you"\?/);
 assert.match(real,/<RealForYou\b/);
 assert.match(real,/<RealNearby\b/);
 assert.match(css,/\.discovery-top-tabs>\.discovery-tab-underline\{[\s\S]*?height:2px/);
 assert.match(css,/--luemi-tab-offset/);
 assert.match(css,/\.discovery-top-tabs\{[\s\S]*?border:0;border-radius:0;background:none/);
 assert.doesNotMatch(chrome,/\.discovery-app \.discovery-top-tabs\{/);
});

test("single decoded photo compositor replaces duplicate blur and third full-screen deck",()=>{
 assert.equal(existsSync(new URL("../apps/web/src/discovery/feed-ambient.ts",import.meta.url)),false);
 assert.doesNotMatch(card,/feed-v2-photo-ambient|prepareFeedAmbient|restoreAmbientAfterCarousel/);
 assert.doesNotMatch(css,/\.feed-v2-photo-ambient\{/);
 assert.match(card,/gpuSafe onCoverReady=\{onCoverReady\}/);
 assert.match(card,/onIndexChange=\{setActivePhotoIndex\}/);
 assert.match(carousel,/gpuSafe\?:boolean/);
 assert.match(carousel,/Math\.abs\(i-active\)<=1\?p\.src:undefined/);
 assert.match(carousel,/translateX\(calc\(-/);
 assert.match(carousel,/is-gpu-safe/);
 assert.match(carousel,/const farJump=gpuSafe&&Math\.abs\(i-activeRef\.current\)>1/);
 assert.match(carousel,/style\.transition=farJump\?/);
 assert.match(real,/visibleRows\.slice\(page,page\+2\)/);
 assert.match(demo,/profiles\.slice\(feed\.index,feed\.index\+2\)/);
 assert.match(css,/\.feed-v2-photo \.carousel-track\.is-gpu-safe\{will-change:auto\}/);
 assert.doesNotMatch(css,/contain:paint;transform:translateZ\(0\)/);
 assert.match(css,/backdrop-filter:none!important/);
 assert.match(css,/\.discovery-deck-stage\.has-profiles>\.deck-active/);
 assert.match(css,/rgba\(30,16,37,\.58\)/);
});
test("one nested sheet owns lens and details; RAF is layout-read-free and CSS drives fades",()=>{
 assert.match(card,/className="feed-v2-glass feed-v2-sheet lg lg--card"[\s\S]*?className="feed-v2-details"/);
 assert.match(css,/\.discovery-app \.feed-v2-sheet\{/);
 assert.match(lens,/--lg-radius-card:clamp\(25px,7\.4vw,34px\)/);
 assert.match(lens,/--lg-blur:13px/);
 assert.match(lens,/\.lg::before\{/);
 assert.match(lens,/\.lg::after\{/);
 assert.match(lens,/mask-composite:exclude/);
 assert.match(lens,/liquid-refraction-v2\.svg#luemi-refraction-v2/);
 assert.match(lens,/--lg-surface:/);
 assert.match(lens,/radial-gradient\(ellipse 47% 45% at var\(--moonstone-x/);
 assert.match(css,/\.discovery-action\.lg\{[\s\S]*?background:var\(--lg-surface\)/);
 assert.match(css,/\.discovery-action\.discovery-special\.lg--accent\{[\s\S]*?background:var\(--lg-surface\)/);
 assert.doesNotMatch(css,/\.discovery-action\.lg\{[^}]*?background:linear-gradient\(180deg,var\(--lg-tint\)/);
 assert.match(lens,/--lg-rim-width:1px/);
 assert.match(css,/background:var\(--lg-surface\)/);
 assert.match(css,/box-shadow:var\(--lg-relief\)/);
 assert.match(card,/desiredClosed=usableHeight<420\?156:usableHeight<590\?179:190/);
 assert.doesNotMatch(css,/inset 0 2px 13px var\(--lg-inner-glow\)/);
 const begin=card.indexOf(" const paint=(value:number)=>{");
 const end=card.indexOf("\n const flushFinger=",begin);
 assert.ok(begin>0&&end>begin);
 const paint=card.slice(begin,end);
 assert.match(paint,/--sheet-p/);
 assert.match(paint,/glass\.current\.style\.height=/);
 assert.doesNotMatch(paint,/scaleY\(/);
 assert.doesNotMatch(paint,/getComputedStyle|offsetWidth|clientHeight|scrollHeight|backdropFilter/);
 assert.doesNotMatch(paint,/actionsView\.current\.style\.(?:opacity|transform)/);
 assert.match(card,/if\(gesture\.current\|\|run\.current\)\{measureDirty\.current=true;return;\}/);
 assert.doesNotMatch(card,/resize\.observe\(content\.current\)/);
 assert.match(card,/Math\.abs\(dy\)>12&&Math\.abs\(dy\)>Math\.abs\(dx\)\*1\.6/);
 assert.match(css,/opacity:calc\(1 - var\(--sheet-p\)\)/);
 assert.match(css,/prefers-reduced-transparency:reduce/);
 assert.match(css,/data-profile-renderer=android/);
});
test("name location quote and interest chips are actual profile data in an optical panel",()=>{
 assert.match(card,/person\.name\}, \{person\.age\}/);
 assert.match(card,/className="discovery-place"/);
 assert.match(card,/className="feed-v2-about"/);
 assert.match(card,/className="feed-v2-interests"/);
 assert.match(card,/person\.interests\.slice\(0,2\)/);
 assert.ok(card.indexOf('className="feed-v2-about"')<card.indexOf('className="feed-v2-interests"'));
 assert.match(css,/\.feed-v2-about::before\{/);
 assert.match(css,/font-style:italic/);
 assert.match(css,/color-mix\(in srgb,var\(--chip-from/);
 assert.match(css,/\.discovery-interests \.interest-chip svg\{/);
});

test("existing pass / special / like actions keep handlers, business logic and swipe exit keys",()=>{
 const pass=card.indexOf('["pass","Пропустить",X]');
 const special=card.indexOf('["special","Особенная симпатия",Star]');
 const like=card.indexOf('["like","Нравится",Heart]');
 assert.ok(pass>=0&&special>pass&&like>special);
 assert.match(card,/onClick=\{\(\)=>onAction\(kind\)\}/);
 assert.match(real,/likePublishedUser\(current\.id,kind==="special"\?"super":"ordinary"\)/);
 assert.match(css,/\.discovery-action\.discovery-special\{[\s\S]*?width:clamp\(112px,33vw,151px\)/);
 assert.match(css,/border-radius:999px/);
 assert.match(deck,/@keyframes luemi-deck-exit-left/);
 assert.match(deck,/@keyframes luemi-deck-exit-right/);
 assert.match(deck,/@keyframes luemi-deck-exit-top/);
 assert.doesNotMatch(css,/🔥/);
});

test("bottom nav keeps original destinations inside a single photograph-backed lens",()=>{
 assert.match(real,/<LuemiBottomNavigation/);
 assert.match(demo,/className="discovery-bottom-nav"/);
 assert.match(css,/\.discovery-app\[data-feed-visible="true"\]>\.discovery-bottom-nav\{/);
 assert.match(css,/bottom:calc\(var\(--bottom-safe\) \+ 16px\)/);
 assert.match(css,/backdrop-filter:blur\(18px\) saturate\(135%\)/);
 assert.match(css,/\.discovery-nav-item\.active/);
 assert.doesNotMatch(chrome,/\.discovery-app \.discovery-bottom-nav\{/);
});
