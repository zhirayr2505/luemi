# LUEMI immediate publication — operator launch checklist

**Status:** implementation, not a production approval. The owner selected **no manual photo pre-review**. This does not waive users' privacy, the ability to block/report, abuse takedown, or account/photo deletion.

## Expected user flow

1. Verified adult Telegram session; real open signup with no artificial 20-account limit.
2. Validated profile fields and separate, explicit consent **to immediate visibility**.
3. Three to six photos from gallery converted to sanitized PNG; each uploaded to the private Supabase bucket with the owner-bound asset ID.
4. Upload worker accepts successfully sanitized images without a manual review queue **only** with `REM06_INSTANT_PUBLICATION_ENABLED=1`.
5. Browser verifies the exact new asset IDs in the authenticated owner's manifest, then calls the existing revision-bound publication endpoint.
6. The profile is visible exclusively to authenticated eligible adult users via the RLS-protected real feed; unauthorized public bucket reads remain impossible. User can hide profile and submit block/report. New users can browse other published profiles while their own registration is incomplete.

## Important accuracy

- Internal `media_assets.state='approved'` in this optional mode means **technical media acceptance**, **not human verification, age/identity verification from photos, content safety approval, or legal clearance**. Never label instant photos "проверены модерацией".
- PNG sanitation only addresses format and metadata/size risks; it cannot detect explicit, abusive, nonconsensual or child sexual imagery. Operational abuse reports and urgent takedowns are essential.
- Real user photos are **not** published merely by merging this code.
- Rejected/revoked media stays inaccessible. User and server publication checks still require exactly 3–6 valid photos and verified adult session.

## Release controls — all required before flipping flags

- Replace the **closed-test** notice with an approved public privacy policy, explain immediate publication and cross-border transfer, document retention and consent withdrawal. Never set `REM06_PRIVACY_APPROVED=1` on an unreviewed legal draft.
- Demonstrate an actual accessible safety operator who can promptly revoke abusive photos, suspend accounts, and act on reports; demonstrate independently scoped safety credentials.
- Demonstrate an actual deletion request endpoint and worker that deletes accounts and private Storage objects; test with synthetic data and verify cleanup. No claims of completed deletion from request receipts alone.
- Reuse the already confirmed 2026-10-28 synthetic private Storage PUT/read/public deny/DELETE proof. Then verify the end-to-end upload with consenting real user testers.
- Server flags atomically switch from friends beta to public open admission; set `REM06_OPEN_SIGNUPS_ENABLED=1`, `REM06_OPEN_SIGNUPS_APPROVED=1`, `REM06_MEDIA_ENABLED=1`, `REM06_PUBLICATION_ENABLED=1`, and the new `REM06_INSTANT_PUBLICATION_ENABLED=1` + `REM06_INSTANT_PUBLICATION_OWNER_ACCEPTED=1`. Leave `REM06_MODERATION_OPERATIONAL_APPROVED=0` when no manual review exists.
- Independently set real erasure and safety operator credentials/flags only after testing them. Exact checks are in `apps/api/src/config.ts`.
- Frontend rebuild: real-only V2 auth, server drafts, private media, real discovery, **`VITE_LUEMI_INSTANT_PUBLICATION_UI=1`** and **`VITE_LUEMI_FRIENDS_TEST_MODE=0`**, together with approved consent version + public policy URL. Never show the friends-test.html policy.
- Test two unrelated adults with their own Telegram accounts: each uploads 3–6 own photos, confirms immediate publication, sees the other's card and images, blocks/reports, unpublishes and requests deletion. Verify publicly anonymous requests cannot see Storage pixels.
- Scale limits of Render Free/Supabase Free are separate from any software registration cap.

## Rollback

Revert server and frontend mode together; hide accounts with already instantly accepted public photos before disabling the route. Do not delete stored user data on rollbacks or imply erasure has completed. Maintain reports and deletion queues until processed.
