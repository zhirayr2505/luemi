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
