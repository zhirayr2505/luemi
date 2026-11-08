// REG-01D: separate publisher and discovery PostgreSQL principals, NO public Data API.
import {timingSafeEqual} from "node:crypto";
import {Pool} from "pg";
import type {PoolClient} from "pg";
import type {FastifyInstance,FastifyReply,FastifyRequest} from "fastify";
import type {PrivateObjectStore} from "./rem05d-private.js";
import {safeDb} from "./rem05d-private.js";
import {encodePublishedFeedCursor,decodePublishedFeedCursor} from "./real-feed-cursor.js";
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
 ["serious","relationship","dates","friendship","communication","new_people","flirt","activities","undecided","love","family_goal","travel_partner","casual"].includes(v);
const genderOk=(v:unknown):v is string=>typeof v==="string"&&["man","woman","other"].includes(v);
const audienceOk=(v:unknown):v is string=>typeof v==="string"&&["women","men","everyone"].includes(v);
function validList(v:unknown,n:number):v is string[]{
 return Array.isArray(v)&&v.length<=n&&
  v.every(x=>typeof x==="string"&&x.length>0&&x.length<=40)&&
  new Set(v).size===v.length;
}
function validatedProjection(payload:unknown,birthDate:string|null){
 if(!object(payload))fail(422,"incomplete_profile");
 const data=payload as Record<string,unknown>;
 const name=data.displayName,city=data.city,country=data.countryCode;
 const audience=data.audience??"everyone";
 const ageMin=data.ageMin??18,ageMax=data.ageMax??80;
 const radius=data.radius??100,searchScope=data.searchScope??"world";
 if(typeof name!=="string"||name.trim()!==name||name.length<2||name.length>48||
  typeof city!=="string"||city.trim()!==city||city.length<2||city.length>120||
  typeof country!=="string"||!/^[A-Z]{2}$/.test(country)||
  !genderOk(data.gender)||!goalOk(data.goal)||!audienceOk(audience)||
  !Number.isInteger(ageMin)||Number(ageMin)<18||Number(ageMin)>80||
  !Number.isInteger(ageMax)||Number(ageMax)<Number(ageMin)||Number(ageMax)>80||
  !Number.isInteger(radius)||Number(radius)<1||Number(radius)>5000||
  !["radius","city","country","world"].includes(String(searchScope))||
  typeof data.placeId!=="string"||!/^[a-z0-9:_-]{3,180}$/i.test(data.placeId)||
  !validList(data.interests,20)||!validList(data.languages,10)||
  typeof data.about!=="string"||[...data.about].length>750||
  !birthDate||dateAge(birthDate)<18||dateAge(birthDate)>=130)
   fail(422,"incomplete_profile");
 return {name,city,country,gender:data.gender,goal:data.goal,
  audience,ageMin:Number(ageMin),ageMax:Number(ageMax),
  radius:Number(radius),searchScope:String(searchScope),placeId:String(data.placeId),
  about:data.about,interests:data.interests,languages:data.languages,birthDate};
}
/** Only explicitly opted-in coordinates enter this endpoint; the GPS
 * readings themselves are never logged or returned to other viewers. */
type PrivateLocation={lat:number;lon:number;accuracy_m:number|null};
function acceptedCoordinates(body:unknown):PrivateLocation|null{
 if(!object(body))return null;
 const {lat,lon,accuracyM}=body;
 if(typeof lat!=="number"||typeof lon!=="number"||
  !Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180||
  (accuracyM!==null&&accuracyM!==undefined&&
   (typeof accuracyM!=="number"||!Number.isFinite(accuracyM)||accuracyM<0||accuracyM>3000)))
  return null;
 return{lat,lon,accuracy_m:accuracyM===null||accuracyM===undefined?null:Math.round(accuracyM)};
}
type ConfirmedCity={city:string;country:string;countryCode:string;placeId:string};
function acceptedCity(body:unknown):ConfirmedCity|null{
 if(!object(body))return null;
 const {city,country,countryCode,placeId}=body;
 if(typeof city!=="string"||typeof country!=="string"||
  typeof countryCode!=="string"||typeof placeId!=="string"||
  city!==city.trim()||country!==country.trim()||
  city.length<2||city.length>120||country.length<2||country.length>120||
  !/^[A-Z]{2}$/.test(countryCode)||
  !/^(geo:|offline:)[a-z0-9:_-]{3,180}$/i.test(placeId)||
  /[<>]/.test(city+country+placeId)||
  [...city,...country,...placeId].some(ch=>ch.charCodeAt(0)<32))return null;
 return{city,country,countryCode,placeId};
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
  if(!db)throw new Rejection(503,"service_unavailable");
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

 app.get("/api/v3/profile/status",{preHandler:guards.read},async(req,reply)=>{
  reply.header("Cache-Control","private, no-store").header("Vary","Cookie");
  return transaction(req,reply,"luemi_profile_publisher",async(db,id)=>{
   const p=await db.query<{publication_status:string;published_revision:string;
    display_name:string;city_label:string;country_code:string;about:string;goal:string;
    birth_date:string;interests:string[]}>(
    "SELECT publication_status,published_revision::text,display_name,city_label,country_code,"+
    "about,goal,birth_date::text,interests FROM luemi_private.public_profiles "+
    "WHERE owner_id=$1 AND environment=$2",[id,cfg.namespace]);
   const media=await db.query<{state:string;n:string}>(
    "SELECT state,count(*)::text AS n FROM luemi_private.media_assets "+
    "WHERE owner_id=$1 AND environment=$2 AND state<>'revoked' GROUP BY state",
    [id,cfg.namespace]);
   const counts=Object.fromEntries(media.rows.map(r=>[r.state,Number(r.n)]));
   const published=p.rows[0]?.publication_status==="published"?p.rows[0]:null;
   const pictures=published?await db.query<{id:string}>(
    "SELECT id FROM luemi_private.media_assets WHERE owner_id=$1 AND environment=$2 "+
    "AND state='approved' AND publication_status='published' ORDER BY position,id LIMIT 6",
    [id,cfg.namespace]):null;
   const visible=pictures?.rows??[];
   const ownProfile=published&&visible.length>=3&&visible.length<=6?{
     name:published.display_name,
     age:dateAge(published.birth_date),
     city:published.city_label,
     countryCode:published.country_code,
     about:published.about??"",
     goal:published.goal,
     interests:published.interests,
     photos:visible.map(photo=>"/api/v3/discovery/photo/"+photo.id)
   }:null;
   return{state:p.rows[0]?.publication_status??"draft",
    publishedRevision:p.rows[0]?Number(p.rows[0].published_revision):0,
    approved:counts.approved??0,pending:counts.pending_review??0,
    other:Object.entries(counts).filter(([key])=>key!=="approved"&&key!=="pending_review")
     .reduce((sum,[,value])=>sum+value,0),
    ...(ownProfile?{profile:ownProfile}:{})};

  });
 });
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
   "about,interests,gender,goal,languages,birth_date,audience,preferred_age_min,preferred_age_max,published_at,updated_at) "+
   "VALUES($1,$2,'published',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,clock_timestamp(),clock_timestamp()) "+
   "ON CONFLICT (owner_id) DO UPDATE SET publication_status='published',"+
   "published_revision=EXCLUDED.published_revision,display_name=EXCLUDED.display_name,"+
   "city_label=EXCLUDED.city_label,country_code=EXCLUDED.country_code,"+
   "about=EXCLUDED.about,interests=EXCLUDED.interests,gender=EXCLUDED.gender,"+
   "goal=EXCLUDED.goal,languages=EXCLUDED.languages,birth_date=EXCLUDED.birth_date,"+
   "audience=EXCLUDED.audience,preferred_age_min=EXCLUDED.preferred_age_min,preferred_age_max=EXCLUDED.preferred_age_max,"+
   "published_at=clock_timestamp(),updated_at=clock_timestamp() "+
   "WHERE luemi_private.public_profiles.environment=EXCLUDED.environment RETURNING owner_id",
   [id,cfg.namespace,expected,profile.name,profile.city,profile.country,profile.about,
    profile.interests,profile.gender,profile.goal,profile.languages,profile.birthDate,
    profile.audience,profile.ageMin,profile.ageMax]);
  if(result.rowCount!==1)fail(409,"publication_conflict");
  const preferences=await db.query(
   "INSERT INTO luemi_private.discovery_preferences "+
   "(owner_id,environment,owner_gender,owner_birth_date,audience,age_min,age_max,city_label,country_code,place_id,radius_km,search_scope,goal,interests,updated_at) "+
   "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,clock_timestamp()) "+
   "ON CONFLICT(owner_id) DO UPDATE SET owner_gender=EXCLUDED.owner_gender,owner_birth_date=EXCLUDED.owner_birth_date,"+
   "audience=EXCLUDED.audience,age_min=EXCLUDED.age_min,"+
   "age_max=EXCLUDED.age_max,city_label=EXCLUDED.city_label,country_code=EXCLUDED.country_code,"+
   "place_id=EXCLUDED.place_id,radius_km=EXCLUDED.radius_km,search_scope=EXCLUDED.search_scope,"+
   "goal=EXCLUDED.goal,interests=EXCLUDED.interests,updated_at=clock_timestamp() "+
   "WHERE luemi_private.discovery_preferences.environment=EXCLUDED.environment RETURNING owner_id",
   [id,cfg.namespace,profile.gender,profile.birthDate,profile.audience,profile.ageMin,profile.ageMax,profile.city,
    profile.country,profile.placeId,profile.radius,profile.searchScope,profile.goal,profile.interests]);
  if(preferences.rowCount!==1)fail(409,"publication_conflict");
  const updated=await db.query(
   "UPDATE luemi_private.media_assets SET publication_status='published' "+
   "WHERE owner_id=$1 AND environment=$2 AND state='approved' AND publication_status='private'",
   [id,cfg.namespace]);
  if(updated.rowCount===null||updated.rowCount>6)fail(503,"service_unavailable");
  return{state:"published",revision:expected,photoCount:photos.rows.length};
 }));

 app.post("/api/v3/profile/unpublish",{preHandler:guards.mutation},async(req,reply)=>
 transaction(req,reply,"luemi_profile_publisher",async(db,id)=>{
  await db.query("DELETE FROM luemi_private.precise_locations WHERE owner_id=$1 AND environment=$2",[id,cfg.namespace]);
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

 // Explicit withdrawal immediately atomically hides the entire published
 // projection and removes the consent grant. Data erasure is NOT implied.
 app.post("/api/v3/profile/withdraw-consent",{preHandler:guards.mutation},async(req,reply)=>
 transaction(req,reply,"luemi_profile_publisher",async(db,id)=>{
  await db.query("DELETE FROM luemi_private.precise_locations WHERE owner_id=$1 AND environment=$2",[id,cfg.namespace]);
  await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
   [cfg.namespace+":"+id+":publication"]);
  await db.query("UPDATE luemi_private.media_assets SET publication_status='private' "+
   "WHERE owner_id=$1 AND environment=$2 AND publication_status='published'",
   [id,cfg.namespace]);
  await db.query("UPDATE luemi_private.public_profiles SET publication_status='hidden',"+
   "updated_at=clock_timestamp() WHERE owner_id=$1 AND environment=$2",
   [id,cfg.namespace]);
  await db.query("UPDATE luemi_private.private_profile_drafts SET consent_version=NULL "+
   "WHERE owner_id=$1 AND environment=$2",
   [id,cfg.namespace]);
  return{state:"consent_withdrawn",dataDeleted:false};
 }));

 // Precise location is OFF by default and independent of Telegram's
 // location permission. This user-controlled consent cannot be enabled by a
 // background refresh or by the ordinary registration city lookup.
 app.get("/api/v3/location/status",{preHandler:guards.read},async(req,reply)=>
 transaction(req,reply,"luemi_profile_publisher",async(db,owner)=>{
  const res=await db.query<{updated_at:string}>(
   "SELECT updated_at::text FROM luemi_private.precise_locations "+
   "WHERE owner_id=$1 AND environment=$2",[owner,cfg.namespace]);
  return{enabled:res.rowCount===1,updatedAt:res.rows[0]?.updated_at??null};
 }));
 app.post<{Body:unknown}>("/api/v3/location/consent",{preHandler:guards.mutation,bodyLimit:1024},async(req,reply)=>{
  const body=req.body,loc=acceptedCoordinates(body);
  if(!loc||!object(body)||body.consent!==true||body.version!=="precise-location-v1")
   return reply.code(422).send({error:"location_consent_required"});
  return transaction(req,reply,"luemi_profile_publisher",async(db,owner)=>{
   const eligible=await db.query(
    "SELECT 1 FROM luemi_private.public_profiles "+
    "WHERE owner_id=$1 AND environment=$2 AND publication_status='published'",
    [owner,cfg.namespace]);
   if(eligible.rowCount!==1)fail(403,"published_profile_required");
   const saved=await db.query(
    "INSERT INTO luemi_private.precise_locations(owner_id,environment,lat,lon,accuracy_m) "+
    "VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner_id) DO UPDATE "+
    "SET lat=EXCLUDED.lat,lon=EXCLUDED.lon,accuracy_m=EXCLUDED.accuracy_m,"+
    "updated_at=clock_timestamp() WHERE luemi_private.precise_locations.environment=EXCLUDED.environment "+
    "RETURNING owner_id",[owner,cfg.namespace,loc.lat,loc.lon,loc.accuracy_m]);
   if(saved.rowCount!==1)fail(409,"location_conflict");
   return{enabled:true};
  });
 });
 app.post<{Body:unknown}>("/api/v3/location/refresh",{preHandler:guards.mutation,bodyLimit:1024},async(req,reply)=>{
  const loc=acceptedCoordinates(req.body);
  if(!loc)return reply.code(422).send({error:"invalid_location"});
  return transaction(req,reply,"luemi_profile_publisher",async(db,owner)=>{
   const updated=await db.query(
    "UPDATE luemi_private.precise_locations SET lat=$3,lon=$4,accuracy_m=$5,"+
    "updated_at=clock_timestamp() WHERE owner_id=$1 AND environment=$2 RETURNING owner_id",
    [owner,cfg.namespace,loc.lat,loc.lon,loc.accuracy_m]);
   if(updated.rowCount!==1)fail(409,"location_consent_missing");
   return{enabled:true};
  });
 });
 app.post("/api/v3/location/revoke",{preHandler:guards.mutation},async(req,reply)=>
 transaction(req,reply,"luemi_profile_publisher",async(db,owner)=>{
  await db.query("DELETE FROM luemi_private.precise_locations WHERE owner_id=$1 AND environment=$2",
   [owner,cfg.namespace]);
  return{enabled:false,deleted:true};
 }));
 app.post<{Body:unknown}>("/api/v3/location/confirm-city",{preHandler:guards.mutation,bodyLimit:1024},async(req,reply)=>{
  const city=acceptedCity(req.body);
  if(!city)return reply.code(422).send({error:"invalid_confirmed_city"});
  return transaction(req,reply,"luemi_profile_publisher",async(db,owner)=>{
   const loc=await db.query("SELECT owner_id FROM luemi_private.precise_locations "+
    "WHERE owner_id=$1 AND environment=$2 AND updated_at>clock_timestamp()-interval '24 hours'",
    [owner,cfg.namespace]);
   if(loc.rowCount!==1)fail(409,"location_consent_missing");
   const updated=await db.query(
    "UPDATE luemi_private.public_profiles SET city_label=$3,country_code=$4,updated_at=clock_timestamp() "+
    "WHERE owner_id=$1 AND environment=$2 AND publication_status='published' RETURNING owner_id",
    [owner,cfg.namespace,city.city,city.countryCode]);
   if(updated.rowCount!==1)fail(409,"published_profile_required");
   const pref=await db.query(
    "UPDATE luemi_private.discovery_preferences SET city_label=$3,country_code=$4,"+
    "place_id=$5,updated_at=clock_timestamp() WHERE owner_id=$1 AND environment=$2 RETURNING owner_id",
    [owner,cfg.namespace,city.city,city.countryCode,city.placeId]);
   if(pref.rowCount!==1)fail(409,"search_preferences_missing");
   // Maintain the same city across the private draft and next edit session.
   await db.query("UPDATE luemi_private.private_profile_drafts SET "+
    "payload=payload||jsonb_build_object('city',$3::text,'country',$4::text,"+
    "'countryCode',$5::text,'placeId',$6::text),updated_at=clock_timestamp() "+
    "WHERE owner_id=$1 AND environment=$2",
    [owner,cfg.namespace,city.city,city.country,city.countryCode,city.placeId]);
   return{city:city.city,country:city.country,countryCode:city.countryCode,placeId:city.placeId};
  });
 });

 // Scope is an account-owned search preference, not a publication edit.
 // Secure actor/CSRF checks and the existing forced-RLS publisher policy
 // prevent changing another user's preferences. No exact GPS is stored.
 app.post<{Body:unknown}>("/api/v3/discovery/scope",{preHandler:guards.mutation},async(req,reply)=>{
  const raw=object(req.body)?req.body.scope:null;
  if(raw!=="radius"&&raw!=="city"&&raw!=="world")
   return reply.code(422).send({error:"invalid_search_scope"});
  return transaction(req,reply,"luemi_profile_publisher",async(db,viewer)=>{
   const saved=await db.query<{search_scope:string}>(
    "UPDATE luemi_private.discovery_preferences SET search_scope=$3,updated_at=clock_timestamp() "+
    "WHERE owner_id=$1 AND environment=$2 RETURNING search_scope",
    [viewer,cfg.namespace,raw]);
   if(saved.rowCount!==1)fail(404,"search_preferences_missing");
   return{scope:saved.rows[0].search_scope};
  });
 });

 app.get<{Querystring:{after?:string}}>("/api/v3/discovery/feed",{preHandler:guards.read},async(req,reply)=>{
  reply.header("Cache-Control","private, no-store").header("Vary","Cookie");
  let cursor:ReturnType<typeof decodePublishedFeedCursor>;
  try{cursor=decodePublishedFeedCursor(req.query?.after);}
  catch{return reply.code(422).send({error:"invalid_feed_cursor"});}
  return transaction(req,reply,"luemi_discovery_reader",async(db,viewer)=>{
   // Return the authoritative persisted scope, including for an empty page.
   // Without this the app could show the old local registration choice after
   // an owner expanded the search on a previous device/session.
   const preferences=await db.query<{search_scope:string}>(
    "SELECT search_scope FROM luemi_private.discovery_preferences "+
    "WHERE owner_id=$1 AND environment=$2",[viewer,cfg.namespace]);
   const appliedScope=preferences.rows[0]?.search_scope??"world";
   const results=await db.query<{owner_id:string;display_name:string;city_label:string;
    country_code:string;about:string;interests:string[];gender:string;goal:string;
    languages:string[];birth_date:string;published_at:string;liked_you_kind:"ordinary"|"super"|null}>(
    "WITH preference AS (SELECT owner_gender,owner_birth_date,audience,age_min,age_max,city_label,country_code,goal,interests,search_scope "+
    "FROM luemi_private.discovery_preferences WHERE owner_id=$2 AND environment=$1 UNION ALL "+
    "SELECT NULL::text,NULL::date,'everyone'::text,18::smallint,80::smallint,''::text,''::text,''::text,ARRAY[]::text[],'world'::text "+
    "WHERE NOT EXISTS(SELECT 1 FROM luemi_private.discovery_preferences WHERE owner_id=$2 AND environment=$1)) "+
    "SELECT p.owner_id,p.display_name,p.city_label,p.country_code,p.about,p.interests,"+
    "p.gender,p.goal,p.languages,p.birth_date::text,p.published_at::text,"+
    "incoming.kind AS liked_you_kind "+
    "FROM luemi_private.public_profiles p CROSS JOIN preference pref "+
    "LEFT JOIN luemi_private.city_centres origin_city ON origin_city.country_code=pref.country_code "+
    "AND origin_city.city_norm=lower(btrim(pref.city_label)) "+
    "LEFT JOIN luemi_private.city_centres candidate_city ON candidate_city.country_code=p.country_code "+
    "AND candidate_city.city_norm=lower(btrim(p.city_label)) "+    "LEFT JOIN luemi_private.precise_locations viewer_loc ON "+
    "viewer_loc.owner_id=$2 AND viewer_loc.environment=$1 "+
    "LEFT JOIN luemi_private.precise_locations candidate_loc ON "+
    "candidate_loc.owner_id=p.owner_id AND candidate_loc.environment=$1 "+


    // Only coarse declared city centres are used: never precise device GPS.
    // Evidence and ranking are evaluated by PostgreSQL BEFORE LIMIT/OFFSET,
    // so later pages cannot jump ahead of better matches on earlier pages.
    "CROSS JOIN LATERAL (SELECT "+
    "CASE WHEN viewer_loc.owner_id IS NOT NULL AND candidate_loc.owner_id IS NOT NULL THEN "+
    "6371.0088*2*asin(sqrt(least(1.0,"+
    "power(sin(radians(candidate_loc.coarse_lat-viewer_loc.coarse_lat)/2),2)+"+
    "cos(radians(viewer_loc.coarse_lat))*cos(radians(candidate_loc.coarse_lat))*"+
    "power(sin(radians(candidate_loc.coarse_lon-viewer_loc.coarse_lon)/2),2)))) "+
    "WHEN lower(btrim(p.city_label))=lower(btrim(pref.city_label)) "+
    "AND p.country_code=pref.country_code THEN 0::double precision "+
    "WHEN coalesce(viewer_loc.coarse_lat,origin_city.lat) IS NULL "+
    "OR coalesce(candidate_loc.coarse_lat,candidate_city.lat) IS NULL THEN NULL::double precision "+
    "ELSE 6371.0088*2*asin(sqrt(least(1.0,"+
    "power(sin(radians(coalesce(candidate_loc.coarse_lat,candidate_city.lat)-"+
    "coalesce(viewer_loc.coarse_lat,origin_city.lat))/2),2)+"+
    "cos(radians(coalesce(viewer_loc.coarse_lat,origin_city.lat)))*"+
    "cos(radians(coalesce(candidate_loc.coarse_lat,candidate_city.lat)))*"+
    "power(sin(radians(coalesce(candidate_loc.coarse_lon,candidate_city.lon)-"+
    "coalesce(viewer_loc.coarse_lon,origin_city.lon))/2),2)))) END AS km,"+
    "cardinality(ARRAY(SELECT unnest(p.interests) INTERSECT "+
    "SELECT unnest(pref.interests))) AS shared,"+
    "CASE WHEN pref.goal='undecided' OR p.goal='undecided' THEN 0 "+
    "WHEN p.goal=pref.goal THEN 2 "+
    "WHEN pref.goal IN ('serious','relationship','love','family_goal') "+
    "AND p.goal IN ('serious','relationship','love','family_goal') THEN 1 "+
    "WHEN pref.goal IN ('dates','flirt','casual') "+
    "AND p.goal IN ('dates','flirt','casual') THEN 1 "+
    "WHEN pref.goal IN ('friendship','communication','new_people') "+
    "AND p.goal IN ('friendship','communication','new_people') THEN 1 "+
    "WHEN pref.goal IN ('activities','travel_partner') "+
    "AND p.goal IN ('activities','travel_partner') THEN 1 "+
    "ELSE 0 END AS goal_score) evidence "+
    "CROSS JOIN LATERAL (SELECT "+
    "CASE WHEN evidence.goal_score=2 AND evidence.shared>=2 THEN 4 "+
    "WHEN evidence.goal_score>0 AND evidence.shared>=1 THEN 3 "+
    "WHEN evidence.goal_score=2 OR evidence.shared>=2 THEN 2 "+
    "WHEN evidence.goal_score=1 OR evidence.shared=1 THEN 1 ELSE 0 END AS tier,"+
    "(evidence.goal_score*4 + least(evidence.shared,6)*2) AS score,"+
    "CASE WHEN evidence.km IS NULL THEN 9 WHEN evidence.km<=25 THEN 0 "+
    "WHEN evidence.km<=100 THEN 1 WHEN evidence.km<=300 THEN 2 "+
    "WHEN evidence.km<=1000 THEN 3 WHEN evidence.km<=3000 THEN 4 "+
    "ELSE 5 END AS band) ranking "+
    "LEFT JOIN luemi_chats.likes incoming ON incoming.environment=p.environment "+
    "AND incoming.sender_id=p.owner_id AND incoming.receiver_id=$2 AND incoming.status='active' "+
    "WHERE p.environment=$1 "+
    "AND (pref.search_scope<>'city' OR (lower(btrim(p.city_label))=lower(btrim(pref.city_label)) AND p.country_code=pref.country_code)) "+
    "AND (pref.search_scope<>'country' OR p.country_code=pref.country_code) "+
    "AND p.owner_id<>$2 AND p.publication_status='published' AND p.published_at IS NOT NULL "+
    "AND (pref.audience='everyone' OR (pref.audience='women' AND p.gender='woman') "+
    "OR (pref.audience='men' AND p.gender='man')) "+
    "AND date_part('year',age(current_date,p.birth_date))::int BETWEEN pref.age_min AND pref.age_max "+
    "AND (pref.owner_gender IS NULL OR p.audience='everyone' OR (p.audience='women' AND pref.owner_gender='woman') "+
    "OR (p.audience='men' AND pref.owner_gender='man')) "+
    "AND (pref.owner_birth_date IS NULL OR date_part('year',age(current_date,pref.owner_birth_date))::int "+
    "BETWEEN p.preferred_age_min AND p.preferred_age_max) "+
    "AND NOT EXISTS(SELECT 1 FROM luemi_chats.likes sent WHERE sent.environment=p.environment "+
    "AND sent.sender_id=$2 AND sent.receiver_id=p.owner_id) "+
    "AND (SELECT count(*) FROM luemi_private.media_assets a WHERE a.owner_id=p.owner_id "+
    "AND a.environment=p.environment AND a.state='approved' "+
    "AND a.publication_status='published') BETWEEN 3 AND 6 "+
    // Nearby: match compatibility first within a local 100km area, then expand
    // through wider area bands. City: strict locality. World: expand outward
    // through city-distance bands, prioritize affinity inside each band.
    // Unknown city coordinates remain discoverable and rank after known places.
    "ORDER BY CASE WHEN pref.search_scope='world' THEN ranking.band "+
    "WHEN pref.search_scope='radius' THEN CASE "+
    "WHEN evidence.km IS NULL THEN 9 WHEN evidence.km<=100 THEN 0 "+
    "WHEN evidence.km<=300 THEN 1 WHEN evidence.km<=1000 THEN 2 "+
    "WHEN evidence.km<=3000 THEN 3 ELSE 4 END END ASC NULLS LAST,"+
    "ranking.tier DESC,ranking.score DESC,"+
    "CASE WHEN pref.search_scope IN ('radius','world') THEN evidence.km END ASC NULLS LAST,"+
    "(lower(btrim(p.city_label))=lower(btrim(pref.city_label)) AND p.country_code=pref.country_code) DESC,"+
    "(p.country_code=pref.country_code) DESC,p.published_at DESC,p.owner_id DESC OFFSET $3 LIMIT 21",
    [cfg.namespace,viewer,cursor?.offset??0]);
   const page=results.rows.slice(0,20);
   const nextCursor=results.rows.length>20?
    encodePublishedFeedCursor({offset:(cursor?.offset??0)+20}):null;
   const ids=page.map(r=>r.owner_id);
   const photoRows=ids.length?await db.query<{owner_id:string;id:string;position:number}>(
    "SELECT owner_id,id,position FROM luemi_private.media_assets "+
    "WHERE owner_id=ANY($1::uuid[]) AND environment=$2 AND state='approved' "+
    "AND publication_status='published' ORDER BY owner_id,position,id",[ids,cfg.namespace]):null;
   const photos=new Map<string,string[]>();
   for(const row of photoRows?.rows??[]){
    const list=photos.get(row.owner_id)??[];
    list.push(row.id);photos.set(row.owner_id,list);
   }
   return{status:"published_only",searchScope:appliedScope,nextCursor,profiles:page.map(p=>({
    id:p.owner_id,name:p.display_name,age:dateAge(p.birth_date),
    city:p.city_label,countryCode:p.country_code,about:p.about??"",
    interests:p.interests,gender:p.gender,goal:p.goal,languages:p.languages,
    likedYouKind:p.liked_you_kind,
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

 app.get<{Params:{id:string}}>("/api/v3/discovery/profile/:id",
 {preHandler:guards.read},async(req,reply)=>{
  reply.header("Cache-Control","private, no-store").header("Vary","Cookie");
  if(!idOk(req.params.id))return reply.code(404).send({error:"not_found"});
  return transaction(req,reply,"luemi_discovery_reader",async(db,viewer)=>{
   const found=await db.query<{owner_id:string;display_name:string;city_label:string;country_code:string;
    about:string;interests:string[];gender:string;goal:string;languages:string[];birth_date:string;
    liked_you_kind:"ordinary"|"super"|null}>(`SELECT p.owner_id,p.display_name,p.city_label,p.country_code,
    p.about,p.interests,p.gender,p.goal,p.languages,p.birth_date::text,incoming.kind AS liked_you_kind
    FROM luemi_private.public_profiles p
    LEFT JOIN luemi_chats.likes incoming ON incoming.environment=p.environment
     AND incoming.sender_id=p.owner_id AND incoming.receiver_id=$2 AND incoming.status='active'
    WHERE p.owner_id=$3 AND p.environment=$1 AND p.publication_status='published'`,
    [cfg.namespace,viewer,req.params.id]);
   if(found.rowCount!==1)fail(404,"not_found");
   const p=found.rows[0],media=await db.query<{id:string}>(`SELECT id FROM luemi_private.media_assets
    WHERE owner_id=$1 AND environment=$2 AND state='approved' AND publication_status='published'
    ORDER BY position,id LIMIT 7`,[p.owner_id,cfg.namespace]);
   if(media.rows.length<3||media.rows.length>6)fail(404,"not_found");
   return {profile:{id:p.owner_id,name:p.display_name,age:dateAge(p.birth_date),city:p.city_label,
    countryCode:p.country_code,about:p.about??"",interests:p.interests,gender:p.gender,goal:p.goal,
    languages:p.languages,likedYouKind:p.liked_you_kind,
    photos:media.rows.map(photo=>({id:photo.id,url:"/api/v3/discovery/photo/"+photo.id}))}};
  });
 });
}
