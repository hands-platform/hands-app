# Development Workflow

## Project Summary

This repository is a medium monorepo:

- Node workspace with NestJS API, Next.js admin web, and shared TypeScript types.
- Two Flutter apps for customer and partner mobile flows.
- Prisma schema and migrations for PostgreSQL.
- Docker Compose for Postgres, Redis, and object storage.
- Supabase SQL and external service setup checks.
- Existing local, smoke, policy, and mobile verification scripts.
- GitHub Actions exists for Node, Prisma, API, and Admin checks.

## Selected Parallel Mode

Selected: Parallel Mode 2, Limited Write Parallelism.

Reason:

- The repo has clearly separated apps and packages.
- Admin UI, mobile UI, docs, and isolated API modules can be worked independently.
- Shared contracts, Prisma schema, payments, wallet, matching, auth, realtime events, and environment configuration can break multiple apps and must stay sequential.

Rejected modes:

- Mode 0 is too slow because the repo has independent app folders.
- Mode 1 is useful for audits, but write work is also safe when scoped.
- Mode 3 adds worktree overhead that is not needed for the current pace.
- Mode 4 adds too much coordination unless a large feature batch is planned.

## Selected Workflow Model

Selected: Model B, Split Workflow.

Allowed parallel work:

- Admin page-only UI changes.
- Customer app page/widget changes.
- Partner app page/widget changes.
- API module work that does not touch protected contracts.
- Docs and local scripts.

Forbidden parallel work:

- Prisma schema or migrations.
- Auth, payment, wallet, settlement, matching, booking state machines.
- Shared types and public API response shapes.
- Realtime event names and room rules.
- Environment, Docker, deployment, and CI configuration.

Sequential work:

- Any change that spans API plus mobile/admin.
- Any policy change that affects booking, wallet, settlement, or taxes.
- Any database migration.

## Task Partition

| Task                   | Type      | Allowed scope                       | Forbidden scope                                          | Checks                            | Risk   | Merge order                   |
| ---------------------- | --------- | ----------------------------------- | -------------------------------------------------------- | --------------------------------- | ------ | ----------------------------- |
| Admin Worker           | Write     | `apps/admin_web/**`                 | API contracts, Prisma, env                               | `verify:scope -- -Scope admin`    | Medium | Before full verify            |
| API Worker             | Write     | isolated `apps/api/src/<module>/**` | Prisma, auth, wallet, payments, matching unless approved | `verify:scope -- -Scope api`      | High   | Before admin/mobile consumers |
| Customer Mobile Worker | Write     | `apps/customer_app/**`              | shared API contracts, provider app                       | `verify:scope -- -Scope customer` | Medium | After API contract stability  |
| Partner Mobile Worker  | Write     | `apps/provider_app/**`              | shared API contracts, customer app                       | `verify:scope -- -Scope provider` | Medium | After API contract stability  |
| Docs/Harness Worker    | Write     | `docs/**`, `infra/scripts/**`       | business logic, schema                                   | `verify:scope -- -Scope harness`  | Low    | Any time                      |
| Read-Only Review       | Read-only | whole repo                          | no edits                                                 | report only                       | Low    | Before large work             |

## Protected Areas

Free-edit areas:

- isolated admin route files
- isolated Flutter widgets and feature presentation files
- feature-specific tests
- local docs

Review-required areas:

- `apps/admin_web/lib/**`
- `apps/*/lib/src/core/**`
- `apps/api/src/common/**`
- `infra/scripts/**`
- package scripts
- app routing and shared UI helpers

Locked areas:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/**`
- `apps/api/src/auth/**`
- `apps/api/src/payments/**`
- `apps/api/src/provider-wallet/**`
- `apps/api/src/matching/**`
- `apps/api/src/bookings/**`
- `packages/shared-types/**`
- `infra/supabase/**`
- `.env*`
- `docker-compose*.yml`
- `.github/workflows/**`

Locked areas require explicit plan, integration review, and Tier 2 plus Tier 3 checks when runtime behavior changes.

## Harness Tiers

| Tier                  | Command                                                                                   | Purpose                                          | When                                     | Duration       | Skip conditions                   |
| --------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------- | -------------- | --------------------------------- |
| Tier 0 Preflight      | `npm.cmd run verify:preflight`                                                           | Check repo, branch, tools, and protected changes | before work or after environment changes | fast           | none                              |
| Tier 1 Fast Local     | `npm.cmd run verify:api:fast`, `verify:admin:fast`, `verify:customer:fast`, `verify:provider:fast` | Verify one area                                  | during scoped work                       | fast to medium | skip unrelated scopes             |
| Tier 1A Worker        | same as Tier 1 by owned scope                                                             | Parallel worker handoff                          | before worker reports done               | fast to medium | skip if read-only                 |
| Tier 2 Full Local     | `npm.cmd run verify:full` or `npm.cmd run verify:local`                                   | Full repo verification without service smoke     | before protected merge or release chunk  | medium to slow | never skip before protected merge |
| Tier 3 Integration    | `powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices` | Docker, migration, seed, API/realtime smoke      | DB/API/shared contract changes           | slow           | skip for docs-only or isolated UI |
| Tier 4 Heavy Optional | `npm audit --audit-level=moderate`, manual emulator/browser checks                        | Security and UX confidence                       | release prep or suspicious changes       | slow           | optional during normal coding     |

Daily Codex cadence:

- Docs or copy only: use the directly relevant script, or `npm.cmd run verify:preflight` when branch safety matters.
- Admin-only UI/data shaping: use targeted Jest when a helper changes, then `npm.cmd run verify:admin:fast`.
- API/booking/matching/payment/wallet changes: use the focused Jest spec first, then `npm.cmd run verify:api:fast`; run Tier 3 when DB/runtime behavior changes.
- Flutter-only changes: use the touched app test/analyze, or `npm.cmd run verify:customer:fast` / `npm.cmd run verify:provider:fast`.
- Cross-surface contract changes: use `npm.cmd run verify:node:fast`, the touched Flutter app check, then a full verify before push or release.

## Review Rules

- Evidence first: run the relevant scope check before claiming a task is complete.
- If a check is skipped, say why.
- Do not hide failures behind follow-up work.
- For protected changes, review downstream admin, mobile, and smoke impact.
- Keep commits small and recoverable.

## Rollback Path

- Isolated app change: revert the scoped commit.
- API contract change: revert API first, then dependent admin/mobile changes.
- Migration change: stop and review manually before reverting deployed DB state.
- Harness/doc change: revert script or doc commit directly.
