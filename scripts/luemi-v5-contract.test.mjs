import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const tokens=read("apps/web/src/ui/luemi-v5.css");
const header=read("apps/web/src/discovery/GlobalHeader.tsx");
const feed=read("apps/web/src/discovery/FeedCard.tsx");
const chats=read("apps/web/src/chats/chats.css");
const chatView=read("apps/web/src/chats/RealChats.tsx");
const legacyFeed=read("apps/web/src/registration/real-live-feed.css");
const publication=read("apps/web/src/registration/publication-journey.css");
const discovery=read("apps/web/src/discovery/RealDiscoveryHome.tsx");
const registration=read("apps/web/src/registration/v2/RealRegistration.tsx");
const app=read("apps/web/src/App.tsx");
const legacyRealFeed=read("apps/web/src/registration/RealLiveFeed.tsx");

test("V5 exposes one semantic Soft Plum token set",()=>{
 for(const token of ["--luemi-bg","--luemi-surface","--luemi-glass","--luemi-lavender","--luemi-rose","--luemi-border","--luemi-text"])
  assert.match(tokens,new RegExp(token.replaceAll("-","\\-")));
 assert.match(tokens,/html,body,#root\{background:var\(--luemi-bg-deep\)/);
 assert.match(tokens,/\.milky-mist::before[^}]*animation:none/);
});

test("secondary real routes keep dark Soft Plum surfaces without decorative motion loops",()=>{
 assert.doesNotMatch(legacyFeed,/background\s*:\s*(?:#fff(?:fff)?|white)(?:[;}])/i);
 assert.doesNotMatch(publication,/animation:[^;}]*infinite/);
 assert.match(publication,/\.luemi-publication-petals\{display:none\}/);
});

test("the immutable original raster remains the global brand source",()=>{
 assert.match(header,/wordmark_original_raster_alpha_W06\.webp/);
 assert.doesNotMatch(header,/>\s*luemi\s*</i);
});

test("feed compact content follows approved information order",()=>{
 const about=feed.indexOf('className="feed-v2-about"');
 const interests=feed.indexOf('className="feed-v2-interests"');
 assert.ok(about>0&&interests>about);
 assert.match(feed,/person\.interests\.length-2/);
});

test("real chat list and thread share V5 without white route surfaces",()=>{
 assert.match(chatView,/LuemiSegmentedTabs/);
 assert.match(chatView,/LuemiEmptyState/);
 assert.match(chatView,/onThreadChange/);
 assert.doesNotMatch(chats,/background\s*:\s*(?:#fff(?:fff)?|white)(?:[;}])/i);
 assert.match(chats,/var\(--luemi-bg/);
 assert.match(chats,/data-keyboard=open/);
});

test("likes route uses the shared V5 states and avatar system",()=>{
 for(const component of ["LuemiAvatar","LuemiEmptyState","LuemiGlassPanel","LuemiIconButton","LuemiSkeleton"])
  assert.match(discovery,new RegExp(component));
 assert.doesNotMatch(discovery,/className="discovery-placeholder"/);
 assert.doesNotMatch(discovery,/Поставил\(а\) тебе симпатию\s*💜/);
 assert.match(tokens,/prefers-reduced-motion:reduce[^\n]*\.luemi-v5-skeleton-avatar/);
});

test("production controls use the shared icon system instead of decorative emoji",()=>{
 const productionSources=[discovery,registration,publication,app,legacyRealFeed].join("\n");
 assert.doesNotMatch(productionSources,/[💜✨🔥❤️😊🎉☕🌍🎵🏃📚🎬]/u);
 assert.match(legacyRealFeed,/<Heart size=\{17\}\/\>/);
});
