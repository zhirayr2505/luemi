import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:["--no-sandbox"],
 ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
const context=await browser.newContext({viewport:{width:393,height:650},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"});
const page=await context.newPage(),device=await context.newCDPSession(page);
const actor="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",peer="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const photoIds=["cccccccc-cccc-4ccc-8ccc-cccccccccccc","dddddddd-dddd-4ddd-8ddd-dddddddddddd","eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"];
const photos=photoIds.map(id=>"/api/v3/discovery/photo/"+id);
const matchId="ffffffff-ffff-4fff-8fff-ffffffffffff",conversationId="11111111-1111-4111-8111-111111111111";
let allowed=false,liveMatched=false,unread=2;
const serverRequests=[],errors=[];
page.on("pageerror",error=>errors.push(error.message));
await page.route("**/api/**",route=>{
 const req=route.request(),path=new URL(req.url()).pathname;
 const send=json=>route.fulfill({status:200,json});
 if(path==="/api/v2/auth/telegram"||path==="/api/v2/auth/session")return send({user:{id:actor,firstName:"QA"},csrfToken:"qa_token"});
 if(path==="/api/v2/qa/fixtures-access")return send({allowed});
 if(path.startsWith("/api/v4/matches")&&req.method()!=="GET")serverRequests.push(path);
 const item={id:peer,name:"София",createdAt:"2026-11-20T15:00:00.000Z",kind:"ordinary",photoUrl:photos[0],photos};
 if(path==="/api/v4/matches/incoming/count")return send({count:liveMatched?0:2});
 if(path==="/api/v4/matches/incoming")return send({likes:liveMatched?[]:[item],premium:false,hiddenCount:1});
 if(path==="/api/v4/matches/gallery")return send({outgoing:[],mutual:liveMatched?[{...item,kind:null,matchId,conversationId:null}]:[]});
 if(path==="/api/v4/matches/like"){
  liveMatched=true;
  return send({liked:true,matched:true,matchId,kind:"ordinary",superlikes:{weekly:3,purchased:0,total:3,renewsAt:item.createdAt}});
 }
 if(path==="/api/v4/matches/"+matchId+"/open")return send({conversationId});
 if(path==="/api/v4/matches/new")return send({matches:[],viewerGender:"man"});
 if(path==="/api/v4/chats")return send({conversations:[{id:conversationId,peerName:item.name,peerId:peer,peerProfileId:peer,
  unreadCount:unread,lastActivityAt:item.createdAt,lastMessage:"Привет!",access:"active"}]});
 if(path==="/api/v4/chats/me")return send({actorId:actor});
 if(path==="/api/v4/chats/"+conversationId+"/messages")return send({messages:[],nextCursor:null});
 if(path==="/api/v3/discovery/profile/"+peer)return send({profile:{id:peer,name:item.name,age:25,city:"Краснодар",
  countryCode:"RU",about:"",gender:"woman",goal:"serious",interests:[],languages:[],likedYouKind:"ordinary",
  photos:photoIds.map((id,i)=>({id,url:photos[i]})),publishedAt:item.createdAt}});
 if(path.includes("/photo/")||path.includes("/portraits/"))return route.fulfill({contentType:"image/svg+xml",
  body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 440"><rect width="360" height="440" fill="#a05165"/></svg>'});
 return send({allowed:false});
});
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const open=async()=>{await page.goto(base+"/profile-qa.html?profileReactions=1&luemiRoute=likes");};
const scope=page.getByRole("region",{name:"Симпатии",exact:true});
const nav=page.getByRole("navigation",{name:"Главная навигация LUEMI"});
const likesBadge=nav.locator("button").nth(1).locator(".luemi-nav-badge");
const chatsBadge=nav.locator("button").nth(2).locator(".luemi-nav-badge");
const card=name=>scope.locator(".likes-photo-card").filter({has:page.locator('.likes-photo-hit[aria-label="Открыть анкету '+name+'"]')});
const hit=name=>card(name).getByRole("button",{name:"Открыть анкету "+name,exact:true});
const menu=page.locator(".likes-fan"),notice=page.locator(".profile-reaction-notice");
const overlay=name=>card(name).locator('.likes-card-reaction[data-visible]');
const undo=name=>overlay(name).getByRole("button",{name:"Отменить",exact:true});
const departure=async(name,direction)=>{
 await page.waitForFunction(({name,direction})=>{
  const leaving=[...document.querySelectorAll(".likes-photo-card[data-exit-direction]")].find(node=>
   node.dataset.exitDirection===direction&&node.querySelector(".likes-photo-hit")?.getAttribute("aria-label")==="Открыть анкету "+name);
  return leaving?.getAnimations().some(animation=>{
   const last=animation.effect?.getKeyframes().at(-1)?.transform;
   if(!last)return false;
   const matrix=new DOMMatrixReadOnly(last);
   return direction==="shrink"?matrix.a<1:direction==="left"?matrix.e<0:matrix.e>0;
  });
 },{name,direction},{timeout:8000});
 await card(name).waitFor({state:"detached"});
};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const touch=(type,coords)=>device.send("Input.dispatchTouchEvent",{type,
 touchPoints:coords?[{...coords,id:7,radiusX:2,radiusY:2,force:1}]:[]});
const center=async locator=>{const b=await locator.boundingBox();assert(b);return {x:b.x+b.width/2,y:b.y+b.height/2};};
const caption=menu.locator(".likes-fan-caption");
const captionText={ordinary:"Отправить симпатию",super:"Отправить суперлайк",skip:"Пропустить"};
const checkCaption=async kind=>{
 const active=caption.locator('[data-phase="current"]').filter({hasText:captionText[kind]});
 await active.waitFor();
 const iconClass={ordinary:"lucide-heart",super:"lucide-star",skip:"lucide-x"}[kind];
 assert.equal(await active.locator("svg."+iconClass).count(),1,"the rolling label includes its reaction icon");
 assert.equal(await menu.getAttribute("data-selected"),kind,"touch continues to reach the fan even along a vertical ray");
 const box=await caption.boundingBox();
 const button=await menu.locator('[data-kind="'+kind+'"]').boundingBox();
 const viewport=page.viewportSize();
 assert(box&&button&&viewport);
 assert(box.x>=0&&box.x+box.width<=viewport.width&&box.y>=0&&box.y+box.height<=viewport.height,
  "the label fits in the viewport");
 assert(box.y+box.height<button.y||box.y>button.y+button.height,"the label keeps clear of the selected button and finger");
};
const gesture=async(name,kind=null)=>{
 await hit(name).scrollIntoViewIfNeeded();
 const at=await hit(name).evaluate(node=>{
  const box=node.getBoundingClientRect();
  const dock=document.querySelector(".discovery-bottom-nav")?.getBoundingClientRect().top??innerHeight;
  const scroller=node.closest(".likes-gallery-scroller").getBoundingClientRect();
  const top=Math.max(box.top,scroller.top);
  const bottom=Math.min(box.bottom,scroller.bottom,dock);
  return {x:box.x+box.width/2,y:(top+bottom)/2};
 });
 await touch("touchStart",at);
 await menu.waitFor({timeout:3000});
 if(kind){
  const target=menu.locator('[data-kind="'+kind+'"]');
  await pause(200);
  const end=await center(target);
  for(let i=1;i<=5;i++)await touch("touchMove",{x:at.x+(end.x-at.x)*i/5,y:at.y+(end.y-at.y)*i/5});
  await checkCaption(kind);
 }
 await touch("touchEnd");
 await menu.waitFor({state:"detached"});
};
const pickTab=name=>scope.getByRole("tab",{name,exact:true}).tap();
const icon=async(name,file)=>page.waitForFunction(({name,file})=>{
 const card=[...document.querySelectorAll(".likes-photo-card")].find(node=>node.querySelector(".likes-photo-hit")?.getAttribute("aria-label")==="Открыть анкету "+name);
 return card?.querySelector(".likes-card-indicator img")?.getAttribute("src")?.endsWith("/"+file+".svg");
 },{name,file},{timeout:7000});

try{
 await open();await hit("София").waitFor();
 await likesBadge.waitFor({timeout:5000});
 await chatsBadge.waitFor({timeout:5000});
 assert.equal(await likesBadge.textContent(),"2");
 assert.equal(await chatsBadge.textContent(),"2");
 assert.equal(await nav.locator("svg").count(),4);
 const checkDock=async()=>{
  const dock=await nav.boundingBox();
  const viewport=page.viewportSize();
  assert(dock&&viewport);
  assert(Math.abs(dock.width-(viewport.width-14)/1.5)<=2,"the dock is about two-thirds of the former width");
  assert(Math.abs(dock.x+dock.width/2-viewport.width/2)<=1,"the floating dock is centered");
  assert(dock.height>=46&&dock.height<=48&&viewport.height-dock.y-dock.height>=14,"the compact dock clears the bottom edge");
  assert(await nav.evaluate(node=>parseFloat(getComputedStyle(node).borderTopLeftRadius)>=node.clientHeight/2),
   "the dock has fully rounded ends");
  const targets=await nav.getByRole("button").evaluateAll(buttons=>buttons.map(button=>button.getBoundingClientRect().toJSON()));
  assert(targets.every(({width,height})=>width>=44&&height>=44),"all four buttons keep comfortable touch targets");
 };
 await checkDock();
 const active=nav.getByRole("button",{name:"Симпатии",exact:true});
 assert.equal(await active.getAttribute("aria-current"),"page");
 assert.equal(await active.evaluate(node=>getComputedStyle(node).backgroundColor),"rgba(0, 0, 0, 0)");
 assert.equal(await active.getAttribute("aria-description"),"Входящие симпатии: 2");
 unread=100;
 await page.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));
 await page.waitForFunction(()=>document.querySelector('[aria-description^="Непрочитанные"] .luemi-nav-badge')?.textContent==="99+");
 unread=0;

 await page.locator(".luemi-shell").evaluate(node=>node.style.setProperty("--viewport-safe-top","43px"));
 const layout=await scope.evaluate(node=>{
  const head=node.querySelector(".likes-gallery-chrome");
  const logo=head?.querySelector('img[alt="LUEMI"]');
  const bounds=logo?.getBoundingClientRect(),card=node.querySelector(".likes-photo-card").getBoundingClientRect();
  return {logoX:bounds?bounds.left+bounds.width/2:null,logoTop:bounds?.top,
   width:node.clientWidth,cardTop:card.top,
   galleryBg:getComputedStyle(node).backgroundImage,
   foreignHeader:!!document.querySelector(".real-discovery-home>.lh-header")};
 });
 assert(layout.logoX!==null&&Math.abs(layout.logoX-layout.width/2)<1,"original logo is centered");
 assert(layout.logoTop>=43&&layout.logoTop<=61,"logo sits within the Telegram-safe header");
 assert(layout.cardTop<185,"the gallery starts immediately below the compact tabs");
 assert.equal(layout.galleryBg,"none");
 assert.equal(layout.foreignHeader,false,"likes uses one integrated top surface");
 assert.equal(await scope.getByRole("button",{name:"Демо",exact:true}).count(),0,"QA controls require server authorization");
 assert.equal(await scope.getByLabel("Скрытые симпатии, 1").count(),1);
 assert.equal(await card("София").locator(".likes-photo-slide").count(),3);
 const heldAt=await center(hit("София"));
 await touch("touchStart",heldAt);
 await menu.waitFor();
 assert.equal(await caption.getAttribute("data-visible"),null);
 await pause(200);
 for(const kind of ["ordinary","super","skip","ordinary"]){
  await touch("touchMove",await center(menu.locator('[data-kind="'+kind+'"]')));
  await checkCaption(kind);
 }
 assert.equal(await caption.locator('[data-phase="previous"]').textContent().then(text=>text.trim()),captionText.skip);
 await touch("touchMove",heldAt);
 await page.waitForFunction(()=>!document.querySelector(".likes-fan-caption").hasAttribute("data-visible"));
 await touch("touchEnd");
 await menu.waitFor({state:"detached"});
 assert.deepEqual(serverRequests,[],"returning to the center cancels without submitting a reaction");
 await gesture("София","ordinary");
 await icon("София","like-outgoing");
 await overlay("София").waitFor({timeout:5000});
 assert.equal(await overlay("София").getByText("5",{exact:true}).count(),1);
 assert.equal(await notice.count(),0,"gallery countdown and Undo stay on the selected card");
 assert.deepEqual(serverRequests,[]);
 await undo("София").tap();
 await icon("София","like-incoming");
 assert.deepEqual(serverRequests,[],"Undo cancels before any real network write");

 await gesture("София","ordinary");
 await icon("София","like-outgoing");
 await departure("София","left");
 await likesBadge.waitFor({state:"detached",timeout:5000});
 await pickTab("Взаимно");
 await icon("София","like-mutual");
 await scope.getByRole("button",{name:"Написать София",exact:true}).tap();
 await page.locator(".lc-thread-route").getByText("София",{exact:true}).waitFor();
 await nav.waitFor({state:"hidden"});
 await page.locator(".lc-thread-route").getByRole("button",{name:"Назад",exact:true}).tap();
 await nav.waitFor();
 await chatsBadge.waitFor({state:"detached",timeout:5000});
 assert.deepEqual(serverRequests,["/api/v4/matches/like","/api/v4/matches/"+matchId+"/open"]);
 serverRequests.length=0;

 allowed=true;await open();
 await scope.getByRole("button",{name:"Демо",exact:true}).tap();
 await hit("Карина").waitFor();
 assert.equal(await scope.locator(".likes-photo-card").count(),4);
 const columns=await scope.locator(".likes-gallery-grid").evaluate(node=>getComputedStyle(node).gridTemplateColumns.split(" "));
 assert.equal(columns.length,2);
 const dots=card("Карина").locator(".likes-photo-dots");
 assert.equal(await dots.getAttribute("data-visible"),null);
 const at=await center(hit("Карина"));await touch("touchStart",at);
 for(let n=1;n<=6;n++)await touch("touchMove",{x:at.x-n*11,y:at.y+1});
 assert.equal(await dots.getAttribute("data-visible"),"true");
 assert.equal(await menu.count(),0);
 await touch("touchEnd");
 await page.waitForFunction(()=>document.querySelector(".likes-photo-card .likes-photo-dots i:nth-child(2)")?.hasAttribute("data-active"));
 assert.equal(await dots.locator("i").count(),4);
 assert.equal(await dots.textContent(),"","the carousel uses only dots");
 await page.waitForFunction(()=>document.querySelector(".likes-photo-card .likes-photo-dots")?.getAttribute("data-visible")===null);
 const scroll=scope.locator(".likes-gallery-scroller");
 await touch("touchStart",at);
 for(let n=1;n<=7;n++)await touch("touchMove",{x:at.x+1,y:at.y-n*14});
 await pause(170);
 await touch("touchEnd");
 await page.waitForFunction(()=>document.querySelector(".likes-gallery-scroller")?.scrollTop>20);
 assert.equal(await menu.count(),0,"a vertical drag scrolls the gallery without opening actions");
 await scroll.evaluate(node=>{node.scrollTop=0;});
 await page.waitForFunction(()=>document.querySelector(".likes-gallery-scroller")?.scrollTop===0);
 await pause(350);
 await gesture("Карина");
 assert.equal(await notice.count(),0,"releasing inside the fan cancels");
 await gesture("Карина","super");
 await icon("Карина","superlike-outgoing");
 assert.equal(await card("Карина").getAttribute("data-pending"),"true");
 const initialElina=await card("Элина").boundingBox();
 await Promise.all([
  departure("Карина","left"),
  page.waitForFunction(()=>document.querySelector(".likes-gallery-grid > :first-child")?.getAnimations()
   .some(animation=>animation.effect?.getKeyframes().some(frame=>frame.translate&&frame.translate!=="0px")),{},{timeout:8000})
 ]);
 await page.waitForFunction(()=>!document.querySelector(".likes-gallery-grid > :first-child")?.getAnimations().length);
 assert((await card("Элина").boundingBox()).x<initialElina.x,"the next card moves into the vacated slot");
 await pickTab("Взаимно");
 await icon("Карина","like-mutual");
 await scope.getByRole("button",{name:"Написать Карина"}).tap();
 await scope.getByText("В тестовом режиме переписка не создаётся.").waitFor();
 await pickTab("От вас");await icon("Арпи","superlike-outgoing");
 await pickTab("Вам");
 await icon("Элина","superlike-incoming");
 await gesture("Элина","skip");
 await icon("Элина","like-skipped");
 await undo("Элина").tap();
 await icon("Элина","superlike-incoming");
 await card("Элина").locator(".likes-card-reaction").evaluate(node=>Promise.all(node.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
 await gesture("Элина","skip");
 await departure("Элина","shrink");
 const rightName="Сара";
 await card(rightName).waitFor();
 assert.equal(await card(rightName).evaluate(node=>[...node.closest(".likes-gallery-grid").children].indexOf(node)%2),1);
 await gesture(rightName,"ordinary");
 await departure(rightName,"right");
 assert.deepEqual(serverRequests,[],"all demo mutations remain local");
 // Check the narrow layout as a fresh mobile session, independent of touch viewport offsets.
 await page.setViewportSize({width:320,height:568});
 await open();
 await nav.waitFor();
 await checkDock();
 assert.deepEqual(errors,[]);
 console.log("LIKES_GALLERY_BROWSER_PASS authorized demo, album dots, illustrated fan captions, inline undo, exits in both directions, shrink, reflow and mutual handoff");
}finally{await browser.close();}
