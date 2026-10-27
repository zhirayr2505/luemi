# LUEMI Chats V1 security model

## Authorization

- V2 session and CSRF guards protect every route.
- Conversation UUIDs are untrusted; unauthorized and nonexistent conversations both return 404.
- Membership is insufficient by itself: RLS calls `luemi_chats.live_match`, which also requires active actors, published profiles, active match and no bidirectional block.
- Browser clients cannot create membership or conversations.
- Message author, conversation, environment, client ID and creation time are immutable through column grants and a trigger.
- Soft-deleted bodies cannot be restored.

## Media

Accepted files are JPEG, PNG or WebP, 1 byte–10 MiB. The API compares MIME with file signatures, hashes bytes, ignores user filenames and generates a random object key. Metadata starts unattached, can be attached once by its owner, and is protected by FORCE RLS. A signed URL is issued only after a fresh live-match check and expires after 60 seconds. A block cannot revoke a URL already issued; the bounded TTL is the explicit residual risk.

The in-memory store is test/development only and production startup rejects its flag. The server-only production adapter is supplied behind an independent opt-in. It uses the dedicated private `luemi-chat-private` bucket and verifies the returned signed URL remains on the expected Supabase origin/object path. Never expose a service-role credential to the web app; the browser receives only short-lived object tokens. Deleted messages can no longer obtain new media URLs.

## Abuse and privacy

Existing global request limits remain in force. Before beta, add product-approved per-actor message/media quotas, moderation/report wiring, retention/erasure handling for stored objects, malware/decoder isolation if original uploads are retained, and security-advisor review. These operational controls cannot be truthfully validated in this isolated branch.
