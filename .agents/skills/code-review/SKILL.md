---
name: code-review
description: Review LUEMI diffs and pull requests for correctness, project conventions, security, regressions, scope, and fit to the originating specification. Use before merge or when asked to review code.
---

# LUEMI code review

Perform one evidence-based review in this agent context. Do not assume subagents or an issue-tracker integration exists.

## Inputs and fixed point

- Resolve the PR, branch, commit, or user-supplied base.
- Compare with the merge base (three-dot diff when using Git).
- Read the originating spec/issue when present. If none exists, say so.
- Read root `AGENTS.md`, relevant package conventions, `docs/DECISIONS.md`, and any domain-specific glossary/ADR.

## Review axes

### Standards
Look for project-standard violations and likely Fowler smells, but treat smells as heuristics, not automatic blockers. Check naming, duplication, data clumps, feature envy, divergent/shotgun changes, speculative generality, middle-man wrappers, long message chains, and unnecessary abstractions. Existing LUEMI decisions override generic advice.

### Specification
Check missing or partial requirements, incorrect behavior, accidental scope expansion, changed visual or gesture contracts, and tests that fail to prove user-visible behavior. Quote or point to the exact requirement and diff location.

## LUEMI-specific review gates

- Telegram `initData` must be verified server-side. Never trust `initDataUnsafe`.
- Keep secrets out of source and browser `VITE_*` variables.
- Check CSRF, origin, request limits, session lifecycle, ownership checks, least-privilege DB roles, and FORCE RLS where applicable.
- Private photos stay private until the approved moderation/publication flow allows access.
- No demo profiles or synthetic interactions in production paths.
- Preserve the approved wordmark, theme, Profile Morph V3, and existing motion/gesture arbitration unless the spec explicitly authorizes a change.
- Do not introduce a second writer for an already-controlled gesture surface.
- No production migration, Render deploy, Telegram setting change, or live data write as part of review.

## Findings format

Report only actionable findings, ordered Critical / High / Medium / Low. Each finding includes file and line (or function), impact, concrete failure scenario, and a minimal fix. Then list test gaps and a brief verdict: approve, request changes, or insufficient evidence. Never invent line numbers or say tests passed unless their output is available.
