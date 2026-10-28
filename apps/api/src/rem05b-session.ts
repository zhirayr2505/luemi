import {createHmac,randomBytes,timingSafeEqual} from "node:crypto";
import type {FastifyInstance,FastifyReply,FastifyRequest} from "fastify";
import {Pool} from "pg";
import type {PoolClient} from "pg";
import {validateTelegramInitData} from "./telegram-auth.js";
import {RateBuckets} from "./rem05c-rate.js";

export interface Rem05bOptions {
 enabled:boolean; issuerDatabaseUrl:string; requestDatabaseUrl:string; pepper:string;
 namespace:string; origin:string; botToken:string; idleMs:number; absoluteMs:number; maxSessions:number;
 inviteOnly?:boolean;
 /** Capacity-bounded self-service test, distinct from global public signup. */
 maxNewActors?:number;
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
export function registerRem05b(app:FastifyInstance,cfg:Rem05bOptions):{read:(req:FastifyRequest,reply:FastifyReply)=>Promise<void>;geoRead:(req:FastifyRequest,reply:FastifyReply)=>Promise<void>;mutation:(req:FastifyRequest,reply:FastifyReply)=>Promise<void>}|undefined{
 if(!cfg.enabled)return;
 if(!cfg.issuerDatabaseUrl||!cfg.requestDatabaseUrl||!cfg.botToken||!cfg.namespace||
 !/^[a-z0-9:_-]{1,96}$/i.test(cfg.namespace)||Buffer.byteLength(cfg.pepper)<32||
 cfg.idleMs<60000||cfg.absoluteMs<cfg.idleMs||!Number.isSafeInteger(cfg.maxSessions)||
 cfg.maxSessions<1||cfg.maxSessions>20||
 (cfg.maxNewActors!==undefined&&(!Number.isSafeInteger(cfg.maxNewActors)||
  cfg.maxNewActors<2||cfg.maxNewActors>50||cfg.inviteOnly)))
  throw new Error("Invalid REM-05B test-only config");
 const perActorRate=new RateBuckets();
 const issuer=new Pool({connectionString:cfg.issuerDatabaseUrl,max:5,connectionTimeoutMillis:3000});
 const scoped=new Pool({connectionString:cfg.requestDatabaseUrl,max:5,connectionTimeoutMillis:3000});
 app.addHook("onClose",async()=>{await Promise.all([issuer.end(),scoped.end()]);});
 async function safeRole(db:PoolClient,kind:"luemi_auth_issuer"|"luemi_request"):Promise<boolean>{
  // SECURITY: membership, including indirect/non-inheriting membership, must be disjoint.
  // Check the exact same connection used by each following SQL statement, not pool.query().
  // Effective ACLs and RLS activation must agree with the intended role boundary.
  try{
   const other=kind==="luemi_auth_issuer"?"luemi_request":"luemi_auth_issuer";
   const res=await db.query<{safe:boolean}>(
    "SELECT (r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls "+
    "AND NOT r.rolcreaterole AND NOT r.rolcreatedb AND session_user=current_user "+
    "AND current_setting('row_security')='on' "+
    "AND pg_has_role(current_user,$1::name,'member') "+
    "AND NOT pg_has_role(current_user,$2::name,'member') "+
    "AND NOT pg_has_role(current_user,'pg_read_all_data','member') "+
    "AND NOT pg_has_role(current_user,'pg_write_all_data','member') "+
    "AND NOT pg_has_role(current_user,'pg_read_server_files','member') "+
    "AND NOT pg_has_role(current_user,'pg_write_server_files','member') "+
    "AND NOT pg_has_role(current_user,'pg_execute_server_program','member') "+
    "AND NOT has_schema_privilege(current_user,'luemi_private','CREATE') "+
    "AND NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.oid IN "+
    "('luemi_private.actors'::regclass,'luemi_private.sessions'::regclass) "+
    "AND c.relowner=r.oid) "+
    "AND (SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity) "+
    "FROM pg_class c WHERE c.oid IN "+
    "('luemi_private.actors'::regclass,'luemi_private.sessions'::regclass)) "+
    "AND row_security_active('luemi_private.actors'::regclass) "+
    "AND row_security_active('luemi_private.sessions'::regclass) "+
    "AND CASE WHEN $1::text='luemi_request' THEN "+
    "(has_column_privilege(current_user,'luemi_private.actors','id','SELECT') AND has_column_privilege(current_user,'luemi_private.actors','status','SELECT') AND has_column_privilege(current_user,'luemi_private.actors','environment','SELECT') "+
    "AND NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE "+
    "a.attrelid='luemi_private.actors'::regclass AND a.attnum>0 "+
    "AND NOT a.attisdropped AND a.attname NOT IN ('id','status','environment') "+
    "AND has_column_privilege(current_user,a.attrelid,a.attname,'SELECT')) "+
    "AND NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE "+
    "a.attrelid='luemi_private.sessions'::regclass AND a.attnum>0 "+
    "AND NOT a.attisdropped AND has_column_privilege(current_user,a.attrelid,a.attname,'SELECT')) "+
    "AND NOT has_table_privilege(current_user,'luemi_private.sessions','SELECT') "+
    "AND NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE "+
    "a.attrelid IN ('luemi_private.actors'::regclass,'luemi_private.sessions'::regclass) "+
    "AND a.attnum>0 AND NOT a.attisdropped AND "+
    "(has_column_privilege(current_user,a.attrelid,a.attname,'INSERT') OR "+
    "has_column_privilege(current_user,a.attrelid,a.attname,'UPDATE') OR "+
    "has_column_privilege(current_user,a.attrelid,a.attname,'REFERENCES'))) "+
    "AND NOT has_table_privilege(current_user,'luemi_private.actors','INSERT') "+
    "AND NOT has_table_privilege(current_user,'luemi_private.actors','DELETE') "+
    "AND NOT has_table_privilege(current_user,'luemi_private.actors','UPDATE') "+
    "AND NOT has_table_privilege(current_user,'luemi_private.sessions','INSERT') "+
    "AND NOT has_table_privilege(current_user,'luemi_private.sessions','UPDATE') "+
    "AND NOT has_table_privilege(current_user,'luemi_private.sessions','DELETE')) "+
    "ELSE (has_table_privilege(current_user,'luemi_private.sessions','SELECT') "+
    "AND has_table_privilege(current_user,'luemi_private.sessions','INSERT') "+
    "AND has_table_privilege(current_user,'luemi_private.actors','SELECT')) END "+
    ") AS safe FROM pg_roles r WHERE r.rolname=current_user",
    [kind,other]);
   return res.rowCount===1&&res.rows[0].safe===true;
  }catch{return false;}
 }
 async function roleClient(pool:Pool,kind:"luemi_auth_issuer"|"luemi_request"):Promise<PoolClient|null>{
  const db=await pool.connect().catch(()=>null);
  if(!db)return null;
  if(!(await safeRole(db,kind))){db.release();return null;}
  return db;
 }
 async function inspect(req:FastifyRequest):Promise<{value:Session}|{status:401|503}>{
  const raw=tokenFrom(req);if(!raw)return{status:401};
  const db=await roleClient(issuer,"luemi_auth_issuer");
  if(!db)return{status:503};
  const h=hash(cfg.pepper,raw);
  try{
   if(cfg.inviteOnly){
    await db.query("BEGIN");
    await db.query("SELECT set_config('luemi.environment',$1,true)",[cfg.namespace]);
   }
   const result=await db.query<{actor_id:string;session_id:string;expires_at:string;first_name:string}>(
    "UPDATE luemi_private.sessions s SET last_seen_at=clock_timestamp(), "+
    "idle_expires_at=LEAST(s.absolute_expires_at,clock_timestamp()+($3::bigint * interval '1 millisecond')) "+
    "FROM luemi_private.actors a WHERE s.token_hash=$1 AND s.environment=$2 AND s.revoked_at IS NULL "+
    "AND s.actor_id=a.id AND a.environment=$2 AND a.status='active' "+
    (cfg.inviteOnly?
      "AND EXISTS(SELECT 1 FROM luemi_private.beta_invites i WHERE i.environment=$2 "+
      "AND i.telegram_id=a.telegram_id AND i.state='active') ":"") +
    "AND s.idle_expires_at>clock_timestamp() AND s.absolute_expires_at>clock_timestamp() "+
    "RETURNING s.actor_id,s.id AS session_id,s.absolute_expires_at AS expires_at,a.first_name",
    [h,cfg.namespace,cfg.idleMs]);
   if(result.rowCount!==1){
    if(cfg.inviteOnly)await db.query("ROLLBACK");
    return{status:401};
   }
   if(cfg.inviteOnly)await db.query("COMMIT");
   const r=result.rows[0];
   return{value:{actorId:r.actor_id,sessionId:r.session_id,hash:h,expiresAt:r.expires_at,firstName:r.first_name}};
  }catch{
   if(cfg.inviteOnly)await db.query("ROLLBACK").catch(()=>{});
   return{status:503};
  }finally{db.release();}
 }
 const authenticated=async(req:FastifyRequest,reply:FastifyReply)=>{
  const result=await inspect(req);
  if("status" in result){deny(reply,result.status);return;}
  req.authActor=result.value;
  if(req.url.split("?")[0]==="/api/v2/me"){
   const limit=perActorRate.check("me:"+result.value.actorId,180);
   if(!limit.allowed){
    reply.header("Retry-After",String(limit.retryAfter));
    reply.code(429).send({error:"rate_limited"});
   }
  }
 };
 // Read-only GET can still bill Geoapify. Browser SameSite=Lax cookies are
 // sent on cross-site top-level navigations: require a memory-only, session
 // generation-bound CSRF header and reject cross-origin Fetch Metadata.
 const protectedGeoRead=async(req:FastifyRequest,reply:FastifyReply)=>{
  await authenticated(req,reply);
  if(!req.authActor||reply.sent)return;
  const site=req.headers["sec-fetch-site"];
  const mode=req.headers["sec-fetch-mode"];
  const dest=req.headers["sec-fetch-dest"];
  if((req.headers.origin!==undefined&&req.headers.origin!==cfg.origin)||
    (site!==undefined&&site!=="same-origin")||
    mode==="navigate"||dest==="document"){
    reply.code(403).send({error:"forbidden"});return;
  }
  const supplied=req.headers["x-luemi-csrf"];
  if(typeof supplied!=="string"||!equals(supplied,csrf(cfg.pepper,req.authActor.hash)))
    reply.code(403).send({error:"forbidden"});
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
  // Public signups cannot consume unbounded sessions through replayed, valid
  // Telegram initData. Rate-limit each verified identity as well as the shared
  // network ceiling; never trust a browser-provided Telegram ID.
  const throttle=perActorRate.check("telegram-login:"+verified.user.id,12);
  if(!throttle.allowed){
   reply.header("Retry-After",String(throttle.retryAfter));
   return reply.code(429).send({error:"rate_limited"});
  }
  const db=await roleClient(issuer,"luemi_auth_issuer");
  if(!db)return deny(reply,503);
  try{
   await db.query("BEGIN");
   if(cfg.inviteOnly){
    await db.query("SELECT set_config('luemi.environment',$1,true)",[cfg.namespace]);
    const allowed=await db.query(
     "SELECT 1 FROM luemi_private.beta_invites "+
     "WHERE environment=$1 AND telegram_id=$2 AND state='active'",
     [cfg.namespace,String(verified.user.id)]);
    if(allowed.rowCount!==1){
     await db.query("ROLLBACK");
     return reply.code(403).send({error:"invitation_required"});
    }
   }
   if(cfg.maxNewActors!==undefined){
    // Admission must be serialized for the WHOLE namespace, not per user,
    // to stop concurrent distinct Telegram logins exceeding the quota.
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
     [cfg.namespace+":self-service-admission"]);
    const existing=await db.query(
     "SELECT id FROM luemi_private.actors WHERE environment=$1 AND telegram_id=$2",
     [cfg.namespace,String(verified.user.id)]);
    if(existing.rowCount===0){
     const count=await db.query<{count:string}>(
      "SELECT count(*)::text AS count FROM luemi_private.actors WHERE environment=$1",
      [cfg.namespace]);
     if(Number(count.rows[0]?.count??NaN)>=cfg.maxNewActors){
      await db.query("ROLLBACK");
      return reply.code(403).send({error:"test_full"});
     }
    }
   }
   const result=await db.query<{id:string;first_name:string}>(
    "INSERT INTO luemi_private.actors(environment,telegram_id,first_name) VALUES($1,$2,$3) "+
    "ON CONFLICT(environment,telegram_id) DO UPDATE SET updated_at=clock_timestamp() "+
    "WHERE luemi_private.actors.status='active' RETURNING id,first_name",
    [cfg.namespace,String(verified.user.id),verified.user.first_name]);
   if(result.rowCount!==1){await db.query("ROLLBACK");return reply.code(403).send({error:"account_unavailable"});}
   const actor=result.rows[0];
   // Serialize concurrent logins for one Telegram account, without locking
   // different users. This also enforces the active-session upper bound.
   await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [cfg.namespace+":"+actor.id+":auth-bootstrap"]);
   const presented=tokenFrom(req);
   if(presented){
    const priorHash=hash(cfg.pepper,presented);
    const previous=await db.query<{expires_at:string}>(
     "UPDATE luemi_private.sessions SET last_seen_at=clock_timestamp(),"+
     "idle_expires_at=LEAST(absolute_expires_at,clock_timestamp()+($4::bigint * interval '1 millisecond')) "+
     "WHERE actor_id=$1 AND environment=$2 AND token_hash=$3 AND revoked_at IS NULL "+
     "AND idle_expires_at>clock_timestamp() AND absolute_expires_at>clock_timestamp() "+
     "RETURNING absolute_expires_at AS expires_at",
     [actor.id,cfg.namespace,priorHash,cfg.idleMs]);
    if(previous.rowCount===1){
     await db.query("COMMIT");
     return{mode:"session_v2",user:{id:actor.id,firstName:actor.first_name},
      csrfToken:csrf(cfg.pepper,priorHash),expiresAt:previous.rows[0].expires_at};
    }
   }
   const counted=await db.query<{count:string}>(
    "SELECT count(*)::text AS count FROM luemi_private.sessions WHERE actor_id=$1 AND environment=$2 "+
    "AND revoked_at IS NULL AND idle_expires_at>clock_timestamp() AND absolute_expires_at>clock_timestamp()",
    [actor.id,cfg.namespace]);
   if(Number(counted.rows[0].count)>=cfg.maxSessions){
    // Ordinary returning users must not be permanently locked out after
    // relaunching Telegram five times. Retire the least-recent session under
    // this actor's advisory lock, then create one fresh session atomically.
    const retired=await db.query(
     "UPDATE luemi_private.sessions SET revoked_at=clock_timestamp() "+
     "WHERE id=(SELECT id FROM luemi_private.sessions WHERE actor_id=$1 AND environment=$2 "+
     "AND revoked_at IS NULL AND idle_expires_at>clock_timestamp() "+
     "AND absolute_expires_at>clock_timestamp() "+
     "ORDER BY last_seen_at ASC,created_at ASC,id ASC LIMIT 1 FOR UPDATE) RETURNING id",
     [actor.id,cfg.namespace]);
    if(retired.rowCount!==1){
     await db.query("ROLLBACK");return deny(reply,503);
    }
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
  const s=req.authActor!;
  const db=await roleClient(scoped,"luemi_request");
  if(!db)return deny(reply,503);
  try{
   await db.query("BEGIN");
   await db.query("SELECT set_config('luemi.actor_id',$1,true)",[s.actorId]);
   const result=await db.query<{id:string}>(
    "SELECT id FROM luemi_private.actors WHERE id=$1 AND environment=$2 AND status='active'",
    [s.actorId,cfg.namespace]);
   await db.query("COMMIT");
   if(result.rowCount!==1)return deny(reply);
   // Recheck revocation/rotation after the DB read, not only at the request
   // entry: a concurrent logout must not authorize an already revoked result.
   const current=await inspect(req);
   if(!("value" in current))return deny(reply,current.status);
   if(current.value.sessionId!==s.sessionId||current.value.actorId!==s.actorId||
      !timingSafeEqual(current.value.hash,s.hash))return deny(reply);
   return{id:result.rows[0].id,capabilities:{draftSync:false,publish:false,mediaUpload:false,
    matches:false,chats:false,bliki:false,payments:false}};
  }catch{await db.query("ROLLBACK").catch(()=>{});return deny(reply,503);}
  finally{db.release();}
 });
 app.post("/api/v2/auth/refresh",{preHandler:protectedMutation},async(req,reply)=>{
  const s=req.authActor!,db=await roleClient(issuer,"luemi_auth_issuer");
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
  const db=await roleClient(issuer,"luemi_auth_issuer");
  if(!db)return deny(reply,503);
  try{
   // Match the exact token generation: a stale logout must not revoke a freshly
   // rotated generation on the same session id.
   const changed=await db.query("UPDATE luemi_private.sessions SET revoked_at=clock_timestamp() "+
    "WHERE id=$1 AND actor_id=$2 AND token_hash=$3 AND environment=$4 AND revoked_at IS NULL",
    [req.authActor!.sessionId,req.authActor!.actorId,req.authActor!.hash,cfg.namespace]);
   if(changed.rowCount!==1)return deny(reply);
   reply.header("Set-Cookie",cookie("",0));return{ok:true};
  }catch{return deny(reply,503);}finally{db.release();}
 });
 // Destructive-to-access action: broad revocation is withheld until a separate,
 // owner-ratified step-up confirmation policy exists. A valid cookie+CSRF is
 // NOT sufficient proof of recent user intent; initData replay is still possible.
 app.post("/api/v2/auth/logout-all",{preHandler:protectedMutation},async(_req,reply)=>{
  return reply.code(403).send({error:"additional_confirmation_required"});
 });
 return {read:authenticated,geoRead:protectedGeoRead,mutation:protectedMutation};
}
