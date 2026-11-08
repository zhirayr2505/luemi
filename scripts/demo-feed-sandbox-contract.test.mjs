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
 assert.match(shell,/<FeedCard person=\{toCard\(current\)\} real/);
 assert.match(shell,/onExit=\{\(\)=>\{autoDemoShown\.current=true;setDemoMode\(false\);\}\}/);
 assert.match(shell,/initialFeed\?\.profiles\.length===0/);
 assert.match(shell,/onEmptyFeed=\{offerDemoOnEmpty\}/);
 assert.match(shell,/Проверить тестовые карточки \(15\)/);
 assert.match(shell,/Посмотреть тестовые карточки/);
});

test("synthetic profiles are not inserted into server, likes, matches or conversations",()=>{
 assert.doesNotMatch(sandbox,/likePublishedUser|blockPublishedUser|createChatTransport|fetch\(|getPublishedFeed|localStorage|sessionStorage|indexedDB/);
 assert.match(sandbox,/ТЕСТОВЫЙ РЕЖИМ/);
 assert.match(sandbox,/реальные лайки не отправляются/);
 assert.match(sandbox,/onExit/);
 assert.match(sandbox,/setPage\(0\)/);
 assert.match(card,/\{!real&&<span className="discovery-demo-label">Демо<\/span>\}/);
 assert.match(sandbox,/busy=\{leaving\}/);
});

test("fifteen fictional profiles each have four images and distinct identities",()=>{
 assert.match(photos,/const portraitSources=\[/);
 assert.match(photos,/const scenes:readonly/);
 const sceneEntries=[...photos.matchAll(/photo-[0-9]{13}-[0-9a-f]{12}/g)].map(x=>x[0]);
 assert.equal(sceneEntries.length,18);
 assert.equal(new Set(sceneEntries).size,18);
 assert.equal([...photos.matchAll(/^\s*\["[a-z]+","[^"]+",\d+,/gm)].length,15);
 assert.match(photos,/\.\.\.scenes\[index%scenes\.length\]\.slice\(0,2\)\.map/);
 assert.match(photos,/src:index<portraitSources\.length\?portraitSources\[index\]:illustration\(index,0\)/);
 assert.match(photos,/fallback:illustration\(index,variation\+1\)/);
 assert.match(sandbox,/demoDistanceKm=\{previewDistance\[page\]\}/);
 assert.match(sandbox,/countryCode:draft\.countryCode\|\|person\.countryCode/);
 assert.match(card,/demoDistanceKm\.toLocaleString\("ru"\)/);
 assert.match(style,/\.feed-v2-demo-distance/);
});

test("demo reactions use existing directional compositor animations with zero backend writes",()=>{
 assert.match(sandbox,/deck-leaving-/);
 assert.match(sandbox,/feed-v2-pass/);
 assert.match(sandbox,/feed-v2-like/);
 assert.match(sandbox,/feed-v2-special/);
 assert.match(sandbox,/const \[history,setHistory\]/);
 assert.match(sandbox,/setHistory\(h=>h\.slice\(0,-1\)\)/);
 assert.match(sandbox,/setSaved\(before=>/);
 assert.match(sandbox,/onAnimationEnd=/);
 assert.match(style,/\.demo-qa-feed/);
 assert.doesNotMatch(style,/backdrop-filter:blur\(/);
});
