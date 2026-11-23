/** V10 isolated Android-sized regression for Discovery action and account dialogs.
 * All identities and photos below are synthetic; no production data is accessed. */
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const out="qa-artifacts/discovery-v10";
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const errors=[];
page.on("pageerror",error=>errors.push(error.message));
const user="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const profile="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const photos=[
 "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
 "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
 "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
].map(id=>({id,url:"/api/v3/discovery/photo/"+id}));
const published={id:profile,name:"Мари",age:27,city:"Краснодар",countryCode:"RU",
 gender:"woman",goal:"communication",about:"Тестовая анкета для проверки меню",
 interests:["кино"],languages:["ru"],photos,likedYouKind:null,distanceKm:3,publishedAt:"2026-11-23T10:00:00Z"};
const send=(route,json)=>route.fulfill({status:200,json});
await page.route("**/api/**",async route=>{
 const path=new URL(route.request().url()).pathname;
 if(path==="/api/v2/auth/telegram"||path==="/api/v2/auth/session")
  return send(route,{user:{id:user,firstName:"QA"},csrfToken:"qa_token"});
 if(path==="/api/v2/qa/fixtures-access")return send(route,{allowed:false});
 if(path==="/api/v3/discovery/feed")
  return send(route,{status:"published_only",profiles:[published],nextCursor:null,searchScope:"world"});
 if(path.startsWith("/api/v3/discovery/photo/"))
  return route.fulfill({contentType:"image/svg+xml",body:
   '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960"><rect width="720" height="960" fill="#48546b"/></svg>'});
 if(path==="/api/v4/matches/incoming/count")return send(route,{count:0});
 if(path==="/api/v4/matches/gallery")return send(route,{outgoing:[],mutual:[]});
 if(path==="/api/v4/matches/incoming")return send(route,{likes:[],premium:false,hiddenCount:0});
 if(path==="/api/v4/chats")return send(route,{conversations:[]});
 if(path==="/api/v4/chats/me")return send(route,{actorId:user});
 return send(route,{});
});
const screenshot=async filename=>page.screenshot({path:out+"/"+filename+".png",animations:"disabled"});
try{
 await page.goto(base+"/profile-qa.html?profileReactions=1&luemiRoute=discover");
 const more=page.getByRole("button",{name:"Действия с анкетой"});
 await more.waitFor({timeout:12000});
 await more.tap();
 const menu=page.getByRole("dialog",{name:"Действия с анкетой"});
 await menu.waitFor();
 assert(await menu.evaluate(node=>node.contains(document.activeElement)),
  "Action menu traps initial focus");
 const menuGeometry=await menu.evaluate(node=>{
  const r=node.getBoundingClientRect();
  return {top:r.top,bottom:r.bottom,height:r.height,viewport:innerHeight};
 });
 await screenshot("discovery-actions-393");
 assert(menuGeometry.bottom<=menuGeometry.viewport+1&&menuGeometry.top>=0,
  "Action menu must fit Android viewport "+JSON.stringify(menuGeometry));
 assert.equal(await menu.locator(".real-discovery-action-danger").count(),1,
  "Blocking remains a real distinct destructive action");
 await screenshot("discovery-actions-393");
 await menu.getByRole("button",{name:"Пожаловаться"}).tap();
 const report=page.getByRole("dialog",{name:"Пожаловаться на анкету"});
 await report.waitFor();
 assert.equal(await report.getByLabel("Причина жалобы").count(),1);
 await screenshot("discovery-report-393");
 await page.keyboard.press("Escape");
 await report.waitFor({state:"detached"});
 assert(await more.evaluate(node=>node===document.activeElement||node.contains(document.activeElement)),
  "Escape returns focus to the original action control");

 const nav=page.getByRole("navigation",{name:"Главная навигация LUEMI"});
 await nav.getByRole("button",{name:"Профиль",exact:true}).tap();
 await page.getByRole("button",{name:"Открыть настройки"}).tap();
 const settings=page.getByRole("dialog",{name:"Настройки профиля"});
 await settings.waitFor();
 assert(await settings.evaluate(node=>node.contains(document.activeElement)),
  "Account settings focus is isolated from the background");
 await screenshot("account-settings-393");
 await page.keyboard.press("Escape");
 await settings.waitFor({state:"detached"});
 assert.deepEqual(errors,[],"No runtime errors during modal navigation");
 console.log("DISCOVERY_V10_MODALS_PASS focus, Escape, report, settings and viewport");
}finally{await browser.close();}
