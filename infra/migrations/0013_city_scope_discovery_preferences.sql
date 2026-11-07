-- LUEMI: expand the existing search scope check to support city-local discovery.
-- Additive: all existing radius/country/world values and user profiles remain valid.
-- No changes to roles, RLS, grants, personal data, or published-media rules.
-- Apply BEFORE deploying API/frontend that can publish a 'city' preference.
BEGIN;
ALTER TABLE luemi_private.discovery_preferences
 DROP CONSTRAINT IF EXISTS discovery_preferences_search_scope_check;
ALTER TABLE luemi_private.discovery_preferences
 ADD CONSTRAINT discovery_preferences_search_scope_check
 CHECK (search_scope IN ('radius','city','country','world'));
COMMIT;
