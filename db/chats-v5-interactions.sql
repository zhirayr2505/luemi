BEGIN;

ALTER TABLE luemi_chats.messages ADD COLUMN reply_to_id uuid
 REFERENCES luemi_chats.messages(id) ON DELETE SET NULL;

CREATE TABLE luemi_chats.message_marks (
 message_id uuid NOT NULL REFERENCES luemi_chats.messages(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL,
 read_at timestamptz,
 emoji text CHECK (emoji IN ('❤️','👍','🔥','🥰','😂','😮','😢','✨')),
 PRIMARY KEY (message_id, actor_id)
);
CREATE TABLE luemi_chats.presence (
 environment text NOT NULL,
 actor_id uuid NOT NULL,
 last_seen_at timestamptz NOT NULL,
 PRIMARY KEY (environment, actor_id)
);
ALTER TABLE luemi_chats.message_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.message_marks FORCE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_chats.presence FORCE ROW LEVEL SECURITY;

CREATE FUNCTION luemi_chats.visible_interaction_message(message uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT EXISTS (
  SELECT 1 FROM luemi_chats.messages m WHERE m.id=message AND m.deleted_at IS NULL
   AND luemi_chats.live_match(m.conversation_id,
    nullif(current_setting('luemi.actor_id',true),'')::uuid,m.environment)
   AND NOT EXISTS (
    SELECT 1 FROM luemi_chats.message_visibility h WHERE h.message_id=m.id
     AND h.environment=m.environment AND (h.scope='everyone'
      OR h.actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid))
   AND NOT EXISTS (
    SELECT 1 FROM luemi_chats.conversation_clear_events h WHERE h.conversation_id=m.conversation_id
     AND h.environment=m.environment AND h.created_at>=m.created_at AND (h.scope='everyone'
      OR h.actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid)))
 $$;
REVOKE ALL ON FUNCTION luemi_chats.visible_interaction_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION luemi_chats.visible_interaction_message(uuid) TO luemi_chats_writer;

CREATE POLICY mark_read ON luemi_chats.message_marks FOR SELECT TO luemi_chats_writer
 USING (luemi_chats.visible_interaction_message(message_id));
CREATE POLICY mark_insert ON luemi_chats.message_marks FOR INSERT TO luemi_chats_writer
 WITH CHECK (actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND luemi_chats.visible_interaction_message(message_id));
CREATE POLICY mark_update ON luemi_chats.message_marks FOR UPDATE TO luemi_chats_writer
 USING (actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND luemi_chats.visible_interaction_message(message_id))
 WITH CHECK (actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND luemi_chats.visible_interaction_message(message_id));

CREATE POLICY presence_read ON luemi_chats.presence FOR SELECT TO luemi_chats_writer
 USING (environment=current_setting('luemi.environment',true) AND (
  actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid OR EXISTS (
   SELECT 1 FROM luemi_chats.conversations c
    JOIN luemi_chats.matches pair ON pair.id=c.private_match_id AND pair.environment=c.environment
    WHERE c.environment=presence.environment AND presence.actor_id IN (pair.actor_low,pair.actor_high)
     AND luemi_chats.live_match(c.id,nullif(current_setting('luemi.actor_id',true),'')::uuid,c.environment))));
CREATE POLICY presence_insert ON luemi_chats.presence FOR INSERT TO luemi_chats_writer
 WITH CHECK (environment=current_setting('luemi.environment',true)
 AND actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid);
CREATE POLICY presence_update ON luemi_chats.presence FOR UPDATE TO luemi_chats_writer
 USING (environment=current_setting('luemi.environment',true)
 AND actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid)
 WITH CHECK (environment=current_setting('luemi.environment',true)
 AND actor_id=nullif(current_setting('luemi.actor_id',true),'')::uuid);

GRANT SELECT ON luemi_chats.message_marks, luemi_chats.presence TO luemi_chats_writer;
GRANT INSERT (message_id,actor_id,read_at,emoji), UPDATE (read_at,emoji)
 ON luemi_chats.message_marks TO luemi_chats_writer;
GRANT INSERT (environment,actor_id,last_seen_at), UPDATE (last_seen_at)
 ON luemi_chats.presence TO luemi_chats_writer;

COMMIT;
