# LUEMI REAL-REGISTRATION 01C — PRIVATE MEDIA ENGINE (candidate)

Source PR chain: #62 architecture → #64 server drafts → #65 client opt-in → 01C.
No merge, live migrations, Storage writes, secret reads or Telegram deploy.

## Design and implementation

The vetted REM-05D database/RLS/media intent code is **reused** rather than
duplicated. Its old synthetic in-memory adapter is still test-only; a mutually
exclusive `durablePrivateOnly` mode uses `createDurablePrivateStore`.

The new adapter talks to an exact Supabase project ref over HTTPS on the server
only and only inside the existing private `luemi-profile-private` bucket:
POST unguessable sanitized object, GET authenticated object, DELETE object.
No public URLs, client Storage API keys, signed URLs, CDN forwarding, upsert,
redirect following or arbitrary object keys. HTTP timeout and maximum response
byte limits apply. Storage errors never reveal keys or credentials to clients.

Backend opts in ONLY with all existing REM05B and REM06 private draft/privacy
gates and `REM06_MEDIA_ENABLED=1`, private storage ref and secret, separate
worker database login and exact `REM06_MEDIA_BUCKET=luemi-profile-private`.
Enabled only on a separately authorized service after privacy/security/billing
approval. Never configure these on existing service without acceptance.

The existing upload engine accepts bounded PNG RGB/RGBA 8-bit, noninterlaced
(<=1MiB, <=2048px, <=4MP); decodes/reencodes to remove ancillary metadata,
uses six private asset slots, rejects stale/revoked sessions mid-flight, writes
pending_review + queue metadata. It deliberately **does not autoapprove or
publish any user photograph**. JPEG/WebP direct server upload is still blocked;
UI conversion is a temporary preview-quality limitation.

## Required before a real beta (BLOCKING)

- Apply and verify migrations 0002-0004 to a **disposable** and approved isolated
  staging project first. They are NOT applied to the current LUEMI Supabase.
- Review Supabase private bucket permissions, credential scope and object
  visibility. Supabase secret/service role is powerful; never send to clients.
- Durable cleanup/reconciliation of orphan objects and expired reserved upload
  slots, interrupted upload/partial storage failures and conflict retries.
- Bounded, isolated, production-image decoder for JPEG/WebP (rather than
  relying on client PNG conversion), independent malware/safety/media screening,
  abuse escalation, real moderator assignment/decisions/appeals.
- Account deletion, storage retention, policy text, moderation terms and
  owner-approved data processing jurisdictions. Real Android/iOS device tests.
- Separate approval of image/memory/egress/Storage cost budgets.
- 01D controlled publication of approved media and user discovery.
- No unsupported assurances: passing simulated Storage transport tests is
  NOT evidence of live Supabase integration.

2026-10-25 current published Storage docs: private assets require authorized
reads; standard uploads default to non-upsert, and Storage RLS normally denies
anonymous operations.


## Client media gate (REAL-REG-01C)

The approved existing interface is unchanged without explicit build flags.
After a separately consented server private-draft save, and only when
`VITE_LUEMI_PRIVATE_MEDIA_UI=1`, the last registration step offers a second
explicit action to upload 3–6 locally ready photographs for **private review**.

The client decodes JPEG, PNG, or WebP, converts to a bounded PNG thumbnail
(up to 800 px, compressing down to 300 px if necessary) and sends it to the
same-origin protected API with memory-only CSRF. The backend independently
decodes/reencodes and strips metadata. No original camera file or Supabase
secret is sent via Storage's public API. This is a thumbnail-quality pilot,
NOT the final high-resolution photo feature.

Uploads proceed sequentially; retry uses each locally stored photo's stable
UUID as an idempotency key. A previously received intent skips resending.
Any partial failure is reported without calling the data published.
No deletion, reorder of already uploaded media, retry reconciliation after
local draft loss or moderator decision UI exists yet: **do not enable for
real friends until those critical operations are present**.
