---
name: find-skills
description: Discover and vet agent skills when a LUEMI task would benefit from a reusable engineering workflow, review checklist, specialist domain, or tool guidance.
---

# Find skills

Use the open Agent Skills ecosystem to discover capabilities, but treat the list as leads, not trusted code.

1. Search the official skills catalogue and likely upstream GitHub owners.
2. Verify the actual repository, skill path, latest commit, license, maintainer reputation, and skill description.
3. Read the complete skill and its bundled references; inspect scripts before recommending or running them.
4. Compare against existing `.agents/skills/` to avoid duplicates and contradictory advice.
5. Check compatibility with React 19 + Vite, Fastify 5, Node 22.16, Playwright, Telegram WebViews, PostgreSQL/Supabase, and LUEMI design/security constraints.
6. Prefer instruction-only skills over scripts or dependencies. Never run a remote installer as part of discovery.
7. Add only after an explicit user request or clear project authorization; use a feature branch, preserve license notices, update the registry, and open a reviewable PR.

Useful discovery sources: https://skills.sh/ and https://github.com/vercel-labs/skills
