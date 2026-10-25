# LUEMI REAL REGISTRATION 01B — controlled private save

Feature is OFF by default in all environments; no deploy in this PR. To expose
a server-save panel at step 8, ALL gates must pass:

- `VITE_LUEMI_AUTH_V2=1`, `VITE_LUEMI_PRIVATE_DRAFT_UI=1`.
- `VITE_LUEMI_CONSENT_VERSION` must match owner-approved server version.
- `VITE_LUEMI_PRIVACY_POLICY_PATH` must point to a REAL, public, legally approved
  policy hosted at the same origin. This document is NOT that policy.
- Server REM06 gates and signed v2 session must be active on a separately approved
  test environment with confirmed costs and privacy security.

Only an explicit user tap with consent sends allowlisted fields to private
PostgreSQL; no photos, no localStorage/IndexedDB data, no local IDs or `initData`
are uploaded. Existing remote draft requires explicit replacement confirmation,
and CAS 409 rejects stale writes. No automatic sync/restore is attempted.
The default 8-step demo UI, brand, gesture and navigation remain unchanged
without the opt-in flags.

**Not a release:** no real private Storage, moderation, published profiles,
server media upload, account/data deletion workflow, real-user geographic
verification, or e2e production confirmation. No live beta invitations yet.
