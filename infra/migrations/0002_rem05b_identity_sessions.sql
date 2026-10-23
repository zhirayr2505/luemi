-- LUEMI REM-05B: additive, opt-in. NEVER apply to current Render/Supabase.
-- Requires disposable Postgres >= 14 for security-negative CI.
CREATE SCHEMA IF NOT EXISTS luemi_private;
REVOKE ALL ON SCHEMA luemi_private FROM PUBLIC;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='luemi_auth_issuer') THEN
   CREATE ROLE luemi_auth_issuer NOLOGIN NOSUPERUSER NOBYPASSRLS;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='luemi_request') THEN
   CREATE ROLE luemi_request NOLOGIN NOSUPERUSER NOBYPASSRLS;
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS luemi_private.actors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 environment text NOT NULL CHECK (length(environment) BETWEEN 1 AND 96),
 telegram_id bigint NOT NULL CHECK (telegram_id > 0),
 first_name text NOT NULL CHECK (length(first_name) BETWEEN 1 AND 256),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','banned','deleted')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT luemi_actor_telegram_unique UNIQUE(environment,telegram_id)
);
CREATE TABLE IF NOT EXISTS luemi_private.sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id uuid NOT NULL REFERENCES luemi_private.actors(id),
 environment text NOT NULL CHECK (length(environment) BETWEEN 1 AND 96),
 token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash)=32),
 generation integer NOT NULL DEFAULT 1 CHECK (generation>=1),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 idle_expires_at timestamptz NOT NULL,
 absolute_expires_at timestamptz NOT NULL,
 last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 revoked_at timestamptz,
 CHECK (idle_expires_at > created_at AND absolute_expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS luemi_sessions_actor_active_idx ON luemi_private.sessions(actor_id, created_at)
 WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS luemi_sessions_expiry_idx ON luemi_private.sessions(absolute_expires_at);
REVOKE ALL ON ALL TABLES IN SCHEMA luemi_private FROM PUBLIC;
-- In Supabase these roles commonly exist; if present, explicitly keep them out.
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
   REVOKE ALL ON SCHEMA luemi_private FROM anon;
   REVOKE ALL ON ALL TABLES IN SCHEMA luemi_private FROM anon;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
   REVOKE ALL ON SCHEMA luemi_private FROM authenticated;
   REVOKE ALL ON ALL TABLES IN SCHEMA luemi_private FROM authenticated;
 END IF;
END $$;
ALTER TABLE luemi_private.actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.actors FORCE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS luemi_actors_issuer ON luemi_private.actors;
CREATE POLICY luemi_actors_issuer ON luemi_private.actors
 TO luemi_auth_issuer USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS luemi_sessions_issuer ON luemi_private.sessions;
CREATE POLICY luemi_sessions_issuer ON luemi_private.sessions
 TO luemi_auth_issuer USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS luemi_actors_self ON luemi_private.actors;
CREATE POLICY luemi_actors_self ON luemi_private.actors FOR SELECT TO luemi_request
 USING (id = nullif(current_setting('luemi.actor_id',true),'')::uuid
   AND status = 'active');
GRANT USAGE ON SCHEMA luemi_private TO luemi_auth_issuer,luemi_request;
GRANT SELECT,INSERT,UPDATE ON luemi_private.actors,luemi_private.sessions TO luemi_auth_issuer;
GRANT SELECT(id,status,environment) ON luemi_private.actors TO luemi_request;
-- No request-role privilege on sessions; never expose luemi_private via PostgREST.
-- No SECURITY DEFINER functions; no legacy table/row changes; no destructive DOWN.
