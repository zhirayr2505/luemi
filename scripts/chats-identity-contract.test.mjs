import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const trusted=readFileSync("db/chats-v1-trusted-reconcile.sql","utf8");
const review=readFileSync("db/chats-v1-match-reconciliation-review.sql","utf8");
const migration=readFileSync("infra/migrations/0002_rem05b_identity_sessions.sql","utf8");
const chats=readFileSync("db/chats-v1-isolated.sql","utf8");

// The Telegram identity in the V2 actor table and the legacy profile table
// is bigint, NEVER UUID or a text comparison. Cross-system IDs are distinct.
assert.match(migration,/telegram_id bigint NOT NULL/);
for(const sql of [trusted,review]){
  assert.doesNotMatch(sql,/telegram_user_id::text/);
  assert.match(sql,/telegram_id\s*=\s*\w+\.telegram_user_id/);
  assert.doesNotMatch(sql,/actor_id\s*=\s*\w+\.id\b/i);
}
assert.match(trusted,/a1\.status='active'/);
assert.match(trusted,/a2\.status='active'/);
assert.match(trusted,/m\.status='active'/);
assert.match(trusted,/NOT EXISTS\s*\([\s\S]*?luemi_blocks/);
assert.match(chats,/FORCE ROW LEVEL SECURITY/g);
assert.match(chats,/actor_id\s*=\s*nullif\(current_setting\('luemi\.actor_id'/);
console.log("LUEMI chats identity and RLS contract PASS");
