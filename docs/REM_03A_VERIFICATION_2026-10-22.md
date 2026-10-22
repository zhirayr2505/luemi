# LUEMI 💜 — REM-03A TECHNICAL VERIFICATION

**Scope:** approved master remediation specification §§10.1–10.3 only (LU-05, LU-02)  
**Date:** 22 October 2026  
**Exact accepted parent:** `ce25366b4cc1bf5fc9a6f04b1c167b5c3b93aa73` (REM-02D)  
**Isolated branch:** `remediation/rem-03a-photo-identity-readiness-20261022`  
**Review:** [Draft PR #42](https://github.com/zhirayr2505/luemi/pull/42)  
**Not in scope:** REM-03B three-slot viewer track, 1:1 horizontal physics, transformed motion ownership; REM-03C/D and REM-04.

## LU-05 · Photo identity contract and owner

Root cause: prior PhotoViewer maintained `index` independently of `photos`. The same index could point to a different photo after reorder/remove, and keyboard navigation did not invalidate the opening miniature origin. A photo with changed `src` could retain stale visible pixels under new date/menu metadata.

- `photo-viewer-state.ts` provides `resourceIdentity(photoId+src+version)`, `photoIndex`, `reconcilePhotoId`, `requestNavigation`, `sourceMatches`, and a typed viewer/source contract. Those functions are pure, independent of DOM animation.
- `ProfileMaster` opens by **photo ID**, not array position. Opening `ViewerSource` captures `photoId`, profile context, exact media resource key and a resolver for the opening DOM image. All miniature images expose a stable `data-photo-id`.
- PhotoViewer computes the displayed photo, its index/counter, timestamp, permissions and action menu from the same currently committed accessible photo ID. All ArrowLeft/Right, screen buttons and swipe finishes use a single `requestNavigation`. A successful navigation invalidates the captured miniature so a new image never morphs to an old photo's source. The original open/close and swipe timing/thresholds are unchanged.
- Reorder retains photo ID. When current photo is removed/revoked, choose the same prior position if still valid, else previous; when no photos remain, close cleanly without a leaked modal. A changed `src` or optional resource `version` invalidates readiness even when ID stays the same.
- The old local in-memory `mainId` reorder was not persisted but could claim successful saving. Viewer no longer receives an unconfirmed `onMain` callback from ProfileMaster; owner menu retains the control disabled until a confirmed operation exists. If a future callback is supplied, only a confirmed `true` reports success, and its result is ignored for stale ID/resource.
- `ProfilePhoto.version?: string` is an **optional projection property**, not a DB migration. Registration and IndexedDB v2 unchanged.

## LU-02 · Readiness and resources

Root cause: old `new Image()` preloads provided only `decoding="async"`, no awaited actual decode or dimension validation, while an existing `<img>` could get replaced before new pixels were ready.

- `photo-readiness.ts` owns at most three preload entries: current, previous, next. Each media key progresses through `idle → loading → decoding → ready | error`, with resource dimensions, error reason, fallback flag and incrementing generation. Loading uses actual `load`, `decode()` completion and positive natural dimensions before **preloader** ready.
- **Second display gate:** PhotoViewer uses a key-remounted actual DOM image and waits for `element.decode()` with positive natural dimensions before setting the image visible. The preloader's ready state alone cannot expose pixels. Before that, an accessible loading/error/retry state occupies the same fullscreen geometry; old pixels never remain visible under new metadata.
- All pending callbacks check the resource token and disposed flag. Changing photo ID, source URL, version, visibility, or unmounting invalidates stale callbacks; resource entries outside a window are detached with listeners and own `src` removed. No application cache or storage is mutated.
- A broken primary src may attempt **one** distinct fallback URI with the same readiness protocol. A fallback decode failure produces an error and never loops; user-requested retry explicitly renews its generation, does not report a false success. Owner/media actions requiring ready pixels are disabled during loading/error.
- Existing zoom/pan gesture geometry, viewer CSS transitions, and single-image motion remain REM-03B/03C responsibility. REM-03A does not pretend to be the final continuous track or solve all black-frame scenarios.

## Explicit QA evidence and acceptance gates

**New deterministic unit contract**: `scripts/rem-03a-photo-contract.test.mjs` verifies navigation boundaries and origins, source-identity enforcement, rearrangement and deletion of current/last/all, resource version change, maximum 3 live preloaders, decoded dimensions, fallback once, manual retry, failure handling, stale cancellation/disposal.

**New Chromium behavioral QA**: `scripts/rem-03a-browser-media.mjs` exercises real full-screen PhotoViewer DOM on dev-only controlled local fixtures: keyboard, button, mouse swipe; rapid N→N+1→N; reorder; current/last/all removal; permission revocation; same-ID new URL/version; slow cold URL (with controlled network response), decoded warm data URL; broken URL with fallback or error + explicit retry; close/reopen, image source/date/menu fidelity and no fictitious Make Main success.

New unit tests are appended to `npm run test:source-contracts`, and the browser script is appended to **the existing full behavioral QA**. Earlier suites are not removed, skipped, or made weaker. The obsolete two historical PhotoViewer React Hooks warning allowances are removed (Hooks baseline *tightened*).

**CI acceptance is exact-SHA only.** The final three workflow links, state and head SHA must be recorded in Draft PR #42 after all final commits are completed and all runs end in SUCCESS. Until then code cannot be marked accepted by its owner.

## Open issues / physical gate — NOT VERIFIED

- Physical Samsung Galaxy A55 **in real Telegram Android WebView**: actual photo decode timing, background/foreground, pressure/memory, black frames, overlay fit, real user gestures, FPS.
- iOS Telegram WKWebView: real decoding, cache eviction and memory pressure, native momentum/capture, viewport/keyboard.
- The black-frame rendering hypothesis is **not proven eliminated** without representative physical media/device sequences. Chromium only proves the listed deterministic browser scenarios.
- The new 3-slide track, 1:1 swipes, continuous drag, viewport recenter, gesture motion ownership and new tween physics are **REM-03B**, not initiated here.

## Rollback and data safety

Return to the immutable REM-02D accepted commit `ce25366b4cc1bf5fc9a6f04b1c167b5c3b93aa73` if REM-03A is rejected. Leave this Draft PR unmerged and optionally close it after owner instruction; no force-push/reset to main/staging. No real photo deletion, migrations, server writes, storage clearing, Render deploy or Supabase change. This branch does not modify the temporary 32 MP cap, IndexedDB v2 or original photo files. Do **not** begin REM-03B without separate authorization.
