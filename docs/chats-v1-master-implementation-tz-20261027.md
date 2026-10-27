# LUEMI 💜 — CHATS V1 FINAL IMPLEMENTATION TZ
Date: 2026-10-27. Scope: GitHub zhirayr2505/luemi, PR #109.
Owner directive: implement fully, not a mockup; preserve approved visual design; no new paid services.

## Acceptance contract (all required)
1. Two real Telegram accounts register and publish two real profiles in the **actual deployed** identity/profile datastore. Prove mapping from V2 auth actor UUID to published user UUID; no inference from names or synthetic IDs.
2. A real mutual match creates exactly one conversation for exactly two eligible accounts. One-sided likes never create a conversation. Existing messages are not reassigned.
3. A block, unmatch, deletion, suspension or visibility/privacy change revokes access **synchronously** (not only via a periodic reconciliation). Confirm by a denied read, send and media download.
4. Each account can send, receive, paginate, edit and soft-delete text messages; unread counters and read receipts update. Idempotent send retries cannot resurrect deleted messages.
5. Conversation list and header display the **actual** other user's name and permitted profile photo. No placeholders passed off as real data. Peer projection must not bypass privacy, blocks or account status.
6. Private images: validate MIME by inspecting bytes, max size, access permissions, ownership, object key; create safe upload/download flows using the existing storage provider and short-lived signed URLs; never expose privileged storage keys to the browser.
7. Confirm Android Telegram WebView gestures, scroll, network reconnect and fast conversation switching on Galaxy A55 without changing approved UI.
8. Run frontend and backend typecheck, API tests, SQL integrity/security tests, and a two-account end-to-end run. Record exact test evidence and final SHA.
9. Only after every gate passes: merge PR to main and deploy existing infrastructure; verify bot URL and production logs. Never create extra Render services or incur paid infrastructure.

## Known verified blockers
- Live connected Supabase project czzyoxrwtnvbicypwrdd on 2026-10-27: public.luemi_users=0 and public.luemi_matches=0.
- luemi_private.actors not present in the connected Supabase instance. V2 actor IDs and public profile IDs are distinct. db/chats-v1-trusted-reconcile.sql **must not be run** until a verified identity bridge exists.
- Current isolated chat schema is not applied to the live database; runtime roles and privileges are not provisioned.
- RealChats currently has no authenticated peer/photo projection and no private image transport.
- PR #109 is Draft, not deployed. Do not represent work as complete.

## Execution order
A. Inspect production deployment topology and authoritative user/match/actor data sources; verify tables, keys, match statuses, auth role boundaries, storage bucket and event paths.
B. Implement the identity bridge and trusted match reconciliation in the **same authoritative data boundary**. Add synchronous block/unmatch revocation. Add negative security tests.
C. Add private peer profile/photo projection and real media upload/download. Implement UI and server APIs together.
D. Validate the entire stack on two real accounts, review CI and RLS, then launch only when safe.

## STOP/NO-GO
Do not deploy or enable LUEMI_CHATS_V1_ENABLED if any acceptance condition fails. No fake matches, no fake photos, no privileged DB connection in chat runtime. If real test accounts/data are missing, document the exact blocker instead of inventing evidence.
