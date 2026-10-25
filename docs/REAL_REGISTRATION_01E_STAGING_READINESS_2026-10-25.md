# LUEMI 💜 — REAL REGISTRATION 01E | Free staging readiness and adult beta checklist

**Date:** 2026-10-25. **Scope:** preparation and isolated CI only.
**Branch:** `feature/real-registration-01e-staging-gates-20261025`.
**Base:** PR #67 at `46fadfd6f761996ef85b4fd47d9146e3ecfa1c2a`.
No merge or production deployment has been approved.

## Verified READ-ONLY service inventory, same Render workspace

| Render | Branch | Plan | Auto deploy | Status |
|---|---|---|---|---|
| `luemi-rc01-ui-only` | `release-candidates/luemi-ui-only-d14eafd0-20261024` | Free | OFF | Last deploy LIVE `d14eafd0` (24 Oct) |
| `luemi-stage01` | `staging/telegram-miniapp-20261019` | Free | ON | Not the registration-01E code |
| `luemi` | `main` | Free | ON | Not the registration-01E code |

All THREE existing resources must be treated as shared and protected.
**Never push to either auto-deploy branch or change an existing service.**
The UI-only RC service is intentionally separate from private registration;
do not attach real credentials or change its code branch without owner signoff.
The Render connector confirms `plan=free`, but free bandwidth/build-hour
remaining quotas and billing/overage guarantee have NOT been verified.
Therefore **additional authorized spending is $0 and no infrastructure writes
occur in this stage**.

Supabase (LUEMI only): active Free plan, project ref `czzyoxrwtnvbicypwrdd`,
region eu-central-1, migrations `20261018183941` and `20261018184043`.
Private PostgreSQL migrations `0002`–`0005` remain **unapplied** in live
LUEMI as of this audit. Zero Supabase development branches. Veyra was not
modified or queried. Do NOT run these CI migrations on the live Supabase
project: they require a separate staging plan, role reconciliation, protected
connection strings and an explicit go/no-go approval.

Security advisor for LUEMI reports INFO `rls_enabled_no_policy` for eight
empty, legacy `public.luemi_*` tables; RLS default-denies clients but this
is **not** proof that the real beta backend is installed. Guidance:
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## Synthetic CI acceptance

- Unit tests verify UI-only RC refuses all real-registration routes/activation,
  credentials alone never enable private processing, and invalid Origin is
  rejected before boot.
- Disposable PostgreSQL 16 CI runs REM05B sessions, REM05D private media,
  REG01A drafts, REG01D publication, RLS cross-user blocking and photos,
  moderator decision, withdrawal of consent and stale-transaction guards.
- No tests here read live Telegram `initData`, inspect real users or
  upload to live Supabase Storage. Passing CI is **not** staging E2E proof.

## Required actual beta acceptance (STOP until all boxes evidenced)

- [ ] Fully approved privacy policy, real lawful consent, data processing
      locations and retention/erasure rules (invite only adults 18+).
- [ ] Account deletion, media-object purge and cleanup/reconciliation of
      abandoned/failed uploads, reports/blocks/queues and audit retention.
- [ ] Human moderator authentication, queue review, escalation/report and
      appeal workflow; synthetic test moderator must never handle real data.
- [ ] Separate staging database roles tested against actual Supabase settings
      and a real private Storage put/get/delete using a disposable synthetic
      object, with absolutely no unrelated users or projects.
- [ ] Webhook secret history/rotation and Telegram bot identity audit; no
      command should rotate or log secrets without approval.
- [ ] Verified Render free remaining quotas, Supabase billing/branch cost
      and confirmation that no paid plan or unexpected overage is possible.
- [ ] Enforced allowlisted inviter cohort/anti-scraping/rate budgets on API.
- [ ] Full physical Android Galaxy A55 Telegram WebView test; iOS where
      supported; keyboard/camera/cookies/upload/gesture/revoke test.
- [ ] User-facing recovery/resume/edit/delete, real photo order, and feedback
      for server/network errors. Likes/matches/chats remain prototype only.
- [ ] Final security review, accepted SHA, rollback/stop controls, and
      an explicit owner go-live confirmation.

## Device walkthrough (no real credentials in the report)

1. Launch through the correct test Telegram bot on A55; app identity
   bootstraps with same-origin HttpOnly cookie and in-memory CSRF.
2. Fill all eight steps; use real adult age; verify errors for under-18
   DOB, 2/7 photos, unsupported file, and missing consent.
3. Save a PRIVATE draft, reopen app, verify actual server revision
   and conflict handling (recovery UI is currently incomplete).
4. Upload 3–6 sanitized private photos; no public URLs or EXIF/GPS;
   submit for moderator review and assert no premature publication.
5. Moderator approves 3+ photos; publish current draft revision;
   second adult test user sees profile while unregistered user does not.
6. Block, unpublish, withdraw consent, re-check prior photo URLs.
7. Test account deletion/Storage cleanup end-to-end (currently BLOCKED).
8. QA motion, focus, viewport, photo navigation and menu return, ensuring
   original LUEMI Soft Glass Light design is unchanged.

## Release recommendation

**NO-GO for real users.** The code continues in separate GitHub DRAFT PRs.
The 01E synthetic test + privacy withdrawal work reduces risk but does
not constitute live deployment or actual adult friend onboarding.


## Immediate withdrawal controls (01E)

A separate owner UI action invokes `POST /api/v3/profile/withdraw-consent`.
It requires the signed V2 Telegram session, CSRF and deliberate confirmation,
and does not depend on the registration consent checkbox being checked at the
moment of withdrawal. The server atomically sets all owner's published photo
flags back to private, hides the public profile and nulls the private draft's
consent version. RLS and authenticated photo endpoints stop disclosing those
pixels. **Data are retained, not erased**: the user-facing message explicitly
says that full account deletion still needs implementation and acceptance.
This is not a substitute for a formal deletion/retention policy.
