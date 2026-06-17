# Scoped Implementation Prompt

Use `docs/agent/HANDS_CODEX_WORKFLOW_GUARD.md`.

1. Run `git status --short` or `just status`.
2. Identify the exact files needed before editing.
3. Do not scan the whole repo.
4. Change only necessary files and keep scope to one area.
5. Preserve existing visible copy, counts, sorting, filters, smoke markers, and test expectations unless the task explicitly changes them.
6. Run focused tests only.
7. Summarize changed files, tests, risks, and the next task.
