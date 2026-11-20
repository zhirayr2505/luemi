import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {chromium} from "playwright";

const chromiumPath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||"/usr/bin/chromium";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"],
 ...(existsSync(chromiumPath)?{executablePath:chromiumPath}:{})});
const device={viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"};
const context=await browser.newContext(device);
const page=await context.newPage();
const actorId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",peer="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const matchId="cccccccc-cccc-4ccc-8ccc-cccccccccccc",conversationId="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const now="2026-11-20T16:00:00.000Z";
const photos=["1","2","3"].map(n=>{const id=`eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee${n}`;
 return {id,url:"/api/v3/discovery/photo/"+id};});
const profile={id:peer,name:"Карина",age:25,city:"Краснодар",countryCode:"RU",about:"Кадр для проверки",
 gender:"woman",goal:"serious",interests:["music"],languages:[],photos,likedYouKind:null,publishedAt:now};
const empty={outgoing:null,incoming:null,matchId:null};
const requests=[],errors=[];
const demoMatchingRequests=[];
let state={...empty},likeError=false,demoAllowed=false;
page.on("pageerror",error=>errors.push(error.message));
await page.route("**/api/**",async route=>{
 const req=route.request(),path=new URL(req.url()).pathname;
 const send=(json,status=200)=>route.fulfill({status,json});
 if(demoAllowed&&path.startsWith("/api/v4/matches"))demoMatchingRequests.push(path);
 if(path==="/api/v2/auth/telegram"||path==="/api/v2/auth/session")
  return send({user:{id:actorId,firstName:"QA"},csrfToken:"qa_csrf_token"});
 if(path==="/api/v2/qa/fixtures-access")return send({allowed:demoAllowed});
 if(path==="/api/v3/discovery/profile/"+peer)return send({profile});
 if(path.startsWith("/api/v3/discovery/photo/")||path.startsWith("/api/v2/qa/portraits/"))return route.fulfill({contentType:"image/svg+xml",
  body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#893c32"/></svg>'});
 if(path==="/api/v4/matches/incoming")return send({likes:[{id:peer,name:profile.name,createdAt:now,
  kind:state.incoming??"ordinary",photoUrl:photos[0].url}],premium:false,hiddenCount:0});
 if(path==="/api/v4/matches/profile/"+peer)return send(state);
 if(path==="/api/v4/matches/like"){
  const {targetId,kind}=req.postDataJSON();requests.push({targetId,kind});
  if(likeError)return send({error:"superlikes_empty"},409);
  state={...state,outgoing:kind,matchId:state.incoming?matchId:null};
  return send({liked:true,kind,matched:!!state.matchId,...(state.matchId?{matchId}:{}),
   superlikes:{weekly:2,purchased:0,total:2,renewsAt:now}});
 }
 if(path===`/api/v4/matches/${matchId}/open`){requests.push(path);return send({conversationId});}
 if(path==="/api/v4/matches/new")return send({matches:[],viewerGender:"man"});
 if(path==="/api/v4/chats")return send({conversations:[]});
 if(path==="/api/v4/chats/me")return send({actorId});
 if(path===`/api/v4/chats/${conversationId}/messages`){requests.push(path);return send({messages:[],nextCursor:null});}
 return send({allowed:false});
});
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const root=page.locator(".owner-premium-profile");
const expanded=root.locator('[data-reaction-layout="expanded"]');
const compact=root.locator('[data-reaction-layout="compact"]');
const like=root.getByRole("button",{name:"Поставить лайк"});
const superlike=root.getByRole("button",{name:"Отправить суперлайк"});
const errorBanner=root.locator(".profile-reaction-error");
const noStatusStrip=()=>root.evaluate(node=>
 node.querySelector(".owner-profile-tabs")?.nextElementSibling?.classList.contains("owner-profile-viewport"));
const indicator=root.locator(".profile-reaction-indicator img[data-active]");
const notice=page.locator(".profile-reaction-notice");
const undo=notice.getByRole("button",{name:"Отменить"});
const waitIcon=async name=>{
 await page.waitForFunction(name=>{
  const image=document.querySelector(".profile-reaction-indicator img[data-active]");
  return image?.getAttribute("src")?.endsWith("/"+name+".svg")&&image.complete&&image.naturalWidth>0;
 },name,{timeout:4500});
 return indicator.boundingBox();
};
const waitState=state=>page.waitForFunction(state=>document.querySelector(".owner-premium-profile")?.dataset.morphState===state,state);
const open=async value=>{
 state={...empty,...value};
 await page.goto(base+"/profile-qa.html?profileReactions=1&luemiRoute=likes");
 await page.getByRole("button",{name:/Карина/}).click();
 await root.waitFor();await waitState("expanded");
 await page.waitForFunction(()=>Math.abs(document.querySelector(".discovery-visitor-route")?.getBoundingClientRect().left??100)<1);
};
const opacity=(layer=expanded)=>layer.evaluate(node=>Number(getComputedStyle(node).opacity));
const waitForReactions=layout=>page.waitForFunction(layout=>{
 const active=document.querySelector(`[data-reaction-layout="${layout}"]`);
 return active&&Number(getComputedStyle(active).opacity)===1;
},layout);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
 await open({});
 await like.waitFor();
 assert.equal(await like.count(),1,"only the visible copy is accessible");
 assert.equal(await opacity(),1);
 const name=await root.getByRole("heading",{name:"Карина, 25"}).boundingBox();
 for(const button of [like,superlike]){
  const box=await button.boundingBox();
  assert(box.x>name.x+name.width&&Math.abs((box.y+box.height/2)-(name.y+name.height/2))<2);
 }
 const panel=await root.getByRole("tabpanel").boundingBox();
 assert.equal(await root.getByRole("tabpanel").evaluate(node=>getComputedStyle(node).overflowY),"auto");
 const touch=await context.newCDPSession(page);
 const x=panel.x+panel.width/2,y=panel.y+100;
 const finger=(type,y)=>touch.send("Input.dispatchTouchEvent",{type,touchPoints:type==="touchEnd"?[]:[{x,y,id:1}]});
 await finger("touchStart",y);
 await finger("touchMove",y-42);
 await page.waitForFunction(()=>{
  const el=document.querySelector('[data-reaction-layout="expanded"]');
  return el&&Number(el.style.opacity)<1&&Number(el.style.opacity)>0;
 });
 const held=await opacity();
 assert.equal(await root.getByRole("tabpanel").evaluate(node=>getComputedStyle(node).overflowY),"auto",
  "vertical motion keeps the same scrolling layer");
 assert.equal(await opacity(compact),0,"compact buttons are still hidden during the collapse");
 await delay(180);
 assert.equal(await opacity(),held,"opacity stays under the held finger");
 await finger("touchMove",y-20);
 await delay(65);
 assert(await opacity()>held,"reversing immediately reverses the fade");
 for(let offset=28;offset<=196;offset+=14){await finger("touchMove",y-offset);await delay(16);}
 assert.equal(await opacity(),0,"expanded buttons have fully disappeared");
 assert.equal(await opacity(compact),0,"compact buttons stay hidden through the drag");
 await finger("touchEnd");await waitState("compact");
 assert.equal(await opacity(),0);
 await waitForReactions("compact");
 assert.equal(await like.count(),1);
 const compactName=await root.getByRole("heading",{name:"Карина, 25"}).boundingBox();
 assert((await like.boundingBox()).x<compactName.x);
 assert((await superlike.boundingBox()).x>compactName.x+compactName.width);
 const reversePanel=await root.getByRole("tabpanel").boundingBox(),reverseY=reversePanel.y+35;
 await finger("touchStart",reverseY);
 await finger("touchMove",reverseY+42);
 await page.waitForFunction(()=>{
  const layer=document.querySelector('[data-reaction-layout="compact"]');
  return layer&&Number(layer.style.opacity)<1;
 });
 assert.equal(await opacity(),0,"expanded buttons stay hidden while the profile reopens");
 for(let offset=56;offset<=196;offset+=14){await finger("touchMove",reverseY+offset);await delay(16);}
 assert.equal(await opacity(compact),0);
 assert.equal(await opacity(),0,"expanded buttons wait for the gesture to end");
 await finger("touchEnd");await waitState("expanded");await waitForReactions("expanded");
 await finger("touchStart",y);
 for(let offset=14;offset<=196;offset+=14){await finger("touchMove",y-offset);await delay(16);}
 await finger("touchEnd");await waitState("compact");await waitForReactions("compact");
 await like.tap();
 await notice.getByText("Вы отправили симпатию").waitFor({timeout:4500});
 assert.equal(await notice.getByText(profile.name,{exact:true}).isVisible(),true);
 assert.equal(await notice.getByText("5",{exact:true}).isVisible(),true);
 const compactIcon=await waitIcon("like-outgoing");
 const avatar=await root.locator(".owner-profile-photo-mask").boundingBox();
 const dx=compactIcon.x+compactIcon.width/2-(avatar.x+avatar.width/2);
 const dy=compactIcon.y+compactIcon.height/2-(avatar.y+avatar.height/2);
 assert(dx>0&&dy>0&&Math.abs(Math.hypot(dx,dy)-avatar.width/2)<3,"indicator lies on the avatar rim");
 assert.deepEqual(requests,[],"no network reaction while Undo is available");
 await undo.tap();
 await like.waitFor();
 assert.equal(await indicator.count(),0,"Undo restores the prior empty badge");
 assert.deepEqual(requests,[]);
 await like.tap();
 await waitIcon("like-outgoing");
 await notice.getByText("1",{exact:true}).waitFor();
 assert.deepEqual(requests,[],"the API still has no request in the last undo second");
 await notice.waitFor({state:"hidden"});
 await root.getByRole("img",{name:"Симпатия отправлена",exact:true}).waitFor();
 assert.deepEqual(requests,[{targetId:peer,kind:"ordinary"}]);
 assert.equal(await like.count(),0);
 assert.equal(await noStatusStrip(),true,"the content starts right under the tabs");
 for(const label of ["Фото","Блики","Подарки","О себе"]){
  await root.getByRole("tab",{name:label,exact:true}).click();
  assert.equal(await noStatusStrip(),true);
  assert.equal(await root.getAttribute("data-morph-state"),"compact");
 }
 // Start on the compact avatar so Chromium's native scroll lock cannot
 // claim a synthetic swipe on the already tested tab scroller.
 const currentAvatar=await root.locator(".owner-profile-avatar-circle").boundingBox();
 const compactY=currentAvatar.y+currentAvatar.height/2;
 const beforeDrag=await indicator.boundingBox();
 await finger("touchStart",compactY);
 await finger("touchMove",compactY+9);
 await delay(24);
 await finger("touchMove",compactY+42);
 const indicatorY=()=>indicator.evaluate(image=>image.getBoundingClientRect().y);
 const compactYAtRest=beforeDrag.y;
 await page.waitForFunction(y=>{
  const image=document.querySelector(".profile-reaction-indicator img[data-active]");
  return image&&image.getBoundingClientRect().y>y+8;
 },compactYAtRest,{timeout:3000});
 const heldIconY=await indicatorY();
 await delay(120);
 assert.equal(await indicatorY(),heldIconY,"the indicator stops with the held finger");
 await finger("touchMove",compactY+22);
 await page.waitForFunction(y=>{
  const image=document.querySelector(".profile-reaction-indicator img[data-active]");
  return image&&image.getBoundingClientRect().y<y-4;
 },heldIconY,{timeout:3000});
 for(let offset=28;offset<=196;offset+=14){await finger("touchMove",compactY+offset);await delay(16);}
 await finger("touchEnd");await waitState("expanded");
 assert.equal(await noStatusStrip(),true);
 const expandedIcon=await waitIcon("like-outgoing");
 const heading=await root.getByRole("heading",{name:"Карина, 25"}).boundingBox();
 assert(expandedIcon.x>=heading.x+heading.width,"indicator arrives beside the expanded name");
 await touch.detach();
 await open({outgoing:"super"});
 await root.getByRole("img",{name:"Суперлайк отправлен",exact:true}).waitFor();
 await waitIcon("superlike-outgoing");
 await open({incoming:"super"});
 await root.getByRole("img",{name:"Вам отправили суперлайк",exact:true}).waitFor();
 await waitIcon("superlike-incoming");
 likeError=true;
 await superlike.tap();
 await errorBanner.getByRole("alert").getByText("Суперлайки закончились.").waitFor();
 assert.equal(await root.getByRole("img",{name:"Вам отправили суперлайк",exact:true}).isVisible(),true);
 likeError=false;
 profile.name="Карина Александровна Александрова";
 await open({incoming:"ordinary"});
 const incomingLongName=await waitIcon("like-incoming");
 const likeBesideLongName=await like.boundingBox();
 assert(incomingLongName.x+incomingLongName.width<likeBesideLongName.x,"indicator and actions fit beside a long name");
 profile.name="Карина";
 await open({incoming:"ordinary"});
 await root.getByRole("img",{name:"Вам отправили симпатию",exact:true}).waitFor();
 await waitIcon("like-incoming");
 await superlike.tap();
 await waitIcon("superlike-outgoing");
 assert.equal(await root.getByRole("img",{name:"Взаимный лайк",exact:true}).count(),0);
 await undo.tap();
 await waitIcon("like-incoming");
 await superlike.tap();
 await root.getByRole("img",{name:"Взаимный лайк",exact:true}).waitFor();
 await waitIcon("like-mutual");
 assert.equal(await like.count(),0);
 await root.getByRole("button",{name:"Написать"}).tap();
 await page.locator(".lc-thread-route").getByText("Карина",{exact:true}).waitFor();
 if(!requests.includes(`/api/v4/chats/${conversationId}/messages`))
  await page.waitForRequest(req=>req.url().endsWith(`/api/v4/chats/${conversationId}/messages`));
 assert(requests.includes(`/api/v4/matches/${matchId}/open`));
 demoAllowed=true;
 await page.goto(base+"/profile-qa.html?profileReactions=1&luemiDemo=1");
 const demoFeed=page.getByLabel("Тестовая лента LUEMI");
 const openDemo=async name=>{
  await demoFeed.getByRole("button",{name,exact:true}).click();
  await root.getByRole("heading",{name,exact:true}).waitFor();
  await page.waitForFunction(()=>Math.abs(document.querySelector(".discovery-visitor-route")?.getBoundingClientRect().left??100)<1);
 };
 await openDemo("Карина, 25");
 assert.equal(await like.count(),1,"the owner's first demo profile must expose reactions");
 await like.tap();
 await notice.getByText("Тестовая симпатия").waitFor();
 await page.keyboard.press("Escape");
 await root.waitFor({state:"hidden"});
 await undo.waitFor();
 await openDemo("Карина, 25");
 await waitIcon("like-outgoing");
 await notice.waitFor({state:"hidden"});
 await root.getByRole("img",{name:"Тестовый лайк поставлен",exact:true}).waitFor();
 assert.equal(await noStatusStrip(),true);
 await page.keyboard.press("Escape");
 await root.waitFor({state:"hidden"});
 await demoFeed.getByRole("button",{name:"Пропустить",exact:true}).tap();
 await openDemo("Элина, 24");
 await superlike.tap();
 await notice.getByText("Тестовый суперлайк",{exact:true}).waitFor({timeout:4500});
 await waitIcon("superlike-outgoing");
 await notice.waitFor({state:"hidden"});
 await root.getByRole("img",{name:"Тестовый суперлайк поставлен",exact:true}).waitFor();
 assert.equal(await noStatusStrip(),true);
 assert.deepEqual(demoMatchingRequests,[],"demo profiles never load or write real matching data");
 assert.deepEqual(errors,[]);
 console.log("PROFILE_REACTIONS_BROWSER_PASS layout, indicator hold/reverse, five-second undo, deferred delivery, real and demo reactions, error, chat on Chromium Android emulation");
}finally{await browser.close();}
