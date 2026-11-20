import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {chromium} from "playwright";
import {setPremiumProfileState} from "./premium-profile-browser-input.mjs";

/**
 * Integration of the active owner/visitor V4 profile into Discovery.
 * The V3 motion engine has its own isolated Chromium DOM test; owner and
 * visitor no longer render .v3-int-root. Browser emulation != physical A55.
 */
const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const systemChromium=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser=await chromium.launch({headless:true,args:["--no-sandbox"],
 ...(systemChromium&&existsSync(systemChromium)?{executablePath:systemChromium}:{})});
const context=await browser.newContext({
 viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"
});
const page=await context.newPage();
const errors=[];page.on("pageerror",e=>errors.push(e.message));
async function checkPhotoViewer(profile,origin){
 await page.evaluate(()=>{
  window.Telegram={WebApp:{initData:"qa-viewer",BackButton:{}}};
 });
 const gallery=profile.locator(".owner-profile-gallery");
 const trigger=origin==="grid"?gallery.locator("button").first():profile.locator(".owner-profile-photo-mask");
 const original=trigger.locator(origin==="grid"?"img":"img[data-slot=current]");
 await original.evaluate(img=>img.decode());
 await trigger.click();
 const viewer=page.getByRole("dialog",{name:"Просмотр фото"});
 await viewer.waitFor();
 assert.equal(await viewer.getByRole("button",{name:"Закрыть просмотр"}).count(),0,"Telegram has exactly one Back control");
 await viewer.locator("xpath=self::*[@data-morph-active='true']").waitFor({timeout:1000});
 await viewer.locator("xpath=self::*[@data-morph-active='false']").waitFor({timeout:1600});
 if(origin==="grid"){
  await page.waitForFunction(()=>document.querySelector(".pm-viewer-image")?.style.opacity==="1");
  await page.touchscreen.tap(160,415);
  await viewer.locator("xpath=self::*[@data-chrome-visible='false']").waitFor();
  await page.touchscreen.tap(160,415);
  await viewer.locator("xpath=self::*[@data-chrome-visible='true']").waitFor();
  await page.mouse.dblclick(160,415);
  const zoomIs=zoom=>page.waitForFunction(zoom=>{
   const img=document.querySelector(".pm-viewer-image");
   return img&&Math.abs(new DOMMatrixReadOnly(getComputedStyle(img).transform).a-zoom)<.0001;
  },zoom,{timeout:1600});
  await zoomIs(2.4);
  await page.mouse.dblclick(160,415);
  await zoomIs(1);
 }
 const next=await viewer.locator(".pm-viewer-slide[data-slot=next] img").getAttribute("data-photo-id");
 const input=await context.newCDPSession(page);
 try{
  await viewer.locator(".pm-viewer-stage").evaluate(stage=>{
   stage.addEventListener("pointerdown",event=>{stage.dataset.qaOrigin=String(event.clientX);},{once:true});
   stage.addEventListener("pointermove",event=>{stage.dataset.qaCurrent=String(event.clientX);});
  });
  const finger=(type,x)=>input.send("Input.dispatchTouchEvent",{
   type,touchPoints:type==="touchEnd"?[]:[{id:1,x,y:430}]
  });
  const track=viewer.locator(".pm-viewer-track");
  await finger("touchStart",275);
  for(const distance of [70,36,132]){
   await finger("touchMove",275-distance);
   await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
   const sample=await track.evaluate(node=>{
    const stage=node.closest(".pm-viewer-stage");
    return {position:new DOMMatrixReadOnly(getComputedStyle(node).transform).m41+node.clientWidth,
     finger:Number(stage.dataset.qaCurrent)-Number(stage.dataset.qaOrigin)};
   });
   assert(Math.abs(sample.finger+distance)<12&&Math.abs(sample.position-sample.finger)<1,
    "the photo track follows the reversing finger: "+JSON.stringify(sample));
  }
  await finger("touchEnd");
  await page.waitForFunction(id=>document.querySelector(".pm-viewer-image")?.dataset.photoId===id,
   next,{timeout:2000});
 }finally{await input.detach();}
 const other=origin==="grid"?gallery.locator("img").nth(1):original;
 await page.evaluate(()=>window.__luemiQaBack());
 await viewer.locator("xpath=self::*[@data-morph-active='true']").waitFor({timeout:1400});
 assert.equal(await other.getAttribute("data-photo-id"),next,"the visible return target matches the current photo");
 assert.equal(await other.evaluate(img=>img.style.visibility),"hidden","the shared morph owns the matching return tile");
 await viewer.waitFor({state:"detached"});
 assert.equal(await other.evaluate(img=>img.style.visibility),"","the destination photo is restored after Back");
}
async function checkAbout(profile){
 const about=profile.getByRole("tabpanel",{name:"О себе",exact:true});
 const art=await about.evaluate(async node=>{
  const heart=node.querySelector(".owner-profile-quote img");
  const moon=node.querySelector(".owner-profile-moonrise");
  if(!heart||!moon)return null;
  await Promise.all([heart.decode(),moon.decode()]);
  const moonBox=moon.getBoundingClientRect();
  const canvas=document.createElement("canvas");
  canvas.width=384;canvas.height=92;
  const drawing=canvas.getContext("2d");
  drawing.drawImage(heart,0,0,384,92);
  const heartPixels=drawing.getImageData(0,0,384,92).data;
  let heartEdgeAlpha=0,heartMaxAlpha=0;
  for(let y=0;y<92;y++)for(let x=0;x<384;x++){
   const alpha=heartPixels[(y*384+x)*4+3];
   heartMaxAlpha=Math.max(heartMaxAlpha,alpha);
   if(x===0||x===383||y===0||y===91)heartEdgeAlpha=Math.max(heartEdgeAlpha,alpha);
  }
  drawing.clearRect(0,0,384,92);
  drawing.drawImage(moon,0,0,384,92);
  const moonBottomClear=drawing.getImageData(0,91,384,1).data.every((channel,i)=>i%4!==3||channel<=2);
  return {heartEdgeAlpha,heartMaxAlpha,moonBottomClear,moonWidth:moonBox.width,moonHeight:moonBox.height,
   moonLeft:moonBox.left-node.getBoundingClientRect().left,panelWidth:node.clientWidth};
 });
 assert(art&&art.heartMaxAlpha>40&&art.heartEdgeAlpha<=2,
  "the heart is visible and its artwork fades completely before the edges");
 assert(Math.abs(art.moonLeft)<1&&Math.abs(art.moonWidth-art.panelWidth)<1&&art.moonHeight/art.moonWidth<.23,
  "the mountain panorama is low and extends from edge to edge");
 assert(art.moonBottomClear,"the mountain artwork fades out before its lower edge");
 const design=await about.evaluate(node=>{
  const quote=node.querySelector("blockquote");
  const chips=[...node.querySelectorAll(".owner-profile-interests .interest-chip")];
  return {
   quote:quote?.textContent.trim(),
   goal:node.querySelector(".owner-profile-goal")?.textContent.trim(),
   count:Number(node.querySelector(".owner-profile-interest-count")?.textContent),
   chipColors:chips.map(chip=>[chip.style.getPropertyValue("--chip-from"),chip.style.getPropertyValue("--chip-to")].join("/")),
   cards:node.querySelectorAll("article").length,
   fits:node.scrollWidth<=node.clientWidth+1
  };
 });
 assert(design.quote,"the bio is an open quote");
 assert(design.goal,"the fixture's dating goal is displayed as an inline badge");
 assert.equal(design.count,design.chipColors.length,"the badge counts rendered interest chips");
 assert(design.count>1&&new Set(design.chipColors).size>1,"interests keep their catalog colors");
 assert.equal(design.cards,0,"the About surface contains no boxed cards");
 assert(design.fits,"the moon and About content fit the screen width");
}
async function checkGallery(profile){
 const photos=profile.getByRole("tabpanel",{name:"Фото",exact:true});
 const columns=await photos.locator(".owner-profile-gallery").evaluate(grid=>
  getComputedStyle(grid).gridTemplateColumns.split(" ").length);
 assert.equal(columns,3,"three columns are reserved even on an incomplete row");
 const tiles=await photos.locator(".owner-profile-photo-tile").evaluateAll(elements=>
  elements.map(tile=>{
   const rect=tile.getBoundingClientRect();
   return {x:rect.x,y:rect.y,width:rect.width,height:rect.height};
  }));
 assert(tiles.length>0,"the fixture has photos in its gallery");
 const first=tiles[0];
 for(const [index,tile] of tiles.entries()){
  assert(Math.abs(tile.width-first.width)<1&&Math.abs(tile.height/tile.width-1.25)<.02,
   "photos use equal 4:5 portrait tiles");
  const row=tiles[Math.floor(index/3)*3];
  assert(Math.abs(row.y-tile.y)<1,"each row fits three tiles");
  if(index>=3)assert(tile.y>tiles[index-3].y&&Math.abs(tile.x-tiles[index-3].x)<1,
   "later rows keep the same columns");
  if(index%3>0)assert(tile.x>tiles[index-1].x+tiles[index-1].width,"photos have even separation");
 }
 assert.equal(await photos.getByText("Главное",{exact:true}).count(),0,"the tiles display only the photos");
}
async function checkPager(profile){
 const viewport=profile.locator(".owner-profile-viewport");
 const pages=profile.locator(".owner-profile-pages");
 const panels=profile.locator('[role="tabpanel"]');
 const input=await context.newCDPSession(page);
 const finger=(type,x,y)=>input.send("Input.dispatchTouchEvent",{
  type,touchPoints:type==="touchEnd"?[]:[{x,y,id:1}]
 });
 try{
  for(const state of ["expanded","compact"]){
   await setPremiumProfileState(page,profile,state);
   for(const [from,to] of [[0,1],[1,2],[2,3],[3,2],[2,1],[1,0]]){
    const box=await viewport.boundingBox(),width=box.width,dir=Math.sign(to-from);
    const outgoing=panels.nth(from),incoming=panels.nth(to);
    const y=box.y+65,x=box.x+width*(dir>0?.73:.27);
    const start=await outgoing.boundingBox(),next=await incoming.boundingBox();
    assert(Math.abs(start.x-box.x)<1&&Math.abs(next.x-start.x-dir*width)<1,
     "resting neighbour is entirely beyond the screen edge");
    const scrollTop=await outgoing.evaluate(el=>el.scrollTop);
    await finger("touchStart",x,y);
    for(const fraction of [.18,.10,.52]){
     await finger("touchMove",x-dir*width*fraction,y);
     await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
     const current=await outgoing.boundingBox(),neighbour=await incoming.boundingBox();
     assert(Math.abs(current.x-start.x+dir*width*fraction)<2,`track follows input: ${state} ${from}->${to} fraction=${fraction} actual=${current.x-start.x} expected=${-dir*width*fraction}`);
     assert(Math.abs(neighbour.x-current.x-dir*width)<1&&Math.abs(neighbour.y-next.y)<1,
      "incoming page stays adjacent at the same height");
     assert.equal(await outgoing.evaluate(el=>el.scrollTop),scrollTop);
    }
    await finger("touchEnd");
    await profile.getByRole("tab").nth(to).locator("xpath=self::*[@aria-selected='true']").waitFor();
    await pages.locator("xpath=self::*[not(@data-paging)]").waitFor();
    assert(Math.abs((await incoming.boundingBox()).x-box.x)<1);
    assert(Math.abs((await incoming.boundingBox()).y-next.y)<1);
    assert.equal(await profile.getAttribute("data-morph-state"),state);
   }
  }
 }finally{await input.detach();}
}
try{
 await page.goto(base+"/profile-qa.html?profileV3=1",{waitUntil:"domcontentloaded"});
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 const owner=page.locator(".v3-profile-host.pm-inline .owner-premium-profile");
 await owner.waitFor({state:"visible",timeout:7000});
 const scroll=owner.getByRole("tabpanel");
 const photo=owner.locator(".owner-profile-photo-mask");
 const initial=await photo.boundingBox();
 assert(initial&&initial.width>380&&Math.abs(initial.width-initial.height)<1.5&&initial.y<1.5,
  "owner opens with the approved full-width square");
 assert.equal(await owner.locator(".owner-profile-brand img").count(),1,"one original LUEMI wordmark");
 assert.deepEqual(await owner.locator(".owner-profile-tabs [role=tab]").allTextContents(),
  ["О себе","Фото","Блики","Подарки"],"one approved four-tab strip");
 assert.equal(await owner.getByRole("tabpanel").locator(".owner-profile-actions button").count(),4,"owner tools remain available");

 await checkAbout(owner);
 await checkPager(owner);
 await setPremiumProfileState(page,owner,"compact");
 const compact=await owner.locator(".owner-profile-avatar-circle").boundingBox();
 assert(compact&&compact.width>=94&&compact.width<=112&&Math.abs(compact.width-compact.height)<1.5,
  "square hands off directly to Telegram-sized perfectly circular avatar");
 assert(Math.abs(compact.x+compact.width/2-196.5)<2,"compact avatar remains centered");

 const tabs=["О себе","Фото","Блики","Подарки"];
 for(const label of tabs){
  const tab=owner.getByRole("tab",{name:label,exact:true});await tab.click();
  assert.equal(await tab.getAttribute("aria-selected"),"true");
  const tabMotion=await scroll.evaluate(el=>({
   position:el.scrollTop,max:el.scrollHeight-el.clientHeight,scrollHeight:el.scrollHeight,
   clientHeight:el.clientHeight,state:el.closest(".owner-premium-profile")?.dataset.morphState
  }));
  console.log("PROFILE_V4_TAB_DEBUG "+JSON.stringify({label,tabMotion}));
  assert.equal(await owner.getAttribute("data-morph-state"),"compact",
   "tab changes may not expand the compact photo");
 }
 await owner.getByRole("tab",{name:"Фото",exact:true}).click();
 const gallery=owner.locator(".owner-profile-photo-tile");
 assert.equal(await gallery.count(),3,"three QA images in real owner gallery");
 await checkGallery(owner);
 await gallery.first().click();
 await page.locator(".pm-viewer").waitFor({state:"visible",timeout:4000});
 await page.keyboard.press("Escape");
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:4000});
 await checkPhotoViewer(owner,"grid");

 for(const count of [0,1,6,3]){
  await page.evaluate(count=>window.__luemiQaV3.setPhotoCount(count),count);
  await page.waitForFunction(count=>
   document.querySelectorAll(".v3-profile-host.pm-inline .owner-profile-photo-tile").length===count,
   count,{timeout:4000});
  assert.equal(await owner.locator(".owner-profile-photo-pager button").count(),count>1?count:0,
   "photo pager corresponds to permitted photos");
  if(count===6)await checkGallery(owner);
 }
 await setPremiumProfileState(page,owner,"expanded");
 await checkPhotoViewer(owner,"carousel");

 await page.getByRole("button",{name:"Знакомства",exact:true}).click();
 await page.getByRole("tab",{name:"Для тебя",exact:true}).click();
 await page.getByRole("button",{name:/Открыть демо-профиль/}).first().click();
 const visitor=page.locator(".discovery-visitor-route .owner-premium-profile");
 await visitor.waitFor({state:"visible",timeout:5000});
 await page.waitForFunction(()=>{
  const route=document.querySelector(".discovery-visitor-route");
  return route&&Math.abs(route.getBoundingClientRect().left)<.05;
 });
 await checkAbout(visitor);
 await checkPager(visitor);
 await visitor.getByRole("tab",{name:"Фото",exact:true}).click();
 await checkGallery(visitor);
 assert.equal(await visitor.getAttribute("data-mode"),"visitor");
 assert.equal(await visitor.locator(".owner-profile-actions button").count(),0,
  "no owner actions on a visitor profile");
 assert.equal(await visitor.locator(".owner-profile-edit-top").count(),0,
  "no owner-only edit button in the visitor hero");
 assert.deepEqual(await visitor.locator(".owner-profile-tabs [role=tab]").allTextContents(),tabs);
 await page.evaluate(()=>window.__luemiQaBack());
 await visitor.waitFor({state:"detached",timeout:4000});
 assert.deepEqual(errors,[],"no unexpected browser errors across owner/visitor transitions");
 console.log("PROFILE_V4_INTEGRATION_CHROMIUM_PASS owner/visitor, square morph, four tabs, dynamic photos, PhotoViewer, permissions; physical Telegram not tested");
}finally{
 await context.close();await browser.close();
}
