-- Compatible published profiles only. Unknown audience preferences deny by default.
BEGIN;
ALTER TABLE luemi_private.public_profiles
 ADD COLUMN IF NOT EXISTS audience text,
 ADD COLUMN IF NOT EXISTS age_min integer,
 ADD COLUMN IF NOT EXISTS age_max integer;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='bliki_public_audience_values'
  AND conrelid='luemi_private.public_profiles'::regclass) THEN
  ALTER TABLE luemi_private.public_profiles ADD CONSTRAINT bliki_public_audience_values
  CHECK ((audience IS NULL OR audience IN ('men','women','everyone')) AND
    (age_min IS NULL OR age_min BETWEEN 18 AND 80) AND
    (age_max IS NULL OR age_max BETWEEN 18 AND 80) AND
    (age_min IS NULL OR age_max IS NULL OR age_min <= age_max));
 END IF;
END $$;
GRANT INSERT (audience,age_min,age_max), UPDATE (audience,age_min,age_max)
 ON luemi_private.public_profiles TO luemi_profile_publisher;
GRANT SELECT (audience,age_min,age_max,birth_date,gender)
 ON luemi_private.public_profiles TO luemi_bliki_reader,
 luemi_bliki_media_reader,luemi_bliki_interaction;

-- Invoker privileges and RLS remain in force inside this stable function.
CREATE OR REPLACE FUNCTION luemi_bliki_private.compatible_audience(
 author_id uuid, viewer_id uuid, namespace text
) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
 SELECT EXISTS (
  SELECT 1 FROM luemi_private.public_profiles author
   JOIN luemi_private.public_profiles viewer ON viewer.owner_id=viewer_id
  WHERE author.owner_id=author_id AND author.environment=namespace
   AND viewer.environment=namespace
   AND author.publication_status='published'
   AND viewer.publication_status='published'
   AND author.age_min IS NOT NULL AND author.age_max IS NOT NULL
   AND viewer.age_min IS NOT NULL AND viewer.age_max IS NOT NULL
   AND author.audience IS NOT NULL AND viewer.audience IS NOT NULL
   AND author.gender IS NOT NULL AND viewer.gender IS NOT NULL
   AND author.birth_date IS NOT NULL AND viewer.birth_date IS NOT NULL
   AND (viewer.audience='everyone'
      OR (viewer.audience='men' AND author.gender='man')
      OR (viewer.audience='women' AND author.gender='woman'))
   AND (author.audience='everyone'
      OR (author.audience='men' AND viewer.gender='man')
      OR (author.audience='women' AND viewer.gender='woman'))
   AND EXTRACT(YEAR FROM age((now() AT TIME ZONE 'UTC')::date,author.birth_date))
      BETWEEN viewer.age_min AND viewer.age_max
   AND EXTRACT(YEAR FROM age((now() AT TIME ZONE 'UTC')::date,viewer.birth_date))
      BETWEEN author.age_min AND author.age_max
 );
$$;
REVOKE ALL ON FUNCTION luemi_bliki_private.compatible_audience(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION luemi_bliki_private.compatible_audience(uuid,uuid,text)
 TO luemi_bliki_reader,luemi_bliki_media_reader,luemi_bliki_interaction;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='luemi_bliki_private'
 AND tablename='stories' AND policyname='bliki_restrict_mutual_audience') THEN
  CREATE POLICY bliki_restrict_mutual_audience ON luemi_bliki_private.stories
   AS RESTRICTIVE FOR SELECT
   TO luemi_bliki_reader,luemi_bliki_media_reader,luemi_bliki_interaction
   USING (
    author_id::text=nullif(current_setting('luemi.actor_id',true),'')
    OR luemi_bliki_private.compatible_audience(
      author_id, nullif(current_setting('luemi.actor_id',true),'')::uuid,
      environment)
   );
 END IF;
END $$;
COMMIT;
