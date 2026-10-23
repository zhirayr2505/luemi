# LUEMI 💜 — REM-05D Private Profiles, Media, RLS and Moderation Verification

**Date:** 2026-10-23  
**Accepted immutable REM-05C parent:** `fb609a9d8ee5023a66f2990d4f9adb247fbd6dd7`  
**Branch:** `remediation/rem-05d-private-media-rls-moderation-20261023`  
**Draft PR:** https://github.com/zhirayr2505/luemi/pull/54 — OPEN / DRAFT / UNMERGED, base REM-05C branch.  
**Final tested SHA:** see exact head and completed GitHub Actions matrix in the PR; this report is itself part of the final candidate and must not predeclare its own self-referential commit hash.
**Gate:** **PARTIAL / NOT PRODUCTION READY**. New server features OFF in all existing deployments. No merge, deploy, live migration or real Storage access.

## 1. What is implemented — and what is not

Added `infra/migrations/0004_rem05d_private_media_moderation.sql` after accepted `0002`/`0003`; `apps/api/src/rem05d-private.ts` guarded versioned routes and transaction-bound role verification; `rem05d-image.ts` bounded PNG decode/re-encode; `apps/api/secure-tests/rem05d.test.ts` executable PostgreSQL 16 negative tests; `rem05d-focused.yml` new two-job isolated/server and preservation suite. `app.ts` and `config.ts` wire tests only; previous 05B/C Actions triggers now include the 05D branch and PR base.

- **Private drafts:** server UUID authenticated via REM-05B opaque cookie, verified Origin+CSRF for PUT, strict field allowlist, 8 KB DB check, 7 KB application payload bound, revision/CAS including concurrent 409 and no remote update for another actor. Source of authority is REM-05B verified `authActor`, NEVER `ownerId`, `X-Actor-Id` or client-local unsigned Telegram scope.
- **Publication:** independent `public_profiles` schema projection has `CHECK(publication_status='draft')` and `CHECK(published_revision=0)`; no public SELECT policy, public GET 404, submit 403. Approved media is still private. No future Stage04/Bliki/chat/payments changes.
- **Media:** per-actor SQL transaction advisory lock + 6-slot cap for all non-revoked assets, server UUID and random opaque internal path, one-hour synthetic intent expiry, digest-bound idempotency; a bounded proxy ingestion path enforces exact expected byte count, PNG signature/chunks/CRC, pixel count <=4,000,000, side <=2048, input/derivative <=1 MiB. A native 50MP header is rejected before allocation. Supported test format is **PNG RGB/RGBA 8-bit, non-interlaced only**; JPEG, HEIC, AVIF, video and unknown critical chunks FAIL CLOSED. The decode/re-encode drops EXIF/XMP/ICC and ancillary fields rather than accepting byte headers as safety proof. A reliable cross-format production scanner, worker sandbox and malware analysis **are NOT implemented**.
- **Storage:** a **process-local, private in-memory adapter (MOCK)** is explicitly passed by test-only config; no Supabase SDK, bucket, signed URL or service key is touched. Object bytes never returned by intent/preview DTO. Image upload results in `pending_review`; derivative GET only after a separate synthetic moderator decision, and only for current owner/session at each GET; `private,no-store` and MIME-safe headers. Storage is non-durable by design: a restart fails closed with `media_unavailable`, not false success.
- **Moderation:** separate role-backed, non-HTTP `syntheticModerate` helper only in isolated QA, append-only decision + minimal audit, state `pending_review -> approved/rejected`; no automatic moderation approval, remote staff/operator login, scanner integration, appeals or public moderation dashboard. Reports have reason allowlist, RLS isolation and client-key dedup; blocks have structural same-environment FK and own-only RLS. No public discovery is enabled, so real two-way visibility of public media remains **NOT TESTED**.
- **Safety:** DOB field is optional for partial draft but invalid dates / reported age <18 and unknown consent version are rejected when submitted. This is **self-declared age**, not age verification; exact local/legal policy, consent language, retention and automated child-protection procedures remain OWNER DECISION REQUIRED.

### Internal dataflow / trust boundary

```mermaid
flowchart LR
  W[Untrusted WebView] -->|signed login| B[REM05B session cookie]
  B -->|Origin/CSRF| F[Fastify REM05D feature gate]
  F -->|checked actor, BEGIN, SET LOCAL| R[Request login + FORCE RLS]
  R --> D[Private draft and intent]
  F -->|isolated role| P[Worker-bound PNG sanitizer]
  P --> O[Private in-memory object adapter]
  P --> Q[Pending moderation queue]
  M[Non-HTTP synthetic moderator login] --> Q
  Q -->|independent decision| A[Approved but unpublished]
  F -->|new session + owner RLS each GET| O
  A -. public visitor NOT AVAILABLE .-> X[Public API permanently DENIED]
```

The session issuer never becomes the request role. Worker and moderator must have separate login-role memberships, no inherited request/issuer/geo powers and no BYPASSRLS. A custom GUC is trusted only because server code sets it from REM-05B session on a checked-out transaction; it is **not** cryptographic authentication if SQL/Data API is exposed to arbitrary clients.

## 2. Schema/roles, field-level privacy and deployment scope

`private_profile_drafts`: owner UUID + bot namespace composite FK, revision, bounded typed JSON, private DOB/consent; `public_profiles`: allowlisted fields but hard-draft-only; `media_assets`: server key, opaque asset UUID, private state/version/position/content digest/dimensions; `media_uploads`: actor, asset, size, MIME, expiry, idempotency digest; `moderation_jobs`/append-only `moderation_decisions`; actor-local `blocks`, `reports`, append-only `audit_events`.

All nine tenant-bearing additions have `ENABLE` **and** `FORCE ROW LEVEL SECURITY`. Request-role policies bind both `luemi.actor_id` and `luemi.environment` via transaction-local GUC, with `USING`/`WITH CHECK`. Permissions on owner/moderation/status columns are narrower than table-level RLS. No public RPC / SECURITY DEFINER / public Storage URL is introduced. `anon`, `authenticated`, and PUBLIC lose all new-table permissions. No private schema is added to any PostgREST exposed-schema config. **The actual Supabase Data API exposed-schema setting is not verified.**

The current request login may read its own private media internal path under DB RLS for the trusted gateway; no such key enters an HTTP JSON response, Storage public URL or browser cache. Restricted reviewer gets metadata but not `original_key`/`derivative_key`. The worker may process/upload but cannot inspect private drafts or sessions. Deployment must use distinct vault-managed credentials and non-public buckets; **no such resources have been provisioned**.

### Synthetic `/api/v2` contracts

| HTTP | Purpose | Security/result |
|---|---|---|
| GET /profile/draft | owner-only current version | `{state:'empty',revision:0,fields:{}}` or private fields |
| PUT /profile/draft | allowlisted replace + revision CAS | 200 + revision, stale 409, invalid 422, bad auth 401/403 |
| GET /profile/preview | owner-only safe projection and media status | no DOB, storage paths or entitlements |
| GET /profile/public/:id | real account public projection | ALWAYS 404 in REM-05D |
| POST /profile/submit | synthetic/publication control | ALWAYS 403 `publication_disabled` |
| POST /media/intents | serialized 6-slot reservation, retry digest | opaque asset ID only; conflicts 409 |
| PUT /media/:id/bytes | exact intent + sanitized PNG into private test storage | pending_review only, 422 invalid, 404 foreign |
| GET /media/:id | re-authorized owner approved clean bytes | 200 image/png private no-store; 404 hidden/pending/revoked |
| GET/POST/DELETE /profile/blocks | own blocks | no cross-owner row read |
| GET/POST /profile/reports | own reports and deduplicated opaque case | no foreign evidence |

A 503 denotes offline/missing limited DB or private storage, not a fabricated remote save. No `public_publish=true`, signed URLs, service-role fallback or real user onboarding.

## 3. Test catalog — evidence-based status

The focused job executes real isolated PostgreSQL 16 with multiple actual LOGIN roles, signed synthetic Telegram identities, Fastify injection, real SQL/physical constraint enforcement and a private **mock** object adapter. It is NOT live Supabase/PostgREST or Android QA. Granularity below is more conservative than an aggregate green test.

| Test | Status | Executed/proof and missing boundary |
|---|---|---|
| D01 | PASS | owner A + B isolation and 401 tested; forged X-Actor-Id/role header ignored; strict Origin/CSRF rejected |
| D02 | PASS | simultaneous revision=1 PUT, exactly one 200 and one 409 |
| D03 | PARTIAL | SQL non-owner owner reassignment denied; B-owner INSERT separately not tested |
| D04 | PARTIAL | actual anonymous role and default-deny tested; PostgREST HTTP unavailable |
| D05 | PARTIAL | effective role, FORCE RLS and unexpected session/audit grants tested; comprehensive per-column escalation matrix outstanding |
| D06 | PARTIAL | A/B, missing GUC and rollback deny executed; adversarial fault in multi-instance pool outstanding |
| D07 | PARTIAL | mixed NOINHERIT worker/request login is denied; transitive moderator combinations outstanding |
| D08 | PARTIAL | owner projection and raw keys kept out of HTTP; comprehensive structured log audit outstanding |
| D09 | PARTIAL | revoked sessions block private APIs; some expired/suspended paths inherited from 05B |
| D10 | PARTIAL | invalid draft/unknown fields/date/consent tested; exact 18th birthday boundary not tested |
| D11 | PARTIAL | namespace composite FK exists; two-bot concurrent REM-05D access matrix outstanding |
| D12 | PASS | publication HTTP denied and DB CHECK prevents publishing |
| M01 | PASS | verified owner intent, foreign upload 404 and anonymous auth |
| M02 | PASS | 50 concurrent intents capped at 6 under one real DB role, no seventh admission |
| M03 | PASS | same idempotency digest same asset; changed body 409 |
| M04 | PARTIAL | unpredictable key kept from DTO; traversal/encoded path injection not independently tested |
| M05 | PARTIAL | bad PNG/magic/truncated/trailing bytes; broader polyglot MIME matrix not completed |
| M06 | PARTIAL | synthetic correct-CRC 50MP header refused before allocation; CPU timeout/decoder isolation outstanding |
| M07 | PARTIAL | GPS EXIF synthetic string stripped by decode/re-encode; actual orientation/ICC handling unavailable |
| M08 | BLOCKED | no crash-restart, interrupted byte streaming/resume or durable cleanup proof |
| M09 | PARTIAL | worker/moderator cannot read private draft/session; broad operator role review outstanding |
| M10 | PARTIAL | private MOCK denies B/anonymous; real Storage.objects and PostgREST unavailable |
| M11 | PARTIAL | revoke next request 404; block and public media race cannot be verified while public OFF |
| M12 | PASS | pending review inaccessible, approved remains unpublished |
| MOD01 | PARTIAL | pending default and no automated approval; real scanner outage untested |
| MOD02 | PARTIAL | only DB moderator helper can approve; no staff principal live authentication |
| MOD03 | PASS | approved synthetic asset still has hard-private/public 404 |
| MOD04 | PARTIAL | owner block, no self-block, self-list only; public mutual visibility off |
| MOD05 | PASS | idempotent duplicate reports, no foreign case access |
| MOD06 | BLOCKED | report appeals and append-only appeal trail not implemented |
| MOD07 | PARTIAL | under-18 and invalid-date self-declaration refused, formal age verification absent |
| MOD08 | PARTIAL | consent mismatch rejects, publication denied; legal consent sign-off absent |

**NOT VERIFIED/BLOCKED:** real Supabase Data API, Storage `storage.objects` RLS, actual live PostgreSQL effective grants, persistent object store, malware/media-worker sandbox, true user-moderator authority, Android Galaxy A55, iOS/WKWebView, Telegram Web cookies, real 50MP photo UX, public discovery, verified age, consent/privacy/retention signoff, webhook secret rotation (REM-05E), G4/G6.

## 4. Regression, immutability and evidence

- Root Foundation, REM-00C browser, REM-05B DB/Chromium and REM-05C DB/HTTP/CSP workflows are preserved. The REM-05D branch adjusts only their trigger lists for cumulative **same-head** execution; no security assertions removed.
- `apps/web/src` and `apps/web/src/registration/local-draft.ts`, accepted IndexedDB v2 records, photo Blob processing and registration UX have **no REM-05D source edits**. No automatic local sync, no user photo import, no client public visibility. Earlier 8-step/50-cycle/profile/photo/gesture/scroll suites are re-run by the preservation jobs. Evidence in Chromium is not physical GPU proof.
- No `node_modules` installed in operator's isolated checkout due GitHub DNS restriction. Fresh executable results come only from actual GitHub runners and their publicly verifiable steps; do not imply local fresh test from operator's shell.
- The public diff is scanned for recognizable credential patterns by existing `rem-05b-public-diff-scan.mjs`; scanner is not a complete historical secret audit. No real secrets or personal media committed. Existing repo deliberately PUBLIC.
- CI PASS counts and exact final SHA: authoritative records are linked in **PR #54** after final run. Historical failures on preceding SHA are not final-green evidence; check both push and PR heads and per-job logs.

## 5. Isolation, retention, failure handling and cost

No real data has been read, written, copied, deleted, published or charged. Accepted REM-00A–05C sources remain ancestral; Render, real Supabase roles/buckets/storage, bot, webhook and all existing credentials untouched. Rollback is code/flag-only: set `REM05D_PRIVATE_ENABLED=0` (already OFF), never apply a destructive DOWN, preserve drafts/assets in isolated test schema until agreed disposal. Test adapter disappears on process restart and consequently fails closed; do not confuse it with production durability.

**Policy proposals requiring separate owner/legal approval (NOT RATIFIED):** intent expiry 1h test-only; retain abandoned temp uploads for bounded cleanup after independently agreed window; approve retention/erasure and abuse-evidence hold timelines; select production MIME/size/MP limits (client currently uses a distinct 12MiB/32MP guard), malware scanner and sandbox, private Storage tenant strategy, safe HEIC/JPEG orientation handling, moderation staffing/appeals/2-person escalation, jurisdiction-dependent consent and age policy, session-cookie support on Telegram native/Web. No egress/performance cost forecast claimed without measurements.

**Future isolated rollout DRY-RUN only:** provision a separate environment and individually isolated bot/DB/test bucket under new owner approval → verify non-bypass LOGIN roles, all RLS grants, exposed-schema Data API denial and private `storage.objects` negative controls → choose persistent object adapter and fully bounded decoder/scanner → re-run all D/M/MOD negatives and physical Telegram device QA → independently authorize deployment and publication. No step above has been carried out in live services.

## 6. Acceptance recommendation / STOP

**REM-05D has a demonstrable, non-production private-data slice, but is PARTIAL vs the full requested security catalog.** The isolated disposable PostgreSQL + synthetic media acceptance is the meaningful PASS surface; the missing real Storage verification, scanner, report appeals and native device evidence remain explicit BLOCKED/PARTIAL. Do **not** enable real-user uploads or submission until those controls and policy decisions are independently accepted.

No REM-05E/05F, merge, deploy, webhook rotation or visibility change. STOP for owner independent technical review after all latest-head GitHub checks are inspected.

LUEMI 💜
