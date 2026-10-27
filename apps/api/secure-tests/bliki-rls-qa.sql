-- Disposable PostgreSQL 16. No production credentials, no real users.
\set ON_ERROR_STOP on
INSERT INTO luemi_private.actors(id,environment,telegram_id,first_name)
VALUES
 ('11111111-1111-4111-8111-111111111111','bliki_ci',1001,'Author'),
 ('22222222-2222-4222-8222-222222222222','bliki_ci',1002,'Viewer'),
 ('33333333-3333-4333-8333-333333333333','bliki_ci',1003,'Incompatible');

INSERT INTO luemi_private.public_profiles
(owner_id,environment,publication_status,published_revision,display_name,
 city_label,country_code,gender,goal,birth_date,published_at,audience,age_min,age_max)
VALUES
 ('11111111-1111-4111-8111-111111111111','bliki_ci','published',1,'Author','City','RU',
  'man','serious','1995-01-01',now(),'women',18,80),
 ('22222222-2222-4222-8222-222222222222','bliki_ci','published',1,'Viewer','City','RU',
  'woman','serious','1996-01-01',now(),'men',18,80),
 ('33333333-3333-4333-8333-333333333333','bliki_ci','published',1,'Other','City','RU',
  'man','serious','1994-01-01',now(),'women',18,80);

INSERT INTO luemi_bliki_private.stories
(id,environment,author_id,operation_id,media_kind,mime_type,media_key,media_bytes,status,published_at)
VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bliki_ci',
  '11111111-1111-4111-8111-111111111111','aaaaaaaa-bbbb-4bbb-8bbb-aaaaaaaaaaaa',
  'image','image/jpeg','bliki_ci/author/current',100,'published',now()),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bliki_ci',
  '11111111-1111-4111-8111-111111111111','bbbbbbbb-cccc-4ccc-8ccc-bbbbbbbbbbbb',
  'image','image/jpeg','bliki_ci/author/expired',100,'published',now()-interval '25 hours');

-- Force RLS is tested using SET ROLE, not a superuser's read result.
BEGIN;
SET LOCAL ROLE luemi_bliki_reader;
SELECT set_config('luemi.actor_id','22222222-2222-4222-8222-222222222222',true);
SELECT set_config('luemi.environment','bliki_ci',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM luemi_bliki_private.stories) <> 1 THEN
  RAISE EXCEPTION 'compatible viewer cannot see exactly one active story';
 END IF;
 IF has_column_privilege(current_user,'luemi_bliki_private.stories','media_key','SELECT') THEN
  RAISE EXCEPTION 'feed reader has media key access';
 END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE luemi_bliki_reader;
SELECT set_config('luemi.actor_id','33333333-3333-4333-8333-333333333333',true);
SELECT set_config('luemi.environment','bliki_ci',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM luemi_bliki_private.stories) <> 0 THEN
  RAISE EXCEPTION 'incompatible preferences leaked story';
 END IF;
END $$;
ROLLBACK;

-- Both block directions must independently deny visibility.
INSERT INTO luemi_private.blocks(environment,blocker_id,blocked_id)
VALUES('bliki_ci','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
BEGIN;
SET LOCAL ROLE luemi_bliki_reader;
SELECT set_config('luemi.actor_id','22222222-2222-4222-8222-222222222222',true);
SELECT set_config('luemi.environment','bliki_ci',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM luemi_bliki_private.stories) <> 0 THEN
  RAISE EXCEPTION 'viewer-to-author block leaked story';
 END IF;
END $$;
ROLLBACK;
DELETE FROM luemi_private.blocks WHERE blocker_id='22222222-2222-4222-8222-222222222222';
INSERT INTO luemi_private.blocks(environment,blocker_id,blocked_id)
VALUES('bliki_ci','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
BEGIN;
SET LOCAL ROLE luemi_bliki_media_reader;
SELECT set_config('luemi.actor_id','22222222-2222-4222-8222-222222222222',true);
SELECT set_config('luemi.environment','bliki_ci',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM luemi_bliki_private.stories) <> 0 THEN
  RAISE EXCEPTION 'author-to-viewer block leaked media';
 END IF;
END $$;
ROLLBACK;
DELETE FROM luemi_private.blocks WHERE blocker_id='11111111-1111-4111-8111-111111111111';

-- The actor who published the story remains allowed to view their own active story.
BEGIN;
SET LOCAL ROLE luemi_bliki_media_reader;
SELECT set_config('luemi.actor_id','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('luemi.environment','bliki_ci',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM luemi_bliki_private.stories) <> 1 THEN
  RAISE EXCEPTION 'author self read or expired media filter failed';
 END IF;
END $$;
ROLLBACK;

-- Interactions are actor-only and once per story. No storage key exposure.
BEGIN;
SET LOCAL ROLE luemi_bliki_interaction;
SELECT set_config('luemi.actor_id','22222222-2222-4222-8222-222222222222',true);
SELECT set_config('luemi.environment','bliki_ci',true);
INSERT INTO luemi_bliki_private.views(story_id,viewer_id)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222')
ON CONFLICT DO NOTHING;
INSERT INTO luemi_bliki_private.views(story_id,viewer_id)
VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222')
ON CONFLICT DO NOTHING;
DO $$ BEGIN
 IF (SELECT count(*) FROM luemi_bliki_private.views) <> 1 THEN
  RAISE EXCEPTION 'views not idempotent';
 END IF;
 IF has_column_privilege(current_user,'luemi_bliki_private.stories','media_key','SELECT') THEN
  RAISE EXCEPTION 'interaction principal can read media key';
 END IF;
END $$;
ROLLBACK;

DO $$ BEGIN
 IF has_table_privilege('anon','luemi_bliki_private.stories','SELECT') OR
    has_table_privilege('authenticated','luemi_bliki_private.stories','SELECT') THEN
  RAISE EXCEPTION 'public role can read stories';
 END IF;
END $$;

-- Retention RLS must never expose active media. Test role constraints and
-- eligible rows on the same disposable PostgreSQL 16 instance as feed QA.
UPDATE luemi_bliki_private.stories SET published_at=now()-interval '24 hours 30 minutes'
 WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
INSERT INTO luemi_bliki_private.stories
(id,environment,author_id,operation_id,media_kind,mime_type,media_key,media_bytes,
 status,published_at,deleted_at,created_at)
VALUES
 ('44444444-4444-4444-8444-444444444444','bliki_ci',
 '11111111-1111-4111-8111-111111111111','44444444-aaaa-4aaa-8aaa-444444444444',
 'image','image/jpeg','bliki_ci/11111111-1111-4111-8111-111111111111/44444444-aaaa-4aaa-8aaa-444444444444',
 100,'deleted',NULL,now(),now()),
 ('55555555-5555-4555-8555-555555555555','bliki_ci',
 '11111111-1111-4111-8111-111111111111','55555555-aaaa-4aaa-8aaa-555555555555',
 'image','image/jpeg','bliki_ci/11111111-1111-4111-8111-111111111111/55555555-aaaa-4aaa-8aaa-555555555555',
 100,'published',now()-interval '26 hours',NULL,now()-interval '27 hours'),
 ('66666666-6666-4666-8666-666666666666','bliki_ci',
 '11111111-1111-4111-8111-111111111111','66666666-aaaa-4aaa-8aaa-666666666666',
 'image','image/jpeg','bliki_ci/11111111-1111-4111-8111-111111111111/66666666-aaaa-4aaa-8aaa-666666666666',
 100,'uploading',NULL,NULL,now()-interval '49 hours'),
 ('77777777-7777-4777-8777-777777777777','bliki_ci',
 '11111111-1111-4111-8111-111111111111','77777777-aaaa-4aaa-8aaa-777777777777',
 'image','image/jpeg','bliki_ci/11111111-1111-4111-8111-111111111111/77777777-aaaa-4aaa-8aaa-777777777777',
 100,'published',now()-interval '1 hour',NULL,now()-interval '2 hours'),
 ('88888888-8888-4888-8888-888888888888','bliki_ci',
 '11111111-1111-4111-8111-111111111111','88888888-aaaa-4aaa-8aaa-888888888888',
 'image','image/jpeg','bliki_ci/11111111-1111-4111-8111-111111111111/88888888-aaaa-4aaa-8aaa-888888888888',
 100,'uploading',NULL,NULL,now()-interval '1 hour'),
 ('99999999-9999-4999-8999-999999999999','other_namespace',
 '11111111-1111-4111-8111-111111111111','99999999-aaaa-4aaa-8aaa-999999999999',
 'image','image/jpeg','other_namespace/11111111-1111-4111-8111-111111111111/99999999-aaaa-4aaa-8aaa-999999999999',
 100,'deleted',NULL,now(),now());

BEGIN;
SET LOCAL ROLE luemi_bliki_retention;
SELECT set_config('luemi.environment','bliki_ci',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM luemi_bliki_private.stories) <> 3 THEN
  RAISE EXCEPTION 'retention may only see the three eligible rows';
 END IF;
 IF has_column_privilege(current_user,'luemi_bliki_private.stories','status','UPDATE')
    OR has_column_privilege(current_user,'luemi_bliki_private.stories','media_key','UPDATE')
    OR has_schema_privilege(current_user,'luemi_private','USAGE') THEN
  RAISE EXCEPTION 'retention principal has excessive privileges';
 END IF;
END $$;
UPDATE luemi_bliki_private.stories SET media_cleaned_at=clock_timestamp(),
 cleanup_attempts=cleanup_attempts+1,cleanup_attempt_at=clock_timestamp()
 WHERE id='44444444-4444-4444-8444-444444444444';
DO $$ BEGIN
 IF (SELECT count(*) FROM luemi_bliki_private.stories) <> 2 THEN
  RAISE EXCEPTION 'cleaned object remains eligible for another deletion';
 END IF;
END $$;
ROLLBACK;

DO $$ BEGIN
 IF has_table_privilege('anon','luemi_bliki_private.stories','SELECT') OR
    has_table_privilege('authenticated','luemi_bliki_private.stories','UPDATE') THEN
  RAISE EXCEPTION 'retention opened public database privileges';
 END IF;
END $$;
