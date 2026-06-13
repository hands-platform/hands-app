---
name: hands-protected-change
description: "HANDS protected-change workflow for Prisma schema, migrations, auth, payments, provider-wallet, matching, bookings, shared-types, Supabase SQL, env, Docker, GitHub workflows, and other high-risk cross-surface changes. Use when a task touches protected paths, business-critical state, contracts, DB, infra, CI, or requires full/local WithServices validation."
---

# HANDS Protected Change

Use this before changing protected or high-risk areas.

## Required Starting Point

- Work only from `C:\dev\massage-on-demand-vn`.
- Start with `git status --short` or `just status`.
- Read `AGENTS.md`.
- Read `docs/development-workflow.md`.
- Read `docs/README.md` for authority order.
- Read `docs/architecture/hands-mvp-final-authority.md` for product behavior.
- Read the focused architecture doc for the domain, for example payments, earnings, matching, notifications, service pricing, Supabase migration, or partner operations.

## Protected Areas

Treat these as protected:

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

Also use this skill for changes to booking state machines, wallet settlement, payment closeout, realtime event names, API response contracts, and production-like smoke scripts.

## Required Process

1. Write a short plan before editing:
   - paths affected
   - expected behavior change
   - downstream Admin/mobile/API/smoke impact
   - verification plan
2. Confirm NestJS ownership for business writes. Supabase is infrastructure.
3. Do sequential integration review. Do not use subagents or multi-agent workflows.
4. Keep commits small and reversible.
5. Update contracts, tests, docs, and smoke checks in the correct sequence.
6. Run focused tests first, then scope verification.
7. Escalate verification when behavior or runtime integration changes:
   - Tier 2: `npm.cmd run verify:full` or `npm.cmd run verify:local`
   - Tier 3: `powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices`

## Stop Conditions

Pause and report instead of guessing when:

- migration rollback risk is unclear
- production credentials or secrets are needed
- API/mobile contract impact cannot be determined
- a required Docker/service dependency is unavailable
- verification fails in a protected path and the root cause is not isolated

## Completion

Report protected paths, commands, pass/fail/skipped, downstream impact, remaining risk, and next safe task.
