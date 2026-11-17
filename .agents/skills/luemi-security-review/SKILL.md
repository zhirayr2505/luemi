---
name: luemi-security-review
description: Use before changing Telegram authentication, sessions, API authorization, privacy/consent, profile publication, photo storage/moderation, account deletion, PostgreSQL roles, grants, or RLS.
---

# LUEMI security review

## Trust boundaries

- Verify Telegram `initData` server-side using documented HMAC/hash and freshness rules; never trust `initDataUnsafe` or client-supplied actor IDs.
- Treat every browser input, Telegram payload field, URL, uploaded file, and external response as untrusted.
- Review cookie flags, CSRF, Origin/CORS, session expiry/revocation, replay/idempotency, and rate limits.
- Keep secrets out of source, logs, URLs, client bundles, and all `VITE_*` variables.
- Use least-privilege PostgreSQL roles and FORCE RLS. Test cross-user/anonymous denial, not only happy paths.
- Keep private media private until the explicit moderation and publication states allow access. Re-check ownership and authorization across asynchronous storage/database boundaries.
- Ensure blocking, consent withdrawal, unpublish, account erasure, and session revocation cannot be bypassed by stale requests or retries.

## Review process

1. Trace the request from Telegram/browser to Fastify, DB role, RLS policy, and any Storage adapter.
2. Identify actor identity, authorization check, ownership scope, transaction/lock boundaries, and observable response.
3. Write negative tests for anonymous, forged, stale, cross-user, cross-origin, duplicate, and concurrent requests as applicable.
4. Apply Postgres guidance from `supabase-postgres-best-practices`.
5. Test only against disposable/synthetic environments unless the owner explicitly approves a specific live operation.

## Hard prohibitions

No production migration, live Storage writes, secret rotation, Render/Telegram configuration change, account mutation, or publication action is authorized by a code review. Stop and report missing human/legal/operational approvals rather than bypassing a gate.
