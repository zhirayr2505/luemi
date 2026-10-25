// 01H safety enforcement runs only as a separately approved operator, never a web route.
import {Pool} from "pg";
import type {PoolClient} from "pg";

export interface SafetyOperatorOptions {databaseUrl:string;namespace:string;operatorLabel:string}
const uuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
function validate(o:SafetyOperatorOptions){
 if(!o.databaseUrl||!/^[a-z0-9:_-]{1,96}$/i.test(o.namespace)||
   !/^[A-Za-z0-9_-]{3,64}$/.test(o.operatorLabel))throw Error("invalid_safety_operator");
}
export async function safeSafetyRole(db:PoolClient):Promise<boolean>{
 try{
  const r=await db.query<{safe:boolean}>(
   "SELECT (r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls "+
   "AND NOT r.rolcreaterole AND NOT r.rolcreatedb AND session_user=current_user "+
   "AND current_setting('row_security')='on' "+
   "AND pg_has_role(current_user,'luemi_safety_operator','member') "+
   "AND NOT pg_has_role(current_user,'luemi_safety_appeal','member') "+
   "AND NOT pg_has_role(current_user,'luemi_auth_issuer','member') "+
   "AND NOT pg_has_role(current_user,'luemi_request','member') "+
   "AND NOT pg_has_role(current_user,'luemi_human_moderator','member') "+
   "AND NOT pg_has_role(current_user,'luemi_moderator','member') "+
   "AND NOT pg_has_role(current_user,'luemi_erasure_worker','member') "+
   "AND NOT pg_has_role(current_user,'luemi_erasure_requester','member') "+
   "AND NOT pg_has_role(current_user,'luemi_media_worker','member') "+
   "AND NOT pg_has_role(current_user,'luemi_profile_publisher','member') "+
   "AND NOT pg_has_role(current_user,'luemi_discovery_reader','member') "+
   "AND NOT pg_has_role(current_user,'luemi_geo_budget','member') "+

   "AND NOT pg_has_role(current_user,'luemi_invite_operator','member') "+
   "AND NOT pg_has_role(current_user,'pg_read_all_data','member') "+
   "AND NOT pg_has_role(current_user,'pg_write_all_data','member') "+
   "AND row_security_active('luemi_private.actors'::regclass) "+
   "AND row_security_active('luemi_private.sessions'::regclass) "+
   "AND row_security_active('luemi_private.account_enforcements'::regclass) "+
   "AND row_security_active('luemi_private.account_appeals'::regclass) "+
   "AND NOT has_schema_privilege(current_user,'luemi_private','CREATE') "+
   "AND NOT has_table_privilege(current_user,'luemi_private.actors','DELETE') "+
   "AND NOT has_table_privilege(current_user,'luemi_private.sessions','DELETE') "+
   "AND NOT has_table_privilege(current_user,'luemi_private.media_assets','DELETE') "+
   "AND NOT has_table_privilege(current_user,'luemi_private.private_profile_drafts','SELECT') "+
   "AND NOT has_column_privilege(current_user,'luemi_private.actors','telegram_id','SELECT') "+
   "AND NOT has_column_privilege(current_user,'luemi_private.sessions','token_hash','SELECT') "+
   ") AS safe FROM pg_roles r WHERE r.rolname=current_user");
  return r.rowCount===1&&r.rows[0].safe===true;
 }catch{return false;}
}
async function withSafety<T>(o:SafetyOperatorOptions,fn:(db:PoolClient)=>Promise<T>):Promise<T>{
 validate(o);
 const pool=new Pool({connectionString:o.databaseUrl,max:1,connectionTimeoutMillis:3000});
 try{
  const db=await pool.connect();
  try{
   if(!(await safeSafetyRole(db)))throw Error("safety_role_denied");
   await db.query("BEGIN");
   await db.query("SELECT set_config('luemi.environment',$1,true)",[o.namespace]);
   const result=await fn(db);
   await db.query("COMMIT");
   return result;
  }catch(error){await db.query("ROLLBACK").catch(()=>{});throw error;}
  finally{db.release();}
 }finally{await pool.end();}
}
const reportReasons=new Set(["spam","harassment","impersonation","unsafe_media","minor_suspected"]);
export async function suspendReportedActor(o:SafetyOperatorOptions,reportId:string,
 reason:"spam"|"harassment"|"impersonation"|"unsafe_media"|"minor_suspected"){
 if(!uuid(reportId)||!reportReasons.has(reason))throw Error("invalid_safety_case");
 return withSafety(o,async db=>{
  const report=await db.query<{subject_id:string;state:string}>(
   "SELECT subject_id,state FROM luemi_private.reports "+
   "WHERE id=$1 AND environment=$2",[reportId,o.namespace]);
  if(report.rowCount!==1||report.rows[0].state!=="triaged")
   throw Error("safety_report_not_triaged");
  const actor=report.rows[0].subject_id;
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
   [o.namespace+":"+actor+":profile_media_slots"]);
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
   [o.namespace+":"+actor+":publication"]);
  const locked=await db.query<{id:string}>(
   "SELECT id FROM luemi_private.actors WHERE id=$1 AND environment=$2 "+
   "AND status='active' FOR UPDATE",[actor,o.namespace]);
  if(locked.rowCount!==1)throw Error("safety_actor_not_active");
  const triage=await db.query(
   "SELECT 1 FROM luemi_private.human_report_reviews "+
   "WHERE report_id=$1 AND environment=$2 AND action='triaged'",
   [reportId,o.namespace]);
  if(triage.rowCount!==1)throw Error("safety_human_review_required");
  const r=await db.query<{id:string}>(
   "INSERT INTO luemi_private.account_enforcements "+
   "(environment,actor_id,report_id,reason_code,operator_label) "+
   "VALUES($1,$2,$3,$4,$5) RETURNING id",
   [o.namespace,actor,reportId,reason,o.operatorLabel]);
  if(r.rowCount!==1)throw Error("safety_case_failed");
  await db.query("UPDATE luemi_private.media_assets SET publication_status='private',state='revoked' "+
   "WHERE owner_id=$1 AND environment=$2 AND publication_status='published'",
   [actor,o.namespace]);
  await db.query("UPDATE luemi_private.public_profiles SET publication_status='hidden' "+
   "WHERE owner_id=$1 AND environment=$2",[actor,o.namespace]);
  await db.query("UPDATE luemi_private.sessions SET revoked_at=clock_timestamp() "+
   "WHERE actor_id=$1 AND environment=$2 AND revoked_at IS NULL",[actor,o.namespace]);
  const status=await db.query("UPDATE luemi_private.actors SET status='suspended' "+
   "WHERE id=$1 AND environment=$2 AND status='active' RETURNING id",
   [actor,o.namespace]);
  if(status.rowCount!==1)throw Error("safety_status_race");
  const reportDone=await db.query("UPDATE luemi_private.reports SET state='actioned' "+
   "WHERE id=$1 AND environment=$2 AND state='triaged' RETURNING id",[reportId,o.namespace]);
  if(reportDone.rowCount!==1)throw Error("safety_report_race");
  return{state:"suspended",caseId:r.rows[0].id};
 });
}
export async function pendingSafetyAppeals(o:SafetyOperatorOptions){
 return withSafety(o,async db=>{
  const x=await db.query<{id:string;case_id:string;statement:string;submitted_at:string}>(
   "SELECT a.id,a.enforcement_id AS case_id,a.statement,a.submitted_at::text "+
   "FROM luemi_private.account_appeals a WHERE a.environment=$1 AND a.state='pending' "+
   "ORDER BY a.submitted_at,a.id LIMIT 20",[o.namespace]);
  return x.rows;
 });
}
export async function decideSafetyAppeal(o:SafetyOperatorOptions,appealId:string,
 outcome:"accepted"|"rejected",reason:string){
 if(!uuid(appealId)||reason.trim()!==reason||reason.length<10||reason.length>500)
  throw Error("invalid_safety_appeal_decision");
 return withSafety(o,async db=>{
  const appeal=await db.query<{actor_id:string;enforcement_id:string}>(
   "SELECT actor_id,enforcement_id FROM luemi_private.account_appeals "+
   "WHERE id=$1 AND environment=$2 AND state='pending'",[appealId,o.namespace]);
  if(appeal.rowCount!==1)throw Error("safety_appeal_not_pending");
  const actor=appeal.rows[0].actor_id;
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
   [o.namespace+":"+actor+":profile_media_slots"]);
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
   [o.namespace+":"+actor+":publication"]);
  const lock=await db.query("SELECT id FROM luemi_private.actors "+
   "WHERE id=$1 AND environment=$2 AND status='suspended' FOR UPDATE",[actor,o.namespace]);
  if(lock.rowCount!==1)throw Error("safety_account_not_suspended");
  const act=await db.query("SELECT id FROM luemi_private.account_enforcements "+
   "WHERE id=$1 AND actor_id=$2 AND environment=$3 AND state='suspended' FOR UPDATE",
   [appeal.rows[0].enforcement_id,actor,o.namespace]);
  if(act.rowCount!==1)throw Error("safety_case_not_active");
  const q=await db.query(
   "UPDATE luemi_private.account_appeals SET state=$2,reviewer_label=$3,"+
   "review_reason=$4,reviewed_at=clock_timestamp() "+
   "WHERE id=$1 AND environment=$5 AND state='pending' RETURNING id",
   [appealId,outcome,o.operatorLabel,reason,o.namespace]);
  if(q.rowCount!==1)throw Error("safety_appeal_conflict");
  if(outcome==="accepted"){
   const restored=await db.query(
    "UPDATE luemi_private.account_enforcements SET state='restored',"+
    "restored_at=clock_timestamp(),restored_by=$2 WHERE id=$1 AND state='suspended' RETURNING id",
    [appeal.rows[0].enforcement_id,o.operatorLabel]);
   const active=await db.query(
    "UPDATE luemi_private.actors SET status='active' "+
    "WHERE id=$1 AND environment=$2 AND status='suspended' RETURNING id",[actor,o.namespace]);
   if(restored.rowCount!==1||active.rowCount!==1)throw Error("safety_restore_failed");
   // Never restore previous cookies, published photos or profile visibility.
  }
  return{state:outcome};
 });
}
