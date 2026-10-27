import {Pool} from "pg";
import type {PoolClient} from "pg";
import type {FastifyInstance,FastifyReply,FastifyRequest} from "fastify";

export interface MatchOptions {enabled:true;databaseUrl:string;namespace:string;}
type Guard={read:(req:FastifyRequest,reply:FastifyReply)=>Promise<void>;
 mutation:(req:FastifyRequest,reply:FastifyReply)=>Promise<void>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class MatchError extends Error{constructor(readonly status:number,readonly code:string){super(code);}}
function reject(status:number,code:string):never{throw new MatchError(status,code);}
const validId=(value:unknown):value is string=>typeof value==="string"&&uuid.test(value);

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
    AND has_table_privilege(current_user,'luemi_chats.matches','INSERT')
    AND has_table_privilege(current_user,'luemi_chats.conversations','SELECT')
    AND has_column_privilege(current_user,'luemi_chats.conversations','private_match_id','INSERT')
    AND has_table_privilege(current_user,'luemi_chats.members','INSERT')
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
       'luemi_chats.members'::regclass,'luemi_chats.conversations'::regclass))
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
 app.post<{Body:{targetId?:unknown}}>("/api/v4/matches/like",
 {preHandler:auth.mutation},(req,reply)=>transaction(req,reply,async(db,actor)=>{
  const target=req.body?.targetId;
  if(!validId(target)||target===actor)reject(422,"invalid_target");
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
  const existing=await db.query("SELECT 1 FROM luemi_chats.likes WHERE environment=$3 AND sender_id=$1 AND receiver_id=$2",
   [actor,target,cfg.namespace]);
  if(!existing.rowCount){
   const quota=await db.query<{total:string}>(`SELECT count(*)::text AS total FROM luemi_chats.likes
    WHERE sender_id=$1 AND environment=$2 AND created_at>=date_trunc('day',now())`,
    [actor,cfg.namespace]);
   if(Number(quota.rows[0]?.total??0)>=15)reject(429,"daily_like_limit");
   await db.query("INSERT INTO luemi_chats.likes(environment,sender_id,receiver_id) VALUES($3,$1,$2) ON CONFLICT DO NOTHING",
    [actor,target,cfg.namespace]);
  }
  const reciprocal=await db.query("SELECT 1 FROM luemi_chats.likes WHERE environment=$3 AND sender_id=$2 AND receiver_id=$1",
   [actor,target,cfg.namespace]);
  if(!reciprocal.rowCount)return {liked:true,matched:false};
  await db.query(`INSERT INTO luemi_chats.matches(environment,actor_low,actor_high)
    VALUES($3,$1,$2) ON CONFLICT DO NOTHING`,[left,right,cfg.namespace]);
  const match=await db.query<{id:string}>(`SELECT id FROM luemi_chats.matches
   WHERE environment=$3 AND actor_low=$1 AND actor_high=$2 AND status='active'`,
   [left,right,cfg.namespace]);
  if(match.rowCount!==1)return {liked:true,matched:false};
  await db.query(`INSERT INTO luemi_chats.conversations(environment,private_match_id)
   VALUES($2,$1) ON CONFLICT DO NOTHING`,[match.rows[0].id,cfg.namespace]);
  const conversation=await db.query<{id:string}>(`SELECT id FROM luemi_chats.conversations
   WHERE environment=$2 AND private_match_id=$1`,[match.rows[0].id,cfg.namespace]);
  if(conversation.rowCount!==1)reject(503,"service_unavailable");
  await db.query(`INSERT INTO luemi_chats.members(conversation_id,actor_id,environment)
   VALUES($1,$2,$4),($1,$3,$4) ON CONFLICT DO NOTHING`,
   [conversation.rows[0].id,left,right,cfg.namespace]);
  return {liked:true,matched:true,conversationId:conversation.rows[0].id};
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
