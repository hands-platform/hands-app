# HANDS Admin Vuexy Source Comparison Report

Date: 2026-07-06

This report locks the design source comparison requested before the next broad
Vuexy application pass. It compares the current HANDS Admin structure, the local
Vuexy Next.js TypeScript full-version template, and the local Figma `.fig`
package. It does not change HANDS business behavior.

## Source Check

| Source | Path | Readable? | Used For | Notes |
| --- | --- | --- | --- | --- |
| HANDS Admin Web | `C:/dev/massage-on-demand-vn/apps/admin_web` | Yes | Existing routes, shell, shared components, API bindings, auth/session guard, CSS tokens | 68 page routes were found under `app/**/page.tsx`. |
| HANDS Vuexy design contract | `C:/dev/massage-on-demand-vn/docs/architecture/admin-vuexy-design-system.md` | Yes | Local implementation contract and Figma node inventory | Already references Figma nodes, local Vuexy template paths, and atom tokens. |
| Working goal | `C:/dev/massage-on-demand-vn/docs/codex/vuexy-admin-design-goal.md` | Yes | Acceptance criteria for the active design goal | Common components first; preserve business/API behavior. |
| Requested repo-local Figma path | `C:/dev/massage-on-demand-vn/design/figma/vuexy-figma-dashboard-ui-kit-and-builder-v4.fig` | No | N/A | Attachment names this path, but it is not present in the repo. |
| Available Figma source package | `C:/dev/themeforest-moDpEy2l-vuexy-vuejs-html-laravel-admin-dashboard-template/vuexy-admin-v10.11.1/design-files/figma/vuexy-figma-dashboard-ui-kit-and-builder-v4/vuexy-figma-dashboard-ui-kit-and-builder-v4/vuexy-figma-dashboard-ui-kit-and-builder-v4.fig` | Yes | Final visual source package | Zip package containing `canvas.fig`, `thumbnail.png`, `meta.json`, and image assets. `meta.json` file name is `vuexy-figma-admin-dashboard-ui-kit`. |
| Vuexy Next.js TypeScript full-version | `C:/dev/themeforest-moDpEy2l-vuexy-vuejs-html-laravel-admin-dashboard-template/vuexy-admin-v10.11.1/nextjs-version/typescript-version/full-version` | Yes | Implementation examples for layout, navigation, cards, tables, forms, calendar, auth/error pages | Commercial template reference only; do not copy demo auth, data, API, or routes. |
| Local Figma captures | `C:/dev/massage-on-demand-vn/docs/assets/vuexy-figma/*.png` | Yes | Fast visual checks for text field, buttons, inputs, navigation, data display | Useful when direct `.fig` canvas parsing is not practical. |

## Area Comparison

| Area | HANDS Current | Vuexy Template Reference | Figma Reference | Gap | Recommended Action |
| --- | --- | --- | --- | --- | --- |
| Layout | `AdminRootShell`, semi-dark fixed sidebar, compact page content | `src/configs/themeConfig.ts`, `src/components/layout/vertical/*` | Layout + Navigation | Mostly aligned; HANDS keeps its own auth/session and operational IA | Keep HANDS shell. Continue matching compact 1440px content, fixed sidebar, 24px padding. |
| Sidebar | `admin-navigation.ts` grouped into operational sections | `src/data/navigation/verticalMenuData.tsx` and `VerticalMenu.tsx` | Navigation | Stronger operational grouping than Vuexy demo; valid for HANDS | Keep current groups; use Vuexy icon/chip behavior only for true attention counts. |
| Topbar | `AdminWorkspaceHeader` with search/theme/logout | `Navbar.tsx`, `NavbarContent.tsx`, shared dropdowns | Navigation / Layout | Close but still HANDS-custom | Continue checking icon-only actions, tooltip labels, and spacing against Vuexy. |
| Page header | `AdminPageTemplate` / `.toolbar.admin-page-header` | Dashboard and app page headers | Layout | Many pages use it; some older pages still use local toolbar markup | Prefer `AdminPageTemplate` and `AdminSectionHeader` for new edits. |
| Breadcrumb | Mostly omitted; detail links and summary rails are used | Vuexy breadcrumb examples | Breadcrumbs | Intentional compact ops choice | Add only where detail context is confusing; avoid duplicating sidebar labels. |
| Cards | `AdminCard`, `AdminSection`, `AdminKpiCard`, metric cards | CRM dashboard cards, user/detail cards | Card | Generally aligned; older setup-stage blocks still appear in many domains | Convert repeated non-setup lists only when a shared card/timeline/list improves scanning. |
| KPI cards | `AdminMetricGrid`, `MetricCard`, `AdminOverviewCard` | `src/views/dashboards/crm/*` | Card / Data Display | Good foundation; individual dashboards still vary | Keep dashboard metric cards constrained and avoid decorative marketing cards. |
| Tables | `AdminDataTable`, `AdminTableScroll`, pagination footer | `src/views/react-table/*`, app list pages | Data Display / Pagination | Main lists mostly aligned; some detail tables still have bespoke rows | Continue replacing long bespoke lists with `AdminDataTable` when rows are tabular. |
| Filters | `AdminFilterPanel`, filter chip group, form atoms | User/list, React Table filters | Text Field / Select / Buttons | Good shared surface; some pages still have custom segmented controls | Keep filters server-bounded and use shared form/button atoms. |
| Forms | `AdminFormInput`, `AdminFormSelect`, `AdminFormDate`, `AdminFormTextarea` | `src/@core/components/mui/TextField.tsx` | Text Field / Input / Select | Recent pass moved visible labels to Vuexy label-outside model | Continue verifying textarea, date picker, and select adornment spacing in edited pages. |
| Buttons | `.button`, `AdminFormControlButton`, `AdminFormControlLink` | MUI Button/IconButton examples | Buttons | Legacy `btn-*` usage has been removed from non-test source except compatibility map | Keep `button-*` tones; phase out compatibility map only after all source is stable. |
| Inputs | Shared atom CSS in `globals.css` | `CustomTextField` | Text Field / Inputs | Core input/select/date atoms now use Vuexy height, radius, focus shadow | Add visual smoke on finance and calendar surfaces after future changes. |
| Selects | `AdminFormSelect` and native arrow CSS | `CustomTextField select` | Select | Aligned at small control rhythm; native select remains by design | Keep shared select wrapper; do not add MUI dependency without approval. |
| Badges | `StatusBadge`, `AdminSignal`, role badges | `Chip.tsx`, `Badge.tsx` | Badge / Chip | Strong shared component exists; many domain classes still use pill naming | Treat `StatusBadge` as public API. Rename CSS only when low-risk. |
| Status chips | `StatusBadge` tones map to `.pill-*` | Vuexy Chip | Chip / Badge | Visual class name is legacy but componentized | Keep component interface; avoid raw span chips in new code. |
| Dialogs | `ConfirmDialog`, dialog cards, page forms | Dialog examples | Dialog | Functional, not full MUI dialog | Keep HANDS modal behavior. Apply Vuexy spacing/radius through shared CSS. |
| Drawers | Calendar drawer pattern in `calendar-event-drawer.tsx` | `views/apps/calendar/AddEventSidebar.tsx` | Dialog / Drawer-like app pattern | Calendar drawer is the main drawer-like surface | Continue matching date/time, buttons, sidebar spacing to Vuexy Calendar. |
| Tabs | Segmented controls and filter chip groups | `TabList.tsx` | Tabs | Calendar and dashboards use custom tabs | Keep shared segmented controls; avoid per-page tab styling. |
| Pagination | `AdminRoundedPagination` and table footer | React Table pagination | Pagination | Present on major long lists | Keep pagination server-backed where possible; no infinite full-list loads. |
| Empty state | `AdminEmptyState`, `AdminLoadingState`, `AdminErrorState` | App list empty/error states | Alert / Data Display | Shared components exist; page coverage varies | Add only when touching a page without clear empty/error feedback. |
| Loading state | `AdminLoadingState` | Progress/loading examples | Progress / Alert | Mostly server-rendered pages, fewer loading states | Use when client panels fetch async data. |
| Error state | `AdminErrorState`, inline notices | Alert / Snackbar | Alert | Shared components exist; page coverage varies | Prefer actionable message and recovery link/button. |
| Login page | Custom HANDS login page | `src/views/Login.tsx`, auth app routes | Auth pages | Already simplified per user requests; needs visual smoke against Vuexy login reference | Keep no sidebar/topbar. Preserve session policy. |
| Unauthorized page | Access gate components and middleware redirects | `NotAuthorized.tsx` | Error pages | Functional but less visually checked | Add a targeted visual pass when auth pages are next in scope. |
| 404 page | Next fallback / not-found usage not deeply reviewed in this pass | `NotFound.tsx` | Error pages | Needs a focused pass | Keep as P2 unless broken. |
| Dashboard widgets | `/`, `/usage-overview`, `/partners/overview`, `/finance-overview`, `/vietnam-overview` | `views/dashboards/crm/*` | Dashboard widgets | Strong progress; dashboard widgets still differ by page | Continue consolidating card, chart, table rhythm while preserving HANDS data meaning. |
| Finance tables | `finance-tax/*`, `finance-overview`, `payments`, `payouts`, `wallet-adjustments` | table + dashboard cards | Data Display / Tables | Many pages are now table-first; Finance is the highest-risk area | Keep finance meaning explicit: gross, platform fee, VAT/PIT, payable, wallet liability, receivable. |
| Booking tables | `/bookings`, `/bookings/completed`, details | React Table / user view / timeline | Data Display / Timeline | Mature but large; avoid behavior changes | Continue only small visual/formatter/component passes. |
| Partner/customer detail pages | `/customers/[id]`, `/partners/[id]` | user view/profile pages | Layout / List / Avatar / Timeline | Highly feature-rich; risk of over-carded sections | Prefer detail rails, timelines, and bounded tables; no CRM simplification. |

## Vuexy Template Reference Map

| Vuexy File/Folder | Purpose | Useful For HANDS? | How To Adapt | Risk |
| --- | --- | --- | --- | --- |
| `src/configs/themeConfig.ts` | Compact layout, padding, content width, navbar behavior | Yes | Mirror values through CSS/layout tokens, not Vuexy config import | Low |
| `src/components/layout/vertical/*` | Vertical shell, navbar, menu, footer | Yes | Use as spacing/behavior reference for HANDS shell | Medium if copied directly; keep HANDS auth/session. |
| `src/data/navigation/verticalMenuData.tsx` | Menu sections, icons, suffix chips | Yes | Inform HANDS sidebar grouping and attention-count chips | Low |
| `src/@core/components/mui/TextField.tsx` | TextField/select sizes and focus states | Yes | Already mapped into shared Admin form CSS tokens | Low |
| `src/@core/components/mui/IconButton.tsx` | Icon button dimensions/states | Yes | Use for topbar, row actions, map controls, chat close buttons | Low |
| `src/@core/components/mui/Chip.tsx`, `Badge.tsx`, `Avatar.tsx` | Status chips, badges, avatar treatment | Yes | Continue using `StatusBadge`, `RoleBadge`, `AdminPersonCell` | Low |
| `src/@core/components/mui/TabList.tsx` | Tab/segmented control behavior | Yes | Map into `AdminSegmentedControl` and calendar view switcher | Low |
| `src/views/react-table/*` | Data table density, filtering, pagination examples | Yes | Map visual rhythm into `AdminDataTable`; do not import TanStack demo data | Medium |
| `src/views/apps/user/list`, `src/views/apps/user/view` | User list/detail composition | Yes | Use for Customers/Partners visual model | Medium; HANDS data is more operational. |
| `src/views/apps/calendar/*` | Calendar sidebar, calendar canvas, add-event drawer | Yes | Keep FullCalendar behavior but match Vuexy side panel/drawer atoms | Medium |
| `src/views/pages/dialog-examples/*` | Dialog spacing and form action layouts | Yes | Use for focused create/edit forms such as services/coupons/admin actions | Low |
| `src/views/dashboards/crm/*` | Dashboard cards, charts, activity timeline | Yes | Use as visual reference for overview pages | Medium; charts must show HANDS aggregates only. |
| `src/views/Login.tsx`, `NotAuthorized.tsx`, `NotFound.tsx` | Auth/error page composition | Yes | Visual reference only; preserve HANDS session and login policy | Medium |
| `src/components/layout/shared/search/*` | Global search/dropdown behavior | Partial | Use only if Admin global search becomes functional across entities | Medium |

## HANDS Page Mapping

| HANDS Page | Route | Closest Vuexy Example | Components Needed | Apply Strategy | Status |
| --- | --- | --- | --- | --- | --- |
| Command dashboard | `/` | CRM dashboard | `AdminPageTemplate`, KPI cards, action cards, timeline | Keep today-first command layout; reduce per-page styling | In progress |
| Calendar | `/calendar` | Apps Calendar | Calendar sidebar, drawer, date picker, button atoms | Continue matching Vuexy calendar/drawer/date styling | In progress |
| App Presence | `/app-sessions` | User/list + dashboard cards | Data table, filter panel, status chips | Keep bounded app session records | In progress |
| Handoff | `/operations-handoff` | Timeline + form | AdminFormTextarea, timeline/list cards | Preserve shift-note workflow | In progress |
| Vietnam Overview | `/vietnam-overview` | Dashboard map/widget composition | Map panel, KPI widgets, period tables | Keep map only here; no duplicate with Usage Overview | In progress |
| Usage Overview | `/usage-overview` | CRM dashboard | Funnel/retention widgets, tables | Keep customer usage behavior and app pattern analytics | In progress |
| Partner Overview | `/partners/overview` | CRM dashboard + user/list | Supply health widgets, issue queues | Match Usage Overview density | In progress |
| Marketing Analytics | `/marketing-analytics` | CRM dashboard | Acquisition widgets, tables | Keep attribution/cost explicit | In progress |
| All Bookings | `/bookings` | React Table + app list | Booking table, filters, row actions | Maintain realtime booking operations | In progress |
| Completed Bookings | `/bookings/completed` | React Table | Booking table, pagination | Align with Realtime Bookings table rhythm | In progress |
| Post-match Cancellations | `/bookings/post-match-cancellations` | React Table | Booking table, filters, chips | Keep cancellation/no-show evidence | In progress |
| Booking Detail | `/bookings/[id]` | User view + timeline | Detail rail, chat, finance, timeline | Preserve dense operations detail | In progress |
| Customers | `/customers` | User/list | Directory table, filters, avatar cell | Customer directory is current table baseline | In progress |
| Customer Detail | `/customers/[id]` | User view | Detail rail, booking/review/chat sections | Avoid duplicate CRM noise | In progress |
| Customer Referrals | `/referrals/customers` | User/list + table | Referral parent table, status chips | Keep only parents with referral activity | In progress |
| Customer Referral Detail | `/referrals/customers/[id]` | User view | Referral detail sections | Detail-only route | In progress |
| Customer Reviews | `/reviews` | Review/comment table | Review table, moderation actions | Use common table style | In progress |
| Partner Evaluations | `/reviews/partner-customer-evaluations` | Review/comment table | Read-only evaluation table | Keep no publish/hide workflow | In progress |
| Partners | `/partners` | User/list | Partner directory table, KYC chips | Shared customer/partner table model | In progress |
| Partner Detail | `/partners/[id]` | User view | Approval/KYC/services/reviews/wallet sections | Maintain operational approval detail | In progress |
| Provider Alias | `/providers`, `/providers/[id]` | N/A | Redirect/alias only | Keep hidden compatibility alias | Intentional hidden |
| Files | `/files` | File manager/list | Table, filters, file state chips | Partner file moderation | In progress |
| Partner Referrals | `/referrals/partners` | User/list | Referral parent table | Separate from customer referrals | In progress |
| Partner Referral Detail | `/referrals/partners/[id]` | User view | Referral lifecycle detail | Detail-only route | In progress |
| Finance Overview | `/finance-overview` | CRM dashboard | Finance widgets, filter atoms | Keep gross/revenue/payable/tax distinctions | In progress |
| Finance Closeout | `/finance-closeout` | Dashboard + timeline | Closeout action cards | Keep daily/weekly/monthly/manual closeouts | In progress |
| Payments | `/payments` | Table/list | Payment table, gateway state chips | Preserve payment/refund state | In progress |
| Payment Detail | `/payments/[id]` | Detail page | Payment timeline/action cards | Detail-only route | In progress |
| Payment Clearing | `/finance-tax/payment-clearing` | React Table | Clearing list, filters, pagination | Finance table style | In progress |
| Payment Clearing Detail | `/finance-tax/payment-clearing/[id]` | Detail page | Clearing evidence detail | Detail-only route | In progress |
| Cash Debt | `/cash-settlements` | Table + queue cards | Open debt table, action cards | Preserve partner wallet debt risk | In progress |
| Wallet Adjustments | `/wallet-adjustments` | Form + table | Preview form, history table | Preserve accounting preview and approval gates | In progress |
| Earnings | `/earnings` | Table/list | Earning rows, payout queues | Preserve Partner earning source | In progress |
| Payouts | `/payouts` | Table/list | Payout batch table, queue sections | Preserve payout guard/evidence | In progress |
| Referral Cashouts | `/referrals/cashouts` | Table/list | Cashout queue table | Keep referral payout/tax review | In progress |
| Refunds | `/refunds` | Table/list | Refund queue table | Preserve reversal/refund evidence | In progress |
| Tax Overview | `/finance-tax` | Dashboard | Tax command widgets | Keep tax/fee/VAT/PIT separate | In progress |
| General Ledger | `/finance-tax/general-ledger` | React Table | Journal table, filters, pagination | Finance table style | In progress |
| General Ledger Detail | `/finance-tax/general-ledger/[id]` | Detail page | Journal entry detail | Detail-only route | In progress |
| Bank Reconciliation | `/finance-tax/bank-reconciliation` | Table + forms | Bank transaction table, match forms | Keep no bank API assumption | In progress |
| Bank Transaction Detail | `/finance-tax/bank-reconciliation/[id]` | Detail page | Match/evidence forms | Detail-only route | In progress |
| Company Bank Accounts | `/finance-tax/company-bank-accounts` | Settings table/form | Bank account table/form | Keep finance admin controlled | In progress |
| Booking Settlement Audit | `/finance-tax/booking-settlement-audit` | Table/detail | Settlement snapshot table | Immutable settlement evidence | In progress |
| Settlement Audit Detail | `/finance-tax/booking-settlement-audit/[id]` | Detail page | Snapshot detail | Detail-only route | In progress |
| Coupon Finance | `/finance-tax/coupon-finance` | Table/dashboard | Coupon finance rows | Preserve funding source/tax impact | In progress |
| Settlement Reversals | `/finance-tax/settlement-reversals` | Table/list | Reversal table | Closed-period reversal evidence | In progress |
| Settlement Reversal Detail | `/finance-tax/settlement-reversals/[id]` | Detail page | Reversal detail | Detail-only route | In progress |
| Monthly Tax Closing | `/finance-tax/monthly-tax-closing` | Settings/table | Closeout forms/tables | Recent form atom pass applied | In progress |
| Platform VAT | `/finance-tax/platform-vat` | Table/dashboard | VAT buckets/table | Keep platform fee VAT only | In progress |
| Partner Withholding Tax | `/finance-tax/partner-withholding-tax` | Table/dashboard | VAT/PIT table | Keep Partner withholding lifecycle | In progress |
| Payment Fees | `/finance-tax/payment-fees` | Table/dashboard | Fee policy/fee rows | Keep method-specific processing fees | In progress |
| Tax Policy | `/tax-policy` | Settings form/table | Versioned policy forms | Preserve policy versioning | In progress |
| Notifications | `/notifications` | Table/list | Today/Needs action delivery table | Keep large-data friendly defaults | In progress |
| Notification Templates | `/notifications/templates` | Form/list | Language template forms | Preserve language-specific edits | In progress |
| Push Send | `/notifications/push-send` | Form + campaign table | Recipient filters, preview, campaign history | Keep no silent send failures | In progress |
| Operations Policy | `/operations-policy` | Settings form | Policy form cards | Preserve booking/matching policy | In progress |
| Service Catalog | `/services` | Dialog/form/list | Service cards, option forms | Preserve multilingual names and payout rules | In progress |
| Coupons | `/coupons` | Dialog/form/list | Coupon form, usage table | Preserve validation/delete/edit | In progress |
| Setup | `/setup` | Settings/checklist | Readiness cards/list | Keep integration readiness | In progress |
| Admin Operators | `/admin-operators` | User/list + settings form | Operator list, permissions, audit | Preserve master/operator access policy | In progress |
| Finance Approvers | `/finance-tax/finance-approvers` | Settings form/table | Approver setup | Recent button tone pass applied | In progress |
| Audit Log | `/audit-log` | Timeline/table | Audit table, filters | Keep retained evidence trail | In progress |
| Chat Archive | `/chat-archive` | Chat/list | Audit search page | Intentionally hidden from sidebar | Intentional hidden |
| Partner Controls | `/partner-controls` | Detail/action cards | Deep evidence page | Intentionally hidden from sidebar | Intentional hidden |
| Login | `/login` | Login page | Login form | No sidebar/topbar; preserve session policy | In progress |

## Immediate Design Work Queue

P0/P1 work should remain small and testable:

1. Keep shared Atom CSS as the first edit surface: buttons, text fields, selects,
   textareas, checkboxes, date/date-time pickers, chips, pagination.
2. Keep route/menu inventory and hidden-route policy tests green before moving
   high-risk finance or auth pages.
3. Use `AdminDataTable`, `AdminFilterPanel`, `AdminSection`, `StatusBadge`,
   `MoneyText`, and `DateTimeText` before page-specific markup.
4. Do not add MUI or copy Vuexy demo route/data/auth. If MUI migration is ever
   needed, make it a separate approved task.
5. Prioritize Finance/Tax, Bookings, Customers, Partners, Notifications, and
   Calendar visual smoke because they are the densest operational surfaces.

## Known Gaps To Track

| Gap | Impact | Next Action |
| --- | --- | --- |
| Requested repo-local Figma path is missing | Future agents may look in the wrong path | Either copy/link the `.fig` into `design/figma/` or keep this report and design contract pointing at the available template path. |
| Many pages still use legacy domain CSS names such as `setup-stage-list` outside Setup | Visuals work, but naming makes future maintenance harder | Rename only when touching a page and after tests cover output; do not churn all pages at once. |
| Raw `pill-*` CSS remains as the visual layer under `StatusBadge` | Class name is legacy, but component interface is stable | Keep for now; prefer `StatusBadge` in source. |
| Some detail pages are very dense and still mix card/list/timeline patterns | Operator scanning can suffer if everything is equally prominent | Convert only repeated patterns to shared detail/list components. |
| 404/Unauthorized visual pass not recently verified | Lower operational risk, but part of full Vuexy acceptance | Schedule after protected finance/auth tests are stable. |

## Verification Baseline

This report was created after confirming:

- Current branch: `develop`.
- Working tree was clean before this report file was added.
- Figma package is readable at the available template path and contains
  `canvas.fig`, `thumbnail.png`, `meta.json`, and image assets.
- HANDS Admin has 68 `page.tsx` routes.
- Sidebar navigation has 52 primary menu links.
- Hidden/alias/detail routes are documented in
  `apps/admin_web/lib/admin-hidden-route-policy.ts`.

