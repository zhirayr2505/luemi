import test from "node:test";
import assert from "node:assert/strict";
import {Client} from "pg";
import {ROLES,validateOwnerConnection,makeEncryptedConnection,makeScopedConnection,checkRoleMetadata,admissionNamespace,validateSavedScopedConnection,classifyScopedConnectionFailure,assertEncryptedClient} from "./closed-beta-bootstrap.mjs";
const project="czzyoxrwtnvbicypwrdd";
const owner="postgresql://postgres."+project+":NOT_A_REAL_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require";
test("requires LUEMI owner and session-mode IPv4 pooler, never an assumed generic host",()=>{
 assert.equal(validateOwnerConnection(owner).hostname,"aws-0-eu-central-1.pooler.supabase.com");
 for(const other of [
   owner.replace(project,"notourproject"),owner.replace(":5432/",":6543/"),
   owner.replace("aws-0-eu-central-1.pooler.supabase.com","db."+project+".supabase.co"),
   owner.replace("/postgres?","/other?"),
   owner.replace("postgres."+project,"postgres.other")
 ])assert.throws(()=>validateOwnerConnection(other),/Owner DB URL/);
});
test("produces scoped session URL with correct project-qualified login",()=>{
 const u=makeScopedConnection(validateOwnerConnection(owner),"luemi_beta_request","f".repeat(64));
 const parsed=new URL(u);
 assert.equal(decodeURIComponent(parsed.username),"luemi_beta_request."+project);
 assert.equal(parsed.hostname,"aws-0-eu-central-1.pooler.supabase.com");
 assert.equal(parsed.port,"5432");
 assert.equal(parsed.password,"f".repeat(64));
 assert.equal(parsed.searchParams.get("sslmode"),"require");
 assert.equal(parsed.searchParams.get("uselibpqcompat"),"true");
 assert.throws(()=>makeScopedConnection(validateOwnerConnection(owner),"postgres","f".repeat(64)));
 assert.throws(()=>makeScopedConnection(validateOwnerConnection(owner),"luemi_beta_auth","poor"));
});
test("fails closed when any shell is LOGIN, privileged, missing or shares a second role",()=>{
 const okay=ROLES.map(([name,grant])=>({
  rolname:name,rolcanlogin:false,rolsuper:false,rolbypassrls:false,
  rolcreatedb:false,rolcreaterole:false,count_memberships:1,member_of:grant
 }));
 assert.doesNotThrow(()=>checkRoleMetadata(okay));
 assert.throws(()=>checkRoleMetadata(okay.slice(1)),/incomplete/);
 for(const change of [
  {rolcanlogin:true},{rolsuper:true},{rolbypassrls:true},
  {rolcreatedb:true},{rolcreaterole:true},{count_memberships:2},{member_of:"postgres"}
 ]){
  assert.throws(()=>checkRoleMetadata([{...okay[0],...change},...okay.slice(1)]),/Unsafe beta role/);
 }
});

test("open signups provision to the production namespace without requiring Telegram invitations",()=>{
 assert.equal(admissionNamespace("open"),"luemi-production");
 assert.equal(admissionNamespace("beta"),"luemi-beta-20261027");
 for(const mode of ["all","everyone","",undefined,null]){
  assert.throws(()=>admissionNamespace(mode),/Select approved/);
 }
});

test("recover only previously stored scoped URLs for the exact project, host, role and strong password",()=>{
 const db=validateOwnerConnection(owner);
 const pwd="f".repeat(64);
 const valid=makeScopedConnection(db,"luemi_beta_auth",pwd);
 assert.equal(validateSavedScopedConnection(db,"luemi_beta_auth",valid),pwd);
 for(const invalid of [
   valid.replace("luemi_beta_auth","luemi_beta_chats"),
   valid.replace(db.hostname,"aws-0-us-east-1.pooler.supabase.com"),
   valid.replace(":5432/",":6543/"),
   valid.replace(pwd,"weak"),
   valid.replace("sslmode=require","sslmode=disable"),
   valid.replace("uselibpqcompat=true","uselibpqcompat=false"),
   valid+"&host=attacker.example",
   valid+"#fragment"
 ])assert.throws(()=>validateSavedScopedConnection(db,"luemi_beta_auth",invalid));
});
test("classify opaque pooler errors without reflecting untrusted or secret-bearing messages",()=>{
 for(const [error,expected] of [
  [{message:"FATAL: password authentication failed for user custom"},"AUTH_REJECTED"],
  [{code:"28P01",message:"secret here"},"AUTH_REJECTED"],
  [{message:"Tenant or user not found"},"TENANT_USER_NOT_FOUND"],
  [{message:"FATAL: Circuit breaker open"},"POOLER_CIRCUIT_BREAKER"],
  [{message:"EAUTHQUERY unsupported or invalid secret format"},"POOLER_AUTH_QUERY"],
  [{code:"ECONNREFUSED"},"CONNECTION_REFUSED"],
  [{message:"connection timeout"},"TIMEOUT"],
  [{code:"42501"},"PERMISSION_DENIED"],
  [{message:"secret postgres://user:pass@some.host"},"OTHER"]
 ])assert.equal(classifyScopedConnectionFailure(error),expected);
});

test("no plaintext: owner and every role require encrypted libpq-compatible TLS",()=>{
 const db=validateOwnerConnection(owner.replace("?sslmode=require",""));
 const ownerTls=makeEncryptedConnection(db);
 assert.equal(ownerTls.searchParams.get("sslmode"),"require");
 assert.equal(ownerTls.searchParams.get("uselibpqcompat"),"true");
 for(const url of [ownerTls.href,...ROLES.map(([name])=>
  makeScopedConnection(db,name,"f".repeat(64)))]){
  const params=new Client({connectionString:url}).connectionParameters;
  assert.equal(params.ssl?.rejectUnauthorized,false);
  assert.equal(new URL(url).hostname,db.hostname);
  assert.equal(new URL(url).port,"5432");
 }
 assert.throws(()=>assertEncryptedClient({connection:{stream:{encrypted:false}}}),/Unencrypted/);
 assert.throws(()=>assertEncryptedClient({connection:{stream:{}}}),/Unencrypted/);
 assert.doesNotThrow(()=>assertEncryptedClient({connection:{stream:{encrypted:true}}}));
});
test("old saved credentials are accepted only for the exact legacy URL to permit safe upgrade",()=>{
 const db=validateOwnerConnection(owner);
 const pwd="a".repeat(64),role="luemi_beta_auth";
 const legacy=new URL(db.href);
 legacy.username=role+"."+project;legacy.password=pwd;
 legacy.searchParams.set("sslmode","require");
 assert.equal(validateSavedScopedConnection(db,role,legacy.href),pwd);
 assert.equal(validateSavedScopedConnection(db,role,makeScopedConnection(db,role,pwd)),pwd);
 for(const invalid of [
  legacy.href+"&host=evil.example",
  legacy.href.replace("sslmode=require","sslmode=disable"),
  legacy.href.replace("sslmode=require","sslmode=prefer"),
  legacy.href.replace("/postgres?","/sample?"),
  legacy.href.replace("5432/","6543/")
 ])assert.throws(()=>validateSavedScopedConnection(db,role,invalid));
});
test("owner URL rejects connection-string host override, plaintext flags and extra parameters",()=>{
 for(const invalid of [
  owner+"&host=evil.example",
  owner+"&sslmode=disable",
  owner+"&sslmode=prefer",
  owner+"&ssl=false",
  owner+"&options=-c%20search_path%3Dpublic",
  owner+"&uselibpqcompat=false",
  owner+"&sslmode=verify-full",
  owner+"&application_name=evil"
 ])assert.throws(()=>validateOwnerConnection(invalid),/Owner DB URL/);
});
test("sanitize sensitive TLS exceptions into stable enum, never raw data",()=>{
 for(const error of [
  {code:"UNABLE_TO_VERIFY_LEAF_SIGNATURE",message:"bad root secret"},
  {code:"SELF_SIGNED_CERT_IN_CHAIN",message:"secret"},
  {code:"ERR_TLS_CERT_ALTNAME_INVALID",message:"wrong host"}
 ])assert.equal(classifyScopedConnectionFailure(error),"TLS_CERT_VERIFY_FAILED");
 assert.equal(classifyScopedConnectionFailure({message:"SSL required"}),"TLS_FAILURE");
});
