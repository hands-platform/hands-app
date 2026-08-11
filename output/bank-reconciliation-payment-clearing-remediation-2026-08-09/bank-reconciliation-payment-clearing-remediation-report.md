# Bank Reconciliation + Payment Clearing Remediation Report

Date: 2026-08-10  
Workspace: `C:\dev\massage-on-demand-vn`  
Target: HANDS Admin `Payment Matching` at 1440 x 900  
Commit: Not committed

## 1. Outcome

Bank Reconciliation and Payment Clearing now share one operator-facing `Payment Matching` workspace while retaining separate routes for bank transactions, statement imports, manual entry, unmatched payment evidence, partial matches, and terminal history.

The remediation prioritized state and amount authority before layout work:

- `OPEN` and `PARTIALLY_CLEARED` are the only active matching states.
- `CLEARED` and `REVERSED` are terminal evidence states and expose no matching action or candidate list.
- Queue exposure and owner workload use the same absolute remaining-amount definition.
- Bank assignment requires an explicit eligible Finance operator and a valid reason.
- Assignment persistence is reported separately from downstream notification delivery.
- Navigation, breadcrumbs, document titles, and return context remain stable across query variants and detail routes.
- The 1440px workbench is compressed so records begin in the first operational viewport.

No Assign, Match, Ignore, Reverse, Import commit, or Manual entry mutation was submitted against live local data during browser QA.

## 2. Audit Matrix

| Priority | Result | Evidence |
|---|---|---|
| P1 state safety | Complete | Terminal state model, terminal rendering tests, API terminal rejection coverage, REVERSED browser detail with zero match CTA. |
| P1 amount accuracy | Complete | Queue and owner SQL use active-match-adjusted absolute remaining amount; API invariant fixtures cover positive/negative originals and reversed matches. |
| P1 navigation | Complete | Path-family matcher covers Bank/Payment list, query, detail, and import detail routes; full Payment Matching breadcrumbs remain visible. |
| P1 assignment safety | Complete | Owner defaults empty; submit is disabled until owner and reason are valid; no first-owner auto-selection. |
| P1 notification failure | Complete | Persistence success and notification partial failure return independent counts and warning state for single and bulk assignment. |
| P2 desktop density | Complete | Redundant Bank tab removed, filters compacted, low-frequency filters moved to `More filters`, tables reduced to operator-focused columns. |
| P2 empty/terminal views | Complete | Partial zero queue uses one compact empty state; history prioritizes terminal rows and uses `View evidence`. |
| P2 candidate decision quality | Complete | Chose the safe wording path: `Review newest eligible candidate`; amount gap and date gap are visible without an unsupported score/confidence claim. |
| P2 read performance | Partial | Initial eligible-admin read was removed and terminal reads reduced, but measured local work-table-ready time exceeded the 500ms goal. No financial cache was introduced. |
| P3 copy/accessibility | Complete | Humanized sources/ages/statuses, unique table names, document titles, skip link, one visible main landmark, explicit non-color status text. |

No P1 item remains incomplete. Performance measurement is the only partial item.

## 3. State Truth Table

| Status | Remaining calculation | Match UI | Operator copy |
|---|---:|---|---|
| `OPEN` | `> 0` | Allowed | `Needs match` |
| `PARTIALLY_CLEARED` | `> 0` | Allowed | `Partial` plus remaining amount |
| `CLEARED` | `0` | Forbidden | `Closed` / fully cleared evidence |
| `REVERSED` | Not an action gate | Forbidden | `No active matching` / reversed evidence retained |

The shared UI state model is in `payment-clearing-state-model.ts`. API mutation validation remains authoritative, so hiding a terminal CTA is not the only protection.

## 4. Amount Contract

Operational exposure is defined once as:

```text
remainingAmount = max(abs(originalAmount) - sum(abs(activeMatchAmounts)), 0)
```

- Reversed or inactive matches are excluded from active matched amount.
- Signed accounting effect remains separate from operator exposure.
- Terminal history distinguishes ledger effect from absolute evidence amount.
- Queue summary and owner workload aggregate the same `remainingAmount`.

Browser evidence for the current Bank queue:

```text
Queue open exposure                         13,400,000 VND
Unassigned owner workload                   7,400,000 VND
Demo Finance operator workload              6,000,000 VND
Owner workload total                       13,400,000 VND
```

The invariant held: `7,400,000 + 6,000,000 = 13,400,000 VND`.

## 5. Navigation and Workspace Contract

Representative routes verified under the same `Finance Operations > Payment Matching` family:

- `/finance-tax/bank-reconciliation?workspace=operations&range=all&review=unmatched`
- `/finance-tax/bank-reconciliation?workspace=imports`
- `/finance-tax/bank-reconciliation?workspace=manual`
- `/finance-tax/bank-reconciliation/[id]`
- `/finance-tax/bank-reconciliation/import-batches/[batchImportId]`
- `/finance-tax/payment-clearing?range=all&review=unresolved&sort=oldest`
- `/finance-tax/payment-clearing?range=all&review=partial&sort=oldest`
- `/finance-tax/payment-clearing?range=all&review=terminal&sort=recent`
- `/finance-tax/payment-clearing?range=all&review=cleared&sort=recent`
- `/finance-tax/payment-clearing?range=all&review=reversed&sort=recent`
- `/finance-tax/payment-clearing/[id]`

Observed workspace counts were:

- Bank transactions: 44
- Unmatched payment evidence: 108
- Partial matches: 0
- Cleared & reversed history: 40

Detail return links retain valid `q`, `sort`, `owner`, `age`, `take`, and `page` context. The REVERSED detail browser check retained its full `returnTo` value.

## 6. Assignment and Notification Safety

Bank single and bulk assignment now use the same result shape as Payment Clearing:

```text
assignedCount
unchangedCount
notification.deliveredCount
notification.failedCount
warning
```

- The owner select starts empty.
- Submit remains actually disabled until an eligible operator and valid reason are present.
- Persistence/audit success is not rolled back or shown as failed if notification delivery fails afterward.
- Bulk notifications collect partial failures instead of failing the whole batch.
- UI notices distinguish persistence failure, saved assignment with notification warning, and complete success.
- Raw exception text and PII are not exposed.

## 7. Desktop UX and Accessibility

Final 1440 x 900 runtime checks:

| Check | Bank operations | Payment unresolved |
|---|---:|---:|
| Body horizontal overflow | None (`1440 / 1440`) | None (`1440 / 1440`) |
| Duplicate DOM IDs | 0 | 0 |
| Unnamed visible form controls | 0 | 0 |
| Visible main landmarks | 1 | 1 |
| Skip target | `#admin-main-content` | `#admin-main-content` |
| First records/work H2 y | 490px | 490px |
| Row action line count | At most 2 | At most 2 |
| Document title | `Bank Transactions · HANDS Admin` | `Unmatched Payment Evidence · HANDS Admin` |

Additional browser checks:

- Bank and Payment bulk controls remain hidden at zero selection and appear only after selection.
- Clearing visible selection returns to zero and does not invert into select-all.
- Owner dialog uses an alert dialog, empty owner value, and disabled submit.
- Partial queue renders one compact empty state and links back to unmatched evidence.
- REVERSED detail renders zero matching CTA/candidate sections and shows `No new match · reversed evidence retained`.
- OPEN detail renders eligible candidates and `Review newest eligible candidate`.
- Dark mode remains readable.
- Light theme was restored after QA.

## 8. Read Count and Timing

| Screen | Audit baseline | Final observed/code path | Result |
|---|---:|---:|---|
| Bank operations reads | Up to 6 | 6 initial workbench reads; eligible admin directory is not in the initial path | Definition/lazy-load improved, count otherwise unchanged |
| Payment unresolved reads | Up to 5 | 5 | Unchanged |
| Payment terminal reads | Up to 5 | About 4; no eager owner directory | Improved |
| Eligible admin directory | Eager in assignment-capable views | 0 on initial render; loaded only after selection/dialog | Improved |
| Bank warm local work-table-ready | 177ms audit baseline | about 4,388ms browser run | Above 500ms target |
| Payment warm local work-table-ready | 477ms audit baseline | about 1,360ms browser run | Above 500ms target |
| Bank first work heading | about 1,818px | 490px final DOM measurement | Improved |
| Payment first work heading | about 1,734px | 490px final DOM measurement | Improved |

The timing runs used the local development server and live local API/data path and are not production p95 measurements. A cache was deliberately not added because stale financial status would be a worse failure than the remaining latency. Production request tracing is the next safe performance step.

## 9. Changed Files

### Admin Web behavior and tests

- `apps/admin_web/app/finance-tax/bank-reconciliation/page.tsx`
- `apps/admin_web/app/finance-tax/bank-reconciliation/page.spec.tsx`
- `apps/admin_web/app/finance-tax/bank-reconciliation/[id]/page.tsx`
- `apps/admin_web/app/finance-tax/bank-reconciliation/[id]/page.spec.tsx`
- `apps/admin_web/app/finance-tax/bank-reconciliation/bank-reconciliation-review-owner-model.ts`
- `apps/admin_web/app/finance-tax/bank-reconciliation/bank-reconciliation-review-owner-model.spec.ts`
- `apps/admin_web/app/finance-tax/bank-reconciliation/bank-reconciliation-selection-summary.tsx`
- `apps/admin_web/app/finance-tax/bank-reconciliation/bank-reconciliation-selection-summary.spec.ts`
- `apps/admin_web/app/finance-tax/bank-reconciliation/bank-statement-batch-import.tsx`
- `apps/admin_web/app/finance-tax/bank-reconciliation/import-batches/[batchImportId]/page.tsx`
- `apps/admin_web/app/finance-tax/bank-reconciliation/import-batches/[batchImportId]/page.spec.tsx`
- `apps/admin_web/app/finance-tax/payment-clearing/page.tsx`
- `apps/admin_web/app/finance-tax/payment-clearing/page.spec.tsx`
- `apps/admin_web/app/finance-tax/payment-clearing/[id]/page.tsx`
- `apps/admin_web/app/finance-tax/payment-clearing/[id]/page.spec.tsx`
- `apps/admin_web/app/finance-tax/payment-clearing/payment-clearing-selection-controls.tsx`
- `apps/admin_web/app/finance-tax/payment-clearing/payment-clearing-state-model.ts`
- `apps/admin_web/app/finance-tax/payment-clearing/payment-clearing-state-model.spec.ts`

### Admin shell, navigation, and styling

- `apps/admin_web/lib/admin-nav-match.ts`
- `apps/admin_web/lib/admin-nav-match.spec.ts`
- `apps/admin_web/app/layout.tsx`
- `apps/admin_web/app/globals.css`

These changes add the path-family workspace match, metadata title template, skip target, compact filters/tables, sticky selected-state controls, terminal/empty presentation, and desktop workbench spacing.

### API authority and regression coverage

- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin.service.spec.ts`

These changes unify remaining-amount SQL, separate assignment persistence from notification delivery, preserve terminal mutation rejection, and add amount/state/notification fixtures.

The worktree was already extensively dirty. Existing unrelated modified and untracked files were preserved; no reset, checkout, clean, stash, or broad formatting was performed.

## 10. Tests and Commands

| Command | Result |
|---|---|
| Focused Admin Payment Matching tests | PASS - 9 files, 92 tests |
| Final focused Admin selection regression | PASS - 3 files, 41 tests |
| Focused API Admin tests | PASS - 3 files, 803 tests |
| `npm.cmd run verify:scope -- -Scope admin` | PASS - 833 files, 4,458 tests; typecheck, lint, query/copy guards, build passed |
| `npm.cmd run verify:scope -- -Scope api` | PASS - 160 files passed, 1 skipped; 2,119 tests passed, 1 skipped; typecheck, lint, Prisma/policy guards, build passed |
| `npm.cmd run verify:local` | FAIL overall - task-related Admin/API/build/Flutter checks passed; three pre-existing global gates failed |
| `npm.cmd run authority:check` | FAIL - stale required-copy markers in Customer/Start Shift/admin smoke files outside this task |
| Impeccable detector, changed UI scope | Completed exactly once; six existing global `side-tab` selector warnings were unrelated to Payment Matching |

`verify:local` details:

- PASS: environment, script syntax, secret/admin exposure guards, visible copy, notification/realtime contracts, Vietnam scope, Prisma validate, API typecheck/build, Admin test/typecheck/build, public web test/typecheck/lint/build, Docker config, Customer Flutter analyze/test, Partner Flutter analyze/test.
- FAIL: `setup:doctor` because production external payment/referral configuration is not complete.
- FAIL: `authority:check` because legacy string-marker expectations do not match current Customer/Start Shift/admin-smoke structure.
- FAIL: `api:domain-smoke` because its old negative-wallet assertion expects `marketplaceJoinBlocked === false`, while the current policy helper returns `true`.
- SKIP: Docker service startup and service-backed API smoke were not requested with `-WithServices`.

The three failing gates are outside the Bank Reconciliation/Payment Clearing changes and also reproduce independently.

## 11. Browser Evidence

All screenshots are 1440 x 900 and stored in this folder:

- `01-bank-transactions-1440.png`
- `02-bank-one-selected-1440.png`
- `03-bank-more-filters-open-1440.png`
- `04-bank-owner-dialog-1440.png`
- `05-bank-detail-match-evidence-1440.png`
- `06-bank-statement-imports-1440.png`
- `07-bank-manual-entry-1440.png`
- `08-payment-unresolved-1440.png`
- `09-payment-partial-empty-1440.png`
- `10-payment-history-1440.png`
- `11-payment-reversed-detail-1440.png`
- `12-payment-open-detail-1440.png`
- `13-payment-dark-mode-1440.png`
- `14-payment-one-selected-1440.png`

## 12. Protected Areas and Remaining Risk

Protected area touched: `apps/api/src/admin/admin.service.ts` and its test, limited to existing Admin read/mutation contracts needed by this task.

Not touched by this task:

- Prisma schema or migrations
- Authentication/authorization policy boundaries
- Core payment capture/refund/settlement mutation modules
- New dependencies
- Customer or Partner apps

Remaining risks:

1. Local work-table-ready timings exceeded 500ms and production p95 is unknown.
2. The repository-wide authority/domain smoke expectations need a separate contract-alignment task.
3. Production MoMo/VNPay/referral endpoints and credentials remain external setup work.
4. One API scope test remains intentionally skipped by the repository suite.
5. The very large pre-existing dirty worktree still makes commit-level attribution difficult; this task did not clean or rewrite it.

## 13. Acceptance Review

All state, amount, navigation, assignment, terminal/history, empty-state, explicit-owner, accessibility, desktop-density, and focused-test acceptance criteria are complete. The warm-local 500ms performance criterion is not met and is explicitly recorded as partial rather than completed.

Next recommended task: add request-level timing telemetry for the existing Bank/Payment read endpoints, identify the slow query in the live local data path, and optimize that query without caching financial state.
