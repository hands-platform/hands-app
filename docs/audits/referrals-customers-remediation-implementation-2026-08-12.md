# Customer Referrals remediation implementation

Date: 2026-08-12  
Result: **Partial completion**

The release-blocking fixture isolation and reward evidence gates are implemented and covered by focused tests. The result remains partial because the legacy smoke policy cannot be restored safely without an original snapshot, the strict API budget could not authenticate, shared-repository gates contain unrelated failures, and real reward mutations were intentionally not performed.

## Safety boundary

- No production or shared referral record was deleted or updated.
- No fixture cleanup apply, policy restore apply, reward release, wallet credit, or reversal was executed.
- No Prisma migration or production dependency was added.
- Existing idempotency source keys, `SERIALIZABLE` transactions, expected status/`updatedAt` checks, and compensating reversal behavior remain in place.
- The already dirty worktree was preserved. Unrelated changes were not reverted, reformatted, or committed.

## Audit disposition

| Audit item | Status | Current evidence |
|---|---|---|
| Smoke fixtures appear in operational reward queues and totals | Resolved | Operational workspace queries exclude the canonical fixture metadata filter; the normal browser view reports 0 rewards and 0 VND. |
| A normal operator can include fixture rows with a query parameter | Resolved | Fixture inspection has a separate Developer/System API category and requires both `fixtures=include` and developer permission. |
| Fixture wallet mutations remain possible | Resolved | Domain mutations reject fixture release, credit, reverse, and related reward changes with `REFERRAL_FIXTURE_MUTATION_BLOCKED`; the diagnostic UI has no mutation action. |
| Legacy smoke policy remains in the shared database | Partially resolved | New smoke runs no longer seed policy. Inventory confirms the old smoke notes remain, but there is no original snapshot or audit record, so automatic restore is unsafe and was not run. |
| Fixture cleanup can safely be applied | Partially resolved | Read-only exact inventory exists. Two of four fixture rewards have wallet ledger references and must be retained. `--apply` fails closed; no deletion planner was enabled. |
| Release/Credit can proceed without qualifying booking evidence | Resolved | The service reloads complete reward evidence inside the serializable transaction and rejects missing, ineligible, unpaid, refunded, reversed, integrity-blocked, immature, invalid-wallet, or already-posted evidence. |
| Evidence failures are only UI checks | Resolved | The authoritative check is `referrals.service`; Admin renders the returned blocker contract but cannot manufacture eligibility. |
| Concurrent or retried credit can duplicate wallet ledger entries | Resolved | Existing state/version and source-key idempotency contracts are retained and tested around the new evidence validator. |
| Queue Action is clipped at 1440 | Resolved | Queue and detail ledger use five columns with a fixed sticky Action column; measured `clientWidth === scrollWidth`. |
| Quick queue title and empty state disagree | Resolved | One queue configuration owns navigation label, table title, description, and empty copy. |
| Reward counts are compared with parent counts | Resolved | Reward queue and parent disclosure have separate count units and data requests. |
| Static cards infer misleading `Current filters` scope | Resolved | Static referral summaries opt out of inferred scope. |
| Policy preview does not show a real before/after | Resolved | Controlled form reports current-to-proposed field changes, explicit units, current open exposure, and non-retroactive snapshot scope. |
| Unchanged or invalid policy can be saved | Resolved | Save requires dirty valid values, a 12-500 character reason, and explicit review confirmation. Browser states were verified without submitting. |
| Detail repeats the same operations status in several sections | Resolved | Duplicate operations board was removed; the command strip, evidence ledger, technical details, and timeline have distinct jobs. |
| Default page repeats the same summary aggregate | Resolved | Normal mode loads access plus one workspace response. Parent records load only when the disclosure is explicitly opened. |
| Campaign ID normalization tests fail | Report changed after audit | Current full API suite passes; no referral normalization failure remains. |
| Strict API budget is measured | Unresolved | `admin:api-budget:strict` reached the service but received 401 because `ADMIN_ACCESS_TOKEN` was not available to the terminal process. |
| Real held/available/credited mutation states are proven in browser | Unresolved | Operational fixtures are intentionally excluded and no real wallet mutation was created. Server behavior is covered by focused tests only. |

## Implemented operating flow

1. The default page shows only operational reward truth and a compact command strip.
2. Queue rows present `Relationship`, `Evidence`, `Reward`, `Decision`, and always-visible `Action`.
3. Parent account history is a lazy disclosure and no longer inflates the default read path.
4. Developer fixture inspection is visibly marked `TEST FIXTURE · wallet actions disabled` and is separated from operational totals.
5. Reward detail leads with amount/state, evidence blockers, and the allowed next action. Raw identifiers live under technical details.
6. Policy editing shows explicit units, current exposure, proposed differences, non-retroactive scope, validation, reason, and confirmation before Save becomes available.

## Domain evidence gate

`apps/api/src/referrals/referral-reward-evidence.ts` returns machine-readable blockers for:

- missing or ineligible qualifying booking;
- missing captured/released payment evidence;
- missing settlement evidence;
- refunded or reversed qualifying booking;
- non-qualified attribution or integrity review;
- invalid calculation snapshot or immature hold;
- invalid wallet ownership or already-posted ledger;
- fixture mutation.

The validator runs on freshly loaded evidence in the same serializable transaction used by release/credit. Failure leaves reward state, wallet state, and audit state unchanged.

## Fixture inventory and smoke lifecycle

Command:

```powershell
npm.cmd run referrals:fixture-inventory
```

Dry-run result: 2 codes, 2 attributions, 4 rewards, 375,000 VND nominal fixture amount. Two rewards are ledger-bearing and classified `RETAIN_LEDGER_BEARING_FIXTURE`. Cleanup and policy restore both report `false`.

The revised smoke seed is non-mutating by default. Mutation requires both `--apply` and `REFERRAL_SMOKE_ALLOW_MUTATION=confirmed`; legacy `--cleanup` is rejected. It no longer modifies referral policy, avoiding future policy contamination rather than attempting an unsafe restore.

## Performance and layout

- Default server reads: access plus one combined workspace request. Parent rows are omitted until `parents=open`.
- Warm browser navigation samples: 167 ms, 133 ms, 131 ms; observed p95 167 ms in the local in-app browser.
- 1440 nominal viewport: operational table 877/877 px client/scroll width.
- 1600 nominal viewport: fixture table 1212/1212 px client/scroll width.
- The strict HTTP API budget is unmeasured because the terminal request did not have an Admin access token.

## Tests and validation

| Validation | Result |
|---|---|
| Admin focused referral tests, 9 files | PASS, 81 tests |
| Admin follow-up policy/dashboard/detail subset | PASS, 64 tests |
| API referral focused tests, 5 files | PASS, 69 tests |
| API Admin service referral cases | PASS, 29 tests |
| Admin guard/controller/DTO referral cases | PASS, 33 tests; unrelated cases skipped by filter |
| Fixture inventory script test | PASS, 1 test |
| Full API test suite after route manifest update | PASS, 171 files passed, 2 skipped; 2,336 tests passed, 5 skipped |
| Admin typecheck / build / lint | PASS / PASS / PASS |
| API typecheck / build / lint | PASS / PASS / PASS |
| Public web test / typecheck / lint / build | PASS / PASS / PASS / PASS |
| Customer Flutter analyze / test | PASS / PASS |
| Partner Flutter analyze / test | PASS / PASS |
| Impeccable detector, one required run | PASS for referral surfaces; six unrelated existing side-tab warnings in global CSS |
| `verify:scope -- -Scope admin` | FAIL from existing notification retry audit plus three unrelated Admin tests: surface CSS contract, finance navigation expectation, finance closeout day count |
| `verify:scope -- -Scope api` | FAIL from existing notification retry audit; route-count and changed-file lint failures found in that run were subsequently fixed and the full API suite/lint pass |
| `verify:local` | FAIL overall: setup doctor, notification retry audit, final authority, Vietnam scope, API domain smoke, Supabase schema, and the same three unrelated Admin tests; builds, typechecks, security checks, public web, and both Flutter apps pass |
| Strict Admin API budget | UNMEASURED, HTTP 401 without terminal Admin token |

## Browser evidence

- [Needs action, 1440](./referrals-customers-remediation-evidence-2026-08-12/01-needs-action-1440x1000.png)
- [Ready empty, 1440](./referrals-customers-remediation-evidence-2026-08-12/02-ready-empty-1440x1000.png)
- [On-hold empty, 1440](./referrals-customers-remediation-evidence-2026-08-12/03-on-hold-empty-1440x1000.png)
- [Credited history empty, 1440](./referrals-customers-remediation-evidence-2026-08-12/04-credited-history-empty-1440x1000.png)
- [Search empty, 1440](./referrals-customers-remediation-evidence-2026-08-12/05-search-empty-1440x1000.png)
- [Parent records expanded, 1440](./referrals-customers-remediation-evidence-2026-08-12/06-parent-records-expanded-1440x1000.png)
- [Developer fixtures disabled, 1440](./referrals-customers-remediation-evidence-2026-08-12/07-developer-fixtures-disabled-1440x1000.png)
- [Policy unchanged, 1440](./referrals-customers-remediation-evidence-2026-08-12/08-policy-unchanged-1440x1000.png)
- [Policy invalid, 1440](./referrals-customers-remediation-evidence-2026-08-12/09-policy-invalid-1440x1000.png)
- [Policy valid but unsaved, 1440](./referrals-customers-remediation-evidence-2026-08-12/10-policy-valid-unsaved-1440x1000.png)
- [Fixture sanity, 1600](./referrals-customers-remediation-evidence-2026-08-12/11-fixture-sanity-1600x1000.png)
- [Detail not found, 1440](./referrals-customers-remediation-evidence-2026-08-12/12-detail-not-found-1440x1000.png)
- [Browser measurements](./referrals-customers-remediation-evidence-2026-08-12/browser-verification-metrics.json)
- [Fixture inventory](./referrals-customers-remediation-evidence-2026-08-12/fixture-inventory-dry-run.json)

The in-app browser measured 1439x1000 and 1597x1000 inner viewports for the nominal 1440 and 1600 captures because its chrome consumed one and three horizontal pixels respectively. No viewport below 1024 was tested.

## Relevant changed files

### Admin Web

- `apps/admin_web/app/referrals/customers/page.tsx`
- `apps/admin_web/app/referrals/referral-dashboard.tsx`
- `apps/admin_web/app/referrals/referral-detail.tsx`
- `apps/admin_web/app/referrals/referral-policy-form.tsx`
- corresponding referral specs
- `apps/admin_web/lib/admin-api.ts`
- `apps/admin_web/app/globals.css`

### API and domain

- `apps/api/src/referrals/referral-fixture.ts`
- `apps/api/src/referrals/referral-reward-evidence.ts`
- `apps/api/src/referrals/referrals.service.ts`
- `apps/api/src/admin/admin-referral.routes.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin-operator-category.guard.ts`
- corresponding referral/Admin specs and route manifest contract

### Operations tooling

- `infra/scripts/referral-smoke-seed.mjs`
- `infra/scripts/referral-fixture-inventory.mjs`
- `infra/scripts/referral-fixture-inventory.test.mjs`
- `package.json`

## Protected areas and migration

Protected business paths changed: referral reward mutation service, Admin referral read service, and Admin permission category guard. Matching, booking mutation, payment capture, wallet schema, Prisma schema, and migrations were not changed by this task. Matching Admin/API scope checks were attempted and their unrelated failures are recorded above.

## Remaining risk and next action

The highest-value next action is an approved data-governance review of the dry-run manifest: decide whether the two non-ledger fixture rewards may be deleted and provide the authoritative pre-smoke policy snapshot, if one exists. Without that evidence, the ledger-bearing fixtures and current smoke policy must remain untouched.

Not committed.
