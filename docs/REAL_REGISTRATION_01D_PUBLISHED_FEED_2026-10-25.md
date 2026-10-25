# LUEMI 💜 — REAL REGISTRATION 01D | Moderated publication and real-feed pilot

**Date:** 2026-10-25. **Branch:** `feature/real-registration-01d-published-feed-20261025`.
**Parents:** accepted-for-development source #62 → #64 → #65 → #66.
**PR:** #67 (DRAFT, not approved or deployed).

## What 01D actually builds

An isolated database migration `infra/migrations/0005_reg01d_private_publication_feed.sql`
extends the disposable REM05B/05D private schema with:

- `luemi_profile_publisher`: an *isolated* backend identity that may read
  only the current actor's private draft/media, validate adult consent and 3–6
  human-approved photographs, and atomically transition profile+media from
  PRIVATE to PUBLISHED or back to HIDDEN. Its credential is not accepted as
  a session/request, worker or reader principal.
- `luemi_discovery_reader`: another *isolated* backend identity with RLS
  allowing only approved/published media belonging to a published active adult
  user, excluding self and **two-way** blocks. It cannot select private drafts,
  mutate data, inspect session tables, or read audit records.
- FORCE RLS, restrictive GRANTs, no `anon` or `authenticated` Data API
  access, no SECURITY DEFINER functions or public Storage policies.

Server routes, protected by signed Telegram V2 sessions and request-level
origin/CSRF where applicable:
- GET `/api/v3/profile/status` current owner's draft/published/hidden + media counts
- POST `/api/v3/profile/publish` with current private-draft revision
- POST `/api/v3/profile/unpublish`
- GET `/api/v3/discovery/feed` limited to first 20 accessible approved profiles
- GET `/api/v3/discovery/photo/:id` streams only a verified approved derivative

No public photo URLs. Discovery requires its **own** server-side adult draft
and current consent to access other users. This check and the photo permission
are repeated after private Storage GET to prevent stale pixels after revocation.
No raw birthdates, Telegram IDs, object keys, private/hidden/rejected photos or
unpublished drafts are serialized to the browser.

The client adds an opt-in 01D panel at the final registration step: check
moderation status, explicitly publish, unpublish, or open a separate real
feed with privacy-preserving same-origin photo access, blocks and reports.
**Approved demo screens and motion are untouched with the flag OFF**.
Like/match/chat buttons are deliberately absent from this pilot.

## Default-deny activation (DO NOT ENABLE ON EXISTING SERVICES)

Client: `VITE_LUEMI_AUTH_V2=1`,
`VITE_LUEMI_PRIVATE_DRAFT_UI=1`,
`VITE_LUEMI_PRIVATE_MEDIA_UI=1`,
`VITE_LUEMI_REAL_DISCOVERY_UI=1`,
valid policy path and exact approved consent version.

Server: signed REM05B roles, approved REM06 privacy, private draft/media enabled,
`REM06_PUBLICATION_ENABLED=1`,
`REM06_MODERATION_OPERATIONAL_APPROVED=1`,
`REM06_PUBLISHER_DATABASE_URL` and `REM06_DISCOVERY_DATABASE_URL` as
separate low-privilege logins. All production flags remain OFF. Startup
refuses role reuse or incomplete privacy/moderation/media configuration.

## Operational blockers to inviting real people

1. No approved real moderator UI, independent safety policy, report escalation,
   appeal flow or background review SLA. Synthetic moderators exist **only**
   in disposable CI. Human moderation must be independently staffed.
2. No durable orphan-upload recovery, deletion/export workflow, data retention
   enforcement, account offboarding or automated removal of stored files.
3. No production-verified isolated database roles or Supabase Storage credentials;
   the current LUEMI Supabase has NOT received `0002`–`0005`.
4. Feed pilot is intentionally only 20 profiles; no full matching/radius,
   pagination, sophisticated ranking, anti-scraping or matches/chat.
5. Real-world Android A55 Telegram WebView and iOS testing, policy/consent/legal
   and 0-additional-cost validation, Render quotas and webhook-secret history.
6. Current client photo path resizes to bounded PNG previews; final
   high-resolution images/true JPEG/WebP server pipeline not completed.

**No real-user data or live infra was modified by the 01D code PR.**
Testing disposable SQL and mocked Storage is not real end-to-end staging.
