# LUEMI REAL REGISTRATION 01A — PRIVATE SERVER DRAFT (2026-10-25)

## Release state: implementation candidate; **NOT a live launch**

Base: architectural cleanup Draft PR #62 at `337fc08ed43ecb14affd39cc30d42f2a6f15a09a`.
This independent branch must not merge into `main` or reach Telegram staging until
real Galaxy A55 UX acceptance, isolated PostgreSQL negative tests and infrastructure review.

### Implemented in source

- New **`/api/v3/registration/draft` GET/PUT only**, wired separately from
  the synthetic REM-05D media/storage system.
- Requires the REM-05B v2 signed Telegram cookie, Origin/CSRF on writes, an
  independent `luemi_request` database role, effective FORCE RLS, tenant GUC
  and a DB revision compare-and-swap (stale writer => 409).
- Server accepts an allowlist of profile fields; rejects arbitrary owner,
  moderation, public and storage fields. Birth date goes only into the private
  `birth_date` column. Reported age must be 18+ at server time.
- Requires an **exact, approved consent version on every private write**.
- Revalidates the active session before transaction commit.
- Feature is **OFF** unless explicitly configured; no migrations executed.
- No publishing, image storage, other-user reads, discovery, Bliki, payments
  or moderation UI in this stage.

### Activation requirements (NOT fulfilled; DO NOT enable yet)

1. Owner approves actual privacy policy, retention, deletion and consent texts
   for expected test-user jurisdictions, and separately approves staging data processing.
2. Verify `0002` through `0004` against an isolated Supabase project:
   distinct credentials; schema exposure; no `anon`/`authenticated` access;
   FORCE RLS on all private tables; no wide Data API access.
3. Verify the webhook secret incident/rotation and private GitHub visibility.
4. Test real PostgreSQL multi-user isolation (A/B), expired/revoked sessions,
   stale revision, forged requests and DB outage; distinguish mock CI from live tests.
5. Confirm real-v2 cookie works in Android Telegram WebView, and iOS separately.
6. Owner approves exact Render plan and costs. Never write current Veyra resources.
7. Only after all gates: set `REM05B_SESSIONS_ENABLED=1`,
   `REM06_PRIVATE_DRAFT_ENABLED=1`, `REM06_PRIVACY_APPROVED=1`,
   `REM06_CONSENT_VERSION=<approved-version>` and independent request DB
   credentials on a dedicated test service. **These flags are not set here.**

### Next required slices

**01B:** client session opt-in and explicit genuine privacy consent; remote
draft read/save/resume with conflict UI and local-only fallback (never confuse
local 'saved' with server 'saved').

**01C:** durable private image sanitation + object storage + moderation and
cleanup/retention, with explicit real-browser user proof.

**01D:** safe publication and read-only discovery of approved profiles, block,
report, unpublish/delete, privacy/age and moderation safeguards.

**01E:** invite-only end-to-end device acceptance with genuine adult testers.

Existing mock-only REM-05D must remain test-only. Its presence does not mean
Supabase Storage is provisioned or production media is safe.
