-- LUEMI Chats V1 completion. Review and apply after chats-v1-isolated.sql,
-- chats-v1-message-integrity.sql and chats-v2-mutual-matches.sql.
-- Never run against production until identity/match prerequisites in INTEGRATION.md pass.
BEGIN;
ALTER TABLE luemi_chats.media ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE luemi_chats.media ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES luemi_chats.messages(id) ON DELETE SET NULL;
ALTER TABLE luemi_chats.media ADD COLUMN IF NOT EXISTS content_sha256 text;
ALTER TABLE luemi_chats.media ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'ready';
ALTER TABLE luemi_chats.media ADD CONSTRAINT chats_media_sha256 CHECK(content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$');
ALTER TABLE luemi_chats.media ADD CONSTRAINT chats_media_state CHECK(state IN ('pending','ready','failed','revoked'));
CREATE UNIQUE INDEX IF NOT EXISTS chats_media_idempotency ON luemi_chats.media(conversation_id,owner_id,client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS chats_media_message ON luemi_chats.media(message_id) WHERE message_id IS NOT NULL;

ALTER TABLE luemi_chats.messages DROP CONSTRAINT chat_message_body_state;
ALTER TABLE luemi_chats.messages ADD CONSTRAINT chat_message_body_state CHECK (
 (deleted_at IS NULL AND length(body) BETWEEN 0 AND 4000) OR
 (deleted_at IS NOT NULL AND body='')
);
CREATE OR REPLACE FUNCTION luemi_chats.require_message_content()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.deleted_at IS NULL AND NEW.body='' AND NOT EXISTS(
  SELECT 1 FROM luemi_chats.media m WHERE m.message_id=NEW.id AND m.state='ready'
 ) THEN RAISE EXCEPTION 'message requires text or ready media' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION luemi_chats.require_message_content() FROM PUBLIC;
DROP TRIGGER IF EXISTS chats_message_content ON luemi_chats.messages;
CREATE CONSTRAINT TRIGGER chats_message_content AFTER INSERT OR UPDATE ON luemi_chats.messages
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION luemi_chats.require_message_content();

DROP POLICY IF EXISTS chats_media_insert ON luemi_chats.media;
CREATE POLICY chats_media_insert ON luemi_chats.media FOR INSERT TO luemi_chats_writer
WITH CHECK(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true)
 AND message_id IS NULL AND state='ready'
 AND luemi_chats.live_match(conversation_id,owner_id,environment));
CREATE POLICY chats_media_attach ON luemi_chats.media FOR UPDATE TO luemi_chats_writer
USING(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true) AND message_id IS NULL
 AND luemi_chats.live_match(conversation_id,owner_id,environment))
WITH CHECK(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true) AND message_id IS NOT NULL
 AND luemi_chats.live_match(conversation_id,owner_id,environment));
DROP POLICY IF EXISTS chats_media_read ON luemi_chats.media;
CREATE POLICY chats_media_read ON luemi_chats.media FOR SELECT TO luemi_chats_writer
USING(environment=current_setting('luemi.environment',true)
 AND state='ready'
 AND luemi_chats.live_match(conversation_id,nullif(current_setting('luemi.actor_id',true),'')::uuid,environment));

GRANT SELECT,INSERT ON luemi_chats.media TO luemi_chats_writer;
GRANT UPDATE(message_id) ON luemi_chats.media TO luemi_chats_writer;
REVOKE DELETE ON luemi_chats.media FROM luemi_chats_writer;
ALTER TABLE luemi_chats.media FORCE ROW LEVEL SECURITY;
COMMIT;
