# LUEMI · Telegram Mini App pairing · @LuemiAppBot

## Infrastructure
- Telegram WebView app: https://luemi-stage01.onrender.com
- Server: Render FREE luemi-stage01; independent of original LUEMI main.
- Verified repo privacy: PRIVATE.
- Stage 01 only. Real account persistence, moderation, payments and registration are NOT enabled.

## Current safe settings (2026-10-19)
Already installed privately in Render staging:
- TELEGRAM_WEBHOOK_SECRET: generated secret, not published in any file
- HEALTH_CHECK_KEY: generated secret, not published in any file
- EXPECTED_TELEGRAM_BOT_USERNAME=LuemiAppBot
- TELEGRAM_SETUP_ON_START=1
- STAGING_BOOTSTRAP_ONLY=1 (keeps the bot unconnected)
- APP_ORIGIN=https://luemi-stage01.onrender.com

## Sole remaining private owner action
1. Open Telegram → @BotFather → /mybots → select @LuemiAppBot → API Token. Copy the token to clipboard and keep it secret.
2. In https://dashboard.render.com/web/srv-dbb19h5g1s2s73dt3bug → Environment, set TELEGRAM_BOT_TOKEN to the token using private Render input, and change STAGING_BOOTSTRAP_ONLY from 1 to 0. Save both together. Do not paste the token into a chat or commit.
3. Wait for Render redeploy. On server start, code checks `getMe` for exactly LuemiAppBot, checks the current webhook and global menu, and refuses to overwrite anything pointing to another service.
4. On successful checks, the server configures `setChatMenuButton` to open the staging app inside Telegram and `setWebhook` for `/api/telegram/webhook`. /start returns an in-Telegram Web App button.
5. Reopen https://t.me/LuemiAppBot inside Telegram, send /start, press 'Открыть LUEMI 💜' and verify a signed Telegram session.
6. A prominent profile 'Launch App' button is a **separate Main Mini App** feature configured through @BotFather and was not configured by backend code. BotFather menu labels may vary.

## Safety
- No bot token or webhook secret logged; token stays only in Render environment.
- No foreign webhook/menu overwritten if the bot was used elsewhere.
- All Bot API modifications are disabled in bootstrap-only mode.
- Only this bot and this staging domain can be managed by the auto-setup code; VEYRA/blotX untouched.
- Test with family/friends only after user consent, moderation and privacy review; no real user data during Stage 01.
