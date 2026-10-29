-- Published preference projection shared by the existing real-profile publisher
-- and Bliki. This migration deliberately has no dependency on Bliki roles/tables
-- so core registration CI and staged rollouts can apply it first.
BEGIN;

ALTER TABLE luemi_private.public_profiles
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS age_min integer,
  ADD COLUMN IF NOT EXISTS age_max integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='bliki_public_audience_values'
      AND conrelid='luemi_private.public_profiles'::regclass
  ) THEN
    ALTER TABLE luemi_private.public_profiles
      ADD CONSTRAINT bliki_public_audience_values
      CHECK ((audience IS NULL OR audience IN ('men','women','everyone')) AND
        (age_min IS NULL OR age_min BETWEEN 18 AND 80) AND
        (age_max IS NULL OR age_max BETWEEN 18 AND 80) AND
        (age_min IS NULL OR age_max IS NULL OR age_min <= age_max));
  END IF;
END $$;

UPDATE luemi_private.public_profiles AS profile
SET audience=CASE WHEN draft.payload->>'audience' IN ('men','women','everyone')
    THEN draft.payload->>'audience' ELSE 'everyone' END,
    age_min=CASE WHEN (draft.payload->>'ageMin') ~ '^[0-9]+$'
      AND (draft.payload->>'ageMax') ~ '^[0-9]+$'
      AND (draft.payload->>'ageMin')::integer BETWEEN 18 AND 80
      AND (draft.payload->>'ageMax')::integer BETWEEN 18 AND 80
      AND (draft.payload->>'ageMin')::integer <= (draft.payload->>'ageMax')::integer
      THEN (draft.payload->>'ageMin')::integer ELSE 18 END,
    age_max=CASE WHEN (draft.payload->>'ageMin') ~ '^[0-9]+$'
      AND (draft.payload->>'ageMax') ~ '^[0-9]+$'
      AND (draft.payload->>'ageMin')::integer BETWEEN 18 AND 80
      AND (draft.payload->>'ageMax')::integer BETWEEN 18 AND 80
      AND (draft.payload->>'ageMin')::integer <= (draft.payload->>'ageMax')::integer
      THEN (draft.payload->>'ageMax')::integer ELSE 80 END
FROM luemi_private.private_profile_drafts AS draft
WHERE draft.owner_id=profile.owner_id AND draft.environment=profile.environment
  AND (profile.audience IS NULL OR profile.age_min IS NULL OR profile.age_max IS NULL);

GRANT INSERT (audience,age_min,age_max), UPDATE (audience,age_min,age_max)
  ON luemi_private.public_profiles TO luemi_profile_publisher;

COMMIT;
