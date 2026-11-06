-- Additive, RLS-preserving dating-goal selections with legacy backfill.
BEGIN;
ALTER TABLE luemi_private.public_profiles
 ADD COLUMN IF NOT EXISTS goals text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE luemi_private.discovery_preferences
 ADD COLUMN IF NOT EXISTS goals text[] NOT NULL DEFAULT '{}'::text[];
UPDATE luemi_private.public_profiles
 SET goals=ARRAY[goal] WHERE goal IS NOT NULL AND cardinality(goals)=0;
UPDATE luemi_private.discovery_preferences
 SET goals=ARRAY[goal] WHERE cardinality(goals)=0;
ALTER TABLE luemi_private.public_profiles
 ADD CONSTRAINT public_profile_goals_1_to_3 CHECK (
  cardinality(goals)<=3
  AND goals <@ ARRAY['serious','relationship','dates','friendship','communication',
    'new_people','flirt','activities','undecided']::text[]
  AND (publication_status<>'published'
    OR cardinality(goals)>=1 AND goals[1]=goal));
ALTER TABLE luemi_private.discovery_preferences
 ADD CONSTRAINT discovery_preference_goals_1_to_3 CHECK (
  cardinality(goals) BETWEEN 1 AND 3 AND goals[1]=goal
  AND goals <@ ARRAY['serious','relationship','dates','friendship','communication',
    'new_people','flirt','activities','undecided']::text[]);
GRANT SELECT(goals),INSERT(goals),UPDATE(goals)
 ON luemi_private.public_profiles TO luemi_profile_publisher;
GRANT SELECT(goals) ON luemi_private.public_profiles TO luemi_discovery_reader;
GRANT SELECT(goals),INSERT(goals),UPDATE(goals)
 ON luemi_private.discovery_preferences TO luemi_profile_publisher;
COMMIT;
