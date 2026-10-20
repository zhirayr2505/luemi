import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
 const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:5173/profile-qa.html",{waitUntil:"networkidle",timeout:30000});
 await page.getByRole("button",{name:"Профиль",exact:true}).click();
 await page.locator(".pm-hero img").first().waitFor();
 const initial=await page.evaluate(()=>{
  const hero=document.querySelector(".pm-hero"),sheet=document.querySelector(".pm-profile-sheet"),logo=document.querySelector(".lh-island"),buttons=document.querySelectorAll(".pm-owner-actions button");
  if(!hero||!sheet||!logo)return null;
  const rect=hero.getBoundingClientRect(),sr=sheet.getBoundingClientRect(),lr=logo.getBoundingClientRect();
  return {heroTop:rect.top,heroBottom:rect.bottom,sheetTop:sr.top,logoTop:lr.top,
   bg:getComputedStyle(logo).backgroundColor,buttons:buttons.length,photoOpacity:getComputedStyle(document.querySelector(".pm-photo-track")).opacity};
 });
 assert.ok(initial,"real React profile rendered");
 assert.ok(initial.heroTop<=2,"photo begins at screen top, behind logo");
 assert.ok(initial.logoTop<70,"wordmark is high on screen");
 assert.equal(initial.bg,"rgba(0, 0, 0, 0)","logo must have no island/capsule");
 assert.ok(initial.sheetTop>initial.heroTop+200&&initial.sheetTop<initial.heroBottom,"rounded sheet overlaps lower part of hero");
 assert.equal(initial.buttons,3,"owner actions stay functional and present");
 assert.equal(initial.photoOpacity,"1","photo must not blank at rest");
 const top=await page.screenshot({type:"jpeg",quality:61,path:"stage03g3-initial.jpg"});
 console.log("QA_INITIAL "+JSON.stringify(initial));
 console.log("VISUAL_QA_TOP_JPEG="+top.toString("base64"));
 await page.evaluate(()=>{document.querySelector(".pm-scroll").scrollTop=250});
 await page.waitForTimeout(220);
 const state=await page.evaluate(()=>{
  const photo=document.querySelector(".pm-photo-track"),droplet=document.querySelector(".lh-droplet");
  return {scrollTop:document.querySelector(".pm-scroll").scrollTop,photoOpacity:getComputedStyle(photo).opacity,
   dropletWidth:droplet.getBoundingClientRect().width,logoBox:getComputedStyle(document.querySelector(".lh-island")).backgroundColor};
 });
 assert.equal(state.photoOpacity,"1","scroll cannot expose empty gradient behind original photo");
 assert.ok(state.dropletWidth<=65,"small morph never creates a giant or avatar-sized square");
 const dropletStyle=await page.locator(".lh-droplet").evaluate(el=>({
  border:getComputedStyle(el).borderWidth,radius:getComputedStyle(el).borderRadius,
  opacity:getComputedStyle(el).opacity
 }));
 assert.equal(dropletStyle.border,"0px","droplet has no circular avatar ring");
 assert.ok(dropletStyle.radius.includes("7%"),"droplet silhouette is tapered");
 console.log("QA_LIQUID "+JSON.stringify(dropletStyle));
 const scroll=await page.screenshot({type:"jpeg",quality:61,path:"stage03g3-scrolled.jpg"});
 console.log("QA_SCROLLED "+JSON.stringify(state));
 console.log("VISUAL_QA_SCROLL_JPEG="+scroll.toString("base64"));
 await page.getByRole("button",{name:"Мои фото"}).click();
 await page.waitForTimeout(850);
 const photosState=await page.evaluate(()=>{
  const pane=document.querySelector(".pm-scroll"),tab=document.querySelector(".pm-tab.active");
  const bar=document.querySelector(".pm-tabs"),scrollRect=pane.getBoundingClientRect();
  return {activeTab:tab?.textContent?.trim(),scrollTop:pane.scrollTop,
   tabTop:bar.getBoundingClientRect().top-scrollRect.top,
   galleryVisible:!!document.querySelector(".pm-photos-grid")};
 });
 assert.equal(photosState.activeTab,"Фото","My Photos selects the real Photos tab");
 assert.ok(photosState.galleryVisible,"gallery is rendered");
 assert.ok(photosState.scrollTop>290,"My Photos scrolls into the gallery rather than only switching an offscreen tab");
 assert.ok(photosState.tabTop>=-4&&photosState.tabTop<120,"selected tabs near top of visible profile");
 const gallery=await page.screenshot({type:"jpeg",quality:61,path:"stage03g3-gallery.jpg"});
 console.log("QA_GALLERY "+JSON.stringify(photosState));
 console.log("VISUAL_QA_GALLERY_JPEG="+gallery.toString("base64"));
 await page.getByRole("button",{name:"Тёмная тема"}).click();
 assert.equal(await page.locator(".luemi-shell").getAttribute("data-theme"),"dark","profile theme switch updates app theme");
 await page.screenshot({path:"stage03g3-dark.jpg"});
 await page.setViewportSize({width:360,height:780});
 await page.evaluate(()=>{document.querySelector(".pm-scroll").scrollTop=0});
 await page.waitForTimeout(120);
 const narrow=await page.evaluate(()=>{
  const actions=[...document.querySelectorAll(".pm-owner-actions button")].map(el=>el.getBoundingClientRect());
  const sheet=document.querySelector(".pm-profile-sheet").getBoundingClientRect();
  return {width:window.innerWidth,overflow:actions.some(x=>x.left<0||x.right>window.innerWidth),
   bottom:actions[0]?.bottom,sheetTop:sheet.top};
 });
 assert.equal(narrow.overflow,false,"all three actions fit 360px mobile width");
 await page.screenshot({path:"stage03g3-360.jpg"});
 console.log("QA_360 "+JSON.stringify(narrow));
 assert.deepEqual(errors,[],"no runtime React exceptions");
 console.log("PASS: real React profile screenshot QA 393x852");
}finally{await browser.close()}
