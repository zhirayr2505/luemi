import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const api=readFileSync("apps/api/src/chats-api.ts","utf8");
const sql=readFileSync("db/chats-v1/001_complete_messages_media.sql","utf8");
const ui=readFileSync("apps/web/src/chats/RealChats.tsx","utf8");
assert.match(api,/validId\(req\.body\?\.clientId\)/,"send remains idempotent by client UUID");
assert.match(api,/validateChatImageBytes/,"server validates image bytes");
assert.match(api,/signedRead\([^,]+,60\)/,"media URLs are short lived");
assert.match(sql,/FORCE ROW LEVEL SECURITY/);
assert.match(sql,/luemi_chats\.live_match/);
assert.doesNotMatch(ui,/window\.(prompt|confirm)/);
assert.match(ui,/AbortController/);
assert.match(ui,/isNearBottom/);
console.log("LUEMI Chats V1 source contracts PASS");
