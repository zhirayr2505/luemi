-- LUEMI Chats V1: isolated, fail-closed schema. Run ONLY after security review.
-- Provision the login role separately with NO BYPASSRLS, NO CREATEDB, NO CREATEROLE.
-- A trusted matchmaking service must insert both members after a mutual match;
-- no public/client endpoint may create conversations or membership.
BEGIN;
CREATE SCHEMA IF NOT EXISTS luemi_chats;
CREATE TABLE IF NOT EXISTS luemi_chats.conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 environment text NOT NULL,
 match_id uuid NOT NULL REFERENCES public.luemi_matches(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT chat_environment_len CHECK (length(environment) BETWEEN 1 AND 96),
 UNIQUE(environment,match_id)
);
CREATE TABLE IF NOT EXISTS luemi_chats.members (
 conversation_id uuid NOT NULL REFERENCES luemi_chats.conversations(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL,
 environment text NOT NULL,
 last_read_at timestamptz,
 CONSTRAINT chat_member_environment CHECK (length(environment) BETWEEN 1 AND 96),
 PRIMARY KEY(conversation_id,actor_id)
);
-- Policy must be declared after enabling row security.
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
CREATE POLICY chats_members_update_read ON luemi_chats.members FOR UPDATE USING (
 actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true)
) WITH CHECK (
 actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true)
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
CREATE TABLE IF NOT EXISTS luemi_chats.media (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES luemi_chats.conversations(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL,
 environment text NOT NULL,
 object_path text NOT NULL UNIQUE,
 mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
 byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 10485760),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(conversation_id,object_path)
);
ALTER TABLE luemi_chats.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.media FORCE ROW LEVEL SECURITY;
CREATE POLICY chats_media_read ON luemi_chats.media FOR SELECT USING (
 environment=current_setting('luemi.environment',true)
 AND EXISTS (SELECT 1 FROM luemi_chats.members m
 WHERE m.conversation_id=media.conversation_id
 AND m.actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND m.environment=media.environment)
);
CREATE POLICY chats_media_insert ON luemi_chats.media FOR INSERT WITH CHECK (
 owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true)
 AND EXISTS (SELECT 1 FROM luemi_chats.members m
 WHERE m.conversation_id=media.conversation_id
 AND m.actor_id=media.owner_id AND m.environment=media.environment)
);
-- The role must NOT receive UPDATE/DELETE on members or conversations.
-- Explicit grants require a separately audited login role, intentionally not created here.
COMMIT;
