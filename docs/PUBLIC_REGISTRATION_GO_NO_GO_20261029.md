# LUEMI 💜 — Public registration GO / NO-GO evidence ledger
_Date: 2026-10-29. This document does NOT grant legal or operational approval._

## Verified in production (read-only)
- Supabase project czzyoxrwtnvbicypwrdd has private profile/chat/Bliki Storage buckets, all public=false.
- Four isolated operator PostgreSQL roles were provisioned and checked by owner-triggered GitHub workflow #40781311250 (success).
- Additive `luemi_chats_v3_private_visibility_20261029` is applied. Both RLS tables FORCE ROW LEVEL SECURITY; standard anon/authenticated SELECT is denied and chat role has INSERT not DELETE.
- Security advisor reports only eight INFO findings: intentionally policy-less legacy public.luemi_* tables with RLS on (fail closed). Do not add open policies just to remove informational warnings.
- LIVE GitHub main and Render are at SHA 5fa3c65d7b8d08650f7d1bdfd2224b1ab4f877da (verified chats V3 visibility core via merged PR #167). The pending tombstone/erasure/export implementation remains isolated in Draft PR #168.
- On 29 October, production read-only preflight found zero **eligible** final-erasure requests, zero authored Bliki stories, zero active safety enforcements. No synthetic accounts or content were inserted into production.
- Two additional additive migrations applied and verified: `luemi_chats_v3_tombstone_readonly_20261029` and `luemi_v3_actor_erasure_scoped_policies_20261029`; chat writer still cannot SELECT Telegram ID, worker gets narrowly scoped policy access only. They do NOT enable the erasure runner or public signups.
- October 29 Supabase Security Advisor reports eight INFO findings on intentionally closed legacy `public.luemi_*` tables; no new open RLS policy was granted. Profile, chat and Bliki Storage buckets remain private.

## Automated launch gates (all MUST pass on final SHA)
- GitHub: clean foundation; real-registration PG16/17; Chats/Matches PG16/17 including delete scope and deleted-peer RLS; private bundle smoke; profile behavior. All passed for commit `eb0ad401a3024aaddfaf69581827870dd813cf8a` except Android device matrix intentionally skipped; follow-up export enhancement requires a fresh full CI verdict.
- Synthetic workflows exercise two signed Telegram identities, per-side and two-sided deletion, media signed URLs, blocked peer, 72h grace/recovery, object-store retry and anonymized account receipt.
- Storage: private-only, no service-role secret in frontend; no direct Data API exposure of private RLS tables; live role readiness; no unrestricted administrator export.
- Account erasure: both synthetic and production safety conditions proven. Bliki author's media and safety evidence must have a deterministic, reversible-until-72h, then auditable process. No partial irreversible deletion before RLS/FK preflight.
- Export: current identity only, only accessible conversation history, excludes hidden-for-everyone data and unrelated users; sanitized own photos where server policy allows; bounded file size. Does NOT promise device-originals or permanent message archive.
- Android Telegram WebView Samsung A55: actual owner QA for gestures, registration, chat delete and download. Skipped Android CI is NOT a verified device pass.

## Human/legal mandatory release gates (NOT auto-approvable)
- Confirm operator legal identity, reliable contact and required details; legal review of Article 15 and Article 27 of Armenian Personal Data Protection Law No. HO-49-N.
- Verify 18 June 2026 Armenian Data Protection Agency published adequacy country list against Render/Supabase hosting geography, contracts, processor disclosures and any Telegram/geo subprocessors. Confirm any needed authorisation.
- Approve truthful privacy notice, separate consent, photo publication without mandatory prior human review, post-publication complaint response and precisely documented retention/deletion of backups, exported files, stored conversations and lawful safety evidence.
- Specify operator on-call / complaint response and retention holds. An approved policy must not be inferred from a green CI pipeline.
- Final owner-controlled release flags must never be flipped solely because automated checks pass.
- Final real Telegram E2E with two separate adult accounts must verify join → 3–6 server photos → immediate publication → feed/likes/chat → block/report → deletion/recovery. Do not create or remove real users as a synthetic QA shortcut.

## Current decision
**NO-GO until all above evidence is present.** Safe chat deletion core is LIVE; remaining account-erasure and export code is Draft PR #168, not deployed. Do not enable erasure automation or public registration until end-to-end evidence and legal approval are documented.

Official law: https://www.arlis.am/en/acts/117034
Armenia 2026 adequacy list decision: https://dataprotection.moj.gov.am (decision 18 June 2026)
