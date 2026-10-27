-- Bliki interaction principal: actor-scoped idempotent views/reactions/reports.
-- No LOGIN credentials, no media keys, and no direct PostgREST access.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='luemi_bliki_interaction') THEN
   CREATE ROLE luemi_bliki_interaction NOLOGIN NOINHERIT NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA luemi_bliki_private,luemi_private TO luemi_bliki_interaction;
GRANT SELECT (id,environment,author_id,status,published_at,deleted_at)
 ON luemi_bliki_private.stories TO luemi_bliki_interaction;
GRANT SELECT (owner_id,environment,publication_status)
 ON luemi_private.public_profiles TO luemi_bliki_interaction;
GRANT SELECT (blocker_id,blocked_id,environment)
 ON luemi_private.blocks TO luemi_bliki_interaction;
GRANT SELECT,INSERT ON luemi_bliki_private.views TO luemi_bliki_interaction;
GRANT SELECT,INSERT ON luemi_bliki_private.reactions TO luemi_bliki_interaction;
GRANT SELECT,INSERT ON luemi_bliki_private.reports TO luemi_bliki_interaction;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_private'
 AND tablename='blocks' AND policyname='bliki_interaction_block_check') THEN
  CREATE POLICY bliki_interaction_block_check ON luemi_private.blocks FOR SELECT
   TO luemi_bliki_interaction USING (
    environment=nullif(current_setting('luemi.environment',true),'')
    AND (blocker_id::text=nullif(current_setting('luemi.actor_id',true),'')
      OR blocked_id::text=nullif(current_setting('luemi.actor_id',true),''))
   );
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_private'
 AND tablename='public_profiles' AND policyname='bliki_interaction_published_profiles') THEN
  CREATE POLICY bliki_interaction_published_profiles ON luemi_private.public_profiles FOR SELECT
   TO luemi_bliki_interaction USING (
    environment=nullif(current_setting('luemi.environment',true),'')
    AND publication_status='published'
    AND (owner_id::text=nullif(current_setting('luemi.actor_id',true),'')
     OR NOT EXISTS (
      SELECT 1 FROM luemi_private.blocks b
       WHERE b.environment=public_profiles.environment
        AND ((b.blocker_id=public_profiles.owner_id AND
          b.blocked_id::text=nullif(current_setting('luemi.actor_id',true),''))
         OR (b.blocked_id=public_profiles.owner_id AND
          b.blocker_id::text=nullif(current_setting('luemi.actor_id',true),'')))
     ))
   );
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_bliki_private'
 AND tablename='stories' AND policyname='bliki_interaction_active_story') THEN
  CREATE POLICY bliki_interaction_active_story ON luemi_bliki_private.stories
   FOR SELECT TO luemi_bliki_interaction USING (
    environment=nullif(current_setting('luemi.environment',true),'')
    AND status='published' AND deleted_at IS NULL AND published_at<=now()
    AND published_at>now()-interval '24 hours'
    AND EXISTS (SELECT 1 FROM luemi_private.public_profiles v
      WHERE v.owner_id::text=nullif(current_setting('luemi.actor_id',true),'')
        AND v.environment=stories.environment AND v.publication_status='published')
    AND EXISTS (SELECT 1 FROM luemi_private.public_profiles a
      WHERE a.owner_id=stories.author_id AND a.environment=stories.environment
        AND a.publication_status='published')
   );
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_bliki_private'
 AND tablename='views' AND policyname='bliki_viewer_read') THEN
  CREATE POLICY bliki_viewer_read ON luemi_bliki_private.views FOR SELECT
   TO luemi_bliki_interaction USING (
     viewer_id::text=nullif(current_setting('luemi.actor_id',true),''));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_bliki_private'
 AND tablename='views' AND policyname='bliki_viewer_insert') THEN
  CREATE POLICY bliki_viewer_insert ON luemi_bliki_private.views FOR INSERT
   TO luemi_bliki_interaction WITH CHECK (
     viewer_id::text=nullif(current_setting('luemi.actor_id',true),'')
     AND EXISTS (SELECT 1 FROM luemi_bliki_private.stories s WHERE s.id=views.story_id));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_bliki_private'
 AND tablename='reactions' AND policyname='bliki_reactor_read') THEN
  CREATE POLICY bliki_reactor_read ON luemi_bliki_private.reactions FOR SELECT
   TO luemi_bliki_interaction USING (actor_id::text=nullif(current_setting('luemi.actor_id',true),''));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_bliki_private'
 AND tablename='reactions' AND policyname='bliki_reactor_insert') THEN
  CREATE POLICY bliki_reactor_insert ON luemi_bliki_private.reactions FOR INSERT
   TO luemi_bliki_interaction WITH CHECK (
     actor_id::text=nullif(current_setting('luemi.actor_id',true),'')
     AND EXISTS (SELECT 1 FROM luemi_bliki_private.stories s
       WHERE s.id=reactions.story_id AND s.author_id<>reactions.actor_id));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_bliki_private'
 AND tablename='reports' AND policyname='bliki_reporter_read') THEN
  CREATE POLICY bliki_reporter_read ON luemi_bliki_private.reports FOR SELECT
   TO luemi_bliki_interaction USING (reporter_id::text=nullif(current_setting('luemi.actor_id',true),''));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_bliki_private'
 AND tablename='reports' AND policyname='bliki_reporter_insert') THEN
  CREATE POLICY bliki_reporter_insert ON luemi_bliki_private.reports FOR INSERT
   TO luemi_bliki_interaction WITH CHECK (
     reporter_id::text=nullif(current_setting('luemi.actor_id',true),'')
     AND EXISTS (SELECT 1 FROM luemi_bliki_private.stories s
       WHERE s.id=reports.story_id AND s.author_id<>reports.reporter_id));
 END IF;
END $$;
-- Keep exactly one reaction per story per actor; preference changes need a separate UX decision.
ALTER TABLE luemi_bliki_private.reactions
 ADD COLUMN IF NOT EXISTS reaction_kind text NOT NULL DEFAULT 'heart'
 CHECK (reaction_kind IN ('heart','fire','smile'));
REVOKE ALL ON ALL TABLES IN SCHEMA luemi_bliki_private FROM PUBLIC,anon,authenticated;
COMMIT;
