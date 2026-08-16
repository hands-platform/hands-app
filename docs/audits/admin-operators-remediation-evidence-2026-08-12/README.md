# Operator Access remediation evidence

Date: 2026-08-12  
Workspace: `C:\dev\massage-on-demand-vn`  
Route: `http://localhost:3101/admin-operators`

## Verdict

Operator Access P0 contracts are implemented and the focused Admin/API tests pass. The repository remains on release hold because the full Admin suite still has three unrelated failures, four legacy Admin operators still require explicit permission migration, and production email delivery/MFA enrollment are not configured.

## Read-only data check

`npm.cmd run admin:operator-access:dry-run` completed without writes.

- Users: 1,478
- Admin operators: 22
- Master Admins: 4
- Finance Approvers: 12
- Permission rows: 18
- Missing permission rows: 4, deny-by-default
- Explicit empty permission rows: 0
- Credentials: 1
- Active Admin Web sessions after QA cleanup: 1
- Pending/expired invitations: 0/0
- Duplicate normalized Admin emails: 0
- Unsupported stored permissions: 0

## Browser evidence

- `01-operator-overview-1440.png`: 1440x1000 true directory and KPI overview.
- `02-filtered-migration-required-1440.png`: server-filtered migration-required operators.
- `03-detail-overview-1440.png`: operator identity, roles, authentication, MFA, and sessions.
- `04-effective-access-1440.png`: grouped direct/effective permission view.
- `05-permission-diff-1440.png`: client change preview without submission.
- `06-reason-validation-1440.png`: required reason validation; no mutation.
- `08-invite-form-1440.png`: one-time invitation form; no invitation created.
- `09-suspend-confirmation-1440.png`: target-specific suspension confirmation; no suspension submitted.
- `10-session-revoked-1440.png`: previous local QA session revoked; current session retained.
- `11-change-history-1440.png`: exact lifecycle history without page views.
- `12-read-only-self-protection-1440.png`: self-access is read-only and names the required recovery owner.
- `13-api-unavailable-1440.png`: API unavailable is distinct from permission denied and offers Retry.
- `14-overview-1600.png`: 1600x1000, no document-level horizontal overflow.
- `15-overview-1920.png`: 1920x1080, no document-level horizontal overflow.

`07-version-conflict-1440.png` was not fabricated. Browser-side modification of the hidden version value was blocked by the controlled browser surface. The stale-version contract and recovery copy are covered by API/Admin tests; no access mutation was made solely to create a screenshot.

Fresh browser console verification at 1440x1000 returned zero warnings and zero errors. Client and document scroll widths matched at 1440, 1600, and 1920.

## Verification

- Focused Admin Web: 87 passed, 0 failed.
- Focused API operator tests: 25 passed, 0 failed, 611 filtered/skipped.
- Full Admin Web: 4,529 passed, 3 failed, 1 skipped.
- Previously completed full API scope: 2,295 passed, 0 failed, 5 skipped.
- Admin typecheck, lint, query guards, visible-copy, and production build: passed.
- Secret leak guard: passed, 7,505 files scanned.
- Admin sensitive exposure guard: passed.
- Admin API read-budget tests: 5 passed.
- Prisma migration status: 91 migrations found; schema up to date.
- Impeccable detector: no Operator Access-specific finding. Seven existing `globals.css` side-accent warnings were outside this surface.

The three full Admin failures are outside this remediation:

1. Duplicate `.admin-notice-card` CSS extraction expectation.
2. Finance navigation expectation for Company Bank Accounts.
3. Finance closeout fixture date expects 70 days while the current Vietnam-time result is 71 days.

## Data mutations performed by QA

- Applied local migration `20260812040500_admin_operator_access_lifecycle` as part of the authorized local implementation.
- Created two local Admin Web sessions through real browser login.
- Revoked the older QA session and retained one current active session.
- Recorded two login-success events, one session-revoke lifecycle event, normal page-view activity, and authentication last-seen/reauthentication metadata.
- Did not create an invitation, change permissions or roles, suspend/reactivate an operator, reset credentials, or delete data.

## Remaining blockers

1. Resolve the three unrelated full Admin suite failures before repository release.
2. Review and explicitly migrate the four deny-by-default Admin operators with missing permission rows.
3. Configure and verify production invitation email delivery; the current safe fallback is a copy-once setup link.
4. Implement or configure a verified MFA enrollment/challenge provider before treating MFA as enforceable.
5. Complete a browser-only read-only flow with a dedicated non-Master credential and a visual stale-version conflict fixture if those screenshots are required for sign-off.
