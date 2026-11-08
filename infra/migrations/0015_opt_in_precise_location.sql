-- LUEMI opt-in precise location: zero existing users are enrolled.
-- This is a separate, forced-RLS table in an unexposed private schema.
-- Exact coordinates are readable only by the owner's publisher role.
-- Discovery receives a rounded ~1km grid, never the precise columns.
BEGIN;
CREATE TABLE IF NOT EXISTS luemi_private.precise_locations (
 owner_id uuid PRIMARY KEY REFERENCES luemi_private.actors(id) ON DELETE CASCADE,
 environment text NOT NULL,
 lat double precision NOT NULL CHECK (isfinite(lat) AND lat BETWEEN -90 AND 90),
 lon double precision NOT NULL CHECK (isfinite(lon) AND lon BETWEEN -180 AND 180),
 coarse_lat double precision GENERATED ALWAYS AS (round(lat::numeric,2)::double precision) STORED,
 coarse_lon double precision GENERATED ALWAYS AS (round(lon::numeric,2)::double precision) STORED,
 accuracy_m integer CHECK (accuracy_m IS NULL OR accuracy_m BETWEEN 0 AND 3000),
 consented_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS luemi_precise_location_active_idx
 ON luemi_private.precise_locations(environment,updated_at DESC);
ALTER TABLE luemi_private.precise_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE luemi_private.precise_locations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON luemi_private.precise_locations FROM PUBLIC,anon,authenticated;
REVOKE ALL ON luemi_private.precise_locations FROM luemi_profile_publisher,luemi_discovery_reader;
CREATE POLICY luemi_location_owner_read ON luemi_private.precise_locations
 FOR SELECT TO luemi_profile_publisher
 USING (owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
   AND environment=current_setting('luemi.environment',true));
CREATE POLICY luemi_location_owner_insert ON luemi_private.precise_locations
 FOR INSERT TO luemi_profile_publisher
 WITH CHECK (owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
   AND environment=current_setting('luemi.environment',true));
CREATE POLICY luemi_location_owner_update ON luemi_private.precise_locations
 FOR UPDATE TO luemi_profile_publisher
 USING (owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true))
 WITH CHECK (owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true));
CREATE POLICY luemi_location_owner_delete ON luemi_private.precise_locations
 FOR DELETE TO luemi_profile_publisher
 USING (owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true));
-- Forced RLS and column grants ensure discovery cannot SELECT exact lat/lon.
-- Only consenting profiles authorized for this viewer can contribute a grid.
CREATE POLICY luemi_location_discover_coarse ON luemi_private.precise_locations
 FOR SELECT TO luemi_discovery_reader
 USING (environment=current_setting('luemi.environment',true)
  AND updated_at > clock_timestamp()-interval '24 hours'
  AND (owner_id=nullif(current_setting('luemi.viewer_id',true),'')::uuid
   OR EXISTS (SELECT 1 FROM luemi_private.public_profiles p
    WHERE p.owner_id=luemi_private.precise_locations.owner_id
     AND p.environment=luemi_private.precise_locations.environment
     AND p.publication_status='published')));
GRANT SELECT(owner_id,environment,lat,lon,accuracy_m,consented_at,updated_at),
 INSERT(owner_id,environment,lat,lon,accuracy_m),
 UPDATE(lat,lon,accuracy_m,updated_at),DELETE
 ON luemi_private.precise_locations TO luemi_profile_publisher;
GRANT SELECT(owner_id,environment,coarse_lat,coarse_lon,updated_at)
 ON luemi_private.precise_locations TO luemi_discovery_reader;
-- Owner may keep the confirmed profile city synchronized with their existing
-- private draft on an explicit city confirmation. No cross-owner access.
CREATE POLICY d_location_city_update ON luemi_private.private_profile_drafts
 FOR UPDATE TO luemi_profile_publisher
 USING (owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true))
 WITH CHECK(owner_id=nullif(current_setting('luemi.actor_id',true),'')::uuid
  AND environment=current_setting('luemi.environment',true));
GRANT UPDATE(payload,updated_at) ON luemi_private.private_profile_drafts TO luemi_profile_publisher;
-- Account removal already deletes the actor and cascades to precise_locations;
-- permit deletion in the existing delayed erasure worker too.
CREATE POLICY luemi_location_erasure_worker ON luemi_private.precise_locations
 FOR DELETE TO luemi_erasure_worker
 USING(EXISTS(SELECT 1 FROM luemi_private.actors a
  JOIN luemi_private.erasure_requests r ON r.actor_id=a.id AND r.environment=a.environment
  WHERE a.id=luemi_private.precise_locations.owner_id
    AND a.status='deleted' AND r.state='pending'));
GRANT SELECT(owner_id,environment),DELETE
 ON luemi_private.precise_locations TO luemi_erasure_worker;
COMMIT;
