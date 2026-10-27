-- LUEMI chat message integrity: migration applied after chats-v1-isolated.sql.
-- Enforce invariants even if a database grant is accidentally broadened.
BEGIN;
CREATE OR REPLACE FUNCTION luemi_chats.enforce_message_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,luemi_chats AS $$
BEGIN
 IF (OLD.id,OLD.conversation_id,OLD.sender_id,OLD.environment,OLD.client_id,OLD.created_at)
 IS DISTINCT FROM
 (NEW.id,NEW.conversation_id,NEW.sender_id,NEW.environment,NEW.client_id,NEW.created_at)
 THEN RAISE EXCEPTION 'immutable chat message fields cannot change' USING ERRCODE='23514';
 END IF;
 IF OLD.deleted_at IS NOT NULL THEN
  RAISE EXCEPTION 'deleted chat messages cannot be modified' USING ERRCODE='23514';
 END IF;
 IF NEW.deleted_at IS NOT NULL THEN
  IF NEW.body<>'' OR NEW.edited_at IS DISTINCT FROM OLD.edited_at THEN
   RAISE EXCEPTION 'soft deletion must only clear message body' USING ERRCODE='23514';
  END IF;
 ELSIF NEW.body IS DISTINCT FROM OLD.body THEN
  IF NEW.edited_at IS NULL OR NEW.edited_at IS NOT DISTINCT FROM OLD.edited_at THEN
   RAISE EXCEPTION 'message edit must update edited_at' USING ERRCODE='23514';
  END IF;
 ELSIF NEW.edited_at IS DISTINCT FROM OLD.edited_at THEN
  RAISE EXCEPTION 'edited_at cannot change without editing body' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION luemi_chats.enforce_message_integrity() FROM PUBLIC;
DROP TRIGGER IF EXISTS chat_message_integrity ON luemi_chats.messages;
CREATE TRIGGER chat_message_integrity BEFORE UPDATE ON luemi_chats.messages
FOR EACH ROW EXECUTE FUNCTION luemi_chats.enforce_message_integrity();
COMMIT;
