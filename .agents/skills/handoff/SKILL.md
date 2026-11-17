---
name: handoff
description: Create a durable handoff so a new ChatGPT/Codex session can continue LUEMI without repeating repository discovery. Use at the end of a long task, before switching context, or when asked to save project progress.
---

# LUEMI agent handoff

When requested, create or update `docs/engineering/HANDOFF.md` (or a dated file under `docs/engineering/handoffs/` when preserving history).

Include:
- Goal and user-approved scope.
- Current branch, base commit, latest commit, and PR URL/state.
- What changed, with exact paths and commit references.
- Decisions and constraints that must not be re-litigated.
- Verification commands actually run, outcomes, and checks NOT RUN.
- Remaining blockers and the next smallest useful step.
- Relevant skills to load in the next session.

Do not duplicate full specs, diffs, or design docs; link to them. Redact credentials, tokens, personal data, private user details, and production identifiers. Never imply background work is continuing after the session.
