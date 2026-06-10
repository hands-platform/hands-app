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

## Continuous Review Lanes

Use proactive read-only subagents to keep the main agent fast and well informed during larger work.

- Static Analysis lane: inspect TypeScript, NestJS, Prisma, Flutter, scripts, and test patterns for compile, lint, import, dead-code, and contract-risk signals before edits are made.
- Code Review lane: review the intended or current diff for bugs, missing tests, unclear ownership boundaries, unsafe copy changes, and behavior drift.
- Architecture Review lane: map module boundaries, protected authority areas, API/client separation, and places where UI may be taking business decisions that belong to the NestJS API.
- Design Review lane: inspect Admin Web screens for layout consistency, table/filter/action usability, responsive risks, and user-facing copy that should say Partner.
- Technical Debt lane: find oversized files, duplicated helpers, stale mocks, brittle fixtures, missing page-model splits, and high-churn areas that slow future Admin/API work.
- Refactoring lane: propose small, behavior-preserving extractions inside the current target area only; do not propose broad rewrites while business behavior is changing.
- Profiling and Performance lane: inspect slow tests, large pages, heavy client bundles, excessive server fetches, N+1-looking API calls, Docker/service startup bottlenecks, and candidates for focused load or smoke checks.

Subagent outputs should be concise and actionable:

- scope inspected
- top findings by severity
- files likely worth changing
- verification commands recommended
- risks or stop conditions

The main agent decides what to implement now versus backlog. Subagent findings are advisory until the main agent verifies them.

## Persistent Subagent Work Queues

Prefer stable work queues over one-off subagent role invention. The main agent should reuse these queue names and responsibilities across turns, refreshing the queue only when its findings become stale or the target area changes.

- Admin Evidence Queue: keep mapping where Admin Web still derives booking, matching, payment, wallet, chat, closeout, and Partner evidence locally instead of reading API-provided facts.
- Admin UI Velocity Queue: keep finding small Admin-only page-model, table, filter, action, and component slices that reduce large page files without changing behavior.
- API Contract Queue: keep tracking Admin API response shapes, DTO gaps, shared enum/status use, Socket.IO event names, and places where the API should expose read-only evidence instead of making clients infer it.
- API/DB Readiness Queue: keep mapping Prisma models, seed/smoke needs, migrations, DB-backed evidence gaps, and service-readiness checks. Treat schema/migration changes as protected sequential work.
- Authority Boundary Queue: keep auditing matching, booking, payment, wallet, settlement, refund, verification, and final Partner connection authority so business decisions stay in NestJS API.
- QA and Smoke Queue: keep recommending focused specs, smoke scenarios, and minimal verification commands for the current slice. Prefer scope checks over full local verification until merge readiness.
- Performance Queue: keep watching slow tests, large Admin pages, repeated fetches, Docker/local-service startup cost, API query size, and candidates for targeted profiling.
- Technical Debt Queue: keep a backlog of duplicated helpers, stale mock data, missing tests, oversized files, and safe refactor candidates grouped by owner area.

Queue operating rules:

- Subagents remain read-only unless the user explicitly approves separate write ownership.
- The main agent owns the editable backlog and chooses the next commit-sized slice.
- Queue findings should include `Now`, `Next`, and `Later` buckets so the main agent can move without re-triaging the same area.
- If a queue finds protected API, DB, Docker, mobile, payment, wallet, matching, or settlement impact, it must label the finding as protected and recommend verification before any edit.
- When a queue has already produced useful findings, continue from that queue's last report instead of spawning a new role with a new name.
- Keep active queue count small for normal work: usually one implementation queue plus one review/QA queue. Use more only for broad inspection or pre-merge review.

## Performance and Load Work

Use performance work deliberately instead of guessing.

- Prefer static performance audits before adding instrumentation.
- Run focused profiling or load tests only when a route, API endpoint, Docker service, or user workflow has a concrete performance question.
- Do not run broad load tests against external services or production-like targets without explicit approval.
- For local API/Admin performance checks, prefer lightweight smoke, endpoint timing, bundle/build warnings, and targeted scripts before full WithServices runs.
- If a performance fix touches DB schema, Prisma migrations, payments, wallet, settlement, matching, realtime, or shared contracts, treat it as protected sequential work.

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
