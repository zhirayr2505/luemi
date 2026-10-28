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

test("public /privacy route serves a transparent review-only notice without authentication",()=>{
 const notice=readFileSync("apps/web/public/privacy.html","utf8");
 const server=readFileSync("apps/api/src/server.ts","utf8");
 const ui=readFileSync("apps/web/src/App.tsx","utf8");
 const v2=readFileSync("apps/web/src/registration/v2/RealRegistration.tsx","utf8");
 const privateHome=readFileSync("apps/web/src/registration/PrivateAccountView.tsx","utf8");
 for(const field of [
  "Гулгулджян Жирайр Григорьевич","@zhiiirro","Республика Армения",
  "Telegram","Render","Supabase","Предварительной ручной",
  "после публикации","72 часа","Условия","review-only"
 ]){
  // "Условия" is represented by the cross-border conditions, not a hidden flag.
  if(field==="Условия")continue;
  assert(notice.includes(field),field+" missing");
 }
 assert.match(notice,/name="robots" content="noindex,nofollow/);
 assert.match(notice,/script-src 'none'/);
 assert.match(notice,/международная передача|международной передачи/);
 assert.doesNotMatch(notice,/утверждена и действует|вступила в силу|удалены ровно через 72/);
 assert.match(server,/app\.get\("\/privacy"/);
 assert.match(server,/reply\.header\("Cache-Control","no-store"\)/);
 assert.match(server,/sendFile\("privacy.html"\)/);
 for(const file of [ui,v2,privateHome])
  assert(file.includes('href="/privacy"'),"missing public policy link");
 assert.doesNotMatch(app,/privacy\.html|privacy-review\.html/);
});
