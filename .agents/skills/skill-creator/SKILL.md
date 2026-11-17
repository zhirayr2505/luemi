---
name: skill-creator
description: Create or improve repository-local agent skills for repeatable LUEMI engineering workflows. Use when the user asks to add a skill or a recurring workflow deserves a dedicated instruction package.
---

# Skill creator for LUEMI

Create skills under `.agents/skills/<skill-name>/SKILL.md`.

## Design

- Name a narrow repeatable job; description must clearly state when the skill triggers.
- Keep instructions concise, actionable, and project-specific.
- Prefer progressive disclosure: put detailed checklists, templates, and reference material in sibling files and link them from SKILL.md.
- Identify prerequisites, required inputs, outputs, safety boundaries, and verification.
- State when not to use the skill and identify overlapping skills.
- Do not claim tools, scripts, subagents, or runtime capabilities that are not available.
- Do not install packages or execute remote scripts just because an upstream skill recommends them.
- Keep LUEMI's approved product, design, motion, auth, and database decisions intact.

## Validation

For every new skill:
1. Verify frontmatter has a stable `name` and useful `description`.
2. Verify every referenced local file exists.
3. Check for unsupported instructions such as unavailable Skill-tool calls, background agents, or unconfigured tracker labels.
4. Check source repository and license; retain attribution when adapting third-party material.
5. Add the skill to `docs/AGENT_SKILLS_REGISTRY.md` and root `AGENTS.md` routing only when appropriate.
6. Test the description against at least three example prompts: one clear trigger, one borderline trigger, and one non-trigger.
