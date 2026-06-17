---
name: hands-admin-api-split-guard
description: Use when a HANDS task might mix Admin Web, NestJS API, Flutter apps, infra, docs, Prisma, or protected business logic unintentionally.
---

# HANDS Admin API Split Guard

Read `docs/agent/HANDS_CODEX_WORKFLOW_GUARD.md` when surface boundaries matter.

Follow `docs/agent/prompts/admin-api-split-guard.md`:

- Keep Admin UI work in Admin unless an API change is required.
- Keep API business logic work in API.
- Isolate protected logic: auth, booking, matching, payments, settlement, wallet, Prisma, realtime contracts, permissions, and security-sensitive changes.
- Preserve visible copy, counts, sorting, filters, smoke markers, and test expectations unless explicitly changing them.
