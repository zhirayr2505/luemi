import {chromium} from "playwright";
import assert from "node:assert/strict";

const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:412,height:915},deviceScaleFactor:1});
 await page.goto(process.env.CHATS_DEMO_URL??"http://127.0.0.1:5173/chats-demo.html",{waitUntil:"networkidle"});
 await page.locator(".lc-chat-row").first().click();
 await page.getByLabel("Сообщение").fill("Browser smoke 💜");
 await page.getByLabel("Отправить").click();
 await page.getByText("Browser smoke 💜").waitFor();
 assert.equal(await page.locator(".lc-msg-line.failed").count(),0);
 await page.getByLabel("Назад").click();
 await page.getByRole("heading",{name:"Чаты"}).waitFor();
 console.log("LUEMI Chats V1 browser smoke PASS");
}finally{await browser.close();}
