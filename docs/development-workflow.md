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

## Selected Operating Mode

Selected: Single-agent scoped workflow.

Reason:

- The repo has clearly separated apps and packages.
- Admin UI, mobile UI, docs, and isolated API modules can still be scoped independently.
- The main agent owns inspection, edits, verification, commit preparation, and reporting.
- Shared contracts, Prisma schema, payments, wallet, matching, auth, realtime events, and environment configuration can break multiple apps and must stay sequentially reviewed.

Inactive modes:

- Parallel worker lanes are not active for this repository.
- Subagents, worker agents, and handoff agents should not be used for HANDS work.
- Read-only context gathering can still use normal commands such as `rg`, `git diff`, and focused test commands.

## Selected Workflow Model

Selected: Sequential integration review.

Allowed scoped work:

- Admin page-only UI changes.
- Customer app page/widget changes.
- Partner app page/widget changes.
- API module work that does not touch protected contracts.
- Docs and local scripts.

Extra-care areas:

- Prisma schema or migrations.
- Auth, payment, wallet, settlement, matching, booking state machines.
- Shared types and public API response shapes.
- Realtime event names and room rules.
- Environment, Docker, deployment, and CI configuration.

Sequential work:

- Any change that spans API plus mobile/admin.
- Any policy change that affects booking, wallet, settlement, or taxes.
- Any database migration.

## Scope Partition

| Scope | Allowed files | Forbidden scope | Checks | Risk | Merge order |
| --- | --- | --- | --- | --- | --- |
| Admin | `apps/admin_web/**` | API contracts, Prisma, env | `verify:scope -- -Scope admin` | Medium | Before full verify |
| API | isolated `apps/api/src/<module>/**` | Prisma, auth, wallet, payments, matching unless approved | `verify:scope -- -Scope api` | High | Before admin/mobile consumers |
| Customer mobile | `apps/customer_app/**` | shared API contracts, provider app | `verify:scope -- -Scope customer` | Medium | After API contract stability |
| Partner mobile | `apps/provider_app/**` | shared API contracts, customer app | `verify:scope -- -Scope provider` | Medium | After API contract stability |
| Docs/harness | `docs/**`, `infra/scripts/**` | business logic, schema | `verify:scope -- -Scope harness` | Low | Any time |
| Read-only review | whole repo | no edits | report only | Low | Before large work |

## Git Monorepo Contract

HANDS must stay inside the existing `C:\dev\massage-on-demand-vn` Git history as one monorepo. Do not create, delete, replace, or nest `.git` directories, and do not move files across repository boundaries as part of normal cleanup.

Use `npm.cmd run repo:monorepo-contract` to verify the current Git root, required monorepo folders, Node workspaces, and absence of nested Git boundaries.

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
| Tier 1A Scoped review | same as Tier 1 by touched scope                                                           | Recheck focused scope after edits                | before reporting done                    | fast to medium | skip if read-only                 |
| Tier 2 Full Local     | `npm.cmd run verify:full` or `npm.cmd run verify:local`                                   | Full repo verification without service smoke     | before protected merge or release chunk  | medium to slow | never skip before protected merge |
| Tier 3 Integration    | `powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices` | Docker, migration, seed, API/realtime smoke      | DB/API/shared contract changes           | slow           | skip for docs-only or isolated UI |
| Tier 4 Heavy Optional | `npm audit --audit-level=moderate`, manual emulator/browser checks                        | Security and UX confidence                       | release prep or suspicious changes       | slow           | optional during normal coding     |

Daily Codex cadence:

- Docs or copy only: use the directly relevant script, or `npm.cmd run verify:preflight` when branch safety matters.
- Admin-only UI/data shaping: use targeted Jest when a helper changes, then `npm.cmd run verify:admin:fast`.
- API/booking/matching/payment/wallet changes: use the focused Jest spec first, then `npm.cmd run verify:api:fast`; run Tier 3 when DB/runtime behavior changes.
- Notification partner alert contract changes: run `npm.cmd run notifications:partner-alert-contract` with the touched API/Admin spec before committing.
- FCM push data routing changes: run `npm.cmd run notifications:push-data-contract` with the touched API/mobile notification-open spec before committing.
- Notification retry audit metadata changes: run `npm.cmd run notifications:retry-audit-contract` with the touched API/Admin audit spec before committing.
- `packages/shared-types` is source-only today; API/Admin runtime imports are blocked by `npm.cmd run shared:source-only-check` until it exposes a compiled JS package entry.
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
