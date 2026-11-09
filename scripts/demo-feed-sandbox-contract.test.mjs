import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sandbox=read("apps/web/src/discovery/DemoFeedSandbox.tsx");
const shell=read("apps/web/src/discovery/RealDiscoveryHome.tsx");
const photos=read("apps/web/src/discovery/demo-people.ts");
const card=read("apps/web/src/discovery/FeedCard.tsx");
const style=read("apps/web/src/discovery/demo-feed-sandbox.css");

test("fictional profiles remain isolated; empty genuine feed automatically opens QA preview",()=>{
 assert.match(shell,/const \[demoMode,setDemoMode\]=useState\(\(\)=>\{/);
 assert.match(shell,/params\.get\("luemiDemo"\)==="1"\|\|start==="demo"/);
 assert.match(shell,/id==="feed"&&demoMode\?<DemoFeedSandbox/);
 assert.match(shell,/<LiveDeck key=\{id\+"-"\+feedDraft\.searchScope/);
 assert.match(shell,/<FeedCard person=\{toCard\(person\)\} real/);
 assert.match(shell,/onExit=\{\(\)=>\{setDemoVisitor\(null\);autoDemoShown\.current=true;setDemoMode\(false\);\}\}/);
 assert.match(shell,/initialFeed\?\.profiles\.length===0/);
 assert.match(shell,/onEmptyFeed=\{offerDemoOnEmpty\}/);
 assert.match(shell,/Проверить тестовые карточки \(15\)/);
 assert.match(shell,/Посмотреть тестовые карточки/);
});

test("synthetic profiles are not inserted into server, likes, matches or conversations",()=>{
 assert.doesNotMatch(sandbox,/likePublishedUser|blockPublishedUser|createChatTransport|fetch\(|getPublishedFeed|localStorage|sessionStorage|indexedDB/);
 assert.match(sandbox,/onExitDemo=\{foreground\?onExit:undefined\}/);
 assert.doesNotMatch(sandbox,/demo-qa-ribbon|demo-qa-counter/,
  "The test feed must not reserve vertical space for a QA toolbar");
 assert.match(sandbox,/Реальные лайки не отправляются/);
 assert.match(sandbox,/onExit/);
 assert.match(sandbox,/setPage\(0\)/);
 assert.match(card,/className="discovery-demo-label">Демо<\/span>/);
 assert.match(card,/className="discovery-demo-label feed-v2-demo-exit"/);
 assert.match(sandbox,/busy=\{!foreground\|\|leaving\}/);
 assert.match(sandbox,/people\.slice\(page,page\+3\)\.map/,"Three keyed card window is retained");
 assert.match(sandbox,/preloadUpcomingFeedPhotos/);
});

test("demo card opens the ORIGINAL full-screen visitor profile, never a small custom window",()=>{
 assert.match(sandbox,/onOpenProfile:\(person:DemoPerson\)=>void/);
 assert.match(sandbox,/onOpenProfile=\{foreground\?\(\)=>onOpenProfile\(person\)/);
 assert.match(sandbox,/onInterests=\{foreground\?\(\)=>onOpenProfile\(person\)/);
 assert.doesNotMatch(sandbox,/demo-qa-preview-backdrop|setPreview\(|aria-modal="true"/);
 assert.doesNotMatch(style,/\.demo-qa-preview\{/);
 assert.match(shell,/data=\{fromDemoPerson\(demoVisitor\)\}/);
 assert.match(shell,/onExit=\{\(\)=>setDemoVisitor\(null\)\} registerBack=\{registerVisitorBack\}/);
 assert.match(shell,/if\(person\|\|demoVisitor\)\{if\(visitorBackRef\.current\?\.\(\)\)return;/);
 assert.doesNotMatch(shell,/onLike.*demoVisitor/);
});
test("fifteen photo-driven fictional profiles each keep one coherent identity",()=>{
 assert.match(photos,/const portraitSources=\[/);
 assert.match(photos,/const scenes:readonly/);
 const urls=[...photos.matchAll(/https:\/\/cdn\.pixabay\.com\/photo\/[^"]+/g)].map(x=>x[0]);
 assert.equal(urls.length,15,"15 different AI-generated portrait source URLs");
 assert.equal(new Set(urls).size,15,"no borrowed identity between demo users");
 assert.equal([...photos.matchAll(/^\s*\["[a-z]+","[^"]+",\d+,/gm)].length,15);
 assert.match(photos,/\.\.\.scenes\[index%scenes\.length\]\.slice\(0,2\)\.map/);
 assert.match(photos,/src:portraitSources\[index\]/);
 assert.match(photos,/fallback:portraitSources\[index\]/);
 assert.doesNotMatch(photos,/illustration\(/,"never paint a cartoon or another person when photos are missing");
 assert.doesNotMatch(sandbox,/demoDistanceKm=\{/,"do not present invented distances");
 assert.match(sandbox,/countryCode:draft\.countryCode\|\|person\.countryCode/);
 assert.doesNotMatch(style,/\.feed-v2-demo-distance\{/);
 assert.match(style,/\.demo-qa-sr-only/);
});

test("demo reactions use existing directional compositor animations with zero backend writes",()=>{
 assert.match(sandbox,/deck-leaving-/);
 const deck=read("apps/web/src/discovery/deck-v3.css");
 assert.match(sandbox,/luemi-deck-exit-left/);
 assert.match(sandbox,/luemi-deck-exit-right/);
 assert.match(sandbox,/luemi-deck-exit-top/);
 assert.match(deck,/@keyframes luemi-deck-exit-left/);
 assert.match(deck,/@keyframes luemi-deck-arrive-right/);
 assert.match(deck,/@keyframes luemi-deck-arrive-left/);
 assert.doesNotMatch(style,/@keyframes luemi-demo-/);
 assert.match(sandbox,/const \[history,setHistory\]/);
 assert.match(sandbox,/setHistory\(h=>h\.slice\(0,-1\)\)/);
 assert.match(sandbox,/setSaved\(before=>/);
 assert.match(sandbox,/onAnimationEnd=/);
 assert.match(sandbox,/event.animationName==="luemi-deck-arrive-right"/,
  "Successor must complete its entrance before the next page commits");
 assert.match(style,/\.demo-qa-feed/);
 assert.doesNotMatch(style,/backdrop-filter:blur\(/);
});
