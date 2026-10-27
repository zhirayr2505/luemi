import {readFileSync} from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {registerChats} from "../src/chats-api.js";

test("chats remain absent when feature is disabled",async()=>{
 const app=Fastify();
 try{
  registerChats(app,undefined,undefined);
  await app.ready();
  const response=await app.inject({method:"GET",url:"/api/v4/chats"});
  assert.equal(response.statusCode,404);
 }finally{await app.close();}
});

test("chat registration rejects missing authenticated guards",async()=>{
 const app=Fastify();
 try{
  assert.throws(()=>registerChats(app,undefined,{
   enabled:true,databaseUrl:"postgres://unused:unused@localhost/unused",namespace:"test"
  }),/Chats require V2 auth/);
 }finally{await app.close();}
});

test("chat registration rejects missing isolated database URL",async()=>{
 const app=Fastify();
 const guard={read:async()=>{},mutation:async()=>{}};
 try{
  assert.throws(()=>registerChats(app,guard,{
   enabled:true,databaseUrl:"",namespace:"test"
  }),/Chats require V2 auth/);
 }finally{await app.close();}
});


test("chat schema keeps body-state constraint after deleted_at declaration",()=>{
 const sql=readFileSync(new URL("../../../db/chats-v1-isolated.sql",import.meta.url),"utf8");
 const messageTable=sql.split("CREATE TABLE IF NOT EXISTS luemi_chats.messages (")[1]?.split(");")[0];
 assert.ok(messageTable,"messages table must exist");
 assert.ok(messageTable.indexOf("deleted_at timestamptz")<messageTable.indexOf("CONSTRAINT chat_message_body_state"),"body state check must follow referenced column");
 assert.match(messageTable,/deleted_at IS NOT NULL AND body=''/);
});

test("message update policy requires current conversation membership",()=>{
 const sql=readFileSync(new URL("../../../db/chats-v1-isolated.sql",import.meta.url),"utf8");
 const policy=sql.split("CREATE POLICY chats_messages_update")[1]?.split("CREATE TABLE IF NOT EXISTS luemi_chats.media")[0];
 assert.ok(policy);
 assert.equal((policy.match(/EXISTS \(SELECT 1 FROM luemi_chats.members/g)||[]).length,2);
});
