import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const photo=read("apps/web/src/ui/PhotoCarousel.tsx");
const prefetch=read("apps/web/src/discovery/feed-image-preload.ts");
const demo=read("apps/web/src/discovery/DemoFeedSandbox.tsx");
const live=read("apps/web/src/discovery/RealDiscoveryHome.tsx");
const feed=read("apps/web/src/discovery/FeedCard.tsx");
const realClient=read("apps/web/src/registration/real-live-client.ts");
const css=read("apps/web/src/discovery/deck-v3.css");

test("media readiness can never gate or freeze an accepted feed action",()=>{
 assert.doesNotMatch(prefetch,/ensureMountedCoverReady|querySelector<HTMLImageElement>/);
 assert.doesNotMatch(demo,/ensureMountedCoverReady|coverGate/);
 assert.doesNotMatch(live,/ensureMountedCoverReady|waitingGate|gateDeadline|coverGate/);
 assert.match(demo,/Android WebView may defer image\/timer callbacks[\s\S]*?beginLeave\(\)/);
 assert.match(live,/Never hold the accepted action behind media readiness[\s\S]*?begin\(\)/);
});

test("queued photo peeks are invisible before decode, then fade without repainting interior",()=>{
 assert.match(demo,/deck-photo-pending/);
 assert.match(live,/deck-photo-pending/);
 assert.match(css,/\.deck-queued\.deck-photo-pending\{\s*opacity:0/);
 assert.match(css,/transition:opacity \.18s ease-out/);
 assert.doesNotMatch(css,/\.deck-queued :is\(/,
  "whole queued card is composited, without separate hide/show of its buttons");
 assert.doesNotMatch(css,/opacity:0!important/);
 assert.match(feed,/onCoverReady=\{onCoverReady\}/);
 assert.match(photo,/onCoverReadyRef\.current\?\.\(\)/);
 assert.match(photo,/className="feed-carousel-fallback"/);
 assert.match(photo,/image\.classList\.add\("is-unavailable"\)/);
 assert.match(photo,/data-fallback=\{p\.fallback\|\|undefined\}/);
});

test("gallery must retain the current image until the requested next image is decoded",()=>{
 assert.match(photo,/const pendingPhoto=useRef<number\|null>\(null\)/);
 assert.match(photo,/const painted=\(i:number\)/);
 assert.match(photo,/image\.classList\.contains\("is-unavailable"\)/);
 assert.match(photo,/if\(next!==activeRef\.current&&!painted\(next\)\)warmPhoto\(next\)/);
 assert.match(photo,/return atEdge\|\|unpainted\?delta\*\.16/);
 assert.match(photo,/if\(i!==activeRef\.current&&!painted\(i\)\)\{queuePhoto\(i\);return;\}/);
 assert.match(photo,/image\.classList\.add\("is-ready"\)/);
 assert.match(photo,/loading=\{i===0\|\|\(prioritize/);
 assert.match(photo,/src=\{!gpuSafe\|\|i<=1\?p\.src:undefined\}/);
 assert.match(photo,/warmPhoto\(i-1\);warmPhoto\(i\+1\)/);
 assert.doesNotMatch(photo,/Math\.abs\(i-active\)<=1\?p\.src:undefined/,
  "React must not detach an already painted src when the user returns to it");
 assert.doesNotMatch(photo,/style=\{\{opacity:0/,
  "React render may not reset a decoded photo to opacity zero");
});

test("background photo decoding is shared, bounded and survives page changes",()=>{
 assert.match(prefetch,/const MAX_CONCURRENT=4/);
 assert.match(prefetch,/const inflight=new Map<string,Promise<boolean>>/);
 assert.match(prefetch,/const waiting:Array<\(\)=>void>=\[\]/);
 assert.match(prefetch,/if\(next\)next\(\)/);
 assert.match(prefetch,/const existing=inflight\.get\(url\)/);
 assert.match(prefetch,/preloadUpcomingFeedPhotos\(/);
 assert.match(live,/preloadUpcomingFeedPhotos\(cardRows\.slice\(page,page\+6\)/);
 assert.match(demo,/preloadUpcomingFeedPhotos\(people\.slice\(page,page\+6\)/);
});

test("real deck always settles a finished action even when media preparation fails",()=>{
 assert.match(live,/try\{commit\(\);\}\s*finally\{/);
 assert.match(live,/locked\.current=false/);
 assert.match(live,/requestPending\.current=true/);
 assert.match(live,/\}finally\{\s*requestPending\.current=false/);
 assert.match(realClient,/window\.setTimeout\(\(\)=>controller\.abort\(\),10000\)/);
 assert.match(realClient,/if\(controller\.signal\.aborted\)throw new Error\("like_timeout"\)/);
});

test("focus and expanded copy share one retained photo and one progress source",()=>{
 const visual=read("apps/web/src/discovery/moonstone-discovery.css");
 assert.match(feed,/releasePhotoHold\(event\.pointerId\)/);
 assert.match(feed,/window\.addEventListener\("blur",resetHold\)/);
 assert.match(feed,/--profile-info-y/);
 assert.match(feed,/--profile-interests-p/);
 assert.match(feed,/--profile-extra-p/);
 assert.match(visual,/\.moonstone-profile-drawer\{[\s\S]*?border:0;border-radius:0/);
 assert.match(visual,/\.moonstone-reveal-interests\{/);
 assert.match(visual,/\.discovery-app\[data-photo-focus=true\]/);
 assert.doesNotMatch(visual,/@keyframes moonstone-photo-focus-away/);
 assert.match(feed,/current\.max\*\.72/);
});
