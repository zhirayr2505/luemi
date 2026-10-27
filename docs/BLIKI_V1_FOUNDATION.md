# LUEMI 💜 — Bliki V1 development branch

Branch: `feature/bliki-v1-foundation-20261027`
Draft PR: #111

## Approved UX
- Story lifetime 24h after server-confirmed publication; eligible audience, block rules.
- Gallery only, no camera. Local drafts recover after ordinary Telegram WebView restart, subject to storage eviction.
- Overlapping collapsed avatar stack below Discovery logo; expand on downward pull.
- Taps navigate stories of one author, horizontal finger-following slides switch authors, last story advances to next author.
- Preserve approved Discovery, profile design, and Profile Morph V3.

## Implemented, isolated, not mounted
- IndexedDB V1: atomic media+draft save, account-scoped recovery, list, revision-guarded editor writes, deletion.
- React draft hook with 500ms autosave, visibility/pagehide best-effort flush, Blob URL lifecycle.
- Basic editor UI: gallery input, saved drafts list, text/emoji input, fit mode, mute, preview (publish disabled).
- Viewer foundation: navigation model, progress, photo/video rendering, pointer gestures.

## NOT implemented / NOT verified
- No integration into the live app or feature gate.
- No production media editing (gesture transforms, text drag, video trim/render).
- No real animated adjacent-card horizontal slide yet; current viewer only tracks current-card offset.
- No server upload, media processing, expiry, visibility filtering, moderation, reactions, replies, viewer list, or match/chat integration.
- No complete automated tests, local build, or physical Android WebView acceptance.
- Draft recovery needs hardening for concurrency, storage quota, cleanup, account switching, and React lifecycle.
- Viewer requires production gesture arbitration, video lifecycle and accessibility QA.

## Release gate
Keep Bliki OFF. Complete missing features, run typecheck/build/tests and Galaxy A55 Telegram Android WebView QA. Do not merge to main or deploy until owner approval.
