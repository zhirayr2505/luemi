# LUEMI 💜 — Telegram Mini App

**Product direction (owner-approved, 28 October 2026): public signup for ALL eligible Telegram users.** Read [docs/PRODUCT_DIRECTION.md](docs/PRODUCT_DIRECTION.md). This supersedes every two-account invitation/closed beta plan.

LUEMI includes a Telegram-facing React app, real V2 authentication, server-backed profile registration, private media pipeline, published Discovery, mutual matches and chats. The design and Profile Morph animation are independently approved; preserve them when changing functional behavior.

**Operational status:** merging code or having a Render deploy marked LIVE does *not* mean public registration is activated. Protected server/client flags, isolated database LOGIN credentials, moderation, privacy notices and real-user E2E must be verified before live signups. Do not show DEMO people to production users.

## Architecture
- `apps/web`: React 19, TypeScript, Vite; Telegram WebApp entry, system/light/dark theme, safe areas and reduced motion.
- `apps/api`: Fastify 5; Telegram initData HMAC validation and time bounds, CORS, minimal liveness endpoint, secret-protected readiness, rate limiting.
- `packages/contracts`: shared typed API contracts.
- `infra/migrations`: isolated staging SQL proposal; NOT applied.
- `docs`: decisions, status, security constraints, releases.

## Local development (Node.js 22+)
`npm install`
`npm run check`
Copy `.env.example` to `.env` in the API process environment and supply real values **outside Git**. Run `npm run dev:api` and `npm run dev:web`. Valid Telegram initData is only available inside the Telegram WebView. Opening the web directly shows an explicit safe outside-Telegram state.

## Security and public launch

V2 validates Telegram `initData` server-side, issues authenticated sessions with CSRF checks, and uses separate least-privilege PostgreSQL roles and FORCE RLS for private user records. Uploaded photos remain private until reviewed and published. Never place credentials in frontend `VITE_*` variables, expose database-owner secrets or bypass photo moderation.

Public admission uses `REM06_OPEN_SIGNUPS_ENABLED=1` only when all approved security gates are satisfied, with `REM06_BETA_INVITES_ENABLED=0`. A manual DB-credential provisioning workflow uses **open** admission mode by default but does not activate production features.

Project decisions: [docs/PRODUCT_DIRECTION.md](docs/PRODUCT_DIRECTION.md). Historical status: `docs/PROJECT_STATUS.md`; older two-account beta checklists are obsolete and must not drive launches.
