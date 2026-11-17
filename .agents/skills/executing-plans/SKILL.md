---
name: executing-plans
description: Use when implementing an approved LUEMI plan task by task in the current agent session, especially when no delegated subagent runner is available.
---

# Executing plans in LUEMI

Execute the approved plan in the current feature branch. Do not assume background workers, subagents, hidden worktrees, or unconfigured scripts.

## Start

1. Confirm the current branch and base commit. Never work directly on `main`.
2. Read the complete plan and linked spec.
3. Check the working tree and recent diff for unrelated changes.
4. Confirm every referenced file, script and command exists before relying on it.

## For each task

1. Re-read the task, constraints, and expected outcome.
2. Use `test-driven-development`: write one behavior-focused failing test and confirm the failure is the intended one.
3. Implement the smallest change that makes the test pass.
4. Run the focused test, then relevant package/contract checks.
5. Inspect the diff for scope creep, broken contracts, secrets, and accidental design/motion changes.
6. Record the exact test command and result before moving to the next task.
7. If a task fails unexpectedly, stop and use `systematic-debugging`; do not stack speculative fixes.

## Stop and ask before

- Any irreversible or destructive operation.
- Production migration or live Supabase/Storage write.
- Credential, secret, webhook, Telegram or Render configuration changes.
- Paid services or new recurring costs.
- Publishing, merging to `main`, deployment, or changes to real user data.
- A plan ambiguity that could affect privacy, authorization, money, or user-visible product behavior.

## Finish

1. Run `code-review` as a separate read-only review pass. Be honest that it is a self-review if no independent reviewer is available.
2. Fix Critical/High findings with a regression test and re-run the relevant suite.
3. Run `verification-before-completion` with fresh evidence. A narrow check does not imply the full root suite passed.
4. Update the plan/handoff with exact commit, tests, evidence, and unrun manual checks.
5. Leave the feature branch and PR for owner review. Do not merge or deploy unless explicitly authorized.

## LUEMI verification

Use the existing root npm scripts. Depending on scope:
- `npm run test:source-contracts`
- `npm run test:ui`
- `npm run test:gesture-contract`
- `npm run test:motion-contract`
- `npm run test:geometry-contract`
- `npm run test:motion-chaos`
- `npm run test:api:isolated`
- `npm run typecheck`
- `npm run build`
- `npm run check`

Do not report physical Galaxy A55/iOS acceptance from browser emulation.
