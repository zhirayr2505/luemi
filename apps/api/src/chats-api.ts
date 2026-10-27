import {Pool} from "pg";
import type {PoolClient} from "pg";
import type {FastifyInstance,FastifyReply,FastifyRequest} from "fastify";

export interface ChatOptions {enabled:true;databaseUrl:string;namespace:string;}
type Guard={read:(req:FastifyRequest,reply:FastifyReply)=>Promise<void>;
 mutation:(req:FastifyRequest,reply:FastifyReply)=>Promise<void>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId=(v:unknown):v is string=>typeof v==="string"&&uuid.test(v);
const validBody=(v:unknown):v is string=>typeof v==="string"&&v.trim()===v&&[...v].length>0&&[...v].length<=4000;
class ChatError extends Error{constructor(readonly status:number,readonly code:string){super(code);}}
function deny(status:number,code:string):never{throw new ChatError(status,code);}
export function registerChats(app:FastifyInstance,guard:Guard|undefined,cfg:ChatOptions|undefined):void{
 if(!cfg?.enabled)return;
 if(!guard||!cfg.databaseUrl||!/^[a-z0-9:_-]{1,96}$/i.test(cfg.namespace))
  throw new Error("Chats require V2 auth, namespace and dedicated database role");
 const auth=guard;
 const options=cfg;
 const pool=new Pool({connectionString:options.databaseUrl,max:5,connectionTimeoutMillis:3000,
  statement_timeout:3000,query_timeout:4000});
 app.addHook("onClose",async()=>pool.end());
 async function scoped<T>(req:FastifyRequest,reply:FastifyReply,fn:(db:PoolClient,actor:string)=>Promise<T>):Promise<T|FastifyReply>{
  const actor=req.authActor;
  if(reply.sent||!actor)return reply;
  const db=await pool.connect().catch(()=>null);
  if(!db)return reply.code(503).send({error:"service_unavailable"});
  try{
   // Reject privileged, cross-role or table-owning database connections.
   await db.query("BEGIN");
   await db.query("SELECT set_config('luemi.actor_id',$1,true)",[actor.actorId]);
   await db.query("SELECT set_config('luemi.environment',$1,true)",[options.namespace]);
   const role=await db.query<{safe:boolean}>(`SELECT
    (r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole
    AND NOT r.rolcreatedb AND session_user=current_user
    AND current_setting('row_security')='on'
    AND NOT pg_has_role(current_user,'pg_read_all_data','member')
    AND NOT pg_has_role(current_user,'pg_write_all_data','member')
    AND NOT has_schema_privilege(current_user,'luemi_chats','CREATE')
    AND NOT has_table_privilege(current_user,'luemi_chats.members','INSERT')
    AND NOT has_column_privilege(current_user,'luemi_chats.members','actor_id','UPDATE')
    AND NOT has_column_privilege(current_user,'luemi_chats.members','conversation_id','UPDATE')
    AND NOT has_column_privilege(current_user,'luemi_chats.members','environment','UPDATE')
    AND has_column_privilege(current_user,'luemi_chats.members','last_read_at','UPDATE')
    AND has_table_privilege(current_user,'luemi_chats.messages','SELECT')
    AND has_table_privilege(current_user,'luemi_chats.messages','INSERT')
    AND has_column_privilege(current_user,'luemi_chats.messages','body','UPDATE')
    AND has_column_privilege(current_user,'luemi_chats.messages','edited_at','UPDATE')
    AND has_column_privilege(current_user,'luemi_chats.messages','deleted_at','UPDATE')
    AND NOT has_column_privilege(current_user,'luemi_chats.messages','sender_id','UPDATE')
    AND NOT has_column_privilege(current_user,'luemi_chats.messages','conversation_id','UPDATE')
    AND NOT has_column_privilege(current_user,'luemi_chats.messages','environment','UPDATE')
    AND NOT has_column_privilege(current_user,'luemi_chats.messages','client_id','UPDATE')
    AND NOT has_column_privilege(current_user,'luemi_chats.messages','created_at','UPDATE')
    AND NOT has_table_privilege(current_user,'luemi_chats.messages','DELETE')
    AND NOT has_table_privilege(current_user,'luemi_chats.members','DELETE')
    AND NOT has_table_privilege(current_user,'luemi_chats.conversations','INSERT')
    AND NOT has_table_privilege(current_user,'luemi_chats.conversations','UPDATE')
    AND NOT has_table_privilege(current_user,'luemi_chats.conversations','DELETE')
    AND (SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity
       AND c.relowner<>r.oid AND row_security_active(c.oid))
       FROM pg_class c WHERE c.oid IN
       ('luemi_chats.members'::regclass,'luemi_chats.messages'::regclass))) AS safe
    FROM pg_roles r WHERE r.rolname=current_user`);
   if(role.rowCount!==1||role.rows[0].safe!==true)deny(503,"service_unavailable");
   const result=await fn(db,actor.actorId);
   await auth.read(req,reply);
   if(reply.sent||req.authActor?.actorId!==actor.actorId||
      req.authActor?.sessionId!==actor.sessionId)deny(401,"unauthorized");
   await db.query("COMMIT");
   reply.header("Cache-Control","private, no-store");
   return result;
  }catch(e){
   await db.query("ROLLBACK").catch(()=>{});
   if(reply.sent)return reply;
   if(e instanceof ChatError)return reply.code(e.status).send({error:e.code});
   return reply.code(503).send({error:"service_unavailable"});
  }finally{db.release();}
 }
 async function member(db:PoolClient,conversationId:string,actor:string){
  const r=await db.query("SELECT 1 FROM luemi_chats.members WHERE conversation_id=$1 AND actor_id=$2 AND environment=$3",
   [conversationId,actor,options.namespace]);
  if(r.rowCount!==1)deny(404,"not_found");
 }
 app.get("/api/v4/chats/me",{preHandler:auth.read},async(req,reply)=>{
  if(reply.sent||!req.authActor)return reply;
  reply.header("Cache-Control","private, no-store");
  return {actorId:req.authActor.actorId};
 });
 app.get("/api/v4/chats",{preHandler:auth.read},(req,reply)=>scoped(req,reply,async(db,actor)=>{
  const rows=await db.query<{id:string;unread_count:string;last_message:string|null;peer_id:string|null}>(`
   SELECT m.conversation_id AS id,
   (SELECT count(*)::text FROM luemi_chats.messages msg
    WHERE msg.conversation_id=m.conversation_id AND msg.sender_id<>$1
    AND msg.deleted_at IS NULL AND msg.created_at>coalesce(m.last_read_at,'epoch'::timestamptz)) AS unread_count,
   (SELECT msg.body FROM luemi_chats.messages msg
    WHERE msg.conversation_id=m.conversation_id AND msg.deleted_at IS NULL
    ORDER BY msg.created_at DESC,msg.id DESC LIMIT 1) AS last_message,
   NULL::uuid AS peer_id
   FROM luemi_chats.members m WHERE m.actor_id=$1 AND m.environment=$2
   ORDER BY m.conversation_id LIMIT 100`,[actor,options.namespace]);
  return {conversations:rows.rows.map(r=>({id:r.id,peerId:r.peer_id??"",peerName:"",lastMessage:r.last_message,unreadCount:Number(r.unread_count)}))};
 }));
 app.get<{Params:{id:string};Querystring:{before?:string}}>(
 "/api/v4/chats/:id/messages",{preHandler:auth.read},(req,reply)=>scoped(req,reply,async(db,actor)=>{
  if(!validId(req.params.id))deny(404,"not_found");
  if(req.query.before!==undefined&&!validId(req.query.before))deny(422,"invalid_cursor");
  await member(db,req.params.id,actor);
  if(req.query.before){
   const cursor=await db.query("SELECT 1 FROM luemi_chats.messages WHERE id=$1 AND conversation_id=$2 AND environment=$3",[req.query.before,req.params.id,options.namespace]);
   if(cursor.rowCount!==1)deny(422,"invalid_cursor");
  }
  const q=await db.query(`SELECT id,conversation_id AS "conversationId",sender_id AS "senderId",
    CASE WHEN deleted_at IS NULL THEN body ELSE '' END AS body,
    created_at AS "createdAt",edited_at AS "editedAt",deleted_at AS "deletedAt"
    FROM luemi_chats.messages WHERE conversation_id=$1 AND environment=$2
    AND ($3::uuid IS NULL OR (created_at,id)<(
      SELECT created_at,id FROM luemi_chats.messages WHERE id=$3 AND conversation_id=$1))
    ORDER BY created_at DESC,id DESC LIMIT 51`,
   [req.params.id,options.namespace,req.query.before??null]);
  const more=q.rows.length>50;const page=q.rows.slice(0,50);
  const nextCursor=more&&page.length?page[page.length-1].id:null;
  return {messages:page.reverse(),nextCursor};
 }));
 app.post<{Params:{id:string};Body:{body?:unknown;clientId?:unknown}}>(
 "/api/v4/chats/:id/messages",{preHandler:auth.mutation},(req,reply)=>scoped(req,reply,async(db,actor)=>{
  if(!validId(req.params.id))deny(404,"not_found");
  if(!validBody(req.body?.body)||!validId(req.body?.clientId))deny(422,"invalid_message");
  await member(db,req.params.id,actor);
  const q=await db.query(`INSERT INTO luemi_chats.messages(conversation_id,sender_id,environment,client_id,body)
   VALUES($1,$2,$3,$4,$5)
   ON CONFLICT(conversation_id,sender_id,client_id) DO NOTHING RETURNING
   id,conversation_id AS "conversationId",sender_id AS "senderId",body,
   created_at AS "createdAt",edited_at AS "editedAt",deleted_at AS "deletedAt"`,
   [req.params.id,actor,options.namespace,req.body.clientId,req.body.body]);
  if(q.rowCount!==1){
   const existing=await db.query(`SELECT id,conversation_id AS "conversationId",sender_id AS "senderId",body,
   created_at AS "createdAt",edited_at AS "editedAt",deleted_at AS "deletedAt"
   FROM luemi_chats.messages WHERE conversation_id=$1 AND sender_id=$2 AND client_id=$3`,
   [req.params.id,actor,req.body.clientId]);
   if(existing.rowCount!==1||existing.rows[0].body!==req.body.body||existing.rows[0].deletedAt)deny(409,"idempotency_conflict");
   return {message:existing.rows[0]};
  }
  return {message:q.rows[0]};
 }));
 app.post<{Params:{id:string};Body:{messageId?:unknown}}>(
 "/api/v4/chats/:id/read",{preHandler:auth.mutation},(req,reply)=>scoped(req,reply,async(db,actor)=>{
  if(!validId(req.params.id)||!validId(req.body?.messageId))deny(422,"invalid_message");
  await member(db,req.params.id,actor);
  const q=await db.query<{created_at:string}>(`SELECT created_at FROM luemi_chats.messages
   WHERE conversation_id=$1 AND id=$2 AND environment=$3`,
   [req.params.id,req.body.messageId,options.namespace]);
  if(q.rowCount!==1)deny(404,"not_found");
  const updated=await db.query(`UPDATE luemi_chats.members
   SET last_read_at=greatest(coalesce(last_read_at,'epoch'::timestamptz),$4::timestamptz)
   WHERE conversation_id=$1 AND actor_id=$2 AND environment=$3 RETURNING actor_id`,
   [req.params.id,actor,options.namespace,q.rows[0].created_at]);
  if(updated.rowCount!==1)deny(404,"not_found");
  return {read:true as const};
 }));
 app.patch<{Params:{id:string;messageId:string};Body:{body?:unknown}}>(
 "/api/v4/chats/:id/messages/:messageId",{preHandler:auth.mutation},(req,reply)=>scoped(req,reply,async(db,actor)=>{
  if(!validId(req.params.id)||!validId(req.params.messageId))deny(404,"not_found");
  if(!validBody(req.body?.body))deny(422,"invalid_message");
  await member(db,req.params.id,actor);
  const q=await db.query(`UPDATE luemi_chats.messages SET body=$4,edited_at=now()
   WHERE conversation_id=$1 AND id=$2 AND sender_id=$3 AND deleted_at IS NULL
   RETURNING id,conversation_id AS "conversationId",sender_id AS "senderId",body,
   created_at AS "createdAt",edited_at AS "editedAt",deleted_at AS "deletedAt"`,
   [req.params.id,req.params.messageId,actor,req.body.body]);
  if(q.rowCount!==1)deny(404,"not_found");
  return {message:q.rows[0]};
 }));
 app.delete<{Params:{id:string;messageId:string}}>(
 "/api/v4/chats/:id/messages/:messageId",{preHandler:auth.mutation},(req,reply)=>scoped(req,reply,async(db,actor)=>{
  if(!validId(req.params.id)||!validId(req.params.messageId))deny(404,"not_found");
  await member(db,req.params.id,actor);
  const q=await db.query(`UPDATE luemi_chats.messages SET body='',deleted_at=now()
   WHERE conversation_id=$1 AND id=$2 AND sender_id=$3 AND deleted_at IS NULL RETURNING id`,
   [req.params.id,req.params.messageId,actor]);
  if(q.rowCount!==1)deny(404,"not_found");
  return {deleted:true as const};
 }));
}
