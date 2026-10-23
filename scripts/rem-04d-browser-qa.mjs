/** LUEMI REM-04D: real Chromium scroll/header and focus-stack scenarios.
 * A headless Android-sized browser is NOT a physical Telegram WebView/VoiceOver test.
 */
import assert from "node:assert/strict";
import {mkdirSync,writeFileSync} from "node:fs";
import {chromium} from "playwright";
const dir="qa-artifacts/rem-04d";mkdirSync(dir,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Mobile Safari/537.36"});
const page=await context.newPage(),errors=[];
page.on("pageerror",error=>errors.push(error.message));
const snapshot=()=>page.evaluate(()=>{
 const lib=document.querySelector(".fy-scroll"),grid=document.querySelector(".fy-expanded .fy-grid"),header=document.querySelector(".lh-header");
 return {library:lib?.scrollTop??null,expanded:grid?.scrollTop??null,
  headerProgress:Number(header?.style.getPropertyValue("--lh-p")||0),
  toolsMerged:header?.getAttribute("data-tools-merged"),
  collection:document.querySelector(".fy-expanded h2")?.textContent??null,
  focused:document.activeElement?.getAttribute("aria-label")??document.activeElement?.tagName,
  bodyOverflow:document.body.style.overflow,
  viewer:document.querySelectorAll(".pm-viewer").length,
  menu:document.querySelectorAll(".pm-viewer-menu").length,
  inertApp:document.querySelector(".discovery-main-panels")?.inert??null,
  invisiblePages:[...document.querySelectorAll(".pm-page[aria-hidden=true]")].length};
});
const waitPaint=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const openForYou=async()=>{
 await page.getByRole("tab",{name:"Для тебя"}).click();
 await sleep(350);
};
const openCollection=async(index=0)=>{
 await page.locator(".fy-scroll .fy-section-header > button").nth(index).evaluate(el=>el.click());
 await page.locator(".fy-expanded").waitFor();
 await waitPaint();
};
const closeCollection=async()=>{
 await page.getByRole("button",{name:"Назад к подборкам"}).click();
 await page.locator(".fy-expanded").waitFor({state:"detached"});
 await waitPaint();
};
try{
 await page.goto("http://127.0.0.1:5173/profile-qa.html",{waitUntil:"domcontentloaded"});
 await page.waitForSelector(".discovery-app");
 await openForYou();
 await page.locator(".fy-scroll").evaluate(el=>el.scrollTop=360);
 await sleep(90);
 const library=await snapshot();
 assert.ok(library.library>=350,"library must really scroll");
 assert.ok(library.headerProgress>.95,"library header reflects scroll");
 await openCollection();
 const fresh=await snapshot();
 assert.ok(fresh.expanded===0,"first collection starts at zero");
 assert.ok(fresh.headerProgress<.08,"opening collection must atomically restore its own header");
 await page.locator(".fy-expanded .fy-grid").evaluate(el=>el.scrollTop=270);
 await sleep(80);
 const gridScrolled=await snapshot();
 assert.ok(gridScrolled.expanded>=200,"expanded collection is independently scrollable");
 assert.ok(gridScrolled.headerProgress>.95,"expanded header owns its scroll");
 await closeCollection();
 const restored=await snapshot();
 assert.ok(Math.abs(restored.library-library.library)<=1,"closing must restore library scroll");
 assert.ok(restored.headerProgress>.95,"header must immediately restore library context without scroll touch");
 await openCollection();
 const reopened=await snapshot();
 assert.ok(Math.abs(reopened.expanded-gridScrolled.expanded)<=1,"collection offset retained by stable identity");
 assert.ok(reopened.headerProgress>.95,"reopened collection header immediately restored");
 await closeCollection();
 await openCollection(1);
 const second=await snapshot();
 assert.equal(second.expanded,0,"distinct collection does not inherit previous scroll offset");
 assert.ok(second.headerProgress<.08,"second collection header uses its own offset");
 await closeCollection();
 // Persist user-ordered collections: default special 'common' may not ignore a move.
 await page.locator(".fy-toolbar button").click();
 const settings=page.locator(".fy-manage");
 await settings.waitFor();
 assert.ok((await snapshot()).bodyOverflow==="hidden","settings owns body lock");
 const row=settings.locator(".fy-manage-row").filter({hasText:"Много общего"});
 await row.getByRole("button",{name:/Опустить/}).click();
 await settings.getByRole("button",{name:"Готово"}).click();
 await settings.waitFor({state:"detached"});
 const order=()=>page.locator(".fy-scroll .fy-section-header h3").allTextContents();
 const beforeReload=await order();
 assert.ok(beforeReload.indexOf("Много общего")>1,"configured order is reflected, not silently pinned first");
 await page.reload({waitUntil:"domcontentloaded"});
 await openForYou();
 const afterReload=await order();
 assert.deepEqual(afterReload,beforeReload,"persisted collection order survives reload");
 // Open profile from collection; keyboard focus cannot reach underlying browse.
 await openCollection(0);
 await page.locator(".fy-expanded .fy-grid").evaluate(el=>el.scrollTop=240);
 await page.locator(".fy-expanded .fy-tile-photo").first().click();
 await page.locator(".discovery-visitor-route").waitFor();
 await sleep(320);
 const profile=await snapshot();
 assert.ok(profile.inertApp,"visitor profile isolates underlying browse");
 const focusInProfile=await page.evaluate(()=>!!document.activeElement?.closest(".discovery-visitor-route"));
 assert.ok(focusInProfile,"focus initially belongs to visitor route");
 const hero=page.locator(".discovery-visitor-route .pm-photo-slide[tabindex='0']");
 await hero.focus();
 await hero.press("Enter");
 await page.locator(".pm-viewer").waitFor();
 await sleep(300);
 const viewer=await snapshot();
 assert.equal(viewer.viewer,1,"Enter opens precisely one viewer");
 assert.ok(await page.evaluate(()=>document.activeElement?.closest(".pm-viewer")!==null),"viewer owns focus");
 assert.equal(await page.locator(".pm-viewer").evaluate(el=>el.inert),false,"body portal itself never inert");
 await page.getByRole("button",{name:"Действия с фото"}).click();
 await page.locator(".pm-viewer-menu").waitFor();
 const menuStart=await snapshot();
 assert.equal(menuStart.menu,1);
 await page.keyboard.press("Shift+Tab");
 assert.ok(await page.evaluate(()=>document.activeElement?.closest(".pm-viewer-menu")!==null),"Shift+Tab stays in top menu");
 await page.keyboard.press("Tab");
 assert.ok(await page.evaluate(()=>document.activeElement?.closest(".pm-viewer-menu")!==null),"Tab stays in top menu");
 await page.keyboard.press("Escape");
 await page.locator(".pm-viewer-menu").waitFor({state:"detached"});
 assert.equal((await snapshot()).viewer,1,"first Escape closes only menu");
 await page.keyboard.press("Escape");
 await page.locator(".pm-viewer").waitFor({state:"detached",timeout:4000});
 assert.ok(await page.evaluate(()=>document.activeElement?.closest(".discovery-visitor-route")!==null),"viewer restores connected profile focus");
 await page.keyboard.press("Escape");
 await page.locator(".discovery-visitor-route").waitFor({state:"detached",timeout:4000});
 assert.equal((await snapshot()).bodyOverflow,"","last modal restores body lock");
 const collectionReturn=await snapshot();
 assert.ok(Math.abs(collectionReturn.expanded-240)<=1,"profile Back preserves expanded collection offset");
 assert.ok(collectionReturn.headerProgress>.95,"profile Back restores expanded header context");
 await closeCollection();
 // Modal focus trap, body scroll lock and trigger restore from header filters.
 await page.locator(".fy-scroll").evaluate(el=>el.scrollTop=0);
 await sleep(70);
 const trigger=page.getByRole("button",{name:"Фильтры",exact:true});
 await trigger.click();
 await page.getByRole("dialog",{name:"Фильтры знакомств"}).waitFor();
 assert.ok(await page.evaluate(()=>document.querySelector(".discovery-main-panels")?.inert),"filter isolates browse");
 await page.keyboard.press("Shift+Tab");
 assert.ok(await page.evaluate(()=>document.activeElement?.closest(".discovery-filter-sheet")!==null),"filter Shift+Tab retained");
 await page.keyboard.press("Escape");
 await page.getByRole("dialog",{name:"Фильтры знакомств"}).waitFor({state:"detached"});
 assert.equal(await trigger.evaluate(el=>document.activeElement===el),true,"focus returns to live filter trigger");
 // Owner profile keeps all pages mounted, but only selected page interactive.
 await page.locator(".discovery-bottom-nav button").filter({hasText:"Профиль"}).click();
 await page.locator(".pm-inline .pm-tabs").waitFor();
 assert.equal(await page.locator(".pm-inline .pm-page").count(),5);
 assert.equal(await page.locator(".pm-inline .pm-page[inert]").count(),4);
 const about=page.locator(".pm-inline .pm-tab").first();
 await about.focus();await about.press("ArrowRight");
 await sleep(350);
 assert.equal(await page.locator(".pm-inline .pm-tab[aria-selected=true]").count(),1);
 assert.ok(await page.locator(".pm-inline .pm-tab[aria-selected=true]").innerText()==="Блики");
 assert.equal(await page.locator(".pm-inline .pm-page[inert]").count(),4);
 const tabs=await page.locator(".pm-inline .pm-pages").evaluate(el=>({
  scroll:el.scrollLeft,width:el.clientWidth
 }));
 assert.ok(Math.abs(tabs.scroll-tabs.width)<=2,"keyboard tab selection and physical scrollLeft agree");
 await page.screenshot({path:dir+"/profile-keyboard.png"});
 // Repeated browser transitions and StrictMode cleanup.
 await page.evaluate(()=>window.__luemiQaUnmount?.());
 await sleep(50);
 assert.equal(await page.evaluate(()=>document.body.style.overflow),"","unmount never leaves body lock");
 await page.evaluate(()=>window.__luemiQaRemount?.());
 await page.waitForSelector(".discovery-app");
 assert.equal(errors.length,0,"no browser page errors: "+errors.join("; "));
 const report={sha:process.env.GITHUB_SHA??"local",library,fresh,gridScrolled,restored,reopened,second,
  orderBeforeReload:beforeReload,orderAfterReload:afterReload,profile,viewer,menuStart,collectionReturn,tabs,
  pageErrors:errors,limitations:"Chromium 393x852 Android-UA touch simulation; physical A55/iOS/VoiceOver NOT VERIFIED"};
 writeFileSync(dir+"/focused.json",JSON.stringify(report,null,2));
 console.log("REM04D_FOCUSED_PASS "+JSON.stringify({header:[library.headerProgress,fresh.headerProgress,restored.headerProgress,second.headerProgress],tabs,pageErrors:errors.length}));
}finally{await context.close();await browser.close();}
