# Operations Policy Matching Supply Final Remediation

- Report date: 2026-08-14 (evidence folder retains the requested 2026-08-13 audit name)
- Route: `/operations-policy?details=matching&matching=supply`
- Git HEAD: `406d16a7919c`
- Admin build ID: `Kz899-aeEydB-MxrYJ_aZ`
- Release assessment: **PARTIAL**

The focused Operations Policy implementation, tests, production builds, local services, and browser checks pass. Full release sign-off remains conditional because the real PostgreSQL concurrency integration could not run in the current environment. The broader Admin/API scopes also retain unrelated baseline failures listed below.

## 1. Operator Outcome

The Operations Policy control plane now fails closed when a policy lifecycle is missing or unknown, and it opens the write form only for a `live` policy whose audit read path is healthy. Locked, planned, deprecated, and contract-unavailable policies remain read-only even through a direct `?edit=` URL.

Matching Supply keeps its concise first view while making expanded evidence easier to act on:

- blocker counts explicitly warn that categories overlap;
- evidence timestamps use ICT local time plus relative age;
- metric cards carry explicit operational scope and kind instead of inferring `Live` from a zero value;
- zero open-matching samples show an honest empty state and no generated scenario rows;
- radius and freshness sensitivity tables are full-width stacked and do not require internal horizontal scrolling at the requested desktop sizes;
- valid changed values no longer show the contradictory "Choose a value different" helper.

## 2. Finding Status

| Finding | Status | Evidence |
| --- | --- | --- |
| Missing/unknown lifecycle cannot expand edit access | PASS | Normalized to `unknown`; no edit link/form; direct deep links show a read-only notice. |
| Runtime lifecycle matches source contract | PASS | 19 live / 2 locked / 7 planned / 0 unavailable on the rebuilt runtime. |
| Non-live API write guard | PASS | Focused API tests confirm stable conflict behavior and no successful non-live mutation. |
| Audit source filters and cursor contract | PASS | Operator, automated smoke, and legacy unknown filters return distinct healthy states; API specs pass. |
| Audit read failure closes policy writes | PASS | Page/action guards and focused tests require audit health; browser outage evidence shows no Save path and exposes recovery navigation. |
| Isolated audit-only browser failure | PARTIAL | The safest live fault injection available was a broad API outage. The audit-only state is covered by the focused component/page tests. |
| Value plus audit persistence transaction | PASS | Existing authoritative API transaction was retained and focused operational-policy tests pass. |
| Real PostgreSQL same-key concurrency | NOT VERIFIED | Integration file ran but all three cases were skipped because a disposable real PostgreSQL test environment was unavailable. |
| Blocker overlap and explicit metric semantics | PASS | Expanded Supply evidence includes overlap copy and explicit scope/kind values. |
| Localized observed time and relative age | PASS | Browser and model/component tests confirm ICT time plus age copy. |
| Zero open matching sample | PASS | Empty state renders; stage scenario table and rows do not render. |
| Sensitivity desktop layout | PASS | Full-width vertical stack at 1440 and 1600; measured 1600 client width equals scroll width. |
| Existing Simulation blocked behavior | PASS | Focused Operations Policy regression suite passes. |
| Existing dirty form reset, high-risk confirmation, rollback | PASS | Existing and updated focused regression specs pass. |
| Light/dark state meaning and console health | PASS | Both themes inspected; final warning/error console collection is empty. |

## 3. Root Causes and Fixes

### Lifecycle contract

The UI previously inferred lifecycle from the legacy `enforced` boolean when `lifecycle` was missing. That could convert an incomplete or old response into editable `live` state. A single Operations Policy normalizer now maps only supported values and turns missing/unknown values into `unknown`. Counts, badges, links, deep-link selection, and form eligibility all consume that normalized view. The Admin API type now requires lifecycle for the current contract while the runtime boundary remains defensive.

### Audit write gate

Page rendering and server actions previously treated audit-read availability independently from mutation eligibility. The selected edit state now reads minimal audit health and requires both `live` lifecycle and healthy audit access. An unavailable audit path renders a factual disabled notice with Retry and System Health routes. The server action repeats the audit-health check before PATCH so hiding or bypassing the form cannot widen permission.

### Supply evidence

String-derived metric presentation, overlapping blocker counts, raw ISO timestamps, and a broad `bookings.length > 0` condition made zero-supply evidence look more certain than it was. The model now supplies explicit metric semantics, overlap copy, localized time, and `openMatchingCount`. The stage section keys rendering to actual `OPEN_MATCHING` evidence. Sensitivity tables were removed from the two-column detail grid and stacked at full width.

## 4. Source and Runtime Contract

- Expected and actual source distribution: **19 live / 2 locked / 7 planned**.
- Rebuilt local runtime distribution: **19 live / 2 locked / 7 planned / 0 contract unavailable**.
- API process: PID `39752`, `node dist/main.js`, started `2026-08-14T03:34:30+07:00`.
- Admin process: PID `37724`, `next start --port 3101`, started `2026-08-14T03:35:47+07:00`.
- API health: `200`, service `hands-api`.
- Admin route: authenticated browser renders `HANDS Admin`; anonymous HTTP correctly redirects to login.
- Consistency check: 28 definitions and exact lifecycle/key contracts pass.

## 5. Audit Runtime and Write Gate

- Operator source: healthy empty state, not an error.
- Automated smoke source: healthy empty state, not an error.
- Legacy unknown source: retained records displayed.
- Unavailable state: policy mutation UI closed; recovery actions shown.
- Browser QA did not submit Save, rollback, booking, wallet, payment, or policy mutations.

## 6. Open Matching Zero and Sensitivity

- `MatchingStageImpactPreview` now carries `openMatchingCount` explicitly.
- `openMatchingCount === 0` produces `No open matching bookings to model` and no scenario table.
- Radius and freshness tables use a compact four-column operating read and render as separate full-width sections.
- At the 1600 desktop check, the document client width and scroll width were both `1585`, confirming no page-level horizontal overflow.

## 7. Verification Results

| Command / check | Result |
| --- | --- |
| `npm.cmd run test --workspace @massage-vn/admin-web -- app/operations-policy` | PASS: 45 files, 156 tests |
| Operations Policy plus Admin KPI usage focused regression | PASS: 46 files, 159 tests |
| `npm.cmd run typecheck --workspace @massage-vn/admin-web` | PASS |
| API matching and audit-source focused specs | PASS: 2 files, 19 tests |
| API operational-policy focused service tests | PASS: 6 selected tests; 659 skipped by name filter |
| `npm.cmd run typecheck --workspace @massage-vn/api` | PASS |
| `npm.cmd run policy:admin-consistency` | PASS: 28 definitions, lifecycle 19/2/7 |
| Real PostgreSQL concurrency integration | NOT VERIFIED: 1 file and 3 tests skipped; environment unavailable |
| Admin production build | PASS |
| API production build | PASS |
| `git diff --check` before report | PASS; existing LF normalization warnings only |
| Impeccable final detector | PASS: `[]` |
| Local API/Admin status and health | PASS |
| Browser console warnings/errors after final build | PASS: none |

### Broader scope results

`verify:scope -- -Scope admin` was attempted. The Operations Policy-specific residual failure was fixed and re-run successfully. Three unrelated existing failures remain:

1. `admin-surface-css.spec.tsx` resolves a duplicate `.admin-notice-card` rule before the expected grid declaration.
2. `admin-navigation.spec.ts` expects Company Bank Accounts to be absent while current navigation includes it.
3. `finance-closeout/page.spec.tsx` contains a date-sensitive `Oldest 70d` expectation while current data renders `73d`.

`verify:scope -- -Scope api` and the full API test run were attempted. The API result was 173 files passed, 4 skipped, 2,389 tests passed, 11 skipped, and one unrelated existing push-campaign receipt test failure: the fixture expects Prisma `include`, while current code uses a richer `select` state. Full output is retained at `output/operations-policy-api-full-test.log`.

`verify:local` was not run after those broader known failures because this remediation did not change the protected matching behavior, schema, migration, dependency set, auth, payment, or settlement contracts. Focused API/Admin suites, typechecks, consistency, builds, and live runtime checks provide the scoped signal.

## 8. Screenshot Index

Evidence directory: `docs/audits/operations-policy-matching-supply-final-remediation-evidence-2026-08-13/`

| File | Verification |
| --- | --- |
| `01-policies-lifecycle-1440x1000.png` | Runtime policy lifecycle distribution |
| `02-contract-unavailable-fixture-or-state-1440x1000.png` | Non-live read-only notice and absent editor |
| `03-audit-operator-1440x1000.png` | Healthy Operator audit empty state |
| `04-audit-unavailable-write-disabled-1440x1000.png` | Fail-closed unavailable recovery state |
| `05-supply-default-1440x1000.png` | Concise default Supply view |
| `06-supply-diagnostics-actions-1440x1000.png` | Expanded evidence and action links |
| `07-sensitivity-stacked-1440x1000.png` | Stacked desktop sensitivity tables |
| `08-zero-open-matching-empty-1440x1000.png` | Honest zero-sample state without scenarios |
| `09-sensitivity-stacked-1600x1000.png` | 1600 desktop stack and overflow check |
| `10-policy-valid-helper-1440x1000.png` | Non-contradictory valid changed-value helper |
| `11-supply-dark-1440x1000.png` | Dark theme state and contrast check |

The in-app browser was configured for 1440x1000 and 1600x1000. Screenshots that include the browser viewport inset were saved at 1425x990 and 1585x991; exact 1440x1000 captures are retained for the audit and outage states. No 1024-or-smaller viewport was tested, per scope.

## 9. Primary Remediation Files

- `apps/admin_web/lib/admin-api.ts`
- `apps/admin_web/app/operations-policy/operations-policy-groups.ts`
- `apps/admin_web/app/operations-policy/operations-policy-page-model.ts`
- `apps/admin_web/app/operations-policy/page.tsx`
- `apps/admin_web/app/operations-policy/actions.ts`
- `apps/admin_web/app/operations-policy/operations-policy-form.tsx`
- `apps/admin_web/app/operations-policy/booking-acceptance-matrix.ts`
- `apps/admin_web/app/operations-policy/matching-stage-impact-preview.ts`
- `apps/admin_web/app/operations-policy/operations-policy-matching-stage-impact-section.tsx`
- `apps/admin_web/app/operations-policy/operations-policy-final-partner-choice-section.tsx`
- `apps/admin_web/app/operations-policy/operations-policy-sensitivity-preview-section.tsx`
- `apps/admin_web/app/globals.css`
- nearest existing Operations Policy specs for each behavior
- `infra/scripts/check-operations-policy-consistency.mjs`

Existing notification test fixtures received only the required lifecycle field needed by the now-required Admin API contract.

## 10. Protected Areas and Change Safety

- No schema or migration was added or changed by this remediation.
- No dependency was added.
- No auth, payment, wallet, booking, settlement, or production policy mutation was performed.
- `apps/api/src/matching/**` has pre-existing dirty worktree changes, but this remediation did not modify protected matching behavior; it verified the existing source and tests.
- The very dirty worktree was preserved. No reset, checkout, stash, bulk formatting, cleanup, commit, push, or deployment was performed.

## 11. Remaining Risk and Release Decision

The page-level release blockers are resolved in focused code, tests, builds, and runtime evidence. A final production release sign-off is **conditional** until the existing concurrency integration runs against a disposable real PostgreSQL database and proves one success, one conflict, one persisted value, and one audit event for both existing-row and create-race cases.

## 12. Next Single Priority

Provision the disposable PostgreSQL integration environment and run `admin-operational-policy-concurrency.integration.spec.ts` without skips. Do not widen the feature scope until that result is recorded.
