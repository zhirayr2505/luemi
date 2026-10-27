# LUEMI Chats V1: secure rollout gate

**Status:** Draft, NOT production ready. Feature defaults OFF. Never enable merely because this branch builds.

## What is implemented
- Local demo chat UI (fixtures explicitly labeled demo).
- Isolated v4 server API: list, paginated messages, idempotent send, edit own text, soft-delete own text.
- PostgreSQL RLS schema with explicit actor and environment transaction context.
- Opt-in real chat client with polling and retry-safe client IDs.
- Fail-closed configuration and route-disabled tests.

## Hard blockers
1. **Membership creation is intentionally not implemented.** A trusted match service must verify a mutual, active, unblocked match, and insert exactly two members with the same environment. Client-provided IDs must never grant membership.
2. **Database migration is NOT applied.** Review `db/chats-v1-isolated.sql` and provision an isolated non-owner login role with membership in `luemi_chats_writer`, without inheritance of auth/request/discovery roles. Never grant DML on members or conversations. Only grant SELECT on members, SELECT/INSERT and narrowly scoped UPDATE(body,edited_at,deleted_at) on messages. No direct delete. Confirm RLS policies under actual role.
3. **Blocking/reporting and privacy retention are not implemented** in the real API. Do not enable real chats before enforcement, abuse rate limits and erasure workflows exist.
4. Real peer name, self identity and mutual match verification have no production integration.
5. Private media uploads, read/delivery receipts, typing and notification infrastructure are absent.
6. No two-user integration test or physical Samsung A55 Telegram WebView signoff.

## Opt-in configuration — DO NOT SET IN PRODUCTION YET
- Backend: `LUEMI_CHATS_V1_ENABLED=1`, `LUEMI_CHATS_POLICY_APPROVED=1`, `LUEMI_CHATS_DATABASE_URL` (dedicated role), and the existing V2 auth/privacy approvals.
- Frontend: `VITE_LUEMI_REAL_CHATS=1` and `VITE_LUEMI_AUTH_V2=1`.
- Existing deployments retain demo UI and no v4 routes by default.
- Feature switches are not authorization substitutes.

## QA
- Validate auth rejection (missing cookie, CSRF, foreign origin, expired/revoked session).
- Validate unauthorized conversation IDs are indistinguishable from nonexistent ones.
- Validate duplicate clientId with same body returns same message, with different body returns 409.
- Validate other actor cannot read, edit, delete or insert in a conversation.
- Validate two-user concurrent send and pagination across identical timestamps.
- Validate revoked session during request rolls back the transaction.
- Validate chat role has no write privilege on membership or any auth/profile tables.
- Validate blocking, report, erasure and moderation policy before any real-user beta.

No merge, deploy, Supabase migration, or paid service was performed.

## Verified against live LUEMI metadata (read-only)
- `public.luemi_matches` exists and has `id`, `user_low`, `user_high` (UUID) and `status`; `public.luemi_users` has UUID `id` and BIGINT `telegram_user_id`.
- V2 session `authActor.actorId` must be proven to map to the same UUID identity as `luemi_matches.user_low/user_high` before any membership reconciliation. Do not assume matching UUID formats imply matching users.
- Match status values and revocation/block rules require verification; `db/chats-v1-match-reconciliation-review.sql` intentionally ends in ROLLBACK and must not be treated as an applied migration.
- No production database writes or storage bucket changes were made.

## Read receipts (27 October)
- Added `POST /api/v4/chats/:id/read` accepting a UUID `messageId`, verifying actor membership and updating only the current member's `last_read_at` monotonically.
- Grant **only** `UPDATE(last_read_at)` on `luemi_chats.members` to the isolated chat role, never table-wide UPDATE. Test RLS with both users.
- Client acknowledges incoming messages only while the chat is visible and retries failures. Delivery and typing signals remain unimplemented.
- The current self-only `members` SELECT policy deliberately hides the other member, so peer names and peer IDs cannot yet be populated from it. A separately authorized, privacy-reviewed peer projection is required.

## Verified identity boundary and list refresh
- `luemi_private.actors.id` is a V2 session actor UUID; `public.luemi_users.id` is a separate public profile UUID. They must **never** be equated directly.
- Review-only reconciliation joins actors and public profiles using independently verified Telegram ID and active account state, then maps public match endpoints to actor IDs. It remains intentionally rolled back and is not a live integration.
- Chat list now refreshes every 5 seconds in the foreground and immediately on visibility restoration, including unread counts.
- Match revocation, blocking, photo storage and production credential provisioning remain blockers to turning on the feature.
