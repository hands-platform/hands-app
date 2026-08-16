# Company Bank Accounts Remediation Report

- Date: 2026-08-11
- Route: `/finance-tax/company-bank-accounts`
- Viewport: 1440 x 1000 desktop
- Baseline: 46/100, Release hold
- Outcome: **RELEASE HOLD remains**
- Commit: Not committed

## 1. Outcome

The Company Bank Accounts screen is now an operator workspace instead of a raw settings list. The implementation closes the highest-risk input, default-state, audit-query, fixture-selection, authorization, idempotency, and error-state gaps. It also separates current and archived records, adds server-derived lifecycle and health data, and moves approval decisions to the central Finance Approval Queue.

Release hold is not removed. The local data set contains no usable real company account, the cleanup manifest contains 13 manual-review records, several cross-domain reference types are not represented by authoritative relations, and destructive cleanup or live shared-data mutation was intentionally not performed.

## 2. Root Causes And Remediation

| Area | Root cause | Remediation |
| --- | --- | --- |
| Account number safety | The legacy mask field could accept raw-like values separated by punctuation or Unicode whitespace. | Admin input now accepts only ASCII `accountNumberLast4` with exactly four digits. The server derives the stored mask and rejects legacy/raw-like payloads with stable codes without echoing input. |
| Fixture isolation | Smoke identity depended partly on names and legacy metadata, and fixture accounts could appear as normal operational accounts. | A shared explicit fixture predicate is used by list, summary, lifecycle and selection contracts. Production creation/activation/selection is blocked. Legacy name matches are never auto-deleted. |
| Recent audit history | Broad text search applied `take` before client-side target filtering, so page views displaced real changes. | Server-side allow-listed `targetPrefix=company_bank_account:` filtering happens before limit. Recent results expose authoritative totals and are grouped by request lifecycle. |
| Error truth | Empty fallback arrays made 401/403/5xx look like zero accounts. | Result-aware reads preserve status, safe code and request ID. Account and timeline failures render independently; filtered empty and genuine empty are distinct. |
| Approval ownership | The settings page duplicated approval affordances and did not expose checker availability before request. | Request creation remains on the account workspace; approve/reject remains in `/finance-tax/approval-queue?view=bank-accounts`. Eligible checker count and readiness are shown before submission. |
| Unsafe default | Prisma default could create an active account outside approval intent. | `CompanyBankAccount.status` now defaults to `INACTIVE`; an additive migration changes only the default. |
| Retry/concurrency | Duplicate retries could create duplicate requests or ambiguous 409 responses. | Create/update/status requests use idempotency keys and serialized transaction boundaries. Potential duplicate and version conflict use separate stable error codes. |
| Operational UX | Current, archived, fixture, readiness and reconciliation meaning were mixed into one dense list. | Current/Archived modes, health strip, filters, server totals, explicit actions, readiness and archive-impact dialogs, drawer forms, sticky footer and request receipts were added. |

## 3. P0/P1/P2 Status

| Phase | Status | Evidence |
| --- | --- | --- |
| P0-A input and storage safety | Complete in code and focused tests | Last4-only DTO/form, derived mask, bypass matrix tests, no input echo. |
| P0-B fixture isolation | Partial | Production guards and dry-run cleanup are implemented. Existing 13 records remain manual review; no apply was run. A live smoke accumulation rerun was not performed against shared data. |
| P0-C exact audit history | Complete in code and browser | Exact target prefix before limit, authoritative total, grouped request lifecycle, exact full-audit link. |
| P0-D permissions and failure states | Complete in code; partial browser evidence | Permission matrix, independent result states and central queue ownership are implemented and unit-tested. Live 401/403/partial failure captures were not produced. |
| P0-E defaults, idempotency and concurrency | Complete in code and focused tests | INACTIVE default migration, idempotency and advisory-lock/transaction conflict handling. |
| P1 operating model and lifecycle | Partial | Current health, verification, import/reconciliation projections and lifecycle labels are present. Scheduled payout/refund/settlement references remain explicitly unavailable rather than reported as zero. |
| P1 readiness and archive preflight | Partial | Server and UI block known impacts and show approver readiness/replacement candidates. Unsupported reference domains keep release on hold. |
| P1 desktop workspace | Complete for 1440px | Health strip, Current/Archived, filters, nine-column table, drawer, sticky actions and dialogs verified. |
| P1 errors and copy | Partial | Structured safe error states and retained form state are implemented. A clickable field-error summary is present, but every field does not yet render an adjacent inline server error. |
| P2 performance/data loading | Complete for implemented projections | Summary/current/recent timeline are bounded; heavy readiness/impact reads are dialog-scoped; exact totals replace array lengths. |

## 4. Masking Security Contract

The Admin form sends only `accountNumberLast4`. Accepted input is `/^[0-9]{4}$/`; the response and persistence contract expose only a server-derived mask such as `•••• 5678`.

The API rejects raw-like or non-ASCII inputs, including:

- `12345678`
- `1234 5678`
- `1234-5678`
- `1234.5678`
- `1234/5678`
- `1234(5678)`
- `1234A5678`
- `1234\u00A05678`
- `１２３４５６７８`

Validation errors use stable codes and field paths and do not echo the submitted value. No full account-number field, URL parameter, audit metadata field or logging path was added.

## 5. Permission Matrix

| Capability | Required authority | Current behavior |
| --- | --- | --- |
| View account workspace | Finance bank reconciliation read authority | Unauthorized access is not rendered as an empty account list. |
| Create/edit/status request | Existing company-bank-account mutation authority | Produces a pending approval request; no direct activation. |
| Approve/reject | Finance approver/checker authority | Central Finance Approval Queue only; self-approval remains blocked. |
| View full audit evidence | System audit authority | Link is shown only when access allows it; limited account timeline remains separate. |
| Select account for finance operation | Purpose-specific finance authority plus production fixture guard | Explicit fixture accounts are excluded in production. |

The implementation does not introduce break-glass approval and does not weaken maker/checker separation. When no other eligible checker exists, normal submission is blocked with an explicit reason.

## 6. Audit Query Before And After

Before remediation, `/admin/audit-logs?q=company_bank_account&take=20` could consume the limit with page-view events and the browser then removed non-account targets. The visible result therefore decreased merely by navigating the Admin.

After remediation:

- the API applies an allow-listed `company_bank_account:` target prefix before ordering and limit;
- recent results report an authoritative total;
- the page groups request and decision events by `requestId`;
- legacy direct changes are labelled as recorded updates, not fictitious approvals;
- the full audit link retains the exact target prefix.

Browser data showed `20 of 66 changes`, grouped into 10 request lifecycles. The full audit page showed the same exact account target filter. Page-view events were not included in the account-change result.

## 7. Fixture Inventory And Cleanup Safety

Dry-run manifest:

`docs/audits/company-bank-accounts-remediation-evidence-2026-08-11/company-bank-accounts-cleanup-manifest-2026-08-11T13-28-51-594Z.json`

| Measure | Result |
| --- | ---: |
| Total current database records inspected | 13 |
| Manual review | 13 |
| Delete candidates | 0 |
| Destructive apply performed | No |
| Usable real accounts | 0 |
| Explicit fixture detected by current UI | 1 |

Two legacy active smoke accounts retain transaction/reconciliation evidence: one has 1 transaction and 1 reconciliation match; one has 56 transactions and 44 reconciliation matches. Both are manual-review records and are never deletion candidates based on name. The remaining legacy rows also stay manual review because their provenance or unsupported direct-reference coverage is incomplete.

`company-bank-accounts:cleanup:apply` requires a reviewed manifest and explicit confirmation. It was not executed.

## 8. Schema, Migration And Idempotency

The additive migration `20260811193000_default_company_bank_account_inactive` changes the database default from active to inactive without rewriting existing rows. Prisma validation and the migration integrity check pass.

Create/update/status request handling now uses:

- explicit `INACTIVE` creation intent;
- request idempotency keys;
- serialized transaction/advisory locking around duplicate-sensitive writes;
- distinct `COMPANY_BANK_ACCOUNT_POTENTIAL_DUPLICATE` and `COMPANY_BANK_ACCOUNT_VERSION_CONFLICT` responses;
- stable readiness, archive-blocked and approver-unavailable codes.

No last4-based unique constraint was added because last four digits are not a reliable account identity.

## 9. Readiness And Archive Impact

Activation preflight reports legal owner, verification evidence, bank identity/potential duplicate, statement-import readiness, purpose/direction/currency completeness, primary conflict and eligible approvers. The API and dialog use the same server result; known blockers disable submission.

Archive preflight reports transaction, reconciliation and import impact, primary/default status, replacement candidates and last activity. Known open impacts block submission. Scheduled payout, refund and settlement references are not modeled as direct authoritative relations in the current schema; the UI returns `unavailable` rather than a false zero. This is a release blocker.

## 10. Verification

### Focused and scope verification

| Command | Result |
| --- | --- |
| Admin company-bank-account focused specs | PASS: 3 files, 16 tests |
| API company-bank-account focused specs | PASS: 8 tests; unrelated tests skipped by focus |
| `npm.cmd run typecheck --workspace @massage-vn/admin-web` | PASS |
| `npm.cmd run typecheck --workspace @massage-vn/api` | PASS |
| Admin production build | PASS |
| API production build | PASS |
| `npm.cmd run admin:visible-copy` | PASS |
| `npm.cmd run company-bank-accounts:cleanup:test` | PASS: 3/3 |
| `npm.cmd run prisma:migrations:check` | PASS: 88 migrations, no violations |
| `npm.cmd run verify:scope -- -Scope api` | PASS: 2263 tests passed, 1 skipped; typecheck/lint/build passed |
| `npm.cmd run verify:scope -- -Scope admin` | FAIL: 3 unrelated/pre-existing full-suite assertions; typecheck/lint/guards/build passed |
| `git diff --check` | PASS; line-ending warnings only |
| Impeccable detector | PASS: `[]`, executed once |

The Admin full-suite failures are outside this route:

1. `admin-surface-css.spec.tsx` matches a later focus shadow override before the base notice layout rule.
2. `admin-navigation.spec.ts` still expects Finance operators not to see the Company Bank Accounts route, while the current navigation exposes it.
3. `finance-closeout/page.spec.tsx` hard-codes `70d ago`; the date-sensitive result is now `71d ago`.

### Full local verification

`npm.cmd run verify:local` completed with exit code 1. Company-bank-account focused checks, Prisma validation, API/Admin typecheck, API/Admin build, public web checks, Docker compose contract, Customer Flutter analyze/test and Partner Flutter analyze/test passed. The aggregate command failed on existing cross-domain checks:

- Operations Policy/final-authority marker drift;
- Vietnam scope guard findings in tax audit documentation;
- API domain smoke assertion at `infra/scripts/api-domain-smoke.mjs:207`;
- Supabase SQL schema missing the Prisma `FINANCE_EVIDENCE` enum value;
- the three Admin tests listed above.

These failures were not modified to make this task pass and remain separately actionable.

`admin:api-budget` could not be accepted as a live performance pass because its live probe returned 401. The static/unit budget contract passed; live authenticated measurement remains blocked.

## 11. Browser QA Evidence

Evidence folder: `docs/audits/company-bank-accounts-remediation-evidence-2026-08-11/`

Canonical captures:

1. `01-current-health-fixture-warning-1440x1000.jpg`
2. `03-add-drawer-last4-preview-1440x1000.jpg`
3. `05-filtered-empty-1440x1000.jpg`
4. `08-activation-readiness-blocked-1440x1000.jpg`
5. `09-archive-impact-blocked-1440x1000.jpg`
6. `12-exact-recent-timeline-1440x1000.jpg`
7. `12b-full-audit-exact-filter-1440x1000.jpg`
8. `13-archived-accounts-1440x1000.jpg`
9. `13b-archived-table-1440x1000.jpg`
10. `14-unsaved-close-guard.md`

Verified at 1440 x 1000:

- current health and fixture warning are visible in the first operational viewport;
- mask preview displays `•••• 5678` while only last4 is editable;
- filtered empty copy does not claim the database is empty;
- activation and archive dialogs expose blockers and keep the submit action disabled;
- recent and full audit views retain exact target scope;
- archived records are separated from current records;
- the dirty drawer triggers the native unsaved-change confirmation;
- no document-level horizontal overflow was present (`scrollWidth 1425`, viewport 1440);
- browser console warnings/errors were empty.

Not browser-captured: genuine database empty, 401, 403, partial timeline failure, zero eligible approvers, successful shared-data mutation receipt, and ready activation/archive submission. Their contracts are covered by focused tests, but this is not equivalent to live browser evidence.

## 12. Changed Files

Primary implementation files:

- `apps/admin_web/app/finance-tax/company-bank-accounts/page.tsx`
- `apps/admin_web/app/finance-tax/company-bank-accounts/page.spec.tsx`
- `apps/admin_web/app/finance-tax/company-bank-accounts/company-bank-account-drawer-shell.tsx`
- `apps/admin_web/app/finance-tax/company-bank-accounts/company-bank-account-request-form.tsx`
- `apps/admin_web/app/finance-tax/company-bank-accounts/company-bank-account-status-dialog.tsx`
- `apps/admin_web/app/audit-log/page-content.tsx`
- `apps/admin_web/app/globals.css`
- `apps/admin_web/lib/admin-api.ts`
- `apps/admin_web/lib/admin-operator-access-model.ts`
- `apps/admin_web/lib/admin-operator-access-model.spec.ts`
- `apps/api/src/admin/admin-bank.routes.ts`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.dto.spec.ts`
- `apps/api/src/admin/admin-company-bank-account.dto.spec.ts`
- `apps/api/src/admin/admin-service-input.ts`
- `apps/api/src/admin/admin-service-input.spec.ts`
- `apps/api/src/admin/admin-service-selects.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin.service.spec.ts`
- `apps/api/src/admin/admin.controller.spec.ts`
- `apps/api/src/admin/admin-route-domain.spec.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260811193000_default_company_bank_account_inactive/migration.sql`
- `infra/scripts/company-bank-account-cleanup.mjs`
- `infra/scripts/company-bank-account-cleanup.test.mjs`
- `infra/scripts/lib/company-bank-account-cleanup.mjs`
- `package.json`

The worktree contained many user-owned changes before this task. No reset, restore, clean, stash, commit or push was performed. Unrelated dirty files were preserved.

## 13. Protected Areas

Prisma schema and migrations were modified because the unsafe ACTIVE default required a database-level correction. The migration is additive and only changes the default. No authentication, payment, booking, settlement mutation policy or existing transaction reference was changed by this remediation.

Scope verification reported the expected protected-area warning for `apps/api/prisma/`. Other protected-area dirty changes shown by repository status pre-existed this remediation and were not reverted.

## 14. Remaining Release Blockers

1. **No usable real account exists in the verified local data set.** Operational activation/import/reconciliation cannot be proven end to end with real company account data.
2. **Thirteen historical fixture records require human review.** Cleanup apply was correctly not run.
3. **Archive/reference coverage is incomplete.** Scheduled payout, refund and settlement references require authoritative relations or a documented source before archive can be considered fully safe.
4. **Live maker/checker mutation was not executed.** Successful receipt, central queue approval and post-approval activation were not browser-verified against shared data.
5. **Several failure states lack browser evidence.** 401/403/partial-source/zero-approver states are tested but not captured from a live session.
6. **Field-level server errors need one more UI pass.** The current accessible summary preserves state but errors are not adjacent to every affected field.
7. **Repository-wide verification is not green.** Existing cross-domain guard/test failures are listed above.

## 15. Next Action

The most important next action is to define and implement an authoritative cross-domain reference projection for scheduled payouts, refunds and settlements, then run a controlled two-operator activation/import/archive lifecycle against an isolated non-production company account. Only after that evidence is captured should the release hold be reconsidered.

