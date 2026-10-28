// REG01F: irreversible account-disable request. NO raw keys or sessions leave this endpoint.
// Storage removal is NOT transactional; a separately provisioned privileged worker processes the outbox.
import {Pool} from "pg";
import type {PoolClient} from "pg";
import type {FastifyInstance,FastifyReply,FastifyRequest} from "fastify";

export interface ErasureRequestOptions {
 enabled:true;databaseUrl:string;namespace:string;
}
type Guard={mutation:(request:FastifyRequest,reply:FastifyReply)=>Promise<void>};
class Refusal extends Error{constructor(readonly status:number,readonly code:string){super(code);}}
const denied=(status:number,code:string):never=>{throw new Refusal(status,code);};
export const deletionReasonCodes=["met_someone","not_useful","privacy","technical","other","prefer_not_to_say"] as const;
export type DeletionReason=(typeof deletionReasonCodes)[number];
export function deletionRequestReason(value:unknown):{reason:DeletionReason;details:string}|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const x=value as Record<string,unknown>;
 if(Object.keys(x).some(k=>!["confirmation","reason","details"].includes(k))||
    x.confirmation!=="DELETE MY LUEMI ACCOUNT"||
    typeof x.reason!=="string"||
    !deletionReasonCodes.some(y=>y===x.reason)||
    typeof x.details!=="string"||x.details.length>500||
    /[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]/.test(x.details))return null;
 return{reason:x.reason as DeletionReason,details:x.details.trim()};
}


export async function erasureRoleSafe(db:PoolClient,kind:"luemi_erasure_requester"|"luemi_erasure_worker"):Promise<boolean>{
 try{
  const q=await db.query<{safe:boolean}>(`
  SELECT (r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole
   AND NOT r.rolcreatedb AND session_user=current_user
   AND current_setting('row_security')='on'
   AND pg_has_role(current_user,$1::name,'member')
   AND NOT pg_has_role(current_user,'luemi_auth_issuer','member')
   AND NOT pg_has_role(current_user,'luemi_request','member')
   AND NOT pg_has_role(current_user,'luemi_media_worker','member')
   AND NOT pg_has_role(current_user,'luemi_moderator','member')
   AND NOT pg_has_role(current_user,'luemi_profile_publisher','member')
   AND NOT pg_has_role(current_user,'luemi_discovery_reader','member')
   AND NOT pg_has_role(current_user,
     CASE WHEN $1='luemi_erasure_worker' THEN 'luemi_erasure_requester'
     ELSE 'luemi_erasure_worker' END::name,'member')
   AND NOT has_schema_privilege(current_user,'luemi_private','CREATE')
   AND NOT has_table_privilege(current_user,'luemi_private.actors','INSERT')
   AND NOT has_table_privilege(current_user,'luemi_private.sessions','INSERT')
   AND (SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity
      AND row_security_active(c.oid)) FROM pg_class c WHERE c.oid IN
      ('luemi_private.actors'::regclass,'luemi_private.sessions'::regclass,
       'luemi_private.erasure_requests'::regclass,'luemi_private.erasure_objects'::regclass))
   AND CASE WHEN $1='luemi_erasure_requester'
    THEN has_column_privilege(current_user,'luemi_private.actors','status','UPDATE')
     AND has_column_privilege(current_user,'luemi_private.sessions','revoked_at','UPDATE')
     AND NOT has_table_privilege(current_user,'luemi_private.actors','DELETE')
     AND NOT has_table_privilege(current_user,'luemi_private.erasure_requests','UPDATE')
    ELSE has_table_privilege(current_user,'luemi_private.actors','DELETE')
     AND has_table_privilege(current_user,'luemi_private.sessions','DELETE')
     AND NOT has_column_privilege(current_user,'luemi_private.actors','status','UPDATE')
   END) AS safe
   FROM pg_roles r WHERE r.rolname=current_user`,[kind]);
  return q.rowCount===1&&q.rows[0].safe===true;
 }catch{return false;}
}
export function registerAccountErasure(
 app:FastifyInstance,guards:Guard|undefined,opts:ErasureRequestOptions|undefined
):void{
 if(!opts?.enabled)return;
 if(!guards||!opts.databaseUrl||!/^[a-z0-9:_-]{1,96}$/i.test(opts.namespace))
  throw new Error("REG01F requires an isolated erasure-request login and valid namespace");
 const pool=new Pool({connectionString:opts.databaseUrl,max:2,connectionTimeoutMillis:3000});
 app.addHook("onClose",async()=>{await pool.end();});
 app.post<{Body:unknown}>("/api/v3/account/request-deletion",
  {preHandler:guards.mutation},async(req,reply)=>{
   reply.header("Cache-Control","private, no-store").header("Vary","Cookie");
   const reason=deletionRequestReason(req.body);
   if(!reason)return reply.code(422).send({error:"confirmation_or_reason_required"});
   const actor=req.authActor;
   if(!actor)return reply.code(401).send({error:"unauthorized"});
   const db=await pool.connect().catch(()=>null);
   if(!db)return reply.code(503).send({error:"service_unavailable"});
   try{
    if(!await erasureRoleSafe(db,"luemi_erasure_requester"))
     denied(503,"service_unavailable");
    await db.query("BEGIN");
    await db.query("SELECT set_config('luemi.actor_id',$1,true)",[actor.actorId]);
    await db.query("SELECT set_config('luemi.environment',$1,true)",[opts.namespace]);
    // Synchronize with reservations and worker uploads BEFORE locking actor/session
    // rows, preventing an untracked late private object after the outbox snapshot.
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
     [opts.namespace+":"+actor.actorId+":profile_media_slots"]);
    // Lock in consistent order. Neither the cookie nor UI controls authorize another owner.
    const active=await db.query("SELECT id FROM luemi_private.actors "+
     "WHERE id=$1 AND environment=$2 AND status='active' FOR UPDATE",
     [actor.actorId,opts.namespace]);
    if(active.rowCount!==1)denied(401,"unauthorized");
    const currentSession=await db.query("SELECT id FROM luemi_private.sessions "+
     "WHERE id=$1 AND actor_id=$2 AND environment=$3 AND revoked_at IS NULL FOR UPDATE",
     [actor.sessionId,actor.actorId,opts.namespace]);
    if(currentSession.rowCount!==1)denied(401,"unauthorized");
    const queued=await db.query<{id:string;eligible_at:string}>(
     "INSERT INTO luemi_private.erasure_requests(actor_id,environment,eligible_at,reason_code,reason_details) "+
     "VALUES($1,$2,clock_timestamp()+interval '72 hours',$3,$4) "+
     "ON CONFLICT(actor_id) DO NOTHING RETURNING id,eligible_at",
     [actor.actorId,opts.namespace,reason.reason,reason.details]);
    if(queued.rowCount!==1)denied(409,"deletion_already_queued");
    // Only sanitized derivatives are ever persisted; original_key is a reserved
    // identifier that the private Storage adapter does not accept.
    await db.query("INSERT INTO luemi_private.erasure_objects(request_id,object_key) "+
     "SELECT $1,derivative_key FROM luemi_private.media_assets "+
     "WHERE owner_id=$2 AND environment=$3 ON CONFLICT DO NOTHING",
     [queued.rows[0].id,actor.actorId,opts.namespace]);
    await db.query("UPDATE luemi_private.public_profiles SET publication_status='hidden' "+
     "WHERE owner_id=$1 AND environment=$2",[actor.actorId,opts.namespace]);
    await db.query("UPDATE luemi_private.media_assets SET publication_status='private' "+
     "WHERE owner_id=$1 AND environment=$2",[actor.actorId,opts.namespace]);
    // Preserve the private draft during the 72-hour recovery window.
    // A restored account starts hidden and requires explicit republication.
    await db.query("UPDATE luemi_private.sessions SET revoked_at=clock_timestamp() "+
     "WHERE actor_id=$1 AND environment=$2 AND revoked_at IS NULL",
     [actor.actorId,opts.namespace]);
    const deleted=await db.query("UPDATE luemi_private.actors "+
     "SET status='deleted',first_name='Deleted' "+
     "WHERE id=$1 AND environment=$2 AND status='active' RETURNING id",
     [actor.actorId,opts.namespace]);
    if(deleted.rowCount!==1)denied(409,"deletion_conflict");
    await db.query("COMMIT");
    reply.header("Set-Cookie",
     "__Host-luemi_sid=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0");
    return reply.code(202).send({state:"deletion_grace",publicAccessRevoked:true,
     sessionsRevoked:true,storagePending:true,dataDeleted:false,
     canRestore:true,restoreUntil:new Date(queued.rows[0].eligible_at).toISOString()});
   }catch(error){
    await db.query("ROLLBACK").catch(()=>{});
    if(error instanceof Refusal)return reply.code(error.status).send({error:error.code});
    return reply.code(503).send({error:"service_unavailable"});
   }finally{db.release();}
  });
}
