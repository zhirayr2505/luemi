---
name: requesting-code-review
description: Request or perform a focused review of completed LUEMI work before merging. Use after a major feature, each independently reviewable plan task, or before a PR becomes ready to merge.
---

# Requesting code review in LUEMI

The upstream workflow assumes subagents. LUEMI's default workflow must not assume subagent availability.

1. Capture the base and head SHAs and inspect the complete diff.
2. Read the originating spec/plan and the root `AGENTS.md`.
3. Use the sibling `code-reviewer.md` prompt as a checklist for a read-only, evidence-based review in this agent context or hand it to a human reviewer.
4. Report strengths, then Critical / Important / Minor issues with concrete file/line references.
5. Fix critical and important issues before making the PR ready. Record unresolved judgment calls explicitly.
6. Run `verification-before-completion` after fixes and before claiming merge readiness.

Do not pretend that a separate reviewer agent was dispatched when no such agent tool is available. Never self-approve or merge a PR merely because the checklist was completed.

The template is intentionally a review rubric; it does not authorize branch changes, deployments, migrations, or production writes.
