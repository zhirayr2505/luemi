/** Regression guard for the real Android/WebView photo layer.
 * Static contract only — it does not replace a Galaxy A55 interaction test.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const carousel=read("apps/web/src/ui/PhotoCarousel.tsx");
const photoCss=read("apps/web/src/discovery/moonstone-discovery.css");
const repair=read("apps/web/src/discovery/real-discovery-layout-repair.css");
const card=read("apps/web/src/discovery/FeedCard.tsx");
const base=read("apps/web/src/styles.css");
test("square and portrait uploads are not distorted inside the card",()=>{
 assert.match(card,/gpuSafe adaptive loop ambientActive=\{active\} onCoverReady=\{onCoverReady\}/);
 assert.match(photoCss,/\.carousel-slide-adaptive \.feed-carousel-photo\{/);
 assert.match(photoCss,/object-fit:contain;object-position:center/);
 assert.match(base,/\.carousel-track>\.carousel-slide\{[\s\S]*?flex:0 0 100%/);
 const newCard=read("apps/web/src/discovery/photo-ambient-edition.css");
 assert.match(newCard,/\.moonstone-person-card \.moonstone-photo\{/);
 assert.match(newCard,/\.moonstone-person-card \.moonstone-compact-info\{/);
 assert.doesNotMatch(newCard,/backdrop-filter:blur\(/);
});
test("retired fullscreen photo stretching and edge-reflection code are gone",()=>{
 assert.doesNotMatch(carousel,/photoAtmosphere|atmosphereCache|syncAdaptiveSlide|ResizeObserver|carousel-photo-bleed|--photo-backdrop|canvas\.|toDataURL\(/);
 assert.doesNotMatch(photoCss,/carousel-photo-bleed|--photo-backdrop|\bblur\(11px\)/);
 assert.doesNotMatch(photoCss,/\.carousel-slide-adaptive::after\{/);
 const ambient=read("apps/web/src/discovery/feed-photo-ambient.ts");
 assert.match(ambient,/scrubFeedAmbient/);
 assert.match(ambient,/setBase\(current,state,from\)/);
 assert.match(ambient,/next\.style\.opacity=String\(p\)/);
});
test("cyclic swipes animate across duplicated edges and rebase with WebView fallback",()=>{
 assert.match(carousel,/const cyclic=loop&&photos\.length>1/);
 assert.match(carousel,/const slides=cyclic\?\[photos\.length-1,\.\.\.photos\.map\(\(_,i\)=>i\),0\]/);
 assert.match(carousel,/nextVisual===0\?photos\.length-1:nextVisual===photos\.length\+1\?0:nextVisual-1/);
 assert.match(carousel,/wrappedTo\.current=target\+1/);
 assert.match(carousel,/window\.setTimeout\(finishWrappedTransition,370\)/);
 assert.match(carousel,/onTransitionEnd=\{event=>\{if\(event\.target===event\.currentTarget/);
 assert.match(carousel,/canAdvance:\(direction:-1\|1\)=>cyclic\?photos\.length>1/);
 assert.match(carousel,/const paintedVisual=/);
 assert.match(carousel,/if\(next!==activeRef\.current&&\(!painted\(next\)\|\|!paintedVisual\(nextVisual\)\)\)/);
});
test("action row is lifted and disclosure chevron is free of any panel",()=>{
 assert.match(repair,/--moon-action-gap:24px/);
 assert.match(repair,/\.moonstone-profile-toggle:active\{/);
 assert.match(repair,/background:transparent!important/);
 assert.match(repair,/box-shadow:none!important/);
 assert.match(repair,/\.moonstone-profile-toggle::before/);
 assert.match(repair,/\.moonstone-profile-toggle svg/);
 assert.match(card,/aria-label=\{expanded\?"Свернуть анкету":"Раскрыть анкету"\}/);
});
