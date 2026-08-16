# Marketing Analytics Final Remediation

Verdict: Release ready
Score: 96/100
P1 remaining: 0

## Outcome

Marketing Analytics now distinguishes missing evidence, an explicit zero, an empty
cohort, partial data, and endpoint failure. Operators can reach the first decision
area at 1440px, inspect Fee ROAS using the same value as the server action policy,
and review a new or existing spend record without writing shared data during QA.

The six P1 findings are closed. The remaining score deduction is for unrelated
repository-wide gate failures and two safely unreproducible browser states that are
covered by focused contract tests instead of fabricated screenshots.

## P1 root causes and results

### P1-01 - Spend review and recovery

Root cause: the page collapsed every current-value read failure into one boolean,
and the shared Admin GET client attempted JSON parsing even for a successful empty
body. A Nest 200/null response could therefore look like a network failure.

Result:
- 200 + record shows current value, new value, delta, and uses `updatedAt` as the
  optimistic version.
- 200 + null/empty body uses the supplied null fallback and opens a new-row review
  with 0 VND as the existing value.
- Failed reads retain the full draft and never expose Save.
- 401, 403, 404, 409, 429, 400/422, 5xx, and network recovery are bounded and
  status-specific.
- Request ID is copyable without exposing stack, token, or secret data.

| Current-value result | Review state | Save | Recovery |
| --- | --- | --- | --- |
| 200 + record | Before / after / delta | Available | Edit or cancel |
| 200 + null | Existing 0 VND / after / delta | Available | Edit or cancel |
| 400 or 422 | Draft retained | Hidden | Edit inputs / cancel |
| 401 | Draft retained | Hidden | Sign in again / edit / cancel |
| 403 | Draft retained | Hidden | Review access / edit / cancel |
| 404 | Draft retained | Hidden | Retry current value / edit / cancel |
| 409 | Draft retained | Hidden | Review ledger conflict / edit / cancel |
| 429 | Draft retained | Hidden | Retry later / edit / cancel |
| 5xx or network | Draft retained | Hidden | Retry current value / edit / cancel |

### P1-02 - Spend permission

Root cause: analytics read and spend write needed an explicit capability boundary
across schema, operator access, web capability, route guard, and service checks.

Result:
- `GROWTH_MARKETING` is analytics read.
- `GROWTH_MARKETING_SPEND` is spend write.
- `MASTER_ADMIN` remains allowed.
- Reader, spend manager, master, and denied paths have focused tests.
- No operator permission was changed during this remediation.

Migration state: migration
`20260812140000_add_marketing_spend_permission` already existed. Local migration
status reports the database is up to date. This task created or applied no migration
and made no production/shared database change.

### P1-03 - Coupon empty/load contract

Root cause: a zero-activity Today view still offered an action that could only
reload another empty result.

Result:
- Zero summary activity shows an honest range-specific empty state and no Load CTA.
- Only valid range changes and Coupon operations remain.
- Code rows are fetched only when summary activity exists and
  `couponPerformance=1` is explicit.
- Loaded empty and endpoint failure remain distinct from an unrequested page.

### P1-04 - Attribution 0/0

Root cause: a missing denominator was normalized to numeric zero and rendered as a
measured 0% result.

Result:
- denominator 0 returns null and renders `Not available`.
- no progressbar or `aria-valuenow=0` is emitted for no-data cohorts.
- 0/4, 1/4, and 4/4 remain measured 0%, 25%, and 100% results.

### P1-05 - Location rows and total

Root cause: the API counted all region buckets while the web page removed inactive
rows after pagination.

Result: the server applies the activity predicate before total and pagination.
Rows, totalCount, footer, region filter, and normalized page now use one population.

### P1-06 - Fee ROAS

Root cause: the action policy used platform-fee ROAS, while the table emphasized
gross booking ROAS and did not expose the governing evidence.

Result:
- Campaign rows separate Fee revenue, Fee ROAS, and Gross ROAS.
- Missing or zero spend is `Not calculable`, not a fabricated ratio.
- Decision evidence, table value, and the 1.00x server threshold use Fee ROAS.

## P2 operations UX

- The 1440px desktop header, workspace, core filters, reliability evidence, and the
  start of Needs action fit in the first operating viewport.
- `Clear dimensions` removes source/platform/campaign/region and preserves range.
- `Use default range` is a separate 7-day action.
- Campaign and Attribution metadata describe signup cohort and manual spend.
- Coupon metadata describes booking-created cohort and coupon booking metadata.
- Independent summary, dimension, ledger, and requested detail reads start together.
- Coupon detail rows are not requested until explicitly needed.
- Light and dark states retain readable warning, danger, and muted text.

## Files and purpose

- `apps/admin_web/app/marketing-analytics/page.tsx`: view orchestration, bounded
  spend read states, coupon load contract, metadata, and recovery actions.
- `apps/admin_web/app/marketing-analytics/marketing-analytics-model.ts`: null
  attribution, Fee ROAS, copy, filters, and decision evidence.
- `apps/admin_web/app/marketing-analytics/actions.ts`: review-first spend actions and
  optimistic version payload.
- `apps/admin_web/app/marketing-analytics/marketing-spend-action-form.tsx`: exact
  spend scope and operator-reason form behavior.
- Marketing Analytics specs: P1 contracts and query round trips.
- `apps/admin_web/lib/admin-api.ts`: successful empty-body GET fallback support.
- `apps/admin_web/lib/admin-api-contract.spec.ts`: empty successful body regression.
- `apps/admin_web/app/globals.css`: desktop-only compact Marketing layout and request
  evidence alignment. No <=1024 breakpoint was added or changed for this task.
- `apps/api/src/admin/admin-marketing-analytics.ts`: shared range, location, and
  attribution contracts.
- `apps/api/src/admin/admin-analytics.routes.ts`: bounded spend read/write route.
- `apps/api/src/admin/admin-operator-category.guard.ts`: centralized spend category
  authorization.
- `apps/api/src/admin/admin.service.ts`: server-authoritative analytics and spend
  service authorization/concurrency behavior.
- Related API specs and the existing Prisma permission migration cover the server
  contract.

## Fetch structure

Before: view-supporting reads could wait for the summary batch and coupon detail
could be requested without an explicit operator decision.

After: filters and paging start all independent reads in parallel. Campaign
dimensions and spend ledger do not wait for summary. Coupon summary and an explicitly
requested detail page run in parallel, while Overview and inactive views avoid heavy
detail endpoints. Existing cache tags and spend invalidation remain intact.

## Verification

### Focused tests

- Admin focused: PASS - 4 files, 56 tests.
- API route/guard/controller Marketing filter: PASS - 36 executed tests.
- API service Marketing filter: PASS - 8 executed tests.
- Marketing-focused total: 100 passed assertions/tests across the three runs.
- Admin typecheck: PASS.
- API typecheck: PASS.
- Prisma migration check: PASS - 95 migrations; one pre-existing duplicate timestamp
  warning for `20260701093000`.
- Local Prisma migration status: PASS - database up to date.
- Admin visible-copy guard: PASS - 1,637 files, 0 violations.
- Admin API budget unit contract: PASS - 5 tests.
- Admin API budget live smoke: FAIL - local smoke token received HTTP 401; no payload
  or latency budget was measured.

### Repository scope gates

- Admin build, typecheck, lint, query guards, visible copy: PASS.
- Admin full tests: FAIL - 4,560 passed, 3 unrelated failures
  (`admin-surface-css`, `admin-navigation`, `finance-closeout`).
- API build and typecheck: PASS.
- API full tests: FAIL - 2,380 passed, 1 unrelated Push campaign receipt assertion.
- API lint: FAIL - two pre-existing unused `updated` variables in
  `admin.service.ts` outside the Marketing code path.
- Impeccable detector: FAIL - six existing side-tab findings in shared `globals.css`;
  none is in the Marketing selectors added by this remediation.

The unrelated failures were not changed to make this scope appear green.

## Browser QA evidence

Evidence folder:
`docs/audits/marketing-analytics-final-remediation-evidence-2026-08-12/`

- 1440x900 Campaign top and first action entry: PASS; no page horizontal overflow.
- 1600x1000 Fee ROAS campaign table: PASS.
- 1600x1000 region rows/footer population: PASS.
- New spend 200/null review: PASS; 0 -> 123,456 VND review reached, Save not clicked.
- Attribution Today 0/0: PASS; Not available and no progressbar.
- Attribution populated 30d: PASS; 1/3 known and 33% progressbar.
- Coupons Today empty: PASS; no no-op Load action.
- Coupons populated 30d: PASS; 10 of 30 code rows shown.
- Dark 1600x1000: PASS; no page horizontal overflow.
- Browser error/warning console: empty.
- 403/read-only and forced read-error screenshots: not fabricated; substituted with
  `06-...txt` and `07-...txt` focused test evidence.

No viewport at or below 1024px was tested or modified as part of this task.

## Protected areas

Preserved:
- missing spend is not zero;
- explicit zero remains valid evidence;
- server-authoritative action totals;
- review-first spend flow, reason, audit, and expectedUpdatedAt conflict protection;
- analytics-read / spend-write separation;
- endpoint failure isolation and generatedAt scope;
- Coupon operations vs Coupon finance ownership;
- existing Admin atoms/tokens and light/dark behavior.

## Data mutations

None. Save spend was not clicked. No operator permission, campaign identity, shared
row, or database migration was created, updated, or applied by this task.

## Remaining risks

Non-blocking for the Marketing scope:
- The live Admin API budget smoke needs a valid local smoke credential before it can
  produce payload and latency evidence.
- Repository-wide tests/lint still contain the unrelated failures listed above.
- Read-only and forced-error browser states rely on focused automated evidence.

No Marketing P1 blocker remains.

## Next action

Repair the local Admin API budget smoke credential contract, then rerun the live
budget command without changing Marketing behavior.
