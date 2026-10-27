-- Disposable PostgreSQL fixture only: all Telegram identities and photo states synthetic.
\set ON_ERROR_STOP on
CREATE TABLE IF NOT EXISTS public.luemi_matches (id uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS public.luemi_users (id uuid PRIMARY KEY,telegram_user_id bigint,status text);
CREATE TABLE IF NOT EXISTS public.luemi_blocks (blocker_id uuid,blocked_id uuid);
INSERT INTO luemi_private.actors(id,environment,telegram_id,first_name,status)
VALUES
 ('11111111-1111-4111-8111-111111111111','luemi',101,'Test A','active'),
 ('22222222-2222-4222-8222-222222222222','luemi',202,'Test B','active'),
 ('33333333-3333-4333-8333-333333333333','luemi',303,'Test C','active');
INSERT INTO luemi_private.public_profiles(owner_id,environment,publication_status,published_revision,
 display_name,city_label,country_code,about,interests,gender,goal,languages,birth_date,published_at)
SELECT id,'luemi','published',1,first_name,'Test City','DE','QA only',ARRAY['music'],
 'man','serious',ARRAY['ru'],DATE '1995-01-01',clock_timestamp()
FROM luemi_private.actors WHERE environment='luemi';
-- First like does not create a match.
BEGIN;
SET LOCAL ROLE luemi_match_writer;
SET LOCAL luemi.actor_id='11111111-1111-4111-8111-111111111111';
SET LOCAL luemi.environment='luemi';
INSERT INTO luemi_chats.likes(environment,sender_id,receiver_id)
 VALUES('luemi','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM luemi_chats.matches) THEN
  RAISE EXCEPTION 'one-sided like must not be a match';
 END IF;
END $$;
COMMIT;
-- A compromised HTTP matching role still cannot mint a match from one like.
BEGIN;
SET LOCAL ROLE luemi_match_writer;
SET LOCAL luemi.actor_id='11111111-1111-4111-8111-111111111111';
SET LOCAL luemi.environment='luemi';
DO $ BEGIN
 BEGIN
  INSERT INTO luemi_chats.matches(environment,actor_low,actor_high)
   VALUES('luemi','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
  RAISE EXCEPTION 'one-sided forged match accepted';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END $;
COMMIT;
-- Opposite like creates an authorized match, conversation and exactly two members.
BEGIN;
SET LOCAL ROLE luemi_match_writer;
SET LOCAL luemi.actor_id='22222222-2222-4222-8222-222222222222';
SET LOCAL luemi.environment='luemi';
INSERT INTO luemi_chats.likes(environment,sender_id,receiver_id)
 VALUES('luemi','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111');
INSERT INTO luemi_chats.matches(environment,actor_low,actor_high)
 VALUES('luemi','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
INSERT INTO luemi_chats.conversations(environment,private_match_id)
 SELECT 'luemi',id FROM luemi_chats.matches WHERE environment='luemi';
INSERT INTO luemi_chats.members(conversation_id,actor_id,environment)
 SELECT c.id,m.actor_low,'luemi' FROM luemi_chats.conversations c
 JOIN luemi_chats.matches m ON c.private_match_id=m.id
 UNION ALL
 SELECT c.id,m.actor_high,'luemi' FROM luemi_chats.conversations c
 JOIN luemi_chats.matches m ON c.private_match_id=m.id;
COMMIT;
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='11111111-1111-4111-8111-111111111111';
SET LOCAL luemi.environment='luemi';
DO $$ DECLARE n bigint; BEGIN
 SELECT count(*) INTO n FROM luemi_chats.members;
 IF n<>1 THEN RAISE EXCEPTION 'A must see only own member row: %',n; END IF;
 IF (SELECT count(*) FROM luemi_private.public_profiles WHERE display_name='Test B')<>1 THEN
  RAISE EXCEPTION 'published peer projection unavailable';
 END IF;
 IF (SELECT count(*) FROM luemi_private.public_profiles WHERE display_name='Test C')<>0 THEN
  RAISE EXCEPTION 'unmatched peer profile exposed';
 END IF;
 IF NOT (SELECT luemi_chats.live_match(c.id,'11111111-1111-4111-8111-111111111111','luemi')
  FROM luemi_chats.conversations c LIMIT 1) THEN RAISE EXCEPTION 'live match denied'; END IF;
END $$;
COMMIT;
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='33333333-3333-4333-8333-333333333333';
SET LOCAL luemi.environment='luemi';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM luemi_chats.members) THEN RAISE EXCEPTION 'unmatched C saw members'; END IF;
 IF EXISTS(SELECT 1 FROM luemi_chats.conversations) THEN RAISE EXCEPTION 'unmatched C saw conversations'; END IF;
END $$;
COMMIT;
-- A caller from an eligible pair cannot enroll an unrelated actor C.
BEGIN;
SET LOCAL ROLE luemi_match_writer;
SET LOCAL luemi.actor_id='11111111-1111-4111-8111-111111111111';
SET LOCAL luemi.environment='luemi';
DO $ BEGIN
 BEGIN
  INSERT INTO luemi_chats.members(conversation_id,actor_id,environment)
   SELECT id,'33333333-3333-4333-8333-333333333333','luemi' FROM luemi_chats.conversations;
  RAISE EXCEPTION 'third-party chat membership allowed';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END $;
COMMIT;
-- Actual message round-trip through the least-privilege chat role.
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='11111111-1111-4111-8111-111111111111';
SET LOCAL luemi.environment='luemi';
INSERT INTO luemi_chats.messages(conversation_id,sender_id,environment,client_id,body)
 SELECT id,'11111111-1111-4111-8111-111111111111','luemi',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Hello from A'
 FROM luemi_chats.conversations;
COMMIT;
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='22222222-2222-4222-8222-222222222222';
SET LOCAL luemi.environment='luemi';
DO $ BEGIN
 IF (SELECT count(*) FROM luemi_chats.messages WHERE body='Hello from A')<>1 THEN
  RAISE EXCEPTION 'matched B cannot read A message';
 END IF;
END $;
COMMIT;
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='33333333-3333-4333-8333-333333333333';
SET LOCAL luemi.environment='luemi';
DO $ BEGIN
 IF EXISTS(SELECT 1 FROM luemi_chats.messages) THEN
  RAISE EXCEPTION 'unmatched actor C saw private messages';
 END IF;
END $;
COMMIT;
-- A block immediately revokes both participants' message access.
INSERT INTO luemi_private.blocks(blocker_id,blocked_id,environment)
 VALUES('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','luemi');
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='22222222-2222-4222-8222-222222222222';
SET LOCAL luemi.environment='luemi';
DO $ BEGIN
 IF EXISTS(SELECT 1 FROM luemi_chats.members) THEN RAISE EXCEPTION 'block did not revoke chat'; END IF;
 IF EXISTS(SELECT 1 FROM luemi_chats.messages) THEN RAISE EXCEPTION 'block leaked messages'; END IF;
 BEGIN
  INSERT INTO luemi_chats.messages(conversation_id,sender_id,environment,client_id,body)
   VALUES((SELECT id FROM luemi_chats.conversations LIMIT 1),
    '22222222-2222-4222-8222-222222222222','luemi',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Post block');
  RAISE EXCEPTION 'post-block send was incorrectly allowed';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END $;
COMMIT;
DELETE FROM luemi_private.blocks;
-- Unmatching closes the pair and revokes visibility without deleting messages.
BEGIN;
SET LOCAL ROLE luemi_match_writer;
SET LOCAL luemi.actor_id='11111111-1111-4111-8111-111111111111';
SET LOCAL luemi.environment='luemi';
UPDATE luemi_chats.matches SET status='closed',closed_at=clock_timestamp()
 WHERE environment='luemi' AND status='active';
COMMIT;
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='11111111-1111-4111-8111-111111111111';
SET LOCAL luemi.environment='luemi';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM luemi_chats.members) THEN RAISE EXCEPTION 'unmatch did not revoke chat'; END IF;
END $$;
COMMIT;
SELECT 'LUEMI_MATCH_RLS_PASS' AS verdict;
