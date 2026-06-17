# Admin API Split Guard Prompt

Use `docs/agent/HANDS_CODEX_WORKFLOW_GUARD.md`.

- Admin UI changes should stay in Admin unless an API contract change is required.
- API business logic changes should stay in API.
- Flutter, infra, docs, and scripts should not be mixed into Admin/API work unless the task is explicitly cross-surface.
- Protected logic requires isolated review: auth, booking state, matching, payments, settlement, wallet, Prisma schema, realtime contracts, permissions, and security-sensitive changes.
- Preserve visible copy, counts, sorting, filters, smoke markers, and test expectations unless explicitly changing them.
