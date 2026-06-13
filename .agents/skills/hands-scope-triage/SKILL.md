---
name: hands-scope-triage
description: "HANDS scope triage, task kickoff, impact classification, protected-area detection, document selection, and scoped verification planning. Use at the start of HANDS project work, before edits, commits, release checks, or when a request mentions scope, affected apps, protected areas, docs, verification, status, or what to do next."
---

# HANDS Scope Triage

Use this first for HANDS work to classify scope before editing.

## Required Starting Point

- Work only from `C:\dev\massage-on-demand-vn`.
- Start with `git status --short` or `just status` when doing real repo work.
- Read `AGENTS.md` for local operating rules.
- Read `docs/README.md` when document authority or product policy may matter.
- Read `docs/development-workflow.md` when scope, verification tier, or protected-area handling is unclear.
- Read `docs/architecture/hands-mvp-final-authority.md` when product behavior, copy, booking, matching, settlement, or Partner policy may matter.

## Triage Steps

1. Identify the task type: feature, bugfix, UI QA, protected change, docs/harness, release check, or read-only review.
2. Identify affected surfaces: `apps/api`, `apps/admin_web`, `apps/customer_app`, `apps/provider_app`, `packages/shared-types`, Prisma, Supabase SQL, infra scripts, Docker, GitHub workflows, docs.
3. Check protected areas:
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
4. Select the minimum document set. Do not bulk-read docs unless policy conflicts or protected areas require it.
5. Select scoped verification:
   - Admin: targeted Jest/specs, then `npm.cmd run verify:admin:fast` when appropriate.
   - API: focused Jest/specs, then `npm.cmd run verify:api:fast`.
   - Customer: touched Flutter test/analyze or `npm.cmd run verify:customer:fast`.
   - Partner: touched Flutter test/analyze or `npm.cmd run verify:provider:fast`.
   - Shared/node contracts: `npm.cmd run verify:node:fast` or the named contract script.
   - Harness/docs: relevant script or `npm.cmd run verify:preflight`.
6. If multiple surfaces are affected, use sequential integration review. Do not use subagents, worker agents, handoff agents, or multi-agent workflows.

## Output

When reporting triage, keep it short:

- scope and affected surfaces
- protected areas touched or not touched
- docs to read
- planned verification
- first safe implementation step
