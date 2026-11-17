---
name: to-spec
description: Convert an LUEMI feature request or settled conversation into a clear, testable product/engineering specification. Use before implementing a multi-step feature with user-visible behavior or schema/API impact.
---

# LUEMI specification authoring

Synthesize requirements already present in the conversation and repository. Ask only for a genuinely blocking ambiguity; do not re-interview the user about settled decisions.

## Workflow

1. Read root `AGENTS.md`, relevant product direction, current UI/design decisions, related code, tests, and open PRs.
2. Separate the user problem from the proposed implementation.
3. State actors, entry points, main flow, edge cases, failure states, permissions, privacy, and non-goals.
4. Record architecture decisions only where the codebase or user direction supports them. Mark assumptions explicitly.
5. Define observable acceptance criteria, including mobile/Telegram WebView behavior where applicable.
6. Map each criterion to the test type that can prove it (unit, contract, API/RLS, browser, physical device).
7. Save approved specs under `docs/specs/<feature>.md` and link related decisions.

Do not create GitHub issues, labels, milestones, migrations, branches, or PRs automatically. Publish or split into tickets only when explicitly requested. Avoid brittle implementation details in product requirements; include exact API/schema contracts only when they are themselves an approved decision.
