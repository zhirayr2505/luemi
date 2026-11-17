---
name: architecture-audit
description: Audit LUEMI architecture, module boundaries, accumulated technical debt, or a proposed refactor. Use before large refactors or when recurring changes keep breaking unrelated areas.
---

# LUEMI architecture audit

Adapted for a single-agent workflow. Do not assume subagents, HTML reports, or a separate project glossary are configured.

## Explore

- Start with the user's named subsystem. Otherwise inspect recent history and repeated hotspots.
- Read root `AGENTS.md`, `README.md`, `docs/DECISIONS.md`, current architecture audits, and relevant package tests.
- Trace real call paths and ownership of state; do not infer architecture from filenames alone.
- Prefer locality and deep modules with small, testable interfaces. Apply the deletion test before suggesting extraction: does removing the abstraction concentrate understanding, or just move complexity?

## Report candidates

For each candidate record:
- Exact files and current call/data flow.
- Concrete friction or failure evidence.
- Smallest boundary change that improves locality.
- Tests that would become possible or simpler.
- Risks and compatibility impact.
- Recommendation strength: strong / worth exploring / speculative.

## LUEMI preservation rules

- Do not re-architect the existing motion controller, gesture arbiter, Profile Morph V3, Telegram bootstrap, or RLS model as incidental cleanup.
- Do not add new state-management, animation, router, UI, or database libraries without a demonstrated gap and explicit approval.
- Prefer measured performance evidence over theoretical optimization.
- A refactor proposal is not implementation authorization. Present findings before changing architecture.
