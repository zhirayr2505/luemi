// REM-05D shared private media engine. Synthetic test mode remains default-OFF;
 // REAL-REG-01C may opt into durable PRIVATE-ONLY storage after separate gates.
import {createHash,randomBytes,randomUUID,timingSafeEqual} from "node:crypto";
import {Pool} from "pg";
import type {PoolClient} from "pg";
import type {FastifyInstance,FastifyReply,FastifyRequest} from "fastify";
import {sanitizePng} from "./rem05d-image.js";
const MAX_BYTES=1_048_576;
type Guard={read:(req:FastifyRequest,reply:FastifyReply)=>Promise<void>;
 mutation:(req:FastifyRequest,reply:FastifyReply)=>Promise<void>};
export type PrivateObjectStore={put:(key:string,bytes:Buffer)=>Promise<void>;get:(key:string)=>Promise<Buffer|null>;
 delete:(key:string)=>Promise<void>};
export type Rem05dOptions={enabled:boolean;requestDatabaseUrl:string;workerDatabaseUrl:string;
 namespace:string;consentVersion:string;storage:PrivateObjectStore;testOnly?:true;durablePrivateOnly?:true;instantAcceptance?:true};
class Rejection extends Error{constructor(public status:number,public code:string){super(code);}}
function reject(status:number,code:string):never{throw new Rejection(status,code);}
function digest(text:string){return createHash("sha256").update(text).digest("hex");}
function object(x:unknown):x is Record<string,unknown>{
 return !!x&&typeof x==="object"&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
}
function uuid(x:unknown):x is string{return typeof x==="string"&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);}
function str(x:unknown,min:number,max:number){return typeof x==="string"&&Array.from(x).length>=min&&Array.from(x).length<=max&&x.trim()===x;}
function age18(iso:string):boolean{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso))return false;
 const d=new Date(iso+"T00:00:00.000Z");
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==iso)return false;
 const today=new Date();
 const year=today.getUTCFullYear()-d.getUTCFullYear();
 const month=today.getUTCMonth()+1-(d.getUTCMonth()+1);
 return(year>18||year===18&&(month>0||month===0&&today.getUTCDate()>=d.getUTCDate()))
  &&year<130;
}
const FIELDS=new Set(["displayName","birthDate","consentVersion","city","countryCode",
 "interests","about","languages","goal"]);
function validatedDraft(raw:unknown,approvedConsent:string){
 if(!object(raw)||Object.keys(raw).length>FIELDS.size||Object.keys(raw).some(k=>!FIELDS.has(k)))
  reject(422,"invalid_draft");
 const p:Record<string,unknown>={};
 for(const [key,value] of Object.entries(raw)){
  if(key==="displayName"&&str(value,2,48))p[key]=value;
  else if(key==="birthDate"&&typeof value==="string"&&age18(value))p[key]=value;
  else if(key==="consentVersion"&&value===approvedConsent)p[key]=value;
  else if(key==="about"&&str(value,0,750))p[key]=value;
  else if(key==="city"&&str(value,1,120))p[key]=value;
  else if(key==="countryCode"&&typeof value==="string"&&/^[A-Z]{2}$/.test(value))p[key]=value;
  else if(key==="goal"&&str(value,1,80))p[key]=value;
  else if((key==="interests"||key==="languages")&&Array.isArray(value)&&
    value.length<=(key==="interests"?15:10)&&new Set(value).size===value.length&&
    value.every(v=>str(v,1,40)))p[key]=value;
  else reject(422,"invalid_draft");
 }
 if(Buffer.byteLength(JSON.stringify(p))>7000)reject(413,"draft_too_large");
 return p;
}
export async function safeDb(db:PoolClient,kind:"luemi_request"|"luemi_media_worker"|"luemi_moderator"){
 try{
  const q=await db.query<{safe:boolean}>(`
    SELECT(r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls
      AND NOT r.rolcreaterole AND NOT r.rolcreatedb
      AND session_user=current_user AND current_setting('row_security')='on'
      AND pg_has_role(current_user,$1::name,'member')
      AND NOT pg_has_role(current_user,'luemi_auth_issuer','member')
      AND NOT pg_has_role(current_user,'luemi_geo_budget','member')
      AND (CASE WHEN $1='luemi_request' THEN
        NOT pg_has_role(current_user,'luemi_media_worker','member')
        AND NOT pg_has_role(current_user,'luemi_moderator','member')
        ELSE NOT pg_has_role(current_user,'luemi_request','member')
        AND NOT pg_has_role(current_user,
         CASE WHEN $1='luemi_media_worker' THEN 'luemi_moderator' ELSE 'luemi_media_worker' END::name,'member') END)
      AND NOT pg_has_role(current_user,'pg_read_all_data','member')
      AND NOT pg_has_role(current_user,'pg_write_all_data','member')
      AND NOT pg_has_role(current_user,'pg_read_server_files','member')
      AND NOT pg_has_role(current_user,'pg_write_server_files','member')
      AND NOT pg_has_role(current_user,'pg_execute_server_program','member')
      AND NOT has_schema_privilege(current_user,'luemi_private','CREATE')
      AND NOT EXISTS(SELECT 1 FROM pg_class c
        WHERE c.oid IN ('luemi_private.private_profile_drafts'::regclass,
          'luemi_private.public_profiles'::regclass,'luemi_private.media_assets'::regclass,
          'luemi_private.media_uploads'::regclass,'luemi_private.moderation_jobs'::regclass,
          'luemi_private.moderation_decisions'::regclass,'luemi_private.blocks'::regclass,
          'luemi_private.reports'::regclass,'luemi_private.audit_events'::regclass)
          AND c.relowner=r.oid)
      AND (SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity AND row_security_active(c.oid))
        FROM pg_class c WHERE c.oid IN ('luemi_private.private_profile_drafts'::regclass,
          'luemi_private.public_profiles'::regclass,'luemi_private.media_assets'::regclass,
          'luemi_private.media_uploads'::regclass,'luemi_private.moderation_jobs'::regclass,
          'luemi_private.moderation_decisions'::regclass,'luemi_private.blocks'::regclass,
          'luemi_private.reports'::regclass,'luemi_private.audit_events'::regclass))
      AND (CASE WHEN $1='luemi_request' THEN
         NOT has_table_privilege(current_user,'luemi_private.moderation_decisions','SELECT')
         AND NOT has_table_privilege(current_user,'luemi_private.audit_events','SELECT')
         AND NOT has_table_privilege(current_user,'luemi_private.media_assets','UPDATE')
         AND NOT has_table_privilege(current_user,'luemi_private.public_profiles','INSERT')
         AND NOT has_table_privilege(current_user,'luemi_private.public_profiles','UPDATE')
         AND NOT has_table_privilege(current_user,'luemi_private.sessions','SELECT')
         AND NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE
           a.attrelid IN ('luemi_private.sessions'::regclass,
            'luemi_private.moderation_jobs'::regclass,
            'luemi_private.moderation_decisions'::regclass,
            'luemi_private.audit_events'::regclass)
           AND a.attnum>0 AND NOT a.attisdropped
           AND has_column_privilege(current_user,a.attrelid,a.attname,'SELECT'))
         AND NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE
           a.attrelid IN ('luemi_private.public_profiles'::regclass,
            'luemi_private.moderation_decisions'::regclass,
            'luemi_private.audit_events'::regclass)
           AND a.attnum>0 AND NOT a.attisdropped
           AND (has_column_privilege(current_user,a.attrelid,a.attname,'INSERT')
            OR has_column_privilege(current_user,a.attrelid,a.attname,'UPDATE')))
         ELSE NOT has_table_privilege(current_user,'luemi_private.sessions','SELECT')
          AND NOT has_table_privilege(current_user,'luemi_private.actors','SELECT')
          AND NOT has_table_privilege(current_user,'luemi_private.private_profile_drafts','SELECT')
          AND NOT has_table_privilege(current_user,'luemi_private.reports','SELECT')
          AND NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE
            a.attrelid IN ('luemi_private.actors'::regclass,
             'luemi_private.sessions'::regclass,
             'luemi_private.private_profile_drafts'::regclass,
             'luemi_private.reports'::regclass)
            AND a.attnum>0 AND NOT a.attisdropped
            AND (has_column_privilege(current_user,a.attrelid,a.attname,'SELECT')
             OR has_column_privilege(current_user,a.attrelid,a.attname,'INSERT')
             OR has_column_privilege(current_user,a.attrelid,a.attname,'UPDATE')))
       END)
    ) AS safe FROM pg_roles r WHERE r.rolname=current_user`,[kind]);
  return q.rowCount===1&&q.rows[0].safe===true;
 }catch{return false;}
}
function statusError(reply:FastifyReply,error:unknown){
 if(error instanceof Rejection)return reply.code(error.status).send({error:error.code});
 // Never send raw SQL, object names, keys, or another owner's existence.
 return reply.code(503).send({error:"service_unavailable"});
}
export function memoryPrivateStore():PrivateObjectStore{
 const objects=new Map<string,Buffer>();
 return{put:async(k,v)=>{if(objects.has(k))throw new Error("storage_collision");objects.set(k,Buffer.from(v));},
 get:async(k)=>objects.has(k)?Buffer.from(objects.get(k)!):null,
 delete:async(k)=>{objects.delete(k);}};
}
export function registerRem05d(app:FastifyInstance,guard:Guard|undefined,opts:Rem05dOptions|undefined){
 if(!opts?.enabled)return;
 const exactlyOneMode=(opts.testOnly===true)!==(opts.durablePrivateOnly===true);
 if(!guard||!exactlyOneMode||!opts.requestDatabaseUrl||!opts.workerDatabaseUrl||
  !/^[\w:-]{1,96}$/.test(opts.namespace)||!str(opts.consentVersion,3,64)||
  !opts.storage||typeof opts.storage.delete!=="function")
   throw new Error("Private media requires one explicit mode, isolated roles and a private store");
 const cfg=opts;
 const auth=guard;
 const requestPool=new Pool({connectionString:opts.requestDatabaseUrl,max:5,connectionTimeoutMillis:3000});
 const workerPool=new Pool({connectionString:opts.workerDatabaseUrl,max:3,connectionTimeoutMillis:3000});
 app.addHook("onClose",async()=>{await Promise.all([requestPool.end(),workerPool.end()]);});
 // Chat photos and profile photos share Fastify's per-scope PNG parser.
 // The route below still enforces its stricter MAX_BYTES (1 MiB) bodyLimit.
 // Registration must be idempotent whichever feature attaches first.
 if(!app.hasContentTypeParser("image/png"))
  app.addContentTypeParser("image/png",{parseAs:"buffer",bodyLimit:10*1024*1024},
   (_req,body,done)=>done(null,body));
 async function owner<T>(req:FastifyRequest,reply:FastifyReply,
  fn:(db:PoolClient,id:string)=>Promise<T>):Promise<T|FastifyReply>{
  const db=await requestPool.connect().catch(()=>null);
  if(!db)return reply.code(503).send({error:"service_unavailable"});
  const initial=req.authActor;
  if(!initial){db.release();return reply.code(401).send({error:"unauthorized"});}
  try{
   if(!await safeDb(db,"luemi_request"))reject(503,"service_unavailable");
   await db.query("BEGIN");
   await db.query("SELECT set_config('luemi.actor_id',$1,true)",[initial.actorId]);
   await db.query("SELECT set_config('luemi.environment',$1,true)",[cfg.namespace]);
   const active=await db.query("SELECT id FROM luemi_private.actors WHERE id=$1 AND environment=$2 AND status='active'",
     [initial.actorId,cfg.namespace]);
   if(active.rowCount!==1)reject(401,"unauthorized");
   // Secure server-side gate: a signed session alone never authorizes storage.
   if(cfg.durablePrivateOnly){
    const consent=await db.query(
     "SELECT 1 FROM luemi_private.private_profile_drafts WHERE owner_id=$1 "+
     "AND environment=$2 AND consent_version=$3 "+
     "AND birth_date IS NOT NULL AND birth_date <= "+
     "((clock_timestamp() AT TIME ZONE 'UTC')::date - interval '18 years')",
     [initial.actorId,cfg.namespace,cfg.consentVersion]);
    if(consent.rowCount!==1)reject(403,"consent_required");
   }
   const output=await fn(db,initial.actorId);
   // Revalidate the exact session generation BEFORE committing any user write.
   // A concurrent logout/ban during the SQL work must roll this transaction back.
   await auth.read(req,reply);
   if(reply.sent){await db.query("ROLLBACK");return reply;}
   if(req.authActor?.actorId!==initial.actorId||req.authActor.sessionId!==initial.sessionId||
      !timingSafeEqual(req.authActor.hash,initial.hash))reject(401,"unauthorized");
   await db.query("COMMIT");
   return output;
  }catch(e){
   await db.query("ROLLBACK").catch(()=>{});
   return statusError(reply,e);
  }finally{db.release();}
 }
 async function worker<T>(fn:(db:PoolClient)=>Promise<T>,onCommit?:()=>void):Promise<T>{
  const db=await workerPool.connect();
  try{
   if(!await safeDb(db,"luemi_media_worker"))reject(503,"service_unavailable");
   await db.query("BEGIN");
   const output=await fn(db);
   await db.query("COMMIT");onCommit?.();return output;
  }catch(e){await db.query("ROLLBACK").catch(()=>{});throw e;}
  finally{db.release();}
 }
 app.get("/api/v2/profile/draft",{preHandler:guard.read},async(req,reply)=>owner(req,reply,async(db,id)=>{
  const q=await db.query<{revision:string;payload:Record<string,unknown>;birth_date:string|null;consent_version:string|null}>(
   "SELECT revision::text,payload,birth_date::text,consent_version FROM luemi_private.private_profile_drafts WHERE owner_id=$1 AND environment=$2",
   [id,opts.namespace]);
  return q.rowCount===1?{state:"private",revision:Number(q.rows[0].revision),
   fields:{...q.rows[0].payload,...(q.rows[0].birth_date?{birthDate:q.rows[0].birth_date}:{}),
    ...(q.rows[0].consent_version?{consentVersion:q.rows[0].consent_version}:{})}}:
   {state:"empty",revision:0,fields:{}};
 }));
 app.put<{Body:unknown}>("/api/v2/profile/draft",{preHandler:guard.mutation},async(req,reply)=>owner(req,reply,async(db,id)=>{
  if(!object(req.body)||Object.keys(req.body).some(k=>k!=="revision"&&k!=="fields")||
    !Number.isSafeInteger(req.body.revision)||Number(req.body.revision)<0)reject(422,"invalid_draft");
  const fields=validatedDraft(req.body.fields,opts.consentVersion);
  const revision=Number(req.body.revision);
  if(revision===0){
   const result=await db.query("INSERT INTO luemi_private.private_profile_drafts(owner_id,environment,revision,payload,birth_date,consent_version) "+
    "VALUES($1,$2,1,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING revision",
    [id,opts.namespace,JSON.stringify(Object.fromEntries(Object.entries(fields).filter(([k])=>k!=="birthDate"&&k!=="consentVersion"))),
     fields.birthDate??null,fields.consentVersion??null]);
   if(result.rowCount===0)reject(409,"revision_conflict");
   return{state:"private",revision:1};
  }
  const result=await db.query("UPDATE luemi_private.private_profile_drafts SET revision=revision+1,"+
   "payload=$3,birth_date=$4,consent_version=$5,updated_at=clock_timestamp() "+
   "WHERE owner_id=$1 AND environment=$2 AND revision=$6 RETURNING revision",
   [id,opts.namespace,JSON.stringify(Object.fromEntries(Object.entries(fields).filter(([k])=>k!=="birthDate"&&k!=="consentVersion"))),
    fields.birthDate??null,fields.consentVersion??null,revision]);
  if(result.rowCount===0)reject(409,"revision_conflict");
  return{state:"private",revision:Number(result.rows[0].revision)};
 }));
 app.get("/api/v2/profile/preview",{preHandler:guard.read},async(req,reply)=>owner(req,reply,async(db,id)=>{
  const q=await db.query<{revision:string;payload:Record<string,unknown>}>(
   "SELECT revision::text,payload FROM luemi_private.private_profile_drafts WHERE owner_id=$1 AND environment=$2",
   [id,opts.namespace]);
  const m=await db.query<{id:string;state:string;generation:number}>(
   "SELECT id,state,generation FROM luemi_private.media_assets WHERE owner_id=$1 AND environment=$2 ORDER BY position,id",
   [id,opts.namespace]);
  return{status:"unpublished",revision:q.rowCount?Number(q.rows[0].revision):0,
   preview:q.rowCount?{...q.rows[0].payload}:null,
   photos:m.rows.map(x=>({id:x.id,state:x.state,version:x.generation})),publish:false};
 }));
 app.get<{Params:{id:string}}>("/api/v2/profile/public/:id",{preHandler:guard.read},async(_req,reply)=>
  reply.code(404).send({error:"not_found"}));
 app.post("/api/v2/profile/submit",{preHandler:guard.mutation},async(_req,reply)=>
  reply.code(403).send({error:"publication_disabled"}));
 app.post<{Body:unknown}>("/api/v2/media/intents",{preHandler:guard.mutation},async(req,reply)=>owner(req,reply,async(db,id)=>{
  if(!object(req.body)||Object.keys(req.body).some(k=>!["bytes","mime","clientKey"].includes(k))||
    req.body.mime!=="image/png"||!Number.isSafeInteger(req.body.bytes)||
    Number(req.body.bytes)<1||Number(req.body.bytes)>MAX_BYTES||
    !str(req.body.clientKey,8,80))reject(422,"invalid_intent");
  const bytes=Number(req.body.bytes),key=String(req.body.clientKey);
  const keyDigest=digest(key),bodyDigest=digest(JSON.stringify([bytes,"image/png"]));
  // Serialize all concurrent intents for this owner in the DATABASE, not process memory.
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
   [opts.namespace+":"+id+":profile_media_slots"]);
  const existing=await db.query<{asset_id:string;expected_bytes:number;request_digest:string;state:string}>(
   "SELECT asset_id,expected_bytes,request_digest,state FROM luemi_private.media_uploads "+
   "WHERE owner_id=$1 AND environment=$2 AND idempotency_digest=$3",
   [id,opts.namespace,keyDigest]);
  if(existing.rowCount){
   if(existing.rows[0].request_digest!==bodyDigest)reject(409,"idempotency_conflict");
   if(existing.rows[0].state==="reserved"){
    // The caller may return hours after a network interruption. Renew ONLY
    // the same pending asset/clientKey under the requester's existing RLS
    // and advisory owner lock. Never allocate another slot or touch media
    // already received / submitted for review.
    await db.query("UPDATE luemi_private.media_uploads SET "+
     "expires_at=clock_timestamp()+interval '1 hour' "+
     "WHERE owner_id=$1 AND environment=$2 AND idempotency_digest=$3 "+
     "AND state='reserved' AND expires_at<=clock_timestamp() "+
     "AND EXISTS(SELECT 1 FROM luemi_private.media_assets a "+
     "WHERE a.id=asset_id AND a.owner_id=$1 AND a.environment=$2 AND a.state='reserved')",
     [id,opts.namespace,keyDigest]);
   }
   return{assetId:existing.rows[0].asset_id,state:existing.rows[0].state,upload:"private_proxy"};
  }
  const used=await db.query<{n:string}>(
   "SELECT count(*)::text AS n FROM luemi_private.media_assets WHERE owner_id=$1 AND environment=$2 AND state<>'revoked'",
   [id,opts.namespace]);
  if(Number(used.rows[0].n)>=6)reject(409,"photo_limit");
  const assetId=randomUUID(),intentId=randomUUID();
  const prefix="private/"+opts.namespace+"/"+id+"/"+assetId+"/"+randomBytes(24).toString("hex");
  await db.query("INSERT INTO luemi_private.media_assets(id,owner_id,environment,original_key,derivative_key,position) "+
   "VALUES($1,$2,$3,$4,$5,$6)",[assetId,id,opts.namespace,prefix+"/original",prefix+"/sanitized",Number(used.rows[0].n)]);
  await db.query("INSERT INTO luemi_private.media_uploads(id,asset_id,owner_id,environment,expected_bytes,expected_mime,idempotency_digest,request_digest,expires_at) "+
   "VALUES($1,$2,$3,$4,$5,'image/png',$6,$7,clock_timestamp()+interval '1 hour')",
   [intentId,assetId,id,opts.namespace,bytes,keyDigest,bodyDigest]);
  return{assetId,state:"reserved",upload:"private_proxy"};
 }));
 app.put<{Params:{id:string};Body:Buffer}>("/api/v2/media/:id/bytes",
 {preHandler:guard.mutation,bodyLimit:MAX_BYTES},async(req,reply)=>{
  if(!uuid(req.params.id)||!Buffer.isBuffer(req.body))
   return reply.code(422).send({error:"invalid_image"});
  const verify=await owner(req,reply,async(db,id)=>{
   const q=await db.query<{asset_id:string;owner_id:string;expected_bytes:number;state:string;expires_at:string}>(
    "SELECT u.asset_id,u.owner_id,u.expected_bytes,u.state,u.expires_at::text "+
    "FROM luemi_private.media_uploads u JOIN luemi_private.media_assets a ON a.id=u.asset_id "+
    "WHERE u.asset_id=$1 AND u.owner_id=$2 AND u.environment=$3 AND a.state='reserved'",
    [req.params.id,id,opts.namespace]);
   if(!q.rowCount)reject(404,"not_found");
   if(q.rows[0].state!=="reserved")reject(409,"intent_consumed");
   if(Date.parse(q.rows[0].expires_at)<=Date.now())reject(409,"intent_expired");
   if(q.rows[0].expected_bytes!==req.body.length)reject(422,"invalid_image");
   return{id};
  });
  if(reply.sent||!("id" in verify))return verify;
  let clean:ReturnType<typeof sanitizePng>;
  try{clean=sanitizePng(req.body);}catch{return reply.code(422).send({error:"invalid_image"});}
  // Preserve the original authorized token generation across the storage/worker
  // boundary. The request and worker principals remain deliberately disjoint.
  const uploadActor=req.authActor;
  let stagedKey:string|undefined;
  let workerCommitted=false;
  try{
   const changed=await worker(async db=>{
    // Identical per-owner lock and order as erasure requests/media intents.
    // Once deletion commits, revalidation below prevents a late Storage PUT.
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
     [opts.namespace+":"+verify.id+":profile_media_slots"]);
    const row=await db.query<{original_key:string;derivative_key:string;owner_id:string}>(
     "SELECT a.original_key,a.derivative_key,a.owner_id FROM luemi_private.media_assets a "+
     "JOIN luemi_private.media_uploads u ON u.asset_id=a.id "+
     "WHERE a.id=$1 AND a.owner_id=$2 AND a.environment=$3 AND a.state='reserved' "+
     "AND u.state='reserved' AND u.expires_at>clock_timestamp() FOR UPDATE OF a,u",
     [req.params.id,verify.id,opts.namespace]);
    if(!row.rowCount)reject(409,"intent_consumed");
    const m=row.rows[0];
    // A delete request may have committed while this upload was waiting for
    // the per-owner lock. Reject before any external Storage operation.
    await auth.read(req,reply);
    if(reply.sent||!uploadActor||!req.authActor||
      req.authActor.actorId!==uploadActor.actorId||
      req.authActor.sessionId!==uploadActor.sessionId||
      !timingSafeEqual(req.authActor.hash,uploadActor.hash))
       reject(401,"unauthorized");
    // Object store writes are NOT transactional with PostgreSQL. Any failure
    // after this point requires best-effort compensating deletion.
    stagedKey=m.derivative_key;
    await opts.storage.put(m.derivative_key,clean.bytes);
    // "approved" in this opt-in mode means sanitized bytes accepted, not a human decision.
    const receivedState=opts.instantAcceptance===true?"approved":"pending_review";
    await db.query("UPDATE luemi_private.media_assets SET state=$6,"+
     "actual_mime='image/png',byte_count=$2,width=$3,height=$4,content_sha256=$5 WHERE id=$1",
     [req.params.id,clean.bytes.length,clean.width,clean.height,
      createHash("sha256").update(clean.bytes).digest("hex"),receivedState]);
    await db.query("UPDATE luemi_private.media_uploads SET state='received' WHERE asset_id=$1",[req.params.id]);
    if(!opts.instantAcceptance)
     await db.query("INSERT INTO luemi_private.moderation_jobs(asset_id,generation) VALUES($1,1) ON CONFLICT DO NOTHING",
      [req.params.id]);
    // Critical D-R4 boundary: revalidate the *original* actor/session/token
    // after all async storage and SQL work but BEFORE the worker commits.
    // The issuer checks its own session tables; worker gets NO session grants.
    await auth.read(req,reply);
    if(reply.sent||!uploadActor||!req.authActor||
      req.authActor.actorId!==uploadActor.actorId||
      req.authActor.sessionId!==uploadActor.sessionId||
      !timingSafeEqual(req.authActor.hash,uploadActor.hash))
       reject(401,"unauthorized");
    return true;
   },()=>{workerCommitted=true;});
   if(!changed)reject(503,"service_unavailable");
   await guard.read(req,reply);
   if(reply.sent)return reply;
   return{assetId:req.params.id,status:opts.instantAcceptance?"approved":"pending_review",published:false};
  }catch(e){
   if(!workerCommitted&&stagedKey){
    // Rollback cannot undo the already-written object. The private adapter
    // must support idempotent deletion; failure leaves a private orphan only,
    // not an actionable SQL media or moderation state. Durable cleanup is
    // NOT implemented in this isolated mock prototype.
    try{await opts.storage.delete(stagedKey);}catch{/* fail-closed SQL state; cleanup needed */}
   }
   if(reply.sent)return reply;
   return statusError(reply,e);
  }
 });
 // Background registration photos are reversible until the profile is
 // published. The owner can withdraw an individual selection immediately.
 // Revoke RLS-visible media BEFORE deleting Storage objects; never publish
 // a stale in-flight upload. The metadata tombstone makes deletion retries
 // safe even if the object store temporarily fails.
 app.delete<{Params:{clientPhotoId:string}}>("/api/v2/media/by-client/:clientPhotoId",
 {preHandler:guard.mutation},async(req,reply)=>{
  if(!uuid(req.params.clientPhotoId))return reply.code(422).send({error:"invalid_photo"});
  const original=req.authActor;
  const lookup=await owner(req,reply,async(db,id)=>{
   const hash=digest("reg01c-photo-"+req.params.clientPhotoId);
   const q=await db.query<{asset_id:string}>(
    "SELECT u.asset_id FROM luemi_private.media_uploads u "+
    "JOIN luemi_private.media_assets a ON a.id=u.asset_id "+
    "WHERE u.owner_id=$1 AND u.environment=$2 AND u.idempotency_digest=$3 "+
    "AND a.owner_id=$1 AND a.environment=$2 AND a.publication_status='private'",
    [id,opts.namespace,hash]);
   return{actorId:id,assetId:q.rowCount?q.rows[0].asset_id:null};
  });
  if(reply.sent||!("actorId" in lookup))return lookup;
  if(!lookup.assetId)return{deleted:true,found:false};
  try{
   const removed=await worker(async db=>{
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
     [opts.namespace+":"+lookup.actorId+":profile_media_slots"]);
    const row=await db.query<{original_key:string;derivative_key:string;state:string}>(
     "SELECT original_key,derivative_key,state FROM luemi_private.media_assets "+
     "WHERE id=$1 AND owner_id=$2 AND environment=$3 AND publication_status='private' FOR UPDATE",
     [lookup.assetId,lookup.actorId,opts.namespace]);
    if(!row.rowCount)reject(409,"already_published_or_deleted");
    if(row.rows[0].state!=="revoked")
     await db.query("UPDATE luemi_private.media_assets "+
      "SET state='revoked',generation=generation+1 "+
      "WHERE id=$1 AND owner_id=$2 AND environment=$3 AND publication_status='private'",
      [lookup.assetId,lookup.actorId,opts.namespace]);
    // Even a delayed external object deletion must not occur after the
    // original session has been revoked.
    await auth.read(req,reply);
    if(reply.sent||!original||!req.authActor||
      req.authActor.actorId!==original.actorId||
      req.authActor.sessionId!==original.sessionId||
      !timingSafeEqual(req.authActor.hash,original.hash))
      reject(401,"unauthorized");
    return row.rows[0];
   });
   // Deleted objects are unreachable by any API as soon as SQL commits.
   // Physical removal follows; retrying the same request is idempotent.
   await opts.storage.delete(removed.original_key);
   await opts.storage.delete(removed.derivative_key);
   return{deleted:true,found:true};
  }catch(e){
   if(reply.sent)return reply;
   return statusError(reply,e);
  }
 });
 app.put<{Body:unknown}>("/api/v2/profile/photos/order",
 {preHandler:guard.mutation},async(req,reply)=>owner(req,reply,async(db,id)=>{
  if(!object(req.body)||Object.keys(req.body).some(k=>k!=="ids")||
    !Array.isArray(req.body.ids)||req.body.ids.length<1||req.body.ids.length>6||
    req.body.ids.some(v=>!uuid(v))||
    new Set(req.body.ids).size!==req.body.ids.length)reject(422,"invalid_photo_order");
  const ids=req.body.ids as string[];
  // An unchanged set prevents hiding extra server images behind the preview
  // and keeps the first listed image as the actual primary photo.
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [opts.namespace+":"+id+":profile_media_slots"]);
  const rows=await db.query<{id:string}>(
   "SELECT id FROM luemi_private.media_assets "+
   "WHERE owner_id=$1 AND environment=$2 AND publication_status='private' "+
   "AND state='approved' ORDER BY position,id",[id,opts.namespace]);
  if(rows.rowCount!==ids.length||
    rows.rows.some(row=>!ids.includes(row.id)))reject(409,"photo_manifest_changed");
  for(let i=0;i<ids.length;i++)
   await db.query("UPDATE luemi_private.media_assets SET position=$4 "+
    "WHERE id=$1 AND owner_id=$2 AND environment=$3 AND state='approved' "+
    "AND publication_status='private'",
    [ids[i],id,opts.namespace,i]);
  return{ok:true,primaryId:ids[0],count:ids.length};
 }));
 app.get<{Params:{id:string}}>("/api/v2/media/:id",{preHandler:guard.read},async(req,reply)=>{
  if(!uuid(req.params.id))return reply.code(404).send({error:"not_found"});
  const record=await owner(req,reply,async(db,id)=>{
   const q=await db.query<{derivative_key:string;generation:number;state:string}>(
    "SELECT derivative_key,generation,state FROM luemi_private.media_assets "+
    "WHERE id=$1 AND owner_id=$2 AND environment=$3 AND state='approved' "+
    "AND publication_status IN ('private','published')",
    [req.params.id,id,opts.namespace]);
   if(!q.rowCount)reject(404,"not_found");
   return q.rows[0];
  });
  if(reply.sent||!("derivative_key" in record))return record;
  try{
   const bytes=await opts.storage.get(record.derivative_key);
   if(!bytes)return reply.code(503).send({error:"media_unavailable"});
   // Object read may be delayed. Revalidate current ownership, moderation,
   // version and revocation after fetching pixels, before emitting any bytes.
   const rechecked=await owner(req,reply,async(db,id)=>{
    const q=await db.query(
     "SELECT id FROM luemi_private.media_assets WHERE id=$1 AND owner_id=$2 "+
     "AND environment=$3 AND state='approved' AND publication_status IN ('private','published') "+
     "AND generation=$4 AND derivative_key=$5",
     [req.params.id,id,opts.namespace,record.generation,record.derivative_key]);
    if(!q.rowCount)reject(404,"not_found");
    return true;
   });
   if(reply.sent||rechecked!==true)return rechecked;
   return reply.header("Content-Type","image/png")
    .header("Content-Disposition","inline; filename=\"private-preview.png\"")
    .header("Cache-Control","private, no-store").send(bytes);
  }catch{return reply.code(503).send({error:"media_unavailable"});}
 });
 app.get("/api/v2/profile/blocks",{preHandler:guard.read},async(req,reply)=>owner(req,reply,async(db,id)=>{
  const q=await db.query<{blocked_id:string}>(
   "SELECT blocked_id FROM luemi_private.blocks WHERE blocker_id=$1 AND environment=$2",[id,opts.namespace]);
  return{blocks:q.rows.map(r=>r.blocked_id)};
 }));
 app.post<{Body:unknown}>("/api/v2/profile/blocks",{preHandler:guard.mutation},async(req,reply)=>owner(req,reply,async(db,id)=>{
  if(!object(req.body)||Object.keys(req.body).length!==1||!uuid(req.body.targetId)||req.body.targetId===id)
   reject(422,"invalid_target");
  const q=await db.query("INSERT INTO luemi_private.blocks(blocker_id,blocked_id,environment) "+
   "VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING blocker_id",
   [id,req.body.targetId,opts.namespace]);
  return{ok:true,created:q.rowCount===1};
 }));
 app.delete<{Params:{id:string}}>("/api/v2/profile/blocks/:id",{preHandler:guard.mutation},async(req,reply)=>owner(req,reply,async(db,id)=>{
  if(!uuid(req.params.id))reject(422,"invalid_target");
  await db.query("DELETE FROM luemi_private.blocks WHERE blocker_id=$1 AND blocked_id=$2 AND environment=$3",
   [id,req.params.id,opts.namespace]);
  return{ok:true};
 }));
 app.post<{Body:unknown}>("/api/v2/profile/reports",{preHandler:guard.mutation},async(req,reply)=>owner(req,reply,async(db,id)=>{
  if(!object(req.body)||Object.keys(req.body).some(k=>!["targetId","reason","clientRef"].includes(k))||
    !uuid(req.body.targetId)||req.body.targetId===id||
    !["spam","harassment","impersonation","unsafe_media","minor_suspected","nonconsensual_photo"].includes(String(req.body.reason))||
    !str(req.body.clientRef,8,64))reject(422,"invalid_report");
  const q=await db.query<{id:string;reason_code:string}>(
   "INSERT INTO luemi_private.reports(reporter_id,subject_id,environment,reason_code,client_ref) "+
   "VALUES($1,$2,$3,$4,$5) ON CONFLICT(reporter_id,client_ref) DO NOTHING RETURNING id,reason_code",
   [id,req.body.targetId,opts.namespace,req.body.reason,req.body.clientRef]);
  if(q.rowCount===1)return{id:q.rows[0].id,state:"open"};
  const previous=await db.query<{id:string;subject_id:string;reason_code:string}>(
   "SELECT id,subject_id,reason_code FROM luemi_private.reports "+
   "WHERE reporter_id=$1 AND client_ref=$2",[id,req.body.clientRef]);
  if(!previous.rowCount||previous.rows[0].subject_id!==req.body.targetId||
    previous.rows[0].reason_code!==req.body.reason)reject(409,"idempotency_conflict");
  return{id:previous.rows[0].id,state:"open"};
 }));
 app.get("/api/v2/profile/reports",{preHandler:guard.read},async(req,reply)=>owner(req,reply,async(db,id)=>{
  const q=await db.query<{id:string;state:string}>(
   "SELECT id,state FROM luemi_private.reports WHERE reporter_id=$1 AND environment=$2",[id,opts.namespace]);
  return{reports:q.rows};
 }));
}
// No network endpoint. Only an independently provisioned synthetic moderator login
// can execute this helper in a disposable isolated QA process, never in live API.
export async function syntheticModerate(databaseUrl:string,assetId:string,decision:"approved"|"rejected"){
 if(!uuid(assetId))throw new Error("invalid_synthetic_asset");
 const pool=new Pool({connectionString:databaseUrl,max:1,connectionTimeoutMillis:3000});
 const db=await pool.connect();
 try{
  if(!await safeDb(db,"luemi_moderator"))throw new Error("moderation_role_denied");
  await db.query("BEGIN");
  const row=await db.query<{id:string}>(
   "SELECT j.id FROM luemi_private.moderation_jobs j "+
   "JOIN luemi_private.media_assets a ON a.id=j.asset_id "+
   "WHERE a.id=$1 AND a.state='pending_review' AND j.state='pending_review' FOR UPDATE OF j,a",
   [assetId]);
  if(!row.rowCount)throw new Error("not_pending");
  await db.query("UPDATE luemi_private.media_assets SET state=$2 WHERE id=$1",[assetId,decision]);
  await db.query("UPDATE luemi_private.moderation_jobs SET state='decided' WHERE id=$1",[row.rows[0].id]);
  await db.query("INSERT INTO luemi_private.moderation_decisions(job_id,moderator_label,decision,reason_code) "+
   "VALUES($1,'isolated_ci_moderator',$2,$3)",
   [row.rows[0].id,decision,decision==="approved"?"safe_synthetic":"policy_violation"]);
  await db.query("INSERT INTO luemi_private.audit_events(event_type,resource_ref) VALUES('media_review',$1)",[assetId]);
  await db.query("COMMIT");
 }catch(e){await db.query("ROLLBACK").catch(()=>{});throw e;}
 finally{db.release();await pool.end();}
}
