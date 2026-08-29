# HANDS Agent Guide

## Project Shape

HANDS is a monorepo for a Vietnam on-demand service marketplace:

- `apps/api`: NestJS API, Prisma, PostgreSQL, Redis, Socket.IO.
- `apps/admin_web`: Next.js operations dashboard.
- `apps/customer_app`: Flutter customer app.
- `apps/provider_app`: Flutter partner app. Internal code may still use provider naming, but user-facing copy should say Partner.
- `packages/shared-types`: shared TypeScript contracts.
- `infra`: Docker, Supabase SQL, setup, smoke, and verification scripts.
- `docs`: architecture, policy, setup, and workflow documentation.

Always work from `C:\dev\massage-on-demand-vn`.

Ignore `C:\dev\massage-vn-workspace` and do not use it for HANDS work.

## Vietnam Time Standard

Use `Asia/Ho_Chi_Minh` (`ICT`, `UTC+7`) as the single canonical timezone for HANDS operations, UI copy, API contracts, tests, audit evidence, reports, and documentation.

- Do not substitute another IANA region merely because it currently has the same UTC offset.
- Use the canonical Vietnam identifier for business-time expectations and UTC only when explicitly testing process-timezone independence or representing stored instants.
- New documentation and generated verification artifacts must state Vietnam-local dates and times with `Asia/Ho_Chi_Minh` when a timezone label is needed.

## Agent Operating Model

Use a single-agent workflow in this repository.

- Inspect, edit, verify, commit, and report from the main agent only.
- Do not spawn subagents, worker agents, handoff agents, or multi-agent tools.
- Do not call or configure tools named `spawn_agent`, `functions.spawn_agent`, or equivalent multi-agent helpers.
- For large work, gather context with normal read-only commands such as `rg`, `git diff`, `npm`, and focused test commands.
- Keep the final report consolidated: changed files, verification, protected areas, risks, commits, and next recommended task.

## Workflow Model

Use sequential integration review.

- Independent UI, mobile, API, infra, and docs tasks may be worked separately, but still by the main agent.
- Database, auth, wallet, payment, settlement, matching, realtime event names, environment handling, and shared contracts require extra care.
- Do not run broad refactors while implementing business behavior.

## Verification

Fast scope checks:

```powershell
npm.cmd run verify:scope -- -Scope api
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope customer
npm.cmd run verify:scope -- -Scope provider
npm.cmd run verify:scope -- -Scope mobile
```

Full local check before merge:

```powershell
npm.cmd run verify:local
powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices
```

## Protected Areas

Changing these areas requires integration review and the matching scope checks plus full local verification when behavior changes:

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

## Handoff Format

When finishing a task, report:

- changed files
- commands run and pass/fail/skipped result
- protected areas touched
- remaining risks
- next recommended task
