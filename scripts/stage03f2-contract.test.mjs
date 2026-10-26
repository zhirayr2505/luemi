import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=read("apps/web/src/discovery/DiscoveryApp.tsx");
const style=read("apps/web/src/discovery/discovery.css");
const carousel=read("apps/web/src/ui/PhotoCarousel.tsx");
const forYou=read("apps/web/src/discovery/ForYou.tsx");
const forYouCss=read("apps/web/src/discovery/for-you.css");
const near=read("apps/web/src/discovery/Nearby.tsx");
const model=read("apps/web/src/discovery/model.ts");

assert.ok(!app.includes("is-discovery-scrolling")&&!app.includes("is-discovery-moving"));
assert.ok(!style.includes(".discovery-app:is(.is-discovery-scrolling"),"P0: never toggle blur layer topology in response to scroll");
assert.ok(forYouCss.includes("backdrop-filter:blur(17px)")&&forYouCss.includes("backdrop-filter:blur(14px)"),"accepted Premium Glass intact at rest and in motion");
assert.ok(app.includes('pageTrack.current?.style.setProperty("--luemi-tab-offset"')&&
 app.includes('underline.current?.style.setProperty("--luemi-tab-offset"'),"both pager variables commit atomically before state selection");
assert.ok(app.includes("settleDrag(target);")&&app.includes("if(target!==tabIndex)selectTab(target)")&&
 app.includes("browseMotion.current.paint(g.token")&&app.includes("inputOwnership.current.finish(\"browse\",g.serial)"),
 "pager flushes the final finger position before one exclusive settle");
assert.ok(style.includes(".discovery-page-track.is-settling,.discovery-tab-underline.is-settling"),"GPU hint scoped to track settle only");
assert.ok(app.includes('event.propertyName==="transform"')&&app.includes("finishPagerSettle()"),"remove compositor hint on real transitionend");
assert.ok(app.includes("},380)")&&app.includes("finishPagerSettle(token)")&&
 app.includes("browseMotion.current.owns(token)")&&app.includes("window.setTimeout(()=>finishPagerSettle(token),80)"),
 "WebView fallback retains original 380ms budget, one tokenized terminal commit and checks computed endpoint");
assert.ok(!app.includes("nearbyPrepared")&&app.includes("<Nearby active="),
 "Nearby is mounted before it can be exposed by a finger drag");
assert.ok(near.includes("const pageSize=8")&&near.includes("IntersectionObserver"),"Nearby pagination intact");
assert.ok(app.includes("const savedRef=useRef(feed.saved)")&&app.includes("},[indicate]);"),
 "stable saved callback avoids rerendering unrelated memoized tiles");
assert.ok(forYou.includes("const PersonTile=memo(function PersonTile")&&forYouCss.includes("scroll-snap-type:x proximity"),
 "native horizontal For You carousels preserved");
assert.ok(carousel.includes("frameId.current=window.requestAnimationFrame")&&!carousel.includes("setDx("),
 "PhotoCarousel tracks finger without per-pointer React renders");
assert.ok(carousel.includes("const cancel=(e:ReactPointerEvent)=>{if(!externalGesture)finishAt(e.pointerId,e.clientX,true)")&&
 carousel.includes("finish:(id,x,cancelled)=>finishAt(id,x,cancelled)")&&
 carousel.includes("if(t.horizontal&&!canceled)"),"pointercancel never changes photos");
assert.ok(style.includes("luemi-deck-leave")&&style.includes("luemi-deck-enter"),"original Deck Lift keyframes retained");
assert.ok(model.includes("radius:5000"),"locked 1–5000km radius unchanged");
console.log("✓ Stage 03F.2 P0/P1 regression: stable glass, atomic pager, idle Nearby, native carousels, photo cancel, shared bookmarks");
