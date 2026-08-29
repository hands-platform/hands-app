# Setup Runtime Active Remediation Report

Date: 2026-08-15 (Asia/Ho_Chi_Minh)
Target: `http://localhost:3101/setup?mode=runtime&view=active`

## 1. Verdict and P1 status

- **Verdict: Release hold**
- **P1 remaining in the Setup remediation scope: 0**
- The focused Setup and Health tests, type checks, visible-copy guard, production build, process restart, and browser checks passed.
- Release remains on hold because the required Admin and API scope verification commands expose unrelated pre-existing failures outside this remediation. Those failures were not weakened, deleted, or bypassed.

## 2. Worktree preservation

- `git status --short` was captured before editing. The worktree already contained a large number of modified and untracked files.
- Existing user changes were preserved. No reset, checkout, cleanup, mass formatting, commit, push, or deployment was performed.
- Changes were limited to the Setup runtime workspace, the additive Health external-service contract, their focused tests, supporting Admin navigation/API types, and this evidence package.

## 3. Source markers before and after

Before remediation:

- No `evidence-gaps` saved view existed.
- The runtime contract did not expose `evidenceGaps`, `notMonitored`, `evidenceHref`, or `relatedWorkspaceHref` as explicit operator-facing fields.
- `Unknown or not monitored` combined two materially different states.
- Runtime actions could use a generic configuration action even when the service was configured but lacked evidence.

After remediation:

- `evidence-gaps` is a canonical, URL-addressable Setup view.
- The API returns additive `notMonitored`, `evidenceGaps`, `evidenceHref`, and `relatedWorkspaceHref` data while retaining the existing response shape.
- `UNKNOWN` and `NOT_MONITORED` are distinct states with service-specific operator guidance.
- `View evidence` is used only when an actual filtered evidence destination exists; broader destinations use `Open related workspace`.
- Invalid `mode` or `view` values redirect to `/setup?mode=runtime&view=active`.

Representative implementation markers:

- `apps/api/src/health/health.service.ts`: centralized `externalServicePolicy`, evidence-gap classification, service-specific runtime actions, additive evidence links.
- `apps/admin_web/app/setup/setup-page-model.ts`: canonical query handling and `evidence-gaps` model.
- `apps/admin_web/app/setup/setup-overview-section.tsx`: five-column operator table, evidence actions, native disclosure rows, and accessible table labels.
- `apps/admin_web/app/setup/page.tsx`: canonical redirect and result-state rendering.

## 4. Build and process timestamps

Production services were rebuilt and restarted with `npm.cmd run local:start:prod`.

| Service | Build artifact time | Process start time | PID | Result |
|---|---:|---:|---:|---|
| Admin Web | 2026-08-15 02:36:04.944 +07:00 | 2026-08-15 02:36:06.485 +07:00 | 26260 | Process started after build |
| API | 2026-08-15 02:35:17.120 +07:00 | 2026-08-15 02:35:17.801 +07:00 | 36312 | Process started after build |

Admin build ID: `fXMYLL9nCNag5SS-dnxy7`

`local:status` confirmed both processes listening, Admin HTTP 200, API health HTTP 200, and fresh API status.

## 5. External-service policy before and after

Before:

- Configuration, launch requirement, runtime monitoring, evidence availability, and operator action were partially inferred in separate paths.
- Cash-only payment integrations and deferred launch categories could be represented inconsistently.
- Missing runtime evidence could be interpreted as a setup/configuration failure.

After:

- One `externalServicePolicy` defines whether each service is required, enabled, deferred, monitored, and eligible for runtime action.
- Required and enabled services in `DOWN` or `DEGRADED` remain action-required.
- Required and enabled services in `UNKNOWN` or `NOT_MONITORED` become evidence gaps, not false healthy or false configuration failures.
- Deferred mobile release, mobile runtime, and referral categories remain non-blocking where the current launch policy says so.
- Disabled MoMo/VNPay integrations in the current cash-only mode remain deferred rather than producing false launch blockers.

## 6. Status semantics

| Status | Operator meaning | Launch/action treatment |
|---|---|---|
| `UP` | Current runtime evidence confirms normal operation | No action |
| `DEGRADED` | Runtime evidence exists and indicates partial failure | Action required when required and enabled |
| `DOWN` | Runtime evidence confirms unavailable service | Action required when required and enabled |
| `UNKNOWN` | The service is expected to be checked but current evidence is insufficient | Evidence gap; verify before relying on it |
| `NOT_MONITORED` | No active runtime monitor currently supplies evidence | Evidence gap; review service-specific evidence/workspace |
| `DISABLED` / deferred | Service is intentionally outside the active launch/runtime scope | No false blocker |

## 7. Action-link contract

- Core API: related workspace `/app-sessions`
- Authentication: related workspace `/app-sessions`
- Maps: related workspace `/vietnam-overview?view=live`
- Payments: related workspace `/payments`
- Storage: related workspace `/partners`
- Referrals: related workspace `/referrals/customers`
- Push/FCM: filtered evidence `/notifications?mode=action&issue=failed&channel=fcm`, related workspace `/notifications`
- SMS: related workspace `/app-sessions`
- A runbook link is not fabricated when no trusted runbook destination exists.

## 8. Runtime table and disclosure behavior

- The default runtime table uses five columns: Service, Runtime status, Evidence / last event, Current impact, Action.
- Secondary configuration and diagnostic fields are placed in a native `<details>` disclosure instead of widening the primary table.
- Empty saved views render an explicit `No services match this view.` state.
- Refresh uses a real server action and exposes pending (`Refreshing external service status.`) and completed (`External service status refreshed.`) live-status messages.
- The local browser fixture delay exists only when `NODE_ENV` is not production and `SETUP_BROWSER_FIXTURES_ENABLED=1`; production behavior is unaffected.

## 9. Layout measurements

Baseline audit:

- 1440px wrapper width: approximately 1050px
- Table width: approximately 1162px
- Horizontal overflow: approximately 97px
- First five rows: approximately 199px each, limiting operational scan density

Verified after remediation:

- 1440x1000 wrapper: 1050px client width / 1050px scroll width
- 1440x1000 table: 1050px, no horizontal overflow
- Row heights: 132, 132, 132, 132, 132, 112px
- A table-centered 1000px viewport displays five complete operational rows
- 1600x1000 wrapper and table: 1210px, no horizontal overflow
- Browser console: no errors or warnings observed
- No viewport at or below 1024px was inspected, per the requested desktop-only scope.

## 10. Changed files and roles

- `apps/api/src/health/health.service.ts`: canonical external-service runtime/evidence policy and additive operator contract.
- `apps/api/src/health/health.controller.ts`: guarded external-health response delivery.
- `apps/api/src/health/health.service.spec.ts`: policy, state, evidence, and compatibility regressions.
- `apps/api/src/health/health.controller.spec.ts`: Admin authorization and response contract regressions.
- `apps/admin_web/app/setup/page.tsx`: canonical query redirect and Setup workspace state rendering.
- `apps/admin_web/app/setup/setup-page-model.ts`: URL/view model, labels, and safe operator actions.
- `apps/admin_web/app/setup/setup-overview-section.tsx`: compact evidence-first runtime table and disclosure UI.
- `apps/admin_web/app/setup/setup-refresh-control.tsx`: refresh pending/completed accessible state.
- `apps/admin_web/app/setup/setup-browser-fixtures.ts`: isolated non-production browser states.
- `apps/admin_web/app/setup/actions.ts`: refresh action and development-only observable fixture delay.
- `apps/admin_web/app/setup/loading.tsx`: loading state.
- `apps/admin_web/app/setup/*.spec.ts(x)`: focused model, page, action, and component regressions.
- `apps/admin_web/lib/admin-api.ts`: additive external-health response typing.
- `apps/admin_web/lib/admin-navigation.ts`: canonical Setup workspace navigation.
- `apps/admin_web/app/globals.css`: Setup table, disclosure, responsive desktop, and focus styling.
- `docs/architecture/health-readiness.md`: state and evidence contract documentation.
- `docs/audits/setup-runtime-active-remediation-evidence-2026-08-14/`: browser evidence.

## 11. Verification commands

Passed:

- `npm.cmd run test --workspace @massage-vn/admin-web -- app/setup` — 15 files, 64 tests passed.
- `npm.cmd run test --workspace @massage-vn/api -- src/health/health.controller.spec.ts src/health/health.service.spec.ts` — 2 files, 27 tests passed.
- `npm.cmd run typecheck --workspace @massage-vn/admin-web` — passed.
- `npm.cmd run typecheck --workspace @massage-vn/api` — passed.
- `npm.cmd run admin:visible-copy` — 1651 files checked, 0 violations.
- Impeccable detector on changed Setup components — no findings (`[]`).
- `git diff --check` — no whitespace errors; existing line-ending warnings remain.
- `npm.cmd run local:start:prod` and `local:status` — production build/restart and HTTP checks passed.

Failed due to unrelated existing repository regressions:

- `npm.cmd run verify:scope -- -Scope admin`
  - `components/admin-surface-css.spec.tsx`: existing notice icon/spacing contract failure.
  - `lib/admin-navigation.spec.ts`: existing access-filtering contract failure.
  - `app/finance-closeout/page.spec.tsx`: existing age-summary contract failure.
- `npm.cmd run verify:scope -- -Scope api`
  - `src/admin/admin.service.spec.ts > AdminService query orchestration > keeps a consumed campaign queued when only post-enqueue receipt persistence fails`
  - Expected Prisma `update` with `include.recipients`; current implementation uses a `select` projection.
  - Scope result: 1 failed, 178 passed, 5 skipped files; 1 failed, 2470 passed, 12 skipped tests.

Skipped:

- `npm.cmd run verify:local` was not rerun after the focused verification because no Prisma, auth, payment, or other protected mutation path changed and the mandatory Admin/API scope gates had already failed. This does not override the release hold.

## 12. Protected areas

- No Prisma schema, migration, database record, environment value, provider credential, authentication guard, payment mutation, refund mutation, or external-provider configuration was changed.
- The existing `JwtAuthGuard`, `RolesGuard`, and `ADMIN` boundary on the external-health endpoint remains intact; focused controller tests pass.
- The Health response change is additive and keeps compatibility fields for existing consumers.

## 13. Mutation and side-effect statement

- No external provider was called or mutated during remediation.
- No database seed, write, credential rotation, or environment mutation was performed.
- Browser failure/degraded/pending states were exercised only through isolated development fixtures and display a fixture banner.
- Final production verification used the rebuilt local production processes without fixture flags.

## 14. Browser evidence

Evidence directory: `docs/audits/setup-runtime-active-remediation-evidence-2026-08-14`

1. `01-runtime-active-1440x1000.png` — production active view.
2. `02-runtime-evidence-gaps-1440x1000.png` — evidence-gap saved view.
3. `03-runtime-needs-action-empty-1440x1000.png` — true empty needs-action state.
4. `04-runtime-degraded-fixture-1440x1000.png` — isolated degraded-state fixture.
5. `05-runtime-row-details-1440x1000.png` — native disclosure expanded.
6. `06-runtime-refresh-pending.png` — disabled Refreshing control and pending live status.
7. `07-runtime-refresh-complete.png` — refresh completion live status.
8. `08-runtime-error-fixture.png` — isolated safe error state.
9. `09-runtime-active-dark-1600x1000.png` — production dark theme.
10. `10-runtime-active-light-1600x1000.png` — production light theme.

The final browser state was left at `http://localhost:3101/setup?mode=runtime&view=active`.

## 15. Accessibility verification

Verified:

- Unique table/section labels and heading structure are present.
- Native `<details>/<summary>` semantics are used for row diagnostics.
- The summary receives browser focus and has a visible solid focus outline.
- Pointer activation opens the disclosure.
- Refresh pending/completed messages use an accessible live-status pattern.
- Status meaning is conveyed by text as well as tone/color.
- Invalid query values canonicalize to a stable URL.

Not fully verified:

- Direct keyboard Enter/Space toggling of `<summary>` could not be confirmed through the in-app automation API: focus was confirmed, but synthetic Enter did not toggle the native element. Native semantics are retained, but this interaction remains a manual-browser follow-up.
- Screen-reader announcement was not tested with a real assistive-technology client.
- Viewports at or below 1024px were intentionally outside this task's browser scope.

## 16. Remaining risks

- The release is held by unrelated Admin/API scope failures listed above, even though the Setup-focused remediation is complete.
- Runtime evidence quality is only as strong as each service's actual monitor. `UNKNOWN` and `NOT_MONITORED` now surface this limitation rather than hiding it.
- Several services currently have only a related operational workspace and no trusted filtered evidence or runbook URL. The UI does not fabricate links.
- Manual keyboard verification of native disclosure activation and assistive-technology announcement remains outstanding.

