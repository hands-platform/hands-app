# Customer Referrals Remediation Implementation Report

Date: 2026-08-11  
Workspace: `C:\dev\massage-on-demand-vn`  
Route: `/referrals/customers`  
Commit: Not committed

## 1. Verdict

Customer referral reward decisions now fail closed from the Admin form through the API and wallet posting transaction. Reward decisions require a meaningful reason, explicit confirmation, the loaded reward status, and the loaded `updatedAt` version. The server independently verifies credit eligibility and rejects stale or duplicate work before any wallet or journal write.

The default Customer Referrals screen is now a reward-level `Needs action` queue. Parent-level history remains available as a secondary disclosure. Read failures, true empty results, and filtered-empty results are rendered as different states. Store-link readiness and policy write safety are surfaced without exposing environment variable names to ordinary operators.

P0 and P1 safety requirements are complete. The operational queue and detail flow are materially improved. Two external or missing-authority constraints remain: production referral/store URLs are not configured, and the current reward model has no authoritative queue owner or SLA contract. The UI therefore does not invent either value.

## 2. Implemented Changes

### P0 - Reward mutation safety

- Reward decision reason is required, trimmed, and limited to 12-500 characters in Admin and API validation.
- Hold, release, credit, reverse, cashout approval, tax review, and paid actions require explicit confirmation and evidence text before submission.
- Admin mutations use fail-closed request handling. HTTP 400, 403, 409, 5xx, and network failures do not revalidate or show a success notice.
- Every reward mutation carries `expectedStatus` and `expectedUpdatedAt` from the loaded row.
- Reward status changes use an atomic `updateMany` predicate on reward id, status, and `updatedAt`; a stale row returns HTTP 409.
- `HELD -> AVAILABLE` is implemented as an explicit release action. The removed bulk release UI no longer suggests an unsupported batch contract.
- Wallet credit runs a server-side preflight before claiming the reward. It checks attribution eligibility, integrity review, owner, completed booking and earning evidence, selected Partner, captured/released payment when present, refund state, posted unreversed settlement, policy snapshot, hold maturity, and duplicate wallet-ledger source keys.
- Credit and reverse use a serializable transaction and a temporary `LOCKED` claim so concurrent requests cannot post the same reward twice.
- A credited reward reversal creates compensating accounting records instead of silently rewriting the original wallet entry.

### P1 - Read and policy trust

- Customer referral summary, reward queue, parent records, and detail reads use result-aware Admin API handling.
- Summary or reward-queue failure is not rendered as a zero-value success state.
- Parent-record failure can be shown as a partial secondary-read error without hiding a valid reward queue.
- Public referral links are enabled only when public base, Android store, and iOS store readiness all pass the canonical `referralStoreSetupState` check.
- Ordinary operators see consolidated setup blockers; raw environment variable keys are limited to the developer setup path.
- Customer policy saves require reason, confirmation, expected policy version, and fail-closed handling.
- Policy shows the per-reward liability cap, immutable VND currency, and before/after impact summary.
- The customer commission policy no longer renders a misleading `Fixed reward / Not applicable` metric.

### P2 - Queue and empty states

- The first operational table is a reward-level `Needs action` queue rather than a parent aggregate list.
- Queue rows include parent, referred customer, amount, qualifying booking, attribution/integrity evidence, current reward state, eligibility/update time, and a detail action.
- Internal enum copy such as `QUALIFIED`, `CLEAR`, and `HELD` is mapped to operator-facing labels.
- The default attention scope includes actionable available, held, and matured pending rewards.
- `All parent records` remains on the same route as a secondary disclosure.
- Filtered empty state explains that records exist but are hidden and provides a clear-filters action.
- Main read errors suppress mutable actions and fake KPI values.

### P3 - Density, action surface, and accessibility

- The top band is reduced to four decision metrics: ready to credit, on hold, pending release, and credited.
- The duplicate `Referral sign-ups` KPI was removed from the main operational viewport.
- Singular/plural copy is generated correctly for visible reward, attribution, referral, parent-account, and hold-period counts.
- Reward `availableAt` is labelled `Eligible since` to describe the business meaning.
- Reward ledger columns have scoped minimum widths and normal word wrapping.
- The open reward action surface is a viewport-contained 420px fixed panel so horizontal table scroll cannot clip the confirmation form.
- Action forms show the current readable state, amount, booking evidence, and before/after mutation impact.
- Referral tables have unique accessible region names and keyboard-focusable scroll regions.
- Light and dark themes were checked at 1440x900, including filtered empty, read error, policy, and held-reward action states.

## 3. Changed Files and Responsibilities

### API

- `apps/api/src/admin/admin.dto.ts` - decision validation and optimistic-concurrency inputs.
- `apps/api/src/admin/admin.service.ts` - reward-level Customer queue, release route service, exact attention summary, and audited decision forwarding.
- `apps/api/src/admin/admin-referral.routes.ts` - Customer reward queue and held-reward release endpoints.
- `apps/api/src/referrals/referrals.service.ts` - authoritative preflight, atomic version claim, serializable wallet/accounting mutations, release, reversal, and cashout safety.
- `apps/api/src/admin/admin.dto.spec.ts`
- `apps/api/src/admin/admin.service.spec.ts`
- `apps/api/src/referrals/referrals.service.spec.ts`
- Related existing referral/controller/accounting contract specs were retained and passed.

### Admin Web

- `apps/admin_web/app/referrals/actions.ts` - fail-closed actions, confirmation/reason/version checks, and conflict notices.
- `apps/admin_web/app/referrals/customers/page.tsx` - result-aware summary, reward queue, and parent reads.
- `apps/admin_web/app/referrals/customers/[id]/page.tsx` - result-aware detail and safe notices.
- `apps/admin_web/app/referrals/referral-dashboard.tsx` - reward-first queue, policy safety, readiness, empty/error states, and final density/copy pass.
- `apps/admin_web/app/referrals/referral-detail.tsx` - decision evidence, held release, safe action panel, and readable status copy.
- `apps/admin_web/app/referrals/referral-store-setup-status.tsx` - consolidated operator-safe readiness state.
- `apps/admin_web/lib/admin-api.ts` - reward version and queue response contracts.
- `apps/admin_web/app/globals.css` - scoped reward queue, ledger, disclosure, policy, and action-panel styling.
- Referral Admin specs were expanded for fail-closed behavior, stale 409 handling, reward ordering, read errors, release, and layout contracts.

No Prisma schema or migration was added. Customer App and Partner App were not changed by this remediation.

## 4. Validation Results

### Focused tests

- `npm.cmd run test --workspace @massage-vn/admin-web -- app/referrals/referral-dashboard.spec.tsx app/referrals/referral-detail.spec.tsx app/referrals/actions.spec.ts lib/referral-links.spec.ts lib/referral-reward-credit-state.spec.ts`
  - PASS: 5 files, 76 tests.
- `npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.dto.spec.ts src/admin/admin.controller.spec.ts src/admin/admin.service.spec.ts src/referrals/referrals.service.spec.ts src/referrals/referrals.accounting.spec.ts`
  - PASS: 5 files, 867 tests.

### Type and scope gates

- `npm.cmd run typecheck --workspace @massage-vn/admin-web`
  - PASS.
- `npm.cmd run typecheck --workspace @massage-vn/api`
  - PASS.
- `npm.cmd run verify:scope -- -Scope admin`
  - PASS: 835 test files passed, 1 skipped; 4,496 tests passed, 1 skipped; typecheck, lint, query guards, visible-copy guard, and production build passed.
  - WARN: repository-wide protected changed files require review because the worktree already contains extensive user changes.
- `npm.cmd run verify:scope -- -Scope api`
  - PASS: 162 test files passed, 1 skipped; 2,190 tests passed, 1 skipped; Prisma validate, policy contracts, typecheck, lint, and build passed.
  - WARN: same repository-wide protected-file review warning.
- `git diff --check` on the referral Admin/API scope
  - PASS. Only existing LF/CRLF conversion warnings were printed.

### Non-mutating referral checks

- `npm.cmd run referrals:public-link-smoke -- --dry-run`
  - PASS. No external navigation or mutation was performed.
  - All four store destinations are reported as not configured.
- `npm.cmd run referrals:reward-action-smoke -- --dry-run`
  - PASS. Hold, credit, and reverse routes/contracts were enumerated without posting wallet or accounting mutations.
- `npm.cmd run external:check:referrals`
  - FAIL (external setup): `REFERRAL_PUBLIC_BASE_URL` and the Customer/Partner Android Google Play URLs are not configured. iOS remains deferred.

The Admin server was restarted after the final production build. `/login?redirectTo=/referrals/customers` returned HTTP 200 and the generated CSS chunk returned HTTP 200 with 22,631 bytes.

## 5. Browser Verification

Viewport: 1440x900. No destructive or money-moving action was submitted.

Verified states:

1. Customer reward-level needs-action queue, light theme.
2. Filtered empty state and Clear action, light theme.
3. Held-reward action panel with reason, evidence, confirmation, and release action.
4. Customer referral policy, light theme.
5. Customer referral policy, dark theme.
6. Customer reward-level queue, dark theme.
7. Main read-error state with fake KPI/action suppression.
8. Browser console: no final errors or warnings.

Screenshots:

- `remediation-verification/01-customer-referrals-needs-action-light-1440x900.png`
- `remediation-verification/02-customer-referrals-filtered-empty-light-1440x900.png`
- `remediation-verification/03-customer-referral-held-reward-action-light-1440x900.png`
- `remediation-verification/04-customer-referral-policy-light-1440x900.png`
- `remediation-verification/05-customer-referral-policy-dark-1440x900.png`
- `remediation-verification/06-customer-referrals-needs-action-dark-1440x900.png`
- `remediation-verification/07-customer-referrals-read-error-light-1440x900.png`

The final source-only density pass removed the fifth top KPI and normalized remaining enum/count copy after the browser session had already been finalized. That final pass is covered by focused tests, full Admin tests, typecheck, lint, visible-copy guard, and production build, but no new post-pass screenshot was captured.

## 6. Protected Areas and Existing Changes

This work intentionally modified the protected money-state service `apps/api/src/referrals/referrals.service.ts` because the requested concurrency and wallet-credit safety cannot be enforced in presentation code. The modification is covered by service, accounting, Admin service, DTO, route, full API, and build verification. No schema or migration was changed for this task.

The worktree contained a very large set of pre-existing modified, deleted, and untracked files. No reset, checkout, cleanup, commit, push, or deployment was performed. Unrelated changes were left in place. Several files in this task were already dirty, so the repository-wide diff stat is not a reliable measure of only this remediation.

## 7. Remaining Risks and Required Follow-up

1. Configure `REFERRAL_PUBLIC_BASE_URL`, Customer/Partner Google Play URLs, and later iOS URLs, then rerun `external:check:referrals` and the non-dry-run public-link smoke in an approved environment.
2. If queue ownership and SLA reporting are required, define authoritative persisted owner/assignment and SLA policy data first. The current schema/contract has timestamps but no trustworthy owner or SLA source, so this implementation deliberately does not infer or hardcode them.
3. Capture one final 1440x900 light/dark screenshot after the post-browser density pass when a new browser QA session is opened.

