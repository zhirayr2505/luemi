# LUEMI Chats V1 — acceptance checklist (Draft PR #109)

This branch implements an **in-memory UI prototype**. It does not provide actual matchmaking, delivery, persistent messaging, moderation or private media storage. Never present fixture messages as real conversations.

## Automated gates
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Existing Profile V3 isolated browser smoke
- Do not infer physical Android WebView acceptance from Chromium CI.

## Manual Android Telegram WebView matrix
1. Open «Чаты», switch between main tabs repeatedly; Profile Morph V3 remains unchanged.
2. Search, open chat, send 20 messages quickly, check no duplicate bubbles.
3. Scroll into old messages; trigger incoming demo message; verify viewport stays in place and new-message indicator appears.
4. At bottom, trigger incoming demo message; verify bottom stays visible and existing bubbles move smoothly.
5. Swipe **left** on a bubble to reply; swipe **right** from screen's left edge to go back. Horizontal gestures must not trigger vertical scrolling accidentally.
6. Long-press message: reaction menu. Move finger >12 px before 470 ms: menu must NOT open.
7. Double tap bubble: toggle heart; single tap must not.
8. Long-press conversation, pin/mute/archive; restore from archive. Search should respect archive filter.
9. Edit and delete **own** message; cannot edit other participant's message.
10. Attach JPG/PNG/WebP up to 10 MB, preview, cancel, send, open viewer; reject larger files and other MIME types.
11. Open and close Android keyboard repeatedly; input remains usable, no white flash, no stale scroll jump.
12. Reduce-motion enabled: entrance/FLIP animation disabled.
13. Block demo contact; sending disabled; unblock restores input.
14. Screen-reader labels, focus order, menu dismissal and back navigation.
15. Unmount and remount Chats; verify object URLs are revoked and there are no runtime errors.

## Production blockers (NOT DONE)
- Real mutually-approved match/conversation membership, scoped to Telegram v2 actor IDs.
- Dedicated least-privilege PostgreSQL role, RLS and migration reviewed against existing LUEMI privacy model.
- Idempotent message send, durable sequence/cursor, pagination, server-authoritative read/delivery receipts.
- Private media storage, signed URLs, MIME sniffing, size enforcement and content moderation.
- Rate limits, block/report enforcement, abuse audit trail, data deletion and retention.
- Authenticated WebSocket/SSE or bounded polling with disconnect/reconnect handling.
- Feature-gated production client and end-to-end tests with two distinct real actors.
- Explicit owner approval before enabling messaging or merging to main.

## Scope guard
No deploy, migration, Render service, Supabase mutation or main merge in this PR.
