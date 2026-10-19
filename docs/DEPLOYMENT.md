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
