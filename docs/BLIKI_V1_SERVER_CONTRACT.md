# LUEMI Блики V1 — implemented server contract

All routes are opt-in and reuse the verified REM-05B Telegram session. The server
derives the actor from the session; client owner IDs, object keys, publication
timestamps and expiry are never trusted.

## Publication

1. `POST /api/v1/bliki/publications` validates the real published profile,
   immutable operation ID, kind, MIME and declared size.
2. `PUT /api/v1/bliki/uploads/:operationId` claims the operation and streams the
   exact body to a bounded private temporary file.
3. Images are fully decoded, orientation-normalized, metadata-stripped, bounded
   and re-encoded. MP4 is probed, fully decoded and transcoded to H.264 Main /
   yuv420p plus AAC; decoded duration must be at most 15 seconds.
4. The sanitized output is uploaded to the private bucket and verified by size,
   MIME and SHA-256.
5. `POST /api/v1/bliki/publications/:operationId/confirm` validates the editor
   document and atomically sets server `published_at`; expiry is always that
   value plus 24 hours.
6. Status lookup and idempotent confirm recover interrupted clients. Permanent
   decode failures become rejected; transient processing failures remain
   recoverable.

## Read and interactions

- Feed SQL returns active real stories only and applies published profile,
  reciprocal preference and both block-direction checks under FORCE RLS.
- The media route reauthorizes each request and streams standard or valid byte
  ranges from private storage without exposing the object key.
- Views are unique per viewer/story. Reactions and reports are idempotent and
  owner interaction is denied.
- Replies use the existing `/api/v4/chats` conversation and message routes and
  therefore require an existing active mutual match.
- Owner deletion tombstones immediately; the independently credentialed
  retention worker physically removes eligible expired/deleted objects.

## Operational boundaries

No service-role key or privileged PostgreSQL credential is accepted. Media
processing has size, dimension, duration, timeout and concurrency bounds. Actor
rate limits return `429` and `Retry-After`. Public activation additionally needs
distributed abuse limits, moderation operations, live monitoring and device QA.
