import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const card=read("apps/web/src/discovery/FeedCard.tsx");
const css=read("apps/web/src/discovery/feed-v2.css");
const chrome=read("apps/web/src/discovery/feed-glass-v1.css");
const header=read("apps/web/src/discovery/GlobalHeader.tsx");
const real=read("apps/web/src/discovery/RealDiscoveryHome.tsx");
const demo=read("apps/web/src/discovery/DiscoveryApp.tsx");
const carousel=read("apps/web/src/ui/PhotoCarousel.tsx");
const lens=read("apps/web/src/ui/liquid-glass.css");
const ambient=read("apps/web/src/discovery/feed-ambient.ts");
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

test("feed photo ambient is pre-rasterized, decoded and double-buffered without GPU masks",()=>{
 assert.match(card,/ambientPhoto=person\.photos\[activePhotoIndex\]/);
 assert.match(card,/className="feed-v2-photo-ambient"/);
 assert.match(card,/className="feed-v2-photo-vignette"/);
 assert.match(card,/onIndexChange=\{onAmbientPhotoIndexChange\}/);
 assert.match(carousel,/onIndexChange\?\.\(target\)/);
 assert.match(card,/prepareFeedAmbient\(ambientPhoto,aspect\)/);
 assert.match(card,/incoming\.decode\(\)/);
 assert.match(card,/incoming\.style\.opacity="1"/);
 assert.match(ambient,/ctx\\.filter="blur\\(8px\\)"/);
 assert.match(ambient,/ctx\\.globalCompositeOperation="destination-in"/);
 assert.match(ambient,/toDataURL\\("image\\/webp"/);
 assert.match(ambient,/feather\\.addColorStop\\(\\.39/);
 assert.match(css,/\\.feed-v2-photo-ambient\\{\\s*position:absolute;inset:0/);
 assert.doesNotMatch(css,/\\.feed-v2-photo-ambient\\{[^}]*height:58%/);
 assert.doesNotMatch(css,/height:172\\.414%/);
 assert.match(card,/ambientSwiping\\.current=true;hideAmbient\\(\\)/);
 assert.match(card,/ambientDisplayedSource\\.current=ambientPhoto/);
 assert.match(card,/restoreAmbientAfterCarousel\\(\\)/);
 assert.match(css,/\.feed-v2-photo-ambient img\{[\s\S]*?transition:opacity 110ms/);
 assert.doesNotMatch(css,/filter:blur\(24px\)/);
 assert.doesNotMatch(css,/mask-image:linear-gradient\(to bottom,transparent 35%/);
 assert.match(css,/rgba\(30,16,37,\.58\)/);
});
test("one nested sheet owns lens and details; RAF is layout-read-free and CSS drives fades",()=>{
 assert.match(card,/className="feed-v2-glass feed-v2-sheet lg lg--card"[\s\S]*?className="feed-v2-details"/);
 assert.match(css,/\.discovery-app \.feed-v2-sheet\{/);
 assert.match(lens,/--lg-radius-card:clamp\(26px,7\.4vw,34px\)/);
 assert.match(lens,/--lg-blur:14px/);
 assert.match(lens,/\.lg::before\{/);
 assert.match(lens,/\.lg::after\{/);
 assert.match(lens,/mask-composite:exclude/);
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
 assert.match(css,/bottom:calc\(var\(--bottom-safe\) \+ 9px\)/);
 assert.match(css,/backdrop-filter:blur\(18px\) saturate\(135%\)/);
 assert.match(css,/\.discovery-nav-item\.active/);
 assert.doesNotMatch(chrome,/\.discovery-app \.discovery-bottom-nav\{/);
});
