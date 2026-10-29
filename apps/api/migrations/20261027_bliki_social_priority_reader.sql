-- Bliki may read real social priority only for the authenticated viewer.
-- RLS does not grant membership, credentials or an API bypass.
BEGIN;
GRANT USAGE ON SCHEMA luemi_chats TO luemi_bliki_reader;
GRANT SELECT (environment, sender_id, receiver_id) ON luemi_chats.likes TO luemi_bliki_reader;
GRANT SELECT (environment, actor_low, actor_high, status) ON luemi_chats.matches TO luemi_bliki_reader;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_chats' AND tablename='likes'
   AND policyname='bliki_liked_viewer_read') THEN
   CREATE POLICY bliki_liked_viewer_read ON luemi_chats.likes FOR SELECT TO luemi_bliki_reader
     USING (environment=nullif(current_setting('luemi.environment',true),'')
      AND receiver_id::text=nullif(current_setting('luemi.actor_id',true),''));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_chats' AND tablename='matches'
   AND policyname='bliki_mutual_matches_read') THEN
   CREATE POLICY bliki_mutual_matches_read ON luemi_chats.matches FOR SELECT TO luemi_bliki_reader
     USING (environment=nullif(current_setting('luemi.environment',true),'')
       AND status='active'
       AND (actor_low::text=nullif(current_setting('luemi.actor_id',true),'')
          OR actor_high::text=nullif(current_setting('luemi.actor_id',true),'')));
 END IF;
END $$;
COMMIT;
