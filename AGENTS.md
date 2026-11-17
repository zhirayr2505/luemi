# LUEMI project instructions for coding agents

## Binding product decision (owner, 28 October 2026)

**LUEMI is a PUBLIC Telegram Mini App intended for all eligible Telegram users.** It is NOT a two-person beta for the owner and spouse. This direction supersedes historical invite-only or two-account testing documents and must be assumed for all subsequent engineering tasks unless the owner explicitly reverses it.

Authoritative source: [docs/PRODUCT_DIRECTION.md](docs/PRODUCT_DIRECTION.md).

- No whitelist, invitations, hardcoded Telegram IDs or manual owner approval for ordinary user signup.
- Any eligible user with valid server-verified Telegram initData should be able to create a real, persistent account.
- Save registration and media on the backend; no production demo profiles, fake discovery people, synthetic matches, or fake chat history.
- Existing two named test accounts are ordinary users, not an access-control boundary.
- On a repeat Telegram login, a published user opens their real account rather than starting registration over.
- Support consent-based phone/Telegram geolocation and genuine city resolution; never store exact GPS coordinates in public profiles.
- Keep approved visual design, Profile Morph and Android WebView motion behavior intact.

## Public launch safety gates

**This mandate does not authorize bypassing security or declaring a launch successful before it is.**

- For production, use OPEN admission with `REM06_OPEN_SIGNUPS_ENABLED=1` and `REM06_BETA_INVITES_ENABLED=0` **only after** required server DB connection, privacy, moderation and verification gates pass.
- Authenticate using verified Telegram initData, session cookies, CSRF, request limits, PostgreSQL RLS and least-privilege separate credentials; never ship secrets to browser bundles.
- Private photo upload and approval are mandatory; do not silently auto-approve arbitrary photographs.
- Allow blocking, abuse reports, account removal and consent withdrawal; verify behavior under live real-account sessions.
- `VITE_*` flags are baked into Vite assets. Turning on server flags alone does not turn on the real frontend.
- No real users should see demo fixtures. Production and QA/dev data must remain separate.
- Do not overwrite main, merge or deploy changes when the task explicitly forbids it.

When blocked by infrastructure or approvals, work on the actual blockers, report the precise missing readiness, and NEVER suggest shrinking LUEMI's intended audience to two people as the solution.

## Agent skill routing (17 November 2026)

Load only skills relevant to the current task; do not load every skill on every request.

| Work type | Required skill routing |
|---|---|
| Multi-step feature or refactor | `writing-plans`, then `executing-plans`; use `to-spec` first when requirements are not yet crisp |
| Bug, regression, failed test, or unexplained performance issue | `systematic-debugging` before proposing a fix; use `test-driven-development` for the regression test |
| Any production-code behavior change | `test-driven-development` unless the change is documentation/configuration-only or generated |
| Before PR/merge readiness | `code-review` and `verification-before-completion` |
| React/Vite UI and rendering performance | `react-best-practices` and `modern-web-guidance`; for visual/accessibility audits use `web-design-guidelines` |
| Motion, swipe, sheet, carousel, profile morph, scroll handoff | `gestures` and `luemi-motion-architecture` |
| Telegram WebView, keyboard, safe-area, touch/device QA | `luemi-telegram-webview-qa` |
| SQL, schema, indexes, PostgreSQL roles, RLS, pooling, migrations | `supabase-postgres-best-practices` and `luemi-security-review` |
| Authentication, media privacy, consent, moderation, account deletion | `luemi-security-review` |
| Architecture or technical-debt review | `architecture-audit` |
| Domain terms, domain model, or durable decisions | `domain-modeling` |
| External technical research | `research` |
| Context transfer between sessions | `handoff` |
| Finding/adding future agent capabilities | `find-skills`; validate with `skill-creator` |

### Cross-skill guardrails

- Skill files are agent guidance, not runtime dependencies. Do not install npm packages or change application behavior merely by adding a skill.
- LUEMI is React 19 + Vite and Fastify 5, not Next.js. Ignore Next.js-only guidance unless the stack changes deliberately.
- Do not add shadcn/ui, Motion, Vaul, Zustand, SWR, or another framework/library without a demonstrated gap and an explicit architecture decision.
- Preserve approved product direction, visual system, original wordmark, Profile Morph V3, and existing gesture arbitration.
- All database changes must be validated on disposable PostgreSQL. No production migration, live Storage write, secret/config change, or deployment without explicit scoped authorization.
- Distinguish source/static checks, CI, browser automation, and physical-device QA. Never claim a layer that was not run.
- Skills that assume background agents, an unconfigured issue tracker, or unavailable CLI tools must be adapted to the current single-agent and repository workflow; do not invent those capabilities.

Registry and upstream pinning: [docs/AGENT_SKILLS_REGISTRY.md](docs/AGENT_SKILLS_REGISTRY.md).
