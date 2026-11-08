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
 assert.match(sandbox,/Реальные лайки не отправляются/);
 assert.match(sandbox,/onExit/);
 assert.match(sandbox,/setPage\(0\)/);
 assert.match(card,/\{!real&&<span className="discovery-demo-label">Демо<\/span>\}/);
 assert.match(sandbox,/busy=\{!foreground\|\|leaving\}/);\n assert.match(sandbox,/\[current,next\]\.filter/,"Next card remains keyed and mounted across transitions");
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
 assert.match(sandbox,/luemi-demo-pass/);
 assert.match(sandbox,/luemi-demo-like/);
 assert.match(sandbox,/luemi-demo-special/);
 assert.match(style,/@keyframes luemi-demo-pass/);
 assert.match(style,/@keyframes luemi-demo-arrive/);
 assert.match(sandbox,/const \[history,setHistory\]/);
 assert.match(sandbox,/setHistory\(h=>h\.slice\(0,-1\)\)/);
 assert.match(sandbox,/setSaved\(before=>/);
 assert.match(sandbox,/onAnimationEnd=/);
 assert.match(style,/\.demo-qa-feed/);
 assert.doesNotMatch(style,/backdrop-filter:blur\(/);
});
