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
 await page.locator(".pm-shell").waitFor({state:"visible"});
 await page.waitForTimeout(180);
};
const read=()=>page.evaluate(()=>{
 const root=document.querySelector(".pm-shell");
 const get=(selector)=>Array.from(root.querySelectorAll(selector)).map(e=>e.textContent.trim());
 const photos=Array.from(root.querySelectorAll(".pm-photo-slide img")).map(e=>e.getAttribute("src"));
 const gallery=Array.from(root.querySelectorAll(".pm-photo-tile img")).map(e=>e.getAttribute("src"));
 const tabs=Array.from(root.querySelectorAll('[role="tab"]')).map(e=>e.getAttribute("aria-label")||e.textContent.trim());
 const html=e=>root.querySelector(e)?.textContent.trim()||"";
 return {photos,gallery,tabs,identity:html(".pm-identity h2"),location:html(".pm-identity-location"),
  goal:html(".pm-goal-chip"),about:html(".pm-card-stack"),noPhoto:html(".pm-hero-no-photo"),
  disclaimer:get(".pm-demo-disclaimer"),verified:!!root.querySelector('[aria-label="Подтверждён"]'),
  ownerActions:root.querySelectorAll(".pm-owner-actions button").length,
  globalHeaders:document.querySelectorAll(".lh-header").length,
  profileShells:document.querySelectorAll(".pm-shell").length,
  sheetRenderer:root.getAttribute("data-sheet-renderer")};
});
const pass=s=>console.log("REM01E_BROWSER_PASS "+s);
try{
 for(const theme of ["light","dark"])for(const kind of ["none","one","six","mixed","empty","undecided"]){
  await goto("step8",kind,theme);const step=await read();
  assert.equal(step.profileShells,1,"step 8 must not create second independent profile");
  assert.equal(step.globalHeaders,0,"registration preview must not mount GlobalHeader");
  assert.equal(step.sheetRenderer,"scroll");
  assert.equal(step.ownerActions,0,"local preview cannot edit/publish inside ProfileMaster");
  assert.equal(step.verified,false);
  assert.ok(step.disclaimer.some(s=>s.includes("не опубликована")),"local draft label must remain");
  assert.deepEqual(step.photos,step.gallery,"hero and photo-tab source order identical");
  assert.deepEqual(step.tabs,["О себе","Блики","Фото","Подарки","О профиле"]);
  assert.equal(await page.locator(".disabled-submit").isDisabled(),true);
  assert.ok((await page.locator(".preview-root").innerText()).includes("локальный"));
  const expected=kind==="none"?0:kind==="one"?1:kind==="mixed"?4:6;
  assert.equal(step.photos.length,expected,theme+"/"+kind);
  if(kind==="none")assert.ok(step.noPhoto.includes("нет фото"));
  if(kind==="undecided")assert.equal(step.goal,"");
  await goto("owner",kind,theme);const owner=await read();
  for(const field of ["photos","gallery","tabs","identity","location","goal","about","noPhoto"]){
   assert.deepEqual(step[field],owner[field],theme+"/"+kind+": step8 actual ProfileMaster "+field+" matches owner");
  }
  assert.equal(owner.ownerActions,3);
  await goto("local",kind,theme);const local=await read();
  assert.deepEqual(step.photos,local.photos,"explicit local-self projection and step 8 identical");
  assert.deepEqual(step.gallery,local.gallery);
  await goto("public",kind,theme);const pub=await read();
  assert.deepEqual(pub.photos,[],"public projection must never expose local draft photos");
  assert.equal(pub.ownerActions,0);
  pass(theme+"/"+kind+" one renderer, 5 tabs, real fields, image order, published-only privacy");
 }
 await goto("server");const server=await read();
 assert.equal(server.photos.length,2,"server owner sees only published when other statuses rejected/hidden");
 assert.equal(server.verified,true);
 await goto("visitor");const visitor=await read();
 assert.deepEqual(visitor.photos,server.photos,"server public visitor sees published sequence");
 assert.equal(visitor.ownerActions,0);
 pass("server published/hidden/pending/rejected fixture remains restricted");

 await goto("step8","mixed");
 assert.equal((await page.locator(".preview-root").innerText()).includes("обрабатываются"),true);
 assert.equal((await page.locator(".preview-root").innerText()).includes("ошибки"),true);
 await page.getByRole("button",{name:"Изменить анкету"}).click();
 assert.equal(await page.locator("#events").innerText(),"edit-7");
 await page.getByRole("button",{name:/Открыть демо-Ленту/}).click();
 assert.equal(await page.locator("#events").innerText(),"demo");
 pass("step-8 edit/back-to-registration and demo CTA retained without publication");

 await goto("step8","one");
 const topPhoto=page.locator(".registration-profile-simulator .pm-photo-slide").first();
 await topPhoto.click({position:{x:30,y:40}});
 await page.locator('.pm-viewer[aria-label="Просмотр фото"]').waitFor({state:"visible"});
 assert.equal(await page.locator(".pm-viewer-image").getAttribute("src"),(await read()).photos[0]);
 await page.getByRole("button",{name:"Действия с фото"}).click();
 assert.equal(await page.getByRole("menuitem",{name:/Сделать главным/}).count(),0);
 assert.equal(await page.getByRole("menuitem",{name:/Пожаловаться/}).count(),0);
 await page.getByRole("menuitem",{name:/Поделиться/}).click();
 assert.ok((await page.locator(".pm-viewer-message").innerText()).includes("недоступны"));
 await page.getByRole("button",{name:"Закрыть просмотр"}).click();
 await page.locator(".pm-viewer").waitFor({state:"hidden"});
 pass("real fullscreen viewer cannot report/make-main/publish/share successfully in local preview");

 await goto("step8","six");
 await page.locator(".registration-profile-simulator .pm-tab").filter({hasText:"Фото"}).click();
 await page.waitForTimeout(220);
 assert.equal(await page.locator(".registration-profile-simulator .pm-tab[aria-selected=true]").innerText(),"Фото");
 assert.equal(await page.locator(".registration-profile-simulator .pm-photo-tile").count(),6);
 pass("shared ProfileMaster tabs render six ordered photos, no fake blank slots");
 if(errors.length)throw new Error("Unexpected browser errors: "+errors.join(" | "));
 console.log("REM-01E BROWSER PARITY QA PASS · synthetic Chromium only, physical A55/iOS NOT VERIFIED");
}finally{await context.close();await browser.close();}
