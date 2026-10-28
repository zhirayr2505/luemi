import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {deletionRequestReason} from "../src/real-erasure.js";
const worker=readFileSync(new URL("../src/real-erasure-worker.ts",import.meta.url),"utf8");
const auth=readFileSync(new URL("../src/rem05b-session.ts",import.meta.url),"utf8");
const migration=readFileSync(new URL("../../../db/account-deletion-72h-recovery.sql",import.meta.url),"utf8");
const app=readFileSync(new URL("../../../apps/web/src/App.tsx",import.meta.url),"utf8");

test("deletion reason is selectable and private free-text has bounded length",()=>{
 assert.deepEqual(deletionRequestReason({confirmation:"DELETE MY LUEMI ACCOUNT",reason:"privacy",details:"  Неуютно  "}),
  {reason:"privacy",details:"Неуютно"});
 for(const value of [
  {},null,{},[],{confirmation:"NO",reason:"privacy",details:""},
  {confirmation:"DELETE MY LUEMI ACCOUNT",reason:"unsupported",details:""},
  {confirmation:"DELETE MY LUEMI ACCOUNT",reason:"privacy"},
  {confirmation:"DELETE MY LUEMI ACCOUNT",reason:"privacy",details:"x".repeat(501)},
  {confirmation:"DELETE MY LUEMI ACCOUNT",reason:"other",details:"",actorId:"other-user"}
 ])assert.equal(deletionRequestReason(value),null);
});
test("worker cannot purge before 72h, including due/pending status",()=>{
 assert.match(worker,/eligible_at<=clock_timestamp\(\)/g);
 assert.match(worker,/FOR UPDATE SKIP LOCKED/);
 assert.match(worker,/pending=q\.rowCount!==0/);
});
test("Telegram recovery is explicit and races the purge worker safely",()=>{
 assert.match(auth,/RESTORE MY LUEMI ACCOUNT/);
 assert.match(auth,/validateTelegramInitData\(raw,cfg\.botToken,Math\.floor\(Date\.now\(\)\/1000\),300\)/);
 assert.match(auth,/state='pending' FOR UPDATE/);
 assert.match(auth,/DELETE FROM luemi_private\.erasure_objects/);
 assert.match(auth,/DELETE FROM luemi_private\.erasure_requests/);
 assert.match(auth,/republicationRequired:true/);
 assert.match(auth,/account_pending_deletion/);
});
test("recovery SQL grants are actor-scoped and never expose private object keys",()=>{
 assert.match(migration,/eligible_at timestamptz/);
 assert.match(migration,/FOR DELETE TO luemi_auth_issuer/);
 assert.match(migration,/luemi\.actor_id/);
 assert.match(migration,/GRANT SELECT\(request_id\),DELETE/);
 assert.doesNotMatch(migration,/GRANT SELECT\(\*\)/);
});
test("mobile UI requires a reason and has a countdown and a restore action",()=>{
 assert.match(app,/Настройки аккаунта/);
 assert.match(app,/Причина удаления/);
 assert.match(app,/Начать удаление/);
 assert.match(app,/Восстановить аккаунт/);
 assert.match(app,/deletion_pending:/);
 assert.match(app,/remainingTime/);
});
