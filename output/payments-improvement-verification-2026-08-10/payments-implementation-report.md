# HANDS Admin Payments implementation report

Date: 2026-08-10  
Workspace: `C:\dev\massage-on-demand-vn`  
Outcome: **Complete**

## Outcome

The Payments workspace now uses one server-owned policy decision for queue membership, row actions, detail actions, KPI counts, and confirmation. The impossible direct cash-debt settlement path is removed, gateway-affecting Admin actions use a durable atomic claim, list/count pagination uses the same canonical SQL predicate, and the 1440px operator table exposes its six decision-critical columns without horizontal scrolling.

No Capture, Release, Refund, cash settlement, or other money-changing action was submitted during browser verification.

## Implemented

### A-1 · Cash debt ownership

- Removed the Payments `settleCashDebt` action and direct `mark-paid` form.
- Cash debt rows and detail evidence now open the owning Cash Settlements record using the exact earning ID.
- Partner deposit investigation opens Partner Bank Deposits with the exact Partner search context.
- Payments cannot create a bypass API that marks Partner cash debt paid.

### A-2 · One primary action and queue

- Added the canonical `PaymentOperationDecision` contract with `primaryAction`, `primaryQueue`, `availableActions`, and `blockedActions`.
- Evidence conflict wins first, then missing external-gateway evidence, terminal cash cleanup, capture readiness, completed-authorization repair, release readiness, cash debt/active cash, failed active payment, and terminal history.
- External payments without verified evidence get `SYNC` as the single primary action. Release becomes primary only after retained evidence satisfies the non-capture contract.
- Legacy `recommended` remains true for at most the canonical primary action.
- List, detail, confirmation, queue counts, and KPI cards consume the same server result.

### A-3 · Atomic idempotency

- Added `PaymentAdminOperationClaim` with a unique `(paymentId, idempotencyKey)` business key and a partial unique active-operation constraint per payment.
- A claim is acquired before invoking a gateway adapter.
- Same-key/same-payload concurrent callers wait for and replay the durable receipt.
- Same-key/different-payload requests fail explicitly.
- A different active or review-required payment operation blocks a conflicting operation.
- Provider uncertainty is retained as `REVIEW_REQUIRED`; it is not silently retried as a second gateway call.
- Concurrency tests assert one adapter invocation across parallel calls.

### B-1/B-2 · Exclusive operational queues

- Callback review is normalized to the canonical evidence-conflict queue and is no longer duplicated in visible navigation.
- Authorized diagnostics and terminal history are secondary/history filters, not primary work queues.
- The old stale mismatch is split into `Terminal cash cleanup` and `Completed authorization blocked`.
- Terminal cash cleanup exposes evidence repair instead of a money mutation.

### B-3 · KPI scope

- API responses now expose `currentQueueTotal`, `queueCounts`, `globalActionMetrics`, `generatedAt`, `evaluatedAt`, and structured `scope`.
- Current row count reflects the selected queue and filters.
- Top operational cards remain global all-queue metrics instead of collapsing to zero when another queue is selected.

### B-4/B-5 · Exact pagination and bounded summaries

- List pages first select canonical eligible IDs in SQL, then load one bounded Prisma projection and restore the SQL order.
- Count and page rows share the same classifier expression and filters.
- Stable ordering includes an ID tie-breaker.
- Three interleaved pages are covered for duplicate-free and omission-free traversal with an exact total.
- Summary no longer loads an unbounded candidate set into application memory.

### C · Operator UI

- The table is reduced to six columns: Payment/Booking, Customer/Partner, Method/amount, Current state, Decision/evidence, and Action.
- A row exposes one primary action plus `Open detail`; there is no clipped More popover.
- Payment and booking states are shown together.
- Terminal records use `No action · History` and `Not recorded`, not active-warning language.
- Primary queue navigation is count-backed; secondary and history filters live under `More queues`.
- Time copy distinguishes `Booking created`, `Idle since booking update`, `Evidence verified`, and `Policy evaluated`.
- Confirmation shows payment/booking IDs, amount/method, before/after states, gateway reference, evidence, required evidence, policy, evaluation time, and actor.
- Escape and Cancel return focus to the exact originating action link. Directly opened confirmation URLs retain the safe `cancelHref` fallback.
- Metadata is `Payments | HANDS Admin` and `Payment <short-id> | HANDS Admin`.
- Light and dark themes retain the existing Admin tokens.

## Architecture decisions

### Canonical classifier

The source of truth is `apps/api/src/payments/payment-action-decision.ts`. The classifier is explicit and exhaustive for operational and history states. The Admin frontend only presents the returned decision; it does not infer a second recommendation.

### Pagination and count accuracy

`AdminService.listPayments` uses one canonical SQL scope to page eligible IDs before `skip/take`, followed by one bounded relational projection. Summary counts use the same queue classifier semantics. This removes post-pagination in-memory filtering and the resulting duplicates, omissions, and broad totals.

### Idempotency

`PaymentsService.executeAdminPaymentAction` creates or observes a durable database claim before any adapter call. A completed claim is the receipt source. A provider-uncertain call remains review-required and prevents a blind second call.

### Cash settlement link

Payments is read/decision context only for cash debt. The operator is sent to Cash Settlements by earning ID and to Partner Bank Deposits by Partner ID, preserving the evidence and approval ownership of those workspaces.

## Files changed

### API and persistence

- `apps/api/prisma/schema.prisma`: operation claim enum, model, and Payment relation.
- `apps/api/prisma/migrations/20260810093000_add_payment_admin_operation_claim/migration.sql`: additive table, indexes, and active-operation uniqueness.
- `apps/api/src/payments/payment-action-decision.ts`: canonical decision and exclusive classifier.
- `apps/api/src/payments/payment-action-decision.spec.ts`: table-driven policy regression coverage.
- `apps/api/src/payments/payments.service.ts`: durable claim acquisition, receipt replay, conflict handling, and uncertain-result retention.
- `apps/api/src/payments/payments.service.spec.ts`: sequential and concurrent idempotency coverage.
- `apps/api/src/admin/admin.service.ts`: canonical SQL list/count/summary and bounded projection.
- `apps/api/src/admin/admin.service.spec.ts`: aliases, scope, bounded query budget, and three-page traversal.

### Admin Web

- `apps/admin_web/lib/admin-api.ts`: decision and summary response contracts.
- `apps/admin_web/app/payments/page.tsx`: scoped summary, metadata, retry/error behavior, and confirmation.
- `apps/admin_web/app/payments/[id]/page.tsx`: detail metadata, action map, evidence links, and confirmation.
- `apps/admin_web/app/payments/actions.ts`: removed cash-debt mutation; retained server-revalidated payment actions.
- `apps/admin_web/app/payments/payment-action-confirmation.ts`: complete evidence and before/after facts.
- `apps/admin_web/app/payments/payment-action-confirmation-summary.tsx`: semantic confirmation fact list.
- `apps/admin_web/app/payments/payment-page-model.ts`: queue normalization and exact current total.
- `apps/admin_web/app/payments/payment-page-links.ts`: canonical visible queues and compatibility aliases.
- `apps/admin_web/app/payments/payment-page-presenters.tsx`: server decision presentation and neutral history semantics.
- `apps/admin_web/app/payments/payment-filter-board-section.tsx`: one queue navigator with secondary/history disclosure.
- `apps/admin_web/app/payments/payment-operations-table-section.tsx`: six-column decision table and single primary action.
- `apps/admin_web/components/confirm-dialog-focus-boundary.tsx`: history-aware close with direct-link fallback.
- `apps/admin_web/components/admin-surface.tsx`: capture handler support on the shared dialog surface.
- `apps/admin_web/app/globals.css`: Payments-scoped queue/table/confirmation layout.
- Adjacent Payments and confirmation specs were updated without weakening policy assertions.

## Database changes

- Migration applied to the local database: `20260810093000_add_payment_admin_operation_claim`.
- Prisma reports 82 migrations and the local database is up to date.
- The migration is additive. It does not rewrite existing Payment rows.
- Rollback requires reverting the service/schema code and dropping the partial index, claim indexes/table, and enum in that order. Any retained operation receipts must be exported before a production rollback.

## Verification

| Command / scope | Result |
| --- | --- |
| Admin Payments + confirmation focused tests | PASS · 14 files, 69 tests |
| API payment decision/service/controller focused tests | PASS · 5 files, 71 tests |
| `admin.service.spec.ts -t payment` | PASS · 52 tests |
| Admin Web typecheck | PASS |
| API typecheck | PASS |
| Admin Web lint | PASS |
| API lint | PASS |
| Prisma schema validate | PASS |
| Prisma migrate status | PASS · database up to date |
| `verify:scope -- -Scope admin` | PASS · 830 files, 4,444 tests plus typecheck/lint/build/guards |
| `verify:scope -- -Scope api` | PASS · 161 passed/1 skipped files, 2,132 passed/1 skipped tests plus typecheck/lint/build/policy contracts |
| Local API/Admin health | PASS · API health 200, Admin 200 |
| Impeccable detector | WARN only · six pre-existing non-Payments side-border selectors in global CSS; no new Payments finding |

The scope verifiers reported the expected protected-file review warning because this worktree already contains extensive user changes. They did not report a Payments or build failure.

## Browser evidence

Verification used the signed-in in-app browser at exactly 1440×900. The page had no document-level horizontal overflow; visible payment tables measured equal client and scroll widths. Browser console warnings/errors: 0.

Screenshots are in `output/payments-improvement-verification-2026-08-10`:

1. `01-payments-default-light-1440x900.png`
2. `02-missing-evidence-light-1440x900.png`
3. `02b-missing-evidence-table-light-1440x900.png`
4. `03-release-ready-light-1440x900.png`
5. `03b-release-ready-row-light-1440x900.png`
6. `04-terminal-cash-cleanup-light-1440x900.png`
7. `05-completed-authorization-blocked-light-1440x900.png`
8. `06-active-cash-light-1440x900.png`
9. `06b-cash-debt-light-1440x900.png`
10. `07-captured-history-light-1440x900.png`
11. `08-more-queues-light-1440x900.png`
12. `09-payment-detail-light-1440x900.png`
13. `10-release-confirmation-light-1440x900.png`
14. `11-payments-dark-1440x900.png`

Observed states:

- Capture ready: true empty state, global release count remains visible.
- Missing evidence: 1,121 rows in scope, first page 10, primary action is Sync only.
- Release ready: one row, primary action is Release only, retained evidence is verified.
- Terminal cash cleanup: isolated from completed authorization repair.
- Completed authorization blocked, Active cash, and Cash debt: true empty states with queue-specific explanations.
- Captured history: `No action · History` and `Not recorded`; no active evidence warning.
- More queues: secondary and history queues are hidden until expanded; callback conflict appears only once.
- Payment detail: one current primary action, four policy checks, exact list return context.
- Confirmation: complete evidence context; no money action submitted.
- Escape and Cancel: both closed the dialog and focused the originating Release link.
- Dark theme: existing tokens preserved, no overflow, title remains exact.

## Performance evidence

Before remediation, summary behavior loaded an unbounded action-candidate set and performed queue-oriented counting work that grew with queue count. The list also applied policy eligibility after database pagination.

After remediation:

- List: one SQL page-ID query using the canonical classifier plus one bounded relational projection.
- Summary: two conditional aggregate queries plus five fixed age-count queries. The query budget is independent of the number of visible queues.
- No summary query loads the complete candidate row set into Node memory.
- A query-budget regression test fixes this shape, and the three-page fixture fixes list/count semantics.

No absolute local response-time claim is made because the development dataset, warm cache, and dev server compilation are not controlled benchmarks.

## Protected areas and existing changes

- Protected area changed: Prisma schema/migration and payment money-action service, required for atomic idempotency.
- Existing payment revalidation, lifecycle capture blocks, callback redaction, refund approval ownership, audit reason/receipt, return context, and dark theme were preserved.
- The repository had a very large pre-existing dirty worktree. No unrelated file was reverted, deleted, formatted, committed, pushed, or deployed.
- Commit: **Not committed**.

## Remaining issues

No requested Payments completion item remains open. Production rollout still requires the normal migration deployment sequence and provider sandbox/live callback validation in the server environment; those external money-provider checks were intentionally not executed from the local Admin browser.
