-- Rollback only before any media rows are attached. Keeps stored objects untouched.
BEGIN;
DROP TRIGGER IF EXISTS chats_message_content ON luemi_chats.messages;
DROP FUNCTION IF EXISTS luemi_chats.require_message_content();
DROP POLICY IF EXISTS chats_media_attach ON luemi_chats.media;
DROP INDEX IF EXISTS luemi_chats.chats_media_message;
DROP INDEX IF EXISTS luemi_chats.chats_media_idempotency;
ALTER TABLE luemi_chats.media DROP CONSTRAINT IF EXISTS chats_media_state;
ALTER TABLE luemi_chats.media DROP CONSTRAINT IF EXISTS chats_media_sha256;
ALTER TABLE luemi_chats.media DROP COLUMN IF EXISTS state;
ALTER TABLE luemi_chats.media DROP COLUMN IF EXISTS content_sha256;
ALTER TABLE luemi_chats.media DROP COLUMN IF EXISTS message_id;
ALTER TABLE luemi_chats.media DROP COLUMN IF EXISTS client_id;
COMMIT;
