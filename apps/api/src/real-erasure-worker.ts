// REG01F: explicitly invoked, server-only irreversible erasure worker.
// NEVER wire this into the HTTP app or expose it as an unauthenticated endpoint.
import {Pool} from "pg";
import type {PrivateObjectStore} from "./rem05d-private.js";
import {erasureRoleSafe} from "./real-erasure.js";
export interface ErasureBatchOptions{
 databaseUrl:string;namespace:string;storage:PrivateObjectStore;
 limit?:number;
}
export type ErasureBatchResult={completed:number;failed:number;pending:boolean};
export async function runErasureBatch(options:ErasureBatchOptions):Promise<ErasureBatchResult>{
 if(!options.databaseUrl||!/^[a-z0-9:_-]{1,96}$/i.test(options.namespace)||
   !options.storage||!Number.isInteger(options.limit??1)||
   (options.limit??1)<1||(options.limit??1)>10)
  throw new Error("invalid_erasure_worker_configuration");
 const pool=new Pool({connectionString:options.databaseUrl,max:1,connectionTimeoutMillis:3000});
 let completed=0,failed=0,pending=false;
 try{
  for(let i=0;i<(options.limit??1);i++){
   const db=await pool.connect();
   let began=false;
   try{
    if(!await erasureRoleSafe(db,"luemi_erasure_worker"))
     throw new Error("erasure_worker_role_denied");
    await db.query("BEGIN");began=true;
    // Locks the outbox row throughout every Storage operation and relational purge.
    // A crashed worker rolls back; remote DELETE is idempotently retried on next run.
    const request=await db.query<{id:string;actor_id:string}>(
     "SELECT id,actor_id FROM luemi_private.erasure_requests "+
     "WHERE environment=$1 AND state='pending' AND eligible_at<=clock_timestamp() ORDER BY eligible_at,id "+
     "LIMIT 1 FOR UPDATE SKIP LOCKED",[options.namespace]);
    if(request.rowCount!==1){
     await db.query("COMMIT");began=false;
     break;
    }
    const id=request.rows[0].id,actor=request.rows[0].actor_id;
    const active=await db.query(
     "SELECT id FROM luemi_private.actors "+
     "WHERE id=$1 AND environment=$2 AND status='deleted'",
     [actor,options.namespace]);
    if(active.rowCount!==1)throw new Error("erasure_actor_not_disabled");
    const objects=await db.query<{object_key:string;deleted_at:string|null}>(
     "SELECT object_key,deleted_at::text FROM luemi_private.erasure_objects "+
     "WHERE request_id=$1 ORDER BY object_key",[id]);
    // Objects can have been uploaded, or only reserved. 404 is success.
    // The same sanitized object key can never be minted for another actor.
    for(const item of objects.rows){
     if(item.deleted_at)continue;
     await options.storage.delete(item.object_key);
     const mark=await db.query(
      "UPDATE luemi_private.erasure_objects SET deleted_at=clock_timestamp() "+
      "WHERE request_id=$1 AND object_key=$2 AND deleted_at IS NULL",
      [id,item.object_key]);
     if(mark.rowCount!==1)throw new Error("erasure_object_marker_conflict");
    }
    const outstanding=await db.query(
     "SELECT 1 FROM luemi_private.erasure_objects "+
     "WHERE request_id=$1 AND deleted_at IS NULL LIMIT 1",[id]);
    if(outstanding.rowCount!==0)throw new Error("erasure_object_pending");
    // Only account-specific geo queries/quotas are erased. Global budget
    // reservations cannot be safely attributed to one actor.
    await db.query("DELETE FROM luemi_private.geo_daily_usage "+
     "WHERE namespace=$2 AND scope='actor' AND actor_id=$1",
     [actor,options.namespace]);
    // FK-safe order. For reports and blocks we remove both directions.
    // Audit rows referring to deleted media must not survive the purge.
    await db.query(
     "DELETE FROM luemi_private.audit_events WHERE actor_id=$1 "+
     "OR resource_ref IN (SELECT id FROM luemi_private.media_assets WHERE owner_id=$1)",
     [actor]);
    await db.query("DELETE FROM luemi_private.moderation_decisions d "+
     "USING luemi_private.moderation_jobs j,luemi_private.media_assets m "+
     "WHERE d.job_id=j.id AND j.asset_id=m.id AND m.owner_id=$1",[actor]);
    await db.query("DELETE FROM luemi_private.moderation_jobs j "+
     "USING luemi_private.media_assets m "+
     "WHERE j.asset_id=m.id AND m.owner_id=$1",[actor]);
    await db.query("DELETE FROM luemi_private.media_uploads "+
     "WHERE owner_id=$1 AND environment=$2",[actor,options.namespace]);
    await db.query("DELETE FROM luemi_private.media_assets "+
     "WHERE owner_id=$1 AND environment=$2",[actor,options.namespace]);
    await db.query("DELETE FROM luemi_private.blocks "+
     "WHERE environment=$2 AND (blocker_id=$1 OR blocked_id=$1)",
     [actor,options.namespace]);
    await db.query("DELETE FROM luemi_private.reports "+
     "WHERE environment=$2 AND (reporter_id=$1 OR subject_id=$1)",
     [actor,options.namespace]);
    await db.query("DELETE FROM luemi_private.public_profiles "+
     "WHERE owner_id=$1 AND environment=$2",[actor,options.namespace]);
    await db.query("DELETE FROM luemi_private.private_profile_drafts "+
     "WHERE owner_id=$1 AND environment=$2",[actor,options.namespace]);
    await db.query("DELETE FROM luemi_private.sessions "+
     "WHERE actor_id=$1 AND environment=$2",[actor,options.namespace]);
    const removed=await db.query(
     "DELETE FROM luemi_private.actors WHERE id=$1 AND environment=$2 AND status='deleted'",
     [actor,options.namespace]);
    if(removed.rowCount!==1)throw new Error("erasure_actor_delete_denied");
    // Keep the opaque request ID for limited operational verification;
    // exact retention is not approved and must be defined before launch.
    await db.query("DELETE FROM luemi_private.erasure_objects WHERE request_id=$1",[id]);
    const finalized=await db.query(
     "UPDATE luemi_private.erasure_requests SET state='complete',"+
     "finished_at=clock_timestamp() WHERE id=$1 AND state='pending' RETURNING id",[id]);
    if(finalized.rowCount!==1)throw new Error("erasure_finalize_conflict");
    await db.query("COMMIT");began=false;completed++;
   }catch(e){
    if(process.env.NODE_ENV==='test'||process.env.CI==='true'){
     const code=typeof e==='object'&&e!==null&&'code' in e?String(e.code):'NON_SQL';
     const whitelist=new Set(['erasure_actor_not_disabled','erasure_object_marker_conflict',
      'erasure_object_pending','erasure_actor_delete_denied','erasure_finalize_conflict']);
     const reason=e instanceof Error&&whitelist.has(e.message)?e.message:'unspecified';
     process.stderr.write('REG01F_WORKER_ERROR_CODE '+code.slice(0,5)+' '+reason+'\n');
    }
    if(began)await db.query("ROLLBACK").catch(()=>{});
    failed++;
    // Deny a running worker with a merged/privileged credential, never retry it.
    if(e instanceof Error&&e.message==="erasure_worker_role_denied")throw e;
    // Leave the queue pending for a later explicit retry after Storage recovers.
    break;
   }finally{db.release();}
  }
  const db=await pool.connect();
  try{
   if(!await erasureRoleSafe(db,"luemi_erasure_worker"))
    throw new Error("erasure_worker_role_denied");
   const q=await db.query(
    "SELECT id FROM luemi_private.erasure_requests "+
    "WHERE environment=$1 AND state='pending' AND eligible_at<=clock_timestamp() LIMIT 1",[options.namespace]);
   pending=q.rowCount!==0;
  }finally{db.release();}
  return{completed,failed,pending};
 }finally{await pool.end();}
}
