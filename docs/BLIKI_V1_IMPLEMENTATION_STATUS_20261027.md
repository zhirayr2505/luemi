# LUEMI 💜 — Блики V1: implementation handoff (2026-10-27)

**Status: PARTIAL — BLOCKED.** This is a reviewed feature branch, **not** a production-ready feature.
No merge, deployment, global feature enablement or new Render service has been performed.

## What is implemented

- A single Telegram REM-05B session guard is reused; Fastify registers publication, read feed,
  authorized private media, and interaction modules only behind explicit opt-in flags.
- Private read principal, media principal, interaction principal and existing owner writer are
  deliberately disjoint. All private PostgreSQL principals remain NOLOGIN; live credentials
  must be provisioned independently outside GitHub.
- Stories, views, reactions and reports retain RLS + FORCE RLS. Reader and interaction roles
  cannot read storage keys. The media role alone can read story keys behind its own RLS,
  while the private Supabase bucket remains non-public.
- Live feed returns `{authors,serverNow,nextCursor}` with real published profiles,
  approved avatar IDs, real mutual matches/incoming likes, active stories, millisecond
  timestamps and same-origin media paths. No demo author records are inserted.
  Stable microsecond-precision keyset pagination uses an anchored bounded cursor;
  Discovery explicitly loads further pages and deduplicates authors/stories.
- Published dating audience and age ranges are copied to real profiles. Restrictive story
  RLS denies mutually incompatible viewers and unknown audience settings. Nearby sorting
  remains disabled until explicit location permission and server proximity rules exist.
- The private media route re-authorizes before streaming; standard and byte-range reads
  enforce exact size, MIME and Content-Range without buffering 100 MB in process.
- Photo publication has checks for size/type/signature, storage SHA-256 and recoverable
  immutable-upload retries. Editor metadata is server-validated and text/emoji layers render
  in the story viewer.
- Real session-scoped, idempotent view/reaction/report mutations, and author-only delete
  tombstones are implemented. Persistent cleanup of deleted/expired objects is **not** done.
- Opt-in Discovery avatar rail/editor/viewer surface preserves existing behavior when OFF.
  A create entry is available even when no stories exist.
- Story captions and text layers (up to 150 Unicode codepoints) persist in local drafts;
  client and server now agree on emoji/codepoint limits. Telegram Back closes
  the Bliki overlay before navigating away.
- An isolated, explicitly approved one-shot private-media retention processor is implemented,
  with a dedicated NOLOGIN role, FORCE RLS, ownership/key checks, durable retry markers,
  concurrency-safe row locks, and 25h/48h retention guards. **No automatic schedule is on**.

## Applied Supabase LUEMI migrations

These were applied to project `czzyoxrwtnvbicypwrdd` and inspected read-only afterward:

1. `20261027_bliki_read_media_roles.sql`
2. `20261027_bliki_social_priority_reader.sql`
3. `20261027_bliki_approved_avatars.sql`
4. `20261027_bliki_interactions.sql`
5. `20261027_bliki_mutual_preferences.sql`
6. `20261027_bliki_retention.sql`

No public API policy was granted; all four Bliki tables have ENABLE + FORCE RLS.
The retention migration was applied to Supabase LUEMI and its privileges validated
read-only: cannot modify media keys/status or access the identity schema; anon and
authenticated have no story SELECT. At verification time there were 0 real stories
and 0 real published profiles. No storage objects were removed.

## Feature flags — all OFF by default

- Server: `BLIKI_V1_ENABLED`, `BLIKI_V1_PUBLICATION_ENABLED`,
  `BLIKI_V1_INTERACTION_ENABLED`.
- Client: `VITE_BLIKI_V1_ENABLED`, `VITE_BLIKI_V1_INTERACTION_ENABLED`.
- Server requires independent, separately-provisioned
  `BLIKI_V1_READ_DATABASE_URL`, `BLIKI_V1_MEDIA_DATABASE_URL`,
  `BLIKI_V1_WRITE_DATABASE_URL`, `BLIKI_V1_INTERACTION_DATABASE_URL`,
  `BLIKI_V1_STORAGE_SECRET` and approved LUEMI project ref.
- Do **not** use `postgres`, service_role or another privileged DB URL as an
  application principal. Do not add secrets to the repository.

## Blocking work before real release

1. A bounded video processing worker: full MP4/codec decode, 15-second server-verified
   duration, safe transcoding, CPU/memory limits, final processing/rejected state.
   Video publication intentionally returns 503 until then.
2. Configured isolated DB login principals and safe production secrets; full scoped
   RLS runtime tests using real multi-user Telegram accounts.
3. Approve/operate a separately credentialed retention runner and reliable schedule;
   current one-shot processor and retry bookkeeping exist but are NOT activated.
   Tombstones and 24h expiry deny reads immediately; physical removal is untested live.
4. Verified server-nearby ranking (only with location permission), reply-to-chat
   routing and anti-spam rate limit integration. Pagination exists but still needs
   end-to-end high-volume live testing.
5. Moderation of user-uploaded photos/overlays, safe image decodes and full
   read/publish integration verification. Magic bytes alone do not equal image sanitization.
6. End-to-end and physical-device QA, including Android A55 and iOS WKWebView.
7. Real live end-to-end integration QA is still pending: there were no authentic
   published profiles/stories, active role LOGIN credentials or real device access.
   No local test commands were executed against a cloned checkout in this chat.

## Verified GitHub Actions (2026-10-27)

Run: https://github.com/zhirayr2505/luemi/actions/runs/40535700990
Source commit: `9272b787bd87eb60bdc1dddc75e5aeb9bf678bcb`.
Both CI jobs passed on a disposable runner:

- `npm run typecheck` — PASS (API and web)
- `npm run test -w @luemi/api` — PASS
- `node scripts/bliki-v1-contract.test.mjs` — PASS
- `npm run build` — PASS
- PostgreSQL 16 RLS smoke, applying all version-controlled Bliki migrations on a
  synthetic database — PASS. Verified compatible viewer, incompatible viewer,
  both block directions, 24-hour expiry, self-read, key privilege isolation,
  public access denial, idempotent views, and retention restrictions preventing
  live/cross-namespace object selection or unauthorized status/key changes.
- Added cursor round-trip/bad-input API unit tests and pagination client integration.
- Supabase live read-only follow-up confirmed new NOLOGIN retention role, FORCE RLS,
  no SELECT by public roles, no story data and no unauthorized table privileges.

These results **do not** establish a working retention schedule, real Supabase
runtime credentials, successful
production image upload, safe 100 MB MP4 processing, end-to-end UI behavior,
or Samsung A55 smoothness. Feature flags remain OFF.

## Manual device checklist (after a separately authorized staging release)

1. Authenticate as two actual invited Telegram users, publish real approved adult
   profiles with compatible preferences and photos.
2. Confirm empty feed still shows 'Мой Блик'; select media only via system gallery,
   create a draft, kill Telegram and restore the draft.
3. Publish one image twice with the same operation ID: exactly one story must appear.
4. Confirm blocked user in either direction, hidden profiles, incompatible preferences
   and expired stories never receive media bytes by guessed story IDs.
5. Tap forward/back across stories, swipe between authors with finger-follow animation,
   long-hold pause, background/foreground, Telegram Back and repeated fast gestures.
6. Record a view and reaction, report a story, delete an owned story, verify all
   mutation guards and absent cross-owner access.
7. Test valid/invalid HTTP ranges. Video publishing must stay blocked until the
   verified worker and tests are operational.
8. Confirm no white flashes, no damage to Profile Morph V3 and no overheating or
   significant jank on Samsung Galaxy A55.

**Owner gate remains CLOSED.** This document does not authorize merge, deployment,
feature activation or any creation of paid services.
