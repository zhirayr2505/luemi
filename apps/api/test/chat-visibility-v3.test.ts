import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const migration=readFileSync(new URL("../../../db/chats-v3-visibility.sql",import.meta.url),"utf8");
const api=readFileSync(new URL("../src/chats-api.ts",import.meta.url),"utf8");
const client=readFileSync(new URL("../../../apps/web/src/chats/chat-transport.ts",import.meta.url),"utf8");
const ui=readFileSync(new URL("../../../apps/web/src/chats/RealChats.tsx",import.meta.url),"utf8");
test("visibility tables are private, enforced by RLS, and append-only to the chat role",()=>{
 for(const table of ["message_visibility","conversation_clear_events"]){
  assert.match(migration,new RegExp("CREATE TABLE IF NOT EXISTS luemi_chats\\."+table));
  assert.match(migration,new RegExp("ALTER TABLE luemi_chats\\."+table+" FORCE ROW LEVEL SECURITY"));
 }
 assert.match(migration,/REVOKE ALL ON luemi_chats\.message_visibility,luemi_chats\.conversation_clear_events/);
 assert.match(migration,/GRANT SELECT,INSERT ON luemi_chats\.message_visibility,luemi_chats\.conversation_clear_events/);
 assert.doesNotMatch(migration,/GRANT\s+(?:ALL|UPDATE|DELETE)\s+ON\s+luemi_chats\.(?:message_visibility|conversation_clear_events)/);
 assert.match(migration,/mb\.actor_id=message_visibility\.actor_id/);
 assert.match(migration,/mb\.actor_id=conversation_clear_events\.actor_id/);
});
test("both deletion scopes share trusted authenticated server-side session",()=>{
 assert.match(api,/\/api\/v4\/chats\/:id\/messages\/:messageId\/visibility/);
 assert.match(api,/\/api\/v4\/chats\/:id\/clear/);
 assert.match(api,/req\.body\?\.scope!=="me"&&req\.body\?\.scope!=="everyone"/);
 assert.match(api,/preHandler:auth\.mutation/);
 assert.match(api,/await member\(db,req\.params\.id,actor\)/);
 assert.match(api,/visibleMessage\("msg"\)/);
 assert.match(api,/visibleMessage\("m","\$4"\)/);
 assert.match(api,/visibleMessage\("msg","\$3"\)/);
 assert.doesNotMatch(api,/DELETE FROM luemi_chats\.messages/);
});
test("UI offers delete locally or for both participants, with no erased-content resurrection",()=>{
 assert.match(client,/remove\(conversationId:string,messageId:string,scope:"me"\|"everyone"/);
 assert.match(client,/clear\(conversationId:string,scope:"me"\|"everyone"/);
 assert.match(ui,/Только у меня/);
 assert.match(ui,/У меня и собеседника/);
 assert.match(ui,/Удалить переписку/);
 assert.match(ui,/Удалённый аккаунт/);
 assert.match(ui,/const preserved=earliest/);
});
