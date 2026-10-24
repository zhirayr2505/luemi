/** Synthetic mobile sheet-scroll handoff and theme QA. Hardware validation remains required. */
import assert from "node:assert/strict";
import {chromium} from "playwright";

const browser=await chromium.launch({headless:true});
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const devices=[
 {name:"A55",ua:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"},
 {name:"iPhone",ua:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"}
];
const dims=[[360,780],[393,852],[412,915]];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const samples=[];
async function profile(page,source){
 if(source==="owner"){
  await page.getByRole("button",{name:"Профиль",exact:true}).click();
  await page.locator(".pm-inline").waitFor({state:"visible"});
  return ".pm-inline";
 }
 await page.locator(".discovery-deck-layer.deck-active .discovery-name-button").first().click();
 await page.locator(".discovery-visitor-route .pm-shell").waitFor({state:"visible"});
 await sleep(360);
 return ".discovery-visitor-route .pm-shell";
}
try{
 for(const device of devices)for(const [width,height] of dims)for(const source of ["owner","visitor"]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,userAgent:device.ua});
  const page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
  await page.locator(".discovery-app").waitFor();
  const sel=await profile(page,source);
  const root=page.locator(sel);
  const init=await root.evaluate(node=>{
   const p=node.querySelector(".pm-page[aria-hidden=false]")??node.querySelector(".pm-page");
   const b=p?.getBoundingClientRect();
   if(!(p instanceof HTMLElement)||!b)return null;
   return {state:node.dataset.sheetState,action:getComputedStyle(p).touchAction,
     x:b.x+Math.min(42,b.width*.14),y:b.y+b.height*.46,within:b.bottom>0&&b.y<innerHeight,
     height:b.height,rootHeight:node.clientHeight};
  });
  assert.ok(init?.within&&init?.height>30,device.name+"/"+source+" missing visible profile content");
  assert.equal(init.state,"expanded","opens expanded");
  assert.equal(init.action,"none","expanded page must yield native touch to collapse");
  const before=await root.evaluate(node=>{
   const viewport=node.querySelector(".pm-sheet-viewport");
   const sheet=node.querySelector(".pm-profile-sheet");
   return {pos:viewport.scrollTop,sheetY:sheet.getBoundingClientRect().y};
  });
  const track=[];
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{id:1,x:init.x,y:init.y}]});
  for(let i=1;i<=15;i++){
   await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{id:1,x:init.x,y:init.y-190*i/15}]});
   await sleep(19);
   track.push(await root.evaluate(node=>{
    const s=node.querySelector(".pm-profile-sheet");return s.getBoundingClientRect().y;
   }));
  }
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  await sleep(445);
  const collapsed=await root.evaluate(node=>{
   const page=node.querySelector(".pm-page[aria-hidden=false]")??node.querySelector(".pm-page");
   const sheet=node.querySelector(".pm-profile-sheet");
   return {state:node.dataset.sheetState,action:getComputedStyle(page).touchAction,
    top:sheet.getBoundingClientRect().y};
  });
  assert.equal(collapsed.state,"collapsed",device.name+"/"+source+": swipe on page failed to minimize");
  assert.equal(collapsed.action,"pan-y",device.name+"/"+source+": native vertical scroll not restored");
  assert.ok(collapsed.top<before.sheetY-60,device.name+"/"+source+": sheet did not move up");
  // Geometry continuity: no finger-driven downward jump during an upward drag.
  for(let i=1;i<track.length;i++)
   assert.ok(track[i]<=track[i-1]+8,device.name+"/"+source+": upward drag jumped down "+(track[i]-track[i-1]));
  // Switch tabs after collapse, then restore via mini-avatar. No duplicate shell.
  await root.locator(".pm-tab").filter({hasText:"Фото"}).click();
  await sleep(320);
  assert.equal(await root.locator(".pm-tab[aria-selected=true]").count(),1);
  const mini=root.locator(".pm-mini-avatar").first();
  if(await mini.count()){
   await mini.click();
   await sleep(410);
   assert.equal(await root.getAttribute("data-sheet-state"),"expanded",device.name+"/"+source+": expand jumped or stalled");
  }
  assert.deepEqual(errors,[],"page errors");
  samples.push({device:device.name,viewport:width+"x"+height,source,swipeSamples:track.length,collapsed:collapsed.state});
  await context.close();
 }
 console.log("LUEMI_SHEET_TOUCH_HANDOFF_PASS "+JSON.stringify({cases:samples.length,samples}));
}catch(e){
 console.error("LUEMI_SHEET_TOUCH_HANDOFF_FAIL "+(e?.stack??String(e)));
 process.exitCode=1;
}finally{await browser.close();}
