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
test("all live and private QA cards use sharp adaptive photo layout",()=>{
 assert.match(card,/gpuSafe adaptive loop onCoverReady=\{onCoverReady\}/);
 assert.match(carousel,/const full=Math\.abs\(Math\.log\(ratio\/frameRatio\)\)<\.075/);
 assert.match(carousel,/slide\.dataset\.photoFit=full\?"full":ratio>frameRatio\?"letterbox":"pillarbox"/);
 assert.match(photoCss,/\.carousel-slide-adaptive \.feed-carousel-photo\{[\s\S]*?object-fit:contain/);
 assert.match(photoCss,/\[data-photo-fit="full"\] \.feed-carousel-photo\{[\s\S]*?object-fit:cover/);
 assert.match(photoCss,/\[data-photo-fit="pillarbox"\] \.feed-carousel-photo/);
 assert.match(photoCss,/-webkit-mask-image:linear-gradient/);
 assert.match(photoCss,/position:absolute;z-index:1;top:42%;left:50%/);
 assert.match(photoCss,/black 23%,black 72%/);
 assert.doesNotMatch(photoCss,/black 9%,black 91%/);
 assert.match(photoCss,/background-size:cover;background-position:center/);
 assert.match(base,/\.carousel-track>\.carousel-slide\{[\s\S]*?flex:0 0 100%/);
});
test("color-matched blurred atmosphere is thumbnail sized, never a live framebuffer blur",()=>{
 assert.match(carousel,/canvas\.width=72/);
 assert.match(carousel,/Math\.round\(72\/Math\.max\(\.25,frameRatio\)\)/);
 assert.match(carousel,/const targetRatio=canvas\.width\/canvas\.height/);
 assert.match(carousel,/context\.drawImage\(image,\(width-sampleWidth\)\/2/);
 assert.match(carousel,/photoAtmosphere\(image,frameRatio\)/);
 assert.match(carousel,/atmosphereCache=new Map<string,string>/);
 assert.match(carousel,/ATMOSPHERE_CACHE_LIMIT=32/);
 assert.match(carousel,/canvas\.toDataURL\("image\/webp",\.72\)/);
 assert.match(photoCss,/background-image:var\(--photo-atmosphere/);
 assert.match(photoCss,/\.carousel-slide-adaptive\[data-photo-fit="full"\]::before\{display:none\}/);
 assert.doesNotMatch(carousel,/canvas\.toBlob|localStorage|sessionStorage|fetch\(/);
 const adaptiveCss=photoCss.slice(photoCss.indexOf("/* Seamless adaptive photo stage"));
 assert.ok(adaptiveCss.length>300);
 assert.doesNotMatch(adaptiveCss,/backdrop-filter:blur\(/);
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
