-- Reviewed, opt-in match-to-chat backfill. DO NOT execute in production until
-- a trusted, read-only match role and an isolated membership writer are provisioned.
-- Existing public.luemi_matches is the source of truth for accepted matches.
-- No client can invoke this migration or write luemi_chats.members.
BEGIN;
-- Match service must first validate that status='active' is the canonical
-- accepted-match state. This migration intentionally fails if the schema differs.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE
  table_schema='public' AND table_name='luemi_matches' AND column_name='status') THEN
  RAISE EXCEPTION 'LUEMI matches schema not verified';
 END IF;
END $$;
-- One conversation per accepted match, stable across retries.
INSERT INTO luemi_chats.conversations(environment,match_id)
SELECT 'luemi',m.id FROM public.luemi_matches m
WHERE m.status='active' AND m.user_low<>m.user_high
ON CONFLICT(environment,match_id) DO NOTHING;
-- Both members are created atomically by a privileged, audited migration role.
INSERT INTO luemi_chats.members(conversation_id,actor_id,environment)
SELECT c.id,m.user_low,c.environment
FROM luemi_chats.conversations c JOIN public.luemi_matches m ON m.id=c.match_id
WHERE c.environment='luemi' AND m.status='active'
ON CONFLICT(conversation_id,actor_id) DO NOTHING;
INSERT INTO luemi_chats.members(conversation_id,actor_id,environment)
SELECT c.id,m.user_high,c.environment
FROM luemi_chats.conversations c JOIN public.luemi_matches m ON m.id=c.match_id
WHERE c.environment='luemi' AND m.status='active'
ON CONFLICT(conversation_id,actor_id) DO NOTHING;
-- A scheduled trusted reconciliation must also revoke memberships immediately
-- when a match is revoked or either user blocks the other. Until that exists,
-- this script is NOT approved for deployment.
ROLLBACK;
