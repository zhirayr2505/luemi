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
