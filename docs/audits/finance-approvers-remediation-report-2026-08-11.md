# Finance Approvers Remediation Report

Date: 2026-08-11

## Verdict

**RELEASE HOLD**

The direct Finance Approver role toggle was replaced with a durable maker/checker workflow, but the local operational data does not yet satisfy release readiness:

- Verified production Finance approvers: `0 / 2 required`
- High-privilege accounts with unknown provenance: `12`
- Verified independent maker/checker pair: unavailable
- A full API outage is still rendered by the global Admin access gate as `Access restricted`, not as a service-unavailable state.

No existing account role or provenance was changed to manufacture a passing result.

## Implemented Controls

### Durable access workflow

- Direct grant/revoke endpoints and row forms were removed from this route.
- A request records target, previous state, requested state, requester, normalized reason, idempotency key, and role snapshot.
- A different verified role governor must approve or reject the request.
- Approval executes the role change in the same serialized transaction as request state and audit records.
- Rejection does not mutate the target role.
- Repeated identical request/decision calls replay the durable result; conflicting reuse is rejected.
- Concurrent revoke requests recheck the minimum independent approver count in the transaction.
- Generic Admin operator mutation paths cannot add or remove `FINANCE_APPROVER`.

### Least privilege and provenance

- Governance read, history, request, and decision routes have separate permission categories.
- Requests require a verified production Master Admin with operator credentials.
- Decisions require a different verified production Master Admin who is also a Finance approver.
- `SYSTEM` alone is not decision authority.
- Fixture, unknown-provenance, self-target, no-op, stale-role, duplicate-pending, and insufficient-coverage cases fail closed.
- Fixture provenance fields were added to Admin user records and smoke/seed creators now mark their fixture ownership.

### Operator UX

- One route provides `Active approvers`, `Eligible admins`, `Pending requests`, and exact `History` views.
- Readiness uses verified real approvers only and exposes primary/backup coverage separately.
- Request and decision drawers show target state, proposed state, policy preflight, impact, blockers, and the server recheck boundary.
- Reasons use a preserved 12-500 character controlled field.
- Success receipts include before/after, requester/checker, timestamps, request ID, and exact audit navigation.
- Empty queues are distinct from failed reads in the page implementation.
- Finance tables use the shared `FinanceDataTable`; disclosures and actions use shared Admin components.

## P0 Remaining

1. **Classify 12 high-privilege accounts.** Each account must be verified by an owner before setting `PRODUCTION` or `FIXTURE`. Do not infer provenance from its name.
2. **Establish two verified real Finance approvers.** The normal request/independent-decision flow must produce primary and backup coverage.
3. **Verify a real maker/checker browser receipt.** The local session is an unknown-provenance approver and is correctly blocked; no existing role was altered for a screenshot.
4. **Correct the global Admin outage state.** When the operator-access API is unavailable, the root gate currently shows `Access restricted`. It must distinguish authorization denial from dependency failure before production release.
5. **Run authenticated API payload/latency budget.** `admin:api-budget` reached the API but returned HTTP 401, so no authenticated budget was measured.
6. **Run actual browser 200% zoom.** The in-app viewport supported a 720x500 CSS-pixel equivalent with no page-level horizontal overflow, but did not expose an actual browser zoom control.

## Tests

### Passed

- Admin focused Finance Approver tests: `20 / 20`
- Admin Finance/shared contract set after remediation: `139 / 139`
- Admin lint: passed
- Admin typecheck: passed
- Admin production build: passed
- API focused route/service/guard tests: `17 / 17`
- API Admin service suite: `636 / 636`
- Database concurrency/rollback integration tests: `4 / 4`
- API scope verification: passed (`2,275` tests passed, `5` skipped)
- Admin visible-copy guard: passed (`1,614` files)
- Finance Approver governance script syntax: passed
- Prisma schema validation: passed with repository environment
- Prisma migration status: database up to date

### Admin scope result

Admin scope verification completed with build/typecheck/query/visible-copy gates passing. The full Admin suite ended with `4,528` passing, `1` skipped, and three failures unrelated to Finance Approvers:

- Company Bank Accounts sidebar expectation differs from the current navigation.
- A shared notice CSS contract finds an earlier focus-ring-only `.admin-notice-card` rule.
- Finance Closeout's date-sensitive fixture expects `70d ago`; the current date renders `71d ago`.

The four Finance Approver-originated contract failures discovered on the first scope run were fixed: server-action object export, legacy button classes, raw details surfaces, and use of the non-Finance table shell.

## Data Mutations

- Applied existing pending local migration `20260811193000_default_company_bank_account_inactive`.
- Applied new migration `20260811231500_finance_approver_access_governance`.
- Database integration tests created isolated temporary governance users/requests/audits and cleaned them.
- No existing Admin role, provenance, request, or audit record was changed for browser verification.
- Governance cleanup diagnosis was read-only (`mutation: none`).

## Evidence

Folder: `docs/audits/finance-approvers-remediation-evidence-2026-08-11`

- `01-readiness-active-1440x1000.png`: blocked readiness and active directory
- `02-eligible-admins-1440x1000.png`: eligible view with unknown-provenance blockers
- `03-request-review-blocked-1440x1000.png`: request preflight and blocked submission
- `04-revoke-impact-blocked-1440x1000.png`: revoke impact and minimum coverage blocker
- `05-pending-empty-1440x1000.png`: true empty pending queue
- `06-history-empty-1440x1000.png`: true empty exact role history
- `07-api-unavailable-global-access-restricted-1440x1000.png`: remaining global outage misclassification
- `08-active-200-percent-equivalent-720x500.png`: 200% CSS-pixel equivalent, no page-level horizontal overflow
- `09-governance-read-only-dry-run.json`: exact release-blocking account IDs and recommendations
- `10-keyboard-skip-focus-1440x1000.png`: keyboard skip-link focus
- `11-readiness-dark-1440x1000.png`: dark-theme state contrast

At 1440x1000, `innerWidth=1440`, document scroll width was `1425`, and no console errors or warnings were recorded. The 720x500 equivalent had document scroll width `705`, so no page-level horizontal overflow was introduced.

## Protected Areas

Protected areas were intentionally changed:

- Prisma schema and migration for durable governance and fixture provenance
- Admin identity routes, DTOs, service authorization, transaction logic, and audit writes
- Admin operator permission mapping

Unrelated protected changes already present in the worktree, including Booking files, were preserved and not reverted.

## Rollout and Rollback

1. Back up the database and apply migrations before deploying API/Admin code.
2. Run the read-only governance invariant and classify every listed account with owner evidence.
3. Establish two production approvers through the new request/decision workflow.
4. Capture a real success receipt and exact audit chain.
5. Re-run authenticated API budget, API/Admin scope verification, and browser outage-state verification.

Rollback must stop role-change traffic first, restore the pre-deploy application, and preserve the governance request/audit table for investigation. Do not drop the migration while any request or audit evidence is needed.

## Repository State

- Existing user changes were preserved.
- No commit, push, or deployment was performed.
