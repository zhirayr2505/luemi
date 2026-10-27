# LUEMI Chats V1 integration

## Current gate

The branch is integration-ready but remains OFF. It does not apply migrations, provision credentials, create a bucket, merge, or deploy.

## Required order

1. Confirm the deployed auth source is `luemi_private.actors` and that published profiles use the same verified actor bridge. Do not use legacy public UUIDs as actor IDs.
2. Apply reviewed prerequisites through the normal migration process: `infra/migrations/0002..0009`, `db/chats-v1-isolated.sql`, `db/chats-v1-message-integrity.sql`, `db/chats-v2-mutual-matches.sql`, then `db/chats-v1/001_complete_messages_media.sql`.
3. Run `db/chats-v1/verify.sql` and database advisors. Test the dedicated login is non-owner, `NOBYPASSRLS`, cannot mutate members/conversations, and can update only message body/edit/delete fields, member `last_read_at`, and media `message_id`.
4. Private Supabase Storage adapter is implemented in `apps/api/src/features/chats/supabase-chat-storage.ts`. Create or verify the **non-public** `luemi-chat-private` bucket using `db/chats-v1/002_private_chat_bucket.sql` and verify the Storage policies. Keep `LUEMI_CHATS_LOCAL_MEDIA=0` (startup rejects local media in production). Signed reads expire in 60 seconds; previously issued links remain usable until expiry.
5. The provider is wired behind `LUEMI_CHATS_MEDIA_ENABLED=1`, requires `LUEMI_CHATS_MEDIA_BUCKET=luemi-chat-private` and server-only `REM06_SUPABASE_PROJECT_REF`/`REM06_SUPABASE_STORAGE_SECRET`. Provision the dedicated **LOGIN** for `LUEMI_CHATS_DATABASE_URL` with required grants; `luemi_chats_writer` is a NOLOGIN group role. Never reuse the database owner or the issuer role. Do not enable chats until all role checks pass.
6. Verify block, unmatch, actor suspension and profile unpublish revoke list/history/send/media URL issuance in the same request, not after a worker runs.
7. Database tables can exist with zero actual actors or matches. Confirm at least two real published accounts, then run two-account Telegram E2E and Samsung Galaxy A55 WebView checks. Only then approve privacy/policy flags and set backend `LUEMI_CHATS_V1_ENABLED=1`, `LUEMI_CHATS_POLICY_APPROVED=1`; set frontend `VITE_LUEMI_REAL_CHATS=1` in a separate reviewed release.

## Local demo

Run `npm run dev:web` and open `/chats-demo.html`. The demo exists only in development, uses two synthetic actors, supports history pagination, send/edit/delete/retry, incoming messages and image preview. Production builds render a disabled notice rather than fixtures.

## Rollback

Before real media is attached, review and run `db/chats-v1/001_complete_messages_media.rollback.sql`. After real data exists, use a forward corrective migration; object cleanup must be handled separately. Disable both feature flags first. No automatic destructive rollback is provided.
