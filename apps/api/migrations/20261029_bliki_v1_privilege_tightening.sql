-- Follow-up least-privilege correction: integrity hashes are verified only by
-- the owner-scoped publication writer. The media reader needs the object key,
-- MIME and size, not the content hash.
BEGIN;

REVOKE SELECT (content_sha256)
  ON luemi_bliki_private.stories FROM luemi_bliki_media_reader;

ALTER TABLE luemi_bliki_private.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_bliki_private.stories FORCE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA luemi_bliki_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA luemi_bliki_private FROM PUBLIC,anon,authenticated;

COMMIT;
