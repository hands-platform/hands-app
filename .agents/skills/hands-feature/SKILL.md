---
name: hands-feature
description: "HANDS feature implementation workflow for new product behavior, Admin UI, NestJS API endpoints, shared contracts, Flutter screens, Prisma-backed flows, and infra-supported features. Use when adding a feature, extending a flow, wiring API and UI together, or implementing cross-surface HANDS functionality."
---

# HANDS Feature

Use this for new HANDS functionality. Keep changes scoped and sequential.

## Required Starting Point

- Work only from `C:\dev\massage-on-demand-vn`.
- Start with `git status --short` or `just status`.
- Read `AGENTS.md`.
- Use `hands-scope-triage` behavior first if scope is not already clear.
- Read `docs/README.md` for authority order when product or docs disagree.
- Read `docs/architecture/hands-mvp-final-authority.md` for MVP behavior.
- Read `docs/development-workflow.md` for cross-surface or protected changes.

## Feature Workflow

1. Find existing patterns before designing:
   - API: `apps/api/src/**`, focused specs, Prisma access patterns.
   - Admin: `apps/admin_web/app/**`, `apps/admin_web/lib/**`, related specs.
   - Mobile: `apps/customer_app/**`, `apps/provider_app/**`.
   - Shared contracts: `packages/shared-types/**`.
   - Infra/smoke: `infra/scripts/**`.
2. Confirm owner of writes:
   - Supabase is infrastructure.
   - Critical business writes go through NestJS API.
   - Admin/mobile must not bypass NestJS for booking, matching, payments, settlement, auth, or audit decisions.
3. Follow existing local patterns for DTOs, services, components, copy helpers, tests, and scripts.
4. Preserve naming rules:
   - Visible product copy says Partner.
   - Internal code and DB may keep Provider names for compatibility.
   - Do not casually rename Provider schema/code to Partner.
5. For cross-surface work, implement in sequence:
   - Contract or API behavior first.
   - Then Admin/mobile consumers.
   - Then smoke/harness/docs updates.
   - Review integration impact before committing.
6. Add or update the smallest useful tests for the changed behavior.
7. Run scoped verification only. Escalate to full/local WithServices only when protected runtime behavior changes.

## Completion

Before reporting done:

- Review `git diff`.
- Verify only touched scope unless protected/cross-surface rules require more.
- Commit only your changes when the user has asked for automatic local commits.
- Report files, commands, pass/fail/skipped, protected areas, risks, and next task.
