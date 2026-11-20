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
let state={...empty},likeError=false;
page.on("pageerror",error=>errors.push(error.message));
await page.route("**/api/**",async route=>{
 const req=route.request(),path=new URL(req.url()).pathname;
 const send=(json,status=200)=>route.fulfill({status,json});
 if(path==="/api/v2/auth/telegram"||path==="/api/v2/auth/session")
  return send({user:{id:actorId,firstName:"QA"},csrfToken:"qa_csrf_token"});
 if(path==="/api/v3/discovery/profile/"+peer)return send({profile});
 if(path.startsWith("/api/v3/discovery/photo/"))return route.fulfill({contentType:"image/svg+xml",
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
const badge=root.locator(".profile-reaction-badge");
const waitState=state=>page.waitForFunction(state=>document.querySelector(".owner-premium-profile")?.dataset.morphState===state,state);
const open=async value=>{
 state={...empty,...value};
 await page.goto(base+"/profile-qa.html?profileReactions=1&luemiRoute=likes");
 await page.getByRole("button",{name:/Карина/}).click();
 await root.waitFor();await waitState("expanded");
 await page.waitForFunction(()=>Math.abs(document.querySelector(".discovery-visitor-route")?.getBoundingClientRect().left??100)<1);
};
const opacity=async()=>expanded.evaluate(node=>Number(getComputedStyle(node).opacity));
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
 await delay(180);
 assert.equal(await opacity(),held,"opacity stays under the held finger");
 await finger("touchMove",y-20);
 await delay(65);
 assert(await opacity()>held,"reversing immediately reverses the fade");
 for(let offset=28;offset<=196;offset+=14){await finger("touchMove",y-offset);await delay(16);}
 await finger("touchEnd");await waitState("compact");
 assert.equal(await opacity(),0);
 assert.equal(await compact.evaluate(x=>Number(getComputedStyle(x).opacity)),1);
 assert.equal(await like.count(),1);
 const compactName=await root.getByRole("heading",{name:"Карина, 25"}).boundingBox();
 assert((await like.boundingBox()).x<compactName.x);
 assert((await superlike.boundingBox()).x>compactName.x+compactName.width);
 await like.tap();
 await badge.getByText("Симпатия отправлена",{exact:true}).waitFor();
 assert.deepEqual(requests,[{targetId:peer,kind:"ordinary"}]);
 assert.equal(await like.count(),0);
 const bounds=await badge.boundingBox(),profileBounds=await root.boundingBox();
 assert.equal(bounds.x,profileBounds.x);
 assert.equal(bounds.width,profileBounds.width);
 const tabBounds=await root.getByRole("tablist").boundingBox();
 assert(Math.abs(bounds.y-tabBounds.y-tabBounds.height)<1);
 for(const label of ["Фото","Блики","Подарки","О себе"]){
  await root.getByRole("tab",{name:label,exact:true}).click();
  assert.equal(await badge.isVisible(),true);
  assert.equal(await root.getAttribute("data-morph-state"),"compact");
 }
 const compactPanel=await root.getByRole("tabpanel").boundingBox(),compactY=compactPanel.y+35;
 await finger("touchStart",compactY);
 for(let offset=14;offset<=196;offset+=14){await finger("touchMove",compactY+offset);await delay(16);}
 await finger("touchEnd");await waitState("expanded");
 assert.equal(await badge.isVisible(),true);
 await touch.detach();
 await open({outgoing:"super"});
 await badge.getByText("Суперлайк отправлен",{exact:true}).waitFor();
 await open({incoming:"super"});
 await badge.getByText("Вам отправили суперлайк",{exact:true}).waitFor();
 likeError=true;
 await superlike.tap();
 await badge.getByRole("alert").getByText("Суперлайки закончились.").waitFor();
 assert.equal(await badge.getByText("Вам отправили суперлайк",{exact:true}).isVisible(),true);
 likeError=false;
 await open({incoming:"ordinary"});
 await badge.getByText("Вам отправили симпатию",{exact:true}).waitFor();
 await superlike.tap();
 await badge.getByText("Взаимный лайк",{exact:true}).waitFor();
 assert.equal(await like.count(),0);
 await badge.getByRole("button",{name:"Написать"}).tap();
 await page.locator(".lc-thread-route").getByText("Карина",{exact:true}).waitFor();
 if(!requests.includes(`/api/v4/chats/${conversationId}/messages`))
  await page.waitForRequest(req=>req.url().endsWith(`/api/v4/chats/${conversationId}/messages`));
 assert(requests.includes(`/api/v4/matches/${matchId}/open`));
 assert.deepEqual(errors,[]);
 console.log("PROFILE_REACTIONS_BROWSER_PASS layout, hold/reverse, all labels, error, chat on Chromium Android emulation");
}finally{await browser.close();}
