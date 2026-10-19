# LUEMI · Telegram Mini App — @LuemiAppBot

The user opens @LuemiAppBot in Telegram. The **Telegram in-app WebView** renders the same-origin React Mini App, served from https://luemi-stage01.onrender.com.

## Status (2026-10-19)
- Test bot username provided by owner: `@LuemiAppBot`. Ownership and bot identity **NOT YET VERIFIED VIA GETME**.
- Render staging service is live and separate from main.
- Staging credentials are absent, so the app intentionally fails closed: no real authenticated users until configuration.
- On-server setup is available but gated by secret environment settings. Before setting the Telegram webhook or global menu, it checks bot identity `LuemiAppBot`, existing webhook, and existing Web App menu. It refuses to overwrite other configured endpoints.
- No real users, registration, payments or Supabase mutations.

## Owner's secure one-time setup (NEVER send credentials in chat)
Open Render → `luemi-stage01` → Environment and configure:

- `TELEGRAM_BOT_TOKEN`: bot's BotFather token, put **only in Render Environment**.
- `TELEGRAM_WEBHOOK_SECRET`: 24–256 random ASCII `A-Z a-z 0-9 _ -` characters, different from bot token.
- `HEALTH_CHECK_KEY`: random 24+ character secret, different from webhook secret.
- `EXPECTED_TELEGRAM_BOT_USERNAME=LuemiAppBot`
- `TELEGRAM_SETUP_ON_START=1`
- `STAGING_BOOTSTRAP_ONLY=0`
- Keep `APP_ORIGIN=https://luemi-stage01.onrender.com`.

After Render redeploy/startup, the server checks `getMe`, `getWebhookInfo`, and `getChatMenuButton`. If the bot is `LuemiAppBot` and no foreign webhook/menu is in use, the server uses Bot API `setChatMenuButton` and `setWebhook` to connect the in-Telegram menu and `/start` handler. The webhook header is validated with a constant-time comparison; requests without the correct secret are rejected. Bot tokens are not printed by this setup.

For the prominent profile **Launch App** button (Main Mini App), use @BotFather → /mybots → @LuemiAppBot → Bot Settings → Configure Mini App → Main App and point it to the same staging URL. BotFather menu navigation may vary. The Bot API global menu button is separate from the profile Main Mini App.

## Verification after secrets are entered
1. Open https://t.me/LuemiAppBot inside Telegram on the Galaxy A55.
2. Send `/start`; the bot should reply with a button `Открыть LUEMI 💜`.
3. Open the Mini App; verify that Telegram initData is accepted and a verified first name appears.
4. Check safe areas and light/dark theme.
5. Never use real users/photos for Stage 01. For approval, report a screenshot (without token, personal data or initData).

The app cannot directly modify BotFather settings without credentials. No token should be pasted into ChatGPT. An HTTPS URL alone doesn't register a bot.
