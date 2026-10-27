# LUEMI Chats V1 integration

## Current gate

The branch is integration-ready but remains OFF. It does not apply migrations, provision credentials, create a bucket, merge, or deploy.

## Required order

1. Confirm the deployed auth source is `luemi_private.actors` and that published profiles use the same verified actor bridge. Do not use legacy public UUIDs as actor IDs.
2. Apply reviewed prerequisites through the normal migration process: `infra/migrations/0002..0009`, `db/chats-v1-isolated.sql`, `db/chats-v1-message-integrity.sql`, `db/chats-v2-mutual-matches.sql`, then `db/chats-v1/001_complete_messages_media.sql`.
3. Run `db/chats-v1/verify.sql` and database advisors. Test the dedicated login is non-owner, `NOBYPASSRLS`, cannot mutate members/conversations, and can update only message body/edit/delete fields, member `last_read_at`, and media `message_id`.
4. Implement `ChatMediaStorage` with a private provider. `put` must be non-public; `signedRead` TTL is capped at 60 seconds; `remove` is used for compensation. Do not enable `LUEMI_CHATS_LOCAL_MEDIA` in production (startup rejects it).
5. Wire the provider into `ChatOptions.mediaStore`, provision isolated `LUEMI_CHATS_DATABASE_URL`, and keep service-role/publishable keys out of the browser.
6. Verify block, unmatch, actor suspension and profile unpublish revoke list/history/send/media URL issuance in the same request, not after a worker runs.
7. Run two-account Telegram E2E and Samsung Galaxy A55 WebView checks. Only then approve privacy/policy flags and set backend `LUEMI_CHATS_V1_ENABLED=1`, `LUEMI_CHATS_POLICY_APPROVED=1`; set frontend `VITE_LUEMI_REAL_CHATS=1` in a separate reviewed release.

## Local demo

Run `npm run dev:web` and open `/chats-demo.html`. The demo exists only in development, uses two synthetic actors, supports history pagination, send/edit/delete/retry, incoming messages and image preview. Production builds render a disabled notice rather than fixtures.

## Rollback

Before real media is attached, review and run `db/chats-v1/001_complete_messages_media.rollback.sql`. After real data exists, use a forward corrective migration; object cleanup must be handled separately. Disable both feature flags first. No automatic destructive rollback is provided.
