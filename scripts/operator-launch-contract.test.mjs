import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("scripts/provision-operator-roles.mjs","utf8");
const bootstrap=readFileSync(".github/workflows/luemi-operator-bootstrap.yml","utf8");
const maintenance=readFileSync("scripts/operate-erasure-queue.mjs","utf8");
test("operator bootstrap is owner-confirmed and held behind protected GH environment",()=>{
 assert.match(bootstrap,/workflow_dispatch:/);
 assert.match(bootstrap,/github\.actor == 'zhirayr2505'/);
 assert.match(bootstrap,/github\.ref == 'refs\/heads\/main'/);
 assert.match(bootstrap,/environment: beta-bootstrap/);
 assert.match(bootstrap,/persist-credentials: false/);
 assert.doesNotMatch(bootstrap,/schedule:/);
});
test("four isolated operator logins never reuse live API session or shared owner grants",()=>{
 for(const [login,parent,key] of [
  ["luemi_ops_erasure_request","luemi_erasure_requester","REM06_ERASURE_REQUEST_DATABASE_URL"],
  ["luemi_ops_erasure_worker","luemi_erasure_worker","REM06_ERASURE_WORKER_DATABASE_URL"],
  ["luemi_ops_safety","luemi_safety_operator","REG01H_SAFETY_OPERATOR_DATABASE_URL"],
  ["luemi_ops_reports","luemi_human_moderator","REG01G_MODERATOR_DATABASE_URL"]]){
  assert(source.includes('"'+login+'","'+parent+'","'+key+'"'));
 }
 assert.match(source,/randomBytes\(32\)/);
 assert.match(source,/createHmac\("sha256"/);
 assert.match(source,/NOLOGIN PASSWORD/);
 assert.match(source,/ALTER ROLE /);
 assert.match(source,/assertEncryptedClient/);
 assert.match(source,/operator_connection_not_verified/);
 assert.doesNotMatch(source,/REM06_OPEN_SIGNUPS_ENABLED|REM06_PRIVACY_APPROVED|REM06_PUBLICATION_ENABLED|REM06_INSTANT_PUBLICATION_ENABLED/);
});
test("erasure batch is bounded and refuses absent approvals or wrong project",()=>{
 assert.match(maintenance,/roleProbe\(worker/);
 assert.match(maintenance,/roleProbe\(safety/);
 assert.match(maintenance,/await erasureRoleSafe/);
 assert.match(maintenance,/await safeSafetyRole/);
 assert.match(maintenance,/await listReviewQueue/);
 assert.match(maintenance,/if\(action==="verify"\)return/);
 assert.match(maintenance,/REM06_ERASURE_MAINTENANCE_APPROVED/);
 assert.match(maintenance,/REM06_MEDIA_BUCKET/);
 assert.match(maintenance,/limit:5/);
 assert.match(maintenance,/if\(result.failed>0\|\|result.pending\)/);
 assert.doesNotMatch(maintenance,/console\.log\(.*(token|secret|password|url)/);
});

test("scheduled erasure requires disabled-by-default repository variable and approved Render policy",()=>{
 const flow=readFileSync(".github/workflows/luemi-operator-erasure.yml","utf8");
 assert.match(flow,/LUEMI_ERASURE_AUTOMATION_ENABLED == '1'/);
 assert.match(flow,/RUN_LUEMI_APPROVED_ERASURE_BATCH/);
 assert.match(flow,/environment: beta-bootstrap/);
 assert.match(flow,/persist-credentials: false/);
 assert.match(maintenance,/action==="erase"\?"RUN_LUEMI_APPROVED_ERASURE_BATCH"/);
 assert.match(maintenance,/REM06_ERASURE_WORKER_ENABLED/);
 assert.match(maintenance,/REM06_ERASURE_POLICY_APPROVED/);
 assert.match(maintenance,/REM06_ERASURE_MAINTENANCE_APPROVED/);
});

test("read-only operator verification accepts private beta but refuses destructive erasure there",()=>{
 assert.match(maintenance,/\["luemi-beta-20261027","luemi-production"\]\.includes\(namespace\)/);
 assert.match(maintenance,/action==="erase"&&namespace!=="luemi-production"/);
 assert.match(maintenance,/erasure_requires_production_namespace/);
 assert.match(maintenance,/if\(action==="verify"\)return/);
});
test("operator diagnostics expose fixed phases, never database errors or credentials",()=>{
 for(const step of ["namespace","operator_credentials","requester_login","worker_login",
   "safety_login","reviewer_login_and_queue","erasure_approval",
   "private_storage_configuration","approved_erasure_batch"]){
  assert.ok(maintenance.includes('diagnosticPhase="'+step+'"'));
 }
 assert.match(maintenance,/LUEMI_OPERATOR_OPERATION_REFUSED phase=/);
 assert.doesNotMatch(maintenance,/process\.stderr\.write\(.*(?:error\.message|error\.stack|token|password|secret)/i);
});

test("erasure refuses incomplete social dependencies before ANY private Storage deletion",()=>{
 const worker=readFileSync("apps/api/src/real-erasure-worker.ts","utf8");
 const guard=worker.indexOf("const coverage=await db.query");
 const deleteObject=worker.indexOf("await options.storage.delete");
 assert.ok(guard>0&&deleteObject>guard);
 for(const fragment of ["luemi_bliki_private.stories","author_id",
   "luemi_private.human_report_reviews","erasure_unsupported_evidence_or_bliki",
   "erasure_actor_anonymize_denied","deleted_account_sentinel_seq"]){
  assert.ok(worker.includes(fragment),"missing coverage guard: "+fragment);
 }
 assert.ok(worker.indexOf("erasure_unsupported_evidence_or_bliki")<deleteObject);
});
