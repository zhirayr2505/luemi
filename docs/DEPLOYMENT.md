# Staging deployment · LUEMI

2026-10-19: Separate Render FREE service `luemi-stage01` created in the existing confirmed `My Workspace`, Frankfurt region. HTTPS URL: https://luemi-stage01.onrender.com. Git branch: `staging/telegram-miniapp-20261019`, autoDeploy: YES. Production-style `main` service `luemi` was not changed.

Build: `npm install --include=dev --no-audit --no-fund && npm run build`
Start: `npm run start -w @luemi/api`
Stage variables (safe public values ONLY):
- NODE_ENV=production
- STAGING_BOOTSTRAP_ONLY=1
- APP_ORIGIN=https://luemi-stage01.onrender.com

Render reported LIVE for deploy dep-dbb19hlg1s2s73dt3d6g. No bot secrets configured yet. Staging API is intentionally fail-closed (auth 503; webhook 404) until credentials are installed privately on this service.

Bot activation requires owner-provided LUEMI test bot from @BotFather, secret environment variables and Telegram webhook/menu button configuration; see TELEGRAM_MINI_APP.md. No public dating features or payments should be exposed.

## REM-00B CI / Render command reconciliation (documentation only; 2026-10-22)

The command documented above is a historical snapshot, **not re-verified against the live Render dashboard**. It uses npm install with floating resolution and runs `npm run build`, whose `prebuild` does not include `test:discovery`. It is not equivalent to the new mandatory release gate. No Render configuration has been changed.

For a future separately approved deployment after the required CI gates are genuinely green: use a pinned Node 22.16.0/npm 10.9.2 runtime and consider `npm ci --include=dev --no-audit --no-fund && npm run check && npm run build`. This clean-installs the exact dependency graph, rejects broken gates before deployment, and may duplicate lint/prebuild checks. Check Render platform Node/npm support and runtime minutes first. Current source-marker and historical browser gates are red; do **not** deploy just by using the new proposed command.
