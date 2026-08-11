# Cash Settlements Final Remediation Report

Date: 2026-08-10  
Route: `/cash-settlements`  
Viewport: 1440 x 900 desktop  
Implementation status: Ready for staging verification

## 1. Operator outcome

`Cash Settlement Workbench` now presents one authoritative queue of open Partner-held cash fee receivables. The first screen answers four operational questions without opening a detail page: total open exposure, overdue rows, rows missing approved settlement evidence, and affected Partners.

The queue is server-filtered and paginated. Each row shows the Partner and booking, authoritative remaining debt, age and evidence state, a recommended next action, and a single Review entry point. Fully allocated debt is excluded from the open queue.

## 2. Data contract and P1 invariant

The shared SQL CTE in `apps/api/src/earnings/cash-settlement-query.ts` is the source used by list, summary, and Start Shift reconciliation.

- Original debt: the production cash earning's company receivable amount.
- Allocated amount: non-reversed approved deposit allocations linked to that earning.
- Remaining debt: `max(original debt - allocated amount, 0)`.
- Open debt invariant: only production cash earnings with remaining debt greater than zero appear.
- Partial allocation remains open with the reduced remaining amount.
- Full allocation leaves the open queue.
- Reversed allocations do not reduce remaining debt.

List filtering, sorting, and pagination run against the authoritative debt CTE before Prisma hydration. The summary uses the same predicate rather than rebuilding amounts in Admin Web.

## 3. Global and filtered meanings

- The top KPI band is global: all currently open cash fee receivables, independent of the selected queue.
- `Filtered queue` is the current search, date, age, SLA, queue, sort, and pagination result.
- Queue counts ignore only the selected queue so operators can switch lanes without losing the current search/date/age/SLA scope.
- `Payment check` and `Missing evidence` are evidence states, not invented owner or workflow states.

The previous summary path performed roughly fifteen database operations, including profile hydration. The new summary performs one SLA-policy read and one aggregate SQL query. The list remains a separate paginated read.

## 4. Safe allocation action

A dedicated endpoint was added:

`POST /admin/cash-settlement-earnings/:earningId/allocations`

The action:

- requires the `FINANCE_SETTLEMENTS` category;
- accepts only an approved deposit request and a positive amount;
- reuses the existing transactional allocation implementation;
- rejects over-allocation and invalid/reversed evidence;
- records the reason taxonomy and evidence IDs in audit metadata;
- returns allocation, earning, and evidence identifiers for the success notice.

Reason codes are `BANK_DEPOSIT_CONFIRMED`, `PARTIAL_RECOVERY`, `FINAL_RECOVERY`, and `OTHER_REVIEWED`.

No live allocation was executed during browser QA because the local visible rows did not have approved allocatable evidence.

## 5. Permission and ownership decision

Operators without `FINANCE_SETTLEMENTS` receive the same evidence detail in review-only mode; the allocation form is not rendered. The new Admin write route is mapped to `FINANCE_SETTLEMENTS` in the shared Admin access model.

No authoritative persistent owner or follow-up model exists for cash receivables. The former inferred owner/follow-up presentation was removed instead of creating false operational state. Adding assignment would require a separately approved persistence model, migration, audit events, and lifecycle policy.

## 6. UI and accessibility changes

- Replaced the multi-board page with a compact KPI band, queue switcher, filter panel, five-column table, and review drawer.
- Kept global KPIs visible when a filtered queue is empty.
- Added a compact filtered-empty state with a return-to-open action.
- Preserved search, queue, age, SLA, sort, page size, and page context when opening/closing Review.
- Review shows original, allocated, and remaining amounts; linked evidence; available approved deposits; and recent audit events.
- Invalid review IDs show a fail-closed error with no financial action.
- Escape closes the drawer and restores focus to the originating Review link.
- The table has no internal horizontal overflow at 1440 px.
- `view=full` is canonicalized to the Operating guide.
- Light and dark themes were verified.

## 7. Removed dead code

Removed the old priority board, provider groups, workflow/rule/command card builders, legacy confirmation surface, and their obsolete tests. The old server action that recorded a Partner bank deposit from this route was removed; approved deposit evidence is now allocated through the dedicated endpoint.

## 8. Schema, migration, backfill, rollback

No Prisma schema or migration was added. Original, allocated, and remaining debt are derived from existing earning and allocation records. No backfill is required.

Rollback is code-only: restore the prior list/summary/UI implementation and remove the dedicated route. Existing earning and allocation data is unchanged by this remediation.

## 9. Verification results

### Focused tests

- Admin Cash Settlements: 7 files, 20 tests passed.
- Admin policy/access regression: 2 files, 7 tests passed.
- API focused suite: 6 files, 930 tests passed.

### Scope verification

- `verify:scope -Scope api`: PASS.
  - 161 files passed, 1 skipped.
  - 2,127 tests passed, 1 skipped.
  - Prisma validation, policy contracts, typecheck, lint, and build passed.
- `verify:scope -Scope admin`: PASS.
  - 830 files passed.
  - 4,435 tests passed.
  - API budget guard, typecheck, lint, query guard, visible-copy guard, and production build passed.
- The scope script reported the repository-wide protected-files warning because the pre-existing worktree contains broad protected-area changes. No existing user change was reverted.

### Design detector

The Impeccable detector completed once. It reported six pre-existing `side-tab` warnings in unrelated global selectors for Vietnam map, timeline, marketing, dispatch, operations checks, and booking finance highlight. None targets the Cash Settlements selectors, so no unrelated global redesign was made.

## 10. Browser verification and evidence

Saved in `output/cash-settlements-final-remediation-2026-08-10`:

- `08-final-default-light.png`: default light workbench.
- `09-final-table-light.png`: five-column open debt table.
- `10-final-missing-evidence.png`: missing-evidence queue.
- `11-final-payment-check-empty.png`: true filtered-empty state with global KPI context.
- `12-final-review-drawer.png`: evidence review drawer.
- `13-final-invalid-review.png`: fail-closed invalid detail state.
- `14-final-default-dark.png`: default dark workbench.

Verified in the signed-in in-app browser:

- global values remain stable when the filtered queue is empty;
- filter and pagination context survive Review open/close;
- Escape closes Review and restores focus;
- the page and table have no horizontal overflow at 1440 px;
- invalid review has no mutation control;
- `view=full` resolves to `view=guide`;
- a clean final reload produced no new browser console errors or warnings;
- no real finance mutation was performed.

## 11. Remaining staging checks

Before production release, use staging fixtures to execute one partial allocation and one final allocation, then verify the row remains with reduced debt and disappears after full allocation. Also sign in with a read-only Finance operator to verify the browser permission state. These could not be exercised against the current local dataset/session without creating real financial state.

## 12. Final checklist

- [x] One authoritative remaining-debt predicate.
- [x] Server-side queue filtering, sorting, and pagination.
- [x] Global and filtered summaries are visibly separate.
- [x] Fully allocated rows are excluded.
- [x] Dedicated permission-mapped allocation endpoint.
- [x] Reason taxonomy and audit metadata.
- [x] Fail-closed missing/invalid evidence state.
- [x] Review-only permission contract.
- [x] Light, dark, empty, table, and drawer captures.
- [x] Focused and scope tests pass.
- [x] No schema migration or new dependency.
- [x] Existing user changes preserved.
- [ ] Staging partial/final allocation browser smoke.
- [ ] Staging read-only operator browser smoke.

Not committed.
