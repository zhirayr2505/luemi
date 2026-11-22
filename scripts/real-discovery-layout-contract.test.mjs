import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const real=read("apps/web/src/discovery/RealDiscoveryHome.tsx");
const fix=read("apps/web/src/discovery/real-discovery-layout-repair.css");
const base=read("apps/web/src/discovery/moonstone-discovery.css");
const nav=read("apps/web/src/ui/LuemiV5.tsx");
test("Vivid Matte repair loads after lazy Moonstone instead of only at entry",()=>{
 const old=real.indexOf('import "./moonstone-discovery.css";');
 const repair=real.indexOf('import "./real-discovery-layout-repair.css";');
 assert.ok(old>=0&&repair>old);
 assert.match(fix,/\.real-discovery-home\[data-feed-visible="true"\] \.discovery-top-tabs>button\.active\{/);
 assert.match(fix,/border-radius:999px/);
});
test("empty feed stays beneath header and above dock on fullscreen Android",()=>{
 assert.match(real,/className="real-discovery-empty"/);
 assert.match(real,/title="Пока нет анкет"/);
 assert.match(fix,/\.real-discovery-deck \.discovery-deck-layer>\.real-discovery-empty\{/);
 assert.match(fix,/top:calc\(var\(--top-safe,0px\) \+ 105px\)/);
 assert.match(fix,/bottom:calc\(var\(--bottom-safe,0px\) \+ 102px\)/);
 assert.match(fix,/justify-content:center/);
 assert.match(fix,/\.lh-header \.lh-island::before/);
});
test("the graphite dock uses icon-only tabs with accessible labels and count badges",()=>{
 assert.match(base,/\.discovery-nav-item span\{display:none\}/);
 assert.match(fix,/\.discovery-bottom-nav \.discovery-nav-item \.luemi-nav-label\{[^}]*clip-path:inset\(50%\)/);
 assert.match(fix,/\.discovery-bottom-nav \.discovery-nav-item\.active\{[^}]*color:var\(--luemi-coral-light\);[^}]*background:transparent/);
 assert.match(nav,/className="luemi-nav-label">\{label\}/);
 assert.match(nav,/className="luemi-nav-badge"/);
});
test("private preview stays server-verified and cannot leak into real feed",()=>{
 assert.match(real,/setQaAllowed\(result\?\.allowed===true\)/);
 assert.match(real,/demoMode&&qaAllowed\?<DemoFeedSandbox/);
 assert.match(real,/onTryDemo=\{\(\)=>\{if\(qaAllowed\)setDemoMode\(true\)/);
});

// V9 regression: snapshot-sourced fixes must remain structural, not one-off overlays.
const feedStyles=read("apps/web/src/discovery/real-discovery.css");
const forYouStyles=read("apps/web/src/discovery/for-you.css");
const nearbyStyles=read("apps/web/src/discovery/nearby.css");
const likesStyles=read("apps/web/src/discovery/likes-gallery.css");
const likesSource=read("apps/web/src/discovery/LikesGallery.tsx");
const nearSource=read("apps/web/src/discovery/RealNearby.tsx");
const forYouSource=read("apps/web/src/discovery/RealForYou.tsx");
test("feed loading skeleton sits under tabs and above navigation, never bottom-aligned",()=>{
 assert.match(feedStyles,/real-discovery-feed-loading\s*\{[^}]*inset:calc\(var\(--top-safe,0px\) \+ 104px\)/);
 assert.doesNotMatch(feedStyles,/align-content:end/);
 assert.match(feedStyles,/real-discovery-feed-skeleton-content/);
});
test("For You and World use Vivid Matte rather than legacy violet",()=>{
 assert.match(forYouStyles,/\.fy-real\s*\{[^}]*--fy-glass:linear-gradient\(145deg,var\(--luemi-glass\),var\(--luemi-surface\)\)/);
 assert.match(nearbyStyles,/\.nb-root\s*\{[^}]*background:var\(--luemi-bg-deep\)/);
 assert.doesNotMatch(nearbyStyles,/#6E3EFF|#4C2787|#8D65C4/);
 assert.match(nearSource,/\{filtered.length\} \{countWord\}/);
 assert.match(forYouSource,/ranked.length>0&&shown.filter/);
});
test("loading never hangs forever and likes placeholders match their cards",()=>{
 assert.match(real,/Анкеты загружаются слишком долго/);
 assert.match(likesSource,/Симпатии загружаются слишком долго/);
 assert.match(likesStyles,/likes-loading-card/);
 assert.doesNotMatch(likesStyles,/#2f202d|#1d1823|#372633/);
});
test("browse root tabs do not change Telegram Close into Back",()=>{
 assert.match(real,/const canNavigateBack=/);
 const predicate=real.slice(real.indexOf("const canNavigateBack="),real.indexOf("const invokeBack"));
 assert.doesNotMatch(predicate,/browse!=="feed"/);
});
