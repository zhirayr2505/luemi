import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const photo=read("apps/web/src/ui/PhotoCarousel.tsx");
const prefetch=read("apps/web/src/discovery/feed-image-preload.ts");
const demo=read("apps/web/src/discovery/DemoFeedSandbox.tsx");
const live=read("apps/web/src/discovery/RealDiscoveryHome.tsx");
const feed=read("apps/web/src/discovery/FeedCard.tsx");
const css=read("apps/web/src/discovery/deck-v3.css");

test("the next profile never enters until its own DOM img is decoded",()=>{
 assert.match(prefetch,/ensureMountedCoverReady\(/);
 assert.match(prefetch,/querySelector<HTMLImageElement>\("\.carousel-track img:first-child"\)/);
 assert.match(prefetch,/cover\.decode\(\)/);
 assert.match(prefetch,/cover\.classList\.add\("is-ready"\)/);
 assert.match(demo,/ensureMountedCoverReady\(deckRef\.current\?\.querySelector/);
 assert.match(live,/ensureMountedCoverReady\(deckRef\.current\?\.querySelector/);
 assert.match(demo,/if\(!ok\)\{/,"failed demo media cannot promote a blank card");
 assert.match(live,/waitingGate\.current=\{key,begin\}/,"server likes must not be repeated while waiting");
 assert.match(live,/if\(ok\)\{markReady\(key\);\}/);
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
});

test("gallery must retain the current image until the requested next image is decoded",()=>{
 assert.match(photo,/const pendingPhoto=useRef<number\|null>\(null\)/);
 assert.match(photo,/const painted=\(i:number\)/);
 assert.match(photo,/if\(next!==activeRef\.current&&!painted\(next\)\)queuePhoto\(next\)/);
 assert.match(photo,/return atEdge\|\|unpainted\?delta\*\.16/);
 assert.match(photo,/if\(i!==activeRef\.current&&!painted\(i\)\)\{queuePhoto\(i\);return;\}/);
 assert.match(photo,/image\.classList\.add\("is-ready"\)/);
 assert.match(photo,/loading=\{i===0\|\|\(prioritize/);
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
