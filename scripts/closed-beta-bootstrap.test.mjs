import test from "node:test";
import assert from "node:assert/strict";
import {ROLES,validateOwnerConnection,makeScopedConnection,checkRoleMetadata} from "./closed-beta-bootstrap.mjs";
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
