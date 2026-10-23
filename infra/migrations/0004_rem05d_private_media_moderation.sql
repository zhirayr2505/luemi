-- REM-05D: additive ONLY. Run after 0002/0003 in DISPOSABLE PostgreSQL.
-- Not a Supabase deployment. No publication policy or public Storage bucket.
CREATE SCHEMA IF NOT EXISTS luemi_private;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='luemi_media_worker') THEN
  CREATE ROLE luemi_media_worker NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='luemi_moderator') THEN
  CREATE ROLE luemi_moderator NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
 END IF;
END $$;
-- Same-bot FK isolation is structural, not an application-only check.
CREATE UNIQUE INDEX IF NOT EXISTS luemi_actor_environment_id_unique
 ON luemi_private.actors(environment,id);
CREATE TABLE IF NOT EXISTS luemi_private.private_profile_drafts (
 owner_id uuid PRIMARY KEY,
 environment text NOT NULL,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>=1),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND pg_column_size(payload)<=8192),
 birth_date date,
 consent_version text CHECK(length(consent_version)<=64),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(environment,owner_id) REFERENCES luemi_private.actors(environment,id)
);
CREATE TABLE IF NOT EXISTS luemi_private.public_profiles (
 owner_id uuid PRIMARY KEY,
 environment text NOT NULL,
 publication_status text NOT NULL DEFAULT 'draft' CHECK(publication_status='draft'),
 published_revision bigint NOT NULL DEFAULT 0 CHECK(published_revision=0),
 display_name text,
 city_label text,
 country_code char(2),
 about text,
 interests text[] NOT NULL DEFAULT '{}',
 FOREIGN KEY(environment,owner_id) REFERENCES luemi_private.actors(environment,id)
);
CREATE TABLE IF NOT EXISTS luemi_private.media_assets (
 id uuid PRIMARY KEY,
 owner_id uuid NOT NULL,
 environment text NOT NULL,
 original_key text NOT NULL UNIQUE CHECK(length(original_key) BETWEEN 40 AND 256),
 derivative_key text NOT NULL UNIQUE CHECK(length(derivative_key) BETWEEN 40 AND 256),
 generation integer NOT NULL DEFAULT 1 CHECK(generation>0),
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','pending_review','approved','rejected','failed','revoked')),
 publication_status text NOT NULL DEFAULT 'private' CHECK(publication_status='private'),
 actual_mime text,
 byte_count integer CHECK(byte_count>=0 AND byte_count<=1048576),
 width integer CHECK(width>0 AND width<=2048),
 height integer CHECK(height>0 AND height<=2048),
 content_sha256 text CHECK(length(content_sha256)=64),
 position integer NOT NULL CHECK(position BETWEEN 0 AND 5),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(environment,owner_id) REFERENCES luemi_private.actors(environment,id)
);
CREATE INDEX IF NOT EXISTS luemi_assets_owner_idx
 ON luemi_private.media_assets(environment,owner_id,state);
CREATE TABLE IF NOT EXISTS luemi_private.media_uploads (
 id uuid PRIMARY KEY,
 asset_id uuid NOT NULL UNIQUE REFERENCES luemi_private.media_assets(id),
 owner_id uuid NOT NULL,
 environment text NOT NULL,
 expected_bytes integer NOT NULL CHECK(expected_bytes BETWEEN 1 AND 1048576),
 expected_mime text NOT NULL CHECK(expected_mime='image/png'),
 idempotency_digest text NOT NULL CHECK(length(idempotency_digest)=64),
 request_digest text NOT NULL CHECK(length(request_digest)=64),
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','received','failed')),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(environment,owner_id,idempotency_digest),
 FOREIGN KEY(environment,owner_id) REFERENCES luemi_private.actors(environment,id)
);
CREATE TABLE IF NOT EXISTS luemi_private.moderation_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 asset_id uuid NOT NULL REFERENCES luemi_private.media_assets(id),
 generation integer NOT NULL,
 state text NOT NULL DEFAULT 'pending_review' CHECK(state IN ('pending_review','decided')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(asset_id,generation)
);
CREATE TABLE IF NOT EXISTS luemi_private.moderation_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 job_id uuid NOT NULL REFERENCES luemi_private.moderation_jobs(id),
 moderator_label text NOT NULL CHECK(length(moderator_label) BETWEEN 3 AND 64),
 decision text NOT NULL CHECK(decision IN ('approved','rejected')),
 reason_code text NOT NULL CHECK(reason_code IN ('safe_synthetic','policy_violation')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(job_id)
);
CREATE TABLE IF NOT EXISTS luemi_private.blocks (
 blocker_id uuid NOT NULL,
 blocked_id uuid NOT NULL,
 environment text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(blocker_id,blocked_id),
 CHECK(blocker_id<>blocked_id),
 FOREIGN KEY(environment,blocker_id) REFERENCES luemi_private.actors(environment,id),
 FOREIGN KEY(environment,blocked_id) REFERENCES luemi_private.actors(environment,id)
);
CREATE INDEX IF NOT EXISTS luemi_blocks_reverse_idx ON luemi_private.blocks(blocked_id,blocker_id);
CREATE TABLE IF NOT EXISTS luemi_private.reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reporter_id uuid NOT NULL,
 subject_id uuid NOT NULL,
 environment text NOT NULL,
 client_ref text NOT NULL CHECK(length(client_ref) BETWEEN 8 AND 64),
 reason_code text NOT NULL CHECK(reason_code IN ('spam','harassment','impersonation','unsafe_media')),
 state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','triaged','actioned','dismissed','appealed','closed')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(reporter_id,client_ref),
 CHECK(reporter_id<>subject_id),
 FOREIGN KEY(environment,reporter_id) REFERENCES luemi_private.actors(environment,id),
 FOREIGN KEY(environment,subject_id) REFERENCES luemi_private.actors(environment,id)
);
CREATE TABLE IF NOT EXISTS luemi_private.audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid,
 event_type text NOT NULL CHECK(event_type IN ('report_created','block_created','block_removed','media_review')),
 resource_ref uuid,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON ALL TABLES IN SCHEMA luemi_private FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA luemi_private FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
  REVOKE ALL ON SCHEMA luemi_private FROM anon;
  REVOKE ALL ON ALL TABLES IN SCHEMA luemi_private FROM anon;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  REVOKE ALL ON SCHEMA luemi_private FROM authenticated;
  REVOKE ALL ON ALL TABLES IN SCHEMA luemi_private FROM authenticated;
 END IF;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY[
  'private_profile_drafts','public_profiles','media_assets','media_uploads',
  'moderation_jobs','moderation_decisions','blocks','reports','audit_events']
 LOOP
  EXECUTE format('ALTER TABLE luemi_private.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE luemi_private.%I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
-- Request-role writes need an active matching actor and transaction-scoped identity.
CREATE POLICY d_self ON luemi_private.private_profile_drafts TO luemi_request
 USING(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true))
 WITH CHECK(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true));
CREATE POLICY p_self ON luemi_private.public_profiles FOR SELECT TO luemi_request
 USING(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true));
CREATE POLICY m_self ON luemi_private.media_assets FOR ALL TO luemi_request
 USING(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true))
 WITH CHECK(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true));
CREATE POLICY u_self ON luemi_private.media_uploads FOR ALL TO luemi_request
 USING(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true))
 WITH CHECK(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true));
CREATE POLICY b_self ON luemi_private.blocks FOR ALL TO luemi_request
 USING(blocker_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true))
 WITH CHECK(blocker_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true));
CREATE POLICY r_self ON luemi_private.reports FOR SELECT TO luemi_request
 USING(reporter_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true));
CREATE POLICY r_insert ON luemi_private.reports FOR INSERT TO luemi_request
 WITH CHECK(reporter_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true));
-- Worker cannot see drafts, actors, sessions, reports or decisions.
CREATE POLICY m_worker ON luemi_private.media_assets FOR ALL TO luemi_media_worker
 USING(true) WITH CHECK(true);
CREATE POLICY u_worker ON luemi_private.media_uploads FOR ALL TO luemi_media_worker
 USING(true) WITH CHECK(true);
CREATE POLICY j_worker ON luemi_private.moderation_jobs FOR ALL TO luemi_media_worker
 USING(true) WITH CHECK(true);
-- Moderator can only read media/queue, transition state and append decision/audit.
CREATE POLICY m_moderator ON luemi_private.media_assets FOR ALL TO luemi_moderator
 USING(true) WITH CHECK(true);
CREATE POLICY j_moderator ON luemi_private.moderation_jobs FOR ALL TO luemi_moderator
 USING(true) WITH CHECK(true);
CREATE POLICY dec_mod ON luemi_private.moderation_decisions FOR INSERT TO luemi_moderator WITH CHECK(true);
CREATE POLICY audit_mod ON luemi_private.audit_events FOR INSERT TO luemi_moderator WITH CHECK(true);
GRANT USAGE ON SCHEMA luemi_private TO luemi_media_worker,luemi_moderator;
GRANT SELECT,INSERT,UPDATE ON luemi_private.media_assets,luemi_private.media_uploads,
 luemi_private.moderation_jobs TO luemi_media_worker;
GRANT SELECT(id,owner_id,environment,original_key,derivative_key,generation,state,actual_mime,byte_count,width,height,position,publication_status)
 ON luemi_private.media_assets TO luemi_request;
GRANT INSERT(id,owner_id,environment,original_key,derivative_key,position)
 ON luemi_private.media_assets TO luemi_request;
GRANT SELECT,INSERT ON luemi_private.media_uploads TO luemi_request;
GRANT SELECT,INSERT,UPDATE(revision,payload,birth_date,consent_version,updated_at)
 ON luemi_private.private_profile_drafts TO luemi_request;
GRANT SELECT(owner_id,environment,publication_status,published_revision,display_name,city_label,country_code,about,interests)
 ON luemi_private.public_profiles TO luemi_request;
GRANT SELECT,INSERT,DELETE ON luemi_private.blocks TO luemi_request;
GRANT SELECT,INSERT ON luemi_private.reports TO luemi_request;
GRANT SELECT(id,owner_id,environment,generation,state,actual_mime,byte_count,width,height,content_sha256,position,publication_status)
 ON luemi_private.media_assets TO luemi_moderator;
GRANT SELECT ON luemi_private.moderation_jobs TO luemi_moderator;
GRANT UPDATE(state) ON luemi_private.media_assets,luemi_private.moderation_jobs TO luemi_moderator;
GRANT INSERT ON luemi_private.moderation_decisions,luemi_private.audit_events TO luemi_moderator;
GRANT USAGE ON SEQUENCE luemi_private.audit_events_id_seq TO luemi_moderator;
-- Intentionally no public read policy, no publish transition, no SECURITY DEFINER.
