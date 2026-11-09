import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const app=src("apps/web/src/App.tsx");
const shell=src("apps/web/src/discovery/RealDiscoveryHome.tsx");
const card=src("apps/web/src/discovery/FeedCard.tsx");
const forYou=src("apps/web/src/discovery/RealForYou.tsx");
const nearby=src("apps/web/src/discovery/RealNearby.tsx");

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
 assert.match(shell,/<RealChats\b/);
 assert.match(shell,/<RealMatches active=/);
});

test("empty real feed retains navigation; QA profiles stay in a separate fixture-only visitor route",()=>{
 assert.match(shell,/getPublishedFeed\(controller\.signal\)/);
 assert.match(shell,/Пока нет анкет/);
 assert.match(shell,/Анкеты не загрузились/);
 assert.match(nearby,/Сейчас нет других опубликованных анкет/);
 assert.match(shell,/Пока нет взаимных симпатий/);
 assert.match(shell,/refresh/);
 assert.doesNotMatch(shell,/demoPeople|forYouDemoPeople|freshDemoState/);
 assert.match(shell,/onOpenProfile=\{setDemoVisitor\}/);
 assert.match(shell,/data=\{fromDemoPerson\(demoVisitor\)\}/);
 assert.match(shell,/key=\{"demo-"\+demoVisitor\.id\}/);
 assert.match(shell,/onExit=\{\(\)=>setDemoVisitor\(null\)\}/);
 assert.doesNotMatch(shell,/onLike=.*demoVisitor/,"Demo route may not call a real matching API");
 assert.match(shell,/onMatched=\{\(matchedPerson,matchId\)=>setMatched\(\{person:matchedPerson,matchId\}\)\}/);
 assert.match(shell,/className="luemi-match-overlay"/);
});

test("real FeedCard retains canonical photo/sheet gestures and removes demo badges",()=>{
 assert.match(shell,/<FeedCard person=\{cardRows\[page\+offset\]\} real/);
 assert.match(card,/className="discovery-demo-label">Демо<\/span>/);
 assert.match(card,/\{!real&&\(onExitDemo\?/);
 assert.match(card,/real\?<button type="button"/);
 assert.match(card,/\{buttons.map\(\(\[kind,label,Icon\]\)=>/);
 assert.match(card,/\{buttons.map\(\(\[kind,label,Icon\]\)=>/);
 assert.match(card,/PhotoCarousel/);
 assert.match(card,/data-expanded=\{expanded\}/);
});

test("real matches, reports and account actions stay available even when feed is empty",()=>{
 assert.match(shell,/createChatTransport\(csrf\)\.list/);
 assert.match(shell,/likePublishedUser\(current\.id,kind==="special"\?"super":"ordinary"\)/);
 assert.match(shell,/getIncomingLikes\(controller\.signal\)/);
 assert.match(shell,/blockPublishedUser\(menu\.id\)/);
 assert.match(shell,/reportPublishedUser\(menu\.id,reason\)/);
 assert.match(shell,/className="real-discovery-settings"/);
 assert.match(shell,/accountPanel/);
 assert.match(shell,/setMainTab\(id\)/);
});


test("real For You category hub and Nearby keep separate layouts, never three decks",()=>{
 assert.match(shell,/tab!=="feed"/);
 assert.match(shell,/<RealForYou draft=\{draft\} people=\{matchedRows\}/);
 assert.match(shell,/<RealNearby draft=\{draft\} people=\{matchedRows\}/);
 assert.match(forYou,/className="fy-topic-chips"/);
 assert.match(forYou,/className="fy-avatar-rail"/);
 assert.match(forYou,/className="fy-customize"/);
 assert.match(forYou,/className=\{"fy-rail"/);
 assert.match(forYou,/className="fy-section fy-best"/);
 assert.match(forYou,/className="fy-expanded"/);
 assert.match(forYou,/className="fy-manage"/);
 assert.match(nearby,/className="nb-location"/);
 assert.match(nearby,/className="nb-grid"/);
 assert.match(nearby,/className="nb-photo"/);
 assert.match(nearby,/scope==="city"/);
 assert.match(nearby,/scope==="country"/);
 assert.match(nearby,/scope==="world"/);
 assert.doesNotMatch(forYou+nearby,/demoPeople|forYouDemoPeople|fetch\(|Math\.random/);
 assert.match(forYou,/localStorage\.setItem\(storageKey,JSON\.stringify\(prefs\)\)/);
 assert.match(forYou,/case "online":case "new":return \[\]/);
 assert.match(forYou,/aria-pressed=\{saved\}/);
 assert.match(shell,/onPerson=\{onPerson\}/);
 assert.match(shell,/const matchedRows=useMemo\(\(\)=>rows.filter\(p=>!hiddenIds.has\(p.id\)\)/);
 assert.match(forYou,/const score=/);
 assert.match(nearby,/person\.countryCode===draft\.countryCode/);
});

test("real pages reuse approved 1:1 gesture and inertial settle without duplicated profile engine",()=>{
 assert.match(shell,/new MotionController\("browse"/);
 assert.match(shell,/new GestureArbiter\(\)/);
 assert.match(shell,/const frozenBrowse=/);
 assert.match(shell,/const settleDrag=/);
 assert.match(shell,/schedulePaint\(g\.token/);
 assert.match(shell,/addEventListener\("touchmove",track,\{passive:false\}\)/);
 assert.match(shell,/onTransitionEnd=/);
 assert.match(shell,/onScrollTop=\{top=>onScrollTop\(id,top\)\}/);
 assert.match(shell,/onMotionProgress=\{\(progress,dragging\)=>header\.current\?\.setProfileProgress/);
 assert.match(shell,/registerBack=\{registerVisitorBack\}/);
 assert.match(shell,/ownerPhotoPreview=EMPTY_OWNER_PREVIEW/);
 assert.match(forYou,/onScroll=\{event=>\{if\(!expanded&&!manage\)onScrollTop/);
 assert.match(nearby,/onScroll=\{e=>onScrollTop/);
});

test("real feed restores animated deck, undoable skip and session bookmarks across tabs",()=>{
 assert.match(shell,/visibleRows\.slice\(page,page\+3\)\.map/);
 assert.match(shell,/deck-peek-"\+side/);
 assert.match(shell,/className=\{"discovery-deck-layer"\+state\}/);
 assert.match(shell,/preloadUpcomingFeedPhotos/);
 assert.match(shell,/warmPublishedPagePhotos/);
 assert.match(shell,/onAnimationEnd=/);
 assert.match(shell,/pendingCommit/);
 assert.match(shell,/setUndoPage\(from\)/);
 assert.match(shell,/onSave\(current.id\)/);
 assert.match(shell,/saved=\{saved.has\(person.id\)\}/);
 assert.match(shell,/hiddenIds=\{hiddenIds\} onHide=\{onHide\}/);
 assert.match(shell,/onHide\(menu.id\)/);
 assert.match(shell,/people=\{matchedRows\}/);
});
