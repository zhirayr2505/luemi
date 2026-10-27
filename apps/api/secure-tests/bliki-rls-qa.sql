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
