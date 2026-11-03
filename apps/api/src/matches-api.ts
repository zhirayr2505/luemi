import {Pool} from "pg";
import type {PoolClient} from "pg";
import type {FastifyInstance,FastifyReply,FastifyRequest} from "fastify";
import {versionedWebAppUrl} from "./telegram-webhook.js";

export interface MatchOptions {
 enabled:true;databaseUrl:string;namespace:string;
 notificationDatabaseUrl?:string;botToken?:string;origin?:string;
}
type Guard={read:(req:FastifyRequest,reply:FastifyReply)=>Promise<void>;
 mutation:(req:FastifyRequest,reply:FastifyReply)=>Promise<void>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class MatchError extends Error{constructor(readonly status:number,readonly code:string){super(code);}}
function reject(status:number,code:string):never{throw new MatchError(status,code);}
const validId=(value:unknown):value is string=>typeof value==="string"&&uuid.test(value);
type ReactionKind="like"|"super_like"|"photo_fire";
const validReaction=(value:unknown):value is ReactionKind=>
 value==="like"||value==="super_like"||value==="photo_fire";
type LikeReceipt={liked:true;matched:boolean;kind:ReactionKind;conversationId?:string;notifyReceiverId?:string};

/** New V2 actors and published private profiles are the only source of identity.
 * Never mint matches from client-provided membership or legacy public user UUIDs. */
export function registerMatches(app:FastifyInstance,guard:Guard|undefined,opts:MatchOptions|undefined):void{
 if(!opts?.enabled)return;
 if(!guard||!opts.databaseUrl||!/^[a-z0-9:_-]{1,96}$/i.test(opts.namespace))
  throw new Error("Mutual matches require V2 sessions and dedicated matching database role");
 const auth=guard,cfg=opts;
 const pool=new Pool({connectionString:cfg.databaseUrl,max:4,connectionTimeoutMillis:3000,
  statement_timeout:3500,query_timeout:4500});
 app.addHook("onClose",async()=>pool.end());
 const notificationPool=cfg.notificationDatabaseUrl&&cfg.botToken&&cfg.origin?
  new Pool({connectionString:cfg.notificationDatabaseUrl,max:2,connectionTimeoutMillis:3000,
   statement_timeout:2500,query_timeout:3500}):null;
 app.addHook("onClose",async()=>notificationPool?.end());
 const sendLikeNotification=async(receiverId:string,kind:ReactionKind)=>{
  if(!notificationPool||!cfg.botToken||!cfg.origin)return;
  try{
   const target=await notificationPool.query<{telegram_id:string}>(
    "SELECT telegram_id::text FROM luemi_private.actors WHERE id=$1 AND environment=$2 AND status='active'",
    [receiverId,cfg.namespace]);
   const chatId=target.rows[0]?.telegram_id;
   if(!chatId)return;
   await fetch("https://api.telegram.org/bot"+cfg.botToken+"/sendMessage",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
     chat_id:chatId,
     text:kind==="super_like"?"Тебе отправили суперлайк в LUEMI ✨\nОткрой приложение, чтобы посмотреть кто.":
      kind==="photo_fire"?"На твоё фото отправили огонёк в LUEMI 🔥\nОткрой приложение, чтобы посмотреть кто.":
      "Тебе поставили симпатию в LUEMI 💜\nОткрой приложение, чтобы посмотреть кто.",
     reply_markup:{inline_keyboard:[[{text:"Открыть LUEMI 💜",
      web_app:{url:versionedWebAppUrl(cfg.origin,process.env.RENDER_GIT_COMMIT,"likes")}}]]}
    })
   });
  }catch{/* A Telegram outage must never roll back a committed like. */}
 };
 async function transaction<T>(req:FastifyRequest,reply:FastifyReply,
  action:(db:PoolClient,actor:string)=>Promise<T>):Promise<T|FastifyReply>{
  const actor=req.authActor;
  if(reply.sent||!actor)return reply;
  const db=await pool.connect().catch(()=>null);
  if(!db)return reply.code(503).send({error:"service_unavailable"});
  try{
   await db.query("BEGIN");
   await db.query("SELECT set_config('luemi.actor_id',$1,true)",[actor.actorId]);
   await db.query("SELECT set_config('luemi.environment',$1,true)",[cfg.namespace]);
   // Validate the exact checkout. A database owner / service role must never
   // become the HTTP matching principal even if environment keys are confused.
   const role=await db.query<{safe:boolean}>(`SELECT
    (r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls
    AND NOT r.rolcreaterole AND NOT r.rolcreatedb AND current_user=session_user
    AND pg_has_role(current_user,'luemi_match_writer','member')
    AND NOT pg_has_role(current_user,'luemi_chats_writer','member')
    AND NOT pg_has_role(current_user,'luemi_auth_issuer','member')
    AND NOT pg_has_role(current_user,'luemi_request','member')
    AND NOT pg_has_role(current_user,'pg_read_all_data','member')
    AND NOT pg_has_role(current_user,'pg_write_all_data','member')
    AND current_setting('row_security')='on'
    AND NOT has_schema_privilege(current_user,'luemi_chats','CREATE')
    AND NOT has_schema_privilege(current_user,'luemi_private','CREATE')
    AND has_table_privilege(current_user,'luemi_chats.likes','INSERT')
    AND has_column_privilege(current_user,'luemi_chats.likes','kind','UPDATE')
    AND has_column_privilege(current_user,'luemi_chats.likes','media_asset_id','UPDATE')
    AND has_column_privilege(current_user,'luemi_chats.likes','created_at','UPDATE')
    AND has_column_privilege(current_user,'luemi_private.media_assets','id','SELECT')
    AND has_table_privilege(current_user,'luemi_chats.matches','INSERT')
    AND has_table_privilege(current_user,'luemi_chats.conversations','SELECT')
    AND has_column_privilege(current_user,'luemi_chats.conversations','private_match_id','INSERT')
    AND has_column_privilege(current_user,'luemi_chats.members','actor_id','INSERT')
    AND NOT has_table_privilege(current_user,'luemi_chats.messages','INSERT')
    AND NOT has_table_privilege(current_user,'luemi_private.sessions','SELECT')
    AND NOT has_table_privilege(current_user,'luemi_private.public_profiles','UPDATE')
    AND NOT has_table_privilege(current_user,'luemi_private.actors','UPDATE')
    AND NOT has_table_privilege(current_user,'luemi_private.blocks','INSERT')
    AND NOT has_table_privilege(current_user,'luemi_private.blocks','DELETE')
    AND (SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity
      AND c.relowner<>r.oid AND row_security_active(c.oid))
     FROM pg_class c WHERE c.oid IN
      ('luemi_chats.likes'::regclass,'luemi_chats.matches'::regclass,
       'luemi_chats.members'::regclass,'luemi_chats.conversations'::regclass,
       'luemi_private.media_assets'::regclass))
    ) AS safe FROM pg_roles r WHERE r.rolname=current_user`);
   if(role.rowCount!==1||role.rows[0].safe!==true)reject(503,"service_unavailable");
   const result=await action(db,actor.actorId);
   // A revoked Telegram session may not commit a match or like.
   await auth.read(req,reply);
   if(reply.sent||req.authActor?.actorId!==actor.actorId||
      req.authActor?.sessionId!==actor.sessionId||
      !req.authActor?.hash.equals(actor.hash))reject(401,"unauthorized");
   await db.query("COMMIT");
   reply.header("Cache-Control","private, no-store");
   return result;
  }catch(error){
   await db.query("ROLLBACK").catch(()=>{});
   if(reply.sent)return reply;
   if(error instanceof MatchError)return reply.code(error.status).send({error:error.code});
   return reply.code(503).send({error:"service_unavailable"});
  }finally{db.release();}
 }
 const createReaction=async(db:PoolClient,actor:string,target:unknown,kind:unknown,photoId:unknown):Promise<LikeReceipt>=>{
  if(!validId(target)||target===actor)reject(422,"invalid_target");
  if(!validReaction(kind)||kind==="photo_fire"&&!validId(photoId)||kind!=="photo_fire"&&photoId!==undefined)
   reject(422,"invalid_reaction");
  // Lock the sender's daily quota across concurrent devices. Pair order is
  // canonical UUID order, so opposite likes serialize without deadlocking.
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,62015))",[actor]);
  const [left,right]=[actor,target].sort();
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,62016))",[left+":"+right]);
  const eligible=await db.query(`SELECT p.owner_id FROM luemi_private.public_profiles p
   JOIN luemi_private.actors a ON a.id=p.owner_id AND a.environment=p.environment
   WHERE p.environment=$3 AND p.publication_status='published' AND a.status='active'
   AND p.owner_id IN ($1,$2)`,[actor,target,cfg.namespace]);
  if(eligible.rowCount!==2)reject(404,"not_found");
  const blocked=await db.query(`SELECT 1 FROM luemi_private.blocks
   WHERE environment=$3 AND ((blocker_id=$1 AND blocked_id=$2)
   OR (blocker_id=$2 AND blocked_id=$1)) LIMIT 1`,[actor,target,cfg.namespace]);
  if(blocked.rowCount)reject(404,"not_found");
  if(kind==="photo_fire"){
   const photo=await db.query(`SELECT id FROM luemi_private.media_assets
    WHERE id=$1 AND owner_id=$2 AND environment=$3 AND state='approved'
    AND publication_status='published'`,[photoId,target,cfg.namespace]);
   if(photo.rowCount!==1)reject(404,"photo_not_found");
  }
  const existing=await db.query<{kind:ReactionKind;media_asset_id:string|null}>(
   "SELECT kind,media_asset_id FROM luemi_chats.likes WHERE environment=$3 AND sender_id=$1 AND receiver_id=$2",
   [actor,target,cfg.namespace]);
	  let changed=false;
  if(!existing.rowCount){
   const quota=await db.query<{total:string}>(`SELECT count(*)::text AS total FROM luemi_chats.likes
    WHERE sender_id=$1 AND environment=$2 AND created_at>=date_trunc('day',now())`,
    [actor,cfg.namespace]);
   if(Number(quota.rows[0]?.total??0)>=15)reject(429,"daily_like_limit");
	   if(kind==="super_like"){
	    const special=await db.query<{total:string}>(`SELECT count(*)::text AS total FROM luemi_chats.likes
	     WHERE sender_id=$1 AND environment=$2 AND kind='super_like'
	     AND created_at>=date_trunc('day',now())`,[actor,cfg.namespace]);
	    if(Number(special.rows[0]?.total??0)>=3)reject(429,"daily_super_like_limit");
	   }
	   const created=await db.query(`INSERT INTO luemi_chats.likes
	    (environment,sender_id,receiver_id,kind,media_asset_id) VALUES($3,$1,$2,$4,$5)
	    ON CONFLICT DO NOTHING RETURNING sender_id`,
	    [actor,target,cfg.namespace,kind,kind==="photo_fire"?photoId:null]);
	   changed=created.rowCount===1;
	  }else if(existing.rows[0].kind!==kind||existing.rows[0].media_asset_id!==(kind==="photo_fire"?photoId:null)){
	   if(kind==="super_like"){
	    const special=await db.query<{total:string}>(`SELECT count(*)::text AS total FROM luemi_chats.likes
	     WHERE sender_id=$1 AND environment=$2 AND kind='super_like' AND receiver_id<>$3
	     AND created_at>=date_trunc('day',now())`,[actor,cfg.namespace,target]);
	    if(Number(special.rows[0]?.total??0)>=3)reject(429,"daily_super_like_limit");
	   }
	   const updated=await db.query(`UPDATE luemi_chats.likes SET kind=$4,media_asset_id=$5,
	    created_at=clock_timestamp() WHERE environment=$3 AND sender_id=$1 AND receiver_id=$2`,
	    [actor,target,cfg.namespace,kind,kind==="photo_fire"?photoId:null]);
	   changed=updated.rowCount===1;
  }
  const reciprocal=await db.query("SELECT 1 FROM luemi_chats.likes WHERE environment=$3 AND sender_id=$2 AND receiver_id=$1",
   [actor,target,cfg.namespace]);
	  if(!reciprocal.rowCount)return {liked:true,matched:false,kind,notifyReceiverId:changed?target:undefined};
  await db.query(`INSERT INTO luemi_chats.matches(environment,actor_low,actor_high)
    VALUES($3,$1,$2) ON CONFLICT DO NOTHING`,[left,right,cfg.namespace]);
  const match=await db.query<{id:string}>(`SELECT id FROM luemi_chats.matches
   WHERE environment=$3 AND actor_low=$1 AND actor_high=$2 AND status='active'`,
   [left,right,cfg.namespace]);
	  if(match.rowCount!==1)return {liked:true,matched:false,kind,notifyReceiverId:changed?target:undefined};
  await db.query(`INSERT INTO luemi_chats.conversations(environment,private_match_id)
   VALUES($2,$1) ON CONFLICT DO NOTHING`,[match.rows[0].id,cfg.namespace]);
  const conversation=await db.query<{id:string}>(`SELECT id FROM luemi_chats.conversations
   WHERE environment=$2 AND private_match_id=$1`,[match.rows[0].id,cfg.namespace]);
  if(conversation.rowCount!==1)reject(503,"service_unavailable");
  await db.query(`INSERT INTO luemi_chats.members(conversation_id,actor_id,environment)
   VALUES($1,$2,$4),($1,$3,$4) ON CONFLICT DO NOTHING`,
   [conversation.rows[0].id,left,right,cfg.namespace]);
	  return {liked:true,matched:true,kind,conversationId:conversation.rows[0].id,
	   notifyReceiverId:changed?target:undefined};
	 };
 const finishReaction=(result:LikeReceipt|FastifyReply,reply:FastifyReply,legacy=false)=>{
  if(reply.sent||!result||typeof result!=="object"||!("liked" in result))return result;
  const receipt=result as LikeReceipt;
  if(receipt.notifyReceiverId)void sendLikeNotification(receipt.notifyReceiverId,receipt.kind);
  const safe={...receipt};
  delete safe.notifyReceiverId;
  if(legacy)return {liked:safe.liked,matched:safe.matched,
   ...(safe.conversationId?{conversationId:safe.conversationId}:{})};
  return safe;
 };
 app.post<{Body:{targetId?:unknown}}>("/api/v4/matches/like",
 {preHandler:auth.mutation},async(req,reply)=>finishReaction(
  await transaction(req,reply,(db,actor)=>createReaction(db,actor,req.body?.targetId,"like",undefined)),reply,true));
 app.post<{Body:{targetId?:unknown;kind?:unknown;photoId?:unknown}}>("/api/v4/matches/react",
 {preHandler:auth.mutation},async(req,reply)=>finishReaction(
  await transaction(req,reply,(db,actor)=>createReaction(db,actor,req.body?.targetId,req.body?.kind,req.body?.photoId)),reply));
 app.get("/api/v4/matches/incoming",{preHandler:auth.read},(req,reply)=>transaction(req,reply,async(db,actor)=>{
	  const rows=await db.query<{id:string;name:string;created_at:string;kind:ReactionKind;
	   media_asset_id:string|null;sender_photo_id:string|null}>(
	   "SELECT l.sender_id AS id,coalesce(p.display_name,'Кто-то') AS name,l.created_at::text,l.kind,l.media_asset_id,sp.id AS sender_photo_id "+
   "FROM luemi_chats.likes l JOIN luemi_private.public_profiles p "+
   "ON p.owner_id=l.sender_id AND p.environment=l.environment AND p.publication_status='published' "+
   "JOIN luemi_private.actors a ON a.id=l.sender_id AND a.environment=l.environment AND a.status='active' "+
	   "LEFT JOIN LATERAL (SELECT m.id FROM luemi_private.media_assets m WHERE m.owner_id=l.sender_id "+
	   "AND m.environment=l.environment AND m.state='approved' AND m.publication_status='published' "+
	   "ORDER BY m.position,m.id LIMIT 1) sp ON true "+
   "WHERE l.environment=$2 AND l.receiver_id=$1 "+
   "ORDER BY l.created_at DESC,l.sender_id DESC LIMIT 100",[actor,cfg.namespace]);
	  return {likes:rows.rows.map(row=>({id:row.id,name:row.name,createdAt:row.created_at,kind:row.kind,
	   senderPhotoUrl:row.sender_photo_id?"/api/v3/discovery/photo/"+row.sender_photo_id:null,
	   photoId:row.media_asset_id,
	   photoUrl:row.media_asset_id?"/api/v3/discovery/photo/"+row.media_asset_id:null}))};
 }));
 app.post<{Params:{id:string}}>("/api/v4/matches/:id/close",
 {preHandler:auth.mutation},(req,reply)=>transaction(req,reply,async(db,actor)=>{
  if(!validId(req.params.id))reject(404,"not_found");
  const current=await db.query<{status:string}>(`SELECT status FROM luemi_chats.matches
   WHERE id=$1 AND environment=$2 AND (actor_low=$3 OR actor_high=$3)`,
   [req.params.id,cfg.namespace,actor]);
  if(current.rowCount!==1)reject(404,"not_found");
  if(current.rows[0].status!=="closed"){
   const closed=await db.query(`UPDATE luemi_chats.matches SET status='closed',closed_at=clock_timestamp()
   WHERE id=$1 AND environment=$2 AND status='active' AND (actor_low=$3 OR actor_high=$3)`,
   [req.params.id,cfg.namespace,actor]);
   if(closed.rowCount!==1)reject(409,"match_changed");
  }
  return {closed:true};
 }));
}
