---
name: research
description: Research LUEMI engineering decisions against primary sources before changing architecture, framework APIs, performance rules, security, or platform behavior. Use when a task depends on current or niche external facts.
---

# Research

Research inline; do not assume a background agent is available.

1. Inspect actual code, docs, current dependency versions, and relevant Git history first.
2. Prefer primary sources: official framework documentation, specifications, vendor docs, source code, and release notes.
3. Confirm version applicability. Do not apply Next.js guidance to LUEMI's Vite SPA or assume APIs exist in installed versions.
4. Separate verified facts, inferences, and unknowns.
5. Cite external claims in the research note and include access dates.
6. Save durable findings under `docs/research/<topic>.md` only when the user asks for a record or the research will guide a long-running engineering decision.
7. Before making a code change, summarize conclusion, constraints, and what has not been verified.
