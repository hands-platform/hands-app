# Finance Approvers release remediation implementation

- Date: 2026-08-14
- Route: `/finance-tax/finance-approvers`
- Final verdict: **RELEASE HOLD**
- Post-remediation implementation score: **84/100**
- Baseline audit score: 35/100

The code-level authorization boundary, source separation, audit targeting, and desktop operating flow are materially stronger. Release remains blocked because the current runtime proves `0 / 2` verified production approvers, not two independent human production approvers with completed setup, verified MFA, current attestation, and an independently governed checker. The database also contains unclassified or fixture-like high-privilege accounts that were deliberately not mutated by this task.

## 1. P0 and P1 disposition

| Audit item | Status | Implemented result |
| --- | --- | --- |
| Shared verified finance policy | Complete | UI readiness and finance execute paths use the same canonical policy and blocker codes. |
| Role-only finance execute paths | Complete for discovered callers | Refund, tax-policy decision, and central Admin finance decisions re-check verified policy at execution time. No unresolved money-moving role-only caller was found in the final inventory. |
| Fixture, test, unknown provenance exclusion | Complete | These sources fail closed for readiness and execution. They are separated from production defaults in Pending and History. |
| Shared DB integration first-write safety | Complete in code | Guard rejects shared, unknown, and non-allowlisted targets before the first write. Disposable integration run was not performed against the current shared DB. |
| Emergency suspension containment | Complete | Credential disable and session revocation occur without first removing the finance role; the role remains for investigation and audit. |
| Legacy authority accountability | Complete in code | Unattested legacy access is blocked. Attestation and decision endpoints append governance evidence without relabeling legacy authority as production. |
| Exact audit target preservation | Complete | Request target survives initial load, refresh, pagination, filter submission, and export. |
| Eligible/Pending/History desktop IA | Complete | Production defaults, source badges, compact core columns, drawers, recovery states, and exact actions were added. |
| Dirty guard and invalid decision handling | Complete | Missing or invalid decisions make zero API calls; cancel, close, Escape, backdrop, navigation, and API failure preserve the same dirty-state contract. |
| Production human approver evidence | Incomplete | No code change can prove the required two human owners, completed setup, verified MFA, current attestation, and independent checker. |
| Existing privileged-account classification | Incomplete | Current inventory contains production violations and unknown provenance. No account was changed or deleted in this task. |
| Disposable DB integration 4/4 | Not run | **NOT RUN — unsafe shared DB**. |

### Changed files and key symbols

| File | Key symbols and responsibility |
| --- | --- |
| `apps/api/src/admin/finance-approver-policy.ts` | `financeApproverPolicySnapshot`, `assertVerifiedFinanceApprover`; canonical provenance, credential, MFA, attestation, role, category, independence, and version policy. |
| `apps/api/src/admin/finance-approver-policy.spec.ts` | Fail-closed policy coverage, including attested legacy authority retaining `LEGACY` provenance. |
| `apps/api/src/admin/admin.service.ts` | `assertFinanceActionApprovalAdmin`, finance preflight helpers, operator/source filters, legacy attestation decisions, emergency suspension, and exact request evidence. |
| `apps/api/src/admin/admin.service.spec.ts` | Production/legacy source filtering, missing-credential visibility in Needs verification, governance decisions, and finance execution regressions. |
| `apps/api/src/admin/admin-finance-approver-governance.integration.spec.ts` | Disposable-schema governance integration with append-only audit parity and no row-level cleanup. |
| `apps/api/src/admin/admin-finance-approver-integration-db-guard.ts` and `.spec.ts` | First-write database/schema allowlist and shared-target rejection. These files existed in the dirty worktree and were verified, not weakened. |
| `apps/admin_web/app/finance-tax/finance-approvers/page.tsx` | Permission/data-aware CTA, production/legacy filters, compact subviews, exact audit links, drawers, and recovery states. |
| `apps/admin_web/app/finance-tax/finance-approvers/page.spec.tsx` | Truthful source labels, CTA states, exact links, drawer/source layout contract, and desktop IA regressions. |
| `apps/admin_web/app/globals.css` | Finance Approver desktop table/drawer layout; long source badges wrap without colliding with permission evidence. |
| `docs/audits/finance-approvers-subviews-release-remediation-*` | This implementation record and authenticated desktop evidence. |

## 2. Canonical verified finance policy

The canonical policy is implemented in `apps/api/src/admin/finance-approver-policy.ts` and reused by the Admin governance view and real finance execution callers.

An actor is allowed only when all applicable checks pass:

1. Provenance is production and is not a test or fixture identity.
2. Operator setup is complete.
3. An active credential exists and is not disabled.
4. The account is not currently locked.
5. MFA is configured and verified.
6. Legacy access, when present, has a current attestation.
7. The finance approver role and required category are present.
8. Maker and checker are independent.
9. The request and role version are current at execute time.

Canonical blocker codes:

```text
NON_PRODUCTION_PROVENANCE
TEST_OR_FIXTURE_ACCOUNT
UNKNOWN_PROVENANCE
SETUP_INCOMPLETE
CREDENTIAL_MISSING
CREDENTIAL_DISABLED
ACCOUNT_LOCKED
MFA_NOT_VERIFIED
LEGACY_ACCESS_UNATTESTED
ROLE_MISSING
CATEGORY_NOT_ALLOWED
MAKER_CHECKER_CONFLICT
STALE_ROLE_VERSION
```

An expired `lockedUntil` is not treated as a current lock. Policy evaluation is fail-closed when evidence is missing or provenance is unknown.

## 3. Finance caller inventory

| Execute or preflight boundary | Before | After |
| --- | --- | --- |
| Shared Admin finance actions | Distributed role/category checks | `assertFinanceActionApprovalAdmin` delegates to `assertVerifiedFinanceApprover` at execution time. |
| Referral cashout and booking settlement repair | Local approval checks | Canonical verified-finance assertion before closeout/repair. |
| Company bank and tax remittance decisions | Local role/category checks | Canonical verified-finance assertion before the decision. |
| Payment-fee activation/rejection and partner bank deposits | Local approval checks | Canonical assertion plus existing maker/checker separation. |
| Manual wallet adjustments | Role and request-state checks | Canonical assertion for approval, rejection, and legacy closeout paths. |
| Withdrawal paid/reversal and payout paid/reversal | Role and state checks | Canonical assertion before money-state transition. |
| Withdrawal and payout queue preflight | UI-oriented eligibility | `withProviderWalletWithdrawalPreflight` and `withPayoutBatchPreflight` use the same verified snapshot for actor and checker. |
| Refund decision | Finance role could be the dominant gate | `payments.service.ts` calls `assertVerifiedFinanceApprover` at execute time. |
| Tax-policy activation decision | Governance role gate did not express the full readiness contract | `provider-onboarding.service.ts` evaluates the canonical policy before apply/decision. |

Final repository search found remaining `Role.FINANCE_APPROVER` references only in governance counts, reads, state transitions, emergency metadata, and offboarding protection. No additional unresolved money-moving role-only execute path was identified.

## 4. Database first-write guard

The integration guard in `apps/api/src/admin/finance-approver-integration-db-guard.ts` permits writes only when the resolved database and schema identity is explicitly disposable and allowlisted. It rejects:

- the shared/local operational database URL;
- an unknown database or schema identity;
- a target without the explicit disposable opt-in;
- a cleanup target that does not resolve to the same disposable scope.

The guard is covered by unit tests before any integration mutation. The governance integration suite was intentionally not executed because the currently configured database is shared and contains operational/test-polluted records.

**Integration status: NOT RUN — unsafe shared DB.**

Current read-only governance inventory:

| Measure | Count |
| --- | ---: |
| High-privilege accounts | 23 |
| Classified production | 9 |
| Classified fixture | 1 |
| Unknown provenance | 13 |
| Pending finance requests | 2 |
| Production policy violations | 14 |

`npm.cmd run security:finance-approvers` completed in development mode with `mutation: none`. Its process exit was successful because it is a read-only development checker, but the inventory above is release-blocking.

## 5. Data, schema, and rollout impact

- No production or shared database row was inserted, updated, reclassified, attested, suspended, or deleted.
- No Prisma schema change or migration was added by this remediation.
- No backfill was run.
- Existing test-run and unknown-provenance inventory was preserved and surfaced as a separate source instead of being silently promoted to production.
- Rollout requires application deployment plus a separately approved human governance/data correction run.
- Rollback is application-code rollback only; this task has no data rollback step because it performed no database mutation.

## 6. Emergency suspension and legacy accountability

Emergency suspension disables the target credential and revokes sessions before any optional role lifecycle work. The finance role is not automatically removed, preserving evidence and avoiding a role-removal deadlock. Unauthorized actors and actors without recent reauthentication are rejected, and the action records reason and correlation data.

Legacy finance authority is blocked until attested. New append-only governance endpoints support creating an attestation and recording its decision. These routes are owned by the Admin identity domain and are included in route-ownership regression tests.

## 7. Admin subviews and copy

| Subview | Operational contract |
| --- | --- |
| Eligible operators | Shows production and legacy candidates split into `Ready for request` and `Needs verification`; test/fixture data is opt-in. |
| Pending | Defaults to the production operations queue; source filter exposes test-run requests separately. |
| Role history | Separates production, test, and legacy evidence and provides exact audit actions. |

| Previous copy or behavior | Remediated copy or behavior |
| --- | --- |
| `Active role holders` used as the candidate workspace | `Eligible operators`, while existing role holders remain available through the review link. |
| `Active` account filter mixed runtime activity with provenance | `Production and legacy`; URL value is `status=production`, with legacy provenance retained on each row. |
| Header always implied a request action | `Request access change` only when the actor may request and a candidate exists; otherwise `Resolve candidate blockers` or `View governance requirements`. |
| Long source evidence could overlap permission evidence | Source badges wrap inside a dedicated `finance-approver-source-badge` container. |
| Test/fixture evidence could resemble production work | Production remains the default; test runs and unknown provenance require an explicit source filter. |

Desktop tables use the audited five/six-column cores rather than forcing evidence and actions outside the first viewport. Drawers expose full evidence, decisions, and timelines. Invalid or deleted deep links render a recovery state instead of a silent empty screen.

The drawer restores focus to the exact triggering link after Escape or close, including filtered Pending URLs. Navigation-driven return URLs preserve only the filters valid for the active subview.

## 8. Exact audit contract

Finance request audit links use the supported exact target query. The same target is retained by:

- initial Admin audit-log load;
- refresh and pagination;
- filter form submission;
- CSV export;
- request drawer links and return navigation.

The audit table and export route share the exact target contract, preventing request evidence from broadening to unrelated events after navigation.

## 9. Verification results

### Focused Admin Web

```text
npm.cmd run test --workspace @massage-vn/admin-web -- app/finance-tax/finance-approvers/actions.spec.ts app/finance-tax/finance-approvers/page.spec.tsx app/audit-log/audit-log-page-model.spec.ts app/api/admin/audit-log/export/route.spec.ts
PASS - 4 files, 35 tests
```

### Focused API

```text
finance-approver-policy + integration DB guard
PASS - 2 files, 21 tests

admin.service finance-approver focused tests
PASS - 18 tests, 668 skipped by name filter

payments finance focused tests
PASS - 3 tests, 50 skipped by name filter

provider-onboarding service regression
PASS - 30 tests

route ownership + policy + DB guard
PASS - 3 files, 43 tests

finance approver governance integration
SKIP - 4 tests; suite compiled but the configured DB failed the disposable-target guard
```

### Repository scope verification

```text
npm.cmd run verify:scope -- -Scope admin
FAIL - typecheck, query guards, visible-copy checks, and build passed;
       full Admin tests had 3 unrelated existing failures and lint had one
       unrelated existing operations-policy failure.
       844 files passed, 4,639 tests passed, 3 failed, 1 skipped.

npm.cmd run verify:scope -- -Scope api
FAIL - Prisma validation, policy coverage, environment/contracts, typecheck,
       lint, and build passed. The task-related route ownership failure was fixed.
       The remaining full-suite failure is the unrelated notification campaign
       include/select mock expectation.

npm.cmd run api:test
FAIL - 178 files passed, 5 skipped, 1 failed;
       2,474 tests passed, 12 skipped, 1 failed.
       Remaining failure: admin.service.spec.ts notification campaign receipt
       persistence expectation uses legacy `include` while implementation uses `select`.
```

Admin scope's three unrelated failures:

1. `components/admin-surface-css.spec.tsx` expects an older notice-grid selector.
2. `lib/admin-navigation.spec.ts` has a company-bank-account access expectation mismatch.
3. `app/finance-closeout/page.spec.tsx` expects `Oldest: 70d ago` but receives `74d ago`.

Admin lint's unrelated failure:

1. `app/operations-policy/operations-policy-form.tsx` violates the existing `set-state-in-effect` rule.

The final Admin production build was rerun after the drawer source-badge fix and passed.

### Integration database

```text
Finance approver governance integration 4/4:
NOT RUN — unsafe shared DB
```

## 10. Browser verification

Verified with the authenticated local Admin session at 1440x1000 and 1920x1080 in light and dark themes.

Verified behaviors:

- Eligible operators, Pending, and Role history source separation;
- current `0 / 2` verified-production readiness, production-empty candidates, and explicit test-source states;
- invalid deep-link recovery;
- exact audit target preservation;
- request audit link narrowed the Audit Log to exactly one matching event and retained oldest-first ordering;
- Escape close and exact trigger focus restoration;
- zero page-level horizontal overflow at both viewports (`1425 / 1425` and `1905 / 1905` client/scroll widths);
- fixed drawer source badge no longer overlaps permission-version evidence;
- light and dark surface, text, badge, and focus contrast;
- no browser console error or warning on the clean verification tab.

Evidence:

1. [Eligible operators - 1440 light](finance-approvers-subviews-release-remediation-evidence-2026-08-14/11-eligible-operators-1440x1000-light-final.png)
2. [Eligible operators - 1440 dark](finance-approvers-subviews-release-remediation-evidence-2026-08-14/12-eligible-operators-1440x1000-dark-final.png)
3. [Eligible operators - 1920 light](finance-approvers-subviews-release-remediation-evidence-2026-08-14/13-eligible-operators-1920x1080-light-final.png)
4. [Eligible operators - 1920 dark](finance-approvers-subviews-release-remediation-evidence-2026-08-14/14-eligible-operators-1920x1080-dark-final.png)
5. [Exact Audit Log filter - 1920 light](finance-approvers-subviews-release-remediation-evidence-2026-08-14/15-exact-audit-filter-1920x1080-light-final.png)
6. [Role history summary - 1440 light](finance-approvers-subviews-release-remediation-evidence-2026-08-14/16-role-history-1440x1000-light-final.png)
7. [Role history table - 1440 light](finance-approvers-subviews-release-remediation-evidence-2026-08-14/17-role-history-table-1440x1000-light-final.png)
8. [Pending test-run queue - 1440 light](finance-approvers-subviews-release-remediation-evidence-2026-08-14/18-pending-queue-1440x1000-light-final.png)
9. [Pending read-only drawer, fixed - 1440 light](finance-approvers-subviews-release-remediation-evidence-2026-08-14/20-pending-view-only-drawer-1440x1000-light-fixed.png)

## 11. Human operational blockers

Release requires all of the following outside this code task:

1. Register and verify at least two named production human approvers.
2. Complete each operator's setup, credential activation, and MFA verification.
3. Assign independent maker/checker ownership and document the role governor.
4. Review and attest legitimate legacy finance authority, including break-glass ownership and expiry.
5. Classify or remove authorization from the 14 currently violating high-privilege production candidates and resolve 13 unknown-provenance identities through an approved, audited data correction.
6. Provision an allowlisted disposable database/schema with append-only audit parity, then execute and pass the governance integration suite 4/4.

## 12. Release recommendation

Keep **RELEASE HOLD**. The application now fails closed and presents a substantially more truthful operations view, but no production launch should proceed until the human governance evidence, polluted-account disposition, and disposable integration run above are complete and independently reviewed.

## 13. Change ownership and repository state

- Existing user changes and unrelated dirty files were preserved.
- Protected finance authorization and Admin identity routes were modified; focused policy, route ownership, service, typecheck, lint, and build verification was run.
- No commit, push, deployment, migration, or shared-DB mutation was performed.
