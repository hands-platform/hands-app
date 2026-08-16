# Tax Policy Remediation Implementation — 2026-08-12

## Scope

This implementation changes the existing `/tax-policy` workspace and its NestJS authority. It does not add a second tax policy route, a second tax calculator, or a client-side approval identity selector.

The local production-like services used for verification are:

- Admin: `http://localhost:3101`
- API health: `http://localhost:3000/api/health`
- Database: local PostgreSQL `massage_vn`

No commit, push, deployment, or production database operation was performed.

## Release blockers resolved

### Direct mutation is fail closed

- Only `DRAFT` policy metadata and rules are mutable.
- An ACTIVE, SCHEDULED, APPROVED, SUPERSEDED, ARCHIVED, or legacy-review policy cannot be edited in place.
- The Admin UI renders current and historical policies read-only and creates a new draft for changes.

### Immutable lifecycle and durable approval

- Lifecycle: `DRAFT -> PENDING_APPROVAL -> APPROVED/REJECTED -> SCHEDULED -> ACTIVE -> SUPERSEDED -> ARCHIVED`.
- Approval requests are durable `TaxPolicyApprovalRequest` records with maker, checker, reasons, payload hash, idempotency key, timestamps, activation state, and failure code.
- Maker and checker identities come from authenticated sessions. The UI has no approver ID field.
- A maker cannot approve their own request.
- Submission and decision fail closed when independent Finance approver readiness is unavailable.

### Scheduled activation and one-active invariant

- A future approved policy becomes `SCHEDULED`; the current policy remains ACTIVE until the effective instant.
- Delayed queue activation is backed by a periodic due-policy sweep.
- Activation uses a PostgreSQL advisory lock and one transaction to supersede the current policy and activate the scheduled policy.
- Partial unique indexes enforce one ACTIVE legacy status and one ACTIVE lifecycle status.

### Unified access boundary

- All tax policy reads, simulation, audit, integrity, approval submission, and approval decisions use `FINANCE_TAX`.
- API route-category and Admin Web API-call manifests include the new audit, integrity, and approval endpoints.

### Smoke and seed isolation

- New writes carry explicit provenance: `OPERATOR`, `SEED`, `SMOKE_TEST`, `MIGRATION`, or `LEGACY_UNKNOWN`.
- Legacy migration classification is a one-time conservative backfill. Name matching is not used as the runtime source of truth.
- Cleanup is dry-run only and refuses `--apply`.
- ACTIVE or financially referenced fixtures are retained and marked for manual review.

## Data and calculation contract

### Production calculation reuse

`calculatePartnerTaxWithholding` is shared by earning closeout and the read-only Admin simulation. Rule precedence is:

1. Specific service
2. Inclusive gross amount band
3. Default rule

Split VAT/PIT rules take precedence over a combined withholding rule. The Admin converts percent input to basis points at the server-action boundary and rejects precision beyond two decimal places.

### Vietnam time

- Policy scheduling is represented as `Asia/Ho_Chi_Minh`.
- `datetime-local` values round-trip through an explicit ICT conversion helper.
- UI labels show Vietnam time rather than silently treating local input as UTC.

### Integrity and applicability

- The 30-day integrity summary scans the complete `ProviderEarning` population in the range.
- Record integrity is separated from tax applicability.
- The detailed evidence table remains a bounded 25-row sample and is labelled as such.
- API failures are unavailable states, never zero.

The actual local read-only SQL result on 2026-08-12 was:

| Metric | Count |
| --- | ---: |
| Earning records | 130 |
| Healthy record evidence | 117 |
| Amount mismatch | 0 |
| Missing tax log | 13 |
| Missing snapshot | 0 |
| No active policy | 0 |
| No approved tax profile | 63 |
| No matching rule | 0 |

Applicability counts may overlap record-integrity counts; they are intentionally separate dimensions.

## Admin workspace

The page is organized as:

1. Current policy
2. Drafts and approval workflow
3. History
4. Audit and integrity

The workspace uses document scrolling. Data tables have horizontal overflow only, and do not create nested vertical scroll regions. Draft metadata, rule editing, and impact preview use shared Admin disclosures and form atoms. The impact preview uses published service catalog items and the production calculation endpoint for current-versus-proposed results.

## Local database and migration

- Migration: `20260812013000_tax_policy_governance`
- `prisma:migrations:check`: PASS, 90 migrations, no violations
- `prisma migrate status`: PASS, database schema up to date
- Prisma client generation: PASS
- Existing database inventory: 145 fixture-classified policies
- Current ACTIVE fixture: `Smoke withholding 1785768305234`
- Current ACTIVE fixture references: 5 tax logs and 5 settlement snapshots
- Cleanup disposition: `CRITICAL / RETAIN_AND_MANUAL_REVIEW`

The active fixture was not mutated or deleted.

## Verification

### Passed

- Admin tax policy focused tests: 27/27
- Admin shared form/surface/access regression tests: 76/76
- API tax policy and earning focused tests: 73/73
- API category guard and manifest tests: 44/44
- API full scope: 169 files passed, 2 skipped; 2,293 tests passed, 5 skipped
- API typecheck, lint, build: PASS
- Admin typecheck, lint, build: PASS
- Admin visible-copy guard: PASS, 1,616 files
- Admin query guards: PASS
- Migration static check: PASS
- Dry-run fixture cleanup test: PASS
- Actual dry-run cleanup: PASS, 145 records inspected, no writes
- `git diff --check` for the touched scope: PASS; line-ending warnings only

### Existing Admin scope failures outside this remediation

After tax-policy-specific guard failures were fixed, three unrelated existing tests remain red:

1. `components/admin-surface-css.spec.tsx` expects the older Admin notice-card grid declaration.
2. `lib/admin-navigation.spec.ts` expects Company Bank Accounts to be absent from a Finance sidebar despite the current navigation configuration.
3. `app/finance-closeout/page.spec.tsx` expects `70d ago`; current date arithmetic renders `71d ago`.

These files were not changed for this remediation.

## Browser verification

The Admin and API were rebuilt and restarted in production mode. The stale CSS chunk `500` observed before restart was eliminated; the login page then rendered with zero console errors or warnings.

The browser had no authenticated Admin session. `/tax-policy` redirected to `/login?redirectTo=%2Ftax-policy`, so the protected Current, Drafts, History, Audit, maker/checker, error, and pagination states could not be visually verified without bypassing authentication.

Evidence:

- `output/tax-policy-remediation-verification-2026-08-12/01-login-blocked-1440x1000.png`
- `output/tax-policy-remediation-verification-2026-08-12/02-login-blocked-1680x1050.png`

No viewport at or below 1024px was inspected.

## Protected areas and preservation

- Protected schema and earning-closeout code were changed because the requested lifecycle and single calculation authority require them.
- No booking mutation policy, payment policy, settlement mutation policy, Customer app, or Partner app behavior was changed.
- Existing unrelated dirty and untracked files were preserved.
- The current worktree remains uncommitted.

## Remaining risk

The only tax-policy-specific verification gap is authenticated browser QA at 1440x1000 and 1680x1050. Repeat the recorded Current, Drafts, History, Audit, maker/checker, invalid schedule, simulation, integrity, and pagination states after an authorized Admin session is available.
