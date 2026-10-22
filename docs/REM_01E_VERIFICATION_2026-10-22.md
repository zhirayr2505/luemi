# LUEMI 💜 — REM-01E / LU-24 · Unified profile preview

**Date:** 2026-10-22  
**Accepted base:** `4609e5f1a6d31ccb7d331a4b90ebc3e579271571` (REM-01D, inherits REM-00A/B/C, REM-01A/B/C)  
**Isolated branch:** `remediation/rem-01e-profile-preview-parity-20261022`  
**Scope:** §8.9 of `LUEMI_MASTER_REMEDIATION_TZ_2026-10-21.md`.  
**Status:** review-only; no merge/deploy/production data changes. Physical Android and iOS checks not performed.

## 1. Root cause and remediation

Before this stage, `registration/Preview.tsx` built an independent card/carousel from the entire `PhotoItem[]`, with a different birthdate and field display path. The production-like owner UI in `ProfileMaster.tsx` used `ProfileModel` and filtered prepared media. Public `mode="preview"` correctly exposed only published photos, meaning a legitimate local draft could appear empty. Owner "Как видят" was ambiguous when no server publication existed.

REM-01E replaces the step-8 independent renderer with the **same** `ProfileMaster` component used by the Discovery owner and visitor. Step 8 now instantiates `<ProfileMaster data={fromLocalDraft(data,readyRegistrationPhotos(photos))} mode="local-self-preview"/>` in an isolated, bounded registration frame without a second global header. The registration's brand/progress, arrows, editor button, demo navigation, disabled publish control, outer form scrolling, and saved data are preserved. The frame bounds are adapted to the registration screen; it is an **embedded preview**, not a claim of pixel-identical fullscreen viewport geometry. Sheet gestures/transforms, tab swipe, viewer code and current animations were not modified.

### Canonical image adapter

`readyRegistrationPhotos` is imported and used in both `App.tsx`'s owner discovery `readyPhotos` and step-8 `Preview.tsx`. It passes only `ready`/`success` images with nonempty IDs and src, suppresses duplicate IDs, preserves order after PhotoSorter reorder, and never invents `published` status. Reading/error/empty entries remain visible in registration step 7, but are excluded from the rendered profile, with a factual message about still-processing or broken photos. The same `fromLocalDraft` and `draftAge` projections produce name, age, country, city, goal, biography, interest IDs and language IDs for both views.

### Explicit data-policy capabilities

`ProfileMode` adds **`local-self-preview`** as a separate capability. Its projection can render **only** draft-status photos from a `source:"local-draft"` object, and never permits edit, main photo changes, report, premium verification claims, server IDs, real publish status or dates. `visitor` and `preview` (public-preview) **never** expose local-draft photos, even when an accidental/forged local record claims `status:"published"`. Real server visitor/preview shows **published-only** photos; hidden, rejected and pending photos do not leak. Server owner preserves its previous legitimate owner view of pending/published photos, but not hidden/rejected.

The owner's "Как видят" button now says "Предпросмотр" for `source:local-draft` and opens the **same** `ProfileMaster` with local-only projection. It remains a closable nested profile dialog; step 8 uses the no-extra-toolbar embedded variant. `source:server` still opens the public-only `mode="preview"`. Local preview badges and disclaimers accurately state no profile is published; no action can post, report, share or make a main photo. Actual PhotoViewer still shows disabled/unavailable messaging for future-link/share functionality.

### Existing product behavior and source boundaries

- No change to registration steps 1–7, REM-01B IndexedDB draft v2 serialization, TTL, migration or original File objects.
- No change to REM-01C decoder's 32 MP **provisional** cap, 12 MiB file ceiling, 2048 px preview, photo upload queue or 275ms photo reorder/edge-scroll.
- No change to REM-01D viewport/keyboard/safe-area model.
- No new public endpoint, publication, upload, moderation, premium status, share URL or server data source.
- No changes to global discovery header, ProfileMaster gesture and sheet physics, FLIP/route animation, photo viewer navigation, native touch policy, liquid-glass theme assets.
- Registration wrapper has an approximately device-height embedded frame; this necessarily differs from the true fullscreen profile by the space occupied by registration's approved header/footer. A request for new fullscreen routing physics or a differently structured registration would require separate approval, not a hidden REM-02 scope change.

## 2. Executable coverage

**Required Foundation** now runs `scripts/rem-01e-profile-parity.test.mjs`, which executes the **real** `ProfileModel` via TypeScript transpilation. It checks 0, 1 and 6 ready photos; reading/error/blank/duplicates; strict order after reorder; matching local owner/self fields; leap-year/birthday date boundaries; normalized country; server published/pending/hidden/rejected projection; absent verification/premium/public IDs and no report/main permissions. The existing Stage03G tests were updated **only where prior string-based expectations contradicted the new stronger shared renderer and local-draft secrecy**, not weakened: they now insist on the shared adapter and no public exposure even for a forged `published` flag. Remaining Stage03G gesture/motion/data tests are unchanged.

**Required Browser** `scripts/rem-01e-browser-regression.mjs` runs after all REM-00C, 01A, 01B, 01C and 01D suites. The isolated fixture loads **real** `RegistrationPreview` and `ProfileMaster` in Chromium. It compares DOM identities, hero/gallery src ordering, about/goal/interests/language presentation, the exact same five tabs, local and owner projections, two themes, 0/1/6/mixed/empty/undecided states and local-public separation. It also verifies server owner vs visitor status filtering, disabled publish, registration edit/demo controls, actual PhotoViewer restricted actions, a working tab/gallery and absence of a duplicate GlobalHeader. These are browser assertions, not solely grep checks.

Browser screenshots/physical touch capture and frame-rate comparisons across Android/iOS have NOT been performed; **functional component parity** has passed in Chromium only.

## 3. Manual release checkpoint (all NOT VERIFIED)

| Real device validation | Status |
|---|---|
| Samsung Galaxy A55 / Telegram Android WebView: all 8 steps, back/edit, local 0/1/6 photo states, scroll, gestures, sheet, viewer | **NOT VERIFIED** |
| iOS / WKWebView: same routes in both themes, focus/keyboard/safe area/long press, scroll and fullscreen | **NOT VERIFIED** |
| Pixel-level fullscreen-vs-embedded screenshots on the same viewport; theme/contrast/accessibility | **NOT VERIFIED** |
| Live 50 MP high-resolution camera fixture and decoder peak memory: REM-01C 32 MP provisional guard | **NOT VERIFIED; mandatory pre-release decision** |
| REM-01B v2 original-photo storage visibility in a true deployment rollback | **NOT VERIFIED; release blocker without v2 compatible reader** |

Verify that content is truthful: registration can simulate the published layout, but moderation, visibility, premium, verification and real user IDs cannot be claimed from an unsubmitted local draft. Photos in a local self-preview must never be exposed by API or visitor projection.

## 4. Rollback plan and data preservation

**No merge or deployment occurred.** Close the Draft PR, discard the REM-01E branch and continue from accepted REM-01D `4609e5f...`. No databases or local IndexedDB need to change. For a selective reversal, revert only REM-01E commits on a review branch; restore previous Step8 UI only in that review context, without touching accepted photo persistence or server tables.

**REM-01B compatibility warning:** v2-only locally persisted photos cannot be rendered by older pre-REM-01B code. Do NOT clear IndexedDB, rewrite v2 blobs, downgrade the persisted envelope, bulk recode user photos, or deploy an older incompatible reader. In a future production rollback, first provide a v2-compatible reader or export/rescue path.

Stop release for any local/public photo leakage, incorrectly claimed published status, photo order loss, DOB inconsistency, missing approved profile tabs/elements, broken motion/gestures, editor losing registration state, or any failing previous-stage tests.

## 5. Boundaries

REM-01E is limited to LU-24. No modifications to `main`, `staging`, Render, Supabase, real records or other projects; **no merge, no deploy, no REM-02**, and no claim of A55/iOS validation. Await explicit owner approval.
