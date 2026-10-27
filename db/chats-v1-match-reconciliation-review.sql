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
 AND NOT EXISTS (SELECT 1 FROM public.luemi_blocks b
  WHERE (b.blocker_id=m.user_low AND b.blocked_id=m.user_high)
     OR (b.blocker_id=m.user_high AND b.blocked_id=m.user_low))
ON CONFLICT(environment,match_id) DO NOTHING;
-- The V2 actor ID is NOT the public user ID. Join through a verified
-- Telegram identity, never by equating unrelated UUIDs.
-- Both actor mappings must exist, be active and belong to the same namespace.
-- This migration is a review-only dry run; no client role may access either
-- private actors or public user identity mappings.
WITH verified AS (
 SELECT c.id AS conversation_id, c.environment,
        low_actor.id AS low_actor_id, high_actor.id AS high_actor_id
 FROM luemi_chats.conversations c
 JOIN public.luemi_matches m ON m.id=c.match_id AND m.status='active'
 AND NOT EXISTS (SELECT 1 FROM public.luemi_blocks b
  WHERE (b.blocker_id=m.user_low AND b.blocked_id=m.user_high)
     OR (b.blocker_id=m.user_high AND b.blocked_id=m.user_low))
 JOIN public.luemi_users ul ON ul.id=m.user_low AND ul.status='active'
 JOIN public.luemi_users uh ON uh.id=m.user_high AND uh.status='active'
 JOIN luemi_private.actors low_actor
   ON low_actor.telegram_id=ul.telegram_user_id::text
   AND low_actor.environment=c.environment AND low_actor.status='active'
 JOIN luemi_private.actors high_actor
   ON high_actor.telegram_id=uh.telegram_user_id::text
   AND high_actor.environment=c.environment AND high_actor.status='active'
 WHERE c.environment='luemi' AND low_actor.id<>high_actor.id
)
INSERT INTO luemi_chats.members(conversation_id,actor_id,environment)
SELECT conversation_id,low_actor_id,environment FROM verified
UNION ALL
SELECT conversation_id,high_actor_id,environment FROM verified
ON CONFLICT(conversation_id,actor_id) DO NOTHING;
-- Revoke membership for conversations whose match is no longer active, whose
-- participants are blocked, or whose accounts are no longer active.
-- A production reconciler must revoke access when matches, accounts or
-- blocks change; a one-time backfill is insufficient for secure chat access.
-- A scheduled trusted reconciliation must also revoke memberships immediately
-- when a match is revoked or either user blocks the other. Until that exists,
-- this script is NOT approved for deployment.
ROLLBACK;
