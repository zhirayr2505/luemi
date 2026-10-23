import {randomUUID} from "node:crypto";
import {Pool} from "pg";
import type {PoolClient} from "pg";

export interface GeoBudgetConfig {
  databaseUrl:string;
  namespace:string;
  actorSearchPerDay:number;
  actorReversePerDay:number;
  globalDailyCap:number;
  maxInFlight:number;
}
export type GeoOperation="search"|"reverse";
export type Admission={ok:true;release:()=>Promise<void>}|{ok:false;reason:"quota"|"unavailable";retryAfter:number};

const UUID_ZERO="00000000-0000-0000-0000-000000000000";
/** Only this isolated DB principal can account provider spending. It must never
 * inherit issuer/request privileges, own tables, or bypass RLS. */
async function safeGeoRole(db:PoolClient):Promise<boolean>{
  try{
    const r=await db.query<{safe:boolean}>(`
      SELECT (r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls
        AND NOT r.rolcreaterole AND NOT r.rolcreatedb
        AND session_user=current_user AND current_setting('row_security')='on'
        AND pg_has_role(current_user,'luemi_geo_budget','member')
        AND NOT pg_has_role(current_user,'luemi_request','member')
        AND NOT pg_has_role(current_user,'luemi_auth_issuer','member')
        AND NOT pg_has_role(current_user,'pg_read_all_data','member')
        AND NOT pg_has_role(current_user,'pg_write_all_data','member')
        AND NOT pg_has_role(current_user,'pg_read_server_files','member')
        AND NOT pg_has_role(current_user,'pg_write_server_files','member')
        AND NOT pg_has_role(current_user,'pg_execute_server_program','member')
        AND NOT has_schema_privilege(current_user,'luemi_private','CREATE')
        AND NOT has_table_privilege(current_user,'luemi_private.actors','SELECT')
        AND NOT has_table_privilege(current_user,'luemi_private.sessions','SELECT')
        AND NOT EXISTS(SELECT 1 FROM pg_attribute a WHERE
          a.attrelid IN ('luemi_private.actors'::regclass,'luemi_private.sessions'::regclass)
          AND a.attnum>0 AND NOT a.attisdropped
          AND (has_column_privilege(current_user,a.attrelid,a.attname,'SELECT')
            OR has_column_privilege(current_user,a.attrelid,a.attname,'UPDATE')
            OR has_column_privilege(current_user,a.attrelid,a.attname,'INSERT')))
        AND NOT EXISTS(SELECT 1 FROM pg_class c WHERE
          c.oid IN ('luemi_private.geo_daily_usage'::regclass,
                    'luemi_private.geo_inflight'::regclass) AND c.relowner=r.oid)
        AND (SELECT bool_and(c.relrowsecurity AND c.relforcerowsecurity
           AND row_security_active(c.oid)) FROM pg_class c WHERE
          c.oid IN ('luemi_private.geo_daily_usage'::regclass,
                    'luemi_private.geo_inflight'::regclass))
        AND has_table_privilege(current_user,'luemi_private.geo_daily_usage','SELECT,INSERT,UPDATE')
        AND has_table_privilege(current_user,'luemi_private.geo_inflight','SELECT,INSERT,DELETE')
      ) AS safe FROM pg_roles r WHERE r.rolname=current_user`);
    return r.rowCount===1 && r.rows[0].safe===true;
  }catch{return false;}
}
export class GeoBudget {
  private readonly pool:Pool;
  constructor(private readonly config:GeoBudgetConfig){
    if(!config.databaseUrl||!/^[a-z0-9:_-]{1,96}$/i.test(config.namespace)||
      ![config.actorSearchPerDay,config.actorReversePerDay,
        config.globalDailyCap,config.maxInFlight].every(x=>Number.isSafeInteger(x)&&x>0)||
      config.maxInFlight>32)throw new Error("Invalid REM-05C isolated budget configuration");
    this.pool=new Pool({connectionString:config.databaseUrl,max:8,connectionTimeoutMillis:2000});
  }
  async close(){await this.pool.end();}
  /** Reservations count even when upstream fails. This deliberately
   * overcounts rather than allowing unbilled retries or key exhaustion. */
  async reserve(actorId:string,op:GeoOperation):Promise<Admission>{
    if(!/^[0-9a-f-]{36}$/i.test(actorId))return{ok:false,reason:"unavailable",retryAfter:60};
    const db=await this.pool.connect().catch(()=>null);
    if(!db)return{ok:false,reason:"unavailable",retryAfter:60};
    const id=randomUUID(),now=new Date(),day=now.toISOString().slice(0,10);
    const retryAfter=Math.max(1,Math.ceil((Date.parse(day+"T00:00:00.000Z")+86400000-now.getTime())/1000));
    let begun=false;
    try{
      if(!(await safeGeoRole(db)))return{ok:false,reason:"unavailable",retryAfter:60};
      await db.query("BEGIN");begun=true;
      // Transaction lock is shared by ALL PostgreSQL clients/Node instances.
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1), 51703)",[this.config.namespace]);
      await db.query("DELETE FROM luemi_private.geo_inflight WHERE namespace=$1 AND expires_at<clock_timestamp()",[this.config.namespace]);
      const busy=await db.query<{n:string}>("SELECT count(*)::text AS n FROM luemi_private.geo_inflight WHERE namespace=$1",[this.config.namespace]);
      if(Number(busy.rows[0].n)>=this.config.maxInFlight){
        await db.query("ROLLBACK");begun=false;
        return{ok:false,reason:"quota",retryAfter:7};
      }
      const entries=[
        {scope:"actor",actor:actorId,kind:op,limit:op==="search"?this.config.actorSearchPerDay:this.config.actorReversePerDay},
        {scope:"global",actor:UUID_ZERO,kind:"provider",limit:this.config.globalDailyCap}
      ];
      for(const entry of entries){
        const reserved=await db.query(`
          INSERT INTO luemi_private.geo_daily_usage(namespace,scope,actor_id,kind,period,used)
          VALUES($1,$2,$3,$4,$5,1)
          ON CONFLICT(namespace,scope,actor_id,kind,period)
          DO UPDATE SET used=luemi_private.geo_daily_usage.used+1
          WHERE luemi_private.geo_daily_usage.used < $6
          RETURNING used`,[this.config.namespace,entry.scope,entry.actor,entry.kind,day,entry.limit]);
        if(reserved.rowCount!==1){
          await db.query("ROLLBACK");begun=false;
          return{ok:false,reason:"quota",retryAfter};
        }
      }
      await db.query(`INSERT INTO luemi_private.geo_inflight(id,namespace,expires_at)
        VALUES($1,$2,clock_timestamp()+interval '12 seconds')`,[id,this.config.namespace]);
      await db.query("COMMIT");begun=false;
      return{ok:true,release:async()=>{
        const client=await this.pool.connect().catch(()=>null);
        if(!client)return; // TTL lease self-recovers if the connection is down
        try{
          if(await safeGeoRole(client)){
            await client.query("DELETE FROM luemi_private.geo_inflight WHERE id=$1 AND namespace=$2",[id,this.config.namespace]);
          }
        }catch{}finally{client.release();}
      }};
    }catch{
      if(begun)await db.query("ROLLBACK").catch(()=>{});
      return{ok:false,reason:"unavailable",retryAfter:60};
    }finally{db.release();}
  }
}
