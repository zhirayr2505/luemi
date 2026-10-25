# LUEMI — Real-user readiness, read-only infrastructure findings (2026-10-25)

Observed independently (no write operations):

- GitHub Draft PR #62: refactor head `337fc08e` is NOT merged.
- New REG-01A and REG-01B branches run isolated GitHub CI only, all new
  registration flags default OFF; public/Telegram staging unchanged.
- Existing LUEMI Supabase project is ACTIVE_HEALTHY and has two Stage 00
  migration entries. The `luemi_private` schema and repo migrations
  `0002_rem05b_identity_sessions.sql` through `0004_rem05d_private_media_moderation.sql`
  were NOT observed as applied in this live project's migration records.
- Eight `public.luemi_*` tables reported RLS enabled with zero rows and
  no policies. Supabase security advisor flagged informational
  `rls_enabled_no_policy` on these tables. This is currently default-deny
  rather than proof of real account readiness.
- A bucket `luemi-profile-private` exists, `public=false`,
  6 MiB per-file limit, JPEG/PNG/WebP allowlist. No LUEMI-specific
  `storage.objects` policies were observed. **This does not constitute a
  functioning user upload/permission/moderation workflow.**
- The live project was not mutated; Veyra Supabase was not inspected or changed.

## Release blockers before the first adult friends' accounts

1. Approve real retention, privacy, deletion, reporting and consent documents;
   do not confuse a demo checkbox with valid data processing consent.
2. Create an isolated, affordable staging plan; inspect Render workspace,
   quotas, existing resources, and costs before any deploy/SQL write.
3. Reconcile `0002`–`0004` with live PostgreSQL roles and Supabase Data
   API settings in disposable/staging infrastructure. No production migration yet.
4. Implement durable private media adapter using server-side least privilege,
   sanitization, review, safety decisions, metadata stripping and orphan cleanup.
   6 MiB cap alone is NOT an image safety pipeline.
5. Implement verified publication (approved media only), list/query privacy
   and location controls, real user discovery, reporting, block, unpublish
   and delete. Add rate limits and operator moderation.
6. Audit webhook secret history, private source permissions and optional world
   geocoding. Test Android Telegram A55 and iOS WebView on real devices.
7. Only then invite a restricted set of adults and measure real performance.

Do NOT toggle `REM06_PRIVATE_DRAFT_ENABLED` or expose user PII until
these gates are independently accepted. GitHub CI passing is not a legal
or live user consent approval.
