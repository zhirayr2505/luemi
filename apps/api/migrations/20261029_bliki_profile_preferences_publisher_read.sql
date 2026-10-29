-- PostgreSQL ON CONFLICT DO UPDATE requires read access to the projected
-- preference columns. Keep the grant owner-scoped through existing FORCE RLS.
BEGIN;

GRANT SELECT (audience,age_min,age_max)
  ON luemi_private.public_profiles TO luemi_profile_publisher;

ALTER TABLE luemi_private.public_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.public_profiles FORCE ROW LEVEL SECURITY;

COMMIT;
