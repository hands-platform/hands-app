# Finance Approver bootstrap and recovery

This runbook does not create a break-glass bypass. It preserves two independent
production approvers, current Admin Web reauthentication and MFA, maker/checker
separation, and append-only audit evidence.

## Preconditions

- A named policy owner and two named human operators approve the bootstrap plan.
- Both operators use verified work email identities and are classified as
  `PRODUCTION` from retained owner evidence.
- Credential setup, MFA, and the required Finance categories are complete.
- Any provenance correction is handled as a separately reviewed data correction;
  the Finance Approvers page never promotes unknown, fixture, or test accounts.

## Recovery order

1. Run `npm run security:finance-approvers` and retain its read-only JSON output.
2. Review every unknown or fixture high-privilege account with its owner. Do not
   change provenance without retained evidence and an approved data correction.
3. Use **Admin Operators** to invite or select the two real production operators,
   finish credential setup and MFA, and assign only the required Finance categories.
4. Confirm the Finance Approvers category matrix reports both operators for every
   money-movement category.
5. If no Finance checker exists, stop. The normal UI cannot bootstrap the first
   checker and this runbook does not authorize a direct role grant. A separately
   approved, deployment-owned bootstrap procedure with two human owners, immutable
   audit evidence, and rollback evidence is required before any data change.
6. Once an independent checker exists, use the normal access request and decision
   workflow. The maker, target, and checker must satisfy the enforced separation.
7. Run `npm run security:finance-approvers -- --release`. A non-zero exit remains a
   release blocker; do not weaken the predicate or relabel test data.

## Incident containment

Use the existing Admin Operator suspension/session-revocation controls for urgent
containment. Do not delete audit logs, force-close pending requests in SQL, forge MFA
evidence, or use a fixture account as a production approver. A blocked or stale
request may be safely rejected by a valid independent checker in the product.

## Evidence to retain

- policy owner and operator identities;
- provenance and work-email evidence;
- credential, MFA, permission-version, and category coverage evidence;
- access request ID, maker/checker IDs, and exact audit target;
- release-gate JSON before and after the approved operational change;
- rollback owner and result.
