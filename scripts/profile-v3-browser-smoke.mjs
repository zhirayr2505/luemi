import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:740},deviceScaleFactor:1});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:5173/profile-v3-preview.html");
 const root=page.getByTestId("v3-root"),handle=page.getByRole("button",{name:"Переключить профиль"});
 await root.waitFor();assert.equal(await root.getAttribute("data-progress"),"0.0000");
 const img=page.locator(".v3-mask img");assert.equal(await img.count(),1);
 const node=await img.evaluate(el=>({complete:el.complete,width:el.naturalWidth,height:el.naturalHeight}));
 assert(node.complete&&node.width===800&&node.height===1100);
 const start=await page.getByTestId("v3-sheet").boundingBox();
 await handle.click();await page.waitForTimeout(380);
 const expanded=await page.getByTestId("v3-sheet").boundingBox();
 assert(expanded.y>start.y+80);assert(Number(await root.getAttribute("data-progress"))>.99);
 const bounds=await handle.boundingBox(),x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y-90,{steps:5});
 const dragged=Number(await root.getAttribute("data-progress"));assert(dragged<1&&dragged>0);
 await page.mouse.up();await handle.click();await page.waitForTimeout(390);
 assert(Number(await root.getAttribute("data-progress"))<.01);
 assert.equal(await img.count(),1);assert.deepEqual(errors,[]);
 console.log("Profile V3 Chromium DOM smoke PASS: compact, panel travel, persistent photo, interrupted drag, compact return, no page errors");
}finally{await browser.close();}
