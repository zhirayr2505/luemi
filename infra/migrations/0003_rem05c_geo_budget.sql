-- REM-05C additive isolated CI migration ONLY; never run on live Supabase.
-- Execute after 0002. Database administrator must provision distinct LOGIN role
-- with membership solely in luemi_geo_budget. Never merge issuer/request roles.
CREATE SCHEMA IF NOT EXISTS luemi_private;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='luemi_geo_budget') THEN
    CREATE ROLE luemi_geo_budget NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS luemi_private.geo_daily_usage (
  namespace text NOT NULL,
  scope text NOT NULL CHECK(scope IN ('actor','global')),
  actor_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('search','reverse','provider')),
  period date NOT NULL,
  used bigint NOT NULL CHECK(used>=0),
  PRIMARY KEY(namespace,scope,actor_id,kind,period)
);
CREATE TABLE IF NOT EXISTS luemi_private.geo_inflight (
  id uuid PRIMARY KEY,
  namespace text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS geo_inflight_ns_expiry_idx
  ON luemi_private.geo_inflight(namespace,expires_at);
REVOKE ALL ON luemi_private.geo_daily_usage,luemi_private.geo_inflight FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON luemi_private.geo_daily_usage,luemi_private.geo_inflight FROM anon;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON luemi_private.geo_daily_usage,luemi_private.geo_inflight FROM authenticated;
  END IF;
END $$;
ALTER TABLE luemi_private.geo_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.geo_daily_usage FORCE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.geo_inflight ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.geo_inflight FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geo_budget_usage ON luemi_private.geo_daily_usage;
CREATE POLICY geo_budget_usage ON luemi_private.geo_daily_usage TO luemi_geo_budget
  USING(true) WITH CHECK(true);
DROP POLICY IF EXISTS geo_budget_inflight ON luemi_private.geo_inflight;
CREATE POLICY geo_budget_inflight ON luemi_private.geo_inflight TO luemi_geo_budget
  USING(true) WITH CHECK(true);
GRANT USAGE ON SCHEMA luemi_private TO luemi_geo_budget;
GRANT SELECT,INSERT,UPDATE ON luemi_private.geo_daily_usage TO luemi_geo_budget;
GRANT SELECT,INSERT,DELETE ON luemi_private.geo_inflight TO luemi_geo_budget;
-- Intentionally no grants to luemi_request, luemi_auth_issuer, anon or authenticated.
-- No destructive DOWN, no production automation.
