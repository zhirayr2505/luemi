-- Throwaway PG16/17 fixture: no real accounts or data.
\set ON_ERROR_STOP on
-- The earlier match QA intentionally closed the pair; re-open it only here.
UPDATE luemi_chats.matches SET status='active',closed_at=NULL WHERE environment='luemi';
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='11111111-1111-4111-8111-111111111111';
SET LOCAL luemi.environment='luemi';
INSERT INTO luemi_chats.messages(conversation_id,sender_id,environment,client_id,body)
 SELECT id,'11111111-1111-4111-8111-111111111111','luemi',
 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc','Second synthetic private message'
 FROM luemi_chats.conversations WHERE environment='luemi' AND private_match_id IS NOT NULL;
COMMIT;
-- Recipient B may suppress A's first message locally; A sees no local event.
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='22222222-2222-4222-8222-222222222222';
SET LOCAL luemi.environment='luemi';
INSERT INTO luemi_chats.message_visibility(message_id,conversation_id,environment,actor_id,scope)
 SELECT id,conversation_id,environment,
 '22222222-2222-4222-8222-222222222222','me'
 FROM luemi_chats.messages WHERE client_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $$ BEGIN
 IF (SELECT count(*) FROM luemi_chats.message_visibility WHERE scope='me')<>1
 THEN RAISE EXCEPTION 'recipient did not see their local hide'; END IF;
END $$;
COMMIT;
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='11111111-1111-4111-8111-111111111111';
SET LOCAL luemi.environment='luemi';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM luemi_chats.message_visibility WHERE scope='me')
 THEN RAISE EXCEPTION 'other participant local visibility leaked'; END IF;
END $$;
COMMIT;
-- Fixture exports guessed IDs to session-local test GUCs so C can TRY to forge
-- a concrete existing message rather than accidentally inserting zero rows.
SELECT set_config('luemi.qa.message_id',id::text,false)
 FROM luemi_chats.messages WHERE client_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SELECT set_config('luemi.qa.conversation_id',conversation_id::text,false)
 FROM luemi_chats.messages WHERE client_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
-- Third party C cannot hide A/B's message, even with both UUIDs.
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='33333333-3333-4333-8333-333333333333';
SET LOCAL luemi.environment='luemi';
DO $$ BEGIN
 BEGIN
  INSERT INTO luemi_chats.message_visibility(message_id,conversation_id,environment,actor_id,scope)
  VALUES (current_setting('luemi.qa.message_id')::uuid,
    current_setting('luemi.qa.conversation_id')::uuid,'luemi',
    '33333333-3333-4333-8333-333333333333','everyone');
  RAISE EXCEPTION 'unmatched third party visibility changed';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END $$;
COMMIT;
-- Either member can globally hide an incoming message; its source body remains
-- only in the protected core table pending lawful retention/erasure handling.
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='22222222-2222-4222-8222-222222222222';
SET LOCAL luemi.environment='luemi';
INSERT INTO luemi_chats.message_visibility(message_id,conversation_id,environment,actor_id,scope)
 SELECT id,conversation_id,environment,
 '22222222-2222-4222-8222-222222222222','everyone'
 FROM luemi_chats.messages WHERE client_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
COMMIT;
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='11111111-1111-4111-8111-111111111111';
SET LOCAL luemi.environment='luemi';
DO $$ BEGIN
 IF (SELECT count(*) FROM luemi_chats.message_visibility WHERE scope='everyone')<>1
 THEN RAISE EXCEPTION 'global hide does not propagate'; END IF;
 IF (SELECT count(*) FROM luemi_chats.messages WHERE client_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND body='Hello from A')<>1
 THEN RAISE EXCEPTION 'display hide silently rewrote original content'; END IF;
END $$;
COMMIT;
-- Clearing a thread only for B cannot hide A's clear event; for everyone it can.
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='22222222-2222-4222-8222-222222222222';
SET LOCAL luemi.environment='luemi';
INSERT INTO luemi_chats.conversation_clear_events(conversation_id,environment,actor_id,scope)
 SELECT id,environment,'22222222-2222-4222-8222-222222222222','me'
 FROM luemi_chats.conversations WHERE environment='luemi' AND private_match_id IS NOT NULL;
COMMIT;
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='11111111-1111-4111-8111-111111111111';
SET LOCAL luemi.environment='luemi';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM luemi_chats.conversation_clear_events)
 THEN RAISE EXCEPTION 'peer local clear leaked'; END IF;
END $$;
COMMIT;
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='11111111-1111-4111-8111-111111111111';
SET LOCAL luemi.environment='luemi';
INSERT INTO luemi_chats.conversation_clear_events(conversation_id,environment,actor_id,scope)
 SELECT id,environment,'11111111-1111-4111-8111-111111111111','everyone'
 FROM luemi_chats.conversations WHERE environment='luemi' AND private_match_id IS NOT NULL;
COMMIT;
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='22222222-2222-4222-8222-222222222222';
SET LOCAL luemi.environment='luemi';
DO $$ BEGIN
 IF (SELECT count(*) FROM luemi_chats.conversation_clear_events WHERE scope='everyone')<>1
 THEN RAISE EXCEPTION 'global clear not visible to other participant'; END IF;
END $$;
COMMIT;
SELECT 'LUEMI_CHATS_VISIBILITY_RLS_PASS' AS verdict;
