# LUEMI 💜 REAL REGISTRATION 01I — main integration and release boundary

Date: 2026-10-25. This is a verified GitHub / Render / Supabase preflight,
not authorization to turn on beta APIs, send real user data or apply SQL.

## Exact baseline

- Old `main`: `a9d31876b27f0472ec3ca568b4a14926b9fdbdee`.
- 01H verified SHA: `35f3a1dfc8a36875c982f0a746a54eaa26409159`.
- GitHub compare shows that 01H contains old main as an ancestor: ahead 216,
  behind 0. Thus integrating this one head brings the stacked PR series
  without independently merging each draft/duplicating commits.
- An immutable *branch reference* to old main is reserved:
  `release-backups/main-before-real-registration-20261025`.
  This is not a production rollback by itself.
- `main` drives **live Render service `luemi`**
  (Free, `autoDeploy=yes`, `autoDeployTrigger=commit`).
  Any merge/push to main will automatically create a real Render deployment.
  Never claim that main can be updated without deploying.
- Two other Render Free services use separate branches:
  `luemi-stage01` (autoDeploy on) and `luemi-rc01-ui-only`
  (autoDeploy off). Neither is connected to main.
- LUEMI Supabase active Free project has ONLY 2 old Stage00 migration entries.
  Migrations `0002`–`0009` are **not applied there**.
  Do NOT enable private profile / media / publication / deletion / appeals
  flags until verified roles, storage, approval and all nine migrations are
  separately staged. Never run these against Veyra.

## Release risk

Main deploy is a code release, **NOT a working beta release**.
The new backend features are all default OFF and main cannot turn them
on with partial env flags; no live data can be stored merely by merging code.
`apps/api/test/real-01i-main-release-gate.test.ts` verifies default
production startup and 404 refusal for every registration/media/profile/
safety endpoint and incomplete-approval guards.

The actual Render production environment variables were not exposed by the
connector, and its current `APP_ORIGIN` formatting has not been independently
inspected. The new runtime rejects trailing slashes, URL userinfo, path,
fragments, queries and normalized alternate spellings. This intentional
strictness can fail production startup if existing env contains such syntax.
Without being able to verify the exact environment, a main merge has real
deployment risk. Explicit approval of the implicit deploy is essential.

## Evidence needed for an actual friend beta

- Full production safe-code CI, including main PR integration workflows.
- Post-merge Render deploy status LIVE on exact SHA and safe HTTP/website smoke,
  old logo and all approved flows preserved on actual Samsung Galaxy A55.
- Verify safe environment state without exposing or logging any secrets,
  especially `APP_ORIGIN`, live Telegram webhook and no beta flags.
- Separate owner-approved Free budget attestation and no unintended overages.
- Independent isolated staging Supabase DB permissions/RLS and private
  Storage put/get/delete before any live media or personal data.
- Privacy and retention policies, real named moderator, appeals review
  capacity and account deletion follow-through.
- Invite-only adult group and owner-approved migration/secret provisioning,
  with fresh consent and verified abort/rollback plan.

## Rollback if a main-branch deploy is unhealthy

1. Render Free often retains the previous LIVE deploy on failed update; verify
   rather than assuming.
2. Keep previous main SHA `a9d31876...` and safety backup ref intact.
3. Prefer an explicit GitHub revert commit or controlled Render redeploy of
   that exact old SHA over force-pushing or changing unrelated service branches.
4. Never rotate Telegram bot secrets, modify Supabase or Veyra to troubleshoot
   a deployment without a separately authorized incident response.

Only the code and tests are candidate for main. **This does not mark the
real registration system ready for public or invited users.**
