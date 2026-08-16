# Admin Operators remediation evidence

Date: 2026-08-14

## Verdict

**RELEASE HOLD**

The directory, lifecycle, effective-access, invitation, session, and offboarding contracts were hardened. Release remains blocked because the current Admin Web authentication flow has no MFA enrollment, challenge, recovery-code, or reset implementation. Master Admin and Finance Approver MFA therefore cannot be enforced truthfully. The existing-user grant flow also lacks an unambiguous server-backed picker, and classified high-privilege fixture cleanup still requires an owner-approved apply run.

## Safety boundary

- No operational Admin user, role, permission, credential, invitation, or session record was mutated.
- No cleanup or permission normalization apply mode was run.
- No Prisma migration was applied.
- No external email, SMS, or MFA provider setting was changed.
- No secret, setup token, recovery code, personal email, or raw user-agent value is included here.
- Existing dirty-worktree changes outside the Admin Operators scope were preserved.

## Before and after

Before:

- Fixture records could enter the operational directory and KPI scope.
- Lifecycle rendering and status filters could disagree.
- Security setup counted overlapping problems instead of distinct operators.
- Raw stored permission entries and effective leaf permissions were mixed.
- Missing permission policies had no safe initialization path.
- Pending invitations had no revoke or token-rotating resend action.
- Session revocation used a fixed hidden reason and lacked an operator confirmation step.
- Offboarding was not exposed as a guarded operational workflow.
- The page implied MFA state without an actual MFA authentication flow.

After:

- Operational reads exclude explicit `FIXTURE` provenance and fixture metadata by default.
- Test records are available only through an explicit non-production diagnostic option.
- One canonical lifecycle resolver powers rows, filters, and filtered counts.
- Security setup uses a distinct affected-operator count with a separate breakdown.
- Effective leaf access, stored entry count, and legacy-parent compatibility are explicit.
- Permission initialization, invitation revoke/resend, session revoke confirmation, and guarded offboarding are wired to audited API actions.
- The compact command strip links directly to server-backed work queues.
- The UI presents the absent MFA implementation as a release blocker, not as configured security.

## API and data contracts

### Directory and summary

- Added explicit `includeTestRecords` support restricted to non-production diagnostics.
- Added lifecycle states `SUSPENDED`, `LOCKED`, `MIGRATION_REQUIRED`, `SETUP_REQUIRED`, and `ACTIVE` with one priority order.
- Added `securityIncompleteDistinct` and `mfaNotConfigured` summary values.
- Added `effectiveCategories`, `effectiveLeafPermissionCount`, and `storedPermissionCount`.
- Category filtering accepts canonical leaf permissions and legacy parent entries during normalization.
- Canonical leaves take precedence when a legacy key has the same name.

### Actions

- Added audited permission-policy initialization with recent reauthentication, reason, self-action protection, and concurrency conflict handling.
- Added invitation revoke and token-rotating resend. Plaintext setup tokens are returned only in the immediate response and are not written to audit metadata.
- Added per-action `allowedActions` and `blockedReasons` for initialization, access update, suspension, reactivation, offboarding, and session revocation.
- Hardened offboarding to require prior suspension, zero active sessions, Finance Approver removal, recent reauthentication, exact-name confirmation, and last-Master protection.
- Offboarding removes Admin operator permission/credential state and pending invitations while preserving the product user, unrelated roles, retained audit history, and unrelated records.

### Fixture and normalization tools

- `infra/scripts/admin-operator-permission-normalize.mjs`
  - Read-only by default.
  - Apply requires `--apply`, `--confirm=NORMALIZE_ADMIN_OPERATOR_PERMISSIONS`, and a Master actor ID.
  - Uses optimistic version checks and exact audit events.
- `infra/scripts/admin-operator-fixture-cleanup.mjs`
  - Read-only by default.
  - Reports exact candidates, dependencies, and `DELETE_ELIGIBLE` or `MANUAL_REVIEW` disposition.
  - Apply requires an explicit confirmation, actor, and exact IDs.
- Finance Approver governance integration fixtures now use unique run IDs, explicit `FIXTURE` provenance, and exact before/after cleanup that fails closed.

## Read-only data evidence

`npm.cmd run admin:operator-access:dry-run`

- Total Admin-role users: 1,508
- Operational Admin operators: 40
- Master Admins: 10
- Finance Approvers: 20
- Permission rows: 18
- Missing permission rows: 22
- Credentials: 13
- Active Admin Web sessions: 2
- Pending/expired invitations: 0 / 0
- Duplicate normalized emails: none
- Unsupported permissions: none
- Explicit provenance observed: `PRODUCTION` 12, `FIXTURE` 1
- Mutation: none

Permission normalization dry-run, repeated twice:

- Permission rows inspected: 18
- Rows needing normalization: 3
- Unsupported entries: none
- Idempotency: true
- Candidate set was stable across both runs
- Apply: not run

Fixture cleanup dry-run:

- Exact candidates: 13
- Most candidates require manual review; three were reported delete-eligible
- Apply: not run

Finance Approver governance read-only check:

- High-privilege total: 23
- Production: 9
- Fixture: 1
- Unknown provenance: 13
- Release-blocking accounts: 14
- Mutation: none

## Verification results

Passed:

- Admin Operators focused Admin Web suite: 65 tests passed.
- Earlier focused Admin Operators Admin Web suite: 15 tests passed.
- Admin Web typecheck.
- Admin Web lint after dialog/control correction.
- Admin Web production build.
- API focused Admin operator tests: 6 passed, unrelated tests skipped by filter.
- API controller focused tests: 4 passed, unrelated tests skipped by filter.
- API route-domain/category guard tests: 71 passed.
- API typecheck, lint, and build through scope verification.
- `security:admin-sensitive`: no violations.
- `security:finance-approvers`: check completed read-only; 14 release-blocking records reported.
- `admin:visible-copy`, Admin query guards, notification contracts, and Admin API budget checks.
- Impeccable detector: no Admin Operators-specific finding. Seven warnings referenced pre-existing unrelated global side-tab selectors.
- `git diff --check`: no whitespace errors; line-ending conversion warnings only.

Failed or partial:

- Admin scope verification ended with three unrelated full-suite failures after the Admin Operators-specific form failure was fixed:
  - shared Admin notice CSS rhythm contract;
  - Finance navigation permission expectation;
  - Finance closeout date/age fixture expectation.
- API scope verification ended with one unrelated Notification Push Campaign assertion failure. The full API result at that run was 2,460 passed, 12 skipped, and 1 failed.
- Finance Approver disposable-schema integration tests were skipped because the required isolated database environment was unavailable.

## Browser verification

The production Admin Web and API were rebuilt and restarted on:

- Admin Web: `http://localhost:3101`
- API: `http://localhost:3000`

The restart invalidated the previously authenticated browser session. The requested route redirects to:

`http://localhost:3101/login?redirectTo=%2Fadmin-operators`

At 1440 x 1000, the login page produced no browser console warnings or errors. Authenticated state-by-state screenshots were not captured because no credential was requested, inspected, or bypassed. This is a verification blocker, not a successful screen validation. No screenshots are claimed in this directory.

## Remaining blockers

1. **Actual MFA is absent.** The schema exposes an MFA state, but the current authentication flow has no enrollment, challenge-before-session, recovery codes, reset, or approved secret-encryption boundary. Required next decision: approve the encryption/key-management boundary and authentication design, then implement and threat-model the complete flow.
2. **Existing-user selection is absent.** The unsafe raw user-ID input was removed. Required next work: provide an authorized server search and an ambiguity-safe existing-user picker before enabling that grant path.
3. **High-privilege data classification remains.** Fourteen Finance governance records are release blockers and thirteen have unknown provenance. Required next action: an owner reviews the exact dry-run manifest and explicitly approves only verified cleanup/classification targets.
4. **Authenticated visual QA remains.** A valid local Admin login is required to capture the directory, queues, details, invitation actions, review dialog, sessions, histories, offboarding preflight, no-result/error states, and MFA blocked state at 1440 x 1000 without mutating real records.

## Release decision

Do not release Admin Operators as a completed access-control workspace until actual MFA enforcement and the high-privilege provenance review are closed. The implemented code should remain behind the existing Admin authorization boundary and the truthful release-blocker notice.
