-- Roll back the unwanted multi-goal feature; only the original primary
-- text goal is used in registration, discovery and profiles.
-- Additive phase-one removal of constraints is applied to production before
-- the old one-goal application becomes live. This phase removes the legacy
-- unused columns once the single-goal server version is running.
BEGIN;
ALTER TABLE luemi_private.public_profiles
 DROP CONSTRAINT IF EXISTS public_profile_goals_1_to_3;
ALTER TABLE luemi_private.discovery_preferences
 DROP CONSTRAINT IF EXISTS discovery_preference_goals_1_to_3;
ALTER TABLE luemi_private.public_profiles DROP COLUMN IF EXISTS goals;
ALTER TABLE luemi_private.discovery_preferences DROP COLUMN IF EXISTS goals;
COMMIT;
