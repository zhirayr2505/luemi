# LUEMI 💜 · REM-01B / LU-19 + LU-20 · Verification and rollback

**Date:** 2026-10-22. **Scope:** device-local registration save, restore, runtime validation, photo manifest and TTL. No product Stage change.
**Exact accepted base:** `c4401bd93f07b0ffba865e5f2a42963f60a0a106` (accepted REM-01A; includes REM-00A/B/C).  
**Branch:** `remediation/rem-01b-registration-persistence-20261022`.  
**PR:** review-only draft, never merge or deploy without owner authorization.  
**Final SHA and final-head CI status:** verify separately from GitHub Actions on the HEAD of this document commit.

## Changes and invariants

1. LU-20: `draft-schema.ts` accepts `unknown` and validates v2 envelope, legal incomplete step-1 data, 8-step index, finite integer revision, local scope, timestamps, field types and length limits, optional enum strings, age/radius bounds, country code normalization, bounded arrays, original `File`/Blob metadata, no duplicate photo IDs, maximum six photos. Invalid entries do not reach form components.
2. LU-19: `local-draft.ts` stores registration text, original photos, processed preview and photo IDs as one `DraftEnvelope` (v2) under an isolated IDB key. Single `readwrite` transaction commits revision and manifest atomically; transaction abort, quota, restricted IDB, blocked upgrade, and readback verification have explicit discriminated error results. Writes/clear serialize to avoid stale overwrite, with account-scoped snapshots and revision checking. Error cannot be labeled saved.
3. Uses the existing `luemi-local-photo-preview-v1` IndexedDB version **1** and store `drafts`, with v2 keys `registration-v2:<localScope>`; no incompatible DB version upgrade. Legacy localStorage v1 and original IDB `drafts[scope]` records remain untouched during import. Legacy photos join text only after matching valid 30-day timestamp windows; malformed/stale records are retained and flagged rather than silently concatenated. Migration is repeatable; an expired v2 record is not returned as fresh and is archived on subsequent new write without erasing its file blobs.
4. `App.tsx` waits for fully validated text + photo manifest restoration before enabling persistence, regenerates bounded preview URLs from stored originals, uses `dirty/saving/saved/error` state plus manual retry; a confirmed revision is the only basis for saved status. User explicitly confirmed `clear` writes a tombstone, serializes behind any earlier save, and clears legacy only after IDB completes; failures are shown.
5. `RegistrationBoundary.tsx` and `main.tsx` catch unexpected render failures and show a reload action without automatic draft or photo deletion.
6. The existing UI, layout, existing visual/motion design, gestures, photo sorter, country, geo, haptic, and other already accepted fixes remain unchanged. Additional status/error text uses the existing footer styling. Nothing uploaded, published or synced to a production backend.

## Validation / evidence

- Foundation CI: all seven original mandatory checks (infrastructure, lint + Hook debt ledger, TypeScript, source contracts, isolated API, build, smoke). The existing source contract was **strengthened** to require the new atomic save/restore functions and typed validation; no historical assertions were disabled.
- Existing behavioral workflow: original REM-00C browser behavior and REM-01A geolocation/country/haptic browser scenarios still run; REM-01B is **appended**, not substituted. Tests use Chromium with synthetic data and mocked Telegram/API; no physical device testing implied.
- New browser QA: valid incomplete step 1; malformed enums, arrays, nulls, nonfinite numbers and duplicate photos; save and page reload with original `File`; quota+transaction abort followed by retry **without photo change**; unchanged legacy files after migration; expired or mismatched old photo/text; malformed v2; archive expired draft; account isolation; no IndexedDB; blocked IDB open; truncated JSON and future timestamps; serialized write A → write B → clear; real React registration UI simulated quota → visible error → manual retry → reload.
- No user content, production Telegram initData, real media, live API, Render, Supabase or deployment touched. All browser tests operate in fresh isolated synthetic contexts.

**Historical CI evidence** for the unchanged required job set: REM-01A final `c4401bd` Foundation 7/7 and Behavioral 2/2, both accepted. REM-01B code HEAD `a75aeb829345ea51e1d5cd46ab1bf643a720e542` confirmed [Foundation 39692474249](https://github.com/zhirayr2505/luemi/actions/runs/39692474249) **7/7 PASS** and [Behavioral 39692474391](https://github.com/zhirayr2505/luemi/actions/runs/39692474391) **2/2 PASS**, including nine direct REM-01B browser transaction scenarios and inherited REM-00C/01A flows. **These older results must not be reused as proof of a newer head**.

## Release gates, limits and risks

- **G0 scope:** REM-01B only. **G1/G2:** mark PASS only after both workflows have actually succeeded on final exact SHA. **G4 physical device:** Samsung Galaxy A55 Android Telegram WebView **NOT VERIFIED**; iOS Safari/Telegram WKWebView **NOT VERIFIED**. Production release is blocked pending device gates and owner acceptance.
- Browser mocks do not prove WebView quota/eviction behavior, actual Telegram bridge timing or retention after OS clear. `localScope` uses **unsigned** Telegram initData exclusively as a device-local partition hint; it is **not** server authentication.
- New photos saved solely under v2 keys survive rollback at the database level but legacy v1 code will not display v2-only content. **Never clear or destructively downgrade** IndexedDB as rollback. A deployment rollback after any real v2 use needs the compatible read path or an explicit non-destructive rescue/export step to restore visibility. The branch is not deployed, so no real migration or user-photo modification has happened.
- A corrupt record is retained and results in visible error, not silently reset; restricted/private browsing may deny local storage. Thirty-day expiry hides records but does not sweep their content in this remediation. Long-term privacy deletion policy remains a future product/security decision.
- This stage does **not** tackle the image decoder memory budget (LU-21, REM-01C) or touch/reorder changes (LU-23). No claims of completed physical tests.

## Rollback

**Before merge/deploy:** close the review-only Draft PR and stop using this branch. Accepted `c4401bd93f07b0ffba865e5f2a42963f60a0a106` remains unchanged. For selective changes, revert scoped REM-01B commits on a review branch rather than resetting `main`/staging or deleting IDB. The original legacy localStorage + original photo DB keys were preserved except following an explicit user-confirmed clear. Keep v2 records for future recovery, including photos added after cutover.

**Rollback triggers:** mismatched original photo IDs/files, false saved status, unrecoverable storage failure after retry, reset resurrecting photos, new crash/render regression or any regression in the accepted CI suite.

**Checkpoint:** finish REM-01B testing and stop for owner approval. Do **not** start REM-01C, merge or production deploy.
