# LUEMI — release readiness for open signup + instant photo publication
**28 October 2026 · engineering status: NOT ACTIVATED**

## Owner-approved product behavior
- No artificial signup cap or invitations; adult verified Telegram accounts only.
- 3–6 user-selected photos are sanitized, stored in PRIVATE Supabase Storage and, after explicit consent and successful server confirmation, published in the user's profile immediately.
- No manual review *before* publication; the user can hide their profile. Other authenticated eligible adults see the published feed.
- Block, report, suspension and deletion still work **after** publication. No anonymous private Storage URLs.

## What has been verified
- Synthetic PNG PUT, owner GET, public denial and DELETE, with zero objects left, succeeded in GitHub Actions run 40751814752.
- Unit, real-only UI bundle and PostgreSQL 16/17 RLS CI test the API release mode.
- Current live Telegram app remains in **20-account private beta** until operational and policy gates are genuinely satisfied.

## Operational credentials (no paid service)
Existing app credentials must NEVER be reused for operator access. A manual GitHub workflow prepares four separate PostgreSQL roles with 256-bit derived credentials and installs their secret URLs directly into Render:
- `luemi_ops_erasure_request` → `REM06_ERASURE_REQUEST_DATABASE_URL`
- `luemi_ops_erasure_worker` → `REM06_ERASURE_WORKER_DATABASE_URL`
- `luemi_ops_safety` → `REG01H_SAFETY_OPERATOR_DATABASE_URL`
- `luemi_ops_reports` → `REG01G_MODERATOR_DATABASE_URL`

**Manual approval required:** [LUEMI operator bootstrap](https://github.com/zhirayr2505/luemi/actions/workflows/luemi-operator-bootstrap.yml), branch `main`, confirmation `PROVISION_LUEMI_PROTECTED_OPERATORS`. Uses existing `beta-bootstrap` GitHub Environment secrets. It does **not** enable registrations, media, publication, erasure, or moderation flags and never prints passwords.

**Read-only validation:** [LUEMI operator role readiness](https://github.com/zhirayr2505/luemi/actions/workflows/luemi-operator-readiness.yml), branch `main`, confirmation `RUN_LUEMI_OPERATOR_CHECK`. Requires proof of four independent LOGINs with RLS/TLS and reports only *number* of open abuse reports. Do not run until bootstrap reports success. **A successful role check is not a live deletion demonstration.**

The CLI implementation `apps/api/src/erasure-runner.ts` and `scripts/operate-erasure-queue.mjs` can process queued erasures only in a **secured operator execution environment** with explicitly approved deletion policy and the isolated operator credentials. A 15-minute GitHub Actions erasure schedule is installed but DISABLED unless the owner explicitly sets repository variable `LUEMI_ERASURE_AUTOMATION_ENABLED=1`. Even then it fails closed unless the Render erasure policy, maintenance approval and worker flags are actually enabled. The account-deletion HTTP endpoint returns **202 queued**, not “fully deleted.” An owner must witness a synthetic end-to-end deletion and confirm no Storage or account rows remain. The safety operator needs a person responding to abuse complaints after publication; this is *not* pre-publication photo review.

## Public privacy policy (BLOCKING)
The present `docs/privacy-notice-draft-20261028.md` is an **unapproved draft**. Before accepting photos from the general public:
- Have an Armenian legal/privacy professional assess the operator's required identity/address, data classes, consent wording, retention and backup deletion, and transfer to Germany/EU (Render/Supabase) and Telegram.
- Verify the current Armenian Article 27 and official 2026 adequacy-country list, including any required permission, and obligations to EU/RF users where applicable.
- Check actual access to the abuse/data-request Telegram contact and arrange report response coverage.
- Publish the *approved* notice on a real accessible `/privacy` page and assign `REM06_CONSENT_VERSION` matching `VITE_LUEMI_CONSENT_VERSION`. Never use `/friends-test.html` to obtain public consent. **Do not set `REM06_PRIVACY_APPROVED=1` merely because a draft exists.**

Official law: https://www.arlis.am/hy/acts/229131
Agency 2026 adequacy decision: https://dataprotection.moj.gov.am/

## Production activation (only after proofs)
- Transition from `REM06_FRIENDS_TEST_ENABLED=1` and `REM06_SELF_SERVICE_BETA_ENABLED=1` to **both 0**, disable invites.
- Activate signed sessions, private drafts, private media, open signups and true publication using the existing `apps/api/src/config.ts` gate; never bypass role isolation.
- For *no manual photo pre-review*, use `REM06_INSTANT_PUBLICATION_ENABLED=1` and `REM06_INSTANT_PUBLICATION_OWNER_ACCEPTED=1`. Do **not** fake the old `REM06_MODERATION_OPERATIONAL_APPROVED` approval.
- Separately enable and **verify** account deletion, independent deletion worker and abuse safety operator with appropriate genuine policy approvals and TLS/RLS checked logins. Do not claim any automated worker is active until its queue is actually serviced.
- Rebuild Vite with `VITE_LUEMI_REAL_ONLY=1`, `VITE_LUEMI_AUTH_V2=1`, `VITE_LUEMI_PRIVATE_DRAFT_UI=1`, `VITE_LUEMI_PRIVATE_MEDIA_UI=1`, `VITE_LUEMI_OPEN_SIGNUPS_UI=1`, `VITE_LUEMI_INSTANT_PUBLICATION_UI=1`, `VITE_LUEMI_FRIENDS_TEST_MODE=0`, real published-feed client and the approved notice URL.
- In Telegram Android WebView, test two independent 18+ accounts end-to-end: signup, 3–6 photos on server, publication on preview confirmation, photos seen mutually, refresh and new device recovery, block and report, hide, actual deletion, and public denial of private Storage access. Preserve all profiles if a deployment is rolled back.

## Current STOP conditions
**No public rollout until:** legally reviewed notice, active safety response, verified erasure request/worker and first two-account E2E. Merge and CI checks alone do not satisfy these gates. Do not claim unlimited operational capacity on a free Render service.
