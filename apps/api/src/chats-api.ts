import {Pool} from "pg";
import type {PoolClient} from "pg";
import type {FastifyInstance,FastifyReply,FastifyRequest} from "fastify";
import type {ChatMessageContract,ChatMediaContract} from "@luemi/contracts";
import {chatObjectKey,validateChatImageBytes,type ChatMediaStorage} from "./features/chats/chat-media.js";

export interface ChatOptions {enabled:true;databaseUrl:string;namespace:string;mediaStore?:ChatMediaStorage;}
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
 for(const mime of ["image/jpeg","image/png","image/webp"]){
  app.addContentTypeParser(mime,{parseAs:"buffer",bodyLimit:10*1024*1024},(_req,body,done)=>done(null,body));
 }
 const pool=new Pool({connectionString:options.databaseUrl,max:5,connectionTimeoutMillis:3000,
  statement_timeout:3000,query_timeout:4000});
 app.addHook("onClose",async()=>pool.end());
 async function scoped<T>(req:FastifyRequest,reply:FastifyReply,fn:(db:PoolClient,actor:string,onRollback:(job:()=>Promise<void>)=>void)=>Promise<T>):Promise<T|FastifyReply>{
  const actor=req.authActor;
  if(reply.sent||!actor)return reply;
  const db=await pool.connect().catch(()=>null);
  if(!db)return reply.code(503).send({error:"service_unavailable"});
  const compensations:Array<()=>Promise<void>>=[];
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
    AND has_table_privilege(current_user,'luemi_chats.members','SELECT')
    AND has_table_privilege(current_user,'luemi_chats.media','INSERT')
    AND has_column_privilege(current_user,'luemi_chats.media','message_id','UPDATE')
    AND NOT has_column_privilege(current_user,'luemi_chats.media','owner_id','UPDATE')
    AND NOT has_column_privilege(current_user,'luemi_chats.media','conversation_id','UPDATE')
    AND NOT has_column_privilege(current_user,'luemi_chats.media','object_path','UPDATE')
    AND NOT has_table_privilege(current_user,'luemi_chats.media','DELETE')
    AND NOT has_schema_privilege(current_user,'public','CREATE')
    AND NOT has_table_privilege(current_user,'public.luemi_users','UPDATE')
    AND NOT has_table_privilege(current_user,'public.luemi_users','INSERT')
    AND NOT has_table_privilege(current_user,'public.luemi_users','DELETE')
    AND NOT has_table_privilege(current_user,'public.luemi_matches','UPDATE')
    AND NOT has_table_privilege(current_user,'public.luemi_matches','INSERT')
    AND NOT has_table_privilege(current_user,'public.luemi_matches','DELETE')
    AND NOT has_table_privilege(current_user,'public.luemi_blocks','INSERT')
    AND NOT has_table_privilege(current_user,'public.luemi_blocks','UPDATE')
    AND NOT has_table_privilege(current_user,'public.luemi_blocks','DELETE')
    AND (SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity
       AND c.relowner<>r.oid AND row_security_active(c.oid))
       FROM pg_class c WHERE c.oid IN
       ('luemi_chats.members'::regclass,'luemi_chats.messages'::regclass))) AS safe
    FROM pg_roles r WHERE r.rolname=current_user`);
   if(role.rowCount!==1||role.rows[0].safe!==true)deny(503,"service_unavailable");
   const result=await fn(db,actor.actorId,job=>compensations.push(job));
   await auth.read(req,reply);
   if(reply.sent||req.authActor?.actorId!==actor.actorId||
      req.authActor?.sessionId!==actor.sessionId)deny(401,"unauthorized");
   await db.query("COMMIT");
   compensations.length=0;
   reply.header("Cache-Control","private, no-store");
   return result;
  }catch(e){
   await db.query("ROLLBACK").catch(()=>{});
   for(const compensate of compensations.reverse())await compensate().catch(()=>{});
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
 // SQL predicate is built only with hard-coded aliases, never user input.
 function visibleMessage(alias:"msg"|"m", actorParameter:"$1"|"$3"|"$4"="$1"):string{
  return `NOT EXISTS (
    SELECT 1 FROM luemi_chats.message_visibility hidden
    WHERE hidden.message_id=${alias}.id AND hidden.environment=${alias}.environment
      AND (hidden.scope='everyone' OR hidden.actor_id=${actorParameter})
   ) AND ${alias}.created_at>COALESCE((
    SELECT max(cleared.created_at)
    FROM luemi_chats.conversation_clear_events cleared
    WHERE cleared.conversation_id=${alias}.conversation_id
      AND cleared.environment=${alias}.environment
      AND (cleared.scope='everyone' OR cleared.actor_id=${actorParameter})
   ),'-infinity'::timestamptz)`;
 }
 type MessageRow=Omit<ChatMessageContract,"media">;
 async function hydrate(db:PoolClient,rows:MessageRow[]):Promise<ChatMessageContract[]>{
  if(!rows.length)return [];
  const ids=rows.map(row=>row.id);
  const found=await db.query<{id:string;message_id:string;mime_type:ChatMediaContract["mimeType"];byte_size:number;object_path:string}>(`SELECT media.id,media.message_id,media.mime_type,media.byte_size,media.object_path FROM luemi_chats.media media JOIN luemi_chats.messages msg ON msg.id=media.message_id AND msg.conversation_id=media.conversation_id AND msg.environment=media.environment WHERE media.message_id=ANY($1::uuid[]) AND msg.deleted_at IS NULL ORDER BY media.created_at,media.id`,[ids]);
  const grouped=new Map<string,ChatMediaContract[]>();
  for(const item of found.rows){
   let url:string|null=null;
   if(options.mediaStore){try{url=(await options.mediaStore.signedRead(item.object_path,60)).url;}catch{/* Broken objects remain explicit unavailable media. */}}
   const value:ChatMediaContract={id:item.id,messageId:item.message_id,mimeType:item.mime_type,byteSize:item.byte_size,width:null,height:null,state:url?"ready":"failed",url};
   grouped.set(item.message_id,[...(grouped.get(item.message_id)??[]),value]);
  }
  return rows.map(row=>({...row,media:grouped.get(row.id)??[]}));
 }
 app.get("/api/v4/chats/me",{preHandler:auth.read},async(req,reply)=>{
  if(reply.sent||!req.authActor)return reply;
  reply.header("Cache-Control","private, no-store");
  return {actorId:req.authActor.actorId};
 });
 app.get("/api/v4/chats",{preHandler:auth.read},(req,reply)=>scoped(req,reply,async(db,actor)=>{
  const rows=await db.query<{id:string;match_id:string;unread_count:string;last_message:string|null;last_activity_at:string;
   peer_id:string;peer_name:string;peer_photo_id:string|null}>(`
   SELECT m.conversation_id AS id,pair.id AS match_id,
   CASE WHEN pair.actor_low=$1 THEN pair.actor_high ELSE pair.actor_low END AS peer_id,
   coalesce(peer.display_name,'Удалённый аккаунт') AS peer_name,
   (SELECT photo.id FROM luemi_private.media_assets photo
     WHERE photo.owner_id=peer.owner_id AND photo.environment=$2
       AND photo.state='approved' AND photo.publication_status='published'
     ORDER BY photo.position,photo.id LIMIT 1) AS peer_photo_id,
   (SELECT count(*)::text FROM luemi_chats.messages msg
    WHERE msg.conversation_id=m.conversation_id AND msg.sender_id<>$1
    AND msg.deleted_at IS NULL AND ${visibleMessage("msg")} AND msg.created_at>coalesce(m.last_read_at,'epoch'::timestamptz)) AS unread_count,
   (SELECT CASE WHEN msg.deleted_at IS NULL THEN nullif(msg.body,'') ELSE 'Сообщение удалено' END FROM luemi_chats.messages msg
    WHERE msg.conversation_id=m.conversation_id AND ${visibleMessage("msg")} ORDER BY msg.created_at DESC,msg.id DESC LIMIT 1) AS last_message,
   coalesce((SELECT max(msg.created_at) FROM luemi_chats.messages msg WHERE msg.conversation_id=m.conversation_id AND ${visibleMessage("msg")}),c.created_at) AS last_activity_at
   FROM luemi_chats.members m
   JOIN luemi_chats.conversations c ON c.id=m.conversation_id AND c.environment=m.environment
   JOIN luemi_chats.matches pair ON pair.id=c.private_match_id AND pair.environment=c.environment AND pair.status='active'
   LEFT JOIN luemi_private.public_profiles peer
     ON peer.owner_id=(CASE WHEN pair.actor_low=$1 THEN pair.actor_high ELSE pair.actor_low END)
    AND peer.environment=$2 AND peer.publication_status='published'
   WHERE m.actor_id=$1 AND m.environment=$2
     AND (NOT EXISTS (SELECT 1 FROM luemi_chats.conversation_clear_events cuts
       WHERE cuts.conversation_id=m.conversation_id AND cuts.environment=m.environment
         AND (cuts.scope='everyone' OR cuts.actor_id=$1))
       OR EXISTS (SELECT 1 FROM luemi_chats.messages msg
         WHERE msg.conversation_id=m.conversation_id AND ${visibleMessage("msg")}))
   ORDER BY last_activity_at DESC,c.id DESC LIMIT 100`,[actor,options.namespace]);
  return {conversations:rows.rows.map(r=>({
   id:r.id,matchId:r.match_id,peerId:r.peer_id,peerProfileId:r.peer_id,peerName:r.peer_name,
   peerPhotoUrl:r.peer_photo_id?"/api/v3/discovery/photo/"+r.peer_photo_id:null,
   lastMessage:r.last_message,lastActivityAt:r.last_activity_at,unreadCount:Number(r.unread_count),access:"active" as const
  }))};
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
  const q=await db.query<MessageRow>(`SELECT id,conversation_id AS "conversationId",sender_id AS "senderId",client_id AS "clientId",
    CASE WHEN deleted_at IS NULL THEN body ELSE '' END AS body,
    created_at AS "createdAt",edited_at AS "editedAt",deleted_at AS "deletedAt",created_at AS "deliveredAt",NULL::timestamptz AS "readAt"
    FROM luemi_chats.messages m WHERE conversation_id=$1 AND environment=$2
    AND ${visibleMessage("m","$4")}
     AND ($3::uuid IS NULL OR (created_at,id)<(
      SELECT created_at,id FROM luemi_chats.messages WHERE id=$3 AND conversation_id=$1))
    ORDER BY created_at DESC,id DESC LIMIT 51`,
   [req.params.id,options.namespace,req.query.before??null,actor]);
  const more=q.rows.length>50;const page=q.rows.slice(0,50);
  const nextCursor=more&&page.length?page[page.length-1].id:null;
  return {messages:await hydrate(db,page.reverse()),nextCursor};
 }));
 app.post<{Params:{id:string};Body:{body?:unknown;clientId?:unknown;mediaIds?:unknown}}>(
 "/api/v4/chats/:id/messages",{preHandler:auth.mutation},(req,reply)=>scoped(req,reply,async(db,actor)=>{
  if(!validId(req.params.id))deny(404,"not_found");
  const mediaIds=Array.isArray(req.body?.mediaIds)&&req.body.mediaIds.length<=1&&req.body.mediaIds.every(validId)?req.body.mediaIds:[];
  if(!validBody(req.body?.body)&&mediaIds.length===0)deny(422,"invalid_message");
  if(!validId(req.body?.clientId)||req.body?.mediaIds!==undefined&&(!Array.isArray(req.body.mediaIds)||mediaIds.length!==req.body.mediaIds.length))deny(422,"invalid_message");
  await member(db,req.params.id,actor);
  const q=await db.query(`INSERT INTO luemi_chats.messages(conversation_id,sender_id,environment,client_id,body)
   VALUES($1,$2,$3,$4,$5)
   ON CONFLICT(conversation_id,sender_id,client_id) DO NOTHING RETURNING
   id,conversation_id AS "conversationId",sender_id AS "senderId",client_id AS "clientId",body,
   created_at AS "createdAt",edited_at AS "editedAt",deleted_at AS "deletedAt",created_at AS "deliveredAt",NULL::timestamptz AS "readAt"`,
   [req.params.id,actor,options.namespace,req.body.clientId,validBody(req.body?.body)?req.body.body:""]);
  if(q.rowCount!==1){
   const existing=await db.query<MessageRow>(`SELECT id,conversation_id AS "conversationId",sender_id AS "senderId",client_id AS "clientId",body,
   created_at AS "createdAt",edited_at AS "editedAt",deleted_at AS "deletedAt",created_at AS "deliveredAt",NULL::timestamptz AS "readAt"
   FROM luemi_chats.messages WHERE conversation_id=$1 AND sender_id=$2 AND client_id=$3`,
   [req.params.id,actor,req.body.clientId]);
   if(existing.rowCount!==1||existing.rows[0].body!==(validBody(req.body?.body)?req.body.body:"")||existing.rows[0].deletedAt)deny(409,"idempotency_conflict");
   return {message:(await hydrate(db,existing.rows))[0]};
  }
  if(mediaIds.length){const attached=await db.query(`UPDATE luemi_chats.media SET message_id=$1 WHERE id=ANY($2::uuid[]) AND conversation_id=$3 AND owner_id=$4 AND message_id IS NULL RETURNING id`,[q.rows[0].id,mediaIds,req.params.id,actor]);if(attached.rowCount!==mediaIds.length)deny(409,"media_conflict");}
  return {message:(await hydrate(db,q.rows as MessageRow[]))[0]};
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
  return {read:true as const,readAt:q.rows[0].created_at};
 }));
 app.patch<{Params:{id:string;messageId:string};Body:{body?:unknown}}>(
 "/api/v4/chats/:id/messages/:messageId",{preHandler:auth.mutation},(req,reply)=>scoped(req,reply,async(db,actor)=>{
  if(!validId(req.params.id)||!validId(req.params.messageId))deny(404,"not_found");
  if(!validBody(req.body?.body))deny(422,"invalid_message");
  await member(db,req.params.id,actor);
  const q=await db.query<MessageRow>(`UPDATE luemi_chats.messages SET body=$4,edited_at=now()
   WHERE conversation_id=$1 AND id=$2 AND sender_id=$3 AND deleted_at IS NULL AND body<>$4
   RETURNING id,conversation_id AS "conversationId",sender_id AS "senderId",client_id AS "clientId",body,
   created_at AS "createdAt",edited_at AS "editedAt",deleted_at AS "deletedAt",created_at AS "deliveredAt",NULL::timestamptz AS "readAt"`,
   [req.params.id,req.params.messageId,actor,req.body.body]);
  if(q.rowCount!==1)deny(404,"not_found");
  return {message:(await hydrate(db,q.rows))[0]};
 }));

 // Display-level erasure never destroys original payloads. A separate lifecycle
 // policy governs irreversible deletion, legal holds and data subject requests.
 app.post<{Params:{id:string;messageId:string};Body:{scope?:unknown}}>(
 "/api/v4/chats/:id/messages/:messageId/visibility",{preHandler:auth.mutation},
 (req,reply)=>scoped(req,reply,async(db,actor)=>{
  if(!validId(req.params.id)||!validId(req.params.messageId))deny(404,"not_found");
  if(req.body?.scope!=="me"&&req.body?.scope!=="everyone")deny(422,"invalid_scope");
  await member(db,req.params.id,actor);
  const q=await db.query(
   "SELECT 1 FROM luemi_chats.messages WHERE id=$1 AND conversation_id=$2 AND environment=$3",
   [req.params.messageId,req.params.id,options.namespace]);
  if(q.rowCount!==1)deny(404,"not_found");
  await db.query(`INSERT INTO luemi_chats.message_visibility
    (message_id,conversation_id,environment,actor_id,scope)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(message_id,actor_id,scope) DO NOTHING`,
   [req.params.messageId,req.params.id,options.namespace,actor,req.body.scope]);
  return {removed:true as const,scope:req.body.scope,messageId:req.params.messageId};
 }));
 app.post<{Params:{id:string};Body:{scope?:unknown}}>(
 "/api/v4/chats/:id/clear",{preHandler:auth.mutation},
 (req,reply)=>scoped(req,reply,async(db,actor)=>{
  if(!validId(req.params.id))deny(404,"not_found");
  if(req.body?.scope!=="me"&&req.body?.scope!=="everyone")deny(422,"invalid_scope");
  await member(db,req.params.id,actor);
  await db.query(`INSERT INTO luemi_chats.conversation_clear_events
   (conversation_id,environment,actor_id,scope) VALUES($1,$2,$3,$4)`,
   [req.params.id,options.namespace,actor,req.body.scope]);
  return {removed:true as const,scope:req.body.scope,conversationId:req.params.id};
 }));
 // Legacy DELETE: author-only and now uses a global visibility event, never
 // wipes the original body. Old clients receive the previous response shape.
 app.delete<{Params:{id:string;messageId:string}}>(
 "/api/v4/chats/:id/messages/:messageId",{preHandler:auth.mutation},
 (req,reply)=>scoped(req,reply,async(db,actor)=>{
  if(!validId(req.params.id)||!validId(req.params.messageId))deny(404,"not_found");
  await member(db,req.params.id,actor);
  const q=await db.query<MessageRow>(`SELECT id,conversation_id AS "conversationId",
   sender_id AS "senderId",client_id AS "clientId",body,created_at AS "createdAt",
   edited_at AS "editedAt",deleted_at AS "deletedAt",
   created_at AS "deliveredAt",NULL::timestamptz AS "readAt"
   FROM luemi_chats.messages
   WHERE id=$1 AND conversation_id=$2 AND environment=$3 AND sender_id=$4`,
   [req.params.messageId,req.params.id,options.namespace,actor]);
  if(q.rowCount!==1)deny(404,"not_found");
  await db.query(`INSERT INTO luemi_chats.message_visibility
   (message_id,conversation_id,environment,actor_id,scope)
   VALUES($1,$2,$3,$4,'everyone') ON CONFLICT(message_id,actor_id,scope) DO NOTHING`,
   [req.params.messageId,req.params.id,options.namespace,actor]);
  return {message:{...q.rows[0],body:"",deletedAt:new Date().toISOString(),media:[]}};
 }));

 app.post<{Params:{id:string};Body:Buffer}>("/api/v4/chats/:id/media",{preHandler:auth.mutation,config:{bodyLimit:10*1024*1024}},(req,reply)=>scoped(req,reply,async(db,actor,onRollback)=>{
  if(!validId(req.params.id))deny(404,"not_found");
  const clientId=req.headers["x-luemi-client-id"];
  if(typeof clientId!=="string"||!validId(clientId))deny(422,"invalid_media");
  await member(db,req.params.id,actor);if(!options.mediaStore)deny(503,"media_unavailable");
  let image;try{image=validateChatImageBytes(req.body,req.headers["content-type"]?.split(";")[0]);}catch{deny(422,"invalid_media");}
  const existing=await db.query<{id:string;message_id:string|null;mime_type:ChatMediaContract["mimeType"];byte_size:number;object_path:string}>("SELECT id,message_id,mime_type,byte_size,object_path FROM luemi_chats.media WHERE conversation_id=$1 AND owner_id=$2 AND client_id=$3",[req.params.id,actor,clientId]);
  if(existing.rowCount===1){const media=existing.rows[0];return {media:{id:media.id,messageId:media.message_id,mimeType:media.mime_type,byteSize:media.byte_size,width:null,height:null,state:"ready" as const,url:null}};}
  const key=chatObjectKey(options.namespace,req.params.id,actor,image.mime);await options.mediaStore.put({key,bytes:image.bytes,mime:image.mime,sha256:image.sha256});onRollback(()=>options.mediaStore!.remove(key));
  const inserted=await db.query<{id:string}>("INSERT INTO luemi_chats.media(conversation_id,owner_id,environment,client_id,object_path,mime_type,byte_size,content_sha256,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ready') RETURNING id",[req.params.id,actor,options.namespace,clientId,key,image.mime,image.size,image.sha256]);return {media:{id:inserted.rows[0].id,messageId:null,mimeType:image.mime,byteSize:image.size,width:null,height:null,state:"ready" as const,url:null}};
 }));
 app.get<{Params:{id:string;mediaId:string} }>("/api/v4/chats/:id/media/:mediaId/url",{preHandler:auth.read},(req,reply)=>scoped(req,reply,async(db,actor)=>{
  if(!validId(req.params.id)||!validId(req.params.mediaId))deny(404,"not_found");await member(db,req.params.id,actor);if(!options.mediaStore)deny(503,"media_unavailable");
  const found=await db.query<{object_path:string}>(`SELECT media.object_path FROM luemi_chats.media media JOIN luemi_chats.messages msg ON msg.id=media.message_id AND msg.conversation_id=media.conversation_id AND msg.environment=media.environment WHERE media.id=$1 AND media.conversation_id=$2 AND media.state='ready' AND msg.deleted_at IS NULL AND ${visibleMessage("msg","$3")}`,[req.params.mediaId,req.params.id,actor]);if(found.rowCount!==1)deny(404,"not_found");return options.mediaStore.signedRead(found.rows[0].object_path,60);
 }));
}
