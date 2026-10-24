# LUEMI 💜 — REM-05F Bliki Readiness Verification

**Date:** 2026-10-24
**Accepted immutable REM-05E:** b5b456966e97a9ef76525bf04a679763853cc6b7
**Branch:** remediation/rem-05f-bliki-readiness-20261024
**Draft PR:** see exact number and final head in GitHub PR metadata.
**Gate:** LU-29 = DEFERRED_FEATURE_GATE. Product Bliki NOT implemented or activated. NO production readiness.
**Verdict semantics:** isolated server/client security design may PASS after full same-SHA CI; live backend delivery/storage/permission correctness are NOT VERIFIED.

## 1. Focused source audit and why the gate existed

- apps/web/src/discovery/ProfileModel.ts previously copied activeBlik from a source=server profile when expiresAt was in the future and src began with HTTPS. This is NOT authorization.
- ProfileMaster used view.profile.activeBlik to open a production-imported BlikViewer through avatar action, bypassing missing server permission. BlikViewer assigned src to img/video and used wall-clock RAF updating React state even before image decode/load; it lacked trusted media origin verification, visibility, revoke and lifecycle contracts.
- docs/LUEMI_BLIKI_MASTER_SPEC.md approved the 20 product decisions, but not actual implementation; docs/STAGE03G_BLIKI_FUTURE.md and ROADMAP explicitly defer activation and payments. The accepted repo has no REM-05A ADR file or historical Master TZ, not inferred.

## 2. RED reproduction, immutable GitHub evidence

On the accepted REM-05E parent, tests were introduced without modifying the risky code:
- 115581b028f226aebd3f5c211826169407b66edb: RED-only test commit
- GitHub Actions 40068692232, rem05f-security-contracts FAILED as expected
- RED 2/2 negative assertions FAIL: (a) forged server HTTPS activeBlik enters visitor projection; (b) owner path accepts additional client feature/permission flags. This is actual behavioral code testing, not searching source strings.
- Existing unrelated acceptance is never rewritten; the full failed RED matrix remains visible in GitHub history.

## 3. GREEN changes and architecture

- In ProfileModel.projectProfile, activeBlik always null in every mode/source. No HTTPS, expiry, localStorage/URL/flags/server JSON can enable it. Historical ActiveBlik interface retained only for future design; no bearer capability.
- In ProfileMaster, remove BlikViewer import, blikOpen state, backdrop/modal branch and avatar activation path; preserve original collapsed-avatar reveal and Bliki tab placeholder «Функция готовится». No Media HTML from arbitrary Blik src or hidden prefetch.
- Separate test-only apps/api/secure-tests/rem05f-policy-fixture.ts models future authoritative ACL. It is NEVER registered with live APIs or imported into production app. Runtime-validated records (ID, author, media/version, audience, publication, moderation, expiry, revoke, world consent, permissionRevision) and test-supplied authoritative facts reject missing authentication, block, unmatch, expiry, revoke, moderation, unapproved/world consent, private viewer list, non-entitled comments and improper view events. No URLs, signed leases or viewer identities are returned. A synthetic ALLOW is **not** a production capability.
- New dormant apps/web/src/discovery/bliki-media-lifecycle.ts: generation-aware token and resource disposal, image load/decode separation, video timeupdate progress, buffering, hold, background, error/expired/revoked, single end event, reduced-motion-compatible no-RAF/no-React-update design. This code is NOT mounted as the current viewer.
- New detailed docs/REM_05F_BLIKI_READINESS_ADR_2026-10-24.md covers proposed data/permission matrix, signed links/revocation limitations, private Storage, CSP, privacy, anti-abuse, media budgets, cost and unapproved choices.
- Preserved accepted PhotoViewer, ProfileMaster gesture/motion code (except Bliki source removal), REM-05B/C/D/E security source and SQL migrations.

## 4. Behavior and synthetic security tests

- apps/api/test/rem05f-activation.test.ts: 2 source boundary behavioral tests (RED then GREEN).
- apps/api/secure-tests/rem05f.test.ts: 24 independent behavioral checks of synthetic policy and media lifecycle, including forged permissions, public/matches, block/unmatch, world opt-in, expiry, moderation, view vs prefetch, hold/background/buffering, stale generation, terminal lifecycle, single end, idempotent resource cleanup, server-verified premium and ACL revision.
- Full root check and isolated API unit suite are inherited in Foundation CI.
- Previously accepted REM-05B 8 security tests, REM-05C 9, REM-05D 8, REM-05E 27+5 and Chromium runs must all pass on the exact final head. 50-cycle media regression and existing browser behavior must not be waived.

## 5. Failures and repetitions (never conceal)

- RED negative tests intentionally failed on 115581b0; expected proof, not hidden.
- First implementation candidate 4a303b54100caeb5fa13a6910e33819293d51c34: REM-05F focused workflow failed TypeScript TS2367 (phase narrowing after method call). Corrected in next candidate.
- Second implementation candidate 20955bc70cf1886ca68a445ae28a4efb5a100a80: focused tests passed but inherited lint/build gate failed on new test-only unused import parseSyntheticBlik. Further corrected by exercising real parser validation and extending permission revision check.
- The exact final same-SHA workflows and job conclusions are recorded in Draft PR description once verified. No expected future green result is pre-declared here.

## 6. Security limitations, future stages and verdict

| Topic | Classification |
|---|---|
| Default-OFF, no arbitrary activation or untrusted Blik preload | PASS only after full isolated CI |
| Synthetic future permission / audience / world / block / unmatch / revoke | PASS FOR MODEL ONLY; not real backend |
| Media lifecycle generation, load/decode, hold/background and cleanup | PASS FOR PURE TEST MODEL ONLY |
| Prior PostgreSQL, REM-05E, Chromium, 50-cycle regressions | PASS only after exact-final-SHA evidence |
| Full Bliki user journeys, gesture integration, photo/video decoder in Telegram | BLOCKED / NOT IMPLEMENTED |
| Private Storage, CDN revocation, signed URL policy, real server ACL + RLS | NOT VERIFIED / requires separate authorization |
| World, publication, moderation ops, payments/Premium, retention | BLOCKED / requires separate release and owner decisions |

Zero live Telegram webhook operations, BotFather changes, Render/Supabase/Storage accesses, real secret/PII reads, RLS migration, real story publication, payments, merge or deploy. No work on PR #55.

STOP at independent technical acceptance. LU-29 remains DEFERRED_FEATURE_GATE.
