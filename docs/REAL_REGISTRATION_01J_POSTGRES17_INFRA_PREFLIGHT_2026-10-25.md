# LUEMI 💜 REAL REGISTRATION 01J — LIVE INFRASTRUCTURE PREFLIGHT

**25 October 2026**. Read-only audit + GitHub disposable PostgreSQL 16/17 CI.
No live user session, Storage object, Supabase migration, secret, Render env
or Veyra resource has been created or changed in this phase.

## Independently observed baseline (read-only)

- GitHub `main`: `7e9743d99b1714f55fc48d52f884ea93d7aa8fda`.
  Merge #72 already deployed successfully on Free Render service `luemi`.
  The two other Render services track **other branches**.
- LUEMI Supabase database: **PostgreSQL 17.11**, project ACTIVE_HEALTHY,
  current live migrations only two historical Stage00 entries.
- `luemi_private` secure registration schema: **absent** (0 tables).
  All new per-purpose custom database roles: **absent**.
- Eight legacy public LUEMI tables, all RLS-enabled, **0 rows**.
  These are NOT the 01A–01H private schema and must not be used as a shortcut.
- `luemi-profile-private` bucket: exists, marked private, 0 objects,
  size limit 6,291,456 bytes, allowed MIME image/jpeg, image/png, image/webp.
  No Storage object/bucket public SQL policies found. This is NOT proof
  that server-secret PUT/GET/DELETE works through Supabase's gateway.
- Supabase organization: Free, **two existing active projects**. No preview
  database branches present. A new free isolated project is not available
  within the account's existing project count. Paid branching must not be
  attempted: extra cost is explicitly forbidden.
- No verified production Render environment config available from read-only
  service metadata. Existing settings that let 01I's default-off code boot
  do not prove all role credentials and consent approvals exist.
- Private APIs / photo moderation / account erasure worker are not deployed
  as an operational real-user product merely because the code is on main.
- No actual A55 Telegram Android WebView end-to-end test has been conducted.

## Compatibility fix

`.github/workflows/real-registration-01a.yml` now runs every database migration
`0002`–`0009`, signed-Telegram/RLS/invite/photo/moderation/erasure/
suspension/appeal integration, against both disposable PostgreSQL **16 and 17**
in parallel; triggered on PRs to `main`, feature branches and pushes to
`main`. Independent foundation tests remain a separate job.

No change to private data, user-facing UI or real activation flags.

## Real beta readiness decision — NO GO until independently accepted

1. **Database environment:** determine an explicitly owner-approved
   isolated LUEMI-only staging space without any additional billing.
   Free Supabase preview branches can incur charges; do not create one.
   Using the existing LUEMI project requires explicit acceptance of
   shared-database risk; never touch the separate Veyra project.
2. **Migrations:** review every 0002–0009 migration and the existing
   Supabase/Postgres 17 owner role limits, perform a dry run in **disposable**
   PostgreSQL 17 and verify FORCE RLS for each independent app login.
   DO NOT run these against the active LUEMI project until the isolated
   environment and rollback/recovery plan are signed off.
3. **Secrets:** create separated least-privilege login credentials with
   correct environment namespace; inject via protected server environment,
   never the public GitHub repo or browser bundle. Verify webhook secret
   rotation and existing `@LuemiAppBot` route before touching Telegram.
4. **Private Storage:** synthetic PNG upload/download/delete through actual
   Supabase Storage endpoint; never publish raw/signed URLs and never reuse
   live customer objects. Check unknown/oversized/malformed photos and
   idempotent retry after a network failure.
5. **Human moderation:** real staff operator, working privacy handling of
   temporary reviewed copies, decisions, appeals, emergency escalation and
   data-erasure queue scheduling. Current operator CLIs are NOT operational
   staffing or a guaranteed deletion SLA.
6. **Consent:** finalized 18+ gating, clear privacy/retention/export and
   user erasure policy, and an invite-only cohort with consent.
7. **Operations:** prove 0 added paid spend with organization-specific
   budget, render quotas and limits, verify independent rollback and
   live user onboarding inside Telegram on Samsung A55.

**Do not set REM05B_SESSIONS_ENABLED, REM06_* or VITE_LUEMI_* real-user
feature flags to '1' simply to unhide screens.** This is a guarded real-person
dating product, not UI-only staging. A code deployment and a production-data
go-live are separate acceptance steps.
