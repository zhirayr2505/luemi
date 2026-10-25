// REG-01D: separate publisher and discovery PostgreSQL principals, NO public Data API.
import {timingSafeEqual} from "node:crypto";
import {Pool} from "pg";
import type {PoolClient} from "pg";
import type {FastifyInstance,FastifyReply,FastifyRequest} from "fastify";
import type {PrivateObjectStore} from "./rem05d-private.js";
import {safeDb} from "./rem05d-private.js";
export interface PublicationOptions {
 enabled:true;requestDatabaseUrl:string;publisherDatabaseUrl:string;discoveryDatabaseUrl:string;
 namespace:string;consentVersion:string;storage:PrivateObjectStore;
}
type Guard={read:(request:FastifyRequest,reply:FastifyReply)=>Promise<void>;
 mutation:(request:FastifyRequest,reply:FastifyReply)=>Promise<void>};
class Rejection extends Error{constructor(readonly status:number,readonly code:string){super(code);}}
const fail=(status:number,code:string):never=>{throw new Rejection(status,code);};
function object(x:unknown):x is Record<string,unknown>{
 return x!==null&&typeof x==="object"&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
}
const idOk=(x:unknown):x is string=>typeof x==="string"&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
function dateAge(iso:string):number{
 const dob=new Date(iso+"T00:00:00.000Z");
 if(Number.isNaN(dob.getTime())||dob.toISOString().slice(0,10)!==iso)return -1;
 const now=new Date();
 let age=now.getUTCFullYear()-dob.getUTCFullYear();
 if(now.getUTCMonth()<dob.getUTCMonth()||
   (now.getUTCMonth()===dob.getUTCMonth()&&now.getUTCDate()<dob.getUTCDate()))age--;
 return age;
}
const goalOk=(v:unknown):v is string=>typeof v==="string"&&
 ["serious","relationship","dates","friendship","communication","undecided"].includes(v);
const genderOk=(v:unknown):v is string=>typeof v==="string"&&["man","woman","other"].includes(v);
function validList(v:unknown,n:number):v is string[]{
 return Array.isArray(v)&&v.length<=n&&
  v.every(x=>typeof x==="string"&&x.length>0&&x.length<=40)&&
  new Set(v).size===v.length;
}
function validatedProjection(payload:unknown,birthDate:string|null){
 if(!object(payload))fail(422,"incomplete_profile");
 const data=payload as Record<string,unknown>;
 const name=data.displayName,city=data.city,country=data.countryCode;
 if(typeof name!=="string"||name.trim()!==name||name.length<2||name.length>48||
  typeof city!=="string"||city.trim()!==city||city.length<2||city.length>120||
  typeof country!=="string"||!/^[A-Z]{2}$/.test(country)||
  !genderOk(data.gender)||!goalOk(data.goal)||
  typeof data.placeId!=="string"||!/^[a-z0-9:_-]{3,180}$/i.test(data.placeId)||
  !validList(data.interests,15)||!validList(data.languages,10)||
  typeof data.about!=="string"||[...data.about].length>750||
  !birthDate||dateAge(birthDate)<18||dateAge(birthDate)>=130)
   fail(422,"incomplete_profile");
 return {name,city,country,gender:data.gender,goal:data.goal,
  about:data.about,interests:data.interests,languages:data.languages,birthDate};
}
type Kind="luemi_profile_publisher"|"luemi_discovery_reader";
async function checkedRole(db:PoolClient,role:Kind):Promise<boolean>{
 try{
  const q=await db.query<{safe:boolean}>(`
 SELECT(r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls
  AND NOT r.rolcreaterole AND NOT r.rolcreatedb AND session_user=current_user
  AND current_setting('row_security')='on' AND pg_has_role(current_user,$1::name,'member')
  AND NOT pg_has_role(current_user,'luemi_auth_issuer','member')
  AND NOT pg_has_role(current_user,'luemi_request','member')
  AND NOT pg_has_role(current_user,'luemi_media_worker','member')
  AND NOT pg_has_role(current_user,'luemi_moderator','member')
  AND NOT pg_has_role(current_user,'luemi_geo_budget','member')
  AND NOT pg_has_role(current_user,
   CASE WHEN $1='luemi_profile_publisher' THEN 'luemi_discovery_reader'
        ELSE 'luemi_profile_publisher' END::name,'member')
  AND NOT pg_has_role(current_user,'pg_read_all_data','member')
  AND NOT pg_has_role(current_user,'pg_write_all_data','member')
  AND NOT has_schema_privilege(current_user,'luemi_private','CREATE')
  AND NOT has_table_privilege(current_user,'luemi_private.sessions','SELECT')
  AND NOT has_table_privilege(current_user,'luemi_private.audit_events','SELECT')
  AND NOT EXISTS(SELECT 1 FROM pg_class c WHERE c.oid IN
   ('luemi_private.public_profiles'::regclass,'luemi_private.media_assets'::regclass,
    'luemi_private.private_profile_drafts'::regclass,'luemi_private.blocks'::regclass)
   AND c.relowner=r.oid)
  AND (SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity AND row_security_active(c.oid))
   FROM pg_class c WHERE c.oid IN
   ('luemi_private.public_profiles'::regclass,'luemi_private.media_assets'::regclass,
    'luemi_private.private_profile_drafts'::regclass,'luemi_private.blocks'::regclass))
  AND CASE WHEN $1='luemi_profile_publisher'
   THEN has_column_privilege(current_user,'luemi_private.public_profiles','publication_status','UPDATE')
    AND has_column_privilege(current_user,'luemi_private.media_assets','publication_status','UPDATE')
    AND NOT has_table_privilege(current_user,'luemi_private.sessions','INSERT')
   ELSE NOT has_table_privilege(current_user,'luemi_private.private_profile_drafts','SELECT')
    AND NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE
     a.attrelid='luemi_private.private_profile_drafts'::regclass AND a.attnum>0
     AND NOT a.attisdropped AND has_column_privilege(current_user,a.attrelid,a.attname,'SELECT'))
    AND NOT has_table_privilege(current_user,'luemi_private.public_profiles','UPDATE')
    AND NOT has_table_privilege(current_user,'luemi_private.media_assets','UPDATE')
  END) AS safe FROM pg_roles r WHERE r.rolname=current_user`,[role]);
  return q.rowCount===1&&q.rows[0].safe===true;
 }catch{return false;}
}
export function registerPublishedProfiles(app:FastifyInstance,guards:Guard|undefined,opts:PublicationOptions|undefined){
 if(!opts?.enabled)return;
 if(!guards||!opts.requestDatabaseUrl||!opts.publisherDatabaseUrl||!opts.discoveryDatabaseUrl||
  opts.publisherDatabaseUrl===opts.discoveryDatabaseUrl||
  opts.publisherDatabaseUrl===opts.requestDatabaseUrl||
  opts.discoveryDatabaseUrl===opts.requestDatabaseUrl||
  !/^[a-z0-9:_-]{1,96}$/i.test(opts.namespace)||
  !/^[a-z0-9][a-z0-9._:-]{2,63}$/i.test(opts.consentVersion))
  throw new Error("REG01D separate publisher/discovery roles and approved version required");
 const auth:Guard=guards,cfg=opts;
 const publisher=new Pool({connectionString:cfg.publisherDatabaseUrl,max:4,connectionTimeoutMillis:3000});
 const reader=new Pool({connectionString:cfg.discoveryDatabaseUrl,max:6,connectionTimeoutMillis:3000});
 const requestPool=new Pool({connectionString:cfg.requestDatabaseUrl,max:4,connectionTimeoutMillis:3000});
 app.addHook("onClose",async()=>{await Promise.all([publisher.end(),reader.end(),requestPool.end()]);});
 async function requireEligibleViewer(actorId:string):Promise<void>{
  const db=await requestPool.connect().catch(()=>null);
  if(!db)fail(503,"service_unavailable");
  try{
   if(!await safeDb(db,"luemi_request"))fail(503,"service_unavailable");
   await db.query("BEGIN");
   await db.query("SELECT set_config('luemi.actor_id',$1,true)",[actorId]);
   await db.query("SELECT set_config('luemi.environment',$1,true)",[cfg.namespace]);
   const q=await db.query(
    "SELECT 1 FROM luemi_private.private_profile_drafts d "+
    "JOIN luemi_private.actors a ON a.id=d.owner_id AND a.environment=d.environment "+
    "WHERE d.owner_id=$1 AND d.environment=$2 AND a.status='active' "+
    "AND d.consent_version=$3 AND d.birth_date IS NOT NULL "+
    "AND d.birth_date <= ((clock_timestamp() AT TIME ZONE 'UTC')::date - interval '18 years')",
    [actorId,cfg.namespace,cfg.consentVersion]);
   await db.query("COMMIT");
   if(q.rowCount!==1)fail(403,"registration_required");
  }catch(e){
   await db.query("ROLLBACK").catch(()=>{});
   if(e instanceof Rejection)throw e;
   fail(503,"service_unavailable");
  }finally{db.release();}
 }
 async function transaction<T>(req:FastifyRequest,reply:FastifyReply,kind:Kind,
  job:(db:PoolClient,viewer:string)=>Promise<T>):Promise<T|FastifyReply>{
  const actor=req.authActor;
  if(reply.sent||!actor)return reply;
  const db=await (kind==="luemi_profile_publisher"?publisher:reader).connect().catch(()=>null);
  if(!db)return reply.code(503).send({error:"service_unavailable"});
  try{
   if(kind==="luemi_discovery_reader")await requireEligibleViewer(actor.actorId);
   if(!await checkedRole(db,kind))fail(503,"service_unavailable");
   await db.query("BEGIN");
   const scope=kind==="luemi_profile_publisher"?"luemi.actor_id":"luemi.viewer_id";
   await db.query("SELECT set_config($1,$2,true)",[scope,actor.actorId]);
   await db.query("SELECT set_config('luemi.environment',$1,true)",[cfg.namespace]);
   const result=await job(db,actor.actorId);
   await auth.read(req,reply);
   if(reply.sent||!req.authActor||req.authActor.actorId!==actor.actorId||
    req.authActor.sessionId!==actor.sessionId||
    !timingSafeEqual(req.authActor.hash,actor.hash))fail(401,"unauthorized");
   await db.query("COMMIT");
   return result;
  }catch(error){
   await db.query("ROLLBACK").catch(()=>{});
   if(reply.sent)return reply;
   if(error instanceof Rejection)return reply.code(error.status).send({error:error.code});
   return reply.code(503).send({error:"service_unavailable"});
  }finally{db.release();}
 }
 const publishedPhotoSql="SELECT a.id,a.derivative_key,a.generation FROM luemi_private.media_assets a "+
  "JOIN luemi_private.public_profiles p ON p.owner_id=a.owner_id AND p.environment=a.environment "+
  "WHERE a.id=$1 AND a.environment=$2 AND a.state='approved' "+
  "AND a.publication_status='published' AND p.publication_status='published' "+
  "AND (SELECT count(*) FROM luemi_private.media_assets x WHERE x.owner_id=p.owner_id "+
  "AND x.environment=p.environment AND x.state='approved' AND x.publication_status='published') BETWEEN 3 AND 6";

 app.post<{Body:unknown}>("/api/v3/profile/publish",{preHandler:guards.mutation},async(req,reply)=>
 transaction(req,reply,"luemi_profile_publisher",async(db,id)=>{
  const body=req.body;
  if(!object(body)||Object.keys(body).length!==1||
    !Number.isSafeInteger(body.revision)||Number(body.revision)<1)
   fail(422,"invalid_revision");
  const expected=Number((body as {revision:number}).revision);
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [cfg.namespace+":"+id+":publication"]);
  const actor=await db.query(
   "SELECT id FROM luemi_private.actors WHERE id=$1 AND environment=$2 AND status='active'",
   [id,cfg.namespace]);
  if(actor.rowCount!==1)fail(401,"unauthorized");
  const d=await db.query<{revision:string;payload:unknown;birth_date:string|null;consent_version:string|null}>(
   "SELECT revision::text,payload,birth_date::text,consent_version "+
   "FROM luemi_private.private_profile_drafts WHERE owner_id=$1 AND environment=$2",
   [id,cfg.namespace]);
  if(d.rowCount!==1||d.rows[0].consent_version!==cfg.consentVersion)
   fail(403,"consent_required");
  if(Number(d.rows[0].revision)!==expected)fail(409,"revision_conflict");
  const profile=validatedProjection(d.rows[0].payload,d.rows[0].birth_date);
  const photos=await db.query<{id:string;state:string;publication_status:string}>(
   "SELECT id,state,publication_status FROM luemi_private.media_assets "+
   "WHERE owner_id=$1 AND environment=$2 AND state<>'revoked' ORDER BY position,id FOR UPDATE",
   [id,cfg.namespace]);
  if(photos.rowCount===null||photos.rowCount<3||photos.rowCount>6||
    photos.rows.some(x=>x.state!=="approved"))
    fail(409,"photos_not_approved");
  const result=await db.query(
   "INSERT INTO luemi_private.public_profiles "+
   "(owner_id,environment,publication_status,published_revision,display_name,city_label,country_code,"+
   "about,interests,gender,goal,languages,birth_date,published_at,updated_at) "+
   "VALUES($1,$2,'published',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,clock_timestamp(),clock_timestamp()) "+
   "ON CONFLICT (owner_id) DO UPDATE SET publication_status='published',"+
   "published_revision=EXCLUDED.published_revision,display_name=EXCLUDED.display_name,"+
   "city_label=EXCLUDED.city_label,country_code=EXCLUDED.country_code,"+
   "about=EXCLUDED.about,interests=EXCLUDED.interests,gender=EXCLUDED.gender,"+
   "goal=EXCLUDED.goal,languages=EXCLUDED.languages,birth_date=EXCLUDED.birth_date,"+
   "published_at=clock_timestamp(),updated_at=clock_timestamp() "+
   "WHERE luemi_private.public_profiles.environment=EXCLUDED.environment RETURNING owner_id",
   [id,cfg.namespace,expected,profile.name,profile.city,profile.country,profile.about,
    profile.interests,profile.gender,profile.goal,profile.languages,profile.birthDate]);
  if(result.rowCount!==1)fail(409,"publication_conflict");
  const updated=await db.query(
   "UPDATE luemi_private.media_assets SET publication_status='published' "+
   "WHERE owner_id=$1 AND environment=$2 AND state='approved' AND publication_status='private'",
   [id,cfg.namespace]);
  if(updated.rowCount===null||updated.rowCount>6)fail(503,"service_unavailable");
  return{state:"published",revision:expected,photoCount:photos.rows.length};
 }));

 app.post("/api/v3/profile/unpublish",{preHandler:guards.mutation},async(req,reply)=>
 transaction(req,reply,"luemi_profile_publisher",async(db,id)=>{
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
   [cfg.namespace+":"+id+":publication"]);
  // Explicitly hide photos before hiding the profile; atomic SQL commit.
  await db.query("UPDATE luemi_private.media_assets SET publication_status='private' "+
   "WHERE owner_id=$1 AND environment=$2 AND publication_status='published'",
   [id,cfg.namespace]);
  await db.query("UPDATE luemi_private.public_profiles SET publication_status='hidden',"+
   "updated_at=clock_timestamp() WHERE owner_id=$1 AND environment=$2",
   [id,cfg.namespace]);
  return{state:"hidden"};
 }));

 app.get("/api/v3/discovery/feed",{preHandler:guards.read},async(req,reply)=>{
  reply.header("Cache-Control","private, no-store").header("Vary","Cookie");
  return transaction(req,reply,"luemi_discovery_reader",async(db,viewer)=>{
   const results=await db.query<{owner_id:string;display_name:string;city_label:string;
    country_code:string;about:string;interests:string[];gender:string;goal:string;
    languages:string[];birth_date:string;published_at:string}>(
    "SELECT p.owner_id,p.display_name,p.city_label,p.country_code,p.about,p.interests,"+
    "p.gender,p.goal,p.languages,p.birth_date::text,p.published_at::text "+
    "FROM luemi_private.public_profiles p WHERE p.environment=$1 "+
    "AND p.owner_id<>$2 AND p.publication_status='published' "+
    "AND (SELECT count(*) FROM luemi_private.media_assets a WHERE a.owner_id=p.owner_id "+
    "AND a.environment=p.environment AND a.state='approved' "+
    "AND a.publication_status='published') BETWEEN 3 AND 6 "+
    "ORDER BY p.published_at DESC,p.owner_id DESC LIMIT 20",
    [cfg.namespace,viewer]);
   const ids=results.rows.map(r=>r.owner_id);
   const photoRows=ids.length?await db.query<{owner_id:string;id:string;position:number}>(
    "SELECT owner_id,id,position FROM luemi_private.media_assets "+
    "WHERE owner_id=ANY($1::uuid[]) AND environment=$2 AND state='approved' "+
    "AND publication_status='published' ORDER BY owner_id,position,id",[ids,cfg.namespace]):null;
   const photos=new Map<string,string[]>();
   for(const row of photoRows?.rows??[]){
    const list=photos.get(row.owner_id)??[];
    list.push(row.id);photos.set(row.owner_id,list);
   }
   return{status:"published_only",profiles:results.rows.map(p=>({
    id:p.owner_id,name:p.display_name,age:dateAge(p.birth_date),
    city:p.city_label,countryCode:p.country_code,about:p.about??"",
    interests:p.interests,gender:p.gender,goal:p.goal,languages:p.languages,
    photos:(photos.get(p.owner_id)??[]).map(id=>({id,url:"/api/v3/discovery/photo/"+id}))
   })).filter(p=>p.age>=18&&p.age<130&&p.photos.length>=3)};
  });
 });

 app.get<{Params:{id:string}}>("/api/v3/discovery/photo/:id",
 {preHandler:guards.read},async(req,reply)=>{
  reply.header("Cache-Control","private, no-store").header("Vary","Cookie");
  if(!idOk(req.params.id))return reply.code(404).send({error:"not_found"});
  const read=()=>transaction(req,reply,"luemi_discovery_reader",async(db,_viewer)=>{
   const photo=await db.query<{derivative_key:string;generation:number}>(
    publishedPhotoSql,[req.params.id,cfg.namespace]);
   if(photo.rowCount!==1)fail(404,"not_found");
   return photo.rows[0];
  });
  const record=await read();
  if(reply.sent||!("derivative_key" in record))return record;
  let bytes:Buffer|null=null;
  try{bytes=await cfg.storage.get(record.derivative_key);}
  catch{return reply.code(503).send({error:"media_unavailable"});}
  if(!bytes)return reply.code(503).send({error:"media_unavailable"});
  const again=await read();
  if(reply.sent||!("derivative_key" in again))return again;
  if(again.generation!==record.generation||again.derivative_key!==record.derivative_key)
   return reply.code(404).send({error:"not_found"});
  return reply.header("Content-Type","image/png")
   .header("Content-Disposition",'inline; filename="luemi-photo.png"').send(bytes);
 });
}
