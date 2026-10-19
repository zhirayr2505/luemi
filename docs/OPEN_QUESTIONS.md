# Open questions / blockers · 2026-10-19

1. Owner supplied @LuemiAppBot as the intended Telegram bot. Identity will be verified with Bot API getMe after the owner supplies the bot's credential privately to Render.
2. Bot token MUST be added only in the dedicated staging Render Environment as TELEGRAM_BOT_TOKEN. Switch STAGING_BOOTSTRAP_ONLY from 1 to 0 in the same settings save. Never paste token or signed Telegram initData in ChatGPT, GitHub or screenshots.
3. Service-only HEALTH_CHECK_KEY and TELEGRAM_WEBHOOK_SECRET have been generated and stored privately in Render staging on 2026-10-19. The exact values are never included in repository documentation. Safe values EXPECTED_TELEGRAM_BOT_USERNAME=LuemiAppBot and TELEGRAM_SETUP_ON_START=1 are also configured.
4. After Render restart, startup setup verifies bot username and does not overwrite existing foreign webhook or Mini App menu. Only when safe does it set staging webhook and Telegram Web App menu.
5. The Main Mini App button on the Telegram bot profile, if desired, may need to be configured in BotFather; do not infer that this was changed.
6. Import exact original W04 logo PNG and W04 approved reference screens as hash-verified binaries. Present staging uses pre-existing W06 derivative.
7. Telegram Galaxy A55 physical acceptance, real client initData, schema staging isolation and independent security/legal evaluation are outstanding. Existing LUEMI Supabase production schema remains unchanged.
