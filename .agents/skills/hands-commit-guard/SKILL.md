---
name: hands-commit-guard
description: Use when committing HANDS changes, preparing a local checkpoint, or checking that staged files exclude unrelated dirty files and generated artifacts.
---

# HANDS Commit Guard

Read `docs/agent/HANDS_CODEX_WORKFLOW_GUARD.md` if commit scope is not obvious.

Follow `docs/agent/prompts/commit-guard.md`:

- Check `git status --short`.
- Stage only current-task files.
- Exclude generated files and unrelated dirty files.
- Run focused verification when practical.
- Commit with `type(scope): concise summary`.
- Report the commit hash.
