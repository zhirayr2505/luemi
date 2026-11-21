import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(path,"utf8");
const tokens=read("apps/web/src/ui/luemi-v5.css");
const discovery=read("apps/web/src/ui/vivid-discovery.css");
const routes=read("apps/web/src/ui/vivid-routes.css");
const entry=read("apps/web/src/main.tsx");
const card=read("apps/web/src/discovery/FeedCard.tsx");
const home=read("apps/web/src/discovery/RealDiscoveryHome.tsx");
const chats=read("apps/web/src/chats/RealChats.tsx");
test("Vivid Matte palette is authoritative and loaded last",()=>{
 for(const token of ["--luemi-bg:#151B25","--luemi-bg-deep:#10151D","--luemi-coral:#E96A86","--luemi-glass:#354154","--luemi-lavender:#9EBFE2"])
  assert.ok(tokens.includes(token),token);
 assert.match(entry,/import "\.\/ui\/luemi-v5\.css";[\s\S]*?import "\.\/ui\/vivid-routes\.css";[\s\S]*?import "\.\/ui\/vivid-discovery\.css";/);
});
test("the four destinations map to their accessible labels and SVG glyphs",()=>{
 for(const dest of ['{id:"discover",label:"Знакомства",icon:NavigationDiscover','{id:"likes",label:"Симпатии",icon:NavigationLikes',
  '{id:"chats",label:"Чаты",icon:NavigationChats','{id:"profile",label:"Профиль",icon:NavigationProfile'])
  assert.ok(home.includes(dest),dest);
 assert.match(chats,/disabled:true,hint:"Чаты из бликов/);
 assert.doesNotMatch(home,/\["bliki"/);
 assert.match(discovery,/\.discovery-app>\.discovery-bottom-nav \.discovery-nav-item span/);
});
test("the five action circles map only to supported real actions",()=>{
 for(const cls of ["moonstone-undo-button","moonstone-pass-button","moonstone-special-button","moonstone-like-button","moonstone-save-button"])
  assert.ok(card.includes(cls),cls);
 assert.match(card,/onAction\("undo"\)/);
 assert.match(card,/onAction\("save"\)/);
 assert.match(card,/performAction\("special"\)/);
 assert.match(card,/commit\("like"\)/);
 assert.match(card,/raw>=\.72/);
 assert.doesNotMatch(card,/boostPublishedUser|spendStars/);
});
test("no light halos or fullscreen blur return to the hot photo path",()=>{
 assert.match(discovery,/\.moonstone-actions-vivid/);
 assert.match(discovery,/backdrop-filter:none;/);
 assert.doesNotMatch(discovery+routes,/(?:box-shadow:|,)\s*0\s+0\s+[1-9]\d*px/);
 assert.doesNotMatch(discovery,/(?:^|[;{])\s*filter:blur\(/m);
 assert.doesNotMatch(card,/moonstone-blur-photo|adaptiveFullscreen/);
});
test("all product routes receive shared matte components",()=>{
 for(const sel of [".v2-runtime",".lc-bubble",".fy-real",".nb-card",".owner-premium-profile",".v3-int-root",".luemi-publication-journey",".luemi-v5-segments"])
  assert.ok(routes.includes(sel),sel);
});
