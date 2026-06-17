---
name: hands-scoped-implementation-guard
description: Use when starting a HANDS implementation task, feature slice, bugfix, refactor, or UI change that should stay small, focused, and verified without broad repo scanning.
---

# HANDS Scoped Implementation Guard

Read `docs/agent/HANDS_CODEX_WORKFLOW_GUARD.md` first when scope is unclear or the task could sprawl.

Follow `docs/agent/prompts/scoped-implementation.md`:

- Start with `git status --short` or `just status`.
- Identify exact files before editing.
- Keep the task to one surface unless integration is required.
- Run focused tests only.
- Summarize changed files, checks, risks, and the next task.
