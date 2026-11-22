/** Real Vivid Matte / Android WebView regression for the four reported screens. */
import assert from "node:assert/strict";
import {mkdir} from "node:fs/promises";
import {chromium} from "playwright";

const base=process.env.LUEMI_QA_BASE_URL||"http://127.0.0.1:5173";
const output="qa-artifacts/discovery-v9";
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const page=await browser.newPage({viewport:{width:393,height:852},
 isMobile:true,hasTouch:true,deviceScaleFactor:1,
 userAgent:"Mozilla/5.0 (Linux; Android 16; SM-A556E) AppleWebKit/537.36 Chrome/135 Mobile Safari/537.36"});
const errors=[];
page.on("pageerror",error=>errors.push(error.message));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await page.route("**/api/**",async route=>{
 const path=new URL(route.request().url()).pathname;
 const send=json=>route.fulfill({status:200,json});
 if(path==="/api/v2/auth/telegram"||path==="/api/v2/auth/session")
  return send({user:{id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",firstName:"QA"},csrfToken:"qa_token"});
 if(path==="/api/v2/qa/fixtures-access")return send({allowed:false});
 if(path==="/api/v3/discovery/feed"){
  await sleep(750);
  return send({status:"published_only",profiles:[],nextCursor:null,searchScope:"world"});
 }
 if(path==="/api/v4/matches/incoming"||path==="/api/v4/matches/gallery"){
  await sleep(750);
  return send(path.endsWith("/incoming")?{likes:[],premium:false,hiddenCount:0}:{outgoing:[],mutual:[]});
 }
 if(path==="/api/v4/matches/incoming/count")return send({count:0});
 if(path==="/api/v4/chats")return send({conversations:[]});
 if(path==="/api/v4/chats/me")return send({actorId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"});
 return send({});
});
const screenshot=async name=>page.screenshot({path:output+"/"+name+".png",animations:"disabled"});
const rect=async locator=>{const r=await locator.boundingBox();assert(r,"Missing layout "+locator);return r;};
try {
 await page.goto(base+"/profile-qa.html?profileReactions=1&luemiRoute=discover");
 const tabs=page.locator(".discovery-top-tabs");
 const feedSkeleton=page.locator(".real-discovery-feed-skeleton");
 await feedSkeleton.waitFor({timeout:10000});
 const [sr,tr,nr]=await Promise.all([rect(feedSkeleton),rect(tabs),
  rect(page.getByRole("navigation",{name:"Главная навигация LUEMI"}))]);
 assert(sr.y>=tr.y+tr.height-5,
  "Feed skeleton must start below tabs "+JSON.stringify({sr,tr}));
 assert(sr.y+sr.height<=nr.y+5,
  "Feed skeleton must stop above bottom navigation "+JSON.stringify({sr,nr}));
 await screenshot("feed-loading-393");
 await page.getByText("Пока нет анкет",{exact:true}).waitFor({timeout:10000});

 await tabs.getByRole("tab",{name:"Для тебя"}).tap();
 await page.locator(".fy-real").waitFor();
 const fy=page.locator(".fy-real");
 await fy.locator(".fy-empty-primary").waitFor();
 assert.equal(await fy.locator(".fy-section").count(),0,
  "No seven repeated empty recommendation sections");
 assert.equal(await fy.locator(".fy-empty-primary").count(),1,
  "One coherent empty recommendation state");
 const sectionBg=await fy.locator(".fy-section-header").first()
  .evaluate(node=>getComputedStyle(node).backgroundColor);
 assert.equal(sectionBg,"rgba(0, 0, 0, 0)",
  "No hard rectangular bars behind headings");
 await screenshot("for-you-empty-393");

 await tabs.getByRole("tab",{name:"Мир"}).tap();
 const world=page.locator(".nb-root");
 await world.locator(".nb-empty").waitFor();
 assert.equal((await world.locator(".nb-count").innerText()).trim(),"0 анкет");
 const emptyBox=await rect(world.locator(".nb-empty"));
 assert(emptyBox.height<270,"World empty state must be compact: "+JSON.stringify(emptyBox));
 assert.equal(await world.locator(".nb-footer").count(),0,
  "Do not repeat technical explanations on empty world screen");
 await screenshot("world-empty-393");

 await page.getByRole("navigation",{name:"Главная навигация LUEMI"})
  .getByRole("button",{name:"Симпатии",exact:true}).tap();
 const gallery=page.locator(".likes-gallery");
 await gallery.waitFor();
 const loading=gallery.locator(".likes-loading-card");
 await loading.first().waitFor({timeout:7000});
 assert.equal(await loading.count(),2,"Likes skeleton mirrors photo grid geometry");
 const likeBox=await rect(loading.first()),likeHead=await rect(gallery.locator(".likes-gallery-tabs"));
 assert(likeBox.y>=likeHead.y+likeHead.height-2,"Likes placeholders follow their tabs");
 await screenshot("likes-loading-393");
 await gallery.getByText("Пока нет входящих симпатий",{exact:true}).waitFor({timeout:10000});
 await screenshot("likes-empty-393");
 assert.deepEqual(errors,[],"No page errors across discovery visuals");
 console.log("DISCOVERY_V9_BROWSER_PASS",JSON.stringify({feed:sr,worldEmptyHeight:emptyBox.height,likes:likeBox}));
}finally{await browser.close();}
