import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const notice=readFileSync("apps/web/public/privacy-review.html","utf8");
const app=readFileSync("apps/web/src/registration/server-draft.ts","utf8");
test("public privacy preview discloses instant publication without claiming live policy approval",()=>{
 for(const detail of ["Черновик для согласования","Предварительной ручной проверки","отдельного явного подтверждения","закрытое хранилище","другим подходящим авторизованным","Удаление аккаунта","международной передачи"])
  assert(notice.includes(detail),detail+" missing from review notice");
 assert.match(notice,/noindex,nofollow/);
 assert.match(notice,/review-only/);
 assert.doesNotMatch(notice,/подтверждена и действует|юридически одобрена|гарантированное полное удаление/);
});
test("review-only notice cannot silently replace the approved public consent URL",()=>{
 assert.match(app,/VITE_LUEMI_PRIVACY_POLICY_PATH/);
 assert.doesNotMatch(app,/privacy-review\.html/);
});

test("public /privacy route accurately describes owner approval and pending effective date",()=>{
 const notice=readFileSync("apps/web/public/privacy.html","utf8");
 const server=readFileSync("apps/api/src/server.ts","utf8");
 const ui=readFileSync("apps/web/src/App.tsx","utf8");
 const v2=readFileSync("apps/web/src/registration/v2/RealRegistration.tsx","utf8");
 const steps=readFileSync("apps/web/src/registration/Steps.tsx","utf8");
 const privateHome=readFileSync("apps/web/src/registration/PrivateAccountView.tsx","utf8");
 for(const field of [
  "Гулгулджян Жирайр Григорьевич","@zhiiirro","Республика Армения",
  "Telegram","Render","Supabase","ручную предварительную проверку",
  "после публикации","72 часа","согласована владельцем"
 ]){
  assert(notice.includes(field),field+" missing");
 }
 assert.match(notice,/name="robots" content="noindex,nofollow/);
 assert.match(notice,/script-src 'none'/);
 assert.match(notice,/международная передача|международной передачи/);
 assert.match(notice,/не введена в действие/);
 assert.doesNotMatch(notice,/юридическая проверка завершена|удалены ровно через 72/);
 assert.match(server,/app\.get\("\/privacy"/);
 assert.match(server,/reply\.header\("Cache-Control","no-store"\)/);
 assert.match(server,/sendFile\("privacy.html"\)/);
 for(const file of [steps,privateHome])
  assert(file.includes('href="/privacy"'),"missing public policy link");
 assert.match(ui,/<RealRegistrationV2 draft=\{draft\}/,
  "Main app must render the real registration flow");
 assert.match(v2,/stage.id==="identity"&&<div className="v2-real-groups">\{step\(1\)\}\{step\(2\)\}/,
  "The first identity screen must display the policy consent step");
 assert.doesNotMatch(v2,/setServerConsent|photoServerCount/,
  "The final registration screens must not ask for consent again");
 assert.doesNotMatch(app,/privacy\.html|privacy-review\.html/);
});
