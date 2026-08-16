# Operations Policy final remediation report

- Date: 2026-08-13
- Route: `/operations-policy`
- Verified build: `AAWuLZ9W6eyKg3BZds9qN`
- Desktop scope: 1440x1000 and 1600x1000 only
- Safety: no policy Save, shared database mutation, audit backfill, schema change, migration, dependency install, commit, push, or deployment was performed

## 1. Release decision

The two release-blocking P0 defects from the final re-audit are fixed.

1. Unsaved policy values, reason, confirmation state, and server-action state are isolated per policy. Dirty navigation requires an explicit discard confirmation; accepting it resets the next editor to its own current value, blank reason, unchecked confirmation, untouched fields, and idle action state.
2. `Live` now means a policy has a real runtime consumer and integration-test contract. The API and UI agree on `19 live / 2 locked / 7 planned`; all nine non-live policies are read-only and non-live PATCH requests return 409.

The write path is also serialized per policy key inside the existing transaction. A disposable PostgreSQL integration database proved both an existing-row race and a missing-row/default race: one request succeeded, one returned 409, and exactly one audit row was committed in each case.

**Release judgment: CONDITIONAL GO for the Operations Policy write contract; final remediation evidence remains PARTIAL.** No P0 code or data-contract blocker remains in this slice. However, a non-Developer operator session was not available to reproduce the direct diagnostics permission response, newly opened in-app tabs did not inherit the requested 1600px viewport for Supply/Simulation/Audit captures, and legacy production-dead Operations Policy modules were not deleted from the already heavily modified worktree.

## 2. Finding status

| Priority | Finding | Status | Root cause and remediation |
|---|---|---|---|
| P0 | Policy A state reached policy B | PASS | The client form instance was reused. The editor is keyed by policy and dirty/pending navigation is guarded across row, tab, Close, history, and unload paths. |
| P0 | All 28 policies appeared Live/editable | PASS | Manual `enforced` was not sufficient. Lifecycle, risk, blast radius, and a consumer contract now come from the API definition source. Seven reference-only and two fixed-contract keys are read-only in UI and API. |
| P1 | Concurrent expected-value PATCH could overwrite | PASS | The transaction now obtains a PostgreSQL advisory transaction lock by policy key before compare/write/audit. Existing-row and absent-row races passed against a disposable PostgreSQL DB. |
| P1 | Automated history appeared as Operator | PASS | Audit source is `operator`, `automated_smoke`, or `legacy_unknown`; source filtering and cursor/take are applied on the server. Missing metadata is never authoritative Operator history. |
| P1 | 1440 editor clipped Action/Close/filter | PASS | The editor is full width below the list through 1679px; side-by-side starts at 1680px. 1440 screenshots have zero page horizontal overflow. |
| P1 | Initial form showed danger errors | PASS | Local validation is shown only after touch or submit attempt. A valid, unsubmitted form had zero field-error nodes and an enabled Save button. |
| P1 | Supply zero rendered long zero tables by default | PASS | Zero-supply diagnostics are behind an explicit disclosure; the default DOM contains no diagnostic tables. Expanded diagnostics remain full width. |
| P1 | Simulation badge contradicted prerequisites | PASS | The shared readiness language reports `Blocked` when Partner supply prerequisites fail; no `Current snapshot` claim or result table is rendered. |
| P1 | High-risk changes lacked explicit proof/rollback | PASS | High risk requires the exact policy label on client and server. Success state includes audit ID and a `Revert to Before` action that uses the same expected-value, reason, transaction, and audit contract. |
| P1 | Diagnostics permission behavior | PARTIAL | Tabs are hidden without `DEVELOPER_SYSTEM`; a direct URL renders an explicit required-permission state instead of silently returning to Policies. A true non-Developer authenticated browser session was unavailable for final reproduction. |
| P1 | Exact 1440/1600 evidence set | PARTIAL | Policies/editor were captured at the requested desktop overrides. New Supply/Simulation/Audit tabs reverted to the browser's default content viewport, so those captures are supplemental behavior evidence and are not claimed as 1600px proof. |
| P2 | Static FCM readiness claim | PASS | The UI now says FCM readiness is not verified in this workspace rather than asserting a passed smoke. |
| P2 | Shift SLA fallback said future automation | PASS | Each Start Shift SLA explains the concrete overdue queue timing and operational impact. |
| P2 | Unused legacy Operations Policy modules | PARTIAL | Production callers were traced, but deletion was deferred to avoid mixing broad dead-code cleanup with this write-safety remediation in a very dirty worktree. |

## 3. Lifecycle and consumer contract

The consistency guard resolves every symbol and test path, rejects unknown consumer IDs, verifies the reviewed key sets, and derives the counts from definitions.

| Lifecycle | Policy keys | Runtime consumer | Integration proof |
|---|---|---|---|
| Live (7) | `command.start_shift.matching_delays_sla_minutes`, `command.start_shift.payment_holds_sla_minutes`, `command.start_shift.cancellation_review_sla_minutes`, `command.start_shift.refund_review_sla_minutes`, `command.start_shift.notification_failures_sla_minutes`, `command.start_shift.cash_reconciliation_sla_minutes`, `command.start_shift.partner_approvals_sla_minutes` | `admin.service.ts#queueSlaWindow` | `admin.service.spec.ts` |
| Live (5) | `matching.provider_response_window_minutes`, `matching.marketplace_partner_radius_meters`, `matching.marketplace_partner_location_max_age_minutes`, `matching.marketplace_partner_invitation_limit`, `matching.travel_buffer_minutes` | `matching.policy.ts#resolveMatchingPolicy`, `matching.service.ts#getPolicy` | `matching.policy.spec.ts`, `providers.service.spec.ts` |
| Live (5) | `booking.max_customer_current_to_booking_address_km`, `booking.max_preferred_partner_distance_km`, `booking.current_location_freshness_minutes`, `booking.distance_gate_enabled`, `booking.service_area_required` | `matching.policy.ts#resolveMatchingPolicy`, `matching.service.ts#getPolicy` | `matching.policy.spec.ts`, `providers.service.spec.ts` |
| Live (1) | `no_show.partner_report_policy` | `admin.service.ts#markBookingNoShow` | `admin.service.spec.ts` |
| Live (1) | `notification.partner_alert_channel` | `notifications.processor.ts#resolveProviderOverride` | `notifications.processor.spec.ts` |
| Locked (2) | `matching.marketplace_open_mode`, `matching.preferred_accept_mode` | Fixed contract through `matching.policy.ts#resolveMatchingPolicy` | `matching.policy.spec.ts` |
| Planned (7) | `wallet.negative_balance_gate`, `decision.action_evidence_gate_mode`, `cash.settlement_clearance_policy`, `payout.batch_cycle_policy`, `matching.first_pick_expiry_action_policy`, `cancellation.after_match_policy`, `no_show.evidence_requirement_policy` | None; current hard-coded MVP contract remains authoritative | None until promoted to Live |

## 4. Route and request plan

| Workspace | Before remediation | After remediation |
|---|---|---|
| Policies | Settings plus editor state that could survive policy switches | Settings only; policy-keyed form, lifecycle/risk contract, guarded navigation |
| Supply | Settings + bounded bookings/Partners; zero-state analyses rendered immediately | Same bounded source requests; zero-state summary first, diagnostic data mounted only after disclosure |
| Simulation | Settings + bounded bookings/Partners; header could claim current snapshot while blocked | Same bounded source requests; blocked prerequisite model suppresses result tables |
| Audit | Settings plus recent audit rows, then client-side source filtering | `/admin/operational-policy/audit?source={source}&take=8&cursor={cursor}` only; no settings request |

## 5. Concurrency and audit proof

Disposable database: `hands_ops_policy_verify_20260813234706` (created for the test and dropped immediately afterward).

| Scenario | Result | Final audit rows |
|---|---|---:|
| Two requests, same expected value, existing setting row | 1 fulfilled, 1 HTTP 409 | 1 |
| Two requests, same expected default, no setting row | 1 fulfilled, 1 HTTP 409 | 1 |
| Missing audit source filter | Returned only from `legacy_unknown`, not Operator | N/A |

The policy value and audit insert remain in one transaction. Failed contenders do not write an audit row.

## 6. Desktop browser verification

Browser: logged-in Codex in-app browser. No Save action was submitted. All inspected tabs reported zero console errors/warnings and zero page-level horizontal overflow.

| Evidence | Viewport | Verified state |
|---|---:|---|
| `01-policies-1440x1000.png` | 1440x1000 | Workspace, lifecycle counts, complete filters and Action column |
| `02-policy-editor-initial-1440x1000.png` | 1440x1000 | Full-width editor, neutral initial validation, Close visible |
| `03-policy-editor-dirty-switch-confirm-1440x1000.png` | Supplemental desktop capture | Dirty form before switch; browser reported native `confirm`, then next policy reset to current value `15`, blank reason, unchecked. The saved PNG is 1585x991 content pixels and is not claimed as the 1440 target. |
| `04-policy-editor-valid-not-submitted-1600x1000.png` | 1600x1000 | Valid unsubmitted form, Save enabled, zero field-error nodes |
| `05-planned-and-locked-policies-1600x1000.png` | 1600x1000 | DOM verified 9 read-only rows and 19 live edit actions; screenshot shows the surrounding grouped list at zero horizontal overflow |
| `06-supply-zero-default-1600x1000.png` | Supplemental default viewport | Blocked/zero-supply summary, disclosure present, zero diagnostic tables in default DOM |
| `07-supply-diagnostics-expanded-1600x1000.png` | Supplemental default viewport | Diagnostics explicitly expanded, three bounded tables, no horizontal overflow |
| `08-simulation-blocked-1600x1000.png` | Supplemental default viewport | Blocked prerequisites, no Current snapshot claim, no result table |
| `09-audit-operator-1600x1000.png` | Supplemental default viewport | Operator source selected; no legacy automation mixed into results |
| `10-audit-legacy-automation-1600x1000.png` | Supplemental default viewport | Legacy/unknown source separated and inference disclosed |

The in-app browser screenshot files contain the page content area, so a 1440x1000 override records approximately 1425x990 pixels and a 1600x1000 override approximately 1585x991 pixels after browser chrome/scrollbar reservation. Files `06` through `10` are 1265x712 because the newly opened tabs reverted to the default viewport.

`11-permission-state-if-reproducible-1600x1000.png` was not created because the available authenticated session had Developer System access. The hidden-tab/direct-URL contract is covered by focused Admin tests, but the non-Developer browser state remains not independently reproduced.

## 7. Verification commands

| Command | Result |
|---|---|
| `npm.cmd run test --workspace @massage-vn/admin-web -- app/operations-policy components/admin-form-control-usage.spec.tsx` | PASS: 46 files, 199 tests |
| `npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts src/admin/admin-operational-policy-audit-source.spec.ts src/matching/matching.policy.spec.ts -t "operational policy"` | PASS: 3 files, 10 tests, 670 skipped |
| Disposable PostgreSQL `admin-operational-policy-concurrency.integration.spec.ts` | PASS: 1 file, 3 tests |
| `npm.cmd run typecheck --workspace @massage-vn/admin-web` | PASS |
| `npm.cmd run typecheck --workspace @massage-vn/api` | PASS |
| `npm.cmd run policy:admin-consistency` | PASS: 28 definitions, 19 live, 2 locked, 7 planned |
| `npm.cmd run admin:visible-copy` | PASS: 1,638 files, 0 violations |
| Scoped Operations Policy ESLint | PASS |
| `npm.cmd run verify:scope -- -Scope admin` | FAIL from three pre-existing unrelated assertions: admin notice CSS contract, Finance navigation including Company Bank Accounts, and Finance closeout `70d` vs `73d`. Operations Policy focused tests/typecheck/query guards/visible copy/build passed. |
| `npm.cmd run verify:scope -- -Scope api` | FAIL from pre-existing unrelated push-campaign select/include assertion and unrelated unused variables in `admin.service.ts`. API typecheck/build/contracts and Operations Policy focused tests passed. |
| Impeccable detector, Operations Policy + global CSS, one run | Exit 1: six existing side-tab warnings in unrelated Vietnam map, Service Catalog, Dispatch, Timeline, Operations checklist, and Booking Finance selectors. No Operations Policy selector was reported. |
| `git diff --check` on the remediation scope | PASS; line-ending conversion warnings only |

## 8. Changed files in this remediation slice

Primary implementation:

- `apps/api/src/matching/matching.policy.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin-analytics.routes.ts`
- `apps/api/src/admin/admin-operational-policy-audit-source.ts`
- `apps/api/src/admin/admin-operational-policy-concurrency.integration.spec.ts`
- `apps/admin_web/lib/admin-api.ts`
- `apps/admin_web/app/operations-policy/actions.ts`
- `apps/admin_web/app/operations-policy/operations-policy-form.tsx`
- `apps/admin_web/app/operations-policy/operations-policy-page-model.ts`
- `apps/admin_web/app/operations-policy/operations-policy-audit-trail-section.tsx`
- `apps/admin_web/app/operations-policy/operations-policy-diagnostics-disclosure.tsx`
- `apps/admin_web/app/operations-policy/page.tsx`
- `apps/admin_web/app/globals.css` (scoped Operations Policy selectors only)
- `infra/scripts/check-operations-policy-consistency.mjs`

Focused specs were updated beside the implementation. The worktree contained extensive pre-existing modifications in these and many unrelated files; they were preserved and not reverted.

## 9. Protected areas

| Area | Touched by this remediation |
|---|---|
| Prisma schema / migrations | No |
| Authentication or role model | No |
| Payment, wallet, payout, booking, settlement data | No |
| Shared/production database | No |
| Package dependencies | No |
| Deployment configuration | No |
| Commit / push / deployment | No |

## 10. Remaining risk and next single priority

The next single priority is one restricted-operator evidence pass at an explicitly confirmed 1600x1000 viewport: reproduce `/operations-policy?details=matching&matching=supply` with `SYSTEM_POLICY` but not `DEVELOPER_SYSTEM`, capture the permission state, then capture Supply, Simulation, and both Audit sources in the same browser tab so the viewport override cannot be lost. Do not combine that pass with role-schema redesign.
