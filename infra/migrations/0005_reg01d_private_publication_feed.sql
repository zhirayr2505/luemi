-- REG-01D: apply only after 0002/0003/0004 in disposable PostgreSQL.
-- NEVER run against existing LUEMI or Veyra without independent approval.
-- Explicit least-privilege publication and discovery roles; no PUBLIC/anon grants.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='luemi_profile_publisher') THEN
  CREATE ROLE luemi_profile_publisher NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='luemi_discovery_reader') THEN
  CREATE ROLE luemi_discovery_reader NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
 END IF;
END $$;
REVOKE ALL ON SCHEMA luemi_private FROM PUBLIC;
GRANT USAGE ON SCHEMA luemi_private TO luemi_profile_publisher,luemi_discovery_reader;
ALTER TABLE luemi_private.public_profiles
 DROP CONSTRAINT public_profiles_publication_status_check;
ALTER TABLE luemi_private.public_profiles DROP CONSTRAINT public_profiles_published_revision_check;
ALTER TABLE luemi_private.public_profiles ADD CONSTRAINT public_profiles_published_revision_check CHECK(published_revision>=0);
ALTER TABLE luemi_private.public_profiles
 ADD CONSTRAINT public_profiles_publication_status_check
 CHECK(publication_status IN ('draft','published','hidden'));
ALTER TABLE luemi_private.public_profiles
 ADD COLUMN IF NOT EXISTS gender text,
 ADD COLUMN IF NOT EXISTS goal text,
 ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS birth_date date,
 ADD COLUMN IF NOT EXISTS published_at timestamptz,
 ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT clock_timestamp();
ALTER TABLE luemi_private.public_profiles
 ADD CONSTRAINT publication_fields_required CHECK (
 publication_status <> 'published' OR
 (display_name IS NOT NULL AND birth_date IS NOT NULL AND gender IN ('man','woman','other')
 AND goal IS NOT NULL AND city_label IS NOT NULL AND country_code IS NOT NULL
 AND published_revision > 0 AND published_at IS NOT NULL));
ALTER TABLE luemi_private.media_assets
 DROP CONSTRAINT media_assets_publication_status_check;
ALTER TABLE luemi_private.media_assets
 ADD CONSTRAINT media_assets_publication_status_check CHECK(publication_status IN ('private','published'));

-- Scope RLS policies to the verified actor or verified viewer. No direct Data API permissions.
CREATE POLICY d_publisher_read ON luemi_private.private_profile_drafts
 FOR SELECT TO luemi_profile_publisher
 USING(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
   AND environment=current_setting('luemi.environment',true));
CREATE POLICY p_publisher ON luemi_private.public_profiles
 FOR ALL TO luemi_profile_publisher
 USING(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
   AND environment=current_setting('luemi.environment',true))
 WITH CHECK(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
   AND environment=current_setting('luemi.environment',true));
CREATE POLICY m_publisher ON luemi_private.media_assets
 FOR ALL TO luemi_profile_publisher
 USING(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
   AND environment=current_setting('luemi.environment',true))
 WITH CHECK(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
   AND environment=current_setting('luemi.environment',true));

CREATE POLICY a_discover ON luemi_private.actors
 FOR SELECT TO luemi_discovery_reader
 USING(environment=current_setting('luemi.environment',true) AND status='active');
CREATE POLICY a_publisher ON luemi_private.actors
 FOR SELECT TO luemi_profile_publisher
 USING(environment=current_setting('luemi.environment',true)
 AND id=nullif(current_setting('luemi.actor_id',true),'')::uuid);
CREATE POLICY b_discover ON luemi_private.blocks
 FOR SELECT TO luemi_discovery_reader
 USING(environment=current_setting('luemi.environment',true) AND
 (blocker_id=nullif(current_setting('luemi.viewer_id',true),'')::uuid OR
  blocked_id=nullif(current_setting('luemi.viewer_id',true),'')::uuid));
CREATE POLICY p_discover ON luemi_private.public_profiles
 FOR SELECT TO luemi_discovery_reader
 USING(publication_status='published'
 AND environment=current_setting('luemi.environment',true)
 AND owner_id<>nullif(current_setting('luemi.viewer_id',true),'')::uuid
 AND EXISTS(SELECT 1 FROM luemi_private.actors a WHERE a.id=owner_id
   AND a.environment=luemi_private.public_profiles.environment AND a.status='active')
 AND NOT EXISTS(SELECT 1 FROM luemi_private.blocks b WHERE b.environment=environment
  AND ((b.blocker_id=owner_id AND b.blocked_id=nullif(current_setting('luemi.viewer_id',true),'')::uuid)
  OR (b.blocked_id=owner_id AND b.blocker_id=nullif(current_setting('luemi.viewer_id',true),'')::uuid))));
CREATE POLICY m_discover ON luemi_private.media_assets
 FOR SELECT TO luemi_discovery_reader
 USING(environment=current_setting('luemi.environment',true)
 AND state='approved' AND publication_status='published'
 AND EXISTS(SELECT 1 FROM luemi_private.public_profiles p
  WHERE p.owner_id=luemi_private.media_assets.owner_id AND p.environment=luemi_private.media_assets.environment AND p.publication_status='published'));

-- No access to sessions, audit, private drafts (reader) or publication writes (reader).
GRANT SELECT(id,environment,status) ON luemi_private.actors TO luemi_profile_publisher;
GRANT SELECT(owner_id,environment,revision,payload,birth_date,consent_version)
 ON luemi_private.private_profile_drafts TO luemi_profile_publisher;
GRANT SELECT(id,owner_id,environment,state,publication_status,generation,derivative_key,position)
 ON luemi_private.media_assets TO luemi_profile_publisher;
GRANT UPDATE(publication_status) ON luemi_private.media_assets TO luemi_profile_publisher;
GRANT SELECT(owner_id,environment,publication_status,published_revision,display_name,city_label,country_code,
 about,interests,gender,goal,languages,birth_date,published_at,updated_at)
 ON luemi_private.public_profiles TO luemi_profile_publisher;
GRANT INSERT(owner_id,environment,publication_status,published_revision,display_name,city_label,country_code,
 about,interests,gender,goal,languages,birth_date,published_at,updated_at)
 ON luemi_private.public_profiles TO luemi_profile_publisher;
GRANT UPDATE(publication_status,published_revision,display_name,city_label,country_code,
 about,interests,gender,goal,languages,birth_date,published_at,updated_at)
 ON luemi_private.public_profiles TO luemi_profile_publisher;

GRANT SELECT(id,environment,status) ON luemi_private.actors TO luemi_discovery_reader;
GRANT SELECT(blocker_id,blocked_id,environment) ON luemi_private.blocks TO luemi_discovery_reader;
GRANT SELECT(owner_id,environment,publication_status,display_name,city_label,country_code,
 about,interests,gender,goal,languages,birth_date,published_at,updated_at)
 ON luemi_private.public_profiles TO luemi_discovery_reader;
GRANT SELECT(id,owner_id,environment,derivative_key,state,publication_status,position,generation)
 ON luemi_private.media_assets TO luemi_discovery_reader;
REVOKE ALL ON ALL TABLES IN SCHEMA luemi_private FROM PUBLIC;
-- Existing FORCE RLS remains in effect. No security-definer functions, no public bucket.
