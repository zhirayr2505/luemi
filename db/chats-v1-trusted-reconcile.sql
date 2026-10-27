-- LUEMI Chats: trusted, transactional reconciliation. MANUAL OWNER REVIEW REQUIRED.
-- Run only with a restricted maintenance identity AFTER chats-v1-isolated.sql.
-- This is not a client API. Requires access to private actors and public match truth.
BEGIN;
-- Serialize concurrent reconciliation jobs.
SELECT pg_advisory_xact_lock(762029, 1);
CREATE TEMP TABLE _eligible_chat_pairs ON COMMIT DROP AS
SELECT m.id AS match_id, a1.id AS actor_low, a2.id AS actor_high
FROM public.luemi_matches m
JOIN public.luemi_users u1 ON u1.id=m.user_low AND u1.status='active'
JOIN public.luemi_users u2 ON u2.id=m.user_high AND u2.status='active'
JOIN luemi_private.actors a1 ON a1.telegram_id=u1.telegram_user_id
 AND a1.environment='luemi' AND a1.status='active'
JOIN luemi_private.actors a2 ON a2.telegram_id=u2.telegram_user_id
 AND a2.environment='luemi' AND a2.status='active'
WHERE m.status='active' AND m.user_low<>m.user_high AND a1.id<>a2.id
 AND NOT EXISTS (
 SELECT 1 FROM public.luemi_blocks b
 WHERE (b.blocker_id=m.user_low AND b.blocked_id=m.user_high)
 OR (b.blocker_id=m.user_high AND b.blocked_id=m.user_low)
 );
CREATE UNIQUE INDEX ON _eligible_chat_pairs(match_id);
-- First revoke access for any no-longer-eligible match or user pair.
DELETE FROM luemi_chats.members cm
USING luemi_chats.conversations c
WHERE cm.conversation_id=c.id AND c.environment='luemi'
AND NOT EXISTS (
 SELECT 1 FROM _eligible_chat_pairs e WHERE e.match_id=c.match_id
 AND cm.actor_id IN (e.actor_low,e.actor_high)
);
-- Keep conversations stable so old messages cannot be reassigned to a new match.
INSERT INTO luemi_chats.conversations(environment,match_id)
SELECT 'luemi',match_id FROM _eligible_chat_pairs
ON CONFLICT(environment,match_id) DO NOTHING;
-- Insert precisely the two authorized V2 actor identities.
INSERT INTO luemi_chats.members(conversation_id,actor_id,environment)
SELECT c.id,e.actor_low,'luemi' FROM _eligible_chat_pairs e
JOIN luemi_chats.conversations c ON c.match_id=e.match_id AND c.environment='luemi'
UNION ALL
SELECT c.id,e.actor_high,'luemi' FROM _eligible_chat_pairs e
JOIN luemi_chats.conversations c ON c.match_id=e.match_id AND c.environment='luemi'
ON CONFLICT(conversation_id,actor_id) DO NOTHING;
-- Sanity: eligible conversations have exactly two authorized participants.
DO $$
BEGIN
 IF EXISTS (
 SELECT 1 FROM luemi_chats.conversations c
 JOIN _eligible_chat_pairs e ON e.match_id=c.match_id
 LEFT JOIN luemi_chats.members cm ON cm.conversation_id=c.id
 WHERE c.environment='luemi'
 GROUP BY c.id HAVING count(cm.actor_id)<>2
 ) THEN RAISE EXCEPTION 'LUEMI chat membership reconciliation invariant failed';
 END IF;
END $$;
COMMIT;
-- IMPORTANT: this job must run synchronously on block/unmatch/account revocation
-- or chat API must check live eligibility at every request. A periodic job alone
-- leaves an unsafe window and is NOT sufficient to enable chats.
