# Coupons remediation implementation report

Date: 2026-08-11  
Route: `http://localhost:3101/coupons`  
Repository: `C:\dev\massage-on-demand-vn`  
Status: Implemented and verified locally; not committed

## 1. Final assessment

The Coupons workspace now separates current lifecycle state, campaign window, usage evidence, and operator actions in one dense table. The persistent create form was replaced by an explicit drawer, every new coupon is created as Paused, dates use one ICT contract, and Pause/Activate/Delete confirmations resolve the selected coupon independently from pagination or search.

The operator can now answer three questions without opening every record:

1. Is the code live, scheduled, paused, or expired?
2. What discount and ICT checkout window does it use?
3. What booking, payment, customer-paid, discount, and reversal evidence exists?

The implementation does not delete or reclassify existing coupon data. The 83 legacy `SMOKE*` records remain an explicit cleanup decision for an authorized operator.

## 2. Before and after

Before:

- A persistent create form pushed records down and produced a roughly 3,444 px page.
- Coupon records were presented as tall cards rather than a scan-friendly operations table.
- Edit input and visible dates could disagree because browser-local parsing and ICT display used different contracts.
- Confirmation targets could disappear on page 2 or filtered views.
- Pause was not reachable from the main row, and usage mixed booking/payment meanings.
- API failures could look like a real zero or empty result.

After:

- The default viewport shows freshness, current lifecycle KPIs, filters, and the table.
- Create, edit, and usage use accessible right-side dialogs with Escape, focus trapping, close controls, and focus restoration.
- All date labels and inputs use ICT (`Asia/Ho_Chi_Minh`, UTC+7).
- The table keeps code/campaign, discount, ICT window, lifecycle, usage, and actions together.
- Page, search, and view context survive Edit, Usage, Pause, and Delete flows.
- Summary, list, target, and usage failures are represented independently and do not become fake zeroes.

Evidence:

- Baseline: `00-before-live-1440.png`
- Updated light view: `01-after-live-1440-light-viewport.png`
- Updated dark views: `08-table-1920-dark.png`, `09-live-1440-dark.png`
- Dense 1920 table: `07-table-1920-light.png`

## 3. P0 / P1 / P2 disposition

| Priority | Item | Result | Evidence |
| --- | --- | --- | --- |
| P0 | One ICT display/input contract | Complete | ICT helper and round-trip tests |
| P0 | Unchanged edit preserves exact instant | Complete | Original ISO values are retained and reused when input is unchanged |
| P0 | Independent page-2/filter confirmation target | Complete | Target lookup by ID plus sanitized `returnTo`; page-2 browser capture |
| P0 | API failure distinct from zero/empty | Complete | `adminGetResult` source contracts and component/page tests |
| P0 | Safe create lifecycle | Complete | Batch creates Paused, max 50, preview, per-code results |
| P0 | Pause/Activate/Delete safety | Complete | Explicit context, consequence copy, expired activation guard |
| P0 | Smoke fixture recurrence prevention | Complete | New smoke coupon is bounded, Paused first, activated only for evidence, then paused |
| P1 | Dense operations table | Complete | One table; campaign description is visible beside code |
| P1 | Lifecycle filters | Complete | Live, Scheduled, Records, All with query preservation |
| P1 | Edit and Usage drawers | Complete | Independent target loading; empty and evidence states |
| P1 | Usage evidence semantics | Complete | Booking state, payment, customer paid, discount, reversal, all services separated |
| P1 | Pagination and search context | Complete | Return-context helper and browser page-2 checks |
| P2 | Freshness and Refresh now | Complete | Summary `generatedAt` shown in ICT; manual refresh link |
| P2 | Source-specific failure state | Complete in code/tests | Full API outage is intercepted by the shared category guard before route content |
| P2 | Owner, budget, limits, targeting, archive | Deferred by policy | Current schema has no authoritative fields; no migration was invented |

## 4. Core design decisions

### Timezone contract

- Canonical operating timezone: `Asia/Ho_Chi_Minh`.
- Display and input labels explicitly say ICT.
- `datetime-local` values are parsed by numeric date components instead of browser/host timezone coercion.
- Edit forms keep the original ISO value. If the operator does not change the visible ICT input, the original instant is submitted unchanged.
- No-end-date is a deliberate checkbox, not a silent default interpretation.

### API failure contract

- Summary and list use result objects rather than empty fallbacks.
- Summary failure removes KPI counts instead of rendering zero.
- List failure disables lifecycle mutations and shows a retry path.
- Edit target and Usage source failures are isolated from the current page list.
- True empty, filtered empty, source unavailable, and usage empty are separate states.
- A total API outage currently activates the existing Admin category fail-closed screen (`Access restricted`) before Coupons can render its own source error. This shared-shell wording is outside the Coupons route and remains a system-level follow-up.

### Create, Pause, Activate, and Delete safety

- Create accepts up to 50 parsed codes and reports valid, duplicate, invalid, and per-code API results.
- New coupons are always created Paused.
- The operator must activate from the list after checking code, campaign description, discount, and ICT window.
- Pause/Activate/Delete resolve the exact coupon ID even when the coupon is off the current page.
- Confirmation copy includes the selected code, discount, checkout window, exposure consequence, and preserved return location.
- Activation is blocked for an already expired coupon and directs the operator to edit the window.
- Destructive browser confirmation submissions were not executed against retained local data.

### Usage evidence

- Usage loads every service attached to a booking rather than only the first service.
- Customer-paid amount, original amount when available, discount, payment state, booking state, and reversal state are separate columns.
- Empty usage renders a compact status without an empty wide-table scrollbar.

## 5. Changed files

Coupons Admin Web:

- `apps/admin_web/app/coupons/page.tsx`: result-aware orchestration, source states, freshness, drawer and confirmation routing.
- `apps/admin_web/app/coupons/coupons-table-section.tsx`: dense lifecycle/usage/action table.
- `apps/admin_web/app/coupons/coupon-filter-board.tsx`: operational lifecycle filters and unavailable-summary handling.
- `apps/admin_web/app/coupons/coupon-create-drawer.tsx`: Paused batch creation workspace.
- `apps/admin_web/app/coupons/coupon-management-drawer.tsx`: edit and usage workspaces.
- `apps/admin_web/app/coupons/coupon-drawer-shell.tsx`: dialog focus, Escape, close, and focus restoration.
- `apps/admin_web/app/coupons/coupon-ict-time.ts`: ICT input/display conversion and unchanged-value preservation.
- `apps/admin_web/app/coupons/coupon-code-batch.ts`: bounded code parser and preview facts.
- `apps/admin_web/app/coupons/coupon-return-context.ts`: safe `/coupons` return context.
- `apps/admin_web/app/coupons/coupon-page-model.ts`: lifecycle and usage presentation model.
- `apps/admin_web/app/coupons/coupon-action-confirmation.ts`: exact target and consequence model.
- `apps/admin_web/app/coupons/actions.ts`: batch create, lifecycle, update, and return-context server actions.
- Corresponding `*.spec.ts` and `*.spec.tsx` files: focused regression coverage.

Shared Admin Web:

- `apps/admin_web/components/admin-form-date-picker-field.tsx`: timezone-neutral `datetime-local` parsing.
- `apps/admin_web/components/admin-root-shell.tsx`: drawer query keys in focus-return behavior.
- `apps/admin_web/app/globals.css`: Coupons-only dense table and drawer layout using existing tokens.

API:

- `apps/api/src/admin/admin.dto.ts`: bounded coupon batch DTO.
- `apps/api/src/admin/admin-coupon.routes.ts`: exact coupon lookup and batch-create routes.
- `apps/api/src/admin/admin.service.ts`: paused batch creation and complete usage evidence projection.
- `apps/api/src/admin/admin-route-domain.spec.ts`: route ownership contract updated for the coupon endpoints.
- Coupon-focused sections in `admin.controller.spec.ts` and `admin.service.spec.ts`.

Smoke and diagnostics:

- `infra/scripts/api-smoke.mjs`: bounded Paused-first coupon fixture lifecycle.
- `infra/scripts/api-smoke-coupon-lifecycle.test.mjs`: recurrence guard.
- `infra/scripts/coupon-smoke-inventory.mjs`: read-only legacy inventory report.

No dependency, Prisma schema, migration, auth, booking mutation, payment policy, or settlement policy was added or changed.

## 6. Tests and verification

| Command / scope | Result |
| --- | --- |
| Coupons Admin focused specs | PASS: 9 files, 43 tests |
| Final ICT/page focused rerun | PASS: 2 files, 12 tests |
| API coupon-focused controller/service specs | PASS: 24 coupon tests; unrelated tests skipped by filter |
| Admin route-domain manifest spec | PASS: 22 tests |
| Coupon smoke lifecycle contract | PASS: 1 test |
| Admin Web typecheck | PASS |
| API typecheck | PASS |
| Admin Web production build | PASS: 68 pages |
| API build | PASS |
| Admin visible-copy guard | PASS after replacing `Asia/Bangkok` with `Asia/Ho_Chi_Minh` |
| `verify:scope -- -Scope admin` | PASS: 4,491 passed, 1 skipped; typecheck/lint/guards/build passed |
| `verify:scope -- -Scope api` | PASS: 2,186 passed, 1 skipped; policy/typecheck/lint/build passed |
| Coupon-scope `git diff --check` | PASS |
| New coupon files trailing-whitespace check | PASS |

The scope verifiers reported only generic protected-file warnings caused by the repository's pre-existing broad dirty worktree. No Coupon test, typecheck, lint, visible-copy, or build failure remains.

## 7. Browser verification

Authenticated in-app browser verification was performed against the current local builds on Admin `:3101` and API `:3000`.

Verified at 1440 x 900:

- Live light default and no page-level horizontal overflow.
- Scheduled and Records true-empty states.
- All-view successful search and zero-result search using the visible form.
- Create drawer labels, bounded batch preview, duplicate/invalid feedback, disabled invalid submission.
- Edit drawer ICT labels and absence of a direct active checkbox.
- Page-2 Usage and Pause confirmation with preserved query/page context.
- Usage data and compact usage-empty states.
- Focus trap, Escape close, and focus restoration to the exact `Create coupon` link.
- Dark theme readability.

Verified at 1920 x 1080:

- Live/table light and dark themes.
- No page horizontal overflow.
- Coupon identity, window, lifecycle, Usage, Pause, Edit, and Delete actions remain readable.
- The table region has an accessible name and keyboard focus.

Browser console after restoration: no errors or warnings.

Captures in this folder:

- `01-after-live-1440-light-viewport.png`
- `02-create-drawer-1440-light.png`
- `03-usage-drawer-page2-1440-light.png`
- `04-edit-drawer-page2-1440-light.png`
- `05-pause-confirm-page2-1440-light.png`
- `06-live-1920-light.png`
- `07-table-1920-light.png`
- `08-table-1920-dark.png`
- `09-live-1440-dark.png`
- `10-api-unavailable-1440-light.png`
- `11-scheduled-empty-1440-light.png`
- `12-records-empty-1440-light.png`
- `13-all-search-result-1440-light.png`
- `14-all-search-zero-1440-light.png`
- `15-create-validation-batch-preview-1440-light.png`
- `16-usage-empty-1440-light.png`

## 8. Smoke fixture inventory

Read-only inventory: `coupon-smoke-inventory.json`

| Fact | Count |
| --- | ---: |
| Legacy `SMOKE*` total | 83 |
| Active | 83 |
| Active and open-ended | 83 |
| With linked usage | 64 |
| Expired | 0 |

These records predate this remediation. They were not deleted, paused, or declared production data because their ownership and cleanup policy are not proven. The recurrence is blocked for future API smoke runs: a new smoke coupon has a bounded roughly 15-minute window, starts Paused, is activated immediately before coupon evidence, and is paused immediately afterward.

## 9. Policy decisions required

The following are intentionally not implemented because the current schema and product policy do not provide authoritative definitions:

- Coupon owner and approval workflow.
- Campaign budget and spend cap.
- Maximum redemptions per coupon or customer.
- Minimum order amount.
- Eligible services, regions, or customer segments.
- Archive lifecycle and retention policy.
- Authorized cleanup/disposition for the 83 legacy `SMOKE*` records.

Implementing these requires explicit policy and, for several items, a reviewed schema change. No placeholder values or migrations were introduced.

## 10. Acceptance checklist

- [x] Card and picker use the same ICT contract.
- [x] Unchanged edit preserves the original instant.
- [x] Page 2, Scheduled, Records, and search can resolve confirmation targets independently.
- [x] Pause and Activate flows exist with explicit confirmation semantics.
- [x] API failure does not render as a real zero/empty result in the Coupons route contract.
- [x] Visible form controls have visible labels.
- [x] Create defaults to Paused rather than active/open-ended exposure.
- [x] Campaign description is visible in the records table.
- [x] Empty usage has no empty wide scrollbar.
- [x] Coupon-focused tests, typechecks, builds, and Admin/API scope verification pass.
- [x] Light/dark themes and 1440/1920 desktop viewports were verified.
- [x] Existing user changes and legacy records were preserved.

## 11. Remaining risk

The only material Coupon-domain operational risk left is the unresolved disposition of the 83 active, open-ended legacy `SMOKE*` records. The code prevents recurrence, but changing those records without an approved data-cleanup decision would be less safe than leaving them intact. The shared Admin category guard's generic `Access restricted` wording during a total API outage is a separate shell-level observability issue; Coupons source failure states are covered in isolated route/component tests.
