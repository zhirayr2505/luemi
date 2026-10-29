-- Synthetic-only: a deleted peer keeps an existing conversation readable but not writable.
\set ON_ERROR_STOP on
INSERT INTO luemi_chats.matches(environment,actor_low,actor_high)
 VALUES('luemi','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333');
INSERT INTO luemi_chats.conversations(environment,private_match_id)
 SELECT 'luemi',id FROM luemi_chats.matches
 WHERE actor_low='11111111-1111-4111-8111-111111111111'
 AND actor_high='33333333-3333-4333-8333-333333333333';
INSERT INTO luemi_chats.members(conversation_id,actor_id,environment)
 SELECT c.id,part.actor_id,'luemi' FROM luemi_chats.conversations c
 JOIN luemi_chats.matches m ON m.id=c.private_match_id
 CROSS JOIN LATERAL (VALUES(m.actor_low),(m.actor_high)) part(actor_id)
 WHERE m.actor_high='33333333-3333-4333-8333-333333333333';
INSERT INTO luemi_chats.messages(conversation_id,sender_id,environment,client_id,body)
 SELECT c.id,'11111111-1111-4111-8111-111111111111','luemi',
 'dddddddd-dddd-4ddd-8ddd-dddddddddddd','Persist for recipient'
 FROM luemi_chats.conversations c
 JOIN luemi_chats.matches m ON m.id=c.private_match_id
 WHERE m.actor_high='33333333-3333-4333-8333-333333333333';
UPDATE luemi_private.actors SET status='deleted',first_name='Удалённый аккаунт',
 telegram_id=9000000000000000000,anonymized_at=clock_timestamp()
 WHERE id='33333333-3333-4333-8333-333333333333';
UPDATE luemi_private.public_profiles SET publication_status='hidden'
 WHERE owner_id='33333333-3333-4333-8333-333333333333';
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='11111111-1111-4111-8111-111111111111';
SET LOCAL luemi.environment='luemi';
DO $ DECLARE chat_id uuid; BEGIN
 SELECT c.id INTO chat_id FROM luemi_chats.conversations c
 JOIN luemi_chats.matches m ON m.id=c.private_match_id
 WHERE m.actor_high='33333333-3333-4333-8333-333333333333';
 IF NOT luemi_chats.archived_peer_history(chat_id,'11111111-1111-4111-8111-111111111111','luemi')
 THEN RAISE EXCEPTION 'surviving member cannot view original chat';END IF;
 IF luemi_chats.live_match(chat_id,'11111111-1111-4111-8111-111111111111','luemi')
 THEN RAISE EXCEPTION 'archived chat is still writable'; END IF;
 IF (SELECT count(*) FROM luemi_chats.messages WHERE conversation_id=chat_id)<>1
 THEN RAISE EXCEPTION 'original message inaccessible to recipient'; END IF;
 IF has_column_privilege(current_user,'luemi_private.actors','telegram_id','SELECT')
 THEN RAISE EXCEPTION 'Telegram ID exposed'; END IF;
 BEGIN
  INSERT INTO luemi_chats.messages(conversation_id,sender_id,environment,client_id,body)
  VALUES(chat_id,'11111111-1111-4111-8111-111111111111','luemi',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','forbidden');
  RAISE EXCEPTION 'write allowed to deleted account';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END $$;
COMMIT;
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='22222222-2222-4222-8222-222222222222';
SET LOCAL luemi.environment='luemi';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM luemi_chats.messages WHERE body='Persist for recipient')
 THEN RAISE EXCEPTION 'unmatched observer gained access to archive';END IF;
END $$;
COMMIT;
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='33333333-3333-4333-8333-333333333333';
SET LOCAL luemi.environment='luemi';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM luemi_chats.messages WHERE body='Persist for recipient')
 THEN RAISE EXCEPTION 'deleted account can still read history';END IF;
END $$;
COMMIT;
INSERT INTO luemi_private.blocks(blocker_id,blocked_id,environment)
VALUES('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','luemi');
BEGIN;
SET LOCAL ROLE luemi_chats_writer;
SET LOCAL luemi.actor_id='11111111-1111-4111-8111-111111111111';
SET LOCAL luemi.environment='luemi';
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM luemi_chats.messages WHERE body='Persist for recipient')
 THEN RAISE EXCEPTION 'block failed to revoke archived access';END IF;
END $$;
COMMIT;
SELECT 'LUEMI_ARCHIVED_CHAT_RLS_PASS' AS verdict;
