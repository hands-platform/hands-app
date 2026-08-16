# External Services post-remediation implementation report

- Implementation date: 2026-08-14
- Verification completed: 2026-08-15 (Asia/Ho_Chi_Minh)
- Route: `/setup`
- Launch profile: `CASH_ONLY`
- Verdict: **Release ready for the current cash-only launch scope**
- P1 remaining: **0**
- Estimated operator-readiness score: **78/100 before -> 93/100 after**

This verdict is deliberately limited to the current cash-only launch policy and the safety of the External Services operator workspace. It does not claim that deferred online payments or referral distribution are production ready, and it does not convert configuration evidence into runtime health.

## 1. Outcome

The former Setup Readiness screen is now an External Services workspace that answers four separate questions without mixing their meanings:

1. Which services are required for the current launch profile?
2. Which required services are configured?
3. Which services have actual runtime evidence, and which are not monitored?
4. Which integrations are intentionally deferred?

Runtime and launch-readiness modes remain on the same route. URL-backed saved views now cover active services, needs action, evidence gaps, launch-required services, and deferred services. Manual refresh preserves the current URL, reports pending/success/failure through one accessible live region, and restores focus to the refresh control.

## 2. P1 and P2 disposition

| Priority | Finding | Resolution | Status |
| --- | --- | --- | --- |
| P1 | Cash-only launch policy could hide an explicitly enabled payment gateway | A disabled MoMo/VNPay gateway remains deferred; an explicitly enabled gateway becomes current, required, and blocking until configured | Closed |
| P1 | Configuration-only services could appear healthy | Added `NOT_MONITORED`, evidence level, evidence gap, verification method, and last-verified metadata | Closed |
| P1 | Unknown, not monitored, deferred, and unhealthy counts were conflated | Added independent summary counts and filters; no-data/error fixtures never render a healthy zero state | Closed |
| P1 | Links implied evidence even when they only opened a related workspace | Only real evidence is labelled `Open evidence`; broad destinations use `Open related workspace`; runbooks appear only when a real runbook exists | Closed |
| P1 | Runtime refresh had no safe operator feedback or focus recovery | Added a side-effect-free GET refresh action with pending state, URL preservation, accessible status, and focus restoration | Closed |
| P1 | Runtime table overflowed the desktop content area | Reduced the table to five operator columns and aligned shell/table width at 1440 and 1600 | Closed |
| P2 | Service history is process-memory only | Kept the current bounded in-memory history and documented that it is not durable audit evidence | Open, non-blocking |
| P2 | Five configured services have no safe runtime probe | Surface them as evidence gaps instead of healthy. Adding provider-specific safe probes is a later integration task | Open, visible |

## 3. Launch policy before and after

### Before

- Current, deferred, unknown, and unmonitored states could be read as one readiness result.
- Cash-only policy did not explicitly protect the boundary where a payment gateway flag is turned on.
- A configuration check timestamp could be mistaken for a successful runtime event.
- Generic links were presented with evidence-like wording.

### After

- `CASH_ONLY` is the single current launch profile.
- Disabled MoMo and VNPay are deferred and do not block the current launch.
- If either gateway is explicitly enabled, it immediately moves into the current required scope and blocks readiness until its configuration is valid.
- Referral app links remain deferred for this launch profile.
- Current scope is 6/6 configured, 1 runtime verified, 5 evidence gaps, and 3 deferred.
- `configurationStatus`, `runtimeStatus`, `evidenceLevel`, `lastVerifiedAt`, `verificationMethod`, and `evidenceGap` remain distinct fields.

## 4. Service evidence and operator action matrix

| Service | Current scope | Runtime evidence | Link meaning | Current impact and action |
| --- | --- | --- | --- | --- |
| Supabase core | Required, configured | Connectivity verification; healthy | Related workspace | No confirmed impact; no configuration action |
| Supabase Phone Auth | Required, configured | Configuration only; not monitored; evidence gap | Related workspace | Do not infer OTP delivery health; use the related auth workspace |
| Maps and geocoding | Required, configured | Configuration only; not monitored; evidence gap | Related workspace | Do not infer map/geocoder availability; use the related workspace |
| File storage and CDN | Required, configured | Configuration only; not monitored; evidence gap | Related workspace | Do not infer upload/download health; use the related workspace |
| Production SMS | Required, configured | Configuration only; not monitored; evidence gap | Related workspace | Do not infer delivery health; use the related messaging workspace |
| FCM push service | Required, configured | Configuration only; not monitored; evidence gap | Actual evidence destination | Open the existing delivery evidence before making a push-health decision |
| MoMo payments | Deferred and intentionally disabled | Configuration only | Related workspace | No action for the current cash-only launch |
| VNPay payments | Deferred and intentionally disabled | Configuration only | Related workspace | No action for the current cash-only launch |
| Referral app links | Deferred and intentionally disabled | Configuration only | Related workspace | No action for the current cash-only launch |

## 5. Unknown, not monitored, and evidence-gap contract

| State | Operator meaning | Included as healthy? | Default action |
| --- | --- | --- | --- |
| `HEALTHY` | A safe runtime probe succeeded | Yes | No runtime action |
| `DEGRADED` | A runtime probe returned degraded evidence | No | Follow the runtime action and evidence link |
| `UNKNOWN` | A probe was expected but no trustworthy result is available | No | Retry and inspect evidence before deciding |
| `NOT_MONITORED` | No safe side-effect-free runtime probe exists | No | Treat as an evidence gap, not as an outage or a success |
| `DEFERRED` | Not required by the current launch profile | Not applicable | No current-launch action |

The summary and rows use the same predicates for unknown, not monitored, evidence gaps, deferred services, current required services, configured services, and runtime-verified services.

## 6. Desktop layout verification

| Check | Before | After |
| --- | --- | --- |
| 1440 viewport document width | Table content exceeded its 1,050px container | Document 1,425/1,425; table 1,050/1,050; zero horizontal overflow |
| Runtime columns | Seven dense columns; action content clipped | Five columns: Service, Runtime status, Evidence / last event, Current impact, Action |
| 1600 viewport | Not accepted as verified in the prior evidence set | Document 1,585/1,585; table 1,210/1,210; all actions visible |
| Dark theme | Not part of the accepted baseline | Runtime active verified at 1600x1000 with readable text and state contrast |
| Narrow viewport | Not inspected by design of this task | Not inspected; this remediation is desktop-only |

No viewport at or below 1024px was inspected or claimed.

## 7. Changed files and purpose

### API

- `apps/api/src/health/health.service.ts`: launch policy, state/evidence semantics, summary counts, safe metadata, link classifications, and runtime actions.
- `apps/api/src/health/health.controller.ts`: preserved Admin-protected external-service response contract.
- `apps/api/src/health/health.service.spec.ts`: policy boundary, state separation, evidence, redaction, and summary regression tests.
- `apps/api/src/health/health.controller.spec.ts`: protected route and additive contract regression tests.

### Admin Web

- `apps/admin_web/app/setup/page.tsx`: error/fixture handling and External Services page composition.
- `apps/admin_web/app/setup/setup-overview-section.tsx`: saved views, five-column tables, launch conclusion, actions, and technical disclosures.
- `apps/admin_web/app/setup/setup-page-model.ts`: query parsing, filtering, counts, and evidence-gap model.
- `apps/admin_web/app/setup/actions.ts`: side-effect-free refresh server action.
- `apps/admin_web/app/setup/setup-refresh-control.tsx`: pending state, accessible status, URL preservation, and focus restoration.
- `apps/admin_web/app/setup/setup-browser-fixtures.ts`: non-production, explicit-env-gated degraded and 401/403/429/503/timeout fixtures.
- `apps/admin_web/app/setup/loading.tsx`: route loading feedback.
- Setup specs: model, page, table, refresh, fixture, error, navigation, and accessibility regressions.
- `apps/admin_web/lib/admin-api.ts`: additive external-service metadata contract.
- `apps/admin_web/lib/admin-navigation.ts` and `apps/admin_web/components/admin-page-template.tsx`: operator label changed to External Services.
- `apps/admin_web/app/globals.css`: desktop width, table, details, refresh, status, and focus-visible rules.

### Documentation and evidence

- `docs/architecture/health-readiness.md`: launch policy, state vocabulary, evidence boundaries, and in-memory-history limitation.
- `docs/audits/setup-post-remediation-implementation-evidence-2026-08-14/`: before/after, saved views, refresh, themes, degraded, and error-state captures.

## 8. Verification commands

| Command | Result |
| --- | --- |
| `npm.cmd run test --workspace @massage-vn/admin-web -- app/setup` | PASS: 15 files, 64 tests |
| `npm.cmd run test --workspace @massage-vn/api -- src/health/health.service.spec.ts src/health/health.controller.spec.ts` | PASS: 2 files, 27 tests |
| `npm.cmd run typecheck --workspace @massage-vn/admin-web` | PASS |
| `npm.cmd run typecheck --workspace @massage-vn/api` | PASS |
| `npm.cmd run build --workspace @massage-vn/admin-web` | PASS: production route `/setup` generated |
| `npm.cmd run admin:visible-copy` | PASS: 1,651 files, 0 violations |
| Impeccable detector, executed once on Setup/CSS files | WARN only: existing global side-accent patterns outside this remediation scope |
| `npm.cmd run verify:local` | FAIL from unrelated repository-wide work in progress; Setup-focused checks, Admin/API typechecks, Admin/API/public builds, visible-copy, security guards, and both Flutter suites passed |

The repository-wide failures observed during `verify:local` were: pre-existing Operations Policy/final-authority markers, external setup copy wording in Operations Policy, Vietnam-scope violations in existing documents, one API domain-smoke assertion, Supabase `FINANCE_EVIDENCE` schema alignment, and three unrelated Admin tests (`admin-surface-css`, finance navigation access, and finance-closeout age text). None of these failures point to the Setup route or health-service focused tests.

## 9. Browser verification and evidence

Verified in the logged-in in-app browser against local production:

- 1440x1000: runtime active, evidence gaps, needs action, launch ready, launch required, deferred, refresh pending, refresh success.
- 1600x1000: runtime active in dark theme and launch ready in light theme.
- Development-only fixtures: degraded, 401, 403, 429, 503, and timeout.
- Production fixture gate: `fixture=degraded` was ignored; no fixture warning or degraded row appeared.
- Clean final production tab: zero console errors and warnings.
- URL-backed active state and zero document-level horizontal overflow verified.
- Native `<details>/<summary>` and focus-visible styles are present; automated keyboard toggling was limited by the in-app browser driver, while semantic markup and component tests cover the contract.

Evidence directory: `docs/audits/setup-post-remediation-implementation-evidence-2026-08-14/`

Key captures:

- `00-before-runtime-1440.png`
- `01-runtime-active-1440.png`
- `02-runtime-evidence-gaps-1440.png`
- `04-launch-ready-1440.png`
- `07-refresh-pending-1440.png`
- `08-refresh-success-1440.png`
- `09-runtime-active-1600-dark.png`
- `10-launch-ready-1600-light.png`
- `11-degraded-fixture-1440.png`
- `12-error-401-fixture-1440.png` through `16-error-timeout-fixture-1440.png`

## 10. Safety and protected areas

- No credentials, secret values, provider raw errors, tokens, or sensitive payloads were exposed.
- External-service Admin guard and API authentication boundary were preserved.
- Refresh performs a GET and route revalidation only; it does not send messages, make payments, register accounts, change flags, or mutate provider state.
- No external console, SMS, push, payment, storage, map, or referral mutation was performed.
- No database schema, migration, dependency, feature flag, deployment, commit, or push was created by this remediation.
- Existing user changes across the dirty worktree were preserved.

## 11. Remaining risk and next action

The remaining operational risk is evidence coverage: five required services are configured but have no safe runtime probe. This is visible and therefore no longer a false-health risk, but it still limits incident diagnosis. The single next action is to add one provider-specific, read-only verification path at a time, starting with Production SMS because OTP delivery directly affects customer and Partner access. Each probe must return timestamped evidence without sending a message or exposing credentials.
