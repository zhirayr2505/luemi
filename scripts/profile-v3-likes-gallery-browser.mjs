import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true,args:["--no-sandbox"],
 ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
const context=await browser.newContext({viewport:{width:393,height:700},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"});
const page=await context.newPage(),device=await context.newCDPSession(page);
const actor="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",peer="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const photoIds=["cccccccc-cccc-4ccc-8ccc-cccccccccccc","dddddddd-dddd-4ddd-8ddd-dddddddddddd","eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"];
const photos=photoIds.map(id=>"/api/v3/discovery/photo/"+id);
const matchId="ffffffff-ffff-4fff-8fff-ffffffffffff",conversationId="11111111-1111-4111-8111-111111111111";
let allowed=false,liveMatched=false;
const serverRequests=[],errors=[];
page.on("pageerror",error=>errors.push(error.message));
await page.route("**/api/**",route=>{
 const req=route.request(),path=new URL(req.url()).pathname;
 const send=json=>route.fulfill({status:200,json});
 if(path==="/api/v2/auth/telegram"||path==="/api/v2/auth/session")return send({user:{id:actor,firstName:"QA"},csrfToken:"qa_token"});
 if(path==="/api/v2/qa/fixtures-access")return send({allowed});
 if(path.startsWith("/api/v4/matches")&&req.method()!=="GET")serverRequests.push(path);
 const item={id:peer,name:"София",createdAt:"2026-11-20T15:00:00.000Z",kind:"ordinary",photoUrl:photos[0],photos};
 if(path==="/api/v4/matches/incoming")return send({likes:liveMatched?[]:[item],premium:false,hiddenCount:1});
 if(path==="/api/v4/matches/gallery")return send({outgoing:[],mutual:liveMatched?[{...item,kind:null,matchId,conversationId:null}]:[]});
 if(path==="/api/v4/matches/like"){
  liveMatched=true;
  return send({liked:true,matched:true,matchId,kind:"ordinary",superlikes:{weekly:3,purchased:0,total:3,renewsAt:item.createdAt}});
 }
 if(path==="/api/v4/matches/"+matchId+"/open")return send({conversationId});
 if(path==="/api/v4/matches/new")return send({matches:[],viewerGender:"man"});
 if(path==="/api/v4/chats")return send({conversations:[]});
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
const card=name=>scope.locator(".likes-photo-card").filter({has:page.getByRole("button",{name:"Открыть анкету "+name,exact:true})});
const hit=name=>card(name).getByRole("button",{name:"Открыть анкету "+name,exact:true});
const menu=page.locator(".likes-fan"),notice=page.locator(".profile-reaction-notice");
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const touch=(type,coords)=>device.send("Input.dispatchTouchEvent",{type,
 touchPoints:coords?[{...coords,id:7,radiusX:2,radiusY:2,force:1}]:[]});
const center=async locator=>{const b=await locator.boundingBox();assert(b);return {x:b.x+b.width/2,y:b.y+b.height/2};};
const gesture=async(name,kind=null)=>{
 const at=await center(hit(name));await touch("touchStart",at);
 await menu.waitFor({timeout:3000});
 if(kind){
  const target=menu.locator('[data-kind="'+kind+'"]');
  await pause(200);
  const end=await center(target);
  for(let i=1;i<=5;i++)await touch("touchMove",{x:at.x+(end.x-at.x)*i/5,y:at.y+(end.y-at.y)*i/5});
  assert.equal(await menu.getAttribute("data-selected"),kind,"touch continues to reach the fan even along a vertical ray");
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
 assert.equal(await scope.getByRole("button",{name:"Демо",exact:true}).count(),0,"QA controls require server authorization");
 assert.equal(await scope.getByLabel("Скрытые симпатии, 1").count(),1);
 assert.equal(await card("София").locator(".likes-photo-slide").count(),3);
 await gesture("София","ordinary");
 await icon("София","like-outgoing");
 assert.deepEqual(serverRequests,[]);
 await notice.getByRole("button",{name:"Отменить"}).tap();
 await icon("София","like-incoming");
 assert.deepEqual(serverRequests,[],"Undo cancels before any real network write");

 await gesture("София","ordinary");
 await icon("София","like-outgoing");
 await notice.waitFor({state:"hidden",timeout:8000});
 await pickTab("Взаимно");
 await icon("София","like-mutual");
 await scope.getByRole("button",{name:"Написать София",exact:true}).tap();
 await page.locator(".lc-thread-route").getByText("София",{exact:true}).waitFor();
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
 await notice.waitFor({state:"hidden",timeout:8000});
 await hit("Карина").waitFor({state:"hidden"});
 await pickTab("Взаимно");
 await icon("Карина","like-mutual");
 await scope.getByRole("button",{name:"Написать Карина"}).tap();
 await scope.getByText("В тестовом режиме переписка не создаётся.").waitFor();
 await pickTab("От вас");await icon("Арпи","superlike-outgoing");
 await pickTab("Вам");
 await icon("Элина","superlike-incoming");
 await gesture("Элина","skip");
 await icon("Элина","like-skipped");
 await notice.getByRole("button",{name:"Отменить"}).tap();
 await icon("Элина","superlike-incoming");
 await gesture("Элина","skip");
 await notice.waitFor({state:"hidden",timeout:8000});
 await hit("Элина").waitFor({state:"hidden"});
 assert.deepEqual(serverRequests,[],"all demo mutations remain local");
 assert.deepEqual(errors,[]);
 console.log("LIKES_GALLERY_BROWSER_PASS authorized demo, two-column gallery, album dots, touch fan, cancel, preview, skip/undo and mutual handoff");
}finally{await browser.close();}
