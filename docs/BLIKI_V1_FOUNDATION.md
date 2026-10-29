# LUEMI 💜 — Блики V1

This branch implements the opt-in Bliki V1 vertical across the existing LUEMI
session, published-profile, discovery, match and chat boundaries. It does not
replace the approved Discovery or Profile Morph V3 surfaces.

## Product behavior

- Real published-profile authors only; no fixture/showcase authors.
- System gallery picker only, account-scoped IndexedDB drafts and recoverable
  operation IDs.
- Photo and up-to-15-second MP4 publication through a bounded server pipeline.
- 24-hour server lifetime, author groups, stable cursor pagination, match/like
  priority, bidirectional blocks and compatible audience filtering.
- Same-origin authorized media streaming from a private Supabase bucket.
- View, reaction, report, owner delete and reply into an existing mutual-match
  conversation. A reaction never creates a match.
- Existing Telegram Back behavior closes the Bliki overlay first.

## Safety boundaries

- All feature flags are OFF by default.
- Application routes reject privileged/shared database principals. Reader,
  media-reader, writer, interaction and retention memberships are disjoint.
- `anon` and `authenticated` have no Bliki table access. Every Bliki table uses
  RLS and FORCE RLS.
- Uploads are streamed to private temporary files, fully decoded, metadata is
  stripped, and output is re-encoded before immutable private storage upload.
- Process-local actor rate limits are an emergency abuse boundary; production
  edge/distributed limits are still required before public activation.
- No merge, deployment, scheduled retention runner or global flag activation is
  authorized by this branch.

## Release gate

Keep Bliki OFF until separately provisioned least-privilege LOGIN credentials,
real-account staging E2E, moderation operations, scheduled retention and Samsung
Galaxy A55 Telegram WebView acceptance have all passed.
