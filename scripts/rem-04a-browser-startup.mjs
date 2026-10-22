import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,channel:"chrome",args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852}});
const failures=[];
const logo="/assets/brand/wordmark_original_raster_alpha_W06.webp";
const once=(name)=>console.log("REM04A_STARTUP_BROWSER_PASS "+name);
async function scenario({name,fontHang=false,logoError=false,auth="success",health="success",retry=false}){
 const p=await context.newPage();p.on("pageerror",e=>failures.push(e.message));
 await p.route("https://telegram.org/js/telegram-web-app.js",route=>route.fulfill({status:200,contentType:"application/javascript",body:""}));
 await p.addInitScript(({fontHang})=>{
  window.Telegram={WebApp:{initData:"REM04A_TELEGRAM_ID",colorScheme:"light",ready(){},expand(){},
   isVersionAtLeast(){return false;},disableVerticalSwipes(){},setHeaderColor(){},setBackgroundColor(){}}};
  if(fontHang)Object.defineProperty(document.fonts,"ready",{configurable:true,get:()=>new Promise(()=>{})});
 },{fontHang});
 if(logoError)await p.route("**"+logo,route=>route.fulfill({status:404,body:"missing-logo"}));
 if(health==="offline")await p.route("**/api/health/live",route=>route.abort("internetdisconnected"));
 else if(health==="pending")await p.route("**/api/health/live",async()=>await new Promise(()=>{}));
 else await p.route("**/api/health/live",route=>route.fulfill({status:200,contentType:"application/json",body:'{"status":"ok"}'}));
 let calls=0;
 await p.route("**/api/auth/telegram",route=>{
  calls++;
  const result=retry&&calls===1?"401":auth;
  if(result==="401")return route.fulfill({status:401,contentType:"application/json",body:'{"error":"unauthorized"}'});
  if(result==="503")return route.fulfill({status:503,body:"not available"});
  return route.fulfill({status:200,contentType:"application/json",body:'{"user":{"firstName":"LUEMI QA","id":"fixture"}}'});
 });
 if(health==="pending")await p.clock.install();
 const t=Date.now();await p.goto("http://127.0.0.1:5173/",{waitUntil:"domcontentloaded"});
 if(health==="pending"){
  await p.waitForTimeout(70);
  await p.clock.fastForward(15200);
  await p.getByText("Не удалось подтвердить вход.").waitFor({timeout:2500});
  const elapsed=Date.now()-t;
  once("15-second critical deadline fails closed even with unresolved health fetch and optional work");
  await p.close();return {name,elapsedMs:elapsed,status:"error"};
 }
 if(auth==="401"||health==="offline"||retry){
  await p.getByText("Не удалось подтвердить вход.").waitFor({timeout:4500});
  assert.equal(await p.locator(".intro-cta").count(),0,"failed auth must not reveal entry");
  if(retry){
   const before=await p.locator(".entry-state").count();
   await p.getByRole("button",{name:"Повторить"}).click();
   await p.locator(".intro-cta").waitFor({timeout:6500});
   assert.equal(await p.locator(".entry-state").count(),before,"retry reuses same welcome container");
   assert.equal(calls,2,"retry must use fresh auth request generation");
  }
 }else if(auth==="503"){
  await p.getByText("Тестовый сервер готов, но авторизация пока отключена.").waitFor({timeout:3500});
  assert.equal(await p.locator(".intro-cta").count(),0);
 }else{
  await p.locator(".intro-cta").waitFor({timeout:6500});
  assert.equal(await p.locator(".intro-logo").getAttribute("src"),logo,"original LUEMI brand must remain unchanged");
 }
 const elapsed=Date.now()-t;
 const result={name,elapsedMs:elapsed,cta:await p.locator(".intro-cta").count(),authRequests:calls};
 console.log("REM04A_STARTUP_CASE "+JSON.stringify(result));
 await p.close();return result;
}
try{
 await scenario({name:"optional-font-pending",fontHang:true});
 await scenario({name:"logo-fails-auth-success",logoError:true});
 await scenario({name:"auth-401-optional-font-hang",fontHang:true,auth:"401"});
 await scenario({name:"offline-health",health:"offline"});
 await scenario({name:"needs-bot",auth:"503"});
 await scenario({name:"auth-retry-new-generation",retry:true});
 await scenario({name:"auth-explicit-deadline",health:"pending",fontHang:true});
 assert.deepEqual(failures,[],"no uncaught browser errors");
 console.log("REM-04A BROWSER STARTUP QA PASS · Chrome synthetic; physical Telegram Android/iOS NOT VERIFIED");
}finally{await context.close();await browser.close();}
