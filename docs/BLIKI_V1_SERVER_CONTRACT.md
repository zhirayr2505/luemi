# LUEMI Bliki V1 — server contract (implementation pending)

**Not a production API.** This document defines acceptance criteria for later backend work; no endpoint is claimed to exist.

## Authentication and permissions
All operations must verify Telegram initData on the backend, derive the owner ID from the verified session, enforce account ownership and block/privacy/discovery eligibility. Never trust ownerId, expiration time, storage URL, or audience submitted by the client.

## Publishing
1. Client generates and persists an operationId per draft before the first request (not yet implemented in draft schema).
2. POST authenticated upload session with operationId, media type, byte size, draft ID; server enforces limits and idempotency.
3. Upload to a short-lived, scoped object-storage URL.
4. Confirm: server validates media signature, decodes and normalizes image/video, enforces video <=15s, strips metadata, processes overlays, applies moderation, and returns processing/published.
5. Set publishedAt and expiresAt = publishedAt + 24h **only after** successful processing and publication.
6. Repeated confirm with same operationId returns same story; status lookup prevents duplicate posts after restart.
7. Delete local draft only after verified published response, never on processing/error.

## Read/view
- Query active stories ordered matches, likes, nearby, world; skip empty groups.
- Enforce viewer eligibility and blocks at read time and media URL issuance.
- Expired/removed stories are not returned, including cached pages.
- Store unique view events idempotently per viewer/story; author sees viewer list with appropriate privacy.
- Reactions are per story and never silently create a match.
- Reply to story requires existing mutual match; reuse established chat permissions and moderation.

## Security
- Signed media URLs expire quickly and are scoped; do not expose raw object keys.
- Rate limits, MIME sniffing, file size and duration limits, video transcode, antivirus/abuse checks as appropriate.
- Report and delete actions verify permissions; removal invalidates future access.
- Cleanup jobs purge expired objects and records with bounded retry, independent of client clock.

## Release blockers
Backend endpoints, database migrations, upload provider, moderation, integration, CI, Android WebView device QA, and production monitoring are still required.
