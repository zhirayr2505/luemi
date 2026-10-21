import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import {chromium} from "playwright";

const BASE=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const UA="Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const states=page=>page.locator('[data-testid="geo-current"]');
const state=async page=>JSON.parse(await states(page).innerText());
const wait=async(fn,label,ms=5000)=>{
 const start=Date.now();
 while(Date.now()-start<ms){if(await fn())return;await sleep(40)}
 throw new Error("REM01A WAIT FAILED: "+label);
};
const screenshot=async(page,name)=>{
 await mkdir("qa-artifacts/rem-01a",{recursive:true});
 const bytes=await page.screenshot({type:"png",animations:"disabled"});
 await writeFile("qa-artifacts/rem-01a/"+name+".png",bytes);
 console.log("REM01A_SNAPSHOT "+JSON.stringify({name,sha256:createHash("sha256").update(bytes).digest("hex"),width:page.viewportSize().width,height:page.viewportSize().height}));
};
const places={
 kras:{id:"offline:ru:krasnodar",city:"Краснодар",country:"Россия",countryCode:" ru "},
 mos:{id:"offline:ru:moscow",city:"Москва",country:"Россия",countryCode:"RU"},
 yer:{id:"offline:am:yerevan",city:"Ереван",country:"Армения",countryCode:"am"}
};
function recordPageErrors(page){
 const errors=[];page.on("pageerror",e=>errors.push(e.message));return errors;
}
async function geoPage(browser,{permission="granted"}={}){
 const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,userAgent:UA});
 await ctx.addInitScript(()=>{
  const captures=[];
  Object.defineProperty(navigator,"geolocation",{configurable:true,value:{
   getCurrentPosition(success,error,options){captures.push({success,error,options})}
  }});
  window.__REM01A_GPS__={
   count:()=>captures.length,
   success:(i)=>captures[i].success({coords:{latitude:45.0393,longitude:38.9872}}),
   deny:(i)=>captures[i].error({code:1,message:"permission denied"})
  };
 });
 const page=await ctx.newPage(),errors=recordPageErrors(page),search=[],reverse=[];
 await page.route("**/api/geo/search?*",route=>{search.push(route)});
 await page.route("**/api/geo/reverse",route=>{reverse.push(route)});
 await page.goto(BASE+"/geo-qa.html",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Выбрать город вручную"}).waitFor({state:"visible"});
 return {ctx,page,search,reverse,errors};
}
const payload=async(route,result)=>{
 try{await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(result)});}
 catch(error){console.log("REM01A_EXPECTED_ABORT "+String(error).slice(0,130));}
};
async function selectPlace(s,query,place){
 const {page,search}=s,expected=search.length+1;
 await page.getByRole("combobox").fill(query);
 await wait(()=>search.length>=expected,"search request "+query);
 await payload(search[expected-1],{results:[place],coverage:"demo"});
 const item=page.getByRole("option",{name:new RegExp(place.city)});
 await item.waitFor({state:"visible",timeout:3000});
 await item.click();
 await wait(async()=>(await state(page)).city===place.city,"chosen "+place.city);
}
async function geoRaces(browser){
 const s=await geoPage(browser),{ctx,page,search,reverse,errors}=s;
 try{
  await page.getByRole("button",{name:"Выбрать город вручную"}).click();
  await page.getByRole("combobox").fill("Моск");
  await wait(()=>search.length===1,"A search queued");
  await page.getByRole("combobox").fill("Краснод");
  await wait(()=>search.length===2,"B search queued");
  await payload(search[1],{results:[places.kras],coverage:"demo"});
  await page.getByRole("option",{name:/Краснодар/}).waitFor({state:"visible"});
  await payload(search[0],{results:[places.mos],coverage:"demo"});
  assert.equal(await page.getByRole("option",{name:/Москва/}).count(),0,"late A never overrides B");
  await page.getByRole("option",{name:/Краснодар/}).click();
  assert.deepEqual([ (await state(page)).city,(await state(page)).countryCode],["Краснодар","RU"]);
  const choices=await page.evaluate(()=>window.__REM01A_FIXTURE__.patches.filter(p=>p.placeId));
  assert.equal(choices.length,1,"one valid current location patch");

  // Typed search failure must preserve chosen city rather than clearing draft.
  const idx=search.length;
  await page.getByRole("combobox").fill("Москва");
  await wait(()=>search.length===idx+1,"failure query");
  await payload(search[idx],{results:"invalid-provider-json"});
  await page.getByRole("alert").waitFor({state:"visible",timeout:3000});
  assert.equal((await state(page)).city,"Краснодар","previous city survives broken provider JSON");
  assert.equal((await state(page)).countryCode,"RU");
  // Shortening input aborts current fetch and removes spinner; reverse data untouched.
  await page.getByRole("combobox").fill("Ереван");
  await wait(()=>search.length===idx+2,"long query");
  await page.getByRole("combobox").fill("Е");
  await sleep(120);
  assert.equal(await page.locator(".geo-input-wrap .spin").count(),0,"short query ends visible searching");
  assert.equal((await state(page)).city,"Краснодар");
  assert.equal(await page.getByRole("option").count(),0,"stale suggestions cleared");
  await payload(search[idx+1],{results:[places.yer],coverage:"demo"});
  await sleep(130);assert.equal((await state(page)).city,"Краснодар");

  // Begin unabortable GPS, then manual choice; stale callback must not request reverse.
  await page.getByRole("button",{name:/Определить моё местоположение/}).click();
  await page.getByRole("button",{name:/Определить местоположение снова/}).click();
  await wait(async()=>await page.evaluate(()=>window.__REM01A_GPS__.count())===1,"GPS pending");
  await page.getByRole("button",{name:"Выбрать город вручную"}).click();
  await selectPlace(s,"Ереван",places.yer);
  const reverseBefore=reverse.length;
  await page.evaluate(()=>window.__REM01A_GPS__.success(0));
  await sleep(170);
  assert.equal(reverse.length,reverseBefore,"stale browser GPS must not initiate reverse");
  assert.equal((await state(page)).city,"Ереван");
  assert.equal((await state(page)).countryCode,"AM");

  // A current GPS callback may start reverse; manual choice cancels reverse owner.
  await page.getByRole("button",{name:/Определить моё местоположение/}).click();
  await page.getByRole("button",{name:/Определить местоположение снова/}).click();
  await wait(async()=>await page.evaluate(()=>window.__REM01A_GPS__.count())===2,"second GPS pending");
  await page.evaluate(()=>window.__REM01A_GPS__.success(1));
  await wait(()=>reverse.length===reverseBefore+1,"reverse pending");
  await page.getByRole("button",{name:"Выбрать город вручную"}).click();
  await selectPlace(s,"Москва",places.mos);
  await payload(reverse.at(-1),{result:places.kras});
  await sleep(160);
  assert.equal((await state(page)).city,"Москва","stale reverse cannot overwrite manual Moscow");
  assert.equal((await state(page)).countryCode,"RU");
  await screenshot(page,"geo-manual-race-complete");

  // Component unmount invalidates still pending, unabortable GPS; parent patch count stable.
  await page.getByRole("button",{name:/Определить моё местоположение/}).click();
  await page.getByRole("button",{name:/Определить местоположение снова/}).click();
  await wait(async()=>await page.evaluate(()=>window.__REM01A_GPS__.count())===3,"GPS for unmount");
  const countBefore=await page.evaluate(()=>window.__REM01A_FIXTURE__.patches.length);
  await page.getByRole("button",{name:"Убрать шаг геолокации"}).click();
  await page.evaluate(()=>window.__REM01A_GPS__.success(2));
  await sleep(180);
  assert.equal(await page.evaluate(()=>window.__REM01A_FIXTURE__.patches.length),countBefore,"unmounted callback must not patch parent");
  assert.deepEqual(errors,[]);
  console.log("REM01A_GEO_RACES_PASS "+JSON.stringify({cases:["B-before-A","malformed","short-query-abort","GPS-after-manual","reverse-after-manual","GPS-after-unmount"],patches:countBefore}));
 }finally{await ctx.close()}
}
async function geoDenial(browser){
 const s=await geoPage(browser),{ctx,page,errors}=s;
 try{
  await page.getByRole("button",{name:"Моё местоположение"}).click();
  await wait(async()=>await page.evaluate(()=>window.__REM01A_GPS__.count())===1,"permission pending");
  await page.evaluate(()=>window.__REM01A_GPS__.deny(0));
  await page.getByRole("alert").waitFor({state:"visible"});
  assert.match(await page.getByRole("alert").innerText(),/Доступ к геолокации/);
  assert.equal(await page.locator(".geo-input-wrap .spin").count(),0);
  assert.equal(await page.getByRole("combobox").count(),1,"denial offers manual recovery");
  assert.deepEqual(errors,[]);
  console.log("REM01A_GEO_DENIAL_RECOVERY_PASS");
 }finally{await ctx.close()}
}
async function geoTimeout(browser){
 const s=await geoPage(browser),{ctx,page,reverse,errors}=s;
 try{
  await page.getByRole("button",{name:"Моё местоположение"}).click();
  await wait(async()=>await page.evaluate(()=>window.__REM01A_GPS__.count())===1,"timeout GPS");
  await page.evaluate(()=>window.__REM01A_GPS__.success(0));
  await wait(()=>reverse.length===1,"reverse waiting for timeout");
  // Leave provider request unresolved: the actual reverse deadline must close it.
  await page.getByRole("alert").waitFor({state:"visible",timeout:9500});
  assert.match(await page.getByRole("alert").innerText(),/Автоматическое определение/);
  assert.equal(await page.locator(".geo-input-wrap .spin").count(),0);
  assert.equal(await page.getByRole("combobox").count(),1,"timeout restores manual mode");
  await payload(reverse[0],{result:places.kras});
  await sleep(100);
  assert.equal((await state(page)).city,"");
  assert.deepEqual(errors,[]);
  console.log("REM01A_GEO_REVERSE_TIMEOUT_PASS");
 }finally{await ctx.close()}
}
async function deckCase(browser,{throwing=true,reduced=false}={}){
 const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,userAgent:UA,...(reduced?{reducedMotion:"reduce"}:{})});
 if(throwing)await ctx.addInitScript(()=>{
  window.Telegram={WebApp:{HapticFeedback:{selectionChanged(){throw new Error("test-only haptic explosion")}}}};
 });
 const page=await ctx.newPage(),errors=recordPageErrors(page);
 try{
  await page.goto(BASE+"/profile-qa.html");
  const name=()=>page.locator(".discovery-deck-layer.deck-active .discovery-name-button").innerText();
  await wait(async()=>(await name()).includes("Мира"),"first deck card");
  await page.getByRole("button",{name:"Нравится"}).click();
  if(reduced){
   await wait(async()=>(await name()).includes("София"),"reduced motion immediate commit",250);
  }else{
   await page.locator(".discovery-deck-layer.deck-leaving").waitFor({state:"attached"});
   await page.locator(".discovery-deck-layer.deck-leaving").evaluate(el=>
    el.dispatchEvent(new AnimationEvent("animationend",{bubbles:true,animationName:"luemi-deck-leave"})));
   await wait(async()=>(await name()).includes("София"),"animationend commits");
   await sleep(550);
   assert.match(await name(),/София/,"timeout cannot double commit after animationend");
  }
  await page.getByRole("button",{name:"Нравится"}).click();
  if(reduced)await wait(async()=>(await name()).includes("Нара"),"reduced next action",250);
  else{
   await page.getByRole("button",{name:"Симпатии",exact:true}).click();
   await page.keyboard.press("Escape");
   await wait(async()=>(await name()).includes("Нара"),"back drains pending deck");
   await sleep(520);assert.match(await name(),/Нара/,"back and fallback never double commit");
  }
  assert.deepEqual(errors,[],"mock bridge failure never propagates to React");
  await screenshot(page,throwing?(reduced?"deck-haptic-throw-reduced":"deck-haptic-throw-back"):"deck-no-telegram-bridge");
  console.log("REM01A_DECK_HAPTIC_PASS "+JSON.stringify({throwing,reduced,final:await name()}));
 }finally{await ctx.close()}
}
async function sorterCase(browser){
 const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,userAgent:UA});
 await ctx.addInitScript(()=>{window.Telegram={WebApp:{HapticFeedback:{selectionChanged(){throw new Error("test-only haptic throw")}}}}});
 const page=await ctx.newPage(),errors=recordPageErrors(page);
 try{
  await page.goto(BASE+"/sorter-qa.html");
  const order=page.locator('[data-testid="photo-order"]');
  assert.equal(await order.innerText(),"qa-red,qa-blue");
  const a=await page.locator('[data-photo-slot="0"]').boundingBox(),b=await page.locator('[data-photo-slot="1"]').boundingBox();
  assert.ok(a&&b,"real photo slots exist");
  await page.mouse.move(a.x+a.width*.55,a.y+a.height*.42);
  await page.mouse.down();
  await sleep(330);
  await page.locator(".photo-drag-ghost").waitFor({state:"visible",timeout:1800});
  await page.mouse.move(b.x+b.width*.5,b.y+b.height*.5,{steps:7});
  await page.mouse.up();
  await wait(async()=>await order.innerText()==="qa-blue,qa-red","haptic-proof reorder");
  assert.deepEqual(errors,[],"sorter bridge failure does not prevent reorder");
  await screenshot(page,"sorter-haptic-throw-reordered");
  console.log("REM01A_SORTER_HAPTIC_PASS");
 }finally{await ctx.close()}
}
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
 await geoRaces(browser);
 await geoDenial(browser);
 await geoTimeout(browser);
 await deckCase(browser,{throwing:true});
 await deckCase(browser,{throwing:false});
 await deckCase(browser,{throwing:true,reduced:true});
 await sorterCase(browser);
 console.log("REM-01A GEOGRAPHY AND HAPTIC BROWSER QA PASS; physical A55/iOS remain NOT VERIFIED");
}finally{await browser.close()}
