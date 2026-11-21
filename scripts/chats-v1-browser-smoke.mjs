import {chromium} from "playwright";
import assert from "node:assert/strict";

const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const viewport={width:412,height:915};
const mockMatches=page=>page.route("**/api/v4/matches/new",route=>
 route.fulfill({json:{matches:[],viewerGender:"other"}}));
const url=process.env.CHATS_DEMO_URL??"http://127.0.0.1:5173/chats-demo.html";
try{
 const page=await browser.newPage({viewport,deviceScaleFactor:1,hasTouch:true,isMobile:true});
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await mockMatches(page);
 await page.goto(url);
 await page.getByRole("heading",{name:"Чаты"}).waitFor();
 await page.locator(".lc-chat-row").first().tap();
 const thread=page.locator(".lc-thread-route");
 await thread.locator(".lc-msg-line").first().waitFor();
 assert.equal(await thread.getAttribute("data-chat-theme"),"eclipse");
 await page.waitForFunction(()=>performance.getEntriesByType("resource")
  .some(resource=>resource.name.endsWith("/chat-eclipse.webp")&&resource.responseStatus===200));
 const list=thread.locator(".lc-history");
 await page.waitForFunction(()=>{const node=document.querySelector(".lc-history");return node.scrollHeight-node.clientHeight-node.scrollTop<3;});
 assert.equal(await list.locator(".lc-bubble").evaluateAll(nodes=>nodes.some(node=>node.getAnimations().length)),false,
  "opening a chat does not replay an animation for every old message");
 await page.getByLabel("Сообщение").fill("Browser smoke 💜");
 await Promise.all([
  page.waitForFunction(()=>[...document.querySelectorAll(".lc-own .lc-bubble")].some(bubble=>
   bubble.textContent.includes("Browser smoke 💜")&&bubble.getAnimations().some(animation=>
    animation.effect?.getKeyframes().some(frame=>Number(frame.opacity)===0)))),
  page.getByLabel("Отправить").tap()
 ]);
 const sent=thread.locator(".lc-msg-line").filter({hasText:"Browser smoke 💜"});
 await sent.waitFor();
 assert.equal(await sent.count(),1);
 const identity=await sent.elementHandle();
 await page.waitForFunction(()=>document.querySelector(".lc-msg-line.sending")===null);
 assert(await identity.evaluate(node=>node.isConnected),"the server acknowledgement keeps the same message element");
 assert.equal(await thread.locator(".lc-msg-line.failed").count(),0);
 await list.evaluate(node=>{node.scrollTop=0;});
 const older=thread.getByRole("button",{name:"Показать раньше"});
 await older.tap();
 await page.getByText("Демо-сообщение 35",{exact:true}).waitFor();
 await list.evaluate(node=>{node.scrollTop=0;});
 await page.getByRole("button",{name:"Входящее",exact:true}).tap();
 const jump=thread.getByRole("button",{name:"Новые сообщения · 1",exact:true});
 await jump.waitFor({timeout:6000});
 assert(await list.evaluate(node=>node.scrollHeight-node.clientHeight-node.scrollTop>96),
  "reading older messages is uninterrupted when a new one arrives");
 await jump.tap();
 await page.waitForFunction(()=>{const node=document.querySelector(".lc-history");return node.scrollHeight-node.clientHeight-node.scrollTop<4;});
 assert(await thread.getByText("Новое демо-сообщение ✨").isVisible());
 await page.getByLabel("Назад",{exact:true}).tap();
 await page.getByRole("heading",{name:"Чаты"}).waitFor();
 assert.deepEqual(errors,[]);
 await page.close();

 const reduced=await browser.newPage({viewport,reducedMotion:"reduce"});
 await mockMatches(reduced);
 await reduced.goto(url);
 await reduced.locator(".lc-chat-row").first().click();
 await reduced.locator(".lc-msg-line").first().waitFor();
 await reduced.getByLabel("Сообщение").fill("Reduced motion");
 await reduced.getByLabel("Отправить").click();
 const still=reduced.locator(".lc-msg-line").filter({hasText:"Reduced motion"});
 await still.waitFor();
 assert.equal(await still.locator(".lc-bubble").evaluate(node=>node.getAnimations().length),0);
 console.log("LUEMI chat browser PASS artwork, reading position, send/ACK, older messages and reduced motion");
}finally{await browser.close();}
