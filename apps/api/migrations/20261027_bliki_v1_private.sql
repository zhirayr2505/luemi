-- BLIKI V1: migration only. Do not apply to production until security review.
-- All objects are private; no direct anonymous/public client grants.
BEGIN;
CREATE SCHEMA IF NOT EXISTS luemi_bliki_private;
REVOKE ALL ON SCHEMA luemi_bliki_private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS luemi_bliki_private.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL,
  author_id uuid NOT NULL,
  operation_id uuid NOT NULL,
  media_kind text NOT NULL CHECK (media_kind IN ('image','video')),
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp','video/mp4')),
  media_key text NOT NULL UNIQUE,
  media_bytes bigint NOT NULL CHECK (media_bytes > 0 AND media_bytes <= 104857600),
  media_duration_ms integer CHECK (media_duration_ms IS NULL OR media_duration_ms BETWEEN 1 AND 15000),
  editor jsonb NOT NULL DEFAULT '{}'::jsonb,
  caption text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 150),
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading','processing','published','rejected','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  expires_at timestamptz GENERATED ALWAYS AS (published_at + interval '24 hours') STORED,
  deleted_at timestamptz,
  CONSTRAINT bliki_publication_time CHECK (
    (status = 'published' AND published_at IS NOT NULL) OR status <> 'published'
  ),
  UNIQUE(environment,author_id,operation_id)
);
CREATE INDEX IF NOT EXISTS bliki_active_feed_idx
  ON luemi_bliki_private.stories (environment,published_at DESC)
  WHERE status='published' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS bliki_owner_idx
  ON luemi_bliki_private.stories (environment,author_id,created_at DESC);

CREATE TABLE IF NOT EXISTS luemi_bliki_private.views (
  story_id uuid NOT NULL REFERENCES luemi_bliki_private.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id,viewer_id)
);
CREATE TABLE IF NOT EXISTS luemi_bliki_private.reactions (
  story_id uuid NOT NULL REFERENCES luemi_bliki_private.stories(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id,actor_id)
);
CREATE TABLE IF NOT EXISTS luemi_bliki_private.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES luemi_bliki_private.stories(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('spam','harassment','nudity','other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(story_id,reporter_id)
);
ALTER TABLE luemi_bliki_private.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_bliki_private.stories FORCE ROW LEVEL SECURITY;
ALTER TABLE luemi_bliki_private.views ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_bliki_private.views FORCE ROW LEVEL SECURITY;
ALTER TABLE luemi_bliki_private.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_bliki_private.reactions FORCE ROW LEVEL SECURITY;
ALTER TABLE luemi_bliki_private.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_bliki_private.reports FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA luemi_bliki_private FROM PUBLIC, anon, authenticated;
-- Deliberately no policies/grants yet: deny-by-default until dedicated
-- DB principals and actor-scoped policies are provisioned and audited.
COMMIT;
