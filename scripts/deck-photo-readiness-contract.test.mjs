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

test("photo is predecoded before exit, with a bounded recovery path",()=>{
 assert.match(live,/const next=cardRows\[page\+1\]/);
 assert.match(demo,/const next=people\[page\+1\]/);
 assert.match(live,/readyKeysRef\.current\.has\(key\)/);
 assert.match(demo,/readyKeysRef\.current\.has\(key\)/);
 assert.match(live,/window\.setTimeout\(\(\)=>\{[\s\S]*?begin\(\);[\s\S]*?\},2400\)/);
 assert.match(demo,/window\.setTimeout\(\(\)=>\{[\s\S]*?beginLeave\(\);[\s\S]*?\},2400\)/);
 assert.match(live,/waitingNext\.current=null;window\.clearTimeout\(waiting\.timer\)/);
 assert.match(demo,/waitingNext\.current=null;window\.clearTimeout\(waiting\.timer\)/);
 assert.doesNotMatch(prefetch,/ensureMountedCoverReady|querySelector<HTMLImageElement>/);
});
test("successor is mounted but not visible until exit; it has no action buttons",()=>{
 assert.match(live,/visibleRows\.slice\(page,page\+2\)\.map/);
 assert.match(demo,/people\.slice\(page,page\+2\)\.map/);
 assert.match(live,/preview=\{queued\}/);
 assert.match(demo,/preview=\{queued\}/);
 assert.match(live,/aria-hidden=\{queued\} inert=\{queued\}/);
 assert.match(demo,/aria-hidden=\{queued\} inert=\{queued\}/);
 assert.match(css,/\.deck-queued\{[\s\S]*?opacity:0/);
 assert.match(css,/:has\(>\.deck-leaving\)>\.deck-queued\{[\s\S]*?opacity:1/);
 assert.match(feed,/\{!preview&&<div className="moonstone-actions/);
 assert.doesNotMatch(css,/deck-peek-|deck-depth-two/);
 assert.match(feed,/onCoverReady=\{onCoverReady\}/);
 assert.match(photo,/onCoverReadyRef\.current\?\.\(\)/);
});
test("gallery must retain the current image until the requested next image is decoded",()=>{
 assert.match(photo,/const pendingPhoto=useRef<number\|null>\(null\)/);
 assert.match(photo,/const painted=\(i:number\)/);
 assert.match(photo,/image\.classList\.contains\("is-unavailable"\)/);
 assert.match(photo,/next!==activeRef\.current&&\(!painted\(next\)\|\|!paintedVisual\(nextVisual\)\)/);
 assert.match(photo,/return atEdge\|\|unpainted\?delta\*\.16/);
 assert.match(photo,/if\(i!==activeRef\.current&&!painted\(i\)\)\{queuePhoto\(i\);return;\}/);
 assert.match(photo,/image\.classList\.add\("is-ready"\)/);
 assert.match(photo,/loading=\{i===0\|\|\(prioritize/);
 // The queued deck paints its cover without eagerly allocating the next gallery bitmap.
 assert.match(photo,/const load=!gpuSafe\|\|i===0\|\|\(i===1&&prioritize\)/);
 assert.match(photo,/src=\{load\?p\.src:undefined\}/);
 assert.match(photo,/if\(gpuSafe&&!image\.getAttribute\("src"\)\)image\.src=photos\[i\]\.src/);
 assert.match(photo,/warmNeighbors\(i\)/);
 assert.match(photo,/const wrapTimer=useRef<number\|null>\(null\)/);
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
