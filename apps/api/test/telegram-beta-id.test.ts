import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type {ApiConfig} from "../src/config.js";
import {registerTelegramWebhook} from "../src/telegram-webhook.js";

const secret="luemi_test_webhook_secret_at_least_32";
function build(){
 const app=Fastify({logger:false});
 registerTelegramWebhook(app,{
  botToken:"987654:synthetic",webhookSecret:secret,
  origin:"https://luemi.onrender.com"
 } as ApiConfig);
 return app;
}
test("private /myid reveals only the validated requesting Telegram sender ID",async()=>{
 const app=build();
 try{
  const response=await app.inject({method:"POST",url:"/api/telegram/webhook",
   headers:{"x-telegram-bot-api-secret-token":secret},
   payload:{message:{text:"/myid",from:{id:12345678},chat:{id:12345678,type:"private"}}}});
  assert.equal(response.statusCode,200);
  const body=response.json();
  assert.equal(body.method,"sendMessage");
  assert.equal(body.chat_id,12345678);
  assert.match(body.text,/12345678/);
  assert.equal(body.reply_markup,undefined);
 }finally{await app.close();}
});
test("bot rejects forged sender, group requests and invalid webhook signature",async()=>{
 const app=build();
 try{
  for(const message of [
   {text:"/myid",from:{id:11111},chat:{id:22222,type:"private"}},
   {text:"/myid",from:{id:11111},chat:{id:-10001,type:"supergroup"}}
  ]){
   const response=await app.inject({method:"POST",url:"/api/telegram/webhook",
    headers:{"x-telegram-bot-api-secret-token":secret},payload:{message}});
   assert.equal(response.statusCode,200);assert.deepEqual(response.json(),{ok:true});
  }
  const denied=await app.inject({method:"POST",url:"/api/telegram/webhook",
   headers:{"x-telegram-bot-api-secret-token":"wrong"},payload:{message:{text:"/myid",from:{id:11111},chat:{id:11111,type:"private"}}}});
  assert.equal(denied.statusCode,404);
 }finally{await app.close();}
});
