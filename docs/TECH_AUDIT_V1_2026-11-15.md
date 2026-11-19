# LUEMI — Technical Audit V1
**Snapshot:** 2026-11-15  
**Repository:** `zhirayr2505/luemi`  
**Audited branch:** `main`  
**Audited commit:** `22f69983cb905758e8ef0955f4f7089b21e1ae02`  
**Scope:** source architecture, feed query, PostgreSQL connection budgets, rate limiting, CI coverage, product documentation, open pull requests.  
**Important:** this is a static/source audit. No production database was queried, no real-user data was accessed, no Render/Supabase settings were changed, and no physical-device test was run.

## Executive summary

The current `main` is in a healthy automated-build state, but it is **not yet evidenced for 100,000-user scale**. The largest structural risks are:

1. Discovery feed work grows with the number of eligible published profiles and is repeated for every page.
2. The API creates many independent PostgreSQL pools; their configured ceilings add up to as much as **60 connections per API process** when all relevant features are enabled.
3. Several abuse limits are deliberately process-local and therefore do not provide one shared limit across multiple API replicas.
4. Product documentation disagrees about whether the current admission policy is public or invite-only.
5. The repository has 54 open Draft PRs; 51 have not been updated since before 2026-11-01. Several branches are hundreds of commits behind current `main`.

No production-code change is recommended as a blind one-shot rewrite. The next changes should be measured, isolated, tested, and merged one PR at a time.

## What is already working

At the audited `main` SHA, GitHub reported 15 check runs: **13 successful and 2 skipped**. The skipped runs are scheduled approved-erasure jobs whose workflow is explicitly off unless the owner enables it; they are not failed tests.

Successful checks included:
- clean foundation CI: lint, type contracts, source-marker contracts, API isolated tests, build and local smoke;
- REG01 actual PostgreSQL/RLS and signed-session checks on PostgreSQL 16 and 17;
- REG01 foundation regression;
- Profile behavioral/browser QA.

The source-marker contract gate includes `npm run audit:architecture` (strict mode). The current guard is useful: it checks unreachable runtime modules, import cycles and retired gesture/motion paths. It is not a performance benchmark and does not prove that the live service can handle a particular number of users.

## Findings

### P1 — Discovery feed has a high per-page compute cost

**Evidence**
- `apps/api/src/real-feed-cursor.ts:1-24` stores a numeric offset, bounded at 10,000.
- `apps/api/src/real-publication.ts:439-560` builds the published feed. The SQL evaluates distance (Haversine calculations), shared interests, goal compatibility, audience/age filters, block/like exclusions and approved-media eligibility. It then sorts by computed ranking, distance, city/country and publication time before applying `OFFSET $3 LIMIT 21`.
- The query comment explicitly says ranking is evaluated before OFFSET/LIMIT, so later pages preserve the ordering.
- `infra/migrations/0004_rem05d_private_media_moderation.sql` creates `luemi_assets_owner_idx(environment, owner_id, state)`, but the audited migration set does not define a feed-specific index for `public_profiles(environment, publication_status, published_at)`. Migration `0005_reg01d_private_publication_feed.sql` adds publication columns/policies but no feed index.

**Why it matters**
A page request must consider and rank the eligible set before it can return the requested slice. Later pages also repeat that work and skip earlier rows. The distance and compatibility expressions are computed per candidate; the index on media ownership does not make the whole ranking query cheap. This is a structural scaling risk, not a measured latency claim: no EXPLAIN ANALYZE run or 10k/100k fixture benchmark was performed in this audit.

**Recommended work**
1. Add a reproducible PostgreSQL benchmark with synthetic 10k and 100k published profiles, realistic media counts, blocks, likes and three search scopes.
2. Capture EXPLAIN (ANALYZE, BUFFERS) for page 1 and deep pages, with representative distribution data.
3. Add only indexes supported by measured plans.
4. Evaluate a stable per-viewer recommendation snapshot or another bounded ranking strategy, then move pagination to a stable keyset. Do not replace OFFSET with a cursor until the computed-order semantics and refresh behavior are tested.

### P1 — PostgreSQL connection pools are fragmented across modules

**Evidence**
The current code creates separate pools with hard-coded `max` values:
- sessions: 5 issuer + 5 request (`rem05b-session.ts`);
- geo budget: 8 (`rem05c-quota.ts`);
- private media: 5 request + 3 worker (`rem05d-private.ts`);
- registration drafts: 5 (`real-registration-drafts.ts`);
- publication: 4 publisher + 6 discovery reader + 4 request (`real-publication.ts`);
- erasure requests: 2 (`real-erasure.ts`);
- safety appeals: 2 (`safety-appeal-api.ts`);
- chats: 5 (`chats-api.ts`);
- matches: 4 match + 2 notification (`matches-api.ts`).

**Total configured ceiling: up to 60 connections per API process** if all corresponding features and the geo provider are enabled. This is a configuration ceiling, not observed live connection usage; pg pools create connections on demand. Several modules also create independent pools against the same request database URL, so their ceilings stack.

**Why it matters**
Multiple Render instances multiply these ceilings. Without a pool budget matched to the database's actual connection limit, feature activation or horizontal scaling can exhaust PostgreSQL connections even when request volume is otherwise manageable.

**Recommended work**
- Build a per-role connection budget from the actual Postgres plan and expected number of API replicas.
- Share one pool per identical database role/connection profile where the security boundary permits it; do not merge unlike credentials/roles.
- Add pool wait/checkout timeout and active/idle/waiting metrics.
- Validate the budget with a multi-instance load test and a pooler strategy before scaling out.

### P1 — Some rate limits are process-local by design

**Evidence**
`apps/api/src/rem05c-rate.ts` stores peer and process-wide counters in in-memory Maps. Its own comment says it does not claim distributed network fairness. The authenticated geo-spend budget is separately backed by PostgreSQL, but the auth/webhook emergency ceilings are local to one Node process.

**Why it matters**
With multiple API replicas, each instance has its own counter. Requests distributed across replicas can therefore exceed the nominal per-process ceiling. This is not a claim that the current single-instance service is compromised; it is a horizontal-scaling limitation already documented in the source.

**Recommended work**
Keep the conservative local guard as a last-resort per-process circuit breaker, and add a shared limiter (PostgreSQL or a dedicated shared store) for limits that must hold across replicas. Preserve `trustProxy=false` until the actual Render proxy chain is independently verified.

### P1 — Product admission documentation is contradictory

**Evidence**
- `AGENTS.md` says the owner-approved direction is public signup for all eligible Telegram users and explicitly supersedes earlier invite-only plans.
- `README.md` repeats that public-signup direction.
- `docs/PRODUCT_DIRECTION.md` still says the current phase is a closed friends test, says invites are active and describes public signup as a future phase.

**Why it matters**
This can mislead future engineering work, QA, operational setup and launch decisions. Actual runtime behavior remains controlled by explicit server/client flags; this audit did not inspect or change live environment settings.

**Recommended work**
Confirm one canonical, dated owner decision and make the README, AGENTS, product direction, launch gates and status docs agree. Do not infer production readiness or flip any signup/media/publication flags from documentation alone.

### P2 — Mobile QA is not a universal PR gate

**Evidence**
`.github/workflows/android-ux-matrix.yml` is configured for pull requests, but its job runs only for manual dispatch or a fixed allowlist of branch names. Most other PR branches skip that job. The workflow runs browser automation with Chromium/mobile emulation; it is not a physical Samsung Galaxy A55 or iPhone test.

**Recommended work**
Use path-based triggering for changes to gesture, viewport, feed, profile and registration code, while keeping expensive jobs focused. Keep a separate real-device acceptance checklist and record device/build evidence before declaring Android/iOS behavior verified.

### P2 — Open PR backlog needs triage, not mass merging

**Evidence**
- 54 open PRs; all 54 are Draft and none is marked ready.
- 51 have not been updated since before 2026-11-01.
- 18 target `main`; the rest are stacked on older feature/remediation branches.
- PR #186 (Registration V4) is 18 commits ahead and 503 commits behind the audited `main`, with GitHub reporting a dirty merge state.
- PR #183 (one of several similar photo-upload/preview implementations) is 18 commits ahead and 598 behind.
- PR #187 is based on the old #186 branch, not current `main`.

**Recommended work**
Classify each open PR as `merge`, `port`, `superseded` or `close`. Compare current behavior against the actual source before porting a feature. Do not merge a stacked PR directly into `main`, and do not bulk-close or bulk-merge without owner confirmation.

### P2 — App shell is a large orchestration module

**Evidence**
`apps/web/src/App.tsx` is approximately 86 KB and holds startup/authentication, registration state, media queues, publication state and route coordination. Discovery, feed and chats are already lazy-loaded, which is a good existing boundary.

**Recommended work**
Extract only stable domain controllers/hooks behind existing contracts, one boundary at a time. Keep the current UI, Profile Morph V3, gesture ownership and lifecycle behavior unchanged. Add regression coverage before moving state.

## Proposed execution order

1. **Performance baseline:** synthetic PostgreSQL data at 10k/100k, EXPLAIN ANALYZE, page-1/deep-page latency, query plans and current connection usage.
2. **Feed optimization:** measured indexes + recommendation snapshot/keyset design; add regression/performance thresholds.
3. **Connection budget:** shared pools per identical role, bounded maximums and pool metrics.
4. **Distributed abuse controls:** shared auth/webhook limits plus multi-replica tests.
5. **Documentation consistency:** reconcile the product admission decision across canonical docs without touching runtime flags.
6. **PR hygiene:** inventory and triage stale/stacked PRs after checking each against current `main`.
7. **Mobile release gate:** path-based browser QA plus recorded A55/iPhone acceptance.

## Explicit non-actions

- No merge to `main`.
- No Render deployment or Supabase migration.
- No production environment/feature-flag changes.
- No bulk PR closure.
- No visual redesign, color-token change, or Profile Morph V3 alteration.
- No claim of real-device validation or 100k-user capacity.

This document is an audit baseline, not a release approval.
