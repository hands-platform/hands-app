# Operations Policy remediation report

Date: 2026-08-11  
Route: `/operations-policy`  
Status: Implemented and locally verified  
Commit: Not committed

## 1. Operator outcome

- The default workspace now starts with policy attention, then groups all 28 live settings by the operator task they affect.
- Current deviations and policies changed before are separate facts. A historical change no longer appears as a current deviation.
- Policies, Supply, Simulation, and Audit stay on one route with URL-backed state and bounded data loading.
- Policy changes show Before, After, scope, impact, and effective time before the form.
- The form blocks unchanged values, invalid ranges, reasons shorter than 12 or longer than 500 normalized characters, and missing confirmation.
- The confirmation sentence is visible, keyboard-operable, and connected to its error with `aria-invalid` and `aria-describedby`.
- No production policy write was submitted during browser verification.

## 2. Data and audit contract

- API audit writes and Admin audit reads now share `metadata.before` and `metadata.after`, while legacy records remain readable.
- Normal writes are server-labelled `operator`.
- Automated smoke writes require an HMAC-signed server contract and record environment, run ID, and restoration state.
- Invalid client attempts to spoof smoke provenance are rejected.
- Audit rows are not content-deduplicated; operator and server-verified smoke records use explicit filters.
- Policy value and audit event remain in one transaction with optimistic concurrency and existing System Policy authorization.
- The service validates normalized reasons as 12–500 characters.

## 3. Information architecture and evidence

- Policy groups: Shift & Queue SLA 7, Booking Safety 5, Matching & Availability 7, Money & Settlement 3, Exceptions & Evidence 5, Notification Routing 1.
- Search, status, and group filters preserve a readable empty state.
- Policies and Audit load only their own required data.
- Supply and Simulation use bounded samples of 20 recent bookings and 30 Partners.
- Supply and Simulation show `observedAt`, source/sample context, manual refresh, and a visible demo-coordinate warning.
- Zero usable supply is a blocking warning, not a healthy or aligned result.
- Simulation hides zero-result tables when prerequisites are not met.

## 4. UI and accessibility

- Removed the nested vertical policy table scroll and the eight-column dense layout.
- Policy rows use Policy, Current value, Status, Last changed, and Action.
- Recommended values appear only when the current value deviates.
- Developer-oriented traces and planning backlog are removed from the operator default flow.
- Desktop editor remains beside the focused policy; narrower layouts stack without page-level horizontal overflow.
- Error and success summaries reuse the shared Admin notice surface.
- Form fields retain values after server errors and distinguish conflict, permission, range/reason, API, and network failures.

## 5. Changed areas

- `apps/admin_web/app/operations-policy/`: page model, grouped policy workspace, audit filters, form/action contract, evidence views, copy, and focused regression tests.
- `apps/admin_web/app/globals.css`: Operations Policy layout, filter, grouped list, editor, evidence, and responsive rules.
- `apps/admin_web/components/admin-form-controls.tsx`: checkbox error-description and invalid-state support.
- `apps/admin_web/lib/admin-api.ts`: audit result metadata consumed by the Admin form.
- `apps/api/src/admin/admin-operational-policy-audit-source.ts`: trusted operator/smoke provenance verification.
- `apps/api/src/admin/admin-governance.routes.ts`: trusted audit context forwarding.
- `apps/api/src/admin/admin.service.ts`: reason validation and transactional audit metadata.
- `infra/scripts/api-smoke.mjs`: signed smoke and explicit restoration writes.

## 6. Automated verification

| Command | Result |
| --- | --- |
| `npm.cmd run test --workspace @massage-vn/admin-web -- app/operations-policy components/admin-form-control-usage.spec.tsx` | PASS, 46 files / 197 tests |
| `npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-operational-policy-audit-source.spec.ts src/admin/admin.service.spec.ts -t "operational policy\|audit source"` | PASS, 7 focused tests |
| `npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts` | PASS, 607 tests |
| `npm.cmd run typecheck --workspace @massage-vn/admin-web` | PASS |
| `npm.cmd run typecheck --workspace @massage-vn/api` | PASS |
| `npm.cmd run build --workspace @massage-vn/admin-web` | PASS |
| `npm.cmd run verify:scope -- -Scope api` | PASS, including 2,213 API tests and build |
| `npm.cmd run verify:scope -- -Scope admin` | BLOCKED by unrelated existing `app/finance-closeout/page.spec.tsx` date-age expectation: expected `70d ago`, actual `71d ago` |
| `npm.cmd run policy:admin-consistency` | PASS |
| `npm.cmd run admin:visible-copy` | PASS, 1,607 files / 0 violations |

The required Impeccable detector was run once. It reported six pre-existing side-tab warnings in unrelated selectors (Vietnam map, Marketing, Booking Finance, Dispatch, Timeline, and Operations check items); no Operations Policy selector was reported.

## 7. Browser verification

Authenticated local browser: `http://localhost:3101/operations-policy`  
Viewports: 1440×1000 and 1680×1050  
Console: no errors  
Layout: no page horizontal overflow and no nested vertical scroll container.

Evidence folder: `docs/audits/operations-policy-remediation-evidence-2026-08-11/`

1. `01-default-attention-1440x1000.png`
2. `02-filtered-empty-1440x1000.png`
3. `03-invalid-change-panel-1440x1000.png`
4. `04-valid-not-submitted-1440x1000.png`
5. `05-supply-evidence-1440x1000.png`
6. `06-simulation-prerequisites-1440x1000.png`
7. `07-audit-operator-1440x1000.png`
8. `08-audit-smoke-1440x1000.png`
9. `09-default-attention-1680x1050.png`

DOM checks also confirmed tab `aria-current`, deep-link hrefs, disabled/enabled Save states, reason `maxLength=500`, field error relationships, and the confirmation checkbox error relationship.

## 8. Protected areas and preservation

- No Prisma schema or migration was added.
- No policy default, booking snapshot, matching, wallet, payout, auth, or permission meaning was changed.
- The existing transaction, optimistic concurrency, and System Policy guard remain active.
- Existing dirty and untracked user files were preserved, including the pre-existing Operations Policy prompt, re-audit report, and re-audit evidence folder.
- No commit, push, or deployment was performed.

## 9. Remaining risk

- A full API outage is intercepted by the shared Admin operator-access gate before the page can render its section-level retry state. The Operations Policy form's API/network failure contract is regression-tested, and the browser-controlled invalid state was captured, but the shared global outage-versus-permission distinction remains a separate Admin-shell issue.
- The unrelated Finance Closeout age assertion is the only known blocker to a fully green Admin scope verification.
