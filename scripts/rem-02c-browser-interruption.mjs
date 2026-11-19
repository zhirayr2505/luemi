import assert from "node:assert/strict";
import {chromium} from "playwright";

/** Shared premium profile gesture smoke on synthetic Chromium Android; physical device not certified. */
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"});
const page=await context.newPage(),errors=[],base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
page.on("pageerror",e=>errors.push(e.message));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const swipe=async(x,y,dx,dy,steps=12,onMove)=>{
 const cdp=await context.newCDPSession(page);
 try{
  await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y,id:1}]});
  for(let n=1;n<=steps;n++){
   await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:x+dx*n/steps,y:y+dy*n/steps,id:1}]});
   await delay(12);
   if(onMove)await onMove(n);
  }
  await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 }finally{await cdp.detach();}
};
const root=page.locator(".owner-premium-profile");
const selected=()=>root.locator('.owner-profile-tabs [role="tab"][aria-selected="true"]');
try{
 await page.goto(base+"/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.locator(".discovery-bottom-nav button").filter({hasText:"Профиль"}).click();
 await root.waitFor({state:"visible",timeout:7000});
 assert.equal(await root.getAttribute("data-morph-state"),"expanded");
 const face=root.locator(".owner-profile-photo-mask"),hero=await face.boundingBox();
 assert.ok(hero&&hero.width>300&&hero.height>350,"big photo begins expanded");
 assert.ok((await root.locator(".owner-profile-photo-pager button").count())>=2,"photo dots available");
 await face.evaluate(node=>{
  window.__v4PhotoGestureTrace=[];
  for(const type of ["pointerdown","pointermove","pointerup","pointercancel","lostpointercapture"]){
   node.addEventListener(type,e=>{
    if(window.__v4PhotoGestureTrace.length<50)
     window.__v4PhotoGestureTrace.push({type,x:e.clientX,y:e.clientY,pointerType:e.pointerType,isPrimary:e.isPrimary});
   },true);
  }
 });
 await swipe(hero.x+hero.width*.72,hero.y+hero.height*.49,-hero.width*.46,0);
 await delay(265);
 console.log("PROFILE_V4_PHOTO_SWIPE_DEBUG "+JSON.stringify(await root.evaluate(node=>({
  trace:window.__v4PhotoGestureTrace,
  selected:[...node.querySelectorAll(".owner-profile-photo-pager button")].map(x=>({current:x.getAttribute("aria-current"),cls:x.className})),
  photoId:node.querySelector(".owner-profile-photo-mask img[data-slot=current]")?.getAttribute("data-photo-id"),
  morph:node.dataset.morphState
 }))));
 assert.equal(await root.locator(".owner-profile-photo-pager button").nth(1).getAttribute("aria-current"),
  "true","left photo swipe moves to the second photo");
 await swipe(hero.x+hero.width*.28,hero.y+hero.height*.49,hero.width*.46,0);
 await delay(265);
 assert.equal(await root.locator(".owner-profile-photo-pager button").first().getAttribute("aria-current"),
  "true","right photo swipe returns to the main photo");
 console.log("PREMIUM_PROFILE_GESTURE_PASS photo left and right");

 // A held finger must be able to stop at a medium circle in either direction.
 const held=await context.newCDPSession(page);
 const finger=async(type,x,y)=>held.send("Input.dispatchTouchEvent",{
  type,touchPoints:type==="touchEnd"?[]:[{x,y,id:2}]});
 const measurePhoto=()=>face.evaluate((node)=>{
  const rect=node.getBoundingClientRect();
  return {radius:parseFloat(node.style.borderRadius),width:rect.width,y:rect.y,
   ambient:Number(getComputedStyle(node.closest(".owner-premium-profile").querySelector(".owner-profile-ambient")).opacity)};
 });
 const moveUntil=async(x,y,direction,reached)=>{
  for(let distance=4;distance<=180;distance+=4){
   await finger("touchMove",x,y+direction*distance);
   await delay(20);
   if(reached(await measurePhoto()))return distance;
  }
  assert.fail("the drag never reached the expected photo geometry");
 };
 const assertHeld=async()=>{
  const before=await measurePhoto();
  assert.equal(before.radius,50,"the held photo is a true circle");
  assert.equal(await root.getAttribute("data-morph-state"),"transition");
  await delay(380);
  assert.deepEqual(await measurePhoto(),before,"the medium circle stays in place while the finger is held");
  return before;
 };
 try{
  const cards=root.getByRole("tabpanel");
  const cardRect=await cards.boundingBox();
  const hx=cardRect.x+cardRect.width*.5,hy=cardRect.y+70;
  await face.evaluate(node=>{
   const ambient=node.closest(".owner-premium-profile").querySelector(".owner-profile-ambient");
   const frames=[];
   window.__ownerRoundFrames=frames;
   const observe=new MutationObserver(()=>{
    frames.push({radius:parseFloat(node.style.borderRadius),ambient:Number(getComputedStyle(ambient).opacity)});
    if(node.classList.contains("owner-profile-avatar-circle"))observe.disconnect();
   });
   observe.observe(node,{attributes:true,attributeFilter:["style"]});
  });
  await finger("touchStart",hx,hy);
  const distanceUp=await moveUntil(hx,hy,-1,frame=>frame.radius===50&&frame.width>126);
  const medium=await assertHeld();
  assert.equal(await cards.evaluate(el=>el.scrollTop),0,"card scroll stays pinned during the morph");
  const rounding=(await page.evaluate(()=>window.__ownerRoundFrames)).find(frame=>frame.radius>0);
  assert(rounding&&rounding.ambient>0,"blur appears as soon as the mask rounds");
  await finger("touchMove",hx,hy-distanceUp+9);
  await delay(40);
  assert.equal((await measurePhoto()).radius,0,"reversing before release restores the square");
  await finger("touchMove",hx,hy-distanceUp);
  await delay(40);
  assert.deepEqual(await measurePhoto(),medium,"the same finger position restores the identical frame");
  assert((await page.evaluate(()=>window.__ownerRoundFrames)).every(f=>f.radius===0||f.radius===50));
  await finger("touchEnd",hx,hy-distanceUp);
  await root.locator(".owner-profile-avatar-circle").waitFor();
  const c=await face.boundingBox();
  assert(c&&c.width>=94&&c.width<=112&&c.width<medium.width,"release docks the medium circle");
  const cx=c.x+c.width*.5,cy=c.y+c.height*.5;
  await finger("touchStart",cx,cy);
  const distanceDown=await moveUntil(cx,cy,1,frame=>frame.radius===50&&frame.width>medium.width-6);
  const reopening=await assertHeld();
  assert(Math.abs(reopening.width-medium.width)<15,"opening reaches the medium circle with 4px touch samples");
  await finger("touchEnd",cx,cy+distanceDown);
  await page.waitForFunction(()=>document.querySelector(".owner-premium-profile")?.dataset.morphState==="expanded");

  await finger("touchStart",hx,hy);
  await moveUntil(hx,hy,-1,frame=>frame.radius===50&&frame.width>126);
  await finger("touchMove",hx,hy-230);
  await root.locator(".owner-profile-avatar-circle").waitFor();
  await page.waitForFunction(()=>document.querySelector(".owner-profile-scroll")?.scrollTop>0);
  await finger("touchEnd",hx,hy-230);

  const scrolledCards=await cards.boundingBox();
  await swipe(hx,scrolledCards.y+75,0,240);
  await page.waitForFunction(()=>document.querySelector(".owner-profile-scroll")?.scrollTop<=.5);
  assert.equal(await root.getAttribute("data-morph-state"),"compact",
   "the gesture that scrolls cards to their top cannot also expand the profile");
  await delay(80);
  await finger("touchStart",cx,cy);
  await moveUntil(cx,cy,1,frame=>frame.radius===50&&frame.width>medium.width-6);
  await finger("touchMove",cx,cy+210);
  await page.waitForFunction(()=>document.querySelector(".owner-premium-profile")?.dataset.morphState==="expanded");
  await finger("touchEnd",cx,cy+210);
 }finally{await held.detach();}
 console.log("PREMIUM_PROFILE_HELD_MORPH_PASS hold, release and continued drag in both directions");

 // A vertical gesture from the hero collapses the profile without opening
 // the viewer or needing to scroll the cards first.
 await swipe(hero.x+hero.width*.5,hero.y+hero.height*.58,0,-180);
 await page.waitForFunction(()=>document.querySelector(".owner-premium-profile")?.dataset.morphState==="compact");
 assert.equal(await page.locator(".pm-viewer").count(),0,"portrait swipe never opens fullscreen photo viewer");
 const avatar=await root.locator(".owner-profile-avatar-circle").boundingBox();
 assert.ok(avatar&&Math.abs(avatar.width-avatar.height)<1.2,"photo becomes a round avatar");
 console.log("PREMIUM_PROFILE_GESTURE_PASS vertical photo-origin morph");

 await root.getByRole("tab",{name:"О себе",exact:true}).click();
 const pages=root.locator(".owner-profile-pages"),rect=await pages.boundingBox();
 const pinned=await root.locator(".owner-profile-tabs").boundingBox();
 assert.ok(rect&&pinned&&rect.height>90,"tab pages and pinned tabs remain visible");
 // The tab body can be scrolled underneath the opaque sticky bar; start the
 // gesture on the visible page, never at a hidden document coordinate.
 const touchY=Math.max(rect.y+Math.min(90,rect.height*.35),pinned.y+pinned.height+34);
 assert.ok(touchY<Math.min(rect.y+rect.height-24,760),
  "the page offers a usable swipe area below pinned tabs and above bottom navigation");
 const touchX=rect.x+rect.width*.75;
 assert(await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest(".owner-profile-pages"),
  {x:touchX,y:touchY}),"visible page receives horizontal gestures");
 const ink=root.locator(".owner-profile-tab-ink");
 const inkBefore=await ink.boundingBox();
 const nextPanel=root.locator('[role="tabpanel"][aria-label="Фото"]');
 const nextPanelBefore=await nextPanel.boundingBox();

 let incomingY;
 await swipe(touchX,touchY,-rect.width*.48,0,12,async step=>{
  if(step!==6)return;
  const shift=rect.width*.24;
  const moving=await pages.boundingBox();
  const next=await nextPanel.boundingBox();
  assert(Math.abs(moving.x-(rect.x-shift))<2,"the current page tracks mid-gesture displacement 1:1");
  assert(Math.abs(next.x-(moving.x+rect.width))<2,"the next page follows as a neighboring panel");
  assert.equal(next.height,nextPanelBefore.height,"incoming pane keeps the same layout on the drag frame");
  assert(Math.abs(next.y-(nextPanelBefore.y))<.5,"the incoming page is aligned to the top of the viewport");
  incomingY=next.y;
  assert((await ink.boundingBox()).x>inkBefore.x+8,"the underline tracks the same swipe");
  assert.equal(await selected().innerText(),"О себе","selection commits after release");
 });
 await root.locator('[role="tab"][data-tab-id="photos"][aria-selected="true"]').waitFor();
 assert.equal(await selected().innerText(),"Фото","page swipe switches to next tab");
 assert(Math.abs((await nextPanel.boundingBox()).y-incomingY)<.5,"the arriving content doesn't jump on commit");
 const registeredX=(await pages.boundingBox()).x;
 await swipe(touchX,touchY,-25,0,7);
 await root.locator(".owner-profile-pages:not([data-paging])").waitFor();
 assert.equal(await selected().innerText(),"Фото","a short swipe returns without switching tabs");
 assert(Math.abs((await pages.boundingBox()).x-registeredX)<1,"short swipe restores the exact page position");
 // Swipe the actual underline tab bar as well as the content panel. The
 // selected button must not steal a directional swipe as a delayed click.
 const rail=await root.locator(".owner-profile-tabs").boundingBox();
 assert.ok(rail&&rail.height>40,"tab rail stays reachable");
 await swipe(rail.x+rail.width*.62,rail.y+rail.height*.5,-rail.width*.46,0);
 await root.locator('[role="tab"][data-tab-id="bliki"][aria-selected="true"]').waitFor();
 assert.equal(await selected().innerText(),"Блики","tab rail swipe switches to next tab once");
 await root.getByRole("tab",{name:"Подарки",exact:true}).click();
 await root.getByRole("tab",{name:"Блики",exact:true}).click();
 assert.equal(await selected().innerText(),"Блики","latest tab tap wins");
 assert.equal(await selected().count(),1);
 const emptyBackground=await root.getByRole("tabpanel").locator(".owner-profile-content").evaluate(element=>({
  image:getComputedStyle(element).backgroundImage,
  content:element.getBoundingClientRect().height,
  viewport:element.parentElement.clientHeight
 }));
 assert.equal(emptyBackground.image,"none","the empty panel does not end in a second background colour");
 assert(emptyBackground.content>=emptyBackground.viewport-.5,"the empty panel fills the scroller");
 console.log("PREMIUM_PROFILE_GESTURE_PASS tab pager and interruptions");

 assert.deepEqual(errors,[],"no browser exceptions");
 console.log("REM-02C PREMIUM PROFILE GESTURE PASS; physical A55 NOT VERIFIED");
}finally{await context.close();await browser.close();}
