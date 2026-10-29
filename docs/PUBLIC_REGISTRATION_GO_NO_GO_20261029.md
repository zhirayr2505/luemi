# LUEMI 💜 — Public registration GO / NO-GO evidence ledger
_Date: 2026-10-29. This document does NOT grant legal or operational approval._

## Verified in production (read-only)
- Supabase project czzyoxrwtnvbicypwrdd has private profile/chat/Bliki Storage buckets, all public=false.
- Four isolated operator PostgreSQL roles were provisioned and checked by owner-triggered GitHub workflow #40781311250 (success).
- Additive `luemi_chats_v3_private_visibility_20261029` is applied. Both RLS tables FORCE ROW LEVEL SECURITY; standard anon/authenticated SELECT is denied and chat role has INSERT not DELETE.
- Security advisor reports only eight INFO findings: intentionally policy-less legacy public.luemi_* tables with RLS on (fail closed). Do not add open policies just to remove informational warnings.
- LIVE GitHub main and Render were confirmed at SHA 590d6280dfa52c270387177dab57c1755cb734ab after PR #168 was merged. Privacy contact update in main: 7f12939b7a2fa8a21aadb2613d1bf2a6ec0d3f1e. The open-registration flags remain OFF.
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

## Owner-approved policy text and remaining non-automated release gates
- Owner expressly approved privacy policy **content** version 1.0 on 29 October 2026, identifying the operator as Гулгулджян Жирайр Григорьевич and official contact as Zhirayr2505@gmail.com. Recorded in `docs/PRIVACY_OWNER_APPROVAL_20261029.md`. This is not a legal compliance certificate or an approval of unverified operations.

## Human/legal mandatory release gates (NOT auto-approvable)
- Confirm operator legal identity, reliable contact and required details; legal review of Article 15 and Article 27 of Armenian Personal Data Protection Law No. HO-49-N.
- Verify 18 June 2026 Armenian Data Protection Agency published adequacy country list against Render/Supabase hosting geography, contracts, processor disclosures and any Telegram/geo subprocessors. Confirm any needed authorisation.
- Owner has approved the privacy notice **content**. Complete separate consent, post-publication complaint response and precisely documented retention/deletion of backups, exported files, stored conversations and lawful safety evidence, and establish the legally effective public date.
- Specify operator on-call / complaint response and retention holds. An approved policy must not be inferred from a green CI pipeline.
- Final owner-controlled release flags must never be flipped solely because automated checks pass.
- Final real Telegram E2E with two separate adult accounts must verify join → 3–6 server photos → immediate publication → feed/likes/chat → block/report → deletion/recovery. Do not create or remove real users as a synthetic QA shortcut.

## Current decision
**NO-GO until all above evidence is present.** The latest prelaunch integration was merged in PR #168 and deployed LIVE, but the irreversible erasure runner and open signups remain disabled. Owner approval of text v1.0 is recorded; legal/operational assurance, final retention/transfer decisions and physical Telegram E2E are not yet established. Do not enable erasure automation or open registration until these gates are documented.

Official law: https://www.arlis.am/en/acts/117034
Armenia 2026 adequacy list decision: https://dataprotection.moj.gov.am (decision 18 June 2026)
