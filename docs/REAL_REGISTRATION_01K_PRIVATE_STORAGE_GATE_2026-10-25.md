# LUEMI 💜 — REAL REGISTRATION 01K: actual private Storage readiness

Date: 2026-10-25. Owner-approved code work only.
Status: **NO-GO for enrolling real friends**. Nothing here constitutes
authorization for a live Supabase migration or live user file upload.

## Confirmed before writing any code

- Latest production Render `luemi` is LIVE on
  `fe0527871112038199e7511d789810f6d18d8fd2`.
- All 12 exact-main GitHub CI jobs completed successfully, including
  PostgreSQL 16 and 17 signed Telegram/RLS workflows.
- LUEMI Supabase is PostgreSQL 17.11. Its sole private bucket
  `luemi-profile-private` contains **zero files**.
- No new private registration schema or role-login infrastructure
  exists yet in that database. The active production beta flags remain OFF.
- The Supabase organization is Free and already has two projects; creating
  a third or a billed preview branch is outside the additional $0 budget.
- The Veyra project is explicitly **out of scope**.

## What was added

`apps/api/src/private-storage-probe.ts` is a synthetic-only
private Storage round-trip verifier. It generates one 2x2 RGBA PNG
using `makeSyntheticPng`, a random owner UUID, a random asset UUID and
a cryptographically random object component in a designated `ci_*`
namespace. It neither reads real database users nor uses their filenames.

The protocol checks:

1. An unused private object path does not already exist.
2. A server-side PUT stores the exact synthetic bytes.
3. A **second, unauthenticated GET** to the PUBLIC endpoint must
   explicitly deny access (400/401/403/404). HTTP 200 is a privacy
   failure; redirects and unexpected errors fail closed.
4. The authenticated private GET returns exact original bytes.
5. DELETE succeeds and authenticated GET returns 404/null.
6. On any error (including post-write timeouts and wrong readback),
   attempt compensating deletion and re-check absence. Never call the
   result PASS if cleanup is unconfirmed; surface the random *synthetic*
   object key to the approved operator for manual incident cleanup.

This does not create a new Supabase project, upload a real photo,
touch any Veyra bucket, or test/rotate a Telegram secret.

The opt-in **operator-only** `private-storage-probe-runner.ts` is not
imported into the public API or browser. It cannot run without all
these exact conditions:

- command argument `--execute-synthetic-upload`;
- `REG01K_SYNTHETIC_STORAGE_TEST_ENABLED=1`;
- `REG01K_LUEMI_SHARED_BUCKET_PROBE_APPROVED=1`;
- `REG01K_SHARED_PROJECT_RISK_ACCEPTED=1`;
- `REG01K_STORAGE_COST_APPROVED_ZERO=1`;
- `REG01K_PRIVACY_APPROVED=1`;
- `REG01K_PROJECT_REF` and independently acknowledged
  `REG01K_OPERATOR_CONFIRMED_PROJECT_REF` both exactly match the
  LUEMI project, never Veyra;
- `REG01K_BUCKET=luemi-profile-private`;
- `REG01K_SYNTHETIC_NAMESPACE` starts with `ci_` and passes
  strict namespace validation;
- `REG01K_STORAGE_SECRET` provided via a protected server-only
  environment variable, **not** chat or public source control.

**This uses a random prefix inside LUEMI's EXISTING live project's
private bucket, NOT an independently isolated Supabase environment.**
Even a synthetic test there is a live Storage write, so owner/operator
risk acceptance is mandatory. In this work session the runner is NOT
executed. Synthetic tests use a mock object store and no credentials.

## What this does not prove

- Real Supabase PUT/GET/DELETE works. That remains **unverified**
  until the operator runs this accepted smoke and separately checks
  Supabase object count, billing and logs.
- The public-profile photo proxy, age gate, human moderation, or actual
  database migrations are not operating on live Supabase.
- Deleting the temporary synthetic file cannot establish the actual
  erasure SLA for user data and backups.
- A successful Storage smoke is NOT authorization to enroll adults,
  activate real discovery flags or attach an administrator key to the web.
- All actual family/friends beta acceptance, moderation staffing, privacy
  terms, Render quotas, webhook-rotation review and A55 Telegram WebView
  tests are still required.

## Release boundary

Code-only maintenance changes may be merged into `main` after CI.
Render autoDeploy follows `main` and may rebuild; runtime beta flags
remain OFF. DO NOT enable any real-user features or mutate current
LUEMI Supabase without separate risk/cost/privacy acceptance.
