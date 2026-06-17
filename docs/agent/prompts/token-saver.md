# Token Saver Prompt

Use `docs/agent/HANDS_CODEX_WORKFLOW_GUARD.md`.

- Do not re-read already inspected files unless they changed.
- Do not summarize the whole repo.
- Do not perform speculative cleanup.
- Avoid broad grep/search unless the task requires it.
- Prefer targeted file reads and focused diffs.
- Stop after the requested scope is verified and committed.
