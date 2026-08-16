# Service Catalog final remediation report

Date: 2026-08-14  
Route: `http://localhost:3101/services`  
Release judgement: **production code complete, release candidate with two repository-wide unrelated test drifts and no destructive lifecycle smoke**

## 1. Outcome

The Service Catalog now has one operational write contract: published `OPERATOR` and `SEED` rows cannot be changed through legacy single-service or payout mutations. Operators work through the group command with optimistic concurrency, stable idempotency, one audit target, atomic duration pricing, and versioned payout rules.

The Admin workspace now separates the live public projection from working drafts. It shows actual live group/option counts, localization, payout coverage, drafts, last publication evidence, impact before and after the proposed change, and explicit confirmation for Publish, Hide, and Archive.

No current service group, payout rule, booking payout snapshot, production/staging database row, or external system was mutated during this work.

## 2. Implementation by slice

### P0 - production write path

- Added a central legacy-mutation guard for published operational service and payout rows.
- Legacy calls return a conflict with `SERVICE_CATALOG_GROUP_COMMAND_REQUIRED` and an operator-readable message.
- Removed active Admin callers for legacy service and payout mutations.
- Extended the dead-code contract to cover the legacy action and forbidden caller surface.
- Preserved Draft/Smoke boundaries and the existing group transaction.

### P1-A - public health and Live/Draft separation

- Added one shared public projection definition used by both the public service catalog and Admin health.
- Added bounded `GET /admin/services/health` data with checked time, live groups/options, anomalies, EN/VI readiness, current/historical payout rules, drafts, and last publish evidence.
- Kept catalog rows available when only health fails; the UI reports that the public check is unavailable and asks the operator to refresh.
- Separated Published/Hidden/Archived, Live localization, and Draft readiness in the comparison table.

### P1-B - editor readiness

- Existing group keys are read-only. New keys are generated from the English name and can be changed only under Advanced.
- EN/VI stay primary; KO/JA/ZH are under Additional languages and retain existing values.
- The 60/90/120-minute switches show `Offered in Customer & Partner apps` plus visible On/Off state.
- Publish blockers are visible before submit, move focus to the relevant field, and disable publish review.
- Invalid payout greater than customer price blocks both draft save and publish review.
- Display order and a 500-character customer-facing description are editable.

### P1-C - impact and destructive actions

- Impact shows app-visible options before to after, base-price/custom-price Partners, and open booking lines.
- Publish, Hide, and Archive use in-app confirmations, not `window.confirm`.
- Confirmation copy explains future-booking application, retained booking snapshots, audit creation, and recovery through the retained draft.
- Archive requires an explicit acknowledgement.
- X, backdrop, Escape, and Cancel share the same dirty guard.

### P1-D - idempotency and audit

- The client creates and retains a UUID for one submission intent.
- Transport retry reuses the key; payload/intent changes create a new key after reset.
- Same key/same payload replays without another payout or audit version; same key/different payload conflicts.
- Pending controls prevent rapid duplicate submission.
- Audit evidence retains actor, reason, intent, version, before/after state, and `service_group:{groupKey}` target.

### P2 - copy, order, and history

- Row actions are `Edit` with unique accessible names such as `Edit Foot Massage`.
- Live and Draft labels are separate.
- Payout history is read-only and disclosed per duration.
- Display order remains a simple numeric control; no drag-and-drop dependency was added.

## 3. Files changed for this slice

### Admin Web

- `apps/admin_web/app/services/actions.ts`
- `apps/admin_web/app/services/page.tsx`
- `apps/admin_web/app/services/page.spec.tsx`
- `apps/admin_web/app/services/service-action-notice-section.tsx`
- `apps/admin_web/app/services/service-action-notice-section.spec.tsx`
- `apps/admin_web/app/services/service-catalog-manager-section.tsx`
- `apps/admin_web/app/services/service-catalog-manager-section.spec.tsx`
- `apps/admin_web/app/services/service-catalog-drawer-shell.tsx`
- `apps/admin_web/app/services/service-catalog-editor-form.tsx`
- `apps/admin_web/app/services/service-catalog-editor-model.ts`
- `apps/admin_web/app/services/service-catalog-editor-model.spec.ts`
- `apps/admin_web/app/services/service-dead-code.spec.ts`
- `apps/admin_web/app/globals.css`
- `apps/admin_web/components/admin-form-controls.tsx`
- `apps/admin_web/lib/admin-api.ts`
- `apps/admin_web/lib/service-action-notice.ts`

### API

- `apps/api/src/admin/admin-analytics.routes.ts`
- `apps/api/src/admin/admin-service-input.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin.service.spec.ts`
- `apps/api/src/admin/admin-service-catalog.spec.ts`
- `apps/api/src/services/public-service-catalog.ts`
- `apps/api/src/services/services.service.ts`
- `apps/api/src/services/services.service.spec.ts`

## 4. Public API contract

Measured from `GET http://localhost:3000/api/services/groups` after the final build:

| Check | Result |
|---|---:|
| HTTP | 200 |
| Groups | 3 |
| Options | 9 |
| UTF-8 bytes | 3,577 |
| Internal finance/audit/draft key matches | 0 |

The public response continues to omit payout, VAT, other-cost, gross-fee, audit, draft, provenance, and mutation keys.

## 5. Verification

### PASS

- Admin focused suite: 10 files, 102 tests.
- Admin final focused suite including shared form-control usage: 11 files, 152 tests.
- API focused suite: 7 files, 105 tests.
- Admin typecheck.
- API typecheck.
- Service catalog cleanup tests: 5 tests.
- Prisma migration integrity: 96 migrations, no violations; one existing duplicate-timestamp ordering warning.
- Admin visible-copy guard: 1,641 files, zero violations.
- API policy coverage, Prisma validation, API lint, API build.
- Admin lint, query guard, visible-copy guard, Admin production build.
- `git diff --check`: no whitespace errors; existing LF-to-CRLF working-copy warnings only.

### Repository-wide failures unrelated to Service Catalog

`verify:scope -Scope admin` completed with build/typecheck/lint/guards passing, but the full Admin test suite reported four failures. The Service Catalog raw-button failure found there was fixed and its focused shared-control test now passes. Three pre-existing dirty-worktree failures remain:

- `components/admin-surface-css.spec.tsx`: shared notice-card CSS expectation drift.
- `lib/admin-navigation.spec.ts`: company bank account visibility expectation drift.
- `app/finance-closeout/page.spec.tsx`: expected `70d`, rendered `74d` from current fixture time.

`verify:scope -Scope api` completed with validation/typecheck/lint/build/contracts passing, but the full API suite has one unrelated Push campaign assertion drift:

- `src/admin/admin.service.spec.ts`: post-enqueue receipt test expects legacy `include`, implementation returns the bounded `select` projection.

`verify:local` was not repeated because it would rerun these known unrelated failing suites without adding Service Catalog evidence.

### Impeccable detector

Executed exactly once after UI changes. It reported seven existing side-accent warnings in the global stylesheet and no blocking finding. No global unrelated visual refactor was made.

## 6. Browser QA

Evidence directory: `docs/audits/services-final-remediation-evidence-2026-08-14/`

- `01-default-1440x1000.png` - final light catalog, 3/9 public health, all row actions visible.
- `02-edit-drawer-top-1440x1000.png` - existing-key read-only editor.
- `03-new-service-cjk-key-1440x1000.png` - generated key and Additional languages.
- `04-pricing-visible-toggle-1440x1000.png` - visible On/Off state.
- `05-impact-before-after-1440x1000.png` - app options before to after and Partner/booking impact.
- `06-publish-confirmation-1440x1000.png` - publish consequence and audit copy.
- `07-hide-confirmation-1440x1000.png` - immediate app removal and republish recovery.
- `08-archive-confirmation-1440x1000.png` - explicit acknowledgement and retained history.
- `09-public-health-unavailable-1440x1000.png` - catalog list succeeds while health returns 503.
- `10-payout-over-price-error-1440x1000.png` - inline error and both save/publish disabled.
- `11-publish-blockers-1440x1000.png` - four blockers, disabled publish, reason focus.
- `12-dark-mode-1600x1000.png` - dark theme and complete table at 1600px.

Actual mouse/keyboard interactions verified drawer navigation, toggles, blocker focus, payout conflict, Publish/Hide/Archive confirmations, archive acknowledgement, and dirty close. The final `/services` tab was restored to light mode at 1440 x 1000. Final console warnings/errors: none.

No catalog mutation button was submitted.

## 7. Acceptance matrix

| Requirement | Status | Evidence |
|---|---|---|
| Group-command-only operational writes | Complete | API guards and focused tests |
| Legacy mutation blocked | Complete | 409 code/message tests |
| Public/Admin health alignment | Complete | shared projection, 3/9 live measurement |
| Live and Draft readiness separated | Complete | table and health tests/screenshots |
| Existing key read-only/new key generated | Complete | model tests and browser QA |
| Visible app toggles | Complete | browser toggle QA |
| Pre-submit blocker/focus | Complete | model tests and browser QA |
| Before to after impact | Complete | API/model tests and screenshot |
| Publish/Hide/Archive confirmation/recovery | Complete | component contract and browser QA |
| Shared dirty close guard | Complete | implementation and browser QA |
| Stable idempotency | Complete | API replay/conflict tests and client key lifecycle |
| Automated rendered user-event suite | Partial | no DOM interaction harness is installed; model/API tests plus real browser interactions were used without adding a new dependency |
| 1440/1600 visual and console QA | Complete | evidence set, zero final console warnings/errors |
| Public finance-key leak check | Complete | 3/9/3,577 bytes/0 keys |
| Payout snapshot/earnings regression | Complete | focused booking and earnings tests |
| Destructive lifecycle smoke | Not run | no disposable catalog database; current operational catalog was not mutated |

## 8. Protected areas and preserved work

This slice did not modify Prisma schema/migrations, `apps/api/src/bookings/**`, `packages/shared-types/**`, Customer app, or Partner app. The repository already contained extensive user changes, including protected areas; they were preserved and not reverted.

No commit, push, or deployment was created.

## 9. Remaining risk and next action

The remaining Service Catalog-specific gap is an automated browser/DOM interaction suite. The next single action is to add the repository's first approved DOM interaction harness in a separate dependency-reviewed change, then encode the already verified toggle, blocker, confirmation, and dirty-close flows without touching the catalog contract.
