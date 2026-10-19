# Deployment policy
NO automatic release to Production. No Render blueprint committed or deployment performed from this branch.
For future staging: protect secrets, set APP_ORIGIN explicitly, use HTTPS, assign external API endpoint and deploy static Vite bundle. Supply TELEGRAM_BOT_TOKEN and HEALTH_CHECK_KEY as environment secrets. Set health checks to /api/health/live; /api/health/ready requires X-Health-Key and reports DB not_connected for Stage 01.
Manual device acceptance and owner approval required before a Telegram bot points to any staging URL.
