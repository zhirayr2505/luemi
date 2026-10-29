-- LUEMI V3B recipient-owned read-only history, isolated PostgreSQL RLS.
-- Apply AFTER chats-v2-peer-media-guard and BEFORE worker grants.
BEGIN;
ALTER TABLE luemi_private.actors ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;
GRANT SELECT(anonymized_at) ON luemi_private.actors TO luemi_chats_writer;
-- A deleted actor is visible to an existing match ONLY as an anonymous state:
-- no Telegram identifiers, user names, deleted profile photos or location are granted.
CREATE POLICY match_anonymized_peer_read ON luemi_private.actors
 FOR SELECT TO luemi_chats_writer
 USING(environment=current_setting('luemi.environment',true)
 AND status='deleted' AND anonymized_at IS NOT NULL
 AND EXISTS (
  SELECT 1 FROM luemi_chats.matches pair
  WHERE pair.environment=actors.environment AND pair.status='active'
   AND ((pair.actor_low=actors.id AND pair.actor_high=NULLIF(current_setting('luemi.actor_id',true),'')::uuid)
    OR (pair.actor_high=actors.id AND pair.actor_low=NULLIF(current_setting('luemi.actor_id',true),'')::uuid))
 ));
CREATE OR REPLACE FUNCTION luemi_chats.archived_peer_history(p_conversation uuid,p_actor uuid,p_environment text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT EXISTS (
  SELECT 1 FROM luemi_chats.conversations c
  JOIN luemi_chats.matches mt ON mt.id=c.private_match_id AND mt.environment=c.environment AND mt.status='active'
  JOIN luemi_private.actors viewer ON viewer.id=p_actor AND viewer.environment=c.environment AND viewer.status='active'
  JOIN luemi_private.public_profiles profile ON profile.owner_id=viewer.id AND profile.environment=c.environment
    AND profile.publication_status='published'
  JOIN luemi_private.actors peer ON peer.id=(
   CASE WHEN mt.actor_low=p_actor THEN mt.actor_high ELSE mt.actor_low END)
   AND peer.environment=c.environment AND peer.status='deleted' AND peer.anonymized_at IS NOT NULL
  WHERE c.id=p_conversation AND c.environment=p_environment
   AND p_actor=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
   AND p_actor IN (mt.actor_low,mt.actor_high)
   AND NOT EXISTS (SELECT 1 FROM luemi_private.blocks b
     WHERE b.environment=c.environment
       AND ((b.blocker_id=mt.actor_low AND b.blocked_id=mt.actor_high)
        OR (b.blocker_id=mt.actor_high AND b.blocked_id=mt.actor_low)))
 ) $$;
REVOKE ALL ON FUNCTION luemi_chats.archived_peer_history(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION luemi_chats.archived_peer_history(uuid,uuid,text) TO luemi_chats_writer;
DROP POLICY chats_members_read ON luemi_chats.members;
CREATE POLICY chats_members_read ON luemi_chats.members FOR SELECT TO luemi_chats_writer
 USING(actor_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true)
 AND (luemi_chats.live_match(conversation_id,actor_id,environment)
   OR luemi_chats.archived_peer_history(conversation_id,actor_id,environment)));
-- IMPORTANT: archive-only membership must NOT permit new messages or editing old messages.
DROP POLICY IF EXISTS chats_messages_insert ON luemi_chats.messages;
CREATE POLICY chats_messages_insert ON luemi_chats.messages FOR INSERT TO luemi_chats_writer
 WITH CHECK(sender_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true)
 AND luemi_chats.live_match(conversation_id,sender_id,environment));
DROP POLICY IF EXISTS chats_messages_update ON luemi_chats.messages;
CREATE POLICY chats_messages_update ON luemi_chats.messages FOR UPDATE TO luemi_chats_writer
 USING(sender_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true)
 AND luemi_chats.live_match(conversation_id,sender_id,environment))
 WITH CHECK(sender_id=NULLIF(current_setting('luemi.actor_id',true),'')::uuid
 AND environment=current_setting('luemi.environment',true)
 AND luemi_chats.live_match(conversation_id,sender_id,environment));
DROP POLICY IF EXISTS chats_media_read ON luemi_chats.media;
CREATE POLICY chats_media_read ON luemi_chats.media FOR SELECT TO luemi_chats_writer
 USING(environment=current_setting('luemi.environment',true)
 AND state='ready'
 AND (luemi_chats.live_match(conversation_id,NULLIF(current_setting('luemi.actor_id',true),'')::uuid,environment)
 OR luemi_chats.archived_peer_history(conversation_id,NULLIF(current_setting('luemi.actor_id',true),'')::uuid,environment)));
COMMIT;
