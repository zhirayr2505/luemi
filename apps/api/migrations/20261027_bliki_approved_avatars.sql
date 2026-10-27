-- Only approved, already published profile media IDs; never grant derivative/original keys.
BEGIN;
GRANT SELECT (id,owner_id,environment,state,publication_status,position)
 ON luemi_private.media_assets TO luemi_bliki_reader;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_private'
 AND tablename='media_assets' AND policyname='bliki_approved_avatar_read') THEN
   CREATE POLICY bliki_approved_avatar_read ON luemi_private.media_assets
     FOR SELECT TO luemi_bliki_reader
     USING (
       environment=nullif(current_setting('luemi.environment',true),'')
       AND state='approved' AND publication_status='published'
       AND EXISTS (
         SELECT 1 FROM luemi_private.public_profiles p
         WHERE p.owner_id=media_assets.owner_id
           AND p.environment=media_assets.environment
           AND p.publication_status='published'
       )
     );
 END IF;
END $$;
COMMIT;
