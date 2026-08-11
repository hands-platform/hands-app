# Wallet Adjustments final remediation report

- Date: 2026-08-10
- Route: `http://localhost:3101/wallet-adjustments`
- Verification scope: desktop 1440 x 900 only
- Commit: Not committed

## Completion status

P0 finance controls, P1 operator workspace, P2 filters/audit/accessibility, database migration, focused tests, package scope gates, and read-only browser verification are implemented.

Three data-dependent browser states were not fabricated: owner search/valid preview/open-month selection cannot be entered because the local database has no VND period in `DRAFT` or `REVIEWED`; an attached internal evidence example is also absent. The UI correctly fails closed in that state. These paths are covered by focused tests instead of changing financial state in the browser.

## Change summary

1. A canonical period guard now allows manual wallet posting only in `DRAFT` and `REVIEWED` periods.
2. Accounting month is required and rechecked during preview, request creation, approval, and reversal.
3. Customer detail no longer has a direct single-operator execution path; it creates a maker request for a different finance approver.
4. Legacy-invalid pending requests return stable preflight blockers and cannot appear approvable.
5. Requests default to pending and oldest first, with Awaiting approval, Stale or blocked, Needs recreation, and History saved views.
6. Record/request details render in a full-width, URL-addressable evidence panel instead of a compressed table cell.
7. New evidence uses an internal `FileAsset` relation. Legacy URL evidence remains read-only.
8. Records and requests use server-side operational filters, matching count queries, filter summaries, pagination, and clear actions.
9. Structured audit rationale stores operational cause, expected correction, case reference, and detailed reason.
10. Empty results, blocked creation, policy blockers, and API load failures have distinct fail-closed UI paths.

## P0 status

### Accounting period policy

| Period state | Preview | Create request | Approve | Reversal |
| --- | --- | --- | --- | --- |
| `DRAFT` | Allow | Allow | Allow | Allow |
| `REVIEWED` | Allow | Allow | Allow | Allow |
| `DECLARED` | Deny | Deny | Deny | Deny |
| `PAID` | Deny | Deny | Deny | Deny |
| `CLOSED` | Deny | Deny | Deny | Deny |
| Missing / unknown | Deny | Deny | Deny | Deny |

Stable codes:

- `WALLET_ADJUSTMENT_PERIOD_REQUIRED`
- `WALLET_ADJUSTMENT_PERIOD_NOT_FOUND`
- `WALLET_ADJUSTMENT_PERIOD_NOT_OPEN`

The approval transaction rechecks the persisted request policy, latest wallet balance, accounting period, evidence, maker/checker separation, and reversal source before creating ledger/journal records.

### Direct execution removal

- Customer detail uses the same maker request contract as the Wallet Adjustments workspace.
- The former customer-direct route/service no longer executes a ledger entry.
- Success copy is `Awaiting finance approval`; the CTA is `Create approval request`.
- Maker self-approval remains denied by the API transaction guard.

### Legacy invalid requests

- List and single-request contracts expose `canApprove` and stable `blockers`.
- Invalid pending requests display `Legacy invalid — cannot approve` or `Recreation required — cannot approve`.
- The active action is `Cancel and recreate`; approval review is not presented as available.
- Approval Queue consumes the same server preflight result.

## P1 status

### Requests queue

- Default scope: `REQUESTED`, oldest first.
- Saved views and current local counts:
  - Awaiting approval: 10
  - Stale or blocked: 10
  - Needs recreation: 10
  - History: 35
- Pending age and blocker copy are shown in the lifecycle column.
- History retains Executed / Rejected / Cancelled filtering.

### Detail and reversal

- Selected detail is fetched once and rendered below the table at full workspace width.
- Request detail shows blocker evidence, owner identity, period, before/after balance, maker/approver, rationale, and private evidence.
- Record detail shows ledger/request IDs, accounting impact, immutable source key, evidence, and accounting entries.
- Detail query contains IDs only; reason and evidence data are not placed in the URL.
- Focus moves to the detail heading through the existing focus manager; close links restore list context.
- Reversal stays fixed to the original request, owner, amount, and opposite direction. Duplicate and evidence reconciliation checks remain server-side.

### Internal evidence

- Added `FINANCE_EVIDENCE` to `FilePurpose`.
- Added `FileAsset.originalName`.
- Added `ManualWalletAdjustmentRequest.attachmentFileId` with index and `ON DELETE SET NULL` relation.
- New request UI uses the existing admin presign/upload/complete flow.
- Stored evidence metadata includes file identity plus existing checksum, mime type, size, uploader, and upload state.
- Signed read URLs are issued on demand and are not persisted as audit evidence.
- High-value and receivable write-off checks remain enforced in policy/preflight.

## P2 status

- Records: period/date, owner, owner type, adjustment type, direction, amount, maker/approver, evidence, missing-period, sort, and page-size filters.
- Requests: saved view/status, request/owner search, owner type, adjustment type, direction, pending age, blocker, amount, maker, evidence, sort, and page-size filters.
- Filter count and row list share the same server predicate.
- Applied filters and Clear are visible without exposing private form payload in the URL.
- Shared Admin date controls and `AdminDisclosure` are used for date/month and advanced filters.
- Singular/plural labels, sentence case, Customer/Partner copy, and `Legacy · period missing` are normalized.
- Owner search, preview outcome, and selected-owner movement retain accessible live/focus behavior in the client workspace.

## Changed files and roles

### API and policy

- `apps/api/src/wallet-adjustments/manual-wallet-adjustment-policy.ts`: canonical policy matrix, period/evidence/rationale guards, stable blockers.
- `apps/api/src/wallet-adjustments/manual-wallet-adjustment-policy.spec.ts`: owner/type/direction, period, evidence, and rationale matrices.
- `apps/api/src/wallet-adjustments/wallet-adjustments.accounting.ts`: accounting entries remain canonical for normal and reversal postings.
- `apps/api/src/admin/admin-wallet.routes.ts`: wallet read/write route definitions without customer-direct execution.
- `apps/api/src/admin/admin.service.ts`: preview/create/approve/cancel/reversal/list/filter/hydration/preflight implementation.
- `apps/api/src/admin/admin.controller.ts`: route wiring and fail-closed authorization.
- Adjacent `*.spec.ts`: controller, service transaction, route, and accounting regression coverage.

### Database

- `apps/api/prisma/schema.prisma`: structured rationale and internal evidence relation.
- `apps/api/prisma/migrations/20260810112000_add_wallet_adjustment_finance_evidence/migration.sql`: additive finance evidence migration.

### Admin Web

- `apps/admin_web/app/wallet-adjustments/page.tsx`: three workspaces, saved views, server filters, full-width details, blocked states.
- `apps/admin_web/app/wallet-adjustments/actions.ts`: preview/create/upload actions and safe error mapping.
- `wallet-adjustment-create-workspace.tsx`: owner search, open-month selection, structured reason, upload, preview, invalidation.
- `wallet-adjustment-detail-focus.tsx`: selected detail focus and restoration support.
- `wallet-adjustment-form-key.ts`: preview invalidation key.
- `wallet-adjustment-reversal-workspace.tsx`: fixed-source reversal presentation and validation.
- `apps/admin_web/app/customers/[id]/customer-wallet-adjustment-form.tsx`: customer detail maker request form.
- `apps/admin_web/app/customers/[id]/customer-wallet-adjustment-panel.tsx`: no direct execution; approval request status/copy.
- `apps/admin_web/lib/admin-api.ts`: typed wallet request, evidence, period, filter, and preflight contracts.
- `apps/admin_web/app/globals.css`: desktop workspace/filter/detail/evidence styling using existing tokens.
- Adjacent `*.spec.tsx` and API contract specs: UI, URL privacy, copy, focus, and route regression coverage.

### Operations scripts

- `infra/scripts/manual-wallet-adjustment-policy-migration-dry-run.mjs`: read-only legacy request classification.
- `infra/scripts/manual-wallet-adjustment-lifecycle-smoke.mjs`: disposable maker/checker lifecycle smoke.
- `package.json`: dry-run command registration.
- Admin API read budget/route manifest: updated wallet route counts after direct execution removal.

## Migration and dry-run

Migration command:

```powershell
npx.cmd prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

Result: applied successfully. Final status reports 83 migrations and `Database schema is up to date!`.

Dry-run command:

```powershell
npm.cmd run finance:manual-wallet-adjustment-policy-dry-run
```

Read-only result:

- Pending requests inspected: 10
- `KEEP`: 0
- `CANCEL_AND_RECREATE`: 10
- `POLICY_MIGRATION_REQUIRED`: 3
- `WALLET_ADJUSTMENT_PERIOD_REQUIRED`: 10
- Database writes: 0

Evidence: `policy-migration-dry-run.txt`, `prisma-migrate-status.txt`.

## Automated verification

| Command | Result |
| --- | --- |
| `npm.cmd run test --workspace @massage-vn/admin-web -- app/wallet-adjustments "app/customers/[id]"` | PASS — 10 files, 84 tests |
| `npm.cmd run test --workspace @massage-vn/api -- src/wallet-adjustments src/admin/admin.service.spec.ts` | PASS — 3 files, 667 tests |
| `npm.cmd run typecheck --workspace @massage-vn/admin-web` | PASS |
| `npm.cmd run typecheck --workspace @massage-vn/api` | PASS |
| `npm.cmd run build --workspace @massage-vn/admin-web` | PASS |
| `npm.cmd run build --workspace @massage-vn/api` | PASS |
| `npm.cmd run verify:scope -- -Scope admin` | PASS — 831 files, 4,450 tests; typecheck, lint, query guards, visible copy, build |
| `npm.cmd run verify:scope -- -Scope api` | PASS — 161 files passed, 1 skipped; 2,139 tests passed, 1 skipped; typecheck, lint, build |
| `git diff --check` for related tracked files | PASS; only existing LF/CRLF notices |

Logs:

- `focused-admin-tests.txt`
- `focused-api-tests.txt`
- `verify-scope-admin.txt`
- `verify-scope-api.txt`

`verify:local` was not run because its broad local workflow may seed and mutate unrelated shared smoke data; the required Admin/API scope gates, migration status, builds, and focused finance tests were run instead.

## Browser verification

Environment:

- API health: `200` at `http://localhost:3000/api/health`
- Admin: production mode at `http://localhost:3101`
- Viewport: exactly 1440 x 900
- Horizontal document overflow: none on every captured healthy state
- Title: `Wallet Adjustments | HANDS Admin · HANDS Admin` in the current global metadata composition
- Console: 0 errors, 0 warnings on the final healthy Requests state
- Financial mutations from browser: none

Captured states:

- `18-requests-default-1440x900.png`
- `19-requests-stale-blocked-1440x900.png`
- `20-requests-policy-migration-filter-1440x900.png`
- `21-request-legacy-detail-1440x900.png`
- `22-records-default-1440x900.png`
- `23-records-filtered-1440x900.png`
- `24-record-detail-accounting-1440x900.png`
- `25-records-true-empty-1440x900.png`
- `26-new-request-no-open-period-1440x900.png`
- `27-requests-dark-mode-1440x900.png`
- `28-api-failure-state-1440x900.png`
- `14-reversal-read-only-summary-1440x900.png`
- `16-requests-light-before-theme-1440x900.png`

Verified:

- pending-first and oldest-first request queue
- saved view labels/counts and current selection semantics
- legacy-invalid blocker and cancel/recreate path
- full-width request and record details
- accounting entry readability and no table-cell compression
- true filtered empty state
- no-open-period fail-closed state
- reversal entry path without submit
- light/dark theme
- labelled request fields, advanced filter group, and table region
- keyboard Tab focus reaches a visible workspace action
- URL has no owner/amount/reason/attachment draft payload

Not fabricated:

- Owner search result, open-period selection, valid preview, and preview invalidation were not reachable because there is no open accounting month.
- An internal attached-evidence record was not present in local data; the evidence filter returned a true empty result.
- These behaviors are covered by focused Admin/API tests. No period, request, ledger, approval, cancellation, upload, or reversal was created for browser QA.

## Existing strengths regression check

- URL-addressable Records / Requests / New request: preserved.
- Active-view-only row loading: preserved.
- POST/local owner search and preview privacy: preserved.
- Canonical policy matrix and approval-time revalidation: preserved and strengthened.
- Idempotency, latest balance, immutable ledger/journal/audit: preserved.
- Settlement-only cash booking deduction: unchanged.
- Original-source reversal, exact amount/direction, duplicate guard: preserved.
- Preview invalidation form key: preserved.
- Bank/cash/output VAT non-impact copy: preserved.
- Light/dark desktop behavior: preserved.

## Protected areas and existing worktree

- Prisma schema and one additive migration were intentionally changed for structured finance evidence.
- No new dependency was added.
- No deployment, commit, or push was made.
- The worktree already contains a large number of user changes. Related files also contained prior edits, so broad diff statistics are not attributed solely to this remediation.
- Unrelated modified and untracked files were preserved; no reset, checkout, or cleanup was performed.

## Remaining risks and decisions

1. The local environment needs a controlled `DRAFT` or `REVIEWED` VND period plus disposable owner/evidence fixtures for an end-to-end valid preview browser capture. This should be created by a dedicated non-production fixture, not by clicking a finance mutation in this verification.
2. A total API outage prevents operator access resolution before the wallet page can render its own load-failure card, so the global shell currently shows `Access restricted` rather than an infrastructure-unavailable message. The outage remains visibly different from a true empty result, but the global access guard should eventually distinguish authorization denial from access-service failure.
3. Reversal evidence is not made universally mandatory because no authoritative policy requiring it was found. Existing high-value/write-off rules and source-evidence reconciliation remain enforced.
4. Global metadata currently composes the title as `Wallet Adjustments | HANDS Admin · HANDS Admin`; the requested page prefix is present, but removing the duplicated global suffix belongs in the shared metadata layer.

