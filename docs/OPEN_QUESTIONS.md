# Open questions / blockers · 2026-10-19

1. Identify LUEMI **test** Telegram bot username or create one using @BotFather (distinct from VEYRA/blotX). Owner should share @username only, NEVER a bot token in chat.
2. Securely set test bot credential and webhook secret in the staging Render environment; turn off STAGING_BOOTSTRAP_ONLY only after secrets set.
3. Configure BotFather Web App Menu Button and authenticated Telegram setWebhook. Web App URL: https://luemi-stage01.onrender.com. Do not redirect any production bot without confirmation.
4. Import exact original W04 PNG and approved reference screens as binary files, preserving all hashes. Currently only existing W06-derived wordmark used unchanged.
5. Complete Telegram Android (Galaxy A55) and iOS manual acceptance; real world external HTTPS request verification; session persistence, privacy/legal and security audit before live users.
6. Supabase staging schema and validated backup/restore are outstanding. Existing LUEMI DB and private bucket are not to be modified without backup and explicit approval.
