import {chromium} from "playwright";
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";

const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const viewport={width:412,height:915};
const mockMatches=page=>page.route("**/api/v4/matches/new",route=>
 route.fulfill({json:{matches:[],viewerGender:"other"}}));
const url=process.env.CHATS_DEMO_URL??"http://127.0.0.1:5173/chats-demo.html";
const checkLiveInbox=async()=>{
 const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
 page.setDefaultTimeout(8000);
 const calls=[];
 const actorId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
 let qaAllowed=false;
 await page.route("**/api/**",route=>{
  const path=new URL(route.request().url()).pathname;
  calls.push(path);
  const results={
   "/api/v2/auth/telegram":{user:{id:actorId,firstName:"QA"},csrfToken:"qa_token"},
   "/api/v2/auth/session":{user:{id:actorId,firstName:"QA"},csrfToken:"qa_token"},
   "/api/v2/qa/fixtures-access":{allowed:qaAllowed},
   "/api/v4/chats":{conversations:[]},
   "/api/v4/chats/me":{actorId},
   "/api/v4/matches/new":{matches:[],viewerGender:"man"},
   "/api/v4/matches/incoming/count":{count:0}
  };
  return route.fulfill({json:results[path]??{}});
 });
 const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
 const open=()=>page.goto(base+"/profile-qa.html?profileReactions=1&luemiRoute=chats");
 const inbox=page.locator(".lc-list-route");
 const demo=page.getByRole("button",{name:"Тестовая переписка",exact:true});
 await open();
 await inbox.getByRole("heading",{name:"Пока нет переписок",exact:true}).waitFor({timeout:5000});
 await page.locator(".luemi-shell").evaluate(node=>node.style.setProperty("--viewport-safe-top","66px"));
 assert.equal(await page.locator(".lh-chats").count(),0,"the inbox owns the entire surface");
 assert.equal(await inbox.getByRole("tablist",{name:"Категории чатов"}).getByRole("tab").count(),4,"inbox tabs match reference");
 assert.equal(await inbox.getByRole("textbox",{name:"Поиск по чатам"}).count(),1,"search is always visible");
 assert.equal(await inbox.getByRole("img",{name:"LUEMI"}).getAttribute("src"),"/assets/brand/wordmark_original_raster_alpha_W06.webp","original raster logo is retained");
 assert.equal(await demo.count(),0,"the test conversation requires QA access");
 const brand=await inbox.getByRole("img",{name:"LUEMI",exact:true}).boundingBox();
 assert(brand&&brand.y>=66&&Math.abs(brand.x+brand.width/2-393/2)<2,"the logo honors Telegram safe area");
 assert.equal(await inbox.evaluate(node=>getComputedStyle(node,"::before").backgroundImage.includes("chat-eclipse.webp")),false);
 // The production entry stylesheet must not restore the older dock.
 await page.addStyleTag({url:base+"/src/ui/vivid-discovery.css"});
 const dock=page.getByRole("navigation",{name:"Главная навигация LUEMI"});
 const dockBox=await dock.boundingBox();
 assert(dockBox&&Math.abs(dockBox.width-(393-14)/1.5)<2&&dockBox.height<=48);
 const activeIcon=dock.getByRole("button",{name:"Чаты",exact:true});
 assert.equal(await activeIcon.evaluate(node=>getComputedStyle(node).backgroundColor),"rgba(0, 0, 0, 0)");
 await inbox.getByRole("button",{name:"Перейти к знакомствам",exact:true}).tap();
 assert.equal(await page.locator(".real-discovery-home").getAttribute("data-feed-visible"),"true");

 qaAllowed=true;
 await open();
 await demo.tap();
 const traceLayout=async(stage)=>console.log("LUEMI_LAYOUT_TRACE",stage,JSON.stringify(await page.evaluate(()=>{
  const node=document.querySelector(".lc-conversation-stack");
  const ancestors=[];let el=node;
  while(el&&ancestors.length<9){const rc=el.getBoundingClientRect(),css=getComputedStyle(el);
   ancestors.push({tag:el.tagName,cls:String(el.className).slice(0,110),x:rc.x,y:rc.y,
    w:rc.width,h:rc.height,transform:css.transform,top:css.top,left:css.left,position:css.position});
   el=el.parentElement;
  }
  const shell=document.querySelector(".luemi-shell"),cs=shell?getComputedStyle(shell):null;
  return {ancestors,active:document.activeElement?.tagName,scrollX,scrollY,
   vv:visualViewport?{top:visualViewport.offsetTop,left:visualViewport.offsetLeft,width:visualViewport.width,height:visualViewport.height}:null,
   viewportTop:cs?.getPropertyValue("--viewport-offset-top"),appHeight:cs?.getPropertyValue("--app-height")};
 })));
 await traceLayout("initial");
 const before=calls.filter(path=>path.startsWith("/api/v4/chats/")).length;
 await page.locator(".lc-thread-route").getByText("Алина",{exact:true}).waitFor();
 await page.locator(".lc-chat-header").getByText("В сети",{exact:true}).waitFor();
 const nestedTouch=await page.context().newCDPSession(page);
 const backSwipe=async(x,y)=>{
  await nestedTouch.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
  for(const dx of [24,75,152,208])await nestedTouch.send("Input.dispatchTouchEvent",{
   type:"touchMove",touchPoints:[{x:x+dx,y}]
  });
  await nestedTouch.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 };
 await page.getByRole("button",{name:"Вложения переписки"}).tap();
 const details=page.getByRole("region",{name:"Вложения"});
 await details.getByRole("tab",{name:"Подарки"}).tap();
 await details.getByText("Подарков пока нет").waitFor();
 await backSwipe(18,400);
 await details.waitFor({state:"detached"});
 await page.getByRole("button",{name:"Профиль · Алина",exact:true}).tap();
 const profile=page.locator(".discovery-visitor-route");
 const hero=profile.locator(".owner-profile-photo-mask");
 await hero.first().waitFor();
 await page.waitForFunction(()=>Math.abs(document.querySelector(".discovery-visitor-route").getBoundingClientRect().left)<1);
 const photoBox=await hero.first().boundingBox();
 assert(photoBox);
 await backSwipe(12,Math.round(photoBox.y+photoBox.height/2));
 await profile.waitFor({state:"detached"});
 await traceLayout("after-profile");
 await page.getByRole("button",{name:"Меню переписки"}).tap();
 const settings=page.getByRole("dialog",{name:"Настройки чата"});
 await settings.waitFor();
 await settings.getByRole("button",{name:"Отключить уведомления"}).tap();
 await settings.getByRole("button",{name:"Включить уведомления"}).waitFor();
 await settings.getByRole("button",{name:"Найти сообщение"}).tap();
 const search=page.getByRole("search");
 await search.getByRole("textbox",{name:"Поиск по загруженным сообщениям"}).fill("Алина");
 await search.getByRole("button",{name:"Следующее совпадение"}).tap();
 await search.getByRole("button",{name:"Закрыть поиск"}).tap();
 await traceLayout("after-search");
 const stable=await page.locator(".lc-conversation-stack").boundingBox();
 assert(stable&&Math.abs(stable.x)<1&&Math.abs(stable.y)<1,
  "focused chat search never shifts the fullscreen route "+JSON.stringify(stable));
 const chatHeader=await page.locator(".lc-chat-header").boundingBox();
 assert(chatHeader&&chatHeader.y>=0&&chatHeader.height>40,
  "chat header stays inside the visible viewport "+JSON.stringify(chatHeader));
 await page.locator(".lc-history").evaluate(node=>node.scrollTop=node.scrollHeight);
 await mkdir("qa-artifacts/chat-premium",{recursive:true});
 await page.screenshot({path:"qa-artifacts/chat-premium/conversation-393.png"});
 console.log("LUEMI_CHAT_GEOMETRY",JSON.stringify(await page.evaluate(()=>({
  viewport:{width:innerWidth,height:innerHeight,scrollY,visualHeight:visualViewport?.height},
  items:[".lc-conversation-stack",".lc-thread-route",".lc-chat-header",".lc-thread-logo",".lc-header-islands",".lc-peer",".lc-history",".lc-composer",".lc-inbox-host"]
   .map(selector=>{
    const e=document.querySelector(selector),c=e?getComputedStyle(e):null,r=e?.getBoundingClientRect();
    return {selector,present:!!e,rect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,
     display:c?.display,opacity:c?.opacity,visibility:c?.visibility,transform:c?.transform,
     clipPath:c?.clipPath,zIndex:c?.zIndex};
   }),
  topElements:document.elementsFromPoint(196,100).slice(0,7).map(e=>e.tagName+"."+String(e.className).slice(0,80))
 }))));
 const first=page.locator(".lc-msg-line .lc-bubble").first();
 await first.tap();
 const menu=page.getByRole("dialog",{name:"Действия с сообщением"});
 await menu.waitFor();
 await page.waitForTimeout(215); // Capture the settled menu, not its entrance transition.
 await page.screenshot({path:"qa-artifacts/chat-premium/message-menu-393.png"});
 assert.equal(await menu.locator(".lc-emoji-bar button[data-emoji]").count(),6);
 const focused=page.locator(".lc-focus-bubble");
 await focused.waitFor();
 assert.equal(await page.locator(".lc-message-scrim").evaluate(node=>getComputedStyle(node).backdropFilter.includes("blur")),true);
 const anchor=await first.boundingBox();
 assert(anchor&&await focused.evaluate((node,y)=>node.getBoundingClientRect().top<y,anchor.y),"the active bubble lifts above the blurred chat");
 await menu.getByRole("button",{name:"Все реакции"}).tap();
 await menu.getByRole("button",{name:"Браво"}).waitFor();
 await menu.getByRole("button",{name:"Свернуть реакции"}).tap();
 const bubbleBox=await first.boundingBox(),menuBox=await menu.boundingBox();
 assert(bubbleBox&&menuBox&&Math.abs(menuBox.y-(bubbleBox.y-menuBox.height))<24,"the menu anchors next to the message");
 await menu.getByRole("button",{name:"Сердце",exact:true}).tap();
 await first.locator(".lc-message-reactions").getByText("❤️",{exact:true}).waitFor();
 await first.dblclick({position:{x:30,y:12}});
 await first.locator(".lc-message-reactions").waitFor({state:"hidden"});
 assert.equal(await menu.count(),0,"double tap skips the action menu");
 const touch=await page.context().newCDPSession(page);
 const point=await first.boundingBox();
 assert(point);
 const start={x:Math.round(point.x+point.width/2),y:Math.round(point.y+point.height/2)};
 const touchAt=(type,point)=>touch.send("Input.dispatchTouchEvent",{type,touchPoints:point?[point]:[]});
 await touchAt("touchStart",start);
 await touchAt("touchMove",{x:start.x-26,y:start.y});
 await touchAt("touchMove",{x:start.x-74,y:start.y});
 await touchAt("touchEnd");
 await page.locator(".lc-reply-preview").getByText("Ответ · Алина",{exact:true}).waitFor();
 await page.getByLabel("Сообщение").fill("Привет! Как дела?");
 await page.getByLabel("Отправить").tap();
 const answered=page.locator(".lc-own .lc-bubble").filter({hasText:"Привет! Как дела?"});
 await answered.locator(".lc-message-quote").getByText(/Привет! Я Алина/).waitFor();
 const keepsFocus=await page.getByLabel("Сообщение").evaluate(node=>document.activeElement===node);
 assert(keepsFocus,"the send button keeps the composer focused");
 const incoming=page.locator(".lc-msg-line:not(.lc-own)");
 await incoming.getByText(/Привет! У меня хорошо/).waitFor({timeout:8000});
 assert.equal(await answered.count(),1,"touch activation never duplicates the message");
 await answered.locator(":scope > span").tap();
 await menu.getByText("Прочитано",{exact:true}).waitFor();
 assert.ok(await menu.locator("time[datetime]").getAttribute("datetime"));
 await page.getByRole("button",{name:"Закрыть меню сообщения"}).tap({position:{x:5,y:40}});
 await answered.getByRole("button",{name:"Перейти к исходному сообщению"}).tap();
 await page.getByLabel("Сообщение").fill("Хочешь кофе?");
 await page.getByLabel("Отправить").tap();
 await incoming.getByText(/Я за кофе/).waitFor({timeout:6000});
 assert.equal(calls.filter(path=>path.startsWith("/api/v4/chats/")).length,before,"the demo never uses real messages or read receipts");
 const last=page.locator(".lc-msg-line:not(.lc-own) .lc-bubble").last();
 const lastBox=await last.boundingBox();
 assert(lastBox);
 await touchAt("touchStart",{x:lastBox.x+16,y:lastBox.y+12});
 await page.getByText("Выбрано: 1",{exact:true}).waitFor();
 await touchAt("touchEnd");
 await page.locator(".lc-msg-line:not([data-selected]) .lc-bubble").last().tap();
 await page.getByText("Выбрано: 2",{exact:true}).waitFor();
 await page.getByRole("button",{name:"Удалить выбранные"}).tap();
 const confirmation=page.getByRole("alertdialog");
 await confirmation.getByText("У меня и собеседника").tap();
 await confirmation.getByRole("button",{name:"Удалить",exact:true}).tap();
 await confirmation.waitFor({state:"hidden"});
 const historyBox=await page.locator(".lc-history").boundingBox();
 assert(historyBox);
 const edge={x:22,y:Math.round(historyBox.y+50)};
 await touchAt("touchStart",edge);
 await touchAt("touchMove",{x:edge.x+24,y:edge.y});
 await touchAt("touchMove",{x:edge.x+82,y:edge.y});
 await page.waitForFunction(()=>parseFloat(document.querySelector(".lc-thread-route")
  ?.style.transform.match(/translate3d\(([\d.]+)/)?.[1]||"0")>=72);
 await touchAt("touchMove",{x:edge.x+172,y:edge.y});
 await touchAt("touchEnd");
 await inbox.getByRole("heading",{name:"Пока нет переписок",exact:true}).waitFor();
 await open();
 await demo.waitFor();
 await page.evaluate(()=>{
  window.Telegram={WebApp:{initData:"browser-native-back",BackButton:{show(){},hide(){},onClick(){},offClick(){}}}};
  document.querySelector(".luemi-shell").style.setProperty("--viewport-safe-top","68px");
 });
 await demo.tap();
 const nativeThread=page.locator(".lc-thread-route[data-native-back]");
 await nativeThread.waitFor();
 assert.equal(await nativeThread.getByRole("button",{name:"Назад",exact:true}).count(),0);
 const nativeHeader=await nativeThread.locator(".lc-chat-header").boundingBox();
 assert(nativeHeader&&nativeHeader.y>=77.5,"Telegram navigation clears the header "+JSON.stringify(nativeHeader)+" "+await nativeThread.locator(".lc-chat-header").evaluate(node=>getComputedStyle(node).marginTop));
 await page.keyboard.press("Escape");
 await inbox.getByRole("heading",{name:"Пока нет переписок",exact:true}).waitFor();
 await page.close();
};

try{
 await checkLiveInbox();
 const page=await browser.newPage({viewport,deviceScaleFactor:1,hasTouch:true,isMobile:true});
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await mockMatches(page);
 await page.goto(url);
 await page.getByRole("heading",{name:"Чаты"}).waitFor();
 await page.locator(".lc-chat-row").first().waitFor();
 await page.waitForTimeout(320);
 await mkdir("qa-artifacts/chat-premium",{recursive:true});
 await page.screenshot({path:"qa-artifacts/chat-premium/v8-inbox-412.png"});
 assert.equal(await page.locator(".lc-inbox-tabs button").count(),4);
 assert.equal(await page.locator(".lc-inbox-brand img").evaluate(node=>getComputedStyle(node).filter),"none",
  "brand uses the untouched original raster gradient");
 await page.locator(".lc-chat-row").first().tap();
 const thread=page.locator(".lc-thread-route");
 await thread.locator(".lc-msg-line").first().waitFor();
 assert.equal(await thread.getAttribute("data-chat-theme"),"luemi");
 assert.equal(await thread.getByRole("img",{name:"LUEMI"}).count(),1);
 await thread.getByRole("button",{name:"Вложения переписки"}).tap();
 const attachments=page.getByRole("region",{name:"Вложения"});
 await attachments.getByRole("tab",{name:"Голосовые"}).tap();
 await attachments.getByText("Голосовых сообщений пока нет").waitFor();
 await attachments.getByRole("button",{name:"Назад"}).tap();
 await attachments.waitFor({state:"detached"});
 const list=thread.locator(".lc-history");
 await page.waitForFunction(()=>{const node=document.querySelector(".lc-history");return node.scrollHeight-node.clientHeight-node.scrollTop<3;});
 assert.equal(await list.locator(".lc-bubble").evaluateAll(nodes=>nodes.some(node=>node.getAnimations().length)),false,
  "opening a chat does not replay an animation for every old message");
 await page.getByLabel("Сообщение").fill("Browser smoke 💜");
 await Promise.all([
  page.waitForFunction(()=>[...document.querySelectorAll(".lc-own .lc-bubble")].some(bubble=>
   bubble.textContent.includes("Browser smoke 💜")&&bubble.getAnimations().some(animation=>
    animation.effect?.getKeyframes().some(frame=>Number(frame.opacity)===0)))),
  page.waitForFunction(()=>[...document.querySelectorAll(".lc-msg-line")].some(row=>
   row.getAnimations().some(animation=>animation.effect?.getKeyframes().some(frame=>
    typeof frame.translate==="string"&&frame.translate!=="0 0")))),
  page.getByLabel("Отправить").tap()
 ]);
 const sent=thread.locator(".lc-msg-line").filter({hasText:"Browser smoke 💜"});
 await sent.waitFor();
 assert.equal(await sent.count(),1);
 const identity=await sent.elementHandle();
 await page.waitForFunction(()=>document.querySelector(".lc-msg-line.sending")===null);
 assert(await identity.evaluate(node=>node.isConnected),"the server acknowledgement keeps the same message element");
 assert.equal(await thread.locator(".lc-msg-line.failed").count(),0);
 await list.evaluate(node=>{node.scrollTop=0;});
 const older=thread.getByRole("button",{name:"Показать раньше"});
 await older.tap();
 await page.getByText("Демо-сообщение 35",{exact:true}).waitFor();
 await list.evaluate(node=>{node.scrollTop=0;});
 await page.getByRole("button",{name:"Входящее",exact:true}).tap();
 const jump=thread.getByRole("button",{name:"Новые сообщения · 1",exact:true});
 await jump.waitFor({timeout:6000});
 assert(await list.evaluate(node=>node.scrollHeight-node.clientHeight-node.scrollTop>96),
  "reading older messages is uninterrupted when a new one arrives");
 await jump.tap();
 await page.waitForFunction(()=>{const node=document.querySelector(".lc-history");return node.scrollHeight-node.clientHeight-node.scrollTop<4;});
 assert(await thread.getByText("Новое демо-сообщение ✨").isVisible());
 await page.getByLabel("Назад",{exact:true}).tap();
 await page.getByRole("heading",{name:"Чаты"}).waitFor();
 for(const resized of [{width:320,height:568},{width:390,height:402}]){
  await page.setViewportSize(resized);
  await page.getByRole("heading",{name:"Чаты"}).waitFor();
  await page.locator(".lc-chat-row").first().tap();
  await page.waitForFunction(({width,height})=>{
   const composer=document.querySelector(".lc-input-row")?.getBoundingClientRect();
   return !!composer&&composer.width<=width&&composer.bottom<=height+1;
  },resized,{timeout:5000});
  await page.getByLabel("Назад",{exact:true}).tap();
 }
 assert.deepEqual(errors,[]);
 await page.close();

 const reduced=await browser.newPage({viewport,reducedMotion:"reduce"});
 await mockMatches(reduced);
 await reduced.goto(url);
 await reduced.locator(".lc-chat-row").first().click();
 await reduced.locator(".lc-msg-line").first().waitFor();
 await reduced.getByLabel("Сообщение").fill("Reduced motion");
 await reduced.getByLabel("Отправить").click();
 const still=reduced.locator(".lc-msg-line").filter({hasText:"Reduced motion"});
 await still.waitFor();
 assert.equal(await still.locator(".lc-bubble").evaluate(node=>node.getAnimations().length),0);
 console.log("LUEMI chat browser PASS integrated inbox, owner-only demo with replies, native back layout, replies, anchored reactions, selection, send/ACK, swipe and reduced motion");
}finally{await browser.close();}
