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

## Agent Operating Model

Treat the primary Codex thread as the main orchestrator agent.

- If the task is single-scope and low risk, the main agent may inspect, edit, verify, commit, and report directly.
- If the task is complex, cross-cutting, or benefits from parallel context gathering, the main agent should design the subagent roles without waiting for the user to name them.
- Subagents are investigation-only by default: they may inspect files, map dependencies, identify risks, compare patterns, and report findings.
- The main agent is the only agent that should make final edits, stage files, commit, push, or decide how findings are integrated.
- Use subagents to speed up discovery, not to create competing edits in the same files.
- Keep protected or authority-sensitive areas sequential and integration-reviewed.
- If a subagent finds that a change would require protected API, schema, environment, realtime, payment, wallet, settlement, matching, or mobile behavior changes, the main agent must pause that lane, report the impact, and proceed only with an explicit safe plan.
- Prefer parallel read-only investigation for large Admin, API, docs, and infra surfaces; avoid parallel write work unless the ownership boundaries are clearly separate and low risk.
- The main agent must keep the final report consolidated: changed files, verification, protected areas, risks, commits, and next recommended task.

## Workflow Model

Use Split Workflow with limited write parallelism.

- Independent UI, mobile, API, infra, and docs tasks may be worked separately.
- Database, auth, wallet, payment, settlement, matching, realtime event names, environment handling, and shared contracts require sequential integration review.
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

Locked for parallel edits:

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

Changing these areas requires integration review and the matching scope checks plus full local verification when behavior changes.

## Handoff Format

When finishing a task, report:

- changed files
- commands run and pass/fail/skipped result
- protected areas touched
- remaining risks
- next recommended task
