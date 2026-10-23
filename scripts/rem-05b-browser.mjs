import assert from "node:assert/strict";
import {chromium} from "playwright";

const site="http://127.0.0.1:5173/";
const actorId="11111111-1111-4111-8111-111111111111";
const session={mode:"session_v2",user:{id:actorId,firstName:"Тест"},
 csrfToken:"synthetic-csrf",expiresAt:"2026-11-01T00:00:00Z"};
const browser=await chromium.launch({headless:true});
try {
 for(const blocked of [false,true]){
  const context=await browser.newContext({viewport:{width:393,height:852},serviceWorkers:"block"});
  await context.addInitScript(()=>{
   window.__luemiDeleted=0;
   const original=IDBFactory.prototype.deleteDatabase;
   IDBFactory.prototype.deleteDatabase=function(name){
    window.__luemiDeleted++;
    return original.call(this,name);
   };
   window.Telegram={WebApp:{initData:"SYNTHETIC_SIGNED_INITDATA_NEVER_REAL",ready(){},expand(){},colorScheme:"light"}};
  });
  const page=await context.newPage();
  const errors=[];page.on("pageerror",err=>errors.push(err.message));
  let authCalls=0,probeCalls=0,healthCalls=0;
  const failedRequests=[];page.on('requestfailed',request=>failedRequests.push({url:request.url(),failure:request.failure()}));
  await page.route("**/telegram-web-app.js*",route=>route.fulfill({status:200,contentType:"application/javascript",body:""}));
  await page.route("**/api/health/live",route=>{healthCalls++;return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({status:"ok"})});});
  await page.route("**/api/v2/auth/telegram",route=>{
   authCalls++;
   const payload=route.request().postDataJSON();
   assert.equal(payload.initData,"SYNTHETIC_SIGNED_INITDATA_NEVER_REAL");
   return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(session)});
  });
  await page.route("**/api/v2/auth/session",route=>{
   probeCalls++;
   return route.fulfill({status:blocked?401:200,contentType:"application/json",
    body:blocked?JSON.stringify({error:"unauthorized"}):JSON.stringify(session)});
  });
  await page.goto(site,{waitUntil:"domcontentloaded"});
  if(blocked){
   await page.getByText("Не удалось подтвердить вход. Попробуй снова через Telegram.").waitFor({timeout:10000});
  }else{
   await page.getByRole("button",{name:/Начать/}).waitFor({timeout:7000}).catch(async error=>{
    const visible=(await page.locator("body").innerText()).slice(0,400);
    const runtime=await page.evaluate(()=>({initDataLength:window.Telegram?.WebApp?.initData?.length??0,
      scene:document.querySelector("main")?.getAttribute("data-scene"),
      phase:document.querySelector("main")?.getAttribute("data-phase")}));
    console.error("REM05B_DIAGNOSTIC",JSON.stringify({visible,runtime,healthCalls,authCalls,probeCalls,failedRequests}));
    throw error;
   });
  }
  assert.equal(healthCalls,1);assert.equal(authCalls,1);
  assert.equal(probeCalls,1);
  assert.deepEqual(errors,[]);
  const privacy=await page.evaluate(()=>({
   deleted:window.__luemiDeleted,
   storage:Object.keys(window.localStorage).filter(key=>/csrf|session|token|initdata/i.test(key)),
   href:location.href
  }));
  assert.equal(privacy.deleted,0,"No IDB destructive fallback");
  assert.equal(privacy.storage.length,0,"No persistent bearer material");
  assert.ok(!privacy.href.includes("SYNTHETIC_SIGNED"),"No token/query URL leakage");
  console.log(blocked?"REM05B_COOKIE_BLOCKED_FAIL_CLOSED_PASS":"REM05B_V2_MOCK_STARTUP_PASS");
  await context.close();
 }
}finally{await browser.close();}
