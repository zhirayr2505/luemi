import {Pool} from "pg";
import type {FastifyInstance} from "fastify";
import {validateTelegramInitData} from "./telegram-auth.js";
export type SafetyAppealOptions={enabled:true;databaseUrl:string;namespace:string;origin:string;botToken:string};
export function registerSafetyAppeals(app:FastifyInstance,o:SafetyAppealOptions|undefined){
 if(!o?.enabled)return;
 if(!o.databaseUrl||!o.botToken||!/^[a-z0-9:_-]{1,96}$/i.test(o.namespace))
  throw Error("invalid_appeal_configuration");
 const pool=new Pool({connectionString:o.databaseUrl,max:2,connectionTimeoutMillis:3000});
 app.addHook("onClose",async()=>pool.end());
 app.post<{Body:unknown}>("/api/v3/safety/appeal",async(req,reply)=>{
  reply.header("Cache-Control","private, no-store");
  if(req.headers.origin!==o.origin||
     (req.headers["sec-fetch-site"]!==undefined&&req.headers["sec-fetch-site"]!=="same-origin"))
   return reply.code(403).send({error:"forbidden"});
  const b=req.body;
  if(!b||typeof b!=="object"||Array.isArray(b)||Object.keys(b).length!==2)
   return reply.code(422).send({error:"invalid_appeal"});
  const data=b as Record<string,unknown>;
  if(typeof data.initData!=="string"||typeof data.statement!=="string"||
    data.statement.length<20||data.statement.length>750||data.statement.trim()!==data.statement)
   return reply.code(422).send({error:"invalid_appeal"});
  const verified=validateTelegramInitData(data.initData,o.botToken,Math.floor(Date.now()/1000),300);
  if(!verified)return reply.code(401).send({error:"invalid_init_data"});
  const db=await pool.connect().catch(()=>null);
  if(!db)return reply.code(503).send({error:"service_unavailable"});
  try{
   const q=await db.query<{ok:boolean}>(
    "SELECT (r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls "+
    "AND session_user=current_user AND current_setting('row_security')='on' "+
    "AND pg_has_role(current_user,'luemi_safety_appeal','member') "+
    "AND NOT pg_has_role(current_user,'luemi_auth_issuer','member') "+
    "AND NOT pg_has_role(current_user,'luemi_request','member') "+
    "AND NOT pg_has_role(current_user,'luemi_safety_operator','member') "+
    "AND NOT pg_has_role(current_user,'pg_read_all_data','member') "+
    "AND NOT pg_has_role(current_user,'pg_write_all_data','member') "+
    "AND row_security_active('luemi_private.account_appeals'::regclass) "+
    "AND NOT has_table_privilege(current_user,'luemi_private.sessions','SELECT') "+
    "AND NOT has_table_privilege(current_user,'luemi_private.actors','UPDATE')) AS ok "+
    "FROM pg_roles r WHERE r.rolname=current_user");
   if(q.rowCount!==1||!q.rows[0].ok)return reply.code(503).send({error:"service_unavailable"});
   await db.query("BEGIN");
   await db.query("SELECT set_config('luemi.environment',$1,true)",[o.namespace]);
   await db.query("SELECT set_config('luemi.telegram_id',$1,true)",[String(verified.user.id)]);
   const a=await db.query<{id:string}>(
    "SELECT id FROM luemi_private.actors WHERE environment=$1 AND telegram_id=$2 AND status='suspended'",
    [o.namespace,String(verified.user.id)]);
   if(a.rowCount!==1){await db.query("ROLLBACK");return reply.code(404).send({error:"suspension_not_found"});}
   const e=await db.query<{id:string}>(
    "SELECT id FROM luemi_private.account_enforcements WHERE environment=$1 "+
    "AND actor_id=$2 AND state='suspended'",[o.namespace,a.rows[0].id]);
   if(e.rowCount!==1){await db.query("ROLLBACK");return reply.code(404).send({error:"suspension_not_found"});}
   const inserted=await db.query(
    "INSERT INTO luemi_private.account_appeals(environment,enforcement_id,actor_id,statement) "+
    "VALUES($1,$2,$3,$4) ON CONFLICT(enforcement_id) DO NOTHING",
    [o.namespace,e.rows[0].id,a.rows[0].id,data.statement]);
   await db.query("COMMIT");
   return inserted.rowCount===1
    ?reply.code(202).send({state:"appeal_received",reviewPending:true})
    :reply.code(409).send({error:"appeal_already_submitted"});
  }catch{
   await db.query("ROLLBACK").catch(()=>{});
   return reply.code(503).send({error:"service_unavailable"});
  }finally{db.release();}
 });
}
