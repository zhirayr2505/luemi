# LUEMI — open signup + private server photo admission

28 October 2026. Implementation-ready configuration checklist, **not** legal or production signoff.

## What this code supports

- No application-level 20-user cap in `REM06_OPEN_SIGNUPS_ENABLED=1` mode: signed Telegram V2 sessions, adult validation, server-side private profile draft.
- Upload of **3–6 sanitized PNG images** through authenticated, CSRF-protected API. The server re-sanitizes; metadata and pixels are never placed in a public bucket.
- Verify exact **uploaded media asset IDs** against the authenticated server manifest before confirming completion. Prior/foreign/missing photos cannot satisfy a new upload.
- User enters private account, not public discovery, until separate human review and publication. No FaceTrust claim.
- Existing 20-user private beta is unchanged until activation.

## Required operator actions BEFORE any production activation

1. Approve and publish a legally reviewed privacy notice for Armenia and other targeted countries, including international transfer, storage periods, data rights, photos, deletion process and contact. **Current /friends-test.html is NOT acceptable**. Set `REM06_PRIVACY_APPROVED` only after actual approval. This document is not that approval.
2. Prove one synthetic PUT / authorized GET / public deny / DELETE + cleanup on the existing private Storage. The previous two tests ended **before any PUT**. As of this document, *unverified*. Do not treat a green unit test as a successful live Storage test.
3. Establish and test independent operator-only moderation/safety/erasure credentials and a real staffed workflow for complaints and data deletion. Never approve photos automatically or publish pending assets.
4. On an authorized release, atomically transition **out** of friends/self-service beta. `REM06_FRIENDS_TEST_ENABLED=0`, `REM06_SELF_SERVICE_BETA_ENABLED=0`, `REM06_BETA_INVITES_ENABLED=0`. The old modes conflict with open admission.
5. Server-side **after genuine approval**: `REM06_OPEN_SIGNUPS_ENABLED=1`, `REM06_OPEN_SIGNUPS_APPROVED=1`, `REM06_PRIVATE_DRAFT_ENABLED=1`, `REM06_MEDIA_ENABLED=1`, `REM06_MEDIA_BUCKET=luemi-profile-private`, plus existing isolated request/worker/auth database credentials and valid Supabase secret. Consent version must match the published policy.
6. Public frontend rebuild together with backend: `VITE_LUEMI_OPEN_SIGNUPS_UI=1`, `VITE_LUEMI_FRIENDS_TEST_MODE=0`, `VITE_LUEMI_PRIVATE_MEDIA_UI=1`, `VITE_LUEMI_AUTH_V2=1`, `VITE_LUEMI_PRIVATE_DRAFT_UI=1`, `VITE_LUEMI_REAL_ONLY=1`, `VITE_LUEMI_REGISTRATION_V2=1`. Supply the approved public notice path and consent version, never /friends-test.html. Client fails closed on media/notice mismatch.
7. Leave `REM06_PUBLICATION_ENABLED=0` until actual moderation, safety and deletion flows pass separate end-to-end checks. Open registration does **not** imply immediate visibility in discovery. Real chats/matches remain separately gated.
8. E2E on **two unrelated real adult Telegram accounts and Android WebView**: open UI, 3–6 uploads, manifest IDs, return from app, new device recovery of server photo record, privacy/public URL denial, deletion request, human moderation evidence and rejected upload case.
9. Monitor signed request failures, queue, Storage cost and ingress limits. No claim that a single Render Free instance or Supabase Free tier can accommodate a million simultaneous users or their photo storage. Capacity planning, rate limits, abuse protection and a budget are needed before scaling.

## Rollback

Restore previous known-good Render commit and approved environment flag set. Never delete or truncate actor/profile/media tables or private bucket during rollback. Preserve active user photos and outstanding erasure requests. Do not turn off the server media adapter with unprocessed private photo deletion obligations.

**Current status: no live open signup or media deployment approved. No separate legal review or successful synthetic end-to-end upload evidence.**
