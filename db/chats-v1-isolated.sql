-- LUEMI Chats V1: isolated, fail-closed schema. Run ONLY after security review.
-- Provision the login role separately with NO BYPASSRLS, NO CREATEDB, NO CREATEROLE.
-- A trusted matchmaking service must insert both members after a mutual match;
-- no public/client endpoint may create conversations or membership.
BEGIN;
CREATE SCHEMA IF NOT EXISTS luemi_chats;
CREATE TABLE IF NOT EXISTS luemi_chats.conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 environment text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT chat_environment_len CHECK (length(environment) BETWEEN 1 AND 96)
);
CREATE TABLE IF NOT EXISTS luemi_chats.members (
 conversation_id uuid NOT NULL REFERENCES luemi_chats.conversations(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL,
 environment text NOT NULL,
 last_read_at timestamptz,
 PRIMARY KEY(conversation_id,actor_id)
);
CREATE INDEX IF NOT EXISTS chat_members_actor ON luemi_chats.members(actor_id,environment);
CREATE TABLE IF NOT EXISTS luemi_chats.messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES luemi_chats.conversations(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL,
 environment text NOT NULL,
 client_id uuid NOT NULL,
 body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now(),
 edited_at timestamptz,
 deleted_at timestamptz,
 UNIQUE(conversation_id,sender_id,client_id)
);
CREATE INDEX IF NOT EXISTS chat_messages_page ON luemi_chats.messages(conversation_id,created_at DESC,id DESC);
ALTER TABLE luemi_chats.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.members FORCE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.messages FORCE ROW LEVEL SECURITY;
-- A dedicated application role receives SELECT on members, but only for its own actor.
CREATE POLICY chats_members_read ON luemi_chats.members FOR SELECT USING (
 actor_id = nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment = current_setting('luemi.environment',true)
);
-- Message membership is checked via the members policy, not a client-supplied sender.
CREATE POLICY chats_messages_read ON luemi_chats.messages FOR SELECT USING (
 environment=current_setting('luemi.environment',true)
 AND EXISTS(SELECT 1 FROM luemi_chats.members m WHERE m.conversation_id=messages.conversation_id
 AND m.actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid AND m.environment=messages.environment)
);
CREATE POLICY chats_messages_insert ON luemi_chats.messages FOR INSERT WITH CHECK (
 sender_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true)
 AND EXISTS(SELECT 1 FROM luemi_chats.members m WHERE m.conversation_id=messages.conversation_id
 AND m.actor_id=messages.sender_id AND m.environment=messages.environment)
);
CREATE POLICY chats_messages_update ON luemi_chats.messages FOR UPDATE USING (
 sender_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true)
) WITH CHECK (
 sender_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true)
);
-- The role must NOT receive UPDATE/DELETE on members or conversations.
-- Explicit grants require a separately audited login role, intentionally not created here.
COMMIT;
