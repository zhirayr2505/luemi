# LUEMI project instructions for coding agents

## Binding product decision (owner, 28 October 2026)

**LUEMI is a PUBLIC Telegram Mini App intended for all eligible Telegram users.** It is NOT a two-person beta for the owner and spouse. This direction supersedes historical invite-only or two-account testing documents and must be assumed for all subsequent engineering tasks unless the owner explicitly reverses it.

Authoritative source: [docs/PRODUCT_DIRECTION.md](docs/PRODUCT_DIRECTION.md).

- No whitelist, invitations, hardcoded Telegram IDs or manual owner approval for ordinary user signup.
- Any eligible user with valid server-verified Telegram initData should be able to create a real, persistent account.
- Save registration and media on the backend; no production demo profiles, fake discovery people, synthetic matches, or fake chat history.
- Existing two named test accounts are ordinary users, not an access-control boundary.
- On a repeat Telegram login, a published user opens their real account rather than starting registration over.
- Support consent-based phone/Telegram geolocation and genuine city resolution; never store exact GPS coordinates in public profiles.
- Keep approved visual design, Profile Morph and Android WebView motion behavior intact.

## Public launch safety gates

**This mandate does not authorize bypassing security or declaring a launch successful before it is.**

- For production, use OPEN admission with `REM06_OPEN_SIGNUPS_ENABLED=1` and `REM06_BETA_INVITES_ENABLED=0` **only after** required server DB connection, privacy, moderation and verification gates pass.
- Authenticate using verified Telegram initData, session cookies, CSRF, request limits, PostgreSQL RLS and least-privilege separate credentials; never ship secrets to browser bundles.
- Private photo upload and approval are mandatory; do not silently auto-approve arbitrary photographs.
- Allow blocking, abuse reports, account removal and consent withdrawal; verify behavior under live real-account sessions.
- `VITE_*` flags are baked into Vite assets. Turning on server flags alone does not turn on the real frontend.
- No real users should see demo fixtures. Production and QA/dev data must remain separate.
- Do not overwrite main, merge or deploy changes when the task explicitly forbids it.

When blocked by infrastructure or approvals, work on the actual blockers, report the precise missing readiness, and NEVER suggest shrinking LUEMI's intended audience to two people as the solution.
