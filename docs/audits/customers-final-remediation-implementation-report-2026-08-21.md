# Customers final remediation implementation report

- Repository: `C:\dev\massage-on-demand-vn`
- Page: `http://localhost:3101/customers`
- Date: 2026-08-21 ICT (`Asia/Ho_Chi_Minh`)
- Desktop scope: 1440×1000 and 1980×1100; 1024px and below excluded

## 1. Outcome

The three confirmed/minimal remediation items were implemented without redesigning the Customers page or changing its API contract.

- Document metadata now composes to `Customers · HANDS Admin` instead of repeating the product name.
- The default account-created sort is labeled `Newest customers`.
- All customers no longer repeats the same sort explanation in both the panel description and result badge.
- The normal summary path performs 8 DB operations instead of 13 while returning the same real-data meaning.
- Complex non-empty customer rows have explicit render regression coverage without inserting fixtures into the production database.

No schema, migration, package, route, cache, repository layer, response contraction, permission relaxation, or mobile implementation was added.

## 2. Implemented changes

### CUS-RR-P3-01 — metadata duplication

`apps/admin_web/app/customers/page.tsx` now exports page title `Customers`. The root layout template remains `%s · HANDS Admin`, so the composed title is `Customers · HANDS Admin`.

### CUS-RR-P3-02 — sort copy duplication

- The default select option and result label now say `Newest customers`.
- Sort enum `newest`, URL omission rules, pagination reset, and API `user.createdAt desc` ordering are unchanged.
- The All customers panel description now says `Customer accounts matching the current filters.`
- Payment & review keeps its operator-action description unchanged.

### CUS-RR-P2-01 — confirmed duplicate summary work

The before path executed 7 `customerProfile.count`, 4 `customerProfile.groupBy`, and 2 `booking.count` calls: 13 DB operations.

For the normal unscoped summary request, identical predicate results are now reused:

- gender group total → `totalCount` and `viewCounts.all`
- today-joined group total → `todayJoined` and `viewCounts.newToday`
- today-seen group total → `todaySeen` and `viewCounts.activeToday`
- one needs-action count → `needsActionCount` and `viewCounts.needsAction`

The after path is 2 `customerProfile.count`, 4 `customerProfile.groupBy`, and 2 `booking.count`: 8 DB operations, a 38.5% reduction. If an external caller explicitly supplies a scoped operational `view`, separate base view counts remain in place and the tested upper bound is 12.

`listCustomers` remains at six batched DB operations. Its broad response is shared by Customers, Operations Handoff, Push account search, and CSV export, so no fields were removed and `AdminCustomerDirectoryRow` was not changed.

Detailed count evidence: [query-count-verification.md](../../output/customers-final-remediation-verification-2026-08-21/query-count-verification.md)

### CUS-RR-P3-03 — complex row regression evidence

There is no safe isolated browser fixture route in the current repository. Production customer fixtures are deliberately excluded from the directory, so no DB fixture was inserted.

`customers-table-section.spec.tsx` now renders and checks:

1. active booking plus app activity;
2. payment failure, refund request, and reported review together;
3. a long customer name with no-show and customer-cancellation history signals.

It also fixes the wrap-related CSS contracts used by those rows. Existing tests continue to cover the directory-only permission lock and absence of a detail link.

## 3. Preserved behavior and callers

- Default `Payment & review` view and explicit `All customers`
- Four operational views and filter-specific empty states
- Query/search/date/language/gender filters and server URL normalization
- Vietnam business-day boundaries using `Asia/Ho_Chi_Minh`
- Server pagination and `page=99` correction model
- `CUSTOMERS_DIRECTORY` / `CUSTOMERS_DETAIL` separation and safe `returnTo`
- Masked phone, full activity summary precedence, payment/wallet separation
- Handoff, Push account search, and CSV response consumers
- Production fixture exclusion

## 4. Verification results

| Check | Result |
| --- | --- |
| Admin Web Customers focused suite | 6 files, 46 passed |
| Admin API customer-focused suite | 2 files, 44 passed, 690 skipped by filter |
| Focused Admin Web ESLint | passed |
| Focused Admin API ESLint | passed |
| Admin Web typecheck | passed |
| API typecheck | passed |
| API production TypeScript build | passed |
| Modified-file `git diff --check` | passed |

Before-change browser evidence at 1440×1000 confirmed the duplicate title/copy and no document overflow: [00-before-all-1440x1000.png](../../output/customers-final-remediation-verification-2026-08-21/00-before-all-1440x1000.png)

Full verification notes: [verification-summary.md](../../output/customers-final-remediation-verification-2026-08-21/verification-summary.md)

## 5. Explicit limitations

- After restarting local services, the previously authenticated stored-operator browser session was no longer accepted. Repeated form login attempts reached the existing API rate limit. No session row, password, permission, or production fixture was changed to bypass this security boundary.
- Consequently, authenticated after screenshots at 1440×1000 and 1980×1100 Light/Dark are not claimed. Title/copy and complex-row results are covered by focused source/render tests instead.
- Admin Web production build was attempted through both Turbopack and webpack, but both local Windows processes stopped progressing at `Creating an optimized production build ...` without a compiler error. Admin Web typecheck, focused tests, and lint passed; production build success is not claimed.
- No p50/p95 latency claim is made. The implemented performance result is the deterministic query-count reduction with tested compatibility.

## 6. Files changed for this remediation

- `apps/admin_web/app/customers/page.tsx`
- `apps/admin_web/app/customers/page.spec.tsx`
- `apps/admin_web/app/customers/customer-filter-board.tsx`
- `apps/admin_web/app/customers/customer-filter-board.spec.tsx`
- `apps/admin_web/app/customers/customer-filters.ts`
- `apps/admin_web/app/customers/customer-filters.spec.ts`
- `apps/admin_web/app/customers/customers-table-section.tsx`
- `apps/admin_web/app/customers/customers-table-section.spec.tsx`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin.service.spec.ts`

The existing dirty worktree outside these changes was preserved. No commit was created.

## 7. Final assessment

The requested code remediation is complete. The UI changes are copy/metadata-only, the query optimization is limited to identical predicates, and all shared list consumers retain their previous contract. Release sign-off should still require one authenticated desktop browser pass and a successful Admin production build in a clean local/CI worker.
