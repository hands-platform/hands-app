# Booking Settlement Audit remediation implementation report

Date: 2026-08-10  
Repository: `C:\dev\massage-on-demand-vn`  
Route: `/finance-tax/booking-settlement-audit`  
Target viewport: desktop 1440x900 and wider  
Commit: Not committed

## 1. Result

The Booking Settlement Audit is now an operator queue instead of a raw evidence dump.

- Normal tax workflow states are separated from settlement integrity failures.
- Reversal evidence follows the payment-method contract used by the settlement mutation.
- The list exposes every blocker, owner, due state, amount at risk, next action, and remediation route.
- Primary queues are mutually understandable operating lanes; reason and tax status remain facets.
- List and summary filtering run in PostgreSQL before hydration. The list hydrates only the bounded page.
- Export uses stable seek cursors, a 100,000-row cap, and explicit success/failure/partial-failure activity events.
- Phone numbers are absent from list payloads, UI, and CSV.
- The 1440px first viewport now contains the global backlog, filters, table heading, and the first complete data row.

## 2. P0 - decision contract

### 2.1 Tax workflow

Before:

- `OPEN` and `DECLARED` tax states could be treated as integrity exceptions even when the accounting evidence was sound.
- Missing tax due dates were easy to read as zero urgency.

After:

- `TAX_OPEN`, `TAX_DECLARED`, `TAX_PAID`, `TAX_CLOSED`, and `TAX_REVERSED` are workflow states.
- Workflow urgency is independently classified as `NORMAL`, `DUE_SOON`, `OVERDUE`, `BLOCKED`, or `UNKNOWN`.
- A normal open or declared tax workflow does not create an integrity blocker.
- Unknown due evidence stays unknown; it is not converted to a zero or a fabricated deadline.
- A verified tax-period mismatch can still block closeout.

### 2.2 Reversal evidence by payment method

The shared `settlementReversalEvidencePolicy` is used by both audit classification and settlement mutation validation.

| Payment method | External refund clearing | Ledger evidence | Clear reversal requirement |
| --- | --- | --- | --- |
| Cash | Not required | Reversal journal/ledger evidence required | Ledger evidence complete |
| Customer wallet | Not required | Customer wallet refund ledger and reversal journal required | Ledger evidence complete |
| Card | Required | Reversal journal required | Reversed refund clearing and journal complete |
| MoMo | Required | Reversal journal required | Reversed refund clearing and journal complete |
| VNPay | Required | Reversal journal required | Reversed refund clearing and journal complete |

New `REVERSAL_LEDGER_MISSING` classification prevents cash/wallet records from appearing clear without the required internal evidence. External methods no longer pass with only a journal while refund clearing remains open.

### 2.3 Blocker contract

Every blocker now carries:

- server priority
- owning team
- due timestamp or explicit unknown
- closeout-blocking state
- evidence amount where applicable
- recommended next action
- allowlisted remediation URL

The same sorted blocker collection is used by list, detail, summary lanes, and export.

## 3. P1 - queues, scope, and URL compatibility

### 3.1 Primary queues

| Queue | Query | Meaning |
| --- | --- | --- |
| Integrity exceptions | `review=integrity-exceptions` | Allocation, journal, coupon, unknown, and other integrity blockers |
| Payment evidence | `review=payment-evidence` | Clearing, bank-match, and payment-fee evidence work |
| Tax workflow | `review=tax-workflow` | Tax workflow work, with tax status as a facet |
| Reversals | `review=reversals` | Reversal lifecycle and evidence |
| Resolved | `review=resolved` | Clear records |
| All records | `review=all` | Unrestricted audit population |

`owner`, `reason`, and `status` are independent server-side facets. Default entry is `range=all`, `review=integrity-exceptions`, `sort=oldest`, `take=25`.

### 3.2 Legacy deep-link mapping

| Legacy review | New queue/facet |
| --- | --- |
| `open`, `needs-action` | `integrity-exceptions` |
| `allocation-mismatch` | `integrity-exceptions&reason=allocation` |
| `journal-evidence` | `integrity-exceptions&reason=journal` |
| `coupon-evidence` | `integrity-exceptions&reason=coupon` |
| `unknown` | `integrity-exceptions&reason=unknown` |
| `clearing-evidence` | `payment-evidence&reason=clearing` |
| `payment-fee-evidence` | `payment-evidence&reason=fee-policy` |
| `tax-evidence` | `tax-workflow` |
| `tax-open`, `declared`, `paid`, `closed` | `tax-workflow` plus matching `status` |
| `reversal-incomplete` | `reversals&reason=reversal` |
| `reversed` | `reversals` |

Existing bookmarks continue to resolve through the filter parser; the generated URL uses the new taxonomy.

### 3.3 Summary semantics

- Global command-strip counts ignore table search, owner, reason, and status facets.
- Global summary remains independently labeled and linked to the all-time queue.
- `reversalEvidenceCompleteCount`, `reversalEvidenceIncompleteCount`, other blockers, and fully clear counts are distinct.
- Tax workflow counts are not added to integrity exception counts unless the tax evidence itself blocks closeout.
- Amount at risk and oldest unresolved age are server classified.

## 4. P1 - bounded reads and export

### 4.1 List query plan

Each list page performs two database calls:

1. One SQL projection CTE applies range, period, method, queue, owner, reason, status, search, cursor, sort, `LIMIT`, and bounded `OFFSET`/seek. It returns only ID, posted time, and amount at risk.
2. One Prisma `findMany` hydrates nested evidence only for those returned IDs, at most the requested page size (maximum 100).

The response order is reconstructed from the projection IDs. The former full nested `findMany`, Node filter/sort, and final `slice` path was removed.

### 4.2 Summary query plan

Summary performs one SQL aggregate over the shared projection. It does not hydrate settlement rows or nested journal, clearing, bank, or reversal records in Node.

### 4.3 Export

- Reads the authoritative summary once.
- Rejects exports above 100,000 rows.
- Fetches bounded chunks of 100 through stable base64url seek cursors.
- Fails closed when a cursor is absent, repeated, malformed, or used with a different sort.
- Does not restart or recompute the full candidate population for each page.
- Records actor, filters, row count, and outcome through:
  - `finance.booking_settlement_audit.exported`
  - `finance.booking_settlement_audit.export_failed`
  - `finance.booking_settlement_audit.export_partial`
- CSV metadata records generated time, actor, timezone, filters, sort, and total rows.

### 4.4 Data minimization

- Customer and Partner phone fields were removed from the list select.
- Phone numbers are not rendered and are not exported.
- Internal customer-wallet ledger evidence is used for classification and stripped before the Admin response.

## 5. P2 - desktop operating UX

### 5.1 List

- Compact global command strip: action required, overdue tax workflow, payment evidence, amount at risk/oldest.
- Visible primary filters: Search, Queue, Owner, Sort, Apply, Reset.
- Advanced disclosure: range, accounting period, method, reason, tax status, rows.
- Applied filters remain visible as chips.
- Five operational columns replace the previous wide evidence matrix:
  - Record and parties
  - Exposure
  - Evidence and blockers
  - Owner / next action
  - Review
- The first identity column is sticky inside the scoped horizontal table region.
- Empty search and empty queue states provide a clear/reset action.

### 5.2 Detail

- The first strip answers decision, primary owner/due, amount at risk, and tax workflow.
- The action checklist shows all blockers in server priority order.
- Allocation equation appears before detailed evidence.
- Canonical, reversal, tax, fee, and coupon evidence are separated.
- Raw IDs and source keys are collapsed in the final Technical evidence disclosure.
- The explicit Back to results action restores the original queue and filter URL.
- Raw enum copy such as `Journal POSTED` was replaced with operator-facing labels such as `Journal posted`.

## 6. Changed files

Core decision contract:

- `apps/api/src/settlements/settlement-audit-health.ts`
- `apps/api/src/settlements/settlement-audit-health.spec.ts`
- `apps/api/src/settlements/settlements.service.ts`
- `apps/api/src/settlements/settlements.service.spec.ts`

Admin read model and routes:

- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin.service.spec.ts`
- `apps/api/src/admin/admin-settlement.routes.ts`
- `apps/admin_web/lib/admin-api.ts`

Admin route, copy, export, and UI:

- `apps/admin_web/app/finance-tax/tax-settlement-page-model.ts`
- `apps/admin_web/app/finance-tax/tax-settlement-page-model.spec.ts`
- `apps/admin_web/app/finance-tax/booking-settlement-audit/page.tsx`
- `apps/admin_web/app/finance-tax/booking-settlement-audit/page.spec.tsx`
- `apps/admin_web/app/finance-tax/booking-settlement-audit/[id]/page.tsx`
- `apps/admin_web/app/finance-tax/booking-settlement-audit/[id]/page.spec.tsx`
- `apps/admin_web/app/finance-tax/booking-settlement-audit/settlement-audit-copy.ts`
- `apps/admin_web/app/api/admin/finance-tax/booking-settlement-audit/export/route.ts`
- `apps/admin_web/app/api/admin/finance-tax/booking-settlement-audit/export/route.spec.ts`
- `apps/admin_web/app/finance-tax/booking-settlement-audit/booking-settlement-audit.benchmark.spec.ts`
- `apps/admin_web/app/finance-tax/finance-list-pages.spec.tsx`
- `apps/admin_web/app/finance-tax/finance-detail-pages.spec.tsx`
- `apps/admin_web/app/globals.css`

These files already contained user changes in the dirty worktree. Work was applied in place and unrelated changes were not reverted.

## 7. Schema, migration, and rollout

- Schema change: none.
- Migration: none.
- New table/read model: none.
- New dependency: none.
- Existing PostgreSQL tables and indexes are used through a bounded SQL projection.

Operational rollout does not require a migration. Deploy API and Admin Web together because the new Admin payload consumes blocker metadata, workflow fields, amount at risk, summary facets, and cursors. Rollback is code-only, but rolling back only one side can restore the old queue semantics or break cursor/export expectations.

## 8. Verification

### 8.1 Focused tests

| Command | Result |
| --- | --- |
| API settlement health and mutation specs | 2 files, 46 passed |
| API Admin booking-settlement filter | 1 file, 8 passed, 592 skipped by filter |
| Admin audit/export/model plus shared surface contracts | 8 files, 217 passed |
| API lint | Passed |
| API typecheck | Passed |

### 8.2 Scope gates

`npm.cmd run verify:scope -- -Scope api`

- 162 test files passed, 1 skipped.
- 2,170 tests passed, 1 skipped.
- Prisma validate, policy coverage, notification contracts, realtime contract, backfill, typecheck, lint, and build passed.

`npm.cmd run verify:scope -- -Scope admin`

- 832 test files passed, 1 skipped.
- 4,463 tests passed, 1 skipped.
- API budget, typecheck, lint, query guards, visible-copy guard, and production build passed.

Both scope commands reported the repository-wide protected-file warning because the pre-existing worktree contains many unrelated protected changes. This task did not revert or normalize them.

### 8.3 Benchmark

Command:

```powershell
$env:HANDS_RUN_SETTLEMENT_AUDIT_BENCHMARK='1'
npm.cmd test --workspace @massage-vn/admin-web -- --run --reporter=verbose "app/finance-tax/booking-settlement-audit/booking-settlement-audit.benchmark.spec.ts"
```

Cold single-process CSV serialization:

| Rows | CSV size | Elapsed | Heap delta | Throughput |
| ---: | ---: | ---: | ---: | ---: |
| 10,000 | 5.71 MiB | 184.33 ms | 17.69 MiB | 54,250 rows/s |
| 100,000 | 57.43 MiB | 1,523.33 ms | 156.46 MiB | 65,646 rows/s |

This measures actual CSV generation with production-shaped rows. Database evidence is the bounded two-query list contract and one-query summary contract above; a production `EXPLAIN (ANALYZE, BUFFERS)` was not run against a live production-sized database.

### 8.4 Browser validation

Validated with the logged-in local browser at 1440x900 in dark and light themes.

- Full page horizontal overflow: 0 px.
- First complete table row top: 706 px, inside the requested first viewport.
- Final table columns: 24% / 18% / 24% / 20% / 14%; the Review badge and cell have no internal overflow.
- Sticky first table cell computed as `position: sticky`.
- Filter/reset controls remained inside the filter panel.
- More finance keyboard interaction: ArrowDown opened, Escape closed.
- Reversal queue exposed 41 records in local smoke data and 25 rows on the first page.
- Reversal detail rendered all five blockers in priority order and preserved the return query.
- Empty search rendered an explicit empty state with clear/reset actions.
- Repeated navigation samples: 281, 255, 254, 275, 267 ms; p50 267 ms.
- Browser console errors/warnings: none.

Before captures:

- [Default](booking-settlement-audit-remediation-verification-2026-08-10/00-before-default-1440x900.png)
- [Table right scroll](booking-settlement-audit-remediation-verification-2026-08-10/00-before-table-right-scroll-1440x900.png)
- [Reversal detail](booking-settlement-audit-remediation-verification-2026-08-10/00-before-reversed-detail-top-1440x900.png)

After captures:

- [Default dark](booking-settlement-audit-remediation-verification-2026-08-10/10-after-final-dark-confirmation-1440x900.png)
- [Final shared-surface confirmation](booking-settlement-audit-remediation-verification-2026-08-10/11-after-shared-surfaces-final-1440x900.jpg)
- [Default light](booking-settlement-audit-remediation-verification-2026-08-10/03-after-default-light-1440x900.png)
- [All records](booking-settlement-audit-remediation-verification-2026-08-10/04-after-all-records-1440x900.png)
- [Reversal queue](booking-settlement-audit-remediation-verification-2026-08-10/05-after-reversals-1440x900.png)
- [Reversal detail top](booking-settlement-audit-remediation-verification-2026-08-10/06-after-reversal-detail-top-1440x900.png)
- [Reversal detail full](booking-settlement-audit-remediation-verification-2026-08-10/07-after-reversal-detail-full.png)
- [Resolved state](booking-settlement-audit-remediation-verification-2026-08-10/08-after-resolved-state-1440x900.png)
- [Search empty](booking-settlement-audit-remediation-verification-2026-08-10/09-after-search-empty-1440x900.png)

## 9. Acceptance checklist

- [x] Normal open/declared tax workflow is not an integrity failure.
- [x] Tax workflow and integrity backlog are visibly separated.
- [x] Cash/wallet reversal handling does not require external clearing.
- [x] Card/MoMo/VNPay reversal handling requires reversed refund clearing.
- [x] Reversal journal/ledger evidence is still checked for internal methods.
- [x] Matrix tests cover five payment methods with open/closed reversal evidence.
- [x] Reversal summary distinguishes complete, incomplete, other blocker, and fully clear records.
- [x] All blockers are returned and shown in priority order.
- [x] Owner, due state, amount, action, and remediation route are exposed.
- [x] Primary queues and reason/status facets are separated.
- [x] Legacy deep links remain compatible.
- [x] Global summary scope is explicit and independent of table facets.
- [x] List filtering/sorting/pagination is database-side and bounded.
- [x] Summary avoids full nested hydration.
- [x] Export uses seek cursors and does not repeat a full scan per page.
- [x] Export success/failure/partial-failure activity is tested.
- [x] List, summary, export, and UI exclude unnecessary phone fields.
- [x] 10k and 100k benchmark evidence is recorded.
- [x] First 1440x900 viewport contains the first complete data row.
- [x] Table identity remains readable with sticky first-column behavior.
- [x] Detail puts decision and every blocker before technical evidence.
- [x] Error, empty, and filtered-empty paths are distinguishable.
- [x] API and Admin scope gates pass.
- [x] Before/after 1440x900 evidence is preserved.
- [x] Existing dirty-worktree changes are preserved.

## 10. Remaining external risk

The local implementation and repository gates are complete. Production validation still requires a production-like PostgreSQL snapshot to run `EXPLAIN (ANALYZE, BUFFERS)` for the projection CTE under real cardinality and to observe export memory through the deployed runtime. No production migration or external payment callback was executed in this task.
