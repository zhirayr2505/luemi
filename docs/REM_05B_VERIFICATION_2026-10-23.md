# LUEMI 💜 — REM-05B Identity / Sessions Verification

**Date:** 2026-10-23 · **Engineering stage:** REM-05B only · **GitHub:** zhirayr2505/luemi
**Owner-accepted immutable base:** bc994acfb815d4712431fad5c13070793d361af6
**Working branch:** remediation/rem-05b-telegram-identity-sessions-20261023
**Draft PR:** https://github.com/zhirayr2505/luemi/pull/52 (OPEN / DRAFT / UNMERGED)
**Release gate:** CLOSED. No production/deploy approval; no REM-05C start.

## 1. Executive outcome and evidence standard

REM-05A was accepted as a design foundation, not a deployed backend. This commit range implements a feature-gated first slice: bot-signed Telegram identity, server UUID actors, PostgreSQL-backed short opaque sessions, hash-only token persistence, rotation, revocation, strict same-origin cookie/CSRF, a server-owned self identity read, and real-role disposable PostgreSQL checks. The old /api/auth/telegram path remains callable in the unchanged legacy mode; local IndexedDB v2 and photo handling are unaffected. All publication/payment/interaction/media/moderation/charged geo functions remain off.

Security boundary is proven only for newly created actor/session and /api/v2/me routes under disposable PostgreSQL. This does not establish complete LU-28, full resource privacy, Supabase Data API/Storage access policies or G6. Current GitHub remains intentionally PUBLIC by explicit owner decision; no secrets or live user fixtures belong in repository, PR or Actions.

## 2. Code, schemas, flags

| Component | Exact change |
|---|---|
| apps/api/src/telegram-auth.ts | Existing Telegram WebAppData HMAC preserved; UTF-8 byte-size 8192 limit; deterministic key order; strict duplicate/hash/date bounds. |
| infra/migrations/0002_rem05b_identity_sessions.sql | Additive private actor/session schema; UUID and (bot namespace, telegram ID) uniqueness; opaque token keyed hash only; issuer vs request grants; ENABLE + FORCE RLS; anon/authenticated denied; no existing tables touched. |
| apps/api/src/rem05b-session.ts | DB-backed issuer and limited request pools; actual current role checks; transaction-local actor context for /me; cookie, CSRF, expiry, refresh, logout and logout-all. |
| apps/api/src/app.ts + config.ts | V2 API mounts only with REM05B_SESSIONS_ENABLED=1. No alteration of live Render config. |
| apps/web/src/auth/session-adapter.ts + App.tsx | VITE_LUEMI_AUTH_V2=1 selects versioned auth; confirms session with a follow-up same-origin GET; blocked cookie fails closed; no bearer fallback or storage. Default v1 behavior preserved. |
| packages/contracts/src/index.ts | New SessionV2 contracts and error types; existing bootstrap shape retained. |
| apps/api/secure-tests/rem05b.test.ts | Synthetic signed A/B actors, disposable real PostgreSQL and RLS tests; invalid credentials, concurrency, CSRF, token rotation, session lifecycle, namespace and admin-misuse negative controls. |
| scripts/rem-05b-browser.mjs | Same-origin Chromium mock startup and blocked-cookie path; no persistent-session fallback; IDB deletion guard. |
| .github/workflows/rem05b-focused.yml | Docker PostgreSQL 16 disposable roles and negative suite plus independent Chromium preservation, no real secrets. |
| scripts/rem-05b-public-diff-scan.mjs | New-diff secret-pattern gate, emitting categories/counts, not raw matching values. |

### 2.1 Provisional non-production policy

- Raw Telegram signed initData is verified once per bootstrap using configured bot token; auth_date max 3600 seconds and future skew 60 seconds. Replay within this window is NOT cryptographically prevented; admission limits only reduce damage.
- Token uses CSPRNG randomBytes(32), base64url; PostgreSQL stores HMAC-SHA-256 keyed by runtime session pepper, never token. A separate externally managed pepper is required to enable v2; no actual pepper was introduced.
- REM-05A provisional values implemented: 12-hour idle, 7-day absolute expiry, maximum 5 active sessions per actor. NOT ratified for real people; more policy review is needed before activation.
- __Host-luemi_sid cookie has Path=/, Secure, HttpOnly and SameSite=Lax with no Domain, only for same-origin HTTPS candidate. Strict Origin and anti-CSRF on unsafe methods, plus a current session. Third-party cookie compatibility is not assumed; in-memory Bearer fallback remains disabled.
- Every scoped user read runs as request PostgreSQL role with NOBYPASSRLS/NOSUPERUSER; transaction-local luemi.actor_id is set after verified session and never obtained from body/query/Header. Database issuer cannot be used as request role.
- No SSR, template refresh, publish, sync, media, geo charge, report, moderation, matches, chats, Bliki, Stars or premium entitlement activated.

### 2.2 Role and RLS invariant

luemi_private is excluded from application public APIs in the intended architecture, but real Supabase exposed-schema settings are NOT VERIFIED. The migration refuses to grant anon/authenticated access. Isolated role grants are deliberately narrow. Authentication uses a separate issuer role, and user-facing /api/v2/me uses a request role under BEGIN → set_config(..., true) → parameterized SELECT → COMMIT/ROLLBACK. Auth issuer checks do not substitute for request RLS. A privileged table owner/superuser connection fails runtime role guard instead of silently bypassing RLS.

## 3. Threat and negative test ledger

| Test cluster | Observed / expected proof | Boundary |
|---|---|---|
| SEC-A01–A04 | Signed/HMAC, tampering, stale/future, malformed duplicates, Unicode, >32-bit Telegram IDs, repeated UUID, changed Telegram display name. | Real Fastify injection and disposable DB; synthetic bot token. |
| SEC-A05–A07 | Client-supplied identity headers ignored, signed initData replay demonstrated as residual risk, banned/suspended/deleted cannot silently regenerate active identity. | Session and mapping only; no general user profile entitlement. |
| SEC-A08–A10 | Server idle/absolute expiry, refresh race, logout, logout-all, revocation; CSRF + Origin gate; blocked third-party cookie aborts v2 authorization. | Chromium is a mock, not Telegram native/Web physical test. |
| SEC-A11–A15 | Distinct bot environments/A-B, no session material in persistent client storage; protected anonymous denied; DB down fail-closed; immediate revocation observable across requests. | Raw log/secret scan bounded to new public diff; no historical secret-exposure proof. |
| SEC-D01, D05–D11 | Real non-bypass request role: self-only read, cross-owner deny, missing GUC deny, actor reuse after rollback deny, anon/authenticated no grants, privileged role misuse denied. | Disposable PostgreSQL 16, NOT actual Supabase/PostgREST/Storage. |
| Browser preservation | Existing REM00C/REM02D/03A/03C/03D/04B/04D behavioral DOM scenarios. | Chromium Ubuntu runner, NOT Galaxy A55/iOS. |

Acceptance evidence must use exact final SHA and inspect completed jobs/steps, not a green badge alone. If any job is queued/pending/failure it is not PASS. FINAL EXACT-SHA RUN MATRIX WILL BE RECORDED BELOW.

## 4. CI evidence: verified cumulative implementation SHA

**Fully CI-verified implementation SHA:** dfdf011a8070d1a1bd726240e020098787f8a276. This commit includes all executable code, SQL, package-lock, browser and security tests. The next documentation-only verification commit will change the PR HEAD; its exact resulting SHA and same-SHA CI should be read in the PR #52 description / GitHub checks. A Markdown file cannot embed its own future Git commit SHA.

| Gate | Push exact-SHA run | PR exact-SHA run | Verified status |
|---|---|---|---|
| Foundation (7 jobs/event: lint-hooks, type-contracts, source-marker-contracts, api-isolated, build, local-smoke, ci-infrastructure) | https://github.com/zhirayr2505/luemi/actions/runs/39951629834 | https://github.com/zhirayr2505/luemi/actions/runs/39951637052 | 14/14 jobs completed SUCCESS |
| Full REM-00C Behavioral (2 jobs/event, real Chromium) | https://github.com/zhirayr2505/luemi/actions/runs/39951629833 | https://github.com/zhirayr2505/luemi/actions/runs/39951637300 | 4/4 jobs completed SUCCESS |
| REM-05B Focused (PostgreSQL security, browser preservation, 50-cycle accepted comparison; 3 jobs/event) | https://github.com/zhirayr2505/luemi/actions/runs/39951630147 | https://github.com/zhirayr2505/luemi/actions/runs/39951637056 | 6/6 jobs completed SUCCESS |
| Public diff scan | Inside REM-05B security push job | Inside REM-05B security PR job | Zero matching violations; raw values never displayed |

**Total:** 6/6 workflows, 24/24 jobs completed SUCCESS on dfdf011a... . PostgreSQL 16 actual-role integration recorded 5/5 test groups PASS, 0 failed, 0 skipped. Chromium contained REM05B_V2_MOCK_STARTUP_PASS and REM05B_COOKIE_BLOCKED_FAIL_CLOSED_PASS, accepted viewer/blur/modal behavior and A/B-compatible login. The 50-cycle job compared immutable accepted REM-04C SHA 5ea0a1f851e2518f6f23b17e7287ae536bb06395 against the REM-05B candidate in the same Chromium runner; its synthetic output artifact is https://github.com/zhirayr2505/luemi/actions/runs/39951637056 (artifact rem05b-50-cycle-synthetic). These instrumented desktop traces do not establish physical Galaxy A55 GPU/tile residency or iOS native compatibility.

**Baseline warning:** The pre-existing react-hooks/exhaustive-deps warning in GlobalHeader.tsx remains 1 warning; no new warning was introduced or suppressed. Historical intermediate commits had temporary CI failures due to an occupied Vite port, clock-dependent negative test and a legitimate issuer-column permission guard. The fixes maintained strict checks and minimal database grants rather than skipping assertions. Green intermediate builds alone are not evidence for the final head; final HEAD revalidation is required.

## 5. Rollback without destructive data change

Disable REM05B_SESSIONS_ENABLED in a separately authorized environment, restore the preceding accepted application code, and retain actor/session rows and migration files for compatibility and later authorized cleanup. Keep VITE_LUEMI_AUTH_V2 unset; old bootstrap/demo and IndexedDB v2 drafts remain unchanged. The feature is already off everywhere by default; no existing Supabase or Render instance has been modified. Never DROP a table, DELETE local drafts or roll a compromised secret backward to make tests green.

## 6. Explicitly blocked or out of scope

- G6 real-user readiness: BLOCKED pending REM-05C–05F, Supabase effective-role and PostgREST exposure verification, private storage/media and moderation architecture implementation, legal/policy decisions and separate approval.
- Real Telegram native Android/iOS, Web iframe third-party cookie and device startup/switch/revoke behavior: NOT VERIFIED, not inferable from Chromium.
- Real Supabase PostgREST/Data API grants and Storage policies: NOT VERIFIED; no live project queries or configuration changes permitted.
- Current webhook secret generation/rotation and incident status: NOT VERIFIED; REM-05E only, no change.
- Existing repository PUBLIC is deliberate: no repository visibility changes. Historical copies and historical potential secret exposure need separate incident inventory with no secret dumping.
- REM-05C geo authorization/quota/header policy, REM-05D draft/media/moderation/RLS, REM-05E webhook rotation, REM-05F Bliki: NOT STARTED.

## 7. End-of-stage owner checkpoint

Maintain PR #52 as OPEN / DRAFT / UNMERGED; report exact HEAD and CI job evidence. Await explicit independent owner technical acceptance. Do NOT perform merge, deploy, live database migrations, secret manipulation or REM-05C in this stage.
