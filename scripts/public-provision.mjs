/** One-time, fail-closed public DB credentials preflight.
 * Bootstrap iff EVERY app role is NOLOGIN. Already provisioned roles are never
 * rotated or disabled from a public release retry. */
import {Client} from "pg";
import {ROLES,bootstrap,validateOwnerConnection} from "./closed-beta-bootstrap.mjs";
const owner=validateOwnerConnection(process.env.BETA_SUPABASE_OWNER_URL);
const db=new Client({connectionString:owner.href,connectionTimeoutMillis:6500});
try{
 await db.connect();
 const names=ROLES.map(([name])=>name);
 const rows=(await db.query("SELECT rolname,rolcanlogin FROM pg_roles WHERE rolname=ANY($1::name[])",[names])).rows;
 if(rows.length!==ROLES.length)throw Error("Missing scoped DB role shells");
 const login=rows.filter(r=>r.rolcanlogin).length;
 if(login===0){
  await db.end();
  await bootstrap({admissionMode:"open"});
  if(process.exitCode)throw Error("Credential bootstrap failed");
 }else if(login===ROLES.length){
  console.info("LUEMI_SCOPED_ROLES_EXIST: skipped credential rotation; public activation validates every connection.");
 }else{
  throw Error("Partially provisioned role set; operator recovery required");
 }
}catch(e){
 console.error("LUEMI_PUBLIC_PROVISION_FAILED: "+(e instanceof Error?e.message:"unknown"));
 process.exitCode=1;
}finally{await db.end().catch(()=>{});}
