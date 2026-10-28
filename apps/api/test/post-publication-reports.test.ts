import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8");
const ui=read("../../../apps/web/src/registration/RealLiveFeed.tsx");
const client=read("../../../apps/web/src/registration/real-live-client.ts");
const css=read("../../../apps/web/src/registration/real-live-feed.css");
const api=read("../src/rem05d-private.ts");
const safety=read("../src/safety-operator.ts");
const sql=read("../../../infra/migrations/0010_post_publication_report_reasons.sql");
test("nonconsensual photos and suspected minors have aligned reason names on every layer",()=>{
 for(const reason of ["minor_suspected","nonconsensual_photo"]){
  for(const source of [ui,client,api,safety,sql])
   assert(source.includes(reason),"missing "+reason);
 }
 assert.match(sql,/DROP CONSTRAINT reports_reason_code_check/);
 assert.match(sql,/ADD CONSTRAINT reports_reason_code_check/);
 assert.doesNotMatch(sql,/GRANT .* TO (anon|authenticated)/);
});
test("reports use an intentional accessible modal, no pre-publication moderation",()=>{
 assert.match(ui,/aria-modal="true"/);
 assert.match(ui,/role="dialog"/);
 assert.match(ui,/onEscape/);
 assert.match(ui,/Отправить жалобу/);
 assert.match(ui,/после публикации/);
 assert.match(ui,/onClick=\{\(\)=>openReport\(p\)\}/);
 assert.doesNotMatch(ui,/window\.confirm\("Отправить жалобу/);
 assert.match(ui,/blockPublishedUser/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.doesNotMatch(css,/backdrop-filter|mix-blend-mode|mask-image/);
});
