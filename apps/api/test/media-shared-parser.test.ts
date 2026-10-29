import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {registerRem05d,memoryPrivateStore} from "../src/rem05d-private.js";
import {registerChats} from "../src/chats-api.js";

test("real profile and chat image parsers coexist in either registration order",async()=>{
 for(const order of ["profile-first","chat-first"] as const){
  const app=Fastify({logger:false});
  const guard={read:async()=>{},mutation:async()=>{}};
  const media=()=>registerRem05d(app,guard,{
   enabled:true,testOnly:true,requestDatabaseUrl:"postgres://fake@invalid.example/postgres",
   workerDatabaseUrl:"postgres://fake@invalid.example/postgres",
   namespace:"luemi-ci",consentVersion:"luemi-beta-v1",
   storage:memoryPrivateStore()
  });
  const chats=()=>registerChats(app,guard,{
   enabled:true,databaseUrl:"postgres://fake@invalid.example/postgres",namespace:"luemi-ci"
  });
  try{
   if(order==="profile-first"){media();chats();}
   else {chats();media();}
   await app.ready();
   for(const mime of ["image/png","image/jpeg","image/webp"])
    assert.equal(app.hasContentTypeParser(mime),true,mime+" "+order);
   // Chat uploads can use a shared 10 MiB PNG decoder, but profile uploads
   // must retain their independent 1 MiB per-route body limit.
   const tooLarge=await app.inject({method:"PUT",
    url:"/api/v2/media/11111111-1111-4111-8111-111111111111/bytes",
    headers:{"content-type":"image/png"},
    payload:Buffer.alloc(1_048_577,0)});
   assert.equal(tooLarge.statusCode,413,
    "profile upload limit weakened by "+order+": "+tooLarge.statusCode);
  }finally{await app.close();}
 }
});
