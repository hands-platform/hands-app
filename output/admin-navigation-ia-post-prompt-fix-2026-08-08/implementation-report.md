# HANDS Admin Navigation and IA Implementation Report

Date: 2026-08-08  
Workspace: `C:\dev\massage-on-demand-vn`  
Commit: Not committed

## 1. Operator outcome

- Breadcrumbs now show section, workspace, and exact page context instead of stopping at a broad group.
- System Health appears once in the sidebar and keeps its three detailed destinations in the local workspace tabs.
- Push Send and Customer Referrals no longer repeat local-tab navigation as page-header actions.
- Global search keeps the query input fixed while only the result list scrolls. Expanding all results resets the list to its first group.
- Search and Operation Alerts return keyboard focus to their trigger after Escape.
- The payout withdrawal saved view distinguishes the risk state, the clear action, and the unfiltered payout batch list.
- Light and dark themes retain readable muted and inactive text at the supported desktop width.

## 2. Task-specific files

### Navigation and workspace context

- `apps/admin_web/lib/admin-nav-match.ts`
- `apps/admin_web/lib/admin-nav-match.spec.ts`
- `apps/admin_web/components/admin-shell-nav.tsx`
- `apps/admin_web/components/admin-shell-nav.spec.tsx`
- `apps/admin_web/components/admin-page-template.tsx`
- `apps/admin_web/components/admin-page-template.spec.tsx`
- `apps/admin_web/app/app-sessions/page.tsx`
- `apps/admin_web/app/app-sessions/page.spec.tsx`

These files centralize breadcrumb precedence, make local groups valid workspace candidates, render one System Health sidebar representative, preserve detailed search entries, normalize `/setup` to `Setup Readiness`, and keep the App Sessions page H1 aligned with its `App Session Diagnostics` navigation label.

### Search and alerts

- `apps/admin_web/components/admin-workspace-header.tsx`
- related Admin workspace header specifications
- `apps/admin_web/app/globals.css`

These changes separate search-container and result-list scrolling, reset scroll on query/all-results transitions, preserve search focus behavior, and add the Operation Alerts keyboard target calculation and focus-return contract.

### Duplicate actions and payout context

- `apps/admin_web/app/notifications/push-send/page.tsx`
- `apps/admin_web/app/notifications/push-send/page.spec.tsx`
- `apps/admin_web/app/referrals/referral-dashboard.tsx`
- `apps/admin_web/app/referrals/referral-dashboard.spec.tsx`
- `apps/admin_web/app/payouts/page.tsx`
- `apps/admin_web/app/payouts/page.spec.tsx`
- `apps/admin_web/app/payouts/payout-wallet-withdrawal-request-section.tsx`
- `apps/admin_web/app/payouts/payout-wallet-withdrawal-request-section.spec.tsx`

### Existing Admin release-gate repairs

- `apps/admin_web/app/vietnam-overview/page.tsx`
- `apps/admin_web/app/bookings/[id]/booking-detail-lifecycle-list-section.tsx`
- `apps/admin_web/app/partners/[id]/page.spec.tsx`
- `apps/admin_web/app/usage-overview/usage-overview-trend-chart.tsx`
- scoped selectors in `apps/admin_web/app/globals.css`

These are narrow repairs for the previously failing raw-surface, compact closure, current empty-copy, visible-copy false-positive, and CSS contract checks. No API, Prisma, auth, public web, or mobile app code was changed for this task.

## 3. Before and after

### Breadcrumbs

- `/referrals/customers`: `HANDS > Growth & Communications > Referrals > Customer Referrals`
- `/referrals/partners`: `HANDS > Growth & Communications > Referrals > Partner Referrals`
- `/notifications/templates`: `HANDS > Growth & Communications > Messaging > Notification Templates`
- `/notifications/push-send`: `HANDS > Growth & Communications > Messaging > Push Send`
- `/bookings/post-match-cancellations`: `HANDS > Booking Operations > Booking Closeout > Post-match Cancellations`
- `/setup`: `HANDS > Administration & Settings > System Health > Setup Readiness`
- `/app-sessions`: `HANDS > Administration & Settings > System Health > App Session Diagnostics`
- `/background-jobs`: `HANDS > Administration & Settings > System Health > Background Jobs`
- payout risk query: `HANDS > Finance Records & Close > Partner Money > Payout / Withdrawal Risk`

### System Health

- Sidebar: one `System Health` link to `/setup`.
- Local tabs: `Setup Readiness`, `App Session Diagnostics`, and `Background Jobs`.
- On `/app-sessions`, both the sidebar representative and local tab exposed `aria-current="page"` in browser verification.

### Search and alerts

- `Ctrl+K` opened search and focused the input.
- `partner` results retained group ranking with `Partner Operations` first.
- ArrowDown plus Enter opened `/partners`; ArrowUp behavior is covered by the same keyboard regression contract.
- `Show all results` kept the input visible and produced `outer overflow: hidden`, `results overflow: auto`, and `scrollTop: 0`.
- Escape returned focus to the Search trigger.
- The live alert fixture had no operation alerts; Escape still returned focus to the alert trigger. ArrowDown, ArrowUp, Home, and End are covered with populated-item fixtures in component tests.

### Payout saved view

- Status: `Risk state · Clear`.
- Action: `Clear saved view`.
- Downstream scope notice: `Other payout batches · not filtered by this saved view.`
- The existing query, selected card, and hash anchor remained intact.

## 4. Automated verification

| Command | Result |
| --- | --- |
| Targeted Admin tests from the task prompt | PASS - 8 files, 134 tests |
| Final App Session title regression test | PASS - 1 file, 4 tests |
| `npm.cmd run test --workspace @massage-vn/admin-web` | PASS - 826 files, 4,406 tests |
| `npm.cmd run typecheck --workspace @massage-vn/admin-web` | PASS |
| `npm.cmd run lint --workspace @massage-vn/admin-web` | PASS |
| `npm.cmd run admin:query-guards` | PASS - 0 violations |
| `npm.cmd run admin:visible-copy` | PASS - 1,566 files, 0 violations |
| `npm.cmd run build --workspace @massage-vn/admin-web` | PASS - 65 pages generated |
| `npm.cmd run verify:scope -- admin` | PASS |

`verify:scope` reported a review warning for protected paths already modified elsewhere in the large worktree; every Admin check in the scope summary passed. This task did not edit those protected areas.

The required Impeccable detector was run once after UI editing. It reported six `side-tab` warnings in unrelated legacy `globals.css` selectors outside this task's changed UI selectors. They were not expanded into this navigation task.

## 5. Browser verification

Browser: logged-in Codex in-app browser  
Viewport: `1692 x 1272`  
Console: 0 warnings, 0 errors

The final System Health capture confirms the page H1, breadcrumb endpoint, and selected local tab all use `App Session Diagnostics`.

Verified routes:

1. `/`
2. `/setup`
3. `/app-sessions`
4. `/background-jobs`
5. `/notifications/templates`
6. `/notifications/push-send`
7. `/referrals/customers`
8. `/referrals/partners`
9. `/bookings/post-match-cancellations`
10. `/payouts?range=all&withdrawalStatus=REVIEW_REQUIRED#partner-wallet-withdrawal-requests`

Theme contrast checks against the actual theme backgrounds:

| Text token/state | Light | Dark | Required |
| --- | ---: | ---: | ---: |
| `--admin-muted` | 5.07:1 | 6.16:1 | 4.5:1 |
| Sidebar muted token | 4.64:1 | 5.09:1 | 4.5:1 |
| Inactive workspace pill | 6.49:1 | 7.26:1 | 4.5:1 |

## 6. Evidence captures

- `C:\dev\massage-on-demand-vn\output\admin-navigation-ia-post-prompt-fix-2026-08-08\01-customer-referrals-breadcrumb.png`
- `C:\dev\massage-on-demand-vn\output\admin-navigation-ia-post-prompt-fix-2026-08-08\02-system-health-single-sidebar-and-breadcrumb.png`
- `C:\dev\massage-on-demand-vn\output\admin-navigation-ia-post-prompt-fix-2026-08-08\03-push-send-no-duplicate-action.png`
- `C:\dev\massage-on-demand-vn\output\admin-navigation-ia-post-prompt-fix-2026-08-08\04-global-search-default-results.png`
- `C:\dev\massage-on-demand-vn\output\admin-navigation-ia-post-prompt-fix-2026-08-08\05-global-search-all-results-first-group.png`
- `C:\dev\massage-on-demand-vn\output\admin-navigation-ia-post-prompt-fix-2026-08-08\06-payout-saved-view-context.png`
- `C:\dev\massage-on-demand-vn\output\admin-navigation-ia-post-prompt-fix-2026-08-08\07-dark-theme-system-health.png`
- `C:\dev\massage-on-demand-vn\output\admin-navigation-ia-post-prompt-fix-2026-08-08\09-light-theme-stable-system-health.png`

## 7. Preservation and remaining risk

- The large pre-existing dirty worktree was preserved; no reset, checkout, cleanup, commit, push, deployment, or production data mutation was performed.
- The live Operation Alerts menu contained no items, so populated-menu navigation was verified through component fixtures while Escape focus return was verified in the browser.
- The six legacy detector warnings remain outside this task. They can be considered in a separate visual-debt cleanup only after checking every owning screen.
