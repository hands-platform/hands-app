---
name: hands-release-check
description: "HANDS release and handoff check workflow for completed work, pre-merge verification, deployment readiness, final reports, commit summaries, protected-area disclosure, skipped checks, remaining risks, and next recommended tasks. Use when finishing a task, preparing a release, summarizing local commits, or deciding whether more verification is needed."
---

# HANDS Release Check

Use this to produce a concise HANDS completion or release-readiness report.

## Required Starting Point

- Work only from `C:\dev\massage-on-demand-vn`.
- Start with `git status --short` or `just status`.
- Read `AGENTS.md` for the handoff format.
- Read `docs/development-workflow.md` for verification tiers when protected or cross-surface changes are involved.
- Read `docs/README.md` when authority or documentation conflicts matter.

## Release Check Steps

1. Inspect changed files:
   - `git status --short`
   - `git diff --stat`
   - `git log --oneline -N` when commits were created
2. Classify touched areas:
   - Admin
   - API
   - Customer mobile
   - Partner mobile
   - shared-types
   - Prisma/DB/Supabase
   - infra/scripts/Docker/CI
   - docs only
3. Identify protected areas touched. If any protected path changed, confirm the appropriate protected verification was run or clearly mark it skipped with reason.
4. List commands run with result:
   - pass
   - fail
   - skipped with reason
5. Check for remaining dirty files. Do not mix unrelated existing dirty files into commits.
6. Prepare the final HANDS handoff:
   - changed files
   - actual changes
   - commits created with hash and message
   - verification commands and results
   - protected areas touched
   - remaining risks
   - next recommended task

## Verification Guidance

- Do not run full verification by default.
- Use scoped verification matching changed files.
- Use full/local WithServices only for protected runtime behavior, release chunks, DB/API/shared contracts, or when the workflow document requires it.
- If a check was not run because it was out of scope, say so plainly.

## Output Style

Keep the report short and concrete. Prefer bullet lists. Do not claim release readiness if verification failed or was skipped for a required protected path.
