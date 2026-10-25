// REG01G owner-controlled, manual invite roster operator. Not an HTTP route.
// CLI: REG01G_INVITES_OPERATOR_ENABLED=1 REG01G_INVITES_APPROVED=1
//      REG01G_INVITE_DATABASE_URL=... REM05B_BOT_NAMESPACE=... node ... grant 123456789
// Never log Telegram user IDs or database credentials.
import {Pool} from "pg";
import type {PoolClient} from "pg";
export async function inviteRoleSafe(db:PoolClient):Promise<boolean>{
 try{
  const r=await db.query<{ok:boolean}>(
   "SELECT (r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls "+
   "AND NOT r.rolcreaterole AND NOT r.rolcreatedb AND session_user=current_user "+
   "AND pg_has_role(current_user,'luemi_invite_operator','member') "+
   "AND NOT pg_has_role(current_user,'luemi_auth_issuer','member') "+
   "AND NOT pg_has_role(current_user,'luemi_request','member') "+
   "AND NOT pg_has_role(current_user,'luemi_moderator','member') "+
   "AND NOT pg_has_role(current_user,'luemi_human_moderator','member') "+
   "AND NOT pg_has_role(current_user,'luemi_erasure_worker','member') "+
   "AND NOT pg_has_role(current_user,'pg_read_all_data','member') "+
   "AND NOT pg_has_role(current_user,'pg_write_all_data','member') "+
   "AND row_security_active('luemi_private.beta_invites'::regclass) "+
   "AND NOT has_schema_privilege(current_user,'luemi_private','CREATE') "+
   "AND NOT has_table_privilege(current_user,'luemi_private.sessions','SELECT') "+
   "AND NOT has_table_privilege(current_user,'luemi_private.actors','SELECT') "+
   "AND NOT has_table_privilege(current_user,'luemi_private.beta_invites','DELETE')) AS ok "+
   "FROM pg_roles r WHERE r.rolname=current_user");
  return r.rowCount===1&&r.rows[0].ok===true;
 }catch{return false;}
}
export async function changeInvite(input:{databaseUrl:string;namespace:string;telegramId:string;state:"active"|"revoked"}){
 if(!input.databaseUrl||!/^[a-z0-9:_-]{1,96}$/i.test(input.namespace)||
   !/^[1-9][0-9]{0,18}$/.test(input.telegramId)||
   BigInt(input.telegramId)>9223372036854775807n)
  throw new Error("invalid_beta_invite");
 const pool=new Pool({connectionString:input.databaseUrl,max:1,connectionTimeoutMillis:3000});
 try{
  const db=await pool.connect();
  try{
   if(!await inviteRoleSafe(db))throw new Error("invite_operator_role_denied");
   await db.query("BEGIN");
   await db.query("SELECT set_config('luemi.environment',$1,true)",[input.namespace]);
   const done=await db.query(
    "INSERT INTO luemi_private.beta_invites(environment,telegram_id,state,revoked_at) "+
    "VALUES($1,$2,$3,CASE WHEN $3='revoked' THEN clock_timestamp() ELSE NULL END) "+
    "ON CONFLICT(environment,telegram_id) DO UPDATE SET state=EXCLUDED.state, "+
    "revoked_at=EXCLUDED.revoked_at RETURNING state",
    [input.namespace,input.telegramId,input.state]);
   if(done.rowCount!==1)throw new Error("invite_write_denied");
   await db.query("COMMIT");
   return{state:input.state};
  }catch(error){await db.query("ROLLBACK").catch(()=>{});throw error;}
  finally{db.release();}
 }finally{await pool.end();}
}
if(import.meta.url===`file://${process.argv[1]}`){
 const [action,telegramId]=process.argv.slice(2);
 if(process.env.REG01G_INVITES_OPERATOR_ENABLED!=="1"||
    process.env.REG01G_INVITES_APPROVED!=="1"||
    !["grant","revoke"].includes(action??"")||
    !process.env.REG01G_INVITE_DATABASE_URL||!process.env.REM05B_BOT_NAMESPACE)
  throw new Error("Invitation operator disabled or incomplete");
 void changeInvite({databaseUrl:process.env.REG01G_INVITE_DATABASE_URL,
  namespace:process.env.REM05B_BOT_NAMESPACE,telegramId:telegramId??"",
  state:action==="grant"?"active":"revoked"})
  .then(()=>process.stdout.write("Invitation roster operation recorded.\n"))
  .catch(()=>{process.stderr.write("Invitation roster update refused.\n");process.exitCode=1;});
}
