-- LUEMI matching V3: private, owner-scoped recommendation preferences.
-- Apply after 0005. This is additive and preserves every published profile.
BEGIN;

-- Production already has nullable legacy `audience`, `age_min` and `age_max`
-- columns used by the Bliki profile projection. Keep those columns and copy
-- their values into the canonical matching fields instead of attempting to
-- recreate `audience` or discarding an existing preference.
ALTER TABLE luemi_private.public_profiles
 ADD COLUMN IF NOT EXISTS audience text,
 ADD COLUMN IF NOT EXISTS preferred_age_min smallint NOT NULL DEFAULT 18,
 ADD COLUMN IF NOT EXISTS preferred_age_max smallint NOT NULL DEFAULT 80;

UPDATE luemi_private.public_profiles
 SET audience=coalesce(audience,'everyone');

DO $migration$
BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema='luemi_private' AND table_name='public_profiles'
   AND column_name='age_min') THEN
  EXECUTE 'UPDATE luemi_private.public_profiles
   SET preferred_age_min=coalesce(age_min,preferred_age_min),
       preferred_age_max=coalesce(age_max,preferred_age_max)';
 END IF;
END
$migration$;

ALTER TABLE luemi_private.public_profiles
 ALTER COLUMN audience SET DEFAULT 'everyone',
 ALTER COLUMN audience SET NOT NULL;

DO $migration$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint
  WHERE conrelid='luemi_private.public_profiles'::regclass
   AND conname='public_profiles_discovery_preference_values') THEN
  ALTER TABLE luemi_private.public_profiles
   ADD CONSTRAINT public_profiles_discovery_preference_values CHECK(
    audience IN ('women','men','everyone')
    AND preferred_age_min BETWEEN 18 AND 80
    AND preferred_age_max BETWEEN 18 AND 80
    AND preferred_age_max>=preferred_age_min);
 END IF;
END
$migration$;

CREATE TABLE luemi_private.discovery_preferences (
 owner_id uuid PRIMARY KEY REFERENCES luemi_private.actors(id),
 environment text NOT NULL CHECK (length(environment) BETWEEN 1 AND 96),
 owner_gender text NOT NULL CHECK(owner_gender IN ('man','woman','other')),
 owner_birth_date date NOT NULL,
 audience text NOT NULL CHECK (audience IN ('women','men','everyone')),
 age_min smallint NOT NULL CHECK (age_min BETWEEN 18 AND 80),
 age_max smallint NOT NULL CHECK (age_max BETWEEN 18 AND 80 AND age_max>=age_min),
 city_label text NOT NULL CHECK (length(city_label) BETWEEN 2 AND 120),
 country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
 place_id text NOT NULL CHECK (length(place_id) BETWEEN 3 AND 180),
 radius_km integer NOT NULL CHECK (radius_km BETWEEN 1 AND 5000),
 search_scope text NOT NULL CHECK (search_scope IN ('radius','country','world')),
 goal text NOT NULL,
 interests text[] NOT NULL DEFAULT '{}',
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(environment,owner_id)
);

-- Existing published accounts predate explicit discovery preferences. Give
-- them a broad, non-fabricated compatibility projection so migration does not
-- remove their feed access; their next profile save replaces these defaults.
INSERT INTO luemi_private.discovery_preferences
 (owner_id,environment,owner_gender,owner_birth_date,audience,age_min,age_max,
  city_label,country_code,place_id,radius_km,search_scope,goal,interests)
SELECT owner_id,environment,gender,birth_date,'everyone',18,80,city_label,country_code,
 concat('legacy:',owner_id::text),100,'world',goal,interests
FROM luemi_private.public_profiles
WHERE publication_status='published';

ALTER TABLE luemi_private.discovery_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.discovery_preferences FORCE ROW LEVEL SECURITY;
REVOKE ALL ON luemi_private.discovery_preferences FROM PUBLIC,anon,authenticated;

GRANT SELECT,INSERT ON luemi_private.discovery_preferences TO luemi_profile_publisher;
GRANT UPDATE(owner_gender,owner_birth_date,audience,age_min,age_max,city_label,country_code,place_id,radius_km,
 search_scope,goal,interests,updated_at)
 ON luemi_private.discovery_preferences TO luemi_profile_publisher;
GRANT SELECT ON luemi_private.discovery_preferences TO luemi_discovery_reader;
GRANT SELECT(audience,preferred_age_min,preferred_age_max)
 ON luemi_private.public_profiles TO luemi_profile_publisher,luemi_discovery_reader;
GRANT INSERT(audience,preferred_age_min,preferred_age_max)
 ON luemi_private.public_profiles TO luemi_profile_publisher;
GRANT UPDATE(audience,preferred_age_min,preferred_age_max)
 ON luemi_private.public_profiles TO luemi_profile_publisher;

CREATE POLICY preference_owner_publish ON luemi_private.discovery_preferences
 FOR ALL TO luemi_profile_publisher
 USING(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
   AND environment=current_setting('luemi.environment',true))
 WITH CHECK(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
   AND environment=current_setting('luemi.environment',true));

-- Discovery may read only the requesting viewer's preference row. Other users'
-- preferences never become part of the public discovery projection.
CREATE POLICY preference_owner_discover ON luemi_private.discovery_preferences
 FOR SELECT TO luemi_discovery_reader
 USING(owner_id=nullif(current_setting('luemi.viewer_id',true),'')::uuid
   AND environment=current_setting('luemi.environment',true));

COMMIT;
