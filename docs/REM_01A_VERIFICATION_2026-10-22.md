# LUEMI 💜 — REM-01A · canonical country / geolocation lifecycle / optional haptic

**Date:** 2026-10-22. **Approved scope:** REM-01A (LU-17, LU-18, LU-37), per `LUEMI_MASTER_REMEDIATION_TZ_2026-10-21.md`. **Status:** source changes and bounded automated checks VERIFIED; **OWNER ACCEPTANCE PENDING**. REM-01B and later stages are NOT AUTHORIZED.

## 1. Verified boundary and ancestry

- Private/public visibility is not altered in this remediation.
- Isolated branch: `remediation/rem-01a-geo-haptic-20261022`.
- Branch starts from **exact** accepted REM-00C `4956318322e43b2d43c50682e23936fffc5c24e8`, preserving accepted REM-00B `56cef7fd46be4d487a52f35a2b0b825a4d53002d` and REM-00A `fe33760ef426d75747f889cda8ec8f6e825df227`.
- Baseline main `072bc425e4f487d15a5260f0ac978a2059b50e34`; staging `62470ddd143a94a9f987c0aa1c7193656a29df15`.
- Only the REM-01A country/geolocation/haptic domain, its necessary build/test harness, isolated QA fixtures, and this document were changed. No intentional UI layout/CSS/brand/media changes; no photo sorting algorithm, profile/fullscreen gestures, or normal-speed Deck animation rewrite. The **intentional behavior corrections** are canonical country comparisons, cancellation of stale geo responses, optional haptic isolation, and completion under reduced motion.
- No Render dashboard, Supabase, user data, production credentials, deployment, pull-request merge or main/staging branch update.
- The existing **five** pre-existing React Hooks exhaustive-deps warning fingerprints remain in `qa/react-hooks-baseline.json`; only PhotoSorter line number adjusted for added haptic import. All unknown diagnostics remain fail-closed.

## 2. LU-17 · canonical ISO alpha-2 country

- Added one pure `normalizeCountryCode(value: unknown): string | null` to shared `@luemi/contracts`: trims strings, rejects non-ASCII/non-alpha-2 and unknown/empty/null input, uppercases known-format two ASCII letters. It does **not** infer a country from a city or default invalid values to RU. Note: format-valid codes such as ZZ do not prove a country exists; the Flag component still uses its bounded hosted-asset set and falls back to neutral globe when an asset is absent.
- API Geoapify search and reverse mapping now normalize through that function. Fixed normalizer does not change country/city names, IDs or search scope.
- Registration selection validation reads canonical input without lowering it. Legacy local-draft **read** normalizes `countryCode` only; it does not migrate/purge/modify localStorage or touch photos. Full record lifecycle and schema validation belong to REM-01B and are deliberately not claimed.
- Existing Feed and ForYou fixtures retain their people/portraits/content but adapt lowercase source codes to uppercase. Feed country scope, ForYou 'nearby' and 'international', Nearby same city/country, `fromLocalDraft` and public profile projection all share canonical comparisons.
- Flag filenames remain lowercase in `/assets/flags/` — the only lowercase adapter. Unsupported country asset yields the pre-existing globe fallback, not a misleading unrelated flag.
- Domain tests cover RU/ru/whitespace/AM/null/empty/three-character codes/non-ASCII case expansion, registration step 3, same-country Feed/ForYou/Nearby, exclusion of home-country from international rail, and legacy draft restoration without changing city/placeId/scope.

## 3. LU-18 · search, GPS, reverse and manual choice lifecycle

- `apps/web/src/registration/geo-operation.ts` owns one generation token and AbortController for in-flight search/reverse; stale cleanup cannot cancel the newer request.
- `GeoPicker` handles idle/searching/locating/resolving/success/error/cancelled states. Search debounce 250 ms; short/empty query removes stale results/spinners. Malformed response shows an error instead of rendering unverifiable suggestions.
- Manual mode/change/choice invalidates prior work; final location is patched only from a current, checked place response and canonical code. **On search error previous chosen city remains intact** until user successfully chooses a replacement.
- Unabortable browser GPS callback is guarded by generation and mount lifecycle. GPS no-callback deadline 11,000 ms, independent reverse deadline 6,500 ms and AbortController. Timeout aborts/invalidates and re-enables manual choice. Stale resolved GPS/reverse after choice, timeout or unmount cannot patch parent.
- React StrictMode mount cleanup/restore handled without reactivating invalidated requests. No precise coordinates persisted to draft or exposed as a user profile.
- Browser QA on actual React GeoPicker includes B-before-A search responses, corrupted provider JSON, query shortened while outstanding, late GPS after manual, reverse after manual, geolocation denial, reverse timeout, no-GPS-callback timeout, callback after timeout, and GPS after component unmount. All external geocoder/GPS calls are **mocked locally in Chromium**, with *no production traffic*. A55 Telegram keyboard and permissions remain NOT VERIFIED.

## 4. LU-37 · optional haptic must never control transaction

- New `apps/web/src/ui/haptic.ts` wraps **only** Telegram's optional `HapticFeedback.selectionChanged` in a best-effort try/catch. Does not swallow or rewrite application errors; logs no sensitive bridge data.
- Deck first sets lock/leaving state, registers the exactly-once pending state commit and 440 ms fallback, and only then invokes safe haptic. Existing animationend path and fallback share single `finishDeck` that removes pending commit before invoking it. Reduced-motion triggers immediate completion without waiting on absent CSS animation; normal animation timing and card/control synchronization remain unchanged.
- All previous optional haptic call sites in DiscoveryApp are guarded (save, tabs, bookmark), as is PhotoSorter after drag claim.
- Browser QA uses a real React deck with throwing Telegram bridge, absent bridge, animationend + timeout, back during pending action, reduced-motion, then second action. Asserts the deck advances exactly once to the third profile (not double-commit) and no page JS exceptions. PhotoSorter is exercised via actual drag/reorder with throwing haptic; picture order truly changes. Negative/unit assertions confirm absent and throwing bridge never interrupt app.
- This is a **POSSIBLE RISK** fixed defensively per the audit; no claim is made that a real supported Telegram version was observed throwing.

## 5. Concrete CI evidence before documentation-only commit

**Code head tested:** `14ea9388be97da1c2beef37560d03460ec6f6ea1`.

- [Foundation push 39689767519](https://github.com/zhirayr2505/luemi/actions/runs/39689767519): **SUCCESS, 7/7 real hosted runner jobs** — `ci-infrastructure`, `lint-hooks`, `type-contracts`, `source-marker-contracts`, `api-isolated`, `build`, `local-smoke`.
- [Visual and behavioral push 39689767508](https://github.com/zhirayr2505/luemi/actions/runs/39689767508): **SUCCESS, 2/2 real hosted runner jobs** — original REM-00C Foundation checks and browser QA plus **mandatory new REM-01A browser suite**. No test skipped, no false success from `continue-on-error`. The browser CI explicitly builds shared contracts before Vite so runtime code sees the exact same implementation as server/domain tests.
- [Visual evidence artifact 12387812351](https://github.com/zhirayr2505/luemi/actions/runs/39689767508/artifacts/12387812351): 2,706,912 compressed bytes, contains established REM-00C screenshots, five additional REM-01A PNG endpoint artifacts and local server log. Per-image SHA-256 and viewport are printed in job logs.
- Observed REM-01A pass markers:
  `REM01A_LEGACY_RESTORE_AND_FLAG_PASS`,
  `REM01A_GEO_RACES_PASS` (6 named races),
  `REM01A_GEO_DENIAL_RECOVERY_PASS`,
  `REM01A_GEO_REVERSE_TIMEOUT_PASS`,
  `REM01A_GEO_NEVER_CALLBACK_TIMEOUT_PASS`,
  `REM01A_DECK_HAPTIC_PASS` (throwing bridge, missing bridge, reduced motion),
  `REM01A_SORTER_HAPTIC_PASS`.
- Established REM-00C markers also PASS: `REM00C_PROFILE_BEHAVIOR_PASS`, `REM00C_STANDARD_DOM_REDUCED_MOTION_PASS`, `REM00C_APP_BOOTSTRAP_MOCK_PASS`, `REM00C_NEGATIVE_SELECTOR_FAIL_CLOSED_PASS`. No observed uncaught page exceptions in tested browser contexts.
- One REM-01A screenshot example: `sorter-haptic-throw-reordered`, SHA-256 `4058a9c6c79d5c0425e0f5bb59af2d5c6ead6e129e4c9ac88d1fddf037d3fa0e`, 393×852.

## 6. Limitations and distinct later tasks

- **Samsung Galaxy A55 inside Telegram — NOT VERIFIED** (permission denial, keyboard, leave/return geo step, long session); owner hardware session required.
- **Native iOS Safari / Telegram WebView — NOT VERIFIED**; Chromium phone-UA emulation is not WebKit.
- Real Telegram bridge method throwing is not reproduced on physical Telegram; tests use explicitly injected throwing mock.
- A real Geoapify provider, real permissions and server quota are not tested; external network/service access was deliberately excluded.
- REM-01B **storage saved/failed UI result**, REM-01B **schema/TTL/IDB migration** are not altered or claimed. No user-data migration or reset, and no other remediation stage entered.
- The work changes corrected filtering and stale-operation outcomes by design; it does not change approved static visual design or normal swipe/animation appearance. Device QA for interactions is separately required before any release.
- Public repository visibility may be a separate security exposure: full historic secret scan was **not completed** in earlier sessions. This stage does not approve public exposure.

## 7. Safe rollback, checkpoint, owner release gate

1. REM-01A is proposed in an isolated branch based on accepted REM-00C `4956318322e43b2d43c50682e23936fffc5c24e8`.
2. **Do not merge.** Close the REM-01A Draft PR without merging to decline the changes. Accepted REM-00A/B/C branch heads remain unchanged. For a partial rollback, revert only the scoped REM-01A commit(s) on a review branch — no force push, no remote resets, no user data migration.
3. Verify final documentation commit on CI push + PR against its exact SHA; avoid treating older green status as proof of an untested head.
4. REM-01A checkpoint requires explicit owner acceptance. **Do not begin REM-01B** without separate authorization and do not deploy/merge to main without separate approval.
