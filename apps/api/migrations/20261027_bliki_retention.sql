-- Bliki V1: isolated, fail-closed private object retention.
-- Installable while feature flags are OFF. NOLOGIN role only; no scheduled job,
-- credentials, PostgREST exposure, Storage deletion or application activation.
BEGIN;
ALTER TABLE luemi_bliki_private.stories
 ADD COLUMN IF NOT EXISTS media_cleaned_at timestamptz,
 ADD COLUMN IF NOT EXISTS cleanup_attempts integer NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS cleanup_attempt_at timestamptz;
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_roles WHERE rolname='luemi_bliki_retention'
 ) THEN CREATE ROLE luemi_bliki_retention NOLOGIN NOINHERIT NOBYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA luemi_bliki_private TO luemi_bliki_retention;
-- Only retention metadata is mutable. NEVER grant updates to media_key, status,
-- timestamps of publication, actor identity or media content.
GRANT SELECT (id,environment,author_id,media_key,status,published_at,created_at,
              deleted_at,media_cleaned_at,cleanup_attempts,cleanup_attempt_at)
 ON luemi_bliki_private.stories TO luemi_bliki_retention;
GRANT UPDATE (media_cleaned_at,cleanup_attempts,cleanup_attempt_at)
 ON luemi_bliki_private.stories TO luemi_bliki_retention;
-- RLS and application predicates are intentionally duplicated. Expired media
-- receives an extra one-hour buffer to avoid boundary/time-of-check races.
-- Abandoned/failed uploads are retained 48h to allow reasonable recovery.
CREATE POLICY bliki_retention_select ON luemi_bliki_private.stories FOR SELECT
 TO luemi_bliki_retention USING (
  environment=nullif(current_setting('luemi.environment',true),'')
  AND media_cleaned_at IS NULL
  AND (
   (status='deleted' AND deleted_at IS NOT NULL)
   OR (status='published' AND published_at < now()-interval '25 hours')
   OR (status IN ('uploading','processing','rejected')
       AND created_at < now()-interval '48 hours')
  )
 );
CREATE POLICY bliki_retention_update ON luemi_bliki_private.stories FOR UPDATE
 TO luemi_bliki_retention USING (
  environment=nullif(current_setting('luemi.environment',true),'')
  AND media_cleaned_at IS NULL
  AND (
   (status='deleted' AND deleted_at IS NOT NULL)
   OR (status='published' AND published_at < now()-interval '25 hours')
   OR (status IN ('uploading','processing','rejected')
       AND created_at < now()-interval '48 hours')
  )
 ) WITH CHECK (
  environment=nullif(current_setting('luemi.environment',true),'')
  AND (
   (status='deleted' AND deleted_at IS NOT NULL)
   OR (status='published' AND published_at < now()-interval '25 hours')
   OR (status IN ('uploading','processing','rejected')
       AND created_at < now()-interval '48 hours')
  )
 );
CREATE INDEX IF NOT EXISTS bliki_retention_scan_idx
 ON luemi_bliki_private.stories (environment,created_at)
 WHERE media_cleaned_at IS NULL;
REVOKE ALL ON SCHEMA luemi_bliki_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA luemi_bliki_private FROM PUBLIC,anon,authenticated;
COMMIT;
