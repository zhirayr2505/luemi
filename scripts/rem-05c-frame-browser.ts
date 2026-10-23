import assert from "node:assert/strict";
import {createServer, type Server} from "node:https";
import {readFileSync,mkdirSync} from "node:fs";
import {chromium} from "playwright";
import type {FastifyInstance} from "fastify";
import {buildApp} from "../apps/api/src/app.js";
const key=readFileSync(process.argv[2]),cert=readFileSync(process.argv[3]);
const tls={key,cert};
const origins={child:4512,allowed:4513,attacker:4514};
const child=buildApp({port:4512,origin:"https://127.0.0.1:4512",
 botToken:"123456:synthetic",healthKey:"synthetic_health_key_long_123456",
 webhookSecret:"synthetic_webhook",logger:false,
 rem05c:{embedding:{enabled:true,ancestors:["https://127.0.0.1:4513"]},
 geo:{enabled:false,providerEnabled:false,providerKey:""}}});
child.get("/frame",async(_req,reply)=>reply.type("text/html")
 .send("<!doctype html><html><body><p id='marker'>SYNTHETIC-FRAME-CONTENT</p></body></html>"));
const servers:Server[]=[];
async function start(port:number,app?:FastifyInstance){
 const server=createServer(tls,async(req,res)=>{
  if(app){
   const response=await app.inject({method:"GET",url:req.url??"/",headers:{accept:"text/html"}});
   res.writeHead(response.statusCode,response.headers as Record<string,string>);
   res.end(response.rawPayload);
  }else{
   res.writeHead(200,{"Content-Type":"text/html","Cache-Control":"no-store"});
   res.end("<!doctype html><html><body><iframe id='frame' src='https://127.0.0.1:4512/frame'></iframe></body></html>");
  }
 });
 await new Promise<void>(resolve=>server.listen(port,"127.0.0.1",resolve));
 servers.push(server);
}
await start(origins.child,child);
await start(origins.allowed);
await start(origins.attacker);
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
try{
 const context=await browser.newContext({ignoreHTTPSErrors:true});
 const page=await context.newPage();
 await page.goto("https://127.0.0.1:4513/");
 await page.frameLocator("#frame").locator("#marker").waitFor({timeout:7000});
 const marker=await page.frameLocator("#frame").locator("#marker").innerText();
 assert.equal(marker,"SYNTHETIC-FRAME-CONTENT");
 mkdirSync("qa-artifacts/rem05c",{recursive:true});
 await page.screenshot({path:"qa-artifacts/rem05c/iframe-approved-synthetic.png"});
 await page.goto("https://127.0.0.1:4514/");
 await page.waitForTimeout(800);
 assert.equal(await page.frameLocator("#frame").locator("#marker").count(),0,
  "attacker parent must not render document protected by frame-ancestors");
 console.log("REM05C_CSP_FRAME_BROWSER_PASS allowed parent=4513 forbidden parent=4514");
 await context.close();
}finally{
 await browser.close();
 for(const server of servers)await new Promise<void>(resolve=>server.close(()=>resolve()));
 await child.close();
}
