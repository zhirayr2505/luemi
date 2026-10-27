# LUEMI Chats V1 implementation report

## Delivered

- Soft Glass chat list with loading/empty/error/retry states, stable activity ordering, peer projection and unread counts.
- Thread route with day grouping, cursor pagination that preserves the scroll anchor, visibility-aware polling, stale-request cancellation and read acknowledgements.
- Optimistic idempotent send with reconciliation and failed-message retry; edit, copy and soft-delete use LUEMI sheets instead of browser prompts.
- Gallery-only JPEG/PNG/WebP attachment selection, preview/cancel, upload state, protected history image and fullscreen pinch/double-tap/vertical-dismiss viewer.
- Android WebView-oriented motion using transform/opacity, reduced-motion support, safe-area composer and explicit gesture ownership.
- Typed shared contracts, transport/domain separation, authenticated PostgreSQL API, private media storage port, byte validation and short-lived read URLs.
- FORCE RLS media completion migration, rollback/verification SQL, focused tests and development-only interactive harness.

## Deliberate limitations

Production storage is an adapter contract, not secretly connected. Realtime, notifications, typing, reactions, moderation UI, and delivery/read projection from the peer are not claimed as active. Existing backend match/block policies provide synchronous revocation only after the listed migrations and dedicated roles are deployed and verified. No production data or infrastructure was changed.
