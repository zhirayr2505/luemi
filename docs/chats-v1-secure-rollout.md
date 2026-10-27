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
