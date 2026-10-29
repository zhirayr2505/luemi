-- LUEMI Chats V3 — private, user-scoped presentation visibility.
-- IMPORTANT: this is display-level removal, NOT irreversible data erasure.
-- Do not treat this migration as consent to indefinite secret content retention.
BEGIN;
CREATE TABLE IF NOT EXISTS luemi_chats.message_visibility (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 message_id uuid NOT NULL REFERENCES luemi_chats.messages(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL REFERENCES luemi_chats.conversations(id) ON DELETE CASCADE,
 environment text NOT NULL,
 actor_id uuid NOT NULL,
 scope text NOT NULL CHECK (scope IN ('me','everyone')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(message_id,actor_id,scope)
);
CREATE INDEX IF NOT EXISTS luemi_message_visibility_lookup
 ON luemi_chats.message_visibility (message_id,scope,actor_id);
CREATE TABLE IF NOT EXISTS luemi_chats.conversation_clear_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES luemi_chats.conversations(id) ON DELETE CASCADE,
 environment text NOT NULL,
 actor_id uuid NOT NULL,
 scope text NOT NULL CHECK (scope IN ('me','everyone')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS luemi_conversation_clear_lookup
 ON luemi_chats.conversation_clear_events (conversation_id,created_at DESC);
ALTER TABLE luemi_chats.message_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.message_visibility FORCE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.conversation_clear_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.conversation_clear_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON luemi_chats.message_visibility,luemi_chats.conversation_clear_events
 FROM PUBLIC,anon,authenticated;
-- The server's existing isolated chat principal can only append visibility events.
GRANT SELECT,INSERT ON luemi_chats.message_visibility,luemi_chats.conversation_clear_events
 TO luemi_chats_writer;
CREATE POLICY visibility_insert_scoped ON luemi_chats.message_visibility
 FOR INSERT TO luemi_chats_writer WITH CHECK (
   actor_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
   AND environment=current_setting('luemi.environment',true)
   AND EXISTS (
    SELECT 1 FROM luemi_chats.messages msg
    JOIN luemi_chats.members mb ON mb.conversation_id=msg.conversation_id
       AND mb.environment=msg.environment
    WHERE msg.id=message_id AND msg.conversation_id=message_visibility.conversation_id
      AND msg.environment=message_visibility.environment
      AND mb.actor_id=message_visibility.actor_id
   )
 );
CREATE POLICY visibility_read_scoped ON luemi_chats.message_visibility
 FOR SELECT TO luemi_chats_writer USING (
   environment=current_setting('luemi.environment',true)
   AND (scope='everyone' OR actor_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid)
   AND EXISTS (
     SELECT 1 FROM luemi_chats.members mb
     WHERE mb.conversation_id=message_visibility.conversation_id
       AND mb.environment=message_visibility.environment
       AND mb.actor_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
   )
 );
CREATE POLICY clear_insert_scoped ON luemi_chats.conversation_clear_events
 FOR INSERT TO luemi_chats_writer WITH CHECK (
  actor_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true)
  AND EXISTS (
   SELECT 1 FROM luemi_chats.members mb
   WHERE mb.conversation_id=conversation_clear_events.conversation_id
     AND mb.environment=conversation_clear_events.environment
     AND mb.actor_id=conversation_clear_events.actor_id
  )
 );
CREATE POLICY clear_read_scoped ON luemi_chats.conversation_clear_events
 FOR SELECT TO luemi_chats_writer USING (
  environment=current_setting('luemi.environment',true)
  AND (scope='everyone' OR actor_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid)
  AND EXISTS (
   SELECT 1 FROM luemi_chats.members mb
   WHERE mb.conversation_id=conversation_clear_events.conversation_id
     AND mb.environment=conversation_clear_events.environment
     AND mb.actor_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
  )
 );
COMMIT;
