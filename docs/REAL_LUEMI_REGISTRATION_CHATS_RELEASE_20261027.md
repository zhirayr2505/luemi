# LUEMI 💜 — Real registration + matches + chats integration

Date: 2026-10-27. Repository: `zhirayr2505/luemi`.
Integration: `integration/real-registration-chats-20261027`, Draft PR #112.

## Delivered and independently verified

- Registration publication flow: existing Telegram V2 session, server-backed private draft with revision control, private photo sanitization/upload, publication after moderation, published owner recovery and editing.
- Real account Discovery: published-only feed, safe photo proxy, blocking and reporting.
- Chats: isolated Fastify v4 API; message cursors, idempotency by client UUID, edited/deleted messages, owner-only read receipts, polling and reconnection on foreground.
- Mutual likes: private actor IDs, 15 fresh likes per UTC day, idempotent reciprocal match, one private conversation, exactly two authorized participants.
- Chat peer projection: authoritative name from published profile, approved image via the existing authenticated media endpoint, no fixture fallback.
- Unmatch and block: revoked chat membership visibility at query time, including existing message history.
- Separate least-privilege match and chat PostgreSQL roles, all private RLS tables with FORCE ROW LEVEL SECURITY.
- CI: real disposable PostgreSQL 16/17 RLS tests, synthetic two-user Fastify HTTP test, clean foundation and registration QA (verify latest exact HEAD in GitHub Actions).
- Approved Profile Morph V3 remains the current implementation. Real-chat and match flags remain disabled by default.

## Real LUEMI Supabase changes — APPLIED, not dry-run

Project ID: `czzyoxrwtnvbicypwrdd` (PostgreSQL 17).
Applied on 2026-10-27:
1. `luemi_v2_identity_sessions_20261027` — `0002_rem05b_identity_sessions.sql`
2. `luemi_v2_geo_budget_20261027` — `0003_rem05c_geo_budget.sql`
3. `luemi_v2_private_registration_media_20261027` — `0004_rem05d_private_media_moderation.sql`
4. `luemi_v2_private_publication_20261027` — `0005_reg01d_private_publication_feed.sql`
5. `luemi_v2_account_erasure_20261027` — `0006_reg01f_account_erasure.sql`
6. `luemi_v2_invite_gate_20261027` — `0007_reg01g_invite_gate.sql`
7. `luemi_v2_human_moderation_20261027` — `0008_reg01g_human_moderation.sql`
8. `luemi_v2_safety_appeals_20261027` — `0009_reg01h_enforcement_appeals.sql`
9. `luemi_chats_private_schema_20261027` — `db/chats-v1-isolated.sql`
10. `luemi_chats_message_integrity_20261027` — `db/chats-v1-message-integrity.sql`
11. `luemi_v2_mutual_matches_and_rls_20261027` — `db/chats-v2-mutual-matches.sql`

Verification: actors, private_profile_drafts, public_profiles, likes, matches, messages exist. RLS FORCE enabled; neither Supabase `anon` nor `authenticated` can USAGE `luemi_private` or `luemi_chats`. No real user, match, message, or draft records existed at last read. Prior Stage00 and Bliki migrations were preserved. Security advisor only showed existing informational no-policy reports for old default-deny tables.

## HARD production enablement gates (NOT YET DELIVERED)

1. Provision separate login principals/strong secrets for V2 issuer, request, media worker, publisher, discovery, moderator, erasure, chat and match roles. Only role groups have been migrated. Never use `postgres`, `service_role` or a privileged Supabase key as the HTTP DB principal. Test each login's role safety assertions.
2. Verify affordable connection route from the Render Free runtime to Supabase PostgreSQL 17 and private Supabase Storage, credentials and permitted egress without exposing secrets in logs. The current connectors do not reveal secret values; do not invent them.
3. Operator-approved consent/privacy policy, deletion-retention schedule, named moderator, reporting and moderation workflow, and safe private media audit. Set feature flags only once these are operational.
4. Two genuine opted-in adult Telegram identities (not fabricated users), 3–6 independently moderated photos each, mutual likes and real send/read verification in Telegram WebView on Samsung Galaxy A55.
5. Validate CI on the exact merge SHA; `main` auto-deploys the only LUEMI Render service. Verify boot and health before enabling flags. No new paid services or Veyra work.
6. Security reminder: `db/chats-v1-trusted-reconcile.sql` is a **legacy** public match migration, not the new private mutual match system. Do not use it for private matches.

## Required config alignment

Backend on only after approved roles and operational gates: `REM05B_SESSIONS_ENABLED=1`, `REM06_PRIVATE_DRAFT_ENABLED=1`, `REM06_MEDIA_ENABLED=1`, `REM06_PUBLICATION_ENABLED=1`, `LUEMI_CHATS_V1_ENABLED=1`, `LUEMI_MATCHES_V1_ENABLED=1`, and their companion verified policy, invite, namespace, Storage and independent database URL settings in `apps/api/src/config.ts`. Never turn these on from mere presence of a key.

Frontend build: `VITE_LUEMI_AUTH_V2=1`, `VITE_LUEMI_PRIVATE_DRAFT_UI=1`, `VITE_LUEMI_PRIVATE_MEDIA_UI=1`, `VITE_LUEMI_REAL_DISCOVERY_UI=1`, `VITE_LUEMI_REAL_CHATS=1`, `VITE_LUEMI_REAL_MATCHES=1`, plus approved policy path/consent version. `VITE_LUEMI_DEMO_CHATS` remains OFF in real build.

**Current release verdict:** database and source integration exists; isolated HTTP flow proven; live enablement and genuine Telegram beta acceptance remain BLOCKED. Do not claim a ready, live dating service.
