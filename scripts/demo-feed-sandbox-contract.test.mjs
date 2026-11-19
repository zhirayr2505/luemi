import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sandbox=read("apps/web/src/discovery/DemoFeedSandbox.tsx");
const shell=read("apps/web/src/discovery/RealDiscoveryHome.tsx");
const photos=read("apps/web/src/discovery/demo-people.ts");
const card=read("apps/web/src/discovery/FeedCard.tsx");
const style=read("apps/web/src/discovery/demo-feed-sandbox.css");

test("fictional profiles remain isolated and only a server-verified owner can open QA preview",()=>{
 assert.match(shell,/const \[qaAllowed,setQaAllowed\]=useState\(false\)/);
 assert.match(shell,/fetch\("\/api\/v2\/qa\/fixtures-access"/);
 assert.match(shell,/params\.get\("luemiDemo"\)==="1"\|\|start==="demo"/);
 assert.match(shell,/id==="feed"&&demoMode&&qaAllowed\?<DemoFeedSandbox/);
 assert.match(shell,/if\(!qaAllowed\|\|autoDemoShown\.current\)return/);
 assert.match(shell,/<LiveDeck key=\{id\+"-"\+feedDraft\.searchScope/);
 assert.match(shell,/<FeedCard person=\{cardRows\[page\]\} real/);
 assert.match(shell,/onExit=\{\(\)=>\{setDemoVisitor\(null\);autoDemoShown\.current=true;setDemoMode\(false\);\}\}/);
 assert.match(shell,/initialFeed\?\.profiles\.length===0/);
 assert.match(shell,/onEmptyFeed=\{offerDemoOnEmpty\}/);
 assert.match(shell,/qaAllowed&&<button className="discovery-glass-button"/);
 assert.match(shell,/qaAllowed&&<button type="button" className="discovery-glass-button" onClick=\{onTryDemo\}/);
});

test("synthetic profiles are not inserted into server, likes, matches or conversations",()=>{
 assert.doesNotMatch(sandbox,/likePublishedUser|blockPublishedUser|createChatTransport|fetch\(|getPublishedFeed|localStorage|sessionStorage|indexedDB/);
 assert.match(sandbox,/onExitDemo=\{onExit\}/);
 assert.doesNotMatch(sandbox,/demo-qa-ribbon|demo-qa-counter/,
  "The test feed must not reserve vertical space for a QA toolbar");
 assert.match(sandbox,/Реальные лайки не отправляются/);
 assert.match(sandbox,/onExit/);
 assert.match(sandbox,/setPage\(0\)/);
 assert.match(card,/className="moonstone-demo-label">Демо<\/span>/);
 assert.match(card,/className="moonstone-demo-label" onClick=\{onExitDemo\}/);
 assert.match(sandbox,/busy=\{leaving\}/);
 assert.match(sandbox,/const person=current/,"Only one visible QA card is mounted");
 assert.doesNotMatch(sandbox,/people\.slice\(page,page\+3\)\.map/);
 assert.match(sandbox,/preloadUpcomingFeedPhotos/);
});

test("demo card opens the ORIGINAL full-screen visitor profile, never a small custom window",()=>{
 assert.match(sandbox,/onOpenProfile:\(person:DemoPerson\)=>void/);
 assert.match(sandbox,/onOpenProfile=\{\(\)=>onOpenProfile\(person\)\}/);
 assert.match(sandbox,/onInterests=\{\(\)=>onOpenProfile\(person\)\}/);
 assert.doesNotMatch(sandbox,/demo-qa-preview-backdrop|setPreview\(|aria-modal="true"/);
 assert.doesNotMatch(style,/\.demo-qa-preview\{/);
 assert.match(shell,/data=\{fromDemoPerson\(demoVisitor\)\}/);
 assert.match(shell,/onExit=\{\(\)=>setDemoVisitor\(null\)\} registerBack=\{registerVisitorBack\}/);
 assert.match(shell,/if\(person\|\|demoVisitor\)\{if\(visitorBackRef\.current\?\.\(\)\)return;/);
 assert.doesNotMatch(shell,/onLike.*demoVisitor/);
});
test("six adult fictional women have four unique same-person photos via private owner-only URLs",()=>{
 assert.match(photos,/const base=\[/);
 const women=[...photos.matchAll(/^\s*\["(?:karina|elina|milana|sara|arpi|diana)","[^"]+",(\d+),/gm)];
 assert.equal(women.length,6,"exactly six separate new female profiles");
 assert.ok(women.every(m=>Number(m[1])>=18));
 assert.match(photos,/gender:"woman"/);
 assert.match(photos,/photos:Array\.from\(\{length:4\}/);
 assert.match(photos,/\/api\/v2\/qa\/portraits\//);
 assert.doesNotMatch(photos,/pixabay\.com|unsplash\.com|const scenes|portraitSources/,
  "retired stock photos and scenes must stay removed");
 assert.doesNotMatch(sandbox,/demoDistanceKm=\{/);
 assert.match(sandbox,/const people=demoPeople/);
 assert.doesNotMatch(style,/\.moonstone-demo-distance\{/);
 assert.match(style,/\.demo-qa-sr-only/);
});

test("demo reactions use existing directional compositor animations with zero backend writes",()=>{
 assert.match(sandbox,/deck-leaving-/);
 const deck=read("apps/web/src/discovery/deck-v3.css");
 assert.match(sandbox,/luemi-deck-exit-left/);
 assert.match(sandbox,/luemi-deck-exit-right/);
 assert.match(sandbox,/luemi-deck-exit-top/);
 assert.match(deck,/@keyframes luemi-deck-exit-left/);
 assert.doesNotMatch(deck,/@keyframes luemi-deck-arrive-/);
 assert.doesNotMatch(sandbox,/deck-queued|deck-entering|deck-peek-/);
 assert.doesNotMatch(style,/@keyframes luemi-demo-/);
 assert.match(sandbox,/const \[history,setHistory\]/);
 assert.match(sandbox,/setHistory\(h=>h\.slice\(0,-1\)\)/);
 assert.match(sandbox,/setSaved\(before=>/);
 assert.match(sandbox,/onAnimationEnd=/);
 assert.match(sandbox,/if\(\["luemi-deck-exit-left","luemi-deck-exit-right","luemi-deck-exit-top"\]\.includes\(event\.animationName\)\)/,
  "The only visible profile completes its exit before the next page commits");
 assert.match(style,/\.demo-qa-feed/);
 assert.doesNotMatch(style,/backdrop-filter:blur\(/);
});
