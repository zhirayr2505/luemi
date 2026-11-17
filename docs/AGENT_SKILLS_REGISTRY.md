# LUEMI Agent Skills Registry

**Integrated:** 17 November 2026  
**Location:** `.agents/skills/`  
**Scope:** repository-local agent guidance only. This package adds no runtime dependency and does not change user-facing application code.

## Integrated and pre-existing skills

| Skill | Purpose in LUEMI | Source / status |
|---|---|---|
| `gestures` | 1:1 drag, swipe, release physics and interruptible sheets | Pre-existing in main; adapted for LUEMI |
| `modern-web-guidance` | Modern browser behavior and web platform guidance | Pre-existing in main |
| `find-skills` | Discover and vet future skills before installation | Adapted from [vercel-labs/skills](https://github.com/vercel-labs/skills) |
| `code-review` | Spec + standards + security review of diffs/PRs | LUEMI adaptation inspired by [mattpocock/skills](https://github.com/mattpocock/skills) |
| `domain-modeling` | Maintain domain glossary and architecture decisions | [mattpocock/skills](https://github.com/mattpocock/skills) |
| `research` | Primary-source technical research | LUEMI adaptation inspired by Matt Pocock |
| `handoff` | Durable session/context transfer | LUEMI adaptation inspired by Matt Pocock |
| `to-spec` | Turn settled requirements into testable specs | LUEMI adaptation inspired by Matt Pocock |
| `architecture-audit` | Review codebase friction, boundaries and technical debt | LUEMI adaptation inspired by Matt Pocock's architecture skill |
| `systematic-debugging` | Root-cause debugging before fixes | [obra/superpowers](https://github.com/obra/superpowers) |
| `test-driven-development` | Regression-first behavior changes | [obra/superpowers](https://github.com/obra/superpowers) |
| `writing-plans` | Small, independently verifiable implementation plans | [obra/superpowers](https://github.com/obra/superpowers) |
| `executing-plans` | Stepwise plan execution and checkpoints | [obra/superpowers](https://github.com/obra/superpowers) |
| `verification-before-completion` | Fresh evidence before success/merge claims | [obra/superpowers](https://github.com/obra/superpowers) |
| `react-best-practices` | React rendering, bundle and client performance | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| `web-design-guidelines` | UI/accessibility audit without overriding approved design | Adapted from [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) |
| `supabase-postgres-best-practices` | Query, schema, pooling, locking, privileges and RLS reviews | [supabase/agent-skills](https://github.com/supabase/agent-skills) |
| `webapp-testing` | Playwright browser validation adapted to Node | LUEMI adaptation inspired by [anthropics/skills](https://github.com/anthropics/skills) |
| `skill-creator` | Create and validate future project-local skills | LUEMI-authored |
| `luemi-motion-architecture` | Preserve motion-controller, gesture-arbiter and Profile Morph V3 | LUEMI-authored |
| `luemi-telegram-webview-qa` | Separate browser and physical Android/iOS acceptance | LUEMI-authored |
| `luemi-security-review` | Telegram auth, privacy, media, Postgres/RLS safety gates | LUEMI-authored |

## Upstream snapshots

The source repositories were inspected at these Git tree commits when this package was assembled:

| Source | Pinned snapshot |
|---|---|
| mattpocock/skills | `5863806dd4e15c63174bee4e7515a4256792ecfa` |
| obra/superpowers | `22f0b463e7a5e579904dd6211a520321035526f7` |
| anthropics/skills | `e4bb5d960d87126ff3b3a8af1a104b7db67560ba` |
| vercel-labs/agent-skills | `1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62` |
| supabase/agent-skills | `c9be0e931b7930f7d02126d04774d904c381e7d7` |
| vercel-labs/skills | `57217cf86ba38148a57af9e90d14a4c049558330` |

The React guide's compiled rule reference is stored as `.agents/skills/react-best-practices/RULES.md`. The Postgres skill includes focused reference files for query performance, connection management, concurrency, schema, and RLS. License notices for copied MIT material are under `.agents/skills/_licenses/`; the Anthropic webapp-testing license is kept with that skill.

## Deliberate exclusions

The article's list is a discovery catalogue, not a mandate to install all 50 items. These are excluded from the LUEMI repo for concrete compatibility reasons:

- **Next.js-only workflows and server-component rules:** LUEMI is React 19 + Vite; only general React/client rules are applied.
- **shadcn:** LUEMI does not use shadcn/ui; importing its instructions would encourage an unapproved UI stack.
- **UI-UX Pro Max, frontend-design, design-taste, brandkit, theme-factory, Impeccable:** the app already has an owner-approved visual system and references. A broad redesign skill could conflict; use the constrained web-design audit instead.
- **Agent Browser / Browser Use:** redundant for the current repo, which already has Playwright and an explicit browser QA workflow.
- **Subagent-driven development:** not installed as a default because this workflow cannot assume subagent availability.
- **Triage / ticket publication:** not installed because the repository has no confirmed issue-label/tracker configuration; do not auto-create labels or modify issues.
- **SEO, copywriting, PPTX, PDF, DOCX, XLSX, web-artifacts-builder, MCP-builder:** useful elsewhere, but not core to LUEMI runtime engineering.
- **Supabase JS SDK-specific advice:** the API uses Fastify + `pg`; Postgres rules are applied to SQL and RLS without assuming the Supabase client library.

## Operating rules

1. Load only skills relevant to the task.
2. Read the actual implementation and current project decisions before applying generic guidance.
3. Never let a skill override root `AGENTS.md`, owner-approved product/design decisions, or security gates.
4. Never execute a skill's remote shell installer or add runtime dependencies without a specific review and authorization.
5. Update this registry when adding, removing, or materially adapting skills.
6. Run skill-content checks (frontmatter, references, duplicate names, unsupported tools) before merging changes.
