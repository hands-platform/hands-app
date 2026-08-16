# External Services remediation report

Date completed: 2026-08-12 ICT  
Target route: `/setup`  
Launch profile: `CASH_ONLY`

## Verdict

- Setup P0 status contract: **complete**
- Setup workspace: **release ready in isolation**
- Repository-wide merge gate: **release hold** because unrelated existing Admin and notification contract checks still fail
- P0 remaining: **0**

## Root cause and corrected contract

The previous screen treated configuration presence as operational health, mixed launch requirements with deferred capabilities, and supplied text-only actions inside a nested scrolling table. A response timestamp could also be read as service evidence even when no runtime probe had occurred.

The corrected contract keeps three independent facts:

| Axis | Values | Meaning |
| --- | --- | --- |
| Configuration | Ready / incomplete | Required local configuration is present or missing. It is not runtime proof. |
| Runtime | Healthy / degraded / down / not monitored | Healthy requires a recent successful safe probe. No probe is shown as Not monitored. |
| Launch profile | Required / optional / deferred | Only required and incomplete capabilities are launch blockers. |

`generatedAt` describes response generation. `lastCheckedAt`, `lastSuccessAt`, and `lastFailureAt` describe per-service runtime evidence and remain absent when no safe probe has run.

## Final service matrix

| Service | CASH_ONLY launch state | Runtime evidence |
| --- | --- | --- |
| Supabase core | Active | Bounded database connectivity probe; Healthy only on success |
| Supabase Phone Auth | Active | Configuration checked; runtime Not monitored |
| FCM push | Active | Configuration checked; runtime Not monitored |
| File storage and CDN | Active | Configuration checked; runtime Not monitored |
| Maps and geocoding | Active | Configuration checked; runtime Not monitored |
| Production SMS | Active | Configuration checked; runtime Not monitored |
| MoMo | Deferred | No launch blocker and no payment mutation |
| VNPay | Deferred | No launch blocker and no payment mutation |
| Referrals | Deferred | No launch blocker |

The compatibility fields in `/health/external` remain additive. Legacy consumers still receive the existing readiness fields while the Admin workspace consumes `launchProfile`, counts, and typed service status records.

## Probe safety

- Supabase core uses a bounded `SELECT 1` connectivity check with a two-second timeout.
- The readiness endpoint and External Services endpoint reuse one database probe helper.
- SMS, OTP, push, storage upload, map billing, payment capture, refund, webhook, and referral mutations were not invoked.
- No secret value or raw provider response is returned to the UI, logs, tests, or screenshots.
- Services without a safe probe remain explicitly Not monitored.

## Operator workspace

- Renamed the page to **External Services**.
- Added URL-addressable **Runtime health** and **Launch readiness** modes.
- Added **Needs action**, **Active services**, and **Deferred** saved views.
- Shows the Cash-only launch profile, generated time, manual refresh, evidence, impact, owner, and existing-route action for each row.
- Separates 401, 403, 429, and generic load failures with honest recovery actions.
- Removes nested vertical scrolling. Tables may scroll horizontally inside their named region; the document remains the only vertical scroller.
- Uses semantic links, visible status text, `aria-current`, route-local loading feedback, and existing Admin components.

## Changed files

- `apps/api/src/health/health.service.ts`: two-axis service status, CASH_ONLY policy, safe probe cache/evidence, typed overview.
- `apps/api/src/health/health.controller.ts`: async typed External Services response.
- `apps/api/src/health/health.service.spec.ts`: launch, runtime, timeout, deferred, and secret-safe contract tests.
- `apps/api/src/health/health.controller.spec.ts`: controller response contract.
- `apps/admin_web/lib/admin-api.ts`: additive External Services API types.
- `apps/admin_web/app/setup/page.tsx`: typed result handling and URL mode/view parsing.
- `apps/admin_web/app/setup/loading.tsx`: honest route-local loading state.
- `apps/admin_web/app/setup/setup-page-model.ts`: compatibility mapping, filters, counts, and ordering.
- `apps/admin_web/app/setup/setup-overview-section.tsx`: operator workspace and typed error states.
- `apps/admin_web/app/setup/*.spec.ts*`: focused UI and model regressions.
- `apps/admin_web/app/globals.css`: Setup-scoped desktop layout and single-scroll rules. Existing unrelated user edits in this file were preserved.
- `docs/architecture/health-readiness.md`: authoritative two-axis contract documentation.

## Verification

| Command | Result |
| --- | --- |
| `npm.cmd run test --workspace @massage-vn/admin-web -- app/setup` | PASS: 14 files, 59 tests |
| API health focused tests | PASS: 2 files, 25 tests |
| Admin typecheck | PASS |
| API typecheck | PASS |
| Admin visible-copy guard | PASS: 1,629 files |
| Impeccable detector | PASS: no findings |
| Relevant `git diff --check` | PASS; line-ending warnings only |
| `security:secrets` | PASS: 7,505 files |
| API scope | PARTIAL: 2,320 tests, typecheck, lint, and build pass; existing `notifications:retry-audit-contract` fails on Admin metadata keys |
| Admin scope | PARTIAL: 4,540 tests pass and typecheck/lint/build/guards pass; three unrelated tests fail |

The unrelated Admin failures are:

1. `components/admin-surface-css.spec.tsx`: an earlier focus selector is found before the expected layout selector.
2. `lib/admin-navigation.spec.ts`: the test expects Company Bank Accounts to be hidden while current governance navigation exposes it.
3. `app/finance-closeout/page.spec.tsx`: a date-dependent fixture expects 70 days while current ICT time renders 72 days.

The notification retry contract reports missing Admin metadata keys including `latestDelivery`, `retryJob`, delivery/provider fields, and `jobName`. No Setup or health file participates in those failures.

## Browser evidence

Evidence folder: `docs/audits/setup-remediation-evidence-2026-08-11/`

- `01-runtime-health-overview-1440x1000.png`
- `02-launch-readiness-cash-only-1440x1000.png`
- `03-needs-action-filter.png`
- `04-deferred-services.png`
- `05-runtime-not-monitored-evidence.png`
- `06-api-unavailable-retry.png`
- `08-keyboard-single-scroll.png`
- `09-dark-mode-runtime-health.png`
- `10-all-services-1600x1000.png`

At 1440x1000 the page has no horizontal document overflow, no nested vertical scroller, six active service rows, and one scoped horizontal table scroller. At 1600x1000 the all-services Launch readiness view also has no document overflow. Runtime and Launch tabs, saved views, light/dark rendering, keyboard-addressable links, and the actual API-unavailable recovery state were checked in the signed-in in-app browser.

The final browser diagnostic log contained only React development tooling and Fast Refresh information; no warning or error entries were present for `/setup`.

`07-partial-probe-failure.png` was not fabricated. The only live side-effect-free probe was healthy, and changing configuration or an external service to manufacture a partial failure was outside the safety boundary. Down and timeout behavior is covered by focused unit tests.

## Protected areas and external mutations

- No environment file, secret, payment gateway flag, role guard, database schema, migration, deployment, commit, or push was changed by this remediation.
- The existing dirty worktree and unrelated protected-area changes were preserved.
- The local API process was stopped only to capture the honest unavailable state and then restored with `start-hands-local.ps1`; `local:status` confirms API and Admin healthy.
- External mutations: **none**.

## P0 / P1 / P2 status

- P0 status truthfulness and Cash-only false positives: **complete**.
- P1 operator workspace, typed recovery, and real internal actions: **complete**.
- P2 desktop layout, single vertical scroll, keyboard semantics, dark theme, and regression coverage: **complete**.
- Non-blocking limitation: only Supabase core currently has safe runtime evidence; other active services truthfully remain Not monitored.

## Next action

Repair the existing notification retry Admin metadata contract first, then rerun both scope gates. It is the highest-risk remaining repository-wide merge blocker because it protects retry evidence and duplicate-delivery decisions.
