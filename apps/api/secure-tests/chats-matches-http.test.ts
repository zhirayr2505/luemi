import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type {FastifyRequest,FastifyReply} from "fastify";
import {Pool} from "pg";
import {registerMatches} from "../src/matches-api.js";
import {registerChats} from "../src/chats-api.js";

const A="44444444-4444-4444-8444-444444444444";
const B="55555555-5555-4555-8555-555555555555";
const C="66666666-6666-4666-8666-666666666666";
const ns="luemi";
const fixtures=[{id:A,tg:404,name:"HTTP A"},{id:B,tg:505,name:"HTTP B"},{id:C,tg:606,name:"HTTP C"}];
const auth={
 read:async(req:FastifyRequest,reply:FastifyReply)=>{
  const id=req.headers["x-test-actor"];
  if(!fixtures.some(a=>a.id===id)){reply.code(401).send({error:"unauthorized"});return;}
  req.authActor={actorId:id,sessionId:id,hash:Buffer.alloc(32,7),expiresAt:"2099-01-01",firstName:"Test"};
 },
 mutation:async(req:FastifyRequest,reply:FastifyReply)=>{
  if(req.headers.origin!=="https://luemi.test"){reply.code(403).send({error:"forbidden"});return;}
  await auth.read(req,reply);
 }
};
const url=(key:string)=>{
 const value=process.env[key];
 if(!value)throw new Error("Missing isolated PostgreSQL test principal: "+key);
 return value;
};

test("two authenticated actors create one durable conversation and revoke it on block",async()=>{
 const admin=new Pool({connectionString:url("MATCHES_HTTP_ADMIN_URL")});
 const app=Fastify();
 registerChats(app,auth,{enabled:true,databaseUrl:url("MATCHES_HTTP_CHAT_URL"),namespace:ns});
 registerMatches(app,auth,{enabled:true,databaseUrl:url("MATCHES_HTTP_MATCH_URL"),namespace:ns});
 const inject=async(actor:string,method:"GET"|"POST"|"PATCH"|"DELETE",path:string,payload?:unknown)=>{
  const res=await app.inject({method,url:path,
   headers:{"x-test-actor":actor,origin:"https://luemi.test"},
   ...(payload===undefined?{}:{payload})});
  return {status:res.statusCode,json:res.json()};
 };
 try{
  await app.ready();
  for(const a of fixtures){
   await admin.query("INSERT INTO luemi_private.actors(id,environment,telegram_id,first_name,status) VALUES($1,$2,$3,$4,'active')",[a.id,ns,a.tg,a.name]);
   await admin.query(`INSERT INTO luemi_private.public_profiles
    (owner_id,environment,publication_status,published_revision,display_name,city_label,country_code,about,interests,gender,goal,languages,birth_date,published_at)
    VALUES($1,$2,'published',1,$3,'Test','DE','Synthetic',ARRAY['music'],'woman','serious',ARRAY['ru'],'1995-01-01',clock_timestamp())`,
    [a.id,ns,a.name]);
  }
  // The chat list must project a peer photo only after server moderation.
  const peerPhotoId="77777777-7777-4777-8777-777777777777";
  await admin.query(`INSERT INTO luemi_private.media_assets
   (id,owner_id,environment,original_key,derivative_key,position,state,publication_status)
   VALUES($1,$2,$3,$4,$5,0,'approved','published')`,
   [peerPhotoId,B,ns,"synthetic-original-photo-".padEnd(48,"A"),
    "synthetic-derivative-photo-".padEnd(48,"B")]);
  const strangerPhotoId="88888888-8888-4888-8888-888888888888";
  await admin.query(`INSERT INTO luemi_private.media_assets
   (id,owner_id,environment,original_key,derivative_key,position,state,publication_status)
   VALUES($1,$2,$3,$4,$5,0,'approved','published')`,
   [strangerPhotoId,C,ns,"synthetic-original-C-".padEnd(48,"C"),
    "synthetic-derivative-C-".padEnd(48,"D")]);
  const chatReader=new Pool({connectionString:url("MATCHES_HTTP_CHAT_URL")});
  const visiblePhotoIds=async(actorId:string):Promise<string[]>=>{
   const session=await chatReader.connect();
   try{
    await session.query("BEGIN");
    await session.query("SELECT set_config('luemi.actor_id',$1,true)",[actorId]);
    await session.query("SELECT set_config('luemi.environment',$1,true)",[ns]);
    const result=await session.query<{id:string}>("SELECT id FROM luemi_private.media_assets ORDER BY id");
    await session.query("COMMIT");
    return result.rows.map(x=>x.id);
   }catch(e){await session.query("ROLLBACK").catch(()=>{});throw e;}finally{session.release();}
  };
  try{
   assert.deepEqual(await visiblePhotoIds(A),[],"no relation means no photo metadata");
  }finally{await chatReader.end();}
  let result=await inject(A,"POST","/api/v4/matches/like",{targetId:B});
  assert.equal(result.status,200,JSON.stringify(result));assert.deepEqual(result.json,{liked:true,matched:false});
  result=await inject(B,"POST","/api/v4/matches/like",{targetId:A});
  assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.json.matched,true);
  const conversationId=result.json.conversationId as string;
  assert.match(conversationId,/^[0-9a-f-]{36}$/i);
  result=await inject(B,"POST","/api/v4/matches/like",{targetId:A});
  assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.json.conversationId,conversationId);
  const listed=await inject(A,"GET","/api/v4/chats");
  assert.equal(listed.status,200,JSON.stringify(listed));
  assert.equal(listed.json.conversations.length,1);
  assert.equal(listed.json.conversations[0].peerName,"HTTP B");
  assert.equal(listed.json.conversations[0].peerId,B);
  assert.equal(listed.json.conversations[0].peerPhotoUrl,
   "/api/v3/discovery/photo/"+peerPhotoId);
  const matchId=listed.json.conversations[0].matchId as string;
  const sessionPhotoReader=new Pool({connectionString:url("MATCHES_HTTP_CHAT_URL")});
  const scopedPhotos=async(actorId:string)=>{
   const db=await sessionPhotoReader.connect();
   try{
    await db.query("BEGIN");
    await db.query("SELECT set_config('luemi.actor_id',$1,true)",[actorId]);
    await db.query("SELECT set_config('luemi.environment',$1,true)",[ns]);
    const result=await db.query<{id:string}>("SELECT id FROM luemi_private.media_assets ORDER BY id");
    await db.query("COMMIT");return result.rows.map(x=>x.id);
   }catch(e){await db.query("ROLLBACK").catch(()=>{});throw e;}finally{db.release();}
  };
  try{
   assert.deepEqual(await scopedPhotos(A),[peerPhotoId],
    "matched A may only see B's approved photo");
   assert.deepEqual(await scopedPhotos(C),[],
    "stranger C must not see A or B media even if published");
  }finally{await sessionPhotoReader.end();}
  const messagePath="/api/v4/chats/"+conversationId+"/messages";
  result=await inject(C,"GET",messagePath);
  assert.equal(result.status,404,"unmatched actor must never read chat");
  const sent=await inject(A,"POST",messagePath,{
   clientId:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",body:"hello real chat"});
  assert.equal(sent.status,200,JSON.stringify(sent));
  result=await inject(A,"POST",messagePath,{
   clientId:"dddddddd-dddd-4ddd-8ddd-dddddddddddd",body:"hello real chat"});
  assert.equal(result.status,200);assert.equal(result.json.message.id,sent.json.message.id);
  result=await inject(B,"GET",messagePath);
  assert.equal(result.status,200,JSON.stringify(result));
  assert.ok(result.json.messages.some((m:{id:string})=>m.id===sent.json.message.id));
  const exportPath="/api/v4/chats/"+conversationId+"/export";
  const selfExport=await inject(A,"GET",exportPath);
  assert.equal(selfExport.status,200,JSON.stringify(selfExport));
  assert.equal(selfExport.json.format,"luemi-chat-export-v1");
  assert.ok(selfExport.json.messages.some((m:{id:string})=>m.id===sent.json.message.id));
  const unrelatedExport=await inject(C,"GET",exportPath);
  assert.equal(unrelatedExport.status,404,"stranger cannot export another user's chat");

  result=await inject(B,"POST","/api/v4/chats/"+conversationId+"/read",{messageId:sent.json.message.id});
  assert.equal(result.status,200,JSON.stringify(result));
  result=await inject(C,"POST",messagePath,{
   clientId:"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",body:"stolen"});
  assert.equal(result.status,404);
  result=await inject(B,"DELETE",messagePath+"/"+sent.json.message.id);
  assert.equal(result.status,404,"only the sender can delete");
  result=await inject(A,"PATCH",messagePath+"/"+sent.json.message.id,{body:"hello edited"});
  assert.equal(result.status,200,JSON.stringify(result));
  // Incoming-message deletion for myself and both participants, without altering original payload.
  result=await inject(C,"POST",messagePath+"/"+sent.json.message.id+"/visibility",{scope:"everyone"});
  assert.equal(result.status,404,"stranger cannot erase another conversation");
  const preHide=await inject(B,"GET",messagePath);
  assert.equal(preHide.status,200);
  const beforeRevision=preHide.json.visibilityRevision??null;
  result=await inject(B,"POST",messagePath+"/"+sent.json.message.id+"/visibility",{scope:"me"});
  assert.equal(result.status,200,JSON.stringify(result));
  result=await inject(B,"GET",messagePath);
  assert.equal(result.status,200);
  assert.notEqual(result.json.visibilityRevision??null,beforeRevision,"local hide revision must invalidate open pages");
  assert.ok(!result.json.messages.some((m:{id:string})=>m.id===sent.json.message.id),"locally hidden for B");
  result=await inject(A,"GET",messagePath);
  assert.equal(result.status,200);
  assert.ok(result.json.messages.some((m:{id:string})=>m.id===sent.json.message.id),"still visible for A");
  result=await inject(B,"POST",messagePath+"/"+sent.json.message.id+"/visibility",{scope:"everyone"});
  assert.equal(result.status,200,JSON.stringify(result));
  for(const participant of [A,B]){
   result=await inject(participant,"GET",messagePath);
   assert.equal(result.status,200);
   assert.ok(!result.json.messages.some((m:{id:string})=>m.id===sent.json.message.id),"globally hidden for each");
  }
  const afterGlobalHide=await inject(A,"GET",exportPath);
  assert.equal(afterGlobalHide.status,200);
  assert.ok(!afterGlobalHide.json.messages.some((m:{id:string})=>m.id===sent.json.message.id),
    "global deletion cannot be bypassed through private export");
  const original=await admin.query("SELECT body FROM luemi_chats.messages WHERE id=$1",[sent.json.message.id]);
  assert.equal(original.rows[0].body,"hello edited","visibility does not rewrite original message");
  const later=await inject(A,"POST",messagePath,{
   clientId:"edededed-eded-4ded-8ded-edededededed",body:"a visible new message"});
  assert.equal(later.status,200,JSON.stringify(later));
  result=await inject(B,"POST","/api/v4/chats/"+conversationId+"/clear",{scope:"me"});
  assert.equal(result.status,200);
  result=await inject(B,"GET",messagePath);
  assert.equal(result.status,200);
  assert.equal(result.json.messages.length,0,"locally cleared thread for B");
  result=await inject(A,"GET",messagePath);
  assert.equal(result.status,200);
  assert.ok(result.json.messages.some((m:{id:string})=>m.id===later.json.message.id),"A retains thread");
  result=await inject(A,"POST","/api/v4/chats/"+conversationId+"/clear",{scope:"everyone"});
  assert.equal(result.status,200);
  for(const participant of [A,B]){
   result=await inject(participant,"GET",messagePath);
   assert.equal(result.status,200);
   assert.equal(result.json.messages.length,0,"cleared for both members");
  }
  const afterClear=await inject(A,"POST",messagePath,{
   clientId:"ffffffff-ffff-4fff-8fff-fffffffbffff",body:"post-clear new message"});
  assert.equal(afterClear.status,200,JSON.stringify(afterClear));
  result=await inject(B,"GET",messagePath);
  assert.equal(result.status,200);
  assert.ok(result.json.messages.some((m:{id:string})=>m.id===afterClear.json.message.id),
    "new messages appear after full clear");
  await admin.query("INSERT INTO luemi_private.blocks(blocker_id,blocked_id,environment) VALUES($1,$2,$3)",[B,A,ns]);
  result=await inject(A,"GET",messagePath);
  assert.equal(result.status,404,"blocking must immediately revoke access");
  result=await inject(A,"POST",messagePath,{
   clientId:"ffffffff-ffff-4fff-8fff-ffffffffffff",body:"blocked"});
  assert.equal(result.status,404,"blocking must prevent sending");
  result=await inject(A,"POST","/api/v4/matches/"+matchId+"/close",{});
  assert.equal(result.status,200,JSON.stringify(result));
  result=await inject(B,"GET","/api/v4/chats");
  assert.equal(result.status,200);assert.equal(result.json.conversations.length,0);
 }finally{
  await app.close();
  await admin.end();
 }
});
