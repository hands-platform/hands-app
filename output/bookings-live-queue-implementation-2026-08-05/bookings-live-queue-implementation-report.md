# Bookings Live Queue implementation report

Date: 2026-08-05  
Target: `http://localhost:3101/bookings`

## 1. Operator experience delivered

- Direct navigation and refresh now keep URL, selected queue, workspace, list title, and API load intent aligned.
- The first screen prioritizes four clickable queues: Live now, Needs action, Matching now, and In service.
- Search, waiting-age buckets, order, additional queues, and the result list fit in the 1024x768 operator viewport with one full booking row visible.
- Desktop keeps six semantic table columns. At 1024px the same table becomes a compact 3x2 row card without horizontal overflow.
- Records is a historical workspace with period, total count, and sorting. It does not start booking realtime.
- Empty queues show queue-specific copy without an empty table header or pagination.

## 2. BQ status

| Priority | IDs | Result |
| --- | --- | --- |
| P0 | BQ-001, BQ-002 | Complete: `active` normalization/load intent fixed; server order is preserved and oldest/newest changes final DOM order. |
| P1 | BQ-003..BQ-009 | Complete: one timestamp source per event, complete status copy, Records separation, compact counts, six-column/1024 layout, environment fixture label, queue-specific empty/error states. |
| P2 | BQ-010..BQ-016 | Complete: existing count map reused, additional queues grouped/collapsed, operator actions and tones corrected, vertical duplication reduced, table region accessibility added, price copy clarified. |

No route, dependency, state library, or design system was added.

## 3. Core files

- `apps/admin_web/app/bookings/booking-page-params.ts`
- `apps/admin_web/app/bookings/booking-monitor-route-load-plan.ts`
- `apps/admin_web/app/bookings/booking-monitor-page.tsx`
- `apps/admin_web/app/bookings/booking-monitor.tsx`
- `apps/admin_web/app/bookings/booking-monitor-filters-section.tsx`
- `apps/admin_web/app/bookings/booking-monitor-list-section.tsx`
- `apps/admin_web/app/bookings/booking-monitor-list-row-model.ts`
- `apps/admin_web/app/bookings/booking-list-time.ts`
- `apps/admin_web/app/bookings/booking-empty-message.ts`
- `apps/admin_web/components/admin-data-table.tsx`
- `apps/admin_web/app/globals.css`
- `apps/admin_web/lib/admin-api.ts`
- `apps/api/src/admin/admin-booking-list-query.ts`
- Matching focused `*.spec.ts` and `*.spec.tsx` files.

## 4. Verification

- Admin focused Vitest: 8 files, 80 tests passed.
- API booking-list query Vitest: 1 file, 12 tests passed.
- Admin typecheck passed; API typecheck passed.
- Admin production build passed: TypeScript and 65 generated pages.
- Scoped `git diff --check` passed; only existing LF/CRLF conversion warnings were printed.
- Browser console: no error or warning entries.

## 5. Logged-in browser acceptance

Verified in the existing signed-in in-app browser at 1024x768:

- Live now: 2 rows, six semantic headers, no table/body horizontal overflow, first row fully visible.
- Needs action: 2 rows; Matching now: 1 row.
- Newest DOM order: `audit_booking_list_open_matching_booking`, then `audit_booking_list_in_service_booking`.
- Oldest DOM order: exact reverse of Newest.
- Records: `Booking records`, Last 7 days, 348 results, Newest first; live toolbar/status absent.
- No supply: 0 rows, 0 tables, 0 pagination controls, queue-specific empty message.
- Table scroll region: `role=region`, `tabindex=0`, contextual `aria-label`.
- Customer phone remained masked as `+84*****8100`.

## 6. Evidence

- Before: `output/bookings-live-queue-implementation-2026-08-05/before/`
- After: `output/bookings-live-queue-implementation-2026-08-05/after/`
- After captures: Needs action, Live now, Oldest, Matching, Records, No supply, Additional queues.

## 7. Remaining limitation

- The current signed-in in-app browser surface is fixed at 1024x768 (captured bitmap 1009x757), so a new authenticated 1440x900 after screenshot could not be produced without switching to a separate browser session. The 1440 baseline remains in `before/`; production build and desktop CSS contract passed, but exact 1440 after visual acceptance remains to be captured when the in-app pane is enlarged.
- Existing unrelated worktree changes were preserved. No commit or broad formatting was performed.
