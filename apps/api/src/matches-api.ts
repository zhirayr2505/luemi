import {Pool} from "pg";
import type {PoolClient} from "pg";
import type {FastifyInstance,FastifyReply,FastifyRequest} from "fastify";
import {versionedWebAppUrl} from "./telegram-webhook.js";

export interface MatchOptions {enabled:true;databaseUrl:string;namespace:string;
 notificationDatabaseUrl?:string;botToken?:string;origin?:string;}
type Guard={read:(req:FastifyRequest,reply:FastifyReply)=>Promise<void>;
 mutation:(req:FastifyRequest,reply:FastifyReply)=>Promise<void>};
type LikeKind="ordinary"|"super";
type LikeReceipt={liked:true;kind:LikeKind;matched:boolean;matchId?:string;
 superlikes:Wallet;notifyReceiverId?:string;notification?:"like"|"super"|"match"};
type Wallet={weekly:number;purchased:number;total:number;renewsAt:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId=(value:unknown):value is string=>typeof value==="string"&&uuid.test(value);
class MatchError extends Error{constructor(readonly status:number,readonly code:string){super(code);}}
function reject(status:number,code:string):never{throw new MatchError(status,code);}

/** Monday 00:00 UTC is the single server boundary. Purchased credits never
 * participate in this refill and therefore never expire on Monday. */
async function readWallet(db:PoolClient,actor:string,environment:string):Promise<Wallet>{
 const current=await db.query<{premium:boolean;week_started:string;next_week:string}>(`SELECT
  EXISTS(SELECT 1 FROM luemi_chats.premium_entitlements e
   WHERE e.environment=$2 AND e.actor_id=$1 AND e.active_until>clock_timestamp()) AS premium,
  date_trunc('week',timezone('UTC',clock_timestamp()))::date::text AS week_started,
  ((date_trunc('week',timezone('UTC',clock_timestamp()))+interval '7 days') AT TIME ZONE 'UTC')::text AS next_week`,
  [actor,environment]);
 const cap=current.rows[0]?.premium?7:3,week=current.rows[0]?.week_started;
 if(!week)reject(503,"service_unavailable");
 await db.query(`INSERT INTO luemi_chats.superlike_wallets
  (environment,actor_id,week_started,weekly_remaining,weekly_cap,purchased_remaining)
  VALUES($2,$1,$3,$4,$4,0) ON CONFLICT DO NOTHING`,[actor,environment,week,cap]);
 await db.query(`UPDATE luemi_chats.superlike_wallets SET
  weekly_remaining=CASE WHEN week_started<>$3::date THEN $4
    WHEN weekly_cap=3 AND $4=7 THEN 7 ELSE weekly_remaining END,
  weekly_cap=CASE WHEN week_started<>$3::date THEN $4
    WHEN weekly_cap=3 AND $4=7 THEN 7 ELSE weekly_cap END,
  week_started=CASE WHEN week_started<>$3::date THEN $3::date ELSE week_started END,
  updated_at=clock_timestamp() WHERE environment=$2 AND actor_id=$1`,[actor,environment,week,cap]);
 const row=await db.query<{weekly_remaining:number;purchased_remaining:number}>(
  "SELECT weekly_remaining,purchased_remaining FROM luemi_chats.superlike_wallets WHERE actor_id=$1 AND environment=$2 FOR UPDATE",
  [actor,environment]);
 if(row.rowCount!==1)reject(503,"service_unavailable");
 const weekly=Number(row.rows[0].weekly_remaining),purchased=Number(row.rows[0].purchased_remaining);
 return {weekly,purchased,total:weekly+purchased,renewsAt:new Date(current.rows[0].next_week).toISOString()};
}

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
 const notify=async(receiverId:string,type:"like"|"super"|"match")=>{
  if(!notificationPool||!cfg.botToken||!cfg.origin)return;
  try{
   const target=await notificationPool.query<{telegram_id:string}>(
    "SELECT telegram_id::text FROM luemi_private.actors WHERE id=$1 AND environment=$2 AND status='active'",
    [receiverId,cfg.namespace]);
   const chatId=target.rows[0]?.telegram_id;if(!chatId)return;
   const text=type==="match"?"У вас взаимная симпатия в LUEMI 💜\nСамое время начать знакомство.":
    type==="super"?"Тебе отправили особенную симпатию в LUEMI 💜\nОна уже ждёт тебя в разделе симпатий.":
    "Тебе поставили симпатию в LUEMI 💜\nОткрой приложение, чтобы посмотреть кто.";
   await fetch("https://api.telegram.org/bot"+cfg.botToken+"/sendMessage",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:chatId,text,
     reply_markup:{inline_keyboard:[[{text:type==="match"?"Открыть матчи 💜":"Посмотреть симпатии 💜",
      web_app:{url:versionedWebAppUrl(cfg.origin,process.env.RENDER_GIT_COMMIT,type==="match"?"chats":"likes")}}]]}})
   });
  }catch{/* Notification delivery never rolls back the committed product event. */}
 };
 async function transaction<T>(req:FastifyRequest,reply:FastifyReply,
  action:(db:PoolClient,actor:string)=>Promise<T>):Promise<T|FastifyReply>{
  const actor=req.authActor;if(reply.sent||!actor)return reply;
  const db=await pool.connect().catch(()=>null);
  if(!db)return reply.code(503).send({error:"service_unavailable"});
  try{
   await db.query("BEGIN");
   await db.query("SELECT set_config('luemi.actor_id',$1,true)",[actor.actorId]);
   await db.query("SELECT set_config('luemi.environment',$1,true)",[cfg.namespace]);
   const role=await db.query<{safe:boolean}>(`SELECT
    (r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole
    AND NOT r.rolcreatedb AND current_user=session_user
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
    AND has_table_privilege(current_user,'luemi_chats.matches','INSERT')
    AND has_table_privilege(current_user,'luemi_chats.superlike_wallets','INSERT')
    AND has_column_privilege(current_user,'luemi_chats.superlike_wallets','weekly_remaining','UPDATE')
    AND NOT has_table_privilege(current_user,'luemi_chats.messages','INSERT')
    AND NOT has_table_privilege(current_user,'luemi_private.sessions','SELECT')
    AND NOT has_table_privilege(current_user,'luemi_private.public_profiles','UPDATE')
    AND (SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity
      AND c.relowner<>r.oid AND row_security_active(c.oid)) FROM pg_class c WHERE c.oid IN
      ('luemi_chats.likes'::regclass,'luemi_chats.matches'::regclass,
       'luemi_chats.superlike_wallets'::regclass,'luemi_chats.premium_entitlements'::regclass,
       'luemi_chats.match_views'::regclass,'luemi_chats.incoming_like_reveals'::regclass))
    ) AS safe FROM pg_roles r WHERE r.rolname=current_user`);
   if(role.rowCount!==1||role.rows[0].safe!==true)reject(503,"service_unavailable");
   const result=await action(db,actor.actorId);
   await auth.read(req,reply);
   if(reply.sent||req.authActor?.actorId!==actor.actorId||req.authActor?.sessionId!==actor.sessionId||
      !req.authActor?.hash.equals(actor.hash))reject(401,"unauthorized");
   await db.query("COMMIT");reply.header("Cache-Control","private, no-store");return result;
  }catch(error){await db.query("ROLLBACK").catch(()=>{});if(reply.sent)return reply;
   if(error instanceof MatchError)return reply.code(error.status).send({error:error.code});
   return reply.code(503).send({error:"service_unavailable"});
  }finally{db.release();}
 }

 app.get("/api/v4/matches/superlikes",{preHandler:auth.read},
  (req,reply)=>transaction(req,reply,(db,actor)=>readWallet(db,actor,cfg.namespace)));

 app.post<{Body:{targetId?:unknown;kind?:unknown}}>("/api/v4/matches/like",
 {preHandler:auth.mutation},async(req,reply)=>{
  const result=await transaction(req,reply,async(db,actor):Promise<LikeReceipt>=>{
   const target=req.body?.targetId,kind=req.body?.kind??"ordinary";
   if(!validId(target)||target===actor)reject(422,"invalid_target");
   if(kind!=="ordinary"&&kind!=="super")reject(422,"invalid_like_kind");
   await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,62015))",[actor]);
   const [left,right]=[actor,target].sort();
   await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,62016))",[left+":"+right]);
   const eligible=await db.query(`SELECT p.owner_id FROM luemi_private.public_profiles p
    JOIN luemi_private.actors a ON a.id=p.owner_id AND a.environment=p.environment
    WHERE p.environment=$3 AND p.publication_status='published' AND a.status='active'
    AND p.owner_id IN ($1,$2)`,[actor,target,cfg.namespace]);
   if(eligible.rowCount!==2)reject(404,"not_found");
   const blocked=await db.query(`SELECT 1 FROM luemi_private.blocks WHERE environment=$3
    AND ((blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)) LIMIT 1`,
    [actor,target,cfg.namespace]);
   if(blocked.rowCount)reject(404,"not_found");
   const balance=await readWallet(db,actor,cfg.namespace);
   const existing=await db.query<{kind:LikeKind;status:string}>(`SELECT kind,status FROM luemi_chats.likes
    WHERE environment=$3 AND sender_id=$1 AND receiver_id=$2`,[actor,target,cfg.namespace]);
   let changed=false;
   if(!existing.rowCount){
    if(kind==="ordinary"){
     const quota=await db.query<{total:string}>(`SELECT count(*)::text AS total FROM luemi_chats.likes
      WHERE sender_id=$1 AND environment=$2 AND created_at>=date_trunc('day',now())`,[actor,cfg.namespace]);
     if(Number(quota.rows[0]?.total??0)>=15)reject(429,"daily_like_limit");
    }else if(balance.total<1)reject(409,"superlikes_empty");
    const created=await db.query(`INSERT INTO luemi_chats.likes(environment,sender_id,receiver_id,kind)
     VALUES($3,$1,$2,$4) ON CONFLICT DO NOTHING RETURNING sender_id`,[actor,target,cfg.namespace,kind]);
    changed=created.rowCount===1;
   }else if(existing.rows[0].status==="rejected")reject(409,"like_already_answered");
   else if(kind==="super"&&existing.rows[0].kind==="ordinary"){
    if(balance.total<1)reject(409,"superlikes_empty");
    const promoted=await db.query(`UPDATE luemi_chats.likes SET kind='super'
     WHERE environment=$3 AND sender_id=$1 AND receiver_id=$2 AND kind='ordinary' AND status='active'`,
     [actor,target,cfg.namespace]);changed=promoted.rowCount===1;
   }
   if(changed&&kind==="super"){
    const spent=await db.query(`UPDATE luemi_chats.superlike_wallets SET
     weekly_remaining=CASE WHEN weekly_remaining>0 THEN weekly_remaining-1 ELSE weekly_remaining END,
     purchased_remaining=CASE WHEN weekly_remaining>0 THEN purchased_remaining ELSE purchased_remaining-1 END,
     updated_at=clock_timestamp()
     WHERE environment=$2 AND actor_id=$1 AND weekly_remaining+purchased_remaining>0 RETURNING actor_id`,
     [actor,cfg.namespace]);
    if(spent.rowCount!==1)reject(409,"superlikes_empty");
   }
   const reciprocal=await db.query(`SELECT 1 FROM luemi_chats.likes WHERE environment=$3
    AND sender_id=$2 AND receiver_id=$1 AND status='active'`,[actor,target,cfg.namespace]);
   const currentBalance=await readWallet(db,actor,cfg.namespace);
   if(!reciprocal.rowCount)return {liked:true,kind,matched:false,superlikes:currentBalance,
    notifyReceiverId:changed?target:undefined,notification:kind==="super"?"super":"like"};
   await db.query(`INSERT INTO luemi_chats.matches(environment,actor_low,actor_high)
    VALUES($3,$1,$2) ON CONFLICT DO NOTHING`,[left,right,cfg.namespace]);
   const match=await db.query<{id:string}>(`SELECT id FROM luemi_chats.matches
    WHERE environment=$3 AND actor_low=$1 AND actor_high=$2 AND status='active'`,[left,right,cfg.namespace]);
   if(match.rowCount!==1)reject(503,"service_unavailable");
   return {liked:true,kind,matched:true,matchId:match.rows[0].id,superlikes:currentBalance,
    notifyReceiverId:changed?target:undefined,notification:"match"};
  });
  if(reply.sent||!result||typeof result!=="object"||!("liked" in result))return result;
  const receipt=result as LikeReceipt;if(receipt.notifyReceiverId&&receipt.notification)
   void notify(receipt.notifyReceiverId,receipt.notification);
  const safe={...receipt};delete safe.notifyReceiverId;delete safe.notification;return safe;
 });

 app.get("/api/v4/matches/incoming",{preHandler:auth.read},(req,reply)=>transaction(req,reply,async(db,actor)=>{
  const premium=await db.query<{active:boolean}>(`SELECT EXISTS(SELECT 1 FROM luemi_chats.premium_entitlements
   WHERE environment=$2 AND actor_id=$1 AND active_until>clock_timestamp()) AS active`,[actor,cfg.namespace]);
  if(!premium.rows[0]?.active)await db.query(`INSERT INTO luemi_chats.incoming_like_reveals
   (environment,receiver_id,sender_id)
   SELECT candidate.environment,candidate.receiver_id,candidate.sender_id FROM luemi_chats.likes candidate
   WHERE candidate.environment=$2 AND candidate.receiver_id=$1 AND candidate.kind='ordinary'
    AND candidate.status='active'
    AND NOT EXISTS(SELECT 1 FROM luemi_chats.matches m WHERE m.environment=candidate.environment
     AND m.status='active' AND m.actor_low=least(candidate.sender_id,candidate.receiver_id)
     AND m.actor_high=greatest(candidate.sender_id,candidate.receiver_id))
    AND NOT EXISTS(SELECT 1 FROM luemi_chats.incoming_like_reveals shown
     WHERE shown.environment=candidate.environment AND shown.receiver_id=$1 AND shown.sender_id=candidate.sender_id)
   ORDER BY md5(candidate.sender_id::text||':'||$1::text)
   LIMIT greatest(0,3-(SELECT count(*) FROM luemi_chats.incoming_like_reveals shown
    JOIN luemi_chats.likes active ON active.environment=shown.environment AND active.receiver_id=shown.receiver_id
     AND active.sender_id=shown.sender_id AND active.status='active' AND active.kind='ordinary'
    WHERE shown.environment=$2 AND shown.receiver_id=$1)) ON CONFLICT DO NOTHING`,[actor,cfg.namespace]);
  const rows=await db.query<{id:string;name:string;created_at:string;kind:LikeKind;photo_id:string|null;revealed:boolean}>(
   `SELECT l.sender_id AS id,coalesce(p.display_name,'Кто-то') AS name,l.created_at::text,l.kind,
    EXISTS(SELECT 1 FROM luemi_chats.incoming_like_reveals shown WHERE shown.environment=l.environment
     AND shown.receiver_id=l.receiver_id AND shown.sender_id=l.sender_id) AS revealed,
    (SELECT photo.id FROM luemi_private.media_assets photo WHERE photo.owner_id=l.sender_id
     AND photo.environment=l.environment AND photo.state='approved' AND photo.publication_status='published'
     ORDER BY photo.position,photo.id LIMIT 1) AS photo_id
    FROM luemi_chats.likes l JOIN luemi_private.public_profiles p
     ON p.owner_id=l.sender_id AND p.environment=l.environment AND p.publication_status='published'
    JOIN luemi_private.actors a ON a.id=l.sender_id AND a.environment=l.environment AND a.status='active'
    WHERE l.environment=$2 AND l.receiver_id=$1 AND l.status='active'
    AND NOT EXISTS(SELECT 1 FROM luemi_chats.matches m WHERE m.environment=l.environment AND m.status='active'
     AND m.actor_low=least(l.sender_id,l.receiver_id) AND m.actor_high=greatest(l.sender_id,l.receiver_id))
    ORDER BY (l.kind='super') DESC,l.created_at,l.sender_id LIMIT 100`,[actor,cfg.namespace]);
  const ordinary=rows.rows.filter(row=>row.kind==="ordinary"&&row.revealed),special=rows.rows.filter(row=>row.kind==="super");
  const visible=premium.rows[0]?.active?rows.rows:[...special,...ordinary];
  return {premium:premium.rows[0]?.active===true,hiddenCount:Math.max(0,rows.rows.length-visible.length),
   likes:visible.map(row=>({id:row.id,name:row.name,createdAt:row.created_at,kind:row.kind,
    photoUrl:row.photo_id?"/api/v3/discovery/photo/"+row.photo_id:null}))};
 }));

 app.post<{Params:{id:string}}>("/api/v4/matches/incoming/:id/reject",
 {preHandler:auth.mutation},(req,reply)=>transaction(req,reply,async(db,actor)=>{
  if(!validId(req.params.id))reject(404,"not_found");
  const result=await db.query(`UPDATE luemi_chats.likes SET status='rejected',responded_at=clock_timestamp()
   WHERE environment=$3 AND sender_id=$1 AND receiver_id=$2 AND status='active' RETURNING sender_id`,
   [req.params.id,actor,cfg.namespace]);
  if(result.rowCount!==1)reject(404,"not_found");return {rejected:true};
 }));

 app.get("/api/v4/matches/new",{preHandler:auth.read},(req,reply)=>transaction(req,reply,async(db,actor)=>{
  const viewer=await db.query<{gender:"man"|"woman"|"other"}>(`SELECT gender FROM luemi_private.public_profiles
   WHERE owner_id=$1 AND environment=$2 AND publication_status='published'`,[actor,cfg.namespace]);
  if(viewer.rowCount!==1)reject(404,"not_found");
  const rows=await db.query<{id:string;peer_id:string;name:string;created_at:string;photo_id:string|null;
   interests:string[];seen:boolean;conversation_id:string|null}>(`SELECT pair.id,
   CASE WHEN pair.actor_low=$1 THEN pair.actor_high ELSE pair.actor_low END AS peer_id,
   peer.display_name AS name,pair.created_at::text,peer.interests,
   EXISTS(SELECT 1 FROM luemi_chats.match_views v WHERE v.match_id=pair.id AND v.actor_id=$1 AND v.environment=$2) AS seen,
   conversation.id AS conversation_id,
   (SELECT photo.id FROM luemi_private.media_assets photo WHERE photo.owner_id=peer.owner_id
    AND photo.environment=$2 AND photo.state='approved' AND photo.publication_status='published'
    ORDER BY photo.position,photo.id LIMIT 1) AS photo_id
   FROM luemi_chats.matches pair
   JOIN luemi_private.public_profiles peer ON peer.owner_id=CASE WHEN pair.actor_low=$1 THEN pair.actor_high ELSE pair.actor_low END
    AND peer.environment=$2 AND peer.publication_status='published'
   LEFT JOIN luemi_chats.conversations conversation ON conversation.private_match_id=pair.id AND conversation.environment=pair.environment
   WHERE pair.environment=$2 AND pair.status='active' AND pair.started_at IS NULL
    AND $1 IN (pair.actor_low,pair.actor_high)
   ORDER BY pair.created_at DESC,pair.id DESC LIMIT 100`,[actor,cfg.namespace]);
  return {viewerGender:viewer.rows[0].gender,matches:rows.rows.map(row=>({id:row.id,peerId:row.peer_id,peerProfileId:row.peer_id,
   peerName:row.name,peerPhotoUrl:row.photo_id?"/api/v3/discovery/photo/"+row.photo_id:null,
   createdAt:row.created_at,interests:row.interests,seen:row.seen,conversationId:row.conversation_id}))};
 }));

 app.post<{Params:{id:string}}>("/api/v4/matches/:id/open",
 {preHandler:auth.mutation},(req,reply)=>transaction(req,reply,async(db,actor)=>{
  if(!validId(req.params.id))reject(404,"not_found");
  const pair=await db.query<{actor_low:string;actor_high:string}>(`SELECT actor_low,actor_high FROM luemi_chats.matches
   WHERE id=$1 AND environment=$2 AND status='active' AND $3 IN (actor_low,actor_high)`,
   [req.params.id,cfg.namespace,actor]);
  if(pair.rowCount!==1)reject(404,"not_found");
  await db.query(`INSERT INTO luemi_chats.match_views(environment,match_id,actor_id)
   VALUES($2,$1,$3) ON CONFLICT(environment,match_id,actor_id) DO UPDATE SET seen_at=clock_timestamp()`,
   [req.params.id,cfg.namespace,actor]);
  await db.query(`INSERT INTO luemi_chats.conversations(environment,private_match_id)
   VALUES($2,$1) ON CONFLICT DO NOTHING`,[req.params.id,cfg.namespace]);
  const conversation=await db.query<{id:string}>(`SELECT id FROM luemi_chats.conversations
   WHERE environment=$2 AND private_match_id=$1`,[req.params.id,cfg.namespace]);
  if(conversation.rowCount!==1)reject(503,"service_unavailable");
  await db.query(`INSERT INTO luemi_chats.members(conversation_id,actor_id,environment)
   VALUES($1,$2,$4),($1,$3,$4) ON CONFLICT DO NOTHING`,
   [conversation.rows[0].id,pair.rows[0].actor_low,pair.rows[0].actor_high,cfg.namespace]);
  return {conversationId:conversation.rows[0].id};
 }));

 app.post<{Params:{id:string}}>("/api/v4/matches/:id/close",
 {preHandler:auth.mutation},(req,reply)=>transaction(req,reply,async(db,actor)=>{
  if(!validId(req.params.id))reject(404,"not_found");
  const current=await db.query<{status:string}>(`SELECT status FROM luemi_chats.matches
   WHERE id=$1 AND environment=$2 AND (actor_low=$3 OR actor_high=$3)`,[req.params.id,cfg.namespace,actor]);
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
