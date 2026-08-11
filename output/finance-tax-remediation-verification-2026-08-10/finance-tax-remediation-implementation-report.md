# Finance & Tax remediation implementation report

Date: 2026-08-10

## Result

- `/finance-tax` now presents one accounting month as a close-control workspace instead of mixing unrelated Finance dashboards.
- Server preflight remains the sole hard-blocker source. Advisory tax workflow and reconciliation signals are labelled as review flags.
- Future periods, past periods with no activity, active controls, and controls with no open signal are rendered as separate states.
- Unsupported Owner and Oldest columns are omitted. Exposure is shown only when calculated.
- The accounting-month selector is compact enough for the first complete active-control row to end at 898.9 px in a 1440 x 900 viewport.
- Cash debt drill-down preserves `period` and a validated `/finance-tax` `returnTo`.
- Monthly Cash debt uses the same canonical remaining-debt predicate in the Finance summary, Cash summary, and Cash list.

## Browser verification

Viewport: 1440 x 900

- Current month: first active row bottom 898.9 px; no page-level horizontal overflow.
- Current table headers: Signal, Control, Affected records, Exposure, Action.
- Future month: no transition CTA, active controls, or no-signal section.
- No-activity month: no transition CTA, active controls, verified-clear claim, or no-signal section.
- Tax workflow link preserved `review=tax-open`, `period=2026-08`, and the Finance return context.
- Cash debt link preserved `period=2026-08` and `returnTo=/finance-tax?period=2026-08`.
- Cash exposure matched across source and destination: 1,200,000 VND.
- Cash Back action returned to `/finance-tax?period=2026-08`.
- Dark theme rendered without horizontal overflow.
- Browser console warnings/errors: none.

Screenshots:

1. `01-current-month-1440x900.png`
2. `02-future-period-1440x900.png`
3. `03-no-activity-period-1440x900.png`
4. `04-tax-workflow-queue-1440x900.png`
5. `05-cash-debt-period-queue-1440x900.png`
6. `06-no-signal-expanded-1440x900.png`
7. `07-current-month-dark-1440x900.png`

## Verification commands

- Admin focused tests: 6 files, 76 tests passed.
- API cash settlement tests: 8 passed.
- API cash settlement controller tests: 4 passed.
- API monthly tax closing tests: 6 passed.
- Admin typecheck: passed.
- API typecheck: passed.
- Admin scope verification: passed, including 832 test files and 4,466 tests, lint, guards, and production build.
- API scope verification: passed, including 162 test files and 2,172 tests, Prisma validation, policy contracts, lint, and build.
- Scoped `git diff --check`: passed; only existing LF-to-CRLF warnings were reported.
- Impeccable detector: no errors. Six existing global side-accent warnings were reported outside the changed Finance/Cash selectors.

## Scope and preservation

- No Prisma schema or migration changes.
- No auth, payment mutation, wallet mutation, matching, or settlement-allocation identity changes.
- No new dependency, route, or mobile layout work.
- Existing dirty worktree changes were preserved.
- Not committed, pushed, or deployed.
