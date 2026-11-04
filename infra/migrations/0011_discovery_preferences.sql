-- LUEMI matching V3: private, owner-scoped recommendation preferences.
-- Apply after 0005. This is additive and preserves every published profile.
BEGIN;

ALTER TABLE luemi_private.public_profiles
 ADD COLUMN audience text NOT NULL DEFAULT 'everyone'
   CHECK(audience IN ('women','men','everyone')),
 ADD COLUMN preferred_age_min smallint NOT NULL DEFAULT 18
   CHECK(preferred_age_min BETWEEN 18 AND 80),
 ADD COLUMN preferred_age_max smallint NOT NULL DEFAULT 80
   CHECK(preferred_age_max BETWEEN 18 AND 80 AND preferred_age_max>=preferred_age_min);

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
