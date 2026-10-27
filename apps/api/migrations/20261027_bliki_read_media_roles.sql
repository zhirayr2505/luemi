-- BLIKI V1: least-privilege read/media principals. Safe to install with feature OFF.
-- Credentials are provisioned externally; this migration creates NOLOGIN privileges only.
BEGIN;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luemi_bliki_reader') THEN
   CREATE ROLE luemi_bliki_reader NOLOGIN NOINHERIT NOBYPASSRLS;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luemi_bliki_media_reader') THEN
   CREATE ROLE luemi_bliki_media_reader NOLOGIN NOINHERIT NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA luemi_bliki_private TO luemi_bliki_reader, luemi_bliki_media_reader;
GRANT USAGE ON SCHEMA luemi_private TO luemi_bliki_reader, luemi_bliki_media_reader, luemi_bliki_request;
-- Feed reader cannot SELECT media_key, even at the column level.
GRANT SELECT (id,environment,author_id,media_kind,media_duration_ms,
  published_at,caption,editor,status,deleted_at)
 ON luemi_bliki_private.stories TO luemi_bliki_reader;
-- Dedicated read-only media principal may resolve the private key but may not mutate rows.
GRANT SELECT (id,environment,author_id,media_kind,mime_type,media_key,
  media_bytes,published_at,status,deleted_at)
 ON luemi_bliki_private.stories TO luemi_bliki_media_reader;
-- Only data already published to discovery is exposed to read-side DB principals.
GRANT SELECT (owner_id,environment,publication_status,display_name,city_label,gender,published_at)
 ON luemi_private.public_profiles TO luemi_bliki_reader;
GRANT SELECT (owner_id,environment,publication_status)
 ON luemi_private.public_profiles TO luemi_bliki_media_reader, luemi_bliki_request;
GRANT SELECT (blocker_id,blocked_id,environment)
 ON luemi_private.blocks TO luemi_bliki_reader, luemi_bliki_media_reader;
-- Distinct RLS checks never consult user-controlled headers: transaction-local context only.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_private'
    AND tablename='public_profiles' AND policyname='bliki_author_publication') THEN
   CREATE POLICY bliki_author_publication ON luemi_private.public_profiles
    FOR SELECT TO luemi_bliki_request
    USING (owner_id::text = nullif(current_setting('luemi.actor_id',true),'')
       AND environment = nullif(current_setting('luemi.environment',true),'')
       AND publication_status='published');
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_private'
    AND tablename='blocks' AND policyname='bliki_viewer_block_read') THEN
   CREATE POLICY bliki_viewer_block_read ON luemi_private.blocks
    FOR SELECT TO luemi_bliki_reader, luemi_bliki_media_reader
    USING (environment = nullif(current_setting('luemi.environment',true),'')
      AND (blocker_id::text = nullif(current_setting('luemi.actor_id',true),'')
        OR blocked_id::text = nullif(current_setting('luemi.actor_id',true),'')));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_private'
    AND tablename='public_profiles' AND policyname='bliki_viewer_published_profiles') THEN
   CREATE POLICY bliki_viewer_published_profiles ON luemi_private.public_profiles
    FOR SELECT TO luemi_bliki_reader, luemi_bliki_media_reader
    USING (environment = nullif(current_setting('luemi.environment',true),'')
      AND publication_status='published'
      AND (owner_id::text = nullif(current_setting('luemi.actor_id',true),'')
       OR NOT EXISTS (
         SELECT 1 FROM luemi_private.blocks b
         WHERE b.environment = public_profiles.environment
           AND ((b.blocker_id = public_profiles.owner_id AND
                 b.blocked_id::text = nullif(current_setting('luemi.actor_id',true),''))
             OR (b.blocked_id = public_profiles.owner_id AND
                 b.blocker_id::text = nullif(current_setting('luemi.actor_id',true),'')))
       )));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_bliki_private'
    AND tablename='stories' AND policyname='bliki_authorized_story_read') THEN
   CREATE POLICY bliki_authorized_story_read ON luemi_bliki_private.stories
    FOR SELECT TO luemi_bliki_reader, luemi_bliki_media_reader
    USING (environment = nullif(current_setting('luemi.environment',true),'')
      AND status='published' AND deleted_at IS NULL
      AND published_at <= now() AND published_at > now() - interval '24 hours'
      AND EXISTS (
        SELECT 1 FROM luemi_private.public_profiles viewer
        WHERE viewer.owner_id::text = nullif(current_setting('luemi.actor_id',true),'')
         AND viewer.environment=stories.environment AND viewer.publication_status='published'
      )
      AND EXISTS (
        SELECT 1 FROM luemi_private.public_profiles author
        WHERE author.owner_id=stories.author_id
         AND author.environment=stories.environment AND author.publication_status='published'
      ));
 END IF;
END $$;
-- Never grant public API roles any direct access.
REVOKE ALL ON SCHEMA luemi_bliki_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA luemi_bliki_private FROM PUBLIC, anon, authenticated;
COMMIT;
