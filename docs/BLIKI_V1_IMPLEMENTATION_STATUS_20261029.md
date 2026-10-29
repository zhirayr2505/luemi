# LUEMI 💜 — Блики V1: implementation status (2026-10-29)

**Status: PARTIAL — BLOCKED FOR RELEASE.** The code and private schema are
implemented behind OFF-by-default gates. No merge, deployment, fixture data,
scheduled worker or feature activation was performed.

## Completed in this branch

- Restored Bliki on current `main` after the earlier merged implementation had
  subsequently been reverted, without restoring unrelated registration changes.
- Integrated the real Bliki rail/editor/viewer into the authenticated real feed.
  Removed the fictional showcase and retained the approved LUEMI and Profile
  Morph V3 paths.
- Added recoverable IndexedDB drafts, real published-profile feed, author groups,
  cursor pagination, mutual match/incoming-like priority, compatible audience and
  bidirectional block enforcement.
- Added private same-origin media delivery, view/reaction/report mutations,
  owner delete, and reply routing through the existing mutual-match chat API.
- Added fully decoded/sanitized photo processing and bounded MP4 probe/transcode
  with a server-verified 15-second limit, metadata stripping, SHA-256 integrity,
  immutable private storage writes and stale-processing recovery.
- Added FORCE-RLS schema, disjoint least-privilege roles, private retention state,
  physical cleanup worker, actor anti-spam buckets and isolated PostgreSQL CI.
- Applied the new processing migration to Supabase LUEMI with all flags OFF and
  verified no public table grants. At inspection time there were no stories,
  profiles, interactions or Bliki storage objects; no synthetic data was added.

## Gates and credentials

Server flags: `BLIKI_V1_ENABLED`, `BLIKI_V1_PUBLICATION_ENABLED`,
`BLIKI_V1_MEDIA_PIPELINE_ENABLED`, `BLIKI_V1_INTERACTION_ENABLED`.
Client flags: `VITE_BLIKI_V1_ENABLED`, `VITE_BLIKI_V1_INTERACTION_ENABLED`.
All default to OFF.

The API requires separately provisioned LOGIN credentials for the disjoint
NOLOGIN memberships `luemi_bliki_request`, `luemi_bliki_reader`,
`luemi_bliki_media_reader`, `luemi_bliki_interaction` and, for cleanup,
`luemi_bliki_retention`. Privileged or reused URLs are rejected.

## Remaining release blockers

1. No production LOGIN secrets were supplied, so real Supabase runtime uploads,
   reads and multi-account RLS E2E could not be executed.
2. No authentic published profiles or Bliki objects existed and creating fake
   production records was intentionally avoided.
3. Human/automated moderation operations, distributed edge limits, production
   monitoring and the retention schedule are not activated.
4. Nearby priority remains disabled: LUEMI does not yet persist an explicit
   location-consent/proximity proof suitable for this private feed.
5. Samsung Galaxy A55 Telegram Android WebView and iOS WKWebView acceptance,
   including thermals and gesture smoothness, requires real devices.

Until those items pass, the owner gate remains closed even if repository CI is
green. This branch is suitable for review and credentialed staging, not release.
