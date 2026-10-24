# LUEMI 💜 REM-05F — Bliki Security and Integration Architecture ADR
Date: 2026-10-24
Status: PROVISIONAL ARCHITECTURE, NOT LIVE. LU-29 = DEFERRED_FEATURE_GATE.
Accepted REM-05E parent: b5b456966e97a9ef76525bf04a679763853cc6b7.
Product source of truth: docs/LUEMI_BLIKI_MASTER_SPEC.md (owner-approved 21 October 2026).
Scope boundary: no actual Bliki publication, database migration, Storage/CSP change, payment, World rollout, merge, deploy, or user data.

## 1. Decision provenance / contradictions

ACCEPTED PRODUCT: five compact overlapping circles plus +N under original LUEMI logo; tap/down-swipe lift; collapse by up-swipe/content scroll; original three discovery tabs unchanged; unread first while read stays dimmed; personal My Circle first, voluntary round World ✦ portal second; per-publication audience public/matches and independent World opt-in OFF by default; photo and video 24h server time, at most five active, video ≤30s; authorized profile badge; public counts without viewer identity disclosure; revocable one fire/Blik distinct from SPARK; comments only with server entitlement and author enable/moderation.

ACCEPTED IMPLEMENTATION: current ProfileMaster keeps an honest Блики tab placeholder «Функция готовится». REM-05B session, REM-05C HTTP/CSP/rate/geo, REM-05D private storage mock/RLS and D-R4, REM-05E webhook protection are preserved. The historical BlikViewer.tsx is unsafe for production. REM-05F disables its user-facing source and media assignment; it does not upgrade the viewer or make it release-ready. The real source previously projected a server activeBlik if it had any HTTPS URL plus future expiry, without server authorization. Test reproduces this.

PROVISIONAL: every SQL table, server API, RLS grant, media host, cache, video scanner, time budget and entitlement mechanism below. NONE is currently running or migration-authorized.
UNRESOLVED: exact auth API, signed link/proxy policy, production storage, consent text, retention window, price, token and URL TTL, adult/age checks, operator moderation, abuse policy, legal approval, load targets. REM-05A ADR files and historical master remediation TZ are not present in the accepted repository tree; no fictional REM-05A decisions are asserted.

## 2. Threat model & security boundary

Adversaries: untrusted WebView JS, forged JSON/feature flags/localStorage/URL, hostile author, revoked viewer, bot/scraper, impersonated match, accidental CDN exposure, leaked presigned link, insider with excessive role, stale in-flight player, malicious video/ZIP bomb. Assets: private moments, raw originals, current audience/match/block relation, precise location, viewer identities, moderation, payments, signed leases and personal media.

A HTTPS address or positive client flag grants NOTHING. Future backend must bind opaque authenticated actor from REM-05B session to author, Blik ID, media/version, current audience and live relationship graph, block both directions, moderation, 24h expiry and monotonic revision. Re-evaluate before list inclusion, detail, each media byte-range/signed lease, viewer, prefetch and each event. Unknown or malformed values DENY, including unknown moderation; keep denial indistinguishable from absent content. Never make client projection or MediaSource/CSP alone an authorization layer.

Current REM-05F safe runtime invariant: ProfileModel.projectProfile erases activeBlik for all modes/sources regardless of API fields/URL; ProfileMaster removes BlikViewer import, state, click path, modal and media DOM entirely. The existing disabled fixture/draft is never a publication. A separate synthetic-only policy lives under apps/api/secure-tests, NOT apps/api/src, has no HTTP route, accepts only synthetic facts and returns no usable media URL or viewer identity. Even a synthetic ALLOW is explicitly NOT a production capability.

## 3. Proposed future private data model (NOT IMPLEMENTED)

- bliki: id UUID, author_actor_uuid, audience enum(public/matches), world_opt_in boolean default false, publication state draft/pending/published/hidden/rejected, moderation pending/approved/removed/rejected, server_published_at, expires_at = +24h, revoked_at, permission_revision, comments_enabled, created/updated. DB transaction/advisory lock ensures ≤5 simultaneous active per author; no client timestamps.
- blik_media: media_uuid/version, internal private key, owner, Blik FK, content digest, derivative id, scanner version/decision, bytes, codec, actual video duration ≤30s, image pixel/frame dimensions, moderation; originals never public.
- relation_snapshot/authorization revision: refer to authoritative REM-05B actor and match/block records, not copied client signals. Invalidate delivery lease on changes.
- blik_view_event: viewer actor, Blik UUID, idempotency key/time window, server-verified eligible foreground playback, processed count, private viewers log. Public count is aggregate only; private viewer identity access restricted to author+privacy constraints.
- blik_fires: unique(actor_uuid,Blik UUID), active/cancelled, version, idempotency; never creates match, SPARK or chat. No automatic entitlement.
- blik_comments: author, Blik, body moderation, server entitlement reference, author comments_enabled and current ACL at write time. Remain disabled before audited Premium/payment stage.
- blik_acl_audit: opaque actor, action, allow/deny reason enum, revision, trace id, time, moderator id if applicable, no raw media/query token/content.
- blik_media_leases: actor/session, media_uuid/version, ACL revision, short expiration, opaque nonce, invalidation generation; no durable public URL.

## 4. Proposed authorization matrix and invalidation

Operation | Required authoritative predicates | Failure response and risks
List (My Circle) | authenticated eligible viewer, approved published active Blik, public or current match, not blocked, revision current | omit without leaking author/count; saved/Spark is relevance only
Detail | list predicates plus current Blik+media version, specific viewer; safe public projection | 404 indistinguishable; no storage key
Media/download/prefetch | same as detail at consumption time, short lease, actor binding, anti-hotlink and no-store | DENY before image/video src or prefetch; no byte ranges on deny
Viewer | positive server decision for viewer and current revision, not HTTPS/activeBlik; foreground session | don't mount player on missing proof
World ✦ | distinct intentional viewer opening and per-Blik world_opt_in=true, audience public, eligibility, no blocks, page bounds | no matches-only, no global discovery by default
View event | server permission + user-initiated visible decoded/playing evidence; not prefetch; rate/dedupe; no self-count | no event if disabled/hidden/background
Fire mutation | valid current permission + unique(actor,blik), idempotent update, rate limits, undo support | does not unlock DM/match/SPARK
Comment mutation | valid ACL + author enabled + moderation and VERIFIED active server Premium entitlement | deny without trusted ledger, no client premium field
Author viewers | authenticated owner only, viewer privacy policy and separate permission | public statistics never include identities
Caches/signed leases | lease tied to actor, version, expiry and permission_revision; cache private/no-store | versioned invalidation; do not rely on token URL being fresh

Changes triggering reauthorization: unmatch, block, audience edit, world consent removal, expiry, revoke, moderation removal, media replacement, actor suspension, server policy revision, session revoke. Any pending player or preload must abort and stop future fetch. A signed URL already issued and media downloaded to a device cannot be absolutely revoked. CDN purge is asynchronous; do not promise global immediate erasure. Private media should preferentially use an authenticated, range-aware streaming proxy with per-range verification; if separate pre-signed URLs are later approved, tightly bound and proposed ≤60 seconds TTL, no private cache, restricted audience, session+revision checks.

## 5. Media and privacy / CSP technical proposals, NOT LIVE

Storage: private buckets, path derived only from server random ID; append-only scan/moderation audit, isolated worker role without broad grants, strict egress/rate limits, verified digest and image decode/re-encode. REM-05D is synthetic memory-backed PNG-only, NOT live scanner, private Supabase bucket or video solution.

Photo tentative budgets (require owner approval): max 1–2MiB processed image, max 4MP decoded, max two held decoded images, no unsafe metadata EXIF/GPS, reject unrecognized critical formats and decompression bombs. Video tentative budgets: verified ≤30s media clock, dimension/fps/codec/bitrate allowlist and 10–20MiB file maximum, transcode/scan in restricted worker, one active decoder/player, bounded thumbnail/preload. Need actual device validation, range streaming, CVE-scoped codec support and operational cost estimate.

CSP: preserve exact REM-05C frame-ancestors, embedding and connect/media origins unchanged in REM-05F. Future media-src, connect-src, blob: and object URL policies require approved specific private media origin, referrer/CORS/Range handling and browser tests. Do not widen to wildcard HTTPS or untrusted hosts merely because an asset URL is syntactically valid. Review Telegram Android WebView (A55) and iOS WKWebView, background/visibility suspension, BackButton, safe areas, screenshot/screen capture and uncertain media buffering semantics.

Caching: actor/session-private, versioned, revision keyed, zero shared CDN cache for matches-only, expiry-aware invalidation, no offline fallback after access loss. Audit logs must not contain URL credentials, raw Telegram updates, exact user location, viewer PII or unfiltered failure payload.

View anti-abuse: server-side dedupe + watch threshold TBD, foreground and decoded/playing eligibility, no prefetch counts; public aggregate delayed and permission-filtered. Consent for World is per Blik and default false; no follower model, no implicit promotion of match to world audience. Author viewer-list retention and legal basis require explicit separate decision. 24h activity expiry does NOT by itself define original/media/event retention. Proposed choices for approval: delete immediately vs short moderated appeal window vs legally required retention under auditable access; none approved. Costs: transcoding, scanner CPU, private storage, global CDN egress, permissions lookups, moderation workforce, usage abuse. No production readiness claim.

## 6. Media lifecycle primitive, integration contracts

REM-05F ships a dormant pure BlikMediaSession primitive, not a viewer:
loading -> decoded (decode may precede load) -> ready -> playing/paused/buffering -> error/expired/revoked. Image timing starts only after both load AND decode. Video progress is accepted only from current playback currentTime/duration, never wall-clock while buffering/paused. Background, hold and visibility pause. End is single-fire; error/expiry/revocation terminal. Every callback carries session generation; stale generations rejected. Resource owner releases listeners/observers/object URLs/abort operations at generation switch, terminal or unmount idempotently. NO requestAnimationFrame or React state writes from this primitive; future visual progress can read a sampled value in a single ownership writer. Reduced Motion can skip source morph, never bypass ACL.

Existing infrastructure to REUSE, not rewrite: PhotoViewer and PhotoReadiness loaded/decode distinction; REM-03D source morph/geometry, ProfileMaster route restoration, MotionController, gesture arbiter, modal-layer focus/inert and body lock, Back handling, motion lifecycle and safe-area viewport bindings. Future modal Blik must claim exclusive modal/Back/gesture/motion ownership; order: fullscreen modal first, PhotoViewer mutually exclusive, then profile sheet, tab, native scroll. No parallel RAF owners of identical transforms. Capture route/tab/card/photo/scroll/source Rect before opening; on close/X/Telegram Back/Android Back/swipe restore exact live source or a safe source-disappearance fallback, focus and body lock; cancel/rebase on resize, keyboard, safe area, background, scroll, permission revoke, reduced motion. Keep at most a bounded neighbor visual track, one active decoder/video and no cross-author preload outside granted policy. These are CONTRACTS, not a new UI implementation or Chrome proof of the future modal.

## 7. Future release gates & open owner decisions

Require separately authorized real backend and RLS design, negative SQL role tests, storage signed URL revocation checks, moderation operator workflow, mobile A55/iOS device QA, privacy/legal/retention approval, high-load and cost benchmarks, media scanning and real world opt-in contracts. Payment/Premium must be audited separately. Future feature stages have their own PRs and product/security acceptance; REM-05F does not add to existing Stage 04–09 roadmap.

Owner must decide: bytes/pixels/codecs, authorized origins, streaming proxy vs provider token, lease TTL, media scan pipeline, moderation/appeals, viewers retention and qualified view threshold, unique/total views, anti-abuse, Premium entitlement provider, precise gesture timing, independent World and launch date.

Final operational invariant: LU-29 stays DEFERRED_FEATURE_GATE. No live Telegram API, Render, Supabase, RLS/Storage, real secrets/user data, World or Premium enabled. No merge/deploy.
