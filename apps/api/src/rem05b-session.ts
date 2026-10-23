import {createHmac,randomBytes,timingSafeEqual} from "node:crypto";
import type {FastifyInstance,FastifyReply,FastifyRequest} from "fastify";
import {Pool} from "pg";
import {validateTelegramInitData} from "./telegram-auth.js";

export interface Rem05bOptions {
 enabled:boolean; issuerDatabaseUrl:string; requestDatabaseUrl:string; pepper:string;
 namespace:string; origin:string; botToken:string; idleMs:number; absoluteMs:number; maxSessions:number;
}
type Session={actorId:string;sessionId:string;hash:Buffer;expiresAt:string;firstName:string};
declare module "fastify" {interface FastifyRequest{authActor?:Session}}
const cookieName="__Host-luemi_sid";
function hash(key:string,value:string){return createHmac("sha256",key).update(value).digest();}
function csrf(key:string,h:Buffer){return createHmac("sha256",key).update("csrf:").update(h).digest("base64url");}
function equals(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
function cookie(value:string,maxAge:number){return cookieName+"="+value+"; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age="+maxAge;}
function tokenFrom(req:FastifyRequest):string|null{
 const items=(req.headers.cookie??"").split(";").map(x=>x.trim()).filter(x=>x.startsWith(cookieName+"="));
 if(items.length!==1)return null;
 const token=items[0].slice(cookieName.length+1);
 return /^[A-Za-z0-9_-]{43}$/.test(token)?token:null;
}
function validOrigin(req:FastifyRequest,origin:string){
 return req.headers.origin===origin&&!["none","cross-site"].includes(String(req.headers["sec-fetch-site"]??""));
}
function deny(reply:FastifyReply,status:401|503=401){
 return reply.code(status).send({error:status===401?"unauthorized":"service_unavailable"});
}
export function registerRem05b(app:FastifyInstance,cfg:Rem05bOptions):void{
 if(!cfg.enabled)return;
 if(!cfg.issuerDatabaseUrl||!cfg.requestDatabaseUrl||!cfg.botToken||!cfg.namespace||
 !/^[a-z0-9:_-]{1,96}$/i.test(cfg.namespace)||Buffer.byteLength(cfg.pepper)<32||
 cfg.idleMs<60000||cfg.absoluteMs<cfg.idleMs||!Number.isSafeInteger(cfg.maxSessions)||
 cfg.maxSessions<1||cfg.maxSessions>20)throw new Error("Invalid REM-05B test-only config");
 const issuer=new Pool({connectionString:cfg.issuerDatabaseUrl,max:5,connectionTimeoutMillis:3000});
 const scoped=new Pool({connectionString:cfg.requestDatabaseUrl,max:5,connectionTimeoutMillis:3000});
 app.addHook("onClose",async()=>{await Promise.all([issuer.end(),scoped.end()]);});
 async function inspect(req:FastifyRequest):Promise<{value:Session}|{status:401|503}>{
  const raw=tokenFrom(req);if(!raw)return{status:401};
  const h=hash(cfg.pepper,raw);
  try{
   const result=await issuer.query<{actor_id:string;session_id:string;expires_at:string;first_name:string}>(
    "UPDATE luemi_private.sessions s SET last_seen_at=clock_timestamp(), "+
    "idle_expires_at=LEAST(s.absolute_expires_at,clock_timestamp()+($3::bigint * interval '1 millisecond')) "+
    "FROM luemi_private.actors a WHERE s.token_hash=$1 AND s.environment=$2 AND s.revoked_at IS NULL "+
    "AND s.actor_id=a.id AND a.environment=$2 AND a.status='active' "+
    "AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp() "+
    "RETURNING s.actor_id,s.id AS session_id,s.absolute_expires_at AS expires_at,a.first_name",
    [h,cfg.namespace,cfg.idleMs]);
   if(result.rowCount!==1)return{status:401};
   const r=result.rows[0];
   return{value:{actorId:r.actor_id,sessionId:r.session_id,hash:h,expiresAt:r.expires_at,firstName:r.first_name}};
  }catch{return{status:503};}
 }
 const authenticated=async(req:FastifyRequest,reply:FastifyReply)=>{
  const result=await inspect(req);
  if("status" in result){deny(reply,result.status);return;}
  req.authActor=result.value;
 };
 const protectedMutation=async(req:FastifyRequest,reply:FastifyReply)=>{
  if(!validOrigin(req,cfg.origin)){reply.code(403).send({error:"forbidden"});return;}
  await authenticated(req,reply);
  if(!req.authActor)return;
  const supplied=req.headers["x-luemi-csrf"];
  if(typeof supplied!=="string"||!equals(supplied,csrf(cfg.pepper,req.authActor.hash)))
   reply.code(403).send({error:"forbidden"});
 };
 app.post<{Body:{initData?:unknown}}>("/api/v2/auth/telegram",async(req,reply)=>{
  if(!validOrigin(req,cfg.origin))return reply.code(403).send({error:"forbidden"});
  const raw=req.body?.initData;
  if(typeof raw!=="string"||Buffer.byteLength(raw,"utf8")>8192)return reply.code(401).send({error:"invalid_init_data"});
  const verified=validateTelegramInitData(raw,cfg.botToken);
  if(!verified||!verified.user.first_name.trim())return reply.code(401).send({error:"invalid_init_data"});
  const db=await issuer.connect().catch(()=>null);
  if(!db)return deny(reply,503);
  try{
   await db.query("BEGIN");
   const result=await db.query<{id:string;first_name:string}>(
    "INSERT INTO luemi_private.actors(environment,telegram_id,first_name) VALUES($1,$2,$3) "+
    "ON CONFLICT(environment,telegram_id) DO UPDATE SET updated_at=clock_timestamp() "+
    "WHERE luemi_private.actors.status='active' RETURNING id,first_name",
    [cfg.namespace,String(verified.user.id),verified.user.first_name]);
   if(result.rowCount!==1){await db.query("ROLLBACK");return reply.code(403).send({error:"account_unavailable"});}
   const actor=result.rows[0];
   const counted=await db.query<{count:string}>(
    "SELECT count(*)::text AS count FROM luemi_private.sessions WHERE actor_id=$1 AND environment=$2 "+
    "AND revoked_at IS NULL AND idle_expires_at>clock_timestamp() AND absolute_expires_at>clock_timestamp()",
    [actor.id,cfg.namespace]);
   if(Number(counted.rows[0].count)>=cfg.maxSessions){
    await db.query("ROLLBACK");return reply.code(429).send({error:"session_limit"});
   }
   const token=randomBytes(32).toString("base64url"),h=hash(cfg.pepper,token);
   const inserted=await db.query<{expires_at:string}>(
    "INSERT INTO luemi_private.sessions(actor_id,environment,token_hash,created_at,idle_expires_at,absolute_expires_at) "+
    "VALUES($1,$2,$3,clock_timestamp(),clock_timestamp()+($4::bigint * interval '1 millisecond'),"+
    "clock_timestamp()+($5::bigint * interval '1 millisecond')) RETURNING absolute_expires_at AS expires_at",
    [actor.id,cfg.namespace,h,cfg.idleMs,cfg.absoluteMs]);
   await db.query("COMMIT");
   reply.header("Set-Cookie",cookie(token,Math.floor(cfg.absoluteMs/1000)));
   return{mode:"session_v2",user:{id:actor.id,firstName:actor.first_name},
    csrfToken:csrf(cfg.pepper,h),expiresAt:inserted.rows[0].expires_at};
  }catch{await db.query("ROLLBACK").catch(()=>{});return deny(reply,503);}
  finally{db.release();}
 });
 app.get("/api/v2/auth/session",{preHandler:authenticated},async(req)=>{
  const s=req.authActor!;
  return{mode:"session_v2",user:{id:s.actorId,firstName:s.firstName},
    csrfToken:csrf(cfg.pepper,s.hash),expiresAt:s.expiresAt};
 });
 app.get("/api/v2/me",{preHandler:authenticated},async(req,reply)=>{
  const s=req.authActor!,db=await scoped.connect().catch(()=>null);
  if(!db)return deny(reply,503);
  try{
   await db.query("BEGIN");
   await db.query("SELECT set_config('luemi.actor_id',$1,true)",[s.actorId]);
   const result=await db.query<{id:string}>(
    "SELECT id FROM luemi_private.actors WHERE id=$1 AND environment=$2 AND status='active'",
    [s.actorId,cfg.namespace]);
   await db.query("COMMIT");
   if(result.rowCount!==1)return deny(reply);
   return{id:result.rows[0].id,capabilities:{draftSync:false,publish:false,mediaUpload:false,
    matches:false,chats:false,bliki:false,payments:false}};
  }catch{await db.query("ROLLBACK").catch(()=>{});return deny(reply,503);}
  finally{db.release();}
 });
 app.post("/api/v2/auth/refresh",{preHandler:protectedMutation},async(req,reply)=>{
  const s=req.authActor!,db=await issuer.connect().catch(()=>null);
  if(!db)return deny(reply,503);
  try{
   await db.query("BEGIN");
   const old=await db.query<{absolute_expires_at:string;first_name:string}>(
    "SELECT s.absolute_expires_at,a.first_name FROM luemi_private.sessions s "+
    "JOIN luemi_private.actors a ON a.id=s.actor_id "+
    "WHERE s.id=$1 AND s.actor_id=$2 AND s.token_hash=$3 AND s.environment=$4 "+
    "AND a.environment=$4 AND a.status='active' AND s.revoked_at IS NULL "+
    "AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp() FOR UPDATE OF s",
    [s.sessionId,s.actorId,s.hash,cfg.namespace]);
   if(old.rowCount!==1){await db.query("ROLLBACK");return deny(reply);}
   const next=randomBytes(32).toString("base64url"),nextHash=hash(cfg.pepper,next);
   await db.query("UPDATE luemi_private.sessions SET token_hash=$1,generation=generation+1,"+
    "last_seen_at=clock_timestamp(),idle_expires_at=LEAST(absolute_expires_at,"+
    "clock_timestamp()+($2::bigint * interval '1 millisecond')) WHERE id=$3",
    [nextHash,cfg.idleMs,s.sessionId]);
   await db.query("COMMIT");
   reply.header("Set-Cookie",cookie(next,Math.floor(cfg.absoluteMs/1000)));
   return{mode:"session_v2",user:{id:s.actorId,firstName:old.rows[0].first_name},
    csrfToken:csrf(cfg.pepper,nextHash),expiresAt:old.rows[0].absolute_expires_at};
  }catch{await db.query("ROLLBACK").catch(()=>{});return deny(reply,503);}
  finally{db.release();}
 });
 app.post("/api/v2/auth/logout",{preHandler:protectedMutation},async(req,reply)=>{
  try{
   await issuer.query("UPDATE luemi_private.sessions SET revoked_at=clock_timestamp() "+
    "WHERE id=$1 AND actor_id=$2 AND revoked_at IS NULL",
    [req.authActor!.sessionId,req.authActor!.actorId]);
   reply.header("Set-Cookie",cookie("",0));return{ok:true};
  }catch{return deny(reply,503);}
 });
 app.post("/api/v2/auth/logout-all",{preHandler:protectedMutation},async(req,reply)=>{
  try{
   await issuer.query("UPDATE luemi_private.sessions SET revoked_at=clock_timestamp() "+
    "WHERE actor_id=$1 AND environment=$2 AND revoked_at IS NULL",
    [req.authActor!.actorId,cfg.namespace]);
   reply.header("Set-Cookie",cookie("",0));return{ok:true};
  }catch{return deny(reply,503);}
 });
}
