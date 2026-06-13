---
name: hands-ui-qa
description: "HANDS UI QA workflow for Admin Web, customer_app, and provider_app screens. Use for visual QA, responsive checks, overflow, loading/empty/error/disabled states, visible copy review, Partner wording, browser or emulator checks, and UI polish before commit or release."
---

# HANDS UI QA

Use this for HANDS screen quality checks and small UI polish.

## Required Starting Point

- Work only from `C:\dev\massage-on-demand-vn`.
- Start with `git status --short` or `just status` before edits.
- Read `AGENTS.md`.
- Read `docs/README.md` and `docs/architecture/hands-mvp-final-authority.md` when visible product behavior or copy is involved.
- Read `docs/architecture/admin-web-integration.md` for Admin Operations Command Center changes when needed.
- Read `docs/architecture/mobile-api-integration.md` for mobile integration changes when needed.

## UI QA Checklist

1. Identify the surface:
   - Admin Web: `apps/admin_web`
   - Customer mobile: `apps/customer_app`
   - Partner mobile: `apps/provider_app`
2. Check visible copy:
   - Use Partner in user-visible labels.
   - Do not expose Provider wording unless it is internal code, DB, or compatibility naming.
   - Do not introduce scheduled booking, tips, or old MVP assumptions.
3. Check UI states:
   - loading
   - empty
   - error
   - disabled
   - success/failure feedback
4. Check layout quality:
   - responsive behavior
   - overflow and wrapping
   - compact dashboard/card text sizing
   - no incoherent overlap
   - table/list scroll behavior
5. Use the appropriate runtime:
   - Admin Web: in-app browser or focused component tests.
   - Flutter: analyzer/test or emulator when needed.
6. Keep fixes scoped to the screen/component unless shared UI helpers are clearly the right owner.

## Verification

- Admin page/component change: run targeted Jest/specs or `npm.cmd run verify:admin:fast`.
- Customer app change: run touched Flutter check or `npm.cmd run verify:customer:fast`.
- Partner app change: run touched Flutter check or `npm.cmd run verify:provider:fast`.
- If only doing read-only QA, report findings and do not edit.

## Report

Include:

- screen or route checked
- viewport/runtime used
- issues fixed or findings
- commands and browser/emulator checks
- remaining UI risks
