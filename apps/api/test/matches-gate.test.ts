import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import {registerMatches} from "../src/matches-api.js";

test("mutual matching endpoints do not exist unless explicitly enabled",async()=>{
 const app=Fastify();
 try{
  registerMatches(app,undefined,undefined);
  await app.ready();
  assert.equal((await app.inject({method:"POST",url:"/api/v4/matches/like",payload:{targetId:"fake"}})).statusCode,404);
  assert.equal((await app.inject({method:"POST",url:"/api/v4/matches/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/close"})).statusCode,404);
 }finally{await app.close();}
});
test("mutual matches refuse missing authenticated guards",async()=>{
 const app=Fastify();
 try{
  assert.throws(()=>registerMatches(app,undefined,{enabled:true,
   databaseUrl:"postgres://localhost/synthetic",namespace:"luemi"}),/Mutual matches require V2/);
 }finally{await app.close();}
});
test("reading profile reactions requires the matching session guard",async()=>{
 const app=Fastify();
 const unauthenticated=async(_req:unknown,reply:{code:(status:number)=>{send:()=>void}})=>{reply.code(401).send();};
 try{
  registerMatches(app,{read:unauthenticated,mutation:unauthenticated},{enabled:true,
   databaseUrl:"postgres://localhost/synthetic",namespace:"luemi"});
  const result=await app.inject({method:"GET",url:"/api/v4/matches/profile/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"});
  assert.equal(result.statusCode,401);
 }finally{await app.close();}
});
test("mutual matches refuse empty or invalid namespace and database",async()=>{
 const app=Fastify();
 const guard={read:async()=>{},mutation:async()=>{}};
 try{
  for(const options of [
   {enabled:true as const,databaseUrl:"",namespace:"luemi"},
   {enabled:true as const,databaseUrl:"postgres://unused",namespace:"invalid namespace"}
  ]) assert.throws(()=>registerMatches(app,guard,options),/Mutual matches require V2/);
 }finally{await app.close();}
});
