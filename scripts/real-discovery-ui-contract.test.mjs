import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=src("apps/web/src/App.tsx");
const shell=src("apps/web/src/discovery/RealDiscoveryHome.tsx");
const card=src("apps/web/src/discovery/FeedCard.tsx");

test("REAL_ONLY runs the approved LUEMI shell, not the provisional list shell",()=>{
 const live=app.indexOf('if(realHome&&auth==="authorized"&&realFeedPilot.enabled)');
 const legacy=app.indexOf('if(realHome&&auth==="authorized")return <main');
 assert(live>0&&legacy>live);
 assert.match(app.slice(live,legacy),/<RealDiscoveryHome/);
 assert.match(app.slice(live,legacy),/publishedProfile=\{publishStatus\?\.profile\}/);
 assert.match(app.slice(live,legacy),/deletionSettingsPanel/);
 assert.match(app.slice(live,legacy),/savePublishedEditor/);
 assert.match(app.slice(live,legacy),/withdrawPersonalConsent/);
 assert.match(app,/const realOnly=import\.meta\.env\.VITE_LUEMI_REAL_ONLY==="1"/);
});

test("real published discovery has original four tabs and three browse tabs",()=>{
 for(const label of ["Знакомства","Симпатии","Чаты","Профиль","Лента","Для тебя","Рядом"])
  assert(shell.includes('"'+label+'"'),label+" missing");
 assert.match(shell,/<GlobalHeader/);
 assert.match(shell,/className="discovery-bottom-nav"/);
 assert.match(shell,/className="discovery-top-tabs"/);
 assert.match(shell,/<ProfileMaster data=\{owner\} mode="owner"/);
 assert.match(shell,/<VisitorProfileRoute/);
 assert.match(shell,/<RealChats\/>/);
 assert.match(shell,/<RealMatches active=/);
});

test("empty server feed never hides navigation or reveals fictional demo people",()=>{
 assert.match(shell,/getPublishedFeed\(controller\.signal\)/);
 assert.match(shell,/Пока нет анкет/);
 assert.match(shell,/Анкеты не загрузились/);
 assert.match(shell,/В твоём городе пока нет подходящих анкет/);
 assert.match(shell,/Пока нет взаимных симпатий/);
 assert.match(shell,/refresh/);
 assert.doesNotMatch(shell,/fromDemoPerson|demoPeople|forYouDemoPeople|freshDemoState|Демо-анкеты/);
 assert.match(shell,/onMatched=\{\(\)=>setMainTab\("chats"\)\}/);
});

test("real FeedCard retains canonical photo/sheet gestures and removes demo badges",()=>{
 assert.match(shell,/<FeedCard person=\{toCard\(current\)\} real/);
 assert.match(card,/\{!real&&<span className="discovery-demo-label">Демо<\/span>\}/);
 assert.match(card,/real\?<button type="button"/);
 assert.match(card,/!real\|\|kind!=="undo"/);
 assert.match(card,/PhotoCarousel/);
 assert.match(card,/data-expanded=\{expanded\}/);
});

test("real matches, reports and account actions stay available even when feed is empty",()=>{
 assert.match(shell,/createChatTransport\(csrf\)\.list/);
 assert.match(shell,/likePublishedUser\(current\.id\)/);
 assert.match(shell,/blockPublishedUser\(menu\.id\)/);
 assert.match(shell,/reportPublishedUser\(menu\.id,reason\)/);
 assert.match(shell,/className="real-discovery-settings"/);
 assert.match(shell,/accountPanel/);
 assert.match(shell,/setMainTab\(id\)/);
});
