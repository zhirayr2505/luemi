import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,
 hasTouch:true,userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"});
const page=await context.newPage(),errors=[];
page.on("pageerror",e=>errors.push(e.message));
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const goto=async(mode,kind="six",theme="light")=>{
 await page.goto(base+"/rem-01e-qa.html?mode="+mode+"&kind="+kind+"&theme="+theme,{waitUntil:"domcontentloaded"});
 await page.locator(mode==="step8"?".registration-static-profile":".pm-shell").waitFor({state:"visible"});
 await page.waitForTimeout(180);
};
const read=()=>page.evaluate(()=>{
 const root=document.querySelector(".pm-shell");
 const get=(selector)=>Array.from(root.querySelectorAll(selector)).map(e=>e.textContent.trim());
 const photos=Array.from(root.querySelectorAll(".pm-photo-slide img")).map(e=>e.getAttribute("src"));
 const gallery=Array.from(root.querySelectorAll(".pm-photo-tile img")).map(e=>e.getAttribute("src"));
 const tabs=Array.from(root.querySelectorAll('[role="tab"]')).map(e=>e.getAttribute("aria-label")||e.textContent.trim());
 const html=e=>root.querySelector(e)?.textContent.trim()||"";
 return {photos,gallery,tabs,identity:html(".pm-a2-compact-identity h2"),location:html(".pm-a2-compact-identity p"),
  goal:html(".pm-a2-compact-identity .pm-a2-goal"),about:html(".pm-card-stack"),noPhoto:html(".pm-a2-no-photo"),
  disclaimer:get(".pm-demo-disclaimer"),verified:!!root.querySelector('[aria-label="Подтверждено"]'),
  ownerActions:root.querySelectorAll(".pm-owner-actions button").length,
  globalHeaders:document.querySelectorAll(".lh-header").length,
  profileShells:document.querySelectorAll(".pm-shell").length,
  sheetRenderer:root.getAttribute("data-morph-state")};
});
const pass=s=>console.log("REM01E_BROWSER_PASS "+s);
try{
 for(const theme of ["light","dark"])for(const kind of ["none","one","six","mixed","empty","undecided"]){
  await goto("step8",kind,theme);
  const preview=page.locator(".registration-static-profile");
  const expected=kind==="none"?0:kind==="one"?1:kind==="mixed"?4:6;
  assert.equal(await page.locator(".pm-shell").count(),0,"step 8 is static");
  assert.equal(await page.locator(".lh-header").count(),0);
  assert.ok((await preview.innerText()).includes("предпросмотр"));
  assert.equal(await preview.locator("img").count(),expected+(expected>0?1:0),theme+"/"+kind);
  assert.equal(await preview.locator(".registration-static-gallery img").count(),expected);
  if(kind==="none")assert.ok((await preview.innerText()).includes("Добавь фото"));
  if(kind==="undecided")assert.ok((await preview.innerText()).includes("Пока не определился"));
  assert.ok((await preview.innerText()).includes("Лея"));
  assert.ok((await preview.innerText()).includes("Ереван, Армения"));
  assert.ok((await preview.innerText()).includes("Цель знакомства"));
  assert.ok((await preview.innerText()).includes("О себе"));
  assert.ok((await preview.innerText()).includes("Интересы"));
  await goto("owner",kind,theme);const owner=await read();
  assert.equal(owner.photos.length,expected);
  assert.equal(owner.ownerActions,3);
  await goto("local",kind,theme);const local=await read();
  assert.deepEqual(owner.photos,local.photos);
  await goto("public",kind,theme);const pub=await read();
  assert.deepEqual(pub.photos,[],"public projection must never expose local draft photos");
  assert.equal(pub.ownerActions,0);
  pass(theme+"/"+kind+" static draft, image order, published-only privacy");
 }
 await goto("server");const server=await read();
 assert.equal(server.photos.length,3,"server owner sees published and pending, never hidden/rejected");
 assert.equal(server.verified,true);
 await goto("visitor");const visitor=await read();
 assert.deepEqual(visitor.photos,[server.photos[0],server.photos[2]],"server visitor sees only published, not pending");
 assert.equal(visitor.ownerActions,0);
 pass("server published/hidden/pending/rejected fixture remains restricted");

 await goto("step8","mixed");
 assert.equal(await page.locator(".registration-static-gallery img").count(),4);
 assert.equal(await page.locator(".registration-static-profile button").count(),0);
 await page.getByRole("button",{name:"Редактировать"}).click();
 assert.equal(await page.locator("#events").innerText(),"edit-7");
 await page.getByRole("button",{name:"Всё верно"}).click();
 assert.equal(await page.locator("#events").innerText(),"demo");
 pass("step-8 static preview, edit and demo CTA retained without publication");
 if(errors.length)throw new Error("Unexpected browser errors: "+errors.join(" | "));
 console.log("REM-01E BROWSER PARITY QA PASS · synthetic Chromium only, physical A55/iOS NOT VERIFIED");
}finally{await context.close();await browser.close();}
