# Commit Guard Prompt

Use `docs/agent/HANDS_CODEX_WORKFLOW_GUARD.md`.

1. Run `git status --short`.
2. Confirm only current-task files are staged or will be staged.
3. Exclude generated folders, build artifacts, logs, screenshots, and unrelated dirty files.
4. Run focused tests if practical for the changed scope.
5. Commit with `type(scope): concise summary`.
6. Report the commit hash if committed.
7. If not committed, explain exactly why.
