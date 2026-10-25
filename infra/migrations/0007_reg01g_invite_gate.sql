-- REG01G invitation gate. Isolated PostgreSQL ONLY. Never run on live Supabase.
-- No invitation secrets or Telegram IDs are stored in source control.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='luemi_invite_operator') THEN
  CREATE ROLE luemi_invite_operator NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
 END IF;
END $$;
CREATE TABLE luemi_private.beta_invites (
 environment text NOT NULL CHECK(length(environment) BETWEEN 1 AND 96),
 telegram_id bigint NOT NULL CHECK(telegram_id>0),
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','revoked')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 revoked_at timestamptz,
 PRIMARY KEY(environment,telegram_id),
 CHECK((state='active' AND revoked_at IS NULL) OR
       (state='revoked' AND revoked_at IS NOT NULL))
);
CREATE INDEX beta_invites_active_idx ON luemi_private.beta_invites(environment,telegram_id)
 WHERE state='active';
ALTER TABLE luemi_private.beta_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.beta_invites FORCE ROW LEVEL SECURITY;
REVOKE ALL ON luemi_private.beta_invites FROM PUBLIC,anon,authenticated;
-- Bot issuer reads allowlist only. Issuer cannot issue invites.
CREATE POLICY g_issuer_invite ON luemi_private.beta_invites FOR SELECT
 TO luemi_auth_issuer USING(environment=current_setting('luemi.environment',true));
GRANT SELECT(environment,telegram_id,state) ON luemi_private.beta_invites TO luemi_auth_issuer;
GRANT USAGE ON SCHEMA luemi_private TO luemi_invite_operator;
CREATE POLICY g_operator_invite ON luemi_private.beta_invites FOR ALL
 TO luemi_invite_operator USING(environment=current_setting('luemi.environment',true))
 WITH CHECK(environment=current_setting('luemi.environment',true));
GRANT SELECT(environment,telegram_id,state,created_at,revoked_at),
 INSERT(environment,telegram_id,state),UPDATE(state,revoked_at)
 ON luemi_private.beta_invites TO luemi_invite_operator;
-- Do NOT grant changes in Telegram identities to any public or request role.
