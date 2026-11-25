# Admin Telegram user directory

- Apply `infra/migrations/0016_admin_telegram_users.sql` using the approved database operator before enabling capture.
- Provision a dedicated login with membership in `luemi_admin_users_reader` only; do not reuse existing database credentials. Keep the DSN in Render secrets.
- Set Render `LUEMI_ADMIN_USERS_DATABASE_URL` to that DSN, `LUEMI_ADMIN_TELEGRAM_ID` to the verified owner Telegram ID, and `LUEMI_CAPTURE_TELEGRAM_USERNAME=1`.
- Deploy after migration and role verification. Test `/users` and `/users 2` in the owner's private bot chat; verify other users and groups receive no data.
- Counts include active actors with published profiles in the configured namespace, not unfinished registrations. Old usernames can only be resolved when Telegram makes the private chat available to the bot; otherwise they become available after verified login. A missing username is explicitly marked.
- Disable capture and remove admin environment variables to turn off the feature.
