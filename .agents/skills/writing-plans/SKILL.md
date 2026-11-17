---
name: writing-plans
description: Use when LUEMI work spans multiple steps, multiple modules, or needs an explicit testable sequence before implementation.
---

# Writing implementation plans for LUEMI

Write a plan before touching production code for multi-step work. Use requirements already present in the conversation and repository; ask only about an ambiguity that blocks a safe decision.

## Before planning

1. Read root `AGENTS.md`, relevant product decisions, the active spec, and related code/tests.
2. Identify the subsystem and recent changes. Do not design against a guessed architecture.
3. Separate required behavior from optional improvements. Keep unrelated refactors out.
4. Identify operations that require explicit owner approval: production DB, Storage, credentials, Telegram/Render settings, paid services, publish, merge, and deployment.

## Plan structure

Save durable plans under `docs/engineering/plans/<YYYY-MM-DD>-<topic>.md`.

Each plan includes:

- **Goal:** the user-visible outcome.
- **Current state:** relevant files, modules, call paths, and existing contracts.
- **Constraints:** approved design, product, security, compatibility and performance decisions.
- **Tasks:** small sequential steps, with exact files/modules to inspect or change.
- **Tests:** a failing behavior test first, the exact verification command, and expected result.
- **Risks:** edge cases, migration/compatibility effects, and things deliberately not changed.
- **Acceptance:** observable criteria and evidence required to close the work.

## Task sizing

A task should be independently reviewable and have its own narrow verification. Prefer end-to-end vertical slices where appropriate. For wide mechanical refactors, use expand → migrate in small green batches → contract. Do not split work merely by frontend/backend layer when that creates non-working intermediate steps.

## LUEMI-specific planning constraints

- Use Node 22.16+, React 19 + Vite, Fastify 5, TypeScript, PostgreSQL and the existing Playwright/Node test setup.
- Preserve the approved design system, original wordmark, Profile Morph V3 and current motion/gesture architecture unless the task explicitly changes them.
- Include Android Telegram WebView and iOS WKWebView acceptance when the change touches layout, keyboard, media or gestures. Mark physical-device checks as manual.
- Database changes require disposable PostgreSQL tests, including negative cross-user/RLS cases.
- No new framework, animation, state, router or UI dependency without demonstrated need and explicit architecture approval.
- No plan authorizes production migrations, live writes, merge or deploy.
