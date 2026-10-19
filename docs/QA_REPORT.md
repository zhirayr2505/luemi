# QA Report · 2026-10-19

## Source integrity
W12 Mobile archive 467/467 checksum records matched; exact W04 original logo and three approved light-screen PNG hashes verified. This proves source-file integrity only.

## CI and runtime
- GitHub Actions for staging commit `5a27ecae830bc513082b231890e2611ee0afa1c3`: SUCCESS, https://github.com/zhirayr2505/luemi/actions/runs/39256565233.
- TypeScript, ESLint, API HMAC tests, webhook unsigned-request tests, builds: PASSED.
- Render `luemi-stage01` deploy `dep-dbb19hlg1s2s73dt3d6g`: LIVE; logs show successful build and application startup.
- Local HTTP smoke test added to subsequent staging CI for root HTML, static logo, health, fail-closed auth and blocked webhook. Pending new commit CI.
- External live HTTP route response: NOT VERIFIED (direct fetch unavailable from connected reader).
- Actual Telegram bot interaction, initData inside Telegram WebView, Galaxy A55, cross-device layout, WCAG 2.2 AA: NOT TESTED.
- Actual paid features and production readiness: NOT TESTED/NOT IMPLEMENTED.
