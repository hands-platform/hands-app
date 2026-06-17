---
name: hands-token-saver
description: Use when HANDS work is becoming broad, repetitive, token-heavy, or likely to re-read files, re-run commands, or perform speculative cleanup.
---

# HANDS Token Saver

Read `docs/agent/HANDS_CODEX_WORKFLOW_GUARD.md` when token usage or search scope needs tightening.

Follow `docs/agent/prompts/token-saver.md`:

- Do not re-read already inspected files unless they changed.
- Do not summarize the whole repo.
- Avoid broad search unless required.
- Prefer targeted reads and focused diffs.
- Stop after the requested scope is verified and committed.
