-- LUEMI / V2 chat peer media: least-privilege reader isolation.
-- Applies after db/chats-v2-mutual-matches.sql (safe for populated private chats).
-- A chat DB principal must not enumerate every published person's approved media.
BEGIN;
-- Display names are private too; existing blocks/suspensions revoke their
-- direct SELECT projection even if the chat table is bypassed by a SQL query.
DROP POLICY IF EXISTS chat_peer_profile_read ON luemi_private.public_profiles;
CREATE POLICY chat_peer_profile_read ON luemi_private.public_profiles FOR SELECT
 TO luemi_chats_writer USING (
 environment=current_setting('luemi.environment',true)
 AND publication_status='published'
 AND (
  (owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
   AND EXISTS (SELECT 1 FROM luemi_private.actors a
    WHERE a.id=owner_id AND a.environment=environment AND a.status='active'))
  OR EXISTS (
   SELECT 1 FROM luemi_chats.matches mt
   JOIN luemi_private.actors peer
    ON peer.id=luemi_private.public_profiles.owner_id AND peer.environment=mt.environment AND peer.status='active'
   JOIN luemi_private.actors viewer
    ON viewer.id=nullif(current_setting('luemi.actor_id',true),'')::uuid
    AND viewer.environment=mt.environment AND viewer.status='active'
   WHERE mt.environment=luemi_private.public_profiles.environment AND mt.status='active'
    AND ((mt.actor_low=luemi_private.public_profiles.owner_id AND mt.actor_high=viewer.id)
     OR (mt.actor_high=luemi_private.public_profiles.owner_id AND mt.actor_low=viewer.id))
    AND NOT EXISTS (SELECT 1 FROM luemi_private.blocks bl
      WHERE bl.environment=mt.environment AND (
       (bl.blocker_id=mt.actor_low AND bl.blocked_id=mt.actor_high)
       OR (bl.blocker_id=mt.actor_high AND bl.blocked_id=mt.actor_low)))
  )
 )
);
DROP POLICY IF EXISTS chat_peer_media_read ON luemi_private.media_assets;
CREATE POLICY chat_peer_media_read ON luemi_private.media_assets FOR SELECT
 TO luemi_chats_writer USING (
 environment=current_setting('luemi.environment',true)
 AND state='approved' AND publication_status='published'
 AND EXISTS (
  SELECT 1 FROM luemi_chats.matches mt
  JOIN luemi_private.actors peer ON peer.id=luemi_private.media_assets.owner_id
   AND peer.environment=mt.environment AND peer.status='active'
  JOIN luemi_private.public_profiles pp
   ON pp.owner_id=peer.id AND pp.environment=mt.environment
    AND pp.publication_status='published'
  WHERE mt.environment=luemi_private.media_assets.environment AND mt.status='active'
   AND ((mt.actor_low=luemi_private.media_assets.owner_id
         AND mt.actor_high=nullif(current_setting('luemi.actor_id',true),'')::uuid)
    OR (mt.actor_high=luemi_private.media_assets.owner_id
         AND mt.actor_low=nullif(current_setting('luemi.actor_id',true),'')::uuid))
   AND NOT EXISTS (
    SELECT 1 FROM luemi_private.blocks bl
    WHERE bl.environment=mt.environment AND (
      (bl.blocker_id=mt.actor_low AND bl.blocked_id=mt.actor_high)
      OR (bl.blocker_id=mt.actor_high AND bl.blocked_id=mt.actor_low)
    )
   )
 )
);
COMMIT;
