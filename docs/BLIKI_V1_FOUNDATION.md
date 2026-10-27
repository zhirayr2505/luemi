# LUEMI 💜 — Bliki V1 foundation (isolated branch)

This branch introduces a **local draft persistence foundation only**. No UI routes are mounted, no Bliki feature gate is enabled, and no existing Profile Morph V3, Discovery gestures, design, or backend routes are modified.

## Approved product contract
- Bliki live 24 hours from successful server publication.
- Audience: all eligible users subject to discovery settings and blocks.
- Media selection: device system gallery only, never camera.
- Unfinished drafts: local recovery on the same WebView storage partition.
- Story navigation: taps switch stories of one author; horizontal finger-tracked slides switch authors; last story advances to next author.
- Entry: collapsed overlapping avatar stack beneath Discovery logo, expandable by downward card gesture.

## Implemented here
- IndexedDB schema version 1, separate drafts and original media Blob stores.
- Atomic first save, account-scoped list and recovery, revision-checked editor updates, deletion of both metadata and media.
- No Base64, no synchronous per-frame storage writes.
- Isolated module at `apps/web/src/features/bliki/drafts/`.

## Required before enabling
1. Connect authenticated server-confirmed owner ID; do not trust raw Telegram init data.
2. System gallery picker and editor UI, autosave debounce and gesture-end flush.
3. Quota handling, media validation, lifecycle events, migrations and recovery UX.
4. Real backend upload/processing, eligibility filtering, moderation, 24h expiry, reactions, matches and chats.
5. Unit tests and Samsung Galaxy A55 Telegram Android WebView QA.
6. Keep Bliki gated OFF until the complete feature passes acceptance.

No merge or deployment is authorized in this foundation phase.
