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


---

## 7. REM-05F independent post-audit: F-A1 / F-A2 / F-A3 (24 October 2026)

**Scope:** dormant media lifecycle and mock-only authorization operations. No real Bliki viewer activation, endpoints, publication or deployment. LU-29 remains DEFERRED_FEATURE_GATE.

**Before-audit accepted SHA:** f1a915d36f51d2f45978e29ca205aa20db38146d.
**RED-only SHA:** f29b85a650c35a1691d3c84d1917532182ecc6a3.
**RED Actions evidence:** https://github.com/zhirayr2505/luemi/actions/runs/40070978609.
**RED:** 26/26 original REM-05F behavioral tests PASS; all 3 additional real-behavior security tests FAIL as expected; zero skipped.

| Case | Verified RED fault | Required GREEN behavior |
| --- | --- | --- |
| F-A1 | endedOnce commits completed video, but late videoReady and videoTime can restart old generation and regress progress | Terminal ended guard; old generation cannot resume, buffer, progress, complete again, react to hold/visibility. begin(new) may play |
| F-A2 | hold/visibility changes can set video playing without videoReady, allow timeupdate and false endedOnce | Per-generation videoReadySignaled needed before playing, buffering and video time; endedOnce requires a previously started playable generation |
| F-A3 | forged unknown runtime operation bypasses TypeScript union and returns ALLOW_SYNTHETIC_ONLY | Explicit runtime allowlist, all unknown values DENY before other policy evaluation |

**Changed implementation modules:** apps/web/src/discovery/bliki-media-lifecycle.ts and apps/api/secure-tests/rem05f-policy-fixture.ts.
**New tests:** apps/api/secure-tests/rem05f.test.ts, preserving 26 existing tests and adding 3 new negatives.
**Real infrastructure:** none touched. Mock-only allow does not provide server authorization, media lease or URL.

**Final exact SHA, job matrix and any historical failures:** maintained in the description of existing Draft PR #56 and verified against GitHub workflows on both push and pull_request after this report is committed. No assertion of full CI PASS is made in advance; the historical RED run remains failed and accessible.

**Remaining status:** isolated mock-only guard/method behavior eligible for PASS after actual CI; future real viewer integration PARTIAL; live Bliki backend, Storage, media/CDN revocation, World and Premium BLOCKED / NOT VERIFIED. LU-29 DEFERRED_FEATURE_GATE.


### F-A1 terminal media resource finalization (supplemental audit)

The prior accepted F-A1 fix prevented late callbacks from restarting ended playback but
did not flush resources owned by that generation. Because live() already rejects ended
generations, a subsequent revoked() also cannot flush those resources. A dormant
BlikMediaSession could thus retain decoder/listener cleanup registrations until a
future begin() or unmount. This is a narrow F-A1 lifecycle hardening, not
publication of the Blik viewer.

- New RED test covers image and video: own() registers two resources, valid playback
  ends, and the test requires immediate exactly-once release, no pending resource
  owners, no ended replay, and correct fresh-generation teardown.
- RED-only SHA: c267924bff7a51d34a698ef04cecbc31aa464c5c.
- GREEN changes only endedOnce: after fixing final progress at 100% and marking
  terminal ended, zeroes lastClockMs and invokes the existing idempotent release()
  implementation. Calling cleanup later must not double-release.
- Real media DOM, actual decoded memory, server ACL, permissions and production
  endpoint behavior remain NOT VERIFIED; this is an isolated resource-owner
  model test. LU-29 remains DEFERRED_FEATURE_GATE.
- Precise final-head push/PR GitHub CI, RED failure and verification links are
  recorded in the existing Draft PR #56 description after all workflows complete.
