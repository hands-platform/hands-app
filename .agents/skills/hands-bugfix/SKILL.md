---
name: hands-bugfix
description: "HANDS bugfix workflow for failing tests, regressions, runtime errors, broken Admin or mobile UI, NestJS API failures, Prisma issues, smoke failures, and unexpected behavior. Use when diagnosing or fixing a defect, test failure, crash, incorrect state transition, broken copy, or behavior regression."
---

# HANDS Bugfix

Use this to fix defects with evidence and minimal blast radius.

## Required Starting Point

- Work only from `C:\dev\massage-on-demand-vn`.
- Start with `git status --short` or `just status`.
- Read `AGENTS.md`.
- Read `docs/development-workflow.md` for protected or cross-surface failures.
- Read `docs/architecture/hands-mvp-final-authority.md` if behavior expectations conflict with code or older docs.

## Bugfix Workflow

1. Capture the failure signal:
   - failing command output
   - browser/runtime console error
   - smoke failure
   - repro steps
   - incorrect visible UI or API response
2. Reproduce narrowly when possible. Do not run full verification first unless the failure is only visible there.
3. Trace ownership:
   - UI render/state issue
   - API service/controller/DTO issue
   - Prisma/schema/data issue
   - shared contract mismatch
   - script/harness issue
4. Inspect current code with `rg` and focused file reads. Prefer existing helpers and tests.
5. Make the smallest fix that addresses the root cause. Avoid broad refactors while fixing behavior.
6. Add or update a regression test when the code path is testable.
7. Run the focused failing test or closest scoped verification.
8. If protected areas are touched, apply `hands-protected-change` behavior before claiming completion.

## Completion

Report:

- failure signal and root cause
- changed files
- regression test or verification command
- pass/fail/skipped
- protected areas touched
- remaining risk and next recommended task
