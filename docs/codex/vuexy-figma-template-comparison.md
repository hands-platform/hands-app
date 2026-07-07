# HANDS Admin Vuexy Figma + Template Comparison

This document is the working comparison baseline for applying the purchased
Vuexy design system to HANDS Admin Web without changing HANDS business logic,
API contracts, auth/session behavior, or route ownership.

## Source Check

| Source | Path | Readable? | Used For | Notes |
| --- | --- | --- | --- | --- |
| Figma design source | `C:/dev/themeforest-moDpEy2l-vuexy-vuejs-html-laravel-admin-dashboard-template/vuexy-admin-v10.11.1/design-files/figma/vuexy-figma-dashboard-ui-kit-and-builder-v4/vuexy-figma-dashboard-ui-kit-and-builder-v4/vuexy-figma-dashboard-ui-kit-and-builder-v4.fig` | Yes | Final visual source for fundamentals, atoms, components, states, spacing, radius, shadow, typography | User-provided file exists locally. It is a ZIP package containing `canvas.fig`, `thumbnail.png`, `meta.json`, and image assets; `meta.json` identifies the file as `vuexy-figma-admin-dashboard-ui-kit`; `canvas.fig` is a `fig-kiwi` binary canvas, so use the documented Figma node map plus the local Vuexy template when direct JSON inspection is not available. Verified SHA256: `1599EFBB4CF7AFBFFD685010F6E6898762168EDBD0E06A3110EA9131A77F19BD`. |
| Figma design source, repo mirror | `C:/dev/massage-on-demand-vn/design/figma/vuexy-figma-dashboard-ui-kit-and-builder-v4.fig` | Yes, local only | Stable workspace mirror for Codex design checks | Present locally as a gitignored 167 MB binary; see `design/figma/README.md`. The repo mirror and ThemeForest source package expose the same `meta.json` identity, `vuexy-figma-admin-dashboard-ui-kit`, and the same SHA256 `1599EFBB4CF7AFBFFD685010F6E6898762168EDBD0E06A3110EA9131A77F19BD`. Do not commit copied `.fig` files unless the team explicitly approves storing large design binaries in git. |
| Vuexy Next.js TypeScript full version | `C:/dev/themeforest-moDpEy2l-vuexy-vuejs-html-laravel-admin-dashboard-template/vuexy-admin-v10.11.1/nextjs-version/typescript-version/full-version` | Yes | Implementation reference for layout, menu, cards, tables, forms, dashboard widgets, calendar, dialogs | Do not copy demo data, demo routes, demo auth, or fake APIs. |
| HANDS Admin Web | `C:/dev/massage-on-demand-vn/apps/admin_web` | Yes | Product implementation that must preserve HANDS operations behavior | Shared CSS/component wrappers remain the migration layer for now. |

## Area Gap Matrix

| Area | HANDS Current | Vuexy Template Reference | Figma Reference | Gap | Recommended Action |
| --- | --- | --- | --- | --- | --- |
| Layout | `AdminPageTemplate`, global shell, compact admin pages | `src/configs/themeConfig.ts`, vertical layout components | Layout and navigation nodes | Mostly aligned after shell work, but page-by-page density varies | Keep `AdminPageTemplate`; avoid page-local shell markup. |
| Sidebar | `admin-navigation.ts` + custom shell | `verticalMenuData.tsx`, `VerticalMenu.tsx` | Navigation | Category IA mostly HANDS-specific; count chips must be operational counts only | Continue route/menu inventory tests and keep Vuexy vertical rhythm. |
| Topbar | HANDS admin topbar with shared atoms | Vuexy navbar/floating header | Layout/navigation | Shared topbar search, icon button, icon link, badge, theme, and logout atoms are guarded | Continue visual QA only; do not change auth/session behavior. |
| Page header | Shared header in `AdminPageTemplate` | Vuexy page title/breadcrumb composition | Layout/breadcrumbs | Some legacy pages still have page-local headings | Prefer `AdminPageTemplate` header and compact breadcrumbs. |
| Breadcrumb | Available where needed | Vuexy breadcrumbs | Breadcrumbs | Not every detail page uses it consistently | Add only where it helps detail-page context. |
| Cards | `AdminSection`, `AdminCard`, page CSS cards | Vuexy card examples | Card | Some page-local cards still have custom borders/backgrounds | Replace repeated page-local card shells with `AdminSection`/shared card classes. |
| KPI cards | Shared and page-local stats | CRM/dashboard card-statistics | Cards/widgets | Metrics vary in spacing and status tone | Keep domain metrics but normalize card shell and tonal chips. |
| Tables | `AdminDataTable`, `AdminTableScroll` | React table examples, user list | Data display | Raw table elements are guarded outside the shared table atom; remaining work is page-level visual QA and pagination semantics | Use `AdminDataTable` first for every list. |
| Filters | `AdminFilterPanel`, shared control atoms | Form/select/button groups | Text field/select/buttons | Filter shells are guarded; remaining work is page-level spacing and copy hierarchy | Keep raw filters out of pages and route controls through shared form atoms. |
| Forms | `admin-form-controls.tsx`, global tokens | `@core/components/mui/TextField.tsx` | Text field/input/select atoms | Visible inputs/selects/textareas are guarded; remaining work is visual edge-state QA in finance/calendar/coupons forms | Use shared controls and no raw overlapping labels. |
| Buttons | Shared `.button` classes and icon buttons | MUI Button/IconButton usage | Buttons | Mostly aligned; page-local action buttons still appear | Use shared variants and lucide icons for tool actions. |
| Inputs | Global tokens + shared controls | CustomTextField | Text field/input atoms | Raw visible input/textarea usage is blocked by usage tests outside shared atoms | Keep new controls in `AdminFormInput`, `AdminFormTextarea`, and shared date controls. |
| Selects | Shared select exists | CustomTextField select | Select | Some page-local selects have label overlap risk | Use shared select wrapper and guard tests. |
| Badges | Pills/status classes | Chip/Badge | Chip/Badge | Multiple tone systems exist | Consolidate status tone helpers where repeated. |
| Status chips | Page-specific pills | Chip | Chip/Badge | Some status copy and colors diverge by page | Route through shared status/tone helpers. |
| Dialogs | Page-specific modal/dialog flows | `pages/dialog-examples/*`, calendar sidebar | Dialog | Services/coupons use dialog-like flows but not always one style | Normalize edit/create flows without copying demo logic. |
| Drawers | Calendar and detail flows use custom panels | Calendar event sidebar | Dialog/drawer patterns | Calendar closest to Vuexy, other drawers are ad hoc | Use calendar drawer pattern only where focused edit flow needs it. |
| Tabs | Segment controls and tabs vary | Tabs examples | Tabs | Some segmented controls are page-local | Introduce shared segmented control only after 3+ stable uses. |
| Pagination | `AdminRoundedPagination` | Pagination examples | Pagination | Long operational lists mostly covered | Keep server pagination/cursor rules. |
| Empty state | `AdminEmptyState` now broadly adopted | Empty/list fallback patterns | Alert/data display | Raw fallback patterns have been reduced; intentional labels remain | Keep source guard scans to prevent regression. |
| Loading state | Mostly route/server rendered | Progress/loading examples | Progress | Not consistently explicit on client-heavy pages | Add shared loading state where actual async UI exists. |
| Error state | Page forms have uneven feedback | Alert/snackbar | Alert/snackbar | Form failures still vary | Use shared form error/notice styles. |
| Login page | Custom Vuexy-inspired login | Auth pages | Layout/forms/buttons | Broad marketing copy removed, but visual QA should continue | Compare with Vuexy auth page at 1440px. |
| Unauthorized page | Operator access gate | Error/auth examples | Alert/error | No-permission state uses shared `AdminErrorState` | Keep route/category tests in place. |
| 404 page | Custom Admin not-found page | Error pages | Error/misc | Not-found state uses shared page/error/action atoms | Keep route inventory guard before broad page work. |
| Dashboard widgets | Dashboard/overview pages use widgets | CRM dashboards/card statistics | Widgets/cards | Usage/Partner/Finance overview are improving but still mixed | Continue page-by-page widget alignment. |
| Finance tables | Finance pages have heavy custom tables | React table + invoice/payment examples | Data display/cards | Meaning is strong, visual consistency still ongoing | Use common table, money, status, pagination components. |
| Booking tables | Booking list/detail mostly table-first | React table + user/detail/timeline | Data display/timeline | Detail sections still have some bespoke panels | Keep aligning detail sublists with `AdminDataTable`. |
| Partner/customer detail pages | Rich detail pages with many sections | User view/account detail | User view/card/tabs | Functionally rich, visually dense | Apply shared sections/tables before any layout rewrite. |

## Vuexy Template Reference Map

| Vuexy File/Folder | Purpose | Useful For HANDS? | How To Adapt | Risk |
| --- | --- | --- | --- | --- |
| `src/configs/themeConfig.ts` | Layout, content width, navbar/menu defaults | Yes | Use as token/reference only; keep HANDS CSS variables | Low |
| `src/data/navigation/verticalMenuData.tsx` | Vertical menu grouping pattern | Yes | Reference section/submenu structure; keep HANDS routes/permissions | Medium |
| `src/components/layout/vertical/VerticalMenu.tsx` | Vertical menu implementation | Yes | Reference behavior/density; do not replace HANDS shell wholesale | Medium |
| `src/@menu/styles/vertical/*` | Vertical menu styling | Yes | Map rhythm/active state into existing sidebar CSS | Low |
| `src/@core/components/mui/TextField.tsx` | Vuexy input/select baseline | Yes | Reflect sizing/state tokens in `admin-form-controls` and `globals.css` | Low |
| `src/views/pages/auth/LoginV2.tsx` | Split authentication page with left illustration and right form panel | Yes | Keep Admin login free of sidebar/topbar and avoid text overlapping the illustration | Low |
| `src/@core/components/mui/IconButton.tsx` | Icon button styling | Yes | Apply to topbar/table row/icon-only actions | Low |
| `src/@core/components/mui/Chip.tsx` | Chip/status visual model | Yes | Align pills/status chips through shared tone helpers | Low |
| `src/@core/components/mui/Avatar.tsx` | Avatar visual model | Yes | Keep person cells/status indicators consistent | Low |
| `src/views/react-table/BasicDataTables.tsx` | Data table basics | Yes | Inform `AdminDataTable` spacing/header/pagination | Low |
| `src/views/react-table/KitchenSink.tsx` | Advanced table/filtering | Yes | Reference only for richer operational tables | Medium |
| `src/views/apps/user/list` | User directory/list patterns | Yes | Customers/Partners directories | Low |
| `src/views/apps/user/view` | User detail composition | Yes | Customer/Partner detail sections | Medium |
| `src/views/apps/calendar/*` | Calendar page, sidebar, event form | Yes | Calendar page and date/time atoms | Medium |
| `src/views/apps/calendar/SidebarLeft.tsx` | Calendar sidebar filters and mini calendar layout | Yes | Reference sidebar spacing, checkbox/filter rhythm, and add-event placement | Low |
| `src/views/apps/calendar/AddEventSidebar.tsx` | Calendar event drawer form | Yes | Reference event create/edit drawer fields, date/time controls, and action row spacing | Medium |
| `src/views/apps/calendar/Calendar.tsx` | Calendar main grid/view controls | Yes | Reference FullCalendar toolbar, view switching, event rendering, and dark-mode table borders | Medium |
| `src/views/pages/dialog-examples/*` | Dialog layouts | Yes | Services/coupons/admin action dialogs | Low |
| `src/views/dashboards/crm` | Dashboard widgets | Yes | Usage/Partner/Finance overview metric and chart layout | Low |

## HANDS Page Mapping Baseline

| HANDS Page | Route | Closest Vuexy Example | Components Needed | Apply Strategy | Status |
| --- | --- | --- | --- | --- | --- |
| Command dashboard | `/` | CRM dashboard | `AdminPageTemplate`, `AdminSection`, KPI cards, empty state | Keep operations-first widgets; avoid demo dashboard data | In progress |
| Usage overview | `/usage-overview` | CRM dashboard | KPI cards, charts, segments, tables | Separate from Vietnam map; focus app behavior/funnel/retention | In progress |
| Vietnam overview | `/vietnam-overview` | Map/dashboard widgets | Map panel, metric widgets, period report tables | Map only here; period metrics below map | In progress |
| Customers | `/customers` | User list | `AdminDataTable`, person cell, filters, pagination | Use Customer directory as table baseline | In progress |
| Customer detail | `/customers/[id]` | User view | Detail sections, tables, chat/evidence panels | Keep one-column operations flow | In progress |
| Partners | `/partners` | User list | Directory table, status chips, action menu | Match customers style with partner-specific states | In progress |
| Partner detail | `/partners/[id]` | User view/account | Detail sections, KYC, services, wallet, reviews | Reuse tables/empty states/timeline where possible | In progress |
| Partner overview | `/partners/overview` | CRM/dashboard | KPI cards, funnel/quality tables | Compare with usage overview; add partner-specific flow only | In progress |
| Bookings | `/bookings` | React table/detail | Booking table, filters, status, pagination | Realtime Bookings style baseline | In progress |
| Booking detail | `/bookings/[id]` | Timeline/detail | Detail panels, chat, review/evaluation, finance evidence | Keep evidence visible without duplicate tables | In progress |
| Reviews | `/reviews` | Table/comment list | Table, moderation actions, read-only records | Customer reviews + partner evaluations separated | In progress |
| Referrals | `/referrals/*` | User/list + finance cards | Parent-only referral lists, lifecycle panels | Separate customer/partner referral pages | In progress |
| Notifications | `/notifications`, `/notifications/push-send` | Table/filter/form | Summary API, paginated lists, push form controls | Today/needs-action first; historical query filters | In progress |
| Calendar | `/calendar` | Apps calendar | Calendar shell, sidebar, date/time picker, drawer | Match Vuexy calendar and datepicker atoms | In progress |
| Services | `/services` | Dialog examples/forms | Service cards, dialog form, switch/input controls | No legacy smoke data; service catalog only | In progress |
| Coupons | `/coupons` | Dialog/table/cards | Coupon cards, form controls, booking usage table | Keep creation validation and delete/edit actions | In progress |
| Finance overview | `/finance-overview` | Dashboard/invoice widgets | KPI cards, finance status sections | High-level finance command, not ledger detail | In progress |
| Finance tax pages | `/finance-tax/*` | React table/invoice/payment | Tables, money/status/date, pagination | Preserve accounting semantics | In progress |
| Cash settlements | `/cash-settlements` | Finance/invoice table | Debt table, evidence actions, pagination | Show partner receivable/cash fee risk clearly | In progress |
| Wallet adjustments | `/wallet-adjustments` | Finance form/table | Preview, approval, ledger table | Preserve no-bank/cash movement principle | In progress |
| Admin operators | `/admin-operators` | User/list/settings | Operator list, permission chips, audit log | Master all access; operator category permissions | In progress |
| Setup | `/setup` | Settings/forms | Form controls, status cards | Keep payload bounded and operational | In progress |

## Expanded Route And Menu Coverage

The current Admin Web route scan found 68 `page.tsx` routes. The sidebar
navigation exposes 52 primary menu links. Detail pages, legacy aliases, audit
search pages, and intentionally hidden hubs are covered by
`apps/admin_web/lib/admin-hidden-route-policy.ts` instead of the sidebar.

| Area | Menu Routes | Detail / Hidden Routes | Vuexy Reference | Coverage Status |
| --- | --- | --- | --- | --- |
| Command Center | `/`, `/calendar`, `/app-sessions`, `/operations-handoff` | None | Vertical layout, Calendar app, CRM dashboard | Menu covered |
| Analytics | `/vietnam-overview`, `/usage-overview`, `/partners/overview`, `/marketing-analytics` | None | CRM dashboard widgets and map/dashboard composition | Menu covered |
| Bookings | `/bookings`, `/bookings/completed`, `/bookings/post-match-cancellations` | `/bookings/[id]` | React Table, timeline, user/detail views | Detail route intentionally hidden |
| Customers / Reviews | `/customers`, `/referrals/customers`, `/reviews`, `/reviews/partner-customer-evaluations` | `/customers/[id]`, `/referrals/customers/[id]` | User list/view and review/comment tables | Detail routes intentionally hidden |
| Partners | `/partners`, `/partners?review=unapproved`, `/partners?review=unsettled`, `/referrals/partners`, `/files` | `/partners/[id]`, `/providers`, `/providers/[id]`, `/partner-controls`, `/referrals/partners/[id]` | User list/view, file list, status chips | Provider routes are compatibility aliases; partner controls is deep evidence |
| Finance | `/finance-overview`, `/finance-closeout`, `/payments`, `/finance-tax/payment-clearing`, `/cash-settlements`, `/wallet-adjustments`, `/earnings`, `/payouts`, `/referrals/cashouts`, `/refunds` | `/payments/[id]`, `/finance-tax/payment-clearing/[id]` | Dashboard, React Table, invoice/payment examples | Detail routes intentionally hidden |
| Tax & Accounting | `/finance-tax`, `/finance-tax/general-ledger`, `/finance-tax/bank-reconciliation`, `/finance-tax/company-bank-accounts`, `/finance-tax/booking-settlement-audit`, `/finance-tax/coupon-finance`, `/finance-tax/settlement-reversals`, `/finance-tax/monthly-tax-closing`, `/finance-tax/platform-vat`, `/finance-tax/partner-withholding-tax`, `/finance-tax/payment-fees`, `/tax-policy` | `/finance-tax/general-ledger/[id]`, `/finance-tax/bank-reconciliation/[id]`, `/finance-tax/booking-settlement-audit/[id]`, `/finance-tax/settlement-reversals/[id]` | React Table, dashboard cards, finance/detail pages | Detail routes intentionally hidden |
| Communications | `/notifications`, `/notifications/templates`, `/notifications/push-send` | None | Table/filter/form and campaign dashboard patterns | Menu covered |
| Policies & Setup | `/operations-policy`, `/services`, `/coupons`, `/setup` | None | Settings/forms, dialog examples, card lists | Menu covered |
| Admin Control | `/admin-operators`, `/finance-tax/finance-approvers`, `/audit-log` | `/chat-archive`, `/login`, `/referrals` | User/list/settings, audit table, auth pages | Login is auth boundary; chat archive and referral hub intentionally hidden |

When a route is not in the menu, it must either be documented in
`admin-hidden-route-policy.ts` or added to the sidebar intentionally. Future
route/menu inventory changes should update this section and the hidden-route
policy together.

## Immediate Implementation Direction

1. Keep tightening shared atoms before page-specific redesigns:
   `AdminEmptyState`, form controls, status chips, table wrappers,
   pagination, money/date rendering.
2. Treat Finance, Bookings, Customers, Partners, and Notifications as protected
   operational pages: visual refactors must not change API response shape or
   accounting/booking semantics.
3. Use source guards where possible to stop regression to raw page-local
   empty/error/form patterns.
4. Run focused component/page tests and Admin Web typecheck for each commit.
