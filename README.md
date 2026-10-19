# LUEMI · Clean Foundation

Independent Stage 00–01 implementation. Source of truth: W12 passport + APPROVED W04 visual references. This branch deliberately does not import legacy profile hooks, CSS or animations.

**No production deploy, no payments, no registration, no public user data.**
The UI is a functional Telegram authentication bootstrap, not a fake dating application. Canonical raster wordmark is intentionally not committed while repository visibility is PUBLIC. Upload it only after private visibility has been verified.

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

## Security boundary
Telegram hash and TTL are checked on server, never trusted from client-side user data. Bootstrap returns only the verified user's name and ID; it does **not** create an app session or write to a database. No restricted feature is exposed. A full session model, CSRF plan, schema migration, moderation and privacy/legal sign-off are required before Beta.

See `docs/PROJECT_STATUS.md` and `docs/OPEN_QUESTIONS.md`.
