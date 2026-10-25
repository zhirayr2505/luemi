// REG01G operator-only moderation. NO HTTP endpoints, Telegram session or public URL.
import {Pool} from "pg";
import type {PoolClient} from "pg";
import type {PrivateObjectStore} from "./rem05d-private.js";
export interface HumanReviewOptions{
 databaseUrl:string;namespace:string;operatorLabel:string;
 storage?:PrivateObjectStore;
}
const idOK=(x:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
function validate(o:HumanReviewOptions){
 if(!o.databaseUrl||!/^[a-z0-9:_-]{1,96}$/i.test(o.namespace)||
  !/^[A-Za-z0-9_-]{3,64}$/.test(o.operatorLabel))
  throw new Error("invalid_review_configuration");
}
async function safeHumanRole(db:PoolClient):Promise<boolean>{
 try{
  const q=await db.query<{ok:boolean}>(
   "SELECT (r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls "+
   "AND NOT r.rolcreaterole AND NOT r.rolcreatedb AND session_user=current_user "+
   "AND current_setting('row_security')='on' "+
   "AND pg_has_role(current_user,'luemi_human_moderator','member') "+
   "AND NOT pg_has_role(current_user,'luemi_moderator','member') "+
   "AND NOT pg_has_role(current_user,'luemi_request','member') "+
   "AND NOT pg_has_role(current_user,'luemi_auth_issuer','member') "+
   "AND NOT pg_has_role(current_user,'luemi_media_worker','member') "+
   "AND NOT pg_has_role(current_user,'luemi_profile_publisher','member') "+
   "AND NOT pg_has_role(current_user,'luemi_discovery_reader','member') "+
   "AND NOT pg_has_role(current_user,'luemi_erasure_worker','member') "+
   "AND NOT pg_has_role(current_user,'luemi_invite_operator','member') "+
   "AND NOT pg_has_role(current_user,'pg_read_all_data','member') "+
   "AND NOT pg_has_role(current_user,'pg_write_all_data','member') "+
   "AND row_security_active('luemi_private.media_assets'::regclass) "+
   "AND row_security_active('luemi_private.reports'::regclass) "+
   "AND NOT has_schema_privilege(current_user,'luemi_private','CREATE') "+
   "AND NOT has_table_privilege(current_user,'luemi_private.sessions','SELECT') "+
   "AND NOT has_table_privilege(current_user,'luemi_private.actors','SELECT') "+
   "AND NOT has_table_privilege(current_user,'luemi_private.private_profile_drafts','SELECT') "+
   "AND NOT has_table_privilege(current_user,'luemi_private.public_profiles','UPDATE') "+
   "AND NOT has_table_privilege(current_user,'luemi_private.media_assets','DELETE') "+
   ") AS ok FROM pg_roles r WHERE r.rolname=current_user");
  return q.rowCount===1&&q.rows[0].ok===true;
 }catch{return false;}
}
async function guarded<T>(opts:HumanReviewOptions,job:(db:PoolClient)=>Promise<T>):Promise<T>{
 validate(opts);
 const pool=new Pool({connectionString:opts.databaseUrl,max:1,connectionTimeoutMillis:3000});
 try{
  const db=await pool.connect();
  try{
   if(!await safeHumanRole(db))throw new Error("human_moderator_role_denied");
   await db.query("BEGIN");
   await db.query("SELECT set_config('luemi.environment',$1,true)",[opts.namespace]);
   const result=await job(db);
   await db.query("COMMIT");
   return result;
  }catch(e){await db.query("ROLLBACK").catch(()=>{});throw e;}
  finally{db.release();}
 }finally{await pool.end();}
}
export async function listReviewQueue(o:HumanReviewOptions){
 return guarded(o,async db=>{
  const photos=await db.query<{asset_id:string;generation:number;created_at:string}>(
   "SELECT a.id AS asset_id,j.generation,j.created_at::text FROM luemi_private.moderation_jobs j "+
   "JOIN luemi_private.media_assets a ON a.id=j.asset_id "+
   "WHERE j.state='pending_review' AND a.state='pending_review' "+
   "AND a.generation=j.generation AND a.environment=$1 "+
   "ORDER BY j.created_at,j.id LIMIT 25",[o.namespace]);
  const reports=await db.query<{id:string;reason_code:string;created_at:string}>(
   "SELECT id,reason_code,created_at::text FROM luemi_private.reports "+
   "WHERE environment=$1 AND state='open' ORDER BY created_at,id LIMIT 25",[o.namespace]);
  return{photos:photos.rows,reports:reports.rows};
 });
}
/** Explicitly reviewed private pixels; never returns key, public URL or signed URL. */
export async function fetchPrivateReviewImage(o:HumanReviewOptions,assetId:string):Promise<Buffer>{
 if(!idOK(assetId)||!o.storage)throw new Error("invalid_review_media");
 const row=await guarded(o,async db=>{
  const found=await db.query<{derivative_key:string;generation:number}>(
   "SELECT a.derivative_key,a.generation FROM luemi_private.media_assets a "+
   "JOIN luemi_private.moderation_jobs j ON j.asset_id=a.id "+
   "WHERE a.id=$1 AND a.environment=$2 AND a.state='pending_review' "+
   "AND a.publication_status='private' AND j.state='pending_review' "+
   "AND a.generation=j.generation",[assetId,o.namespace]);
  if(found.rowCount!==1)throw new Error("review_media_not_pending");
  return found.rows[0];
 });
 let bytes:Buffer|null=null;
 try{bytes=await o.storage.get(row.derivative_key);}catch{throw new Error("review_storage_unavailable");}
 if(!bytes||bytes.length<1||bytes.length>1_048_576)throw new Error("review_media_unavailable");
 // Permission may have changed during remote GET, e.g. erasure or other moderator.
 await guarded(o,async db=>{
  const current=await db.query(
   "SELECT 1 FROM luemi_private.media_assets a JOIN luemi_private.moderation_jobs j "+
   "ON j.asset_id=a.id WHERE a.id=$1 AND a.environment=$2 "+
   "AND a.generation=$3 AND a.derivative_key=$4 "+
   "AND a.state='pending_review' AND a.publication_status='private' "+
   "AND j.state='pending_review' AND j.generation=$3",
   [assetId,o.namespace,row.generation,row.derivative_key]);
  if(current.rowCount!==1)throw new Error("review_media_revoked");
 });
 return bytes;
}
export async function decideReviewPhoto(o:HumanReviewOptions,assetId:string,
 decision:"approved"|"rejected",reason:"human_safe"|"human_policy_violation"|"human_minor_suspected"){
 if(!idOK(assetId)|| (decision==="approved")!==(reason==="human_safe"))
  throw new Error("invalid_human_photo_decision");
 return guarded(o,async db=>{
  const current=await db.query<{job_id:string}>(
   "SELECT j.id AS job_id FROM luemi_private.moderation_jobs j "+
   "JOIN luemi_private.media_assets a ON a.id=j.asset_id "+
   "WHERE a.id=$1 AND a.environment=$2 AND a.state='pending_review' "+
   "AND a.publication_status='private' AND j.state='pending_review' "+
   "AND j.generation=a.generation FOR UPDATE OF a,j",
   [assetId,o.namespace]);
  if(current.rowCount!==1)throw new Error("review_photo_already_decided");
  const updated=await db.query(
   "UPDATE luemi_private.media_assets SET state=$2 "+
   "WHERE id=$1 AND environment=$3 AND state='pending_review' RETURNING id",
   [assetId,decision,o.namespace]);
  if(updated.rowCount!==1)throw new Error("review_photo_conflict");
  const job=await db.query(
   "UPDATE luemi_private.moderation_jobs SET state='decided' "+
   "WHERE id=$1 AND state='pending_review' RETURNING id",[current.rows[0].job_id]);
  if(job.rowCount!==1)throw new Error("review_job_conflict");
  const record=await db.query(
   "INSERT INTO luemi_private.moderation_decisions(job_id,moderator_label,decision,reason_code) "+
   "VALUES($1,$2,$3,$4)",
   [current.rows[0].job_id,o.operatorLabel,decision,reason]);
  if(record.rowCount!==1)throw new Error("review_audit_conflict");
  return{state:"decided",decision};
 });
}
export async function triageReviewReport(o:HumanReviewOptions,reportId:string,
 action:"triaged"|"dismissed",
 reason:"spam"|"harassment"|"impersonation"|"unsafe_media"|"no_violation"){
 if(!idOK(reportId)|| (action==="dismissed")!==(reason==="no_violation"))
  throw new Error("invalid_human_report_decision");
 return guarded(o,async db=>{
  const row=await db.query(
   "SELECT id FROM luemi_private.reports WHERE id=$1 AND environment=$2 "+
   "AND state='open' FOR UPDATE",[reportId,o.namespace]);
  if(row.rowCount!==1)throw new Error("review_report_already_decided");
  const upd=await db.query(
   "UPDATE luemi_private.reports SET state=$2 "+
   "WHERE id=$1 AND environment=$3 AND state='open' RETURNING id",
   [reportId,action,o.namespace]);
  if(upd.rowCount!==1)throw new Error("review_report_conflict");
  const a=await db.query(
   "INSERT INTO luemi_private.human_report_reviews "+
   "(report_id,environment,action,moderator_label,reason_code) "+
   "VALUES($1,$2,$3,$4,$5)",
   [reportId,o.namespace,action,o.operatorLabel,reason]);
  if(a.rowCount!==1)throw new Error("review_report_audit_denied");
  return{state:action};
 });
}
