// REAL-REG-01: optional, PRIVATE draft-only API. No publication, images or public reads.
import {timingSafeEqual} from "node:crypto";
import type {FastifyInstance,FastifyReply,FastifyRequest} from "fastify";
import {Pool} from "pg";
import type {PoolClient} from "pg";
import {safeDb} from "./rem05d-private.js";
import {validateRealRegistrationDraft} from "./real-registration-validator.js";

export interface RealRegistrationOptions {
  enabled:true;requestDatabaseUrl:string;namespace:string;consentVersion:string;
}
type Guard={read:(req:FastifyRequest,reply:FastifyReply)=>Promise<void>;
 mutation:(req:FastifyRequest,reply:FastifyReply)=>Promise<void>};
class Failure extends Error{constructor(readonly status:number,readonly code:string){super(code);}}
function deny(status:number,code:string):never{throw new Failure(status,code);}
function plainObject(v:unknown):v is Record<string,unknown>{
  return v!==null&&typeof v==="object"&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
}
export function registerRealRegistrationDrafts(
 app:FastifyInstance,guard:Guard|undefined,options:RealRegistrationOptions|undefined
):void{
 if(!options?.enabled)return;
 if(!guard||!options.requestDatabaseUrl||!/^[a-z0-9:_-]{1,96}$/i.test(options.namespace)||
    !/^[a-z0-9][a-z0-9._:-]{2,63}$/i.test(options.consentVersion))
   throw new Error("REAL-REG-01 requires v2 sessions, approved policy, isolated request DB role");
 const cfg=options;
 const auth:Guard=guard;
 const pool=new Pool({connectionString:cfg.requestDatabaseUrl,max:5,connectionTimeoutMillis:3000});
 app.addHook("onClose",async()=>{await pool.end();});
 async function owner<T>(
  req:FastifyRequest,reply:FastifyReply,fn:(db:PoolClient,id:string)=>Promise<T>
 ):Promise<T|FastifyReply>{
  const original=req.authActor;
  if(reply.sent||!original)return reply;
  const db=await pool.connect().catch(()=>null);
  if(!db)return reply.code(503).send({error:"service_unavailable"});
  try{
   // Check the SAME checkout before any SQL, and never rely on pooled role assumptions.
   if(!await safeDb(db,"luemi_request"))deny(503,"service_unavailable");
   await db.query("BEGIN");
   await db.query("SELECT set_config('luemi.actor_id',$1,true)",[original.actorId]);
   await db.query("SELECT set_config('luemi.environment',$1,true)",[cfg.namespace]);
   const active=await db.query(
    "SELECT id FROM luemi_private.actors WHERE id=$1 AND environment=$2 AND status='active'",
    [original.actorId,cfg.namespace]
   );
   if(active.rowCount!==1)deny(401,"unauthorized");
   const result=await fn(db,original.actorId);
   // A session revoked while SQL is running must not commit a private write.
   await auth.read(req,reply);
   if(reply.sent||!req.authActor||req.authActor.actorId!==original.actorId||
     req.authActor.sessionId!==original.sessionId||
     !timingSafeEqual(req.authActor.hash,original.hash))deny(401,"unauthorized");
   await db.query("COMMIT");
   return result;
  }catch(e){
   await db.query("ROLLBACK").catch(()=>{});
   if(reply.sent)return reply;
   if(e instanceof Failure)return reply.code(e.status).send({error:e.code});
   return reply.code(503).send({error:"service_unavailable"});
  }finally{db.release();}
 }
 app.get("/api/v3/registration/draft",{preHandler:guard.read},async(req,reply)=>{
  reply.header("Cache-Control","private, no-store");
  return owner(req,reply,async(db,id)=>{
   const q=await db.query<{revision:string;payload:Record<string,unknown>;
    birth_date:string|null;consent_version:string|null}>(
    "SELECT revision::text,payload,birth_date::text,consent_version "+
    "FROM luemi_private.private_profile_drafts WHERE owner_id=$1 AND environment=$2",
    [id,cfg.namespace]);
   if(q.rowCount!==1)return{state:"empty",revision:0,fields:{}};
   const r=q.rows[0];
   return{state:"private",revision:Number(r.revision),fields:{
     ...r.payload,...(r.birth_date?{birthDate:r.birth_date}:{}),
     ...(r.consent_version?{consentVersion:r.consent_version}:{})
   }};
  });
 });
 app.put<{Body:unknown}>("/api/v3/registration/draft",{preHandler:guard.mutation},async(req,reply)=>
  owner(req,reply,async(db,id)=>{
   const body=req.body;
   if(!plainObject(body)||Object.keys(body).length!==2||
     !Object.hasOwn(body,"revision")||!Object.hasOwn(body,"fields")||
     !Number.isSafeInteger(body.revision)||Number(body.revision)<0)
      deny(422,"invalid_draft");
   const parsed=validateRealRegistrationDraft(body.fields,cfg.consentVersion);
   if(!parsed.ok)deny(parsed.error==="consent_required"?403:422,parsed.error);
   const revision=Number(body.revision);
   const params=[id,cfg.namespace,JSON.stringify(parsed.payload),parsed.birthDate,parsed.consentVersion];
   if(revision===0){
    const inserted=await db.query(
     "INSERT INTO luemi_private.private_profile_drafts(owner_id,environment,revision,payload,birth_date,consent_version) "+
     "VALUES($1,$2,1,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING revision",params);
    if(inserted.rowCount!==1)deny(409,"revision_conflict");
    return {state:"private",revision:1,published:false};
   }
   const updated=await db.query<{revision:string}>(
    "UPDATE luemi_private.private_profile_drafts SET revision=revision+1,payload=$3,"+
    "birth_date=$4,consent_version=$5,updated_at=clock_timestamp() "+
    "WHERE owner_id=$1 AND environment=$2 AND revision=$6 RETURNING revision::text",
    [...params,revision]);
   if(updated.rowCount!==1)deny(409,"revision_conflict");
   return{state:"private",revision:Number(updated.rows[0].revision),published:false};
  })
 );
 // GET and PUT are all this module registers. No public profile or publish endpoint.
}
