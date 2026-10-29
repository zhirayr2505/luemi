-- LUEMI Bliki V1: durable bounded media processing and least-privilege writer.
-- Safe with all feature flags OFF. No LOGIN role, public grant or scheduler.
BEGIN;

ALTER TABLE luemi_bliki_private.stories
  ADD COLUMN IF NOT EXISTS content_sha256 text,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='bliki_content_sha256_format'
      AND conrelid='luemi_bliki_private.stories'::regclass
  ) THEN
    ALTER TABLE luemi_bliki_private.stories
      ADD CONSTRAINT bliki_content_sha256_format
      CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[a-f0-9]{64}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='bliki_processing_error_length'
      AND conrelid='luemi_bliki_private.stories'::regclass
  ) THEN
    ALTER TABLE luemi_bliki_private.stories
      ADD CONSTRAINT bliki_processing_error_length
      CHECK (processing_error IS NULL OR char_length(processing_error) BETWEEN 1 AND 64);
  END IF;
END $$;

-- The application writer can no longer update identity, object keys,
-- operation IDs, ownership, environment or creation timestamps.
REVOKE ALL ON luemi_bliki_private.stories FROM luemi_bliki_request;
GRANT SELECT (
  id,environment,author_id,operation_id,media_kind,mime_type,media_key,
  media_bytes,media_duration_ms,editor,caption,status,created_at,published_at,
  deleted_at,content_sha256,processing_started_at,processing_error
) ON luemi_bliki_private.stories TO luemi_bliki_request;
GRANT INSERT (
  id,environment,author_id,operation_id,media_kind,mime_type,media_key,
  media_bytes,status
) ON luemi_bliki_private.stories TO luemi_bliki_request;
GRANT UPDATE (
  media_bytes,mime_type,media_duration_ms,editor,caption,status,published_at,
  deleted_at,content_sha256,processing_started_at,processing_error
) ON luemi_bliki_private.stories TO luemi_bliki_request;

-- Read/media roles only receive the new integrity fields they actually use.
GRANT SELECT (content_sha256) ON luemi_bliki_private.stories TO luemi_bliki_media_reader;

ALTER TABLE luemi_bliki_private.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_bliki_private.stories FORCE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA luemi_bliki_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA luemi_bliki_private FROM PUBLIC,anon,authenticated;

CREATE INDEX IF NOT EXISTS bliki_processing_recovery_idx
  ON luemi_bliki_private.stories(environment,processing_started_at)
  WHERE status='processing';

COMMIT;
