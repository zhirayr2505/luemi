-- LUEMI social reactions V1: special likes and a reaction to one published photo.
-- Apply AFTER db/chats-v2-mutual-matches.sql. Safe for existing likes: they become
-- ordinary likes and keep their original creation time.
BEGIN;

ALTER TABLE luemi_chats.likes
 ADD COLUMN kind text NOT NULL DEFAULT 'like'
  CHECK(kind IN ('like','super_like','photo_fire')),
 ADD COLUMN media_asset_id uuid REFERENCES luemi_private.media_assets(id) ON DELETE CASCADE;

ALTER TABLE luemi_chats.likes
 ADD CONSTRAINT chat_reaction_photo_shape CHECK(
  (kind='photo_fire' AND media_asset_id IS NOT NULL)
  OR (kind IN ('like','super_like') AND media_asset_id IS NULL)
 );

CREATE INDEX chat_likes_receiver_created_idx
 ON luemi_chats.likes(environment,receiver_id,created_at DESC,sender_id);
CREATE INDEX chat_likes_photo_idx
 ON luemi_chats.likes(environment,media_asset_id)
 WHERE media_asset_id IS NOT NULL;

GRANT SELECT(id,owner_id,environment,state,publication_status,position)
 ON luemi_private.media_assets TO luemi_match_writer;

-- The matching principal may inspect only published, approved media that could
-- already be shown in discovery. Private, pending and rejected media stay hidden.
CREATE POLICY match_reaction_media_read
 ON luemi_private.media_assets FOR SELECT TO luemi_match_writer
 USING(environment=current_setting('luemi.environment',true)
  AND state='approved' AND publication_status='published'
  AND EXISTS(SELECT 1 FROM luemi_private.public_profiles p
   WHERE p.owner_id=luemi_private.media_assets.owner_id
    AND p.environment=luemi_private.media_assets.environment
    AND p.publication_status='published'));

DROP POLICY match_likes_insert ON luemi_chats.likes;
CREATE POLICY match_likes_insert ON luemi_chats.likes FOR INSERT TO luemi_match_writer
 WITH CHECK(environment=current_setting('luemi.environment',true)
 AND sender_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM luemi_private.public_profiles p WHERE p.owner_id=sender_id
  AND p.environment=luemi_chats.likes.environment AND p.publication_status='published')
 AND EXISTS(SELECT 1 FROM luemi_private.public_profiles p WHERE p.owner_id=receiver_id
  AND p.environment=luemi_chats.likes.environment AND p.publication_status='published')
 AND NOT EXISTS(SELECT 1 FROM luemi_private.blocks b WHERE b.environment=luemi_chats.likes.environment
  AND ((b.blocker_id=sender_id AND b.blocked_id=receiver_id)
   OR (b.blocker_id=receiver_id AND b.blocked_id=sender_id)))
 AND ((kind IN ('like','super_like') AND media_asset_id IS NULL)
  OR (kind='photo_fire' AND EXISTS(SELECT 1 FROM luemi_private.media_assets m
   WHERE m.id=media_asset_id AND m.owner_id=receiver_id
    AND m.environment=luemi_chats.likes.environment
    AND m.state='approved' AND m.publication_status='published'))));

COMMIT;
