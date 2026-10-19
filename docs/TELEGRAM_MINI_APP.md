# LUEMI · Telegram Mini App launch guide

The user launches LUEMI from a Telegram bot. This is a Telegram Web App (Mini App) rendered in the Telegram in-app WebView, not a standalone browser registration app. The same HTTPS Render service serves the built React bundle and Fastify API.

## Implemented
- Loads official Telegram WebApp SDK from https://telegram.org/js/telegram-web-app.js
- Reads raw `Telegram.WebApp.initData` and verifies hash + timestamp server-side; rejects malformed or tampered payloads.
- Secure optional bot webhook `POST /api/telegram/webhook` with `X-Telegram-Bot-Api-Secret-Token`; `/start` yields a Telegram `web_app` inline button pointing to APP_ORIGIN.
- Works in staging without bot token ONLY in locked bootstrap mode; authentication returns HTTP 503 and explicitly shows pending status.
- Does not register webhook or configure bot without owner-managed secrets.

## Owner's manual Telegram steps when staging URL is verified
1. Open @BotFather in Telegram. Create a separate LUEMI test bot via /newbot or select your existing LUEMI test bot via /mybots; DO NOT reconfigure an unrelated bot.
2. Keep the bot token secret: enter it in the dedicated Render staging environment, never in GitHub/chat. Set `STAGING_BOOTSTRAP_ONLY=0`, `TELEGRAM_BOT_TOKEN`, `HEALTH_CHECK_KEY` and `TELEGRAM_WEBHOOK_SECRET` there. Use a long random token for webhook secret using ASCII letters/numbers/dashes/underscores.
3. Once the backend supports credentials and the correct APP_ORIGIN, register webhook via Telegram Bot API `setWebhook` with URL `APP_ORIGIN/api/telegram/webhook` and `secret_token`; the method must be invoked in a trusted environment, never by inserting bot token into a public URL.
4. Under @BotFather /mybots → select test bot → Bot Settings → Menu Button → Configure Menu Button, set verified `https://...` staging URL. Menu labels can use “Открыть LUEMI”.
5. Open the bot within Telegram and tap the menu button. Validate real initData, UI safe areas, and login. /start sends an inline Web App button once webhook registered.

## Explicitly not implemented
User registration, persistent login session, account persistence, discovery, real messages, payments, production switch, independent penetration testing and smartphone acceptance.
