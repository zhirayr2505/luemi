-- Additive migration for admin-only user directory. Run before enabling username capture.
BEGIN;
ALTER TABLE luemi_private.actors ADD COLUMN IF NOT EXISTS telegram_username text
  CHECK (telegram_username IS NULL OR telegram_username ~ '^[A-Za-z0-9_]{1,32}$');
GRANT UPDATE(telegram_username) ON luemi_private.actors TO luemi_auth_issuer;

CREATE OR REPLACE FUNCTION luemi_private.clear_deleted_telegram_username()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.status='deleted' THEN NEW.telegram_username := NULL; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION luemi_private.clear_deleted_telegram_username() FROM PUBLIC;
DROP TRIGGER IF EXISTS clear_deleted_telegram_username ON luemi_private.actors;
CREATE TRIGGER clear_deleted_telegram_username BEFORE UPDATE ON luemi_private.actors
  FOR EACH ROW EXECUTE FUNCTION luemi_private.clear_deleted_telegram_username();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='luemi_admin_users_reader') THEN
    CREATE ROLE luemi_admin_users_reader NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
  END IF;
END $$;
GRANT USAGE ON SCHEMA luemi_private TO luemi_admin_users_reader;
GRANT SELECT(id,environment,status,telegram_id,telegram_username) ON luemi_private.actors TO luemi_admin_users_reader;
GRANT SELECT(owner_id,environment,publication_status,published_at) ON luemi_private.public_profiles TO luemi_admin_users_reader;
DROP POLICY IF EXISTS admin_users_reader_actors ON luemi_private.actors;
CREATE POLICY admin_users_reader_actors ON luemi_private.actors FOR SELECT TO luemi_admin_users_reader
  USING (environment=current_setting('luemi.environment',true) AND status='active');
DROP POLICY IF EXISTS admin_users_reader_profiles ON luemi_private.public_profiles;
CREATE POLICY admin_users_reader_profiles ON luemi_private.public_profiles FOR SELECT TO luemi_admin_users_reader
  USING (environment=current_setting('luemi.environment',true) AND publication_status='published');
COMMIT;
-- Provision a distinct login member of luemi_admin_users_reader out of band.
-- Never grant this role to the existing issuer, request, publisher, or discovery principals.
