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
test("feed contains original photo, with no forced cropping for square uploads",()=>{
 assert.match(card,/gpuSafe adaptive loop onCoverReady=\{onCoverReady\}/);
 assert.match(carousel,/const full=Math\.abs\(Math\.log\(ratio\/frameRatio\)\)<\.075/);
 assert.match(carousel,/slide\.dataset\.photoFit=full\?"full":ratio>frameRatio\?"letterbox":"pillarbox"/);
 assert.match(photoCss,/\.carousel-slide-adaptive \.feed-carousel-photo\{[\s\S]*?object-fit:contain/);
 assert.match(photoCss,/\[data-photo-fit="full"\] \.feed-carousel-photo\{[\s\S]*?object-fit:cover/);
 assert.match(photoCss,/\[data-photo-fit="pillarbox"\] \.feed-carousel-photo/);
 assert.match(base,/\.carousel-track>\.carousel-slide\{[\s\S]*?flex:0 0 100%/);
});
test("background uses exact same original photo, blurred only behind sharp image",()=>{
 assert.match(carousel,/slide\.style\.setProperty\("--photo-backdrop",'url\('\+JSON\.stringify\(source\)\+'\)'\)/);
 assert.match(carousel,/slide\.style\.removeProperty\("--photo-backdrop"\)/);
 assert.match(photoCss,/background-image:var\(--photo-backdrop,none\)/);
 assert.match(photoCss,/background-size:cover;background-position:center/);
 assert.match(photoCss,/filter:blur\(17px\) brightness\(\.84\) saturate\(\.96\)/);
 assert.match(photoCss,/\.carousel-slide-adaptive\[data-photo-fit="full"\]::before\{[\s\S]*?display:none/);
 assert.match(photoCss,/-webkit-mask-image:linear-gradient\(180deg,[\s\S]*?black 12%,[\s\S]*?black 88%/);
 assert.doesNotMatch(photoCss,/black 30%,black 70%/);
 assert.doesNotMatch(carousel,/photoAtmosphere|atmosphereCache|canvas\.|toDataURL\(/);
 assert.doesNotMatch(photoCss,/--photo-atmosphere|is-photo-atmosphere-fallback/);
 const adaptiveCss=photoCss.slice(photoCss.indexOf("/* Same-image photo stage."));
 assert.ok(adaptiveCss.length>400);
 assert.doesNotMatch(adaptiveCss,/backdrop-filter:/);
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
