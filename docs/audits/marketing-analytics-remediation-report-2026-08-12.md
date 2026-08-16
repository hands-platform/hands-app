# Marketing Analytics remediation report

Date: 2026-08-12  
Route: `/marketing-analytics`  
Verdict: **RELEASE HOLD**  
P0 remaining: **2**

## Outcome

Marketing Analytics is now an operator workspace instead of one long mixed report. It first states whether the evidence is sufficient for a decision, calculates risk across the complete campaign universe, distinguishes missing spend evidence from a recorded zero, and separates read access from manual spend management.

The code-level Marketing scope is complete and its focused tests pass. Release remains blocked because the new permission enum migration has intentionally not been applied and repository-wide verification still contains unrelated failing contracts.

## Implemented changes

### Data confidence and campaign risk

- Added explicit `INSUFFICIENT`, `PARTIAL`, `READY`, and `STALE` decision-readiness states.
- Risk actions are calculated from the full canonical campaign universe rather than top-five presentation rows.
- Action responses expose exact total, visible, and hidden counts.
- Campaign IDs use a shared trim-and-lowercase canonical key across attribution, spend, filtering, risk calculation, and the ledger.
- Spend coverage exposes expected, recorded, missing, stale, unmatched, duplicate, and zero-value evidence separately.
- A recorded VND 0 row is evidence; a missing row is not silently converted to zero.
- `firstOpens` is presented as `Tracked entrants`, matching the actual telemetry contract.

### Permissions and write safety

- Existing `GROWTH_MARKETING` access remains read-only.
- Added `GROWTH_MARKETING_SPEND` for manual spend creation/correction.
- API guard, Admin access model, operator manifest, and form visibility use the same write permission.
- Spend platform is required; the form no longer supplies an unsafe default.
- Amount must be an integer from 0 through VND 2,000,000,000.
- Future dates are rejected using Vietnam local-date semantics.
- Canonical duplicate/ambiguous rows return conflict instead of silently selecting a row.
- An unchanged submission returns `NO_CHANGE` without creating a new audit event.
- Successful mutation responses include canonical target, outcome, and audit ID.
- UI distinguishes unauthorized, forbidden, conflict, throttled, unavailable, and validation failures.

### Operator workspace

- Kept one route and introduced four URL-addressable views: Overview, Campaigns & spend, Attribution quality, and Coupons.
- Overview prioritizes decision readiness, full-universe actions, spend coverage, and major funnel evidence.
- Campaigns & spend includes campaign/region evidence and a paged spend ledger.
- Attribution quality isolates source/platform evidence and limitation copy.
- Coupons loads coupon data only and clears unrelated campaign/source controls.
- Filter scope is stated beside each workspace rather than deferred to a page-bottom disclosure.
- Responsive desktop grids were reduced to three columns where necessary; VND values and evidence copy remain readable at 1440 and 1600 pixels.

## Changed files

### Admin Web

- `apps/admin_web/app/marketing-analytics/page.tsx`: four workspaces, readiness, action and spend evidence, honest filters, permission-aware controls.
- `apps/admin_web/app/marketing-analytics/marketing-analytics-model.ts`: view/query and ledger model helpers.
- `apps/admin_web/app/marketing-analytics/marketing-spend-action-form.tsx`: explicit inputs and typed result feedback.
- `apps/admin_web/app/marketing-analytics/actions.ts`: typed errors, exact mutation receipt, no-op handling.
- Corresponding `*.spec.ts` and `*.spec.tsx`: payload split, wording, permissions, errors, and no-data regressions.
- `apps/admin_web/lib/admin-api.ts`: readiness, action, spend coverage, and ledger contracts.
- `apps/admin_web/lib/admin-operator-access-model.ts`: POST spend route maps to `GROWTH_MARKETING_SPEND`.
- `apps/admin_web/app/admin-operators/admin-operator-permissions.spec.ts`: permission catalog regression.
- `apps/admin_web/app/globals.css`: Marketing workspace and ledger responsive styles only; unrelated dirty selectors were preserved.

### API and protected contracts

- `apps/api/src/admin/admin-marketing-analytics.ts`: canonical identity, coverage, readiness, and full-universe risk helpers.
- `apps/api/src/admin/admin.service.ts`: summary evidence, hardened writes, exact lookup, and spend ledger.
- `apps/api/src/admin/admin-analytics.routes.ts`: spend-ledger read endpoint.
- `apps/api/src/admin/admin.dto.ts`: required platform and bounded integer amount.
- `apps/api/src/admin/admin-operator-category.guard.ts`: method-aware spend permission.
- `apps/api/src/admin/admin-operator-permission-manifest.json`: elevated spend-management permission.
- Related API specs: helper, service, controller, DTO, guard, route-domain, and manifest regressions.
- `apps/api/prisma/schema.prisma`: `GROWTH_MARKETING_SPEND` enum value.
- `apps/api/prisma/migrations/20260812140000_add_marketing_spend_permission/migration.sql`: additive permission migration, created but not applied.

## Verification

### Passed

| Scope | Result |
| --- | --- |
| Marketing Admin focused specs | 32 passed |
| Marketing API helper specs | 22 passed |
| Marketing API service specs | 9 passed |
| Marketing API controller specs | 8 passed |
| API full tests | 2,332 passed, 5 skipped, 0 failed |
| API typecheck / lint / build | PASS |
| Admin typecheck / lint / build | PASS |
| Prisma client generation | PASS |
| Prisma migration check | PASS; 93 migrations, 0 violations |
| Admin visible-copy and query guards | PASS |
| Secret and sensitive-data checks | PASS |
| Customer Flutter analyze/tests | PASS; 138 tests |
| Partner Flutter analyze/tests | PASS |
| Public web tests/typecheck/lint/build | PASS |
| Changed-file `git diff --check` | PASS; line-ending warnings only |

Key commands:

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/marketing-analytics/page.spec.tsx app/marketing-analytics/marketing-analytics-model.spec.ts app/marketing-analytics/actions.spec.ts
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-marketing-analytics.spec.ts
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts -t "marketing"
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.controller.spec.ts -t "marketing"
npm.cmd run test --workspace @massage-vn/api
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run lint --workspace @massage-vn/api
npm.cmd run build --workspace @massage-vn/api
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run lint --workspace @massage-vn/admin-web
npm.cmd run build --workspace @massage-vn/admin-web
npm.cmd run prisma:migrations:check
npm.cmd run verify:scope -- -Scope api
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:local
```

### Attempted but not green

- `npm.cmd run verify:scope -- -Scope api`: Marketing/API checks pass, but the existing Notifications retry-audit contract expects Admin keys not present in the current tree.
- `npm.cmd run verify:scope -- -Scope admin`: typecheck/lint/build and most tests pass. Full Admin tests report 4,534 passed, 1 skipped, and 3 unrelated failures:
  - `components/admin-surface-css.spec`: parser matches a focus rule instead of the expected grid rule.
  - Admin navigation: stale Finance company-bank expectation.
  - Finance closeout: expected 70d while current output is 72d.
- `npm.cmd run verify:local`: attempted and failed on repository-wide pre-existing gates, including setup-doctor external-copy markers, final-authority Operations Policy markers, Vietnam Bangkok wording, notification retry contract, API domain smoke assertion, missing Supabase `FINANCE_EVIDENCE`, the three Admin failures above, and existing finance-approver release blockers.
- Impeccable detector: exited 1 with six warnings in unrelated shared CSS selectors; no Marketing component/scoped selector finding.

These failures were not weakened, suppressed, or modified as part of this focused remediation.

## Browser QA

Authenticated local read-only QA was completed against:

- `/marketing-analytics`
- `/marketing-analytics?range=7d&view=campaigns`
- `/marketing-analytics?range=30d&view=attribution`
- `/marketing-analytics?range=7d&view=coupons`

Viewports: 1440 x 1000 and 1600 x 1000.

Verified:

- Decision readiness and limitation copy are visible before performance conclusions.
- Full action total/visible/hidden values agree.
- Spend missing days and actual zero evidence remain distinct.
- Spend ledger and write control are contained in Campaigns & spend.
- Coupons does not inherit unrelated Source/More controls.
- Generated time no longer falls back to 1970 when a view does not load the overview summary.
- No page-level horizontal overflow.
- Final console: 0 errors and 0 warnings.
- No write control was submitted.

Evidence: `docs/audits/marketing-analytics-remediation-evidence-2026-08-12/`.

## Protected areas and migrations

Protected permission/schema files were changed because read and spend-management authority had to be separated. Authentication flows, payment execution, coupon mutation, and customer data mutation were not changed.

Migration status: **created, validated, not applied**. No production or shared database migration/backfill was run.

## Data mutations

None. Browser QA was read-only. No manual spend, coupon, campaign, or customer record was created or changed.

## Existing changes preserved

The worktree contained extensive user changes before this task. No reset, checkout, broad formatting, unrelated cleanup, commit, push, or deployment was performed. Files shared with other work, especially `admin.service.ts`, `schema.prisma`, `globals.css`, permission manifests, and their tests, were edited narrowly while retaining existing content.

## Remaining risks

### Release blockers

1. Apply `20260812140000_add_marketing_spend_permission` in a controlled environment, then verify existing operator role assignments and read-only/write role behavior. Until then, deployed runtime permission data cannot support the new contract.
2. Restore the repository-wide `verify:scope` and `verify:local` baseline. The current failures are outside Marketing Analytics, but the requested full release gate is not green.

### Operational, non-code risk

The local report correctly shows `INSUFFICIENT` because only 0 of 7 expected spend days are recorded. Marketing budget or loss decisions should remain on hold until authoritative spend evidence is entered and coverage becomes sufficient.

## Next action

Apply the additive permission migration in a controlled staging environment and run one role-matrix smoke test: `GROWTH_MARKETING` can read but cannot write, while `GROWTH_MARKETING_SPEND` can submit an audited spend row.

Commit status: **Not committed**.
