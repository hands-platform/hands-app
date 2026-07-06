# HANDS Admin Vuexy Design Goal

This is the Codex working goal for applying the Vuexy design system to HANDS
Admin Web. It complements `docs/architecture/admin-vuexy-design-system.md`.

## Objective

Apply the Vuexy visual system across every HANDS Admin Web page while preserving
HANDS business rules, API contracts, auth/session behavior, routing, and data
ownership.

## Source Priority

1. HANDS MVP authority and current product behavior.
2. Figma source file:
   `C:/dev/themeforest-moDpEy2l-vuexy-vuejs-html-laravel-admin-dashboard-template/vuexy-admin-v10.11.1/design-files/figma/vuexy-figma-dashboard-ui-kit-and-builder-v4/vuexy-figma-dashboard-ui-kit-and-builder-v4/vuexy-figma-dashboard-ui-kit-and-builder-v4.fig`
3. Vuexy Next.js TypeScript full-version implementation:
   `C:/dev/themeforest-moDpEy2l-vuexy-vuejs-html-laravel-admin-dashboard-template/vuexy-admin-v10.11.1/nextjs-version/typescript-version/full-version`
4. Existing HANDS Admin shared components and CSS tokens.

## Source Confirmation

| Source | Path | Readable? | Used For | Notes |
| ------ | ---- | --------- | -------- | ----- |
| Figma source package | `C:/dev/themeforest-moDpEy2l-vuexy-vuejs-html-laravel-admin-dashboard-template/vuexy-admin-v10.11.1/design-files/figma/vuexy-figma-dashboard-ui-kit-and-builder-v4/vuexy-figma-dashboard-ui-kit-and-builder-v4/vuexy-figma-dashboard-ui-kit-and-builder-v4.fig` | Yes | Final visual standard for Fundamentals, Components, Misc, Atoms, spacing, radius, shadows, and light/dark behavior. | The `.fig` package exposes `meta.json`, `thumbnail.png`, `canvas.fig`, and image assets. `canvas.fig` is not a direct JSON design-token source, so implementation details are cross-checked against the Vuexy template. |
| Vuexy Next.js TypeScript full version | `C:/dev/themeforest-moDpEy2l-vuexy-vuejs-html-laravel-admin-dashboard-template/vuexy-admin-v10.11.1/nextjs-version/typescript-version/full-version` | Yes | Implementation reference for layout, menu/topbar, cards, forms, tables, datepicker, auth/error pages, dark/light mode, and component composition. | Use patterns selectively. Do not copy demo data, fake auth, routes, API, or business logic. |
| Repo-local Figma copy requested by design note | `C:/dev/massage-on-demand-vn/design/figma/vuexy-figma-dashboard-ui-kit-and-builder-v4.fig` | Yes, local only | Stable workspace mirror for Codex design checks. | The file is present locally and `design/figma/*.fig` is gitignored so the 167 MB binary is not committed. Keep the ThemeForest source path and this repo mirror in sync; do not add `.fig` binaries to git unless explicitly approved. |

## HANDS / Vuexy / Figma Gap Baseline

| Area | HANDS Current | Vuexy Template Reference | Figma Reference | Gap | Recommended Action |
| ---- | ------------- | ------------------------ | --------------- | --- | ------------------ |
| Layout | Custom App Router shell with shared admin CSS tokens. | `src/@layouts`, `src/components/layout`, `src/app/[lang]/(dashboard)` | Dashboard builder pages and layout frames. | Mostly aligned structurally, but page spacing can drift when page-local sections bypass shared shells. | Keep routing/business logic, continue moving page surfaces into `AdminPageTemplate`, `AdminSection`, and shared cards. |
| Sidebar | HANDS-specific navigation and permissions. | `src/navigation`, `src/@menu`, vertical layouts. | Vertical menu atoms and semi-dark examples. | Menu taxonomy is HANDS-specific and should not become Vuexy demo navigation. | Use Vuexy density, icons, active state, badges, and fixed sidebar behavior while preserving HANDS category permissions. |
| Topbar | HANDS topbar, breadcrumbs, logout/session controls. | Navbar and layout components under `src/@layouts` and examples. | Navbar/header atoms. | Shared search, icon button, icon link, theme, badge, logout, and breadcrumb atoms are guarded. | Continue using shared topbar atoms, icon-only logout, breadcrumbs, and protected-session flow. |
| Page header | Shared page header exists across many pages. | Dashboard/page examples. | Typography and breadcrumb/header frames. | Some older pages still include local header copy or extra wrappers. | Prefer `AdminPageTemplate` and consistent title/breadcrumb/action slot. |
| Breadcrumb | Implemented through Admin shell. | Vuexy navbar/page header examples. | Breadcrumb atoms. | Needs route/menu inventory guard to prevent drift. | Keep breadcrumb generation tied to navigation metadata. |
| Cards | Shared `AdminSection`, `AdminCard`, KPI surfaces. | Card and widget examples in `src/views`. | Card/widget atoms. | Some page-local cards still duplicate border/background/padding. | Replace 3+ repeated local card patterns with shared surfaces. |
| KPI cards | Present on overview/finance pages. | Analytics/CRM/ecommerce widgets. | Dashboard widgets. | Direction is good; finance/customer/partner numbers need strict money/date/status atoms. | Continue rendering values through `MoneyText`, shared number/date atoms, and status badges. |
| Tables | `AdminDataTable` is the enforced table shell for Admin Web TSX. | MUI table examples, data grids, list pages. | Table atoms and data-display frames. | Raw `table`/`thead`/`tbody` elements are guarded outside the shared table atom; remaining work is visual QA and pagination semantics. | Keep all new table surfaces on `AdminDataTable`; preserve server pagination and bounded result sets. |
| Filters | Shared form controls and segmented controls exist. | Form layout/filter examples. | Inputs/select/date picker atoms. | Native date inputs are centralized but true datepicker popovers only exist on calendar flows. | Keep native date inputs behind shared atoms; use Vuexy react-datepicker skin where a popover calendar is used. |
| Forms | `AdminFormInput`, `AdminFormSelect`, `AdminFormDate`, `AdminFormTextarea`, buttons. | `CustomTextField`, MUI forms, ReactDatepicker wrapper. | Atoms for inputs, selects, textarea, checkbox, datepicker. | Visible input/select/textarea usage is guarded through shared atoms; remaining work is visual QA and edge-state polish. | Update shared Atom CSS first, then page tests. |
| Buttons | Shared button/link atoms with Vuexy tones. | MUI button examples. | Button atoms. | Mostly aligned; page-local raw buttons are guarded. | Continue enforcing through usage tests. |
| Inputs | Shared input atoms with Vuexy label model. | `CustomTextField` and form examples. | Input atoms. | Native date/time picker popup cannot be fully styled by CSS; wrapper is aligned and guarded. | Use ReactDatepicker for interactive calendar popovers; keep native fields behind shared atoms for compact submit forms. |
| Selects | Shared select atoms. | MUI select/text-field examples. | Select atoms. | Mostly aligned. | Keep select arrow/end-adornment rules centralized. |
| Badges | Shared status badge exists. | Chip/status examples. | Badge/chip atoms. | Some domain statuses need tone mapping completeness. | Add status/tone tests when touching domain pages. |
| Status chips | Shared `StatusBadge`. | Chip examples. | Chip atoms. | Finance/booking/customer/partner tone semantics must stay domain-specific. | Use shared atom with domain tone helpers. |
| Dialogs | Several dialogs/forms use shared controls. | Dialog examples. | Dialog/modal frames. | Some flows still need consistent footer/actions. | Consolidate dialog footer/action atoms when repeated. |
| Drawers | Calendar event drawer and detail panels exist. | Drawer/sidebar examples. | Drawer/application frames. | Calendar drawer is the current reference point. | Keep drawer form controls on shared atoms. |
| Tabs | Segmented/tabs exist. | MUI tabs and app examples. | Tabs atoms. | Page-local tab/button patterns should stay in shared segmented control. | Continue replacing raw tab groups. |
| Pagination | Shared rounded pagination exists. | Table pagination examples. | Pagination atoms. | Some lists still need server-backed pagination or bounded fetch. | Use server pagination/cursor first, then visual atom. |
| Empty state | Shared empty/error surfaces exist. | Empty/list examples. | Empty state atoms. | Coverage varies by page. | Add empty/error states while touching each page. |
| Loading state | Server pages mostly render synchronously; client pages vary. | Skeleton/loading examples. | Loading atoms. | Some heavy client views need clearer loading states. | Add page-specific loading only when data fetch is async/client-side. |
| Error state | Shared inline notice/surface patterns exist. | Alert/error examples. | Alert atoms. | Older pages may surface terse errors. | Use shared notice/error component and actionable copy. |
| Login page | Vuexy-style protected login was applied. | Auth pages. | Login/auth frames. | Must remain HANDS session based, not Vuexy demo auth. | Keep visual matching without adding demo auth. |
| Unauthorized page | Protected route/session flow exists. | Error/auth examples. | Error pages. | Operator access denied state is rendered through `AdminErrorState` and guarded. | Keep operator permission errors clear and linked to session. |
| 404 page | Custom Admin `not-found` state exists. | Error examples. | Error pages. | Not-found state is rendered through `AdminPageTemplate`, `AdminErrorState`, and shared action link atoms. | Prefer route inventory test before broad page work. |
| Dashboard widgets | Usage/Partner/Finance/Vietnam overview widgets exist. | CRM/analytics dashboards. | Dashboard widgets. | Some pages still mix summary and list data heavily. | Split summary/list APIs where payload is heavy; keep widget visuals shared. |
| Finance tables | Extensive finance pages exist. | Invoice/payment/table examples. | Table/card/form atoms. | High semantic risk: money categories must never be visually or logically conflated. | Use `MoneyText`, explicit labels, settlement audit tests, and server pagination. |
| Booking tables | Booking tables and details exist. | App/table/detail examples. | Tables/application frames. | Needs continued `AdminDataTable` consistency. | Preserve booking state semantics and realtime monitor behavior. |
| Partner/customer detail pages | Large operational profiles exist. | User profile/list/view examples. | Profile/detail/application frames. | Rich data can become visually dense and inconsistent. | Keep using shared tables, review/chat atoms, money/date/status atoms. |

## Vuexy Template Reference Map

| Vuexy File/Folder | Purpose | Useful For HANDS? | How To Adapt | Risk |
| ----------------- | ------- | ----------------- | ------------ | ---- |
| `src/@layouts` | Dashboard shell, vertical/horizontal layout composition. | Yes | Borrow spacing and structure only; keep HANDS protected shell and route policy. | Medium |
| `src/@menu` and `src/navigation` | Menu rendering/config patterns. | Yes | Apply active states, icon sizing, badge density; keep HANDS taxonomy and permissions. | Medium |
| `src/libs/styles/AppReactDatepicker.tsx` | Canonical React Datepicker styling. | Yes | Mirror class-level CSS in `globals.css` for HANDS datepicker surfaces. | Low |
| `src/components` | Shared UI wrappers and layout helpers. | Selective | Use as pattern reference for forms/cards/tables, not as copied implementation. | Medium |
| `src/views` | Dashboard, table, app, form, auth page examples. | Selective | Map HANDS pages to closest examples and adapt composition. | Medium |
| `src/configs` and theme files | Theme tokens, color mode, shadows. | Yes | Use token values/behavior as CSS variable reference without migrating to MUI. | Medium |
| `src/app` | Page examples and app route composition. | Selective | Compare layouts and page rhythm only. | Low |
| `src/fake-db`, `src/prisma`, demo data | Demo backend/data. | No | Do not import or copy. | High |

## Non-Goals

- Do not copy Vuexy demo pages, data, routes, auth, Prisma, or mock APIs.
- Do not migrate HANDS Admin to MUI without explicit approval.
- Do not change booking, payment, finance, tax, referral, notification,
  operator, or partner approval behavior for visual alignment.
- Do not add dependencies for visual work unless the change is reviewed first.

## Common Components First

Before editing individual pages, prefer these shared surfaces:

- `AdminPageTemplate`
- `AdminSection`
- `AdminCard`
- `AdminKpiCard`
- `AdminDataTable`
- `AdminFilterPanel`
- `AdminFormInput`
- `AdminFormSelect`
- `AdminFormDate`
- `AdminFormTextarea`
- `AdminStatusBadge`
- `AdminEmptyState`
- `AdminLoadingState`
- `AdminErrorState`
- `AdminRoundedPagination`
- `MoneyText`

## Acceptance Criteria

- Every Admin page uses the shared page/header/card/table/form/status surfaces
  unless a page has a documented exception.
- Long lists use server-backed pagination or an intentional bounded result set.
- Date, money, status, loading, empty, and error states use shared components.
- Form controls visually match Vuexy/Figma atom sizing, radius, typography, and
  focus/error states.
- Tables visually follow the Vuexy data-display rhythm and retain HANDS data
  fields and action behavior.
- Login, shell navigation, topbar, breadcrumbs/page headers, dashboards,
  finance tables, booking tables, and customer/partner detail pages are visually
  aligned with the Vuexy references.
- Verification includes relevant component tests, selected page tests, Admin Web
  typecheck, and visual/browser checks for edited pages when the dev server is
  available.

## Progress Notes

Use small, reviewable changes. Move repeated page-specific markup into shared
components only when the change makes multiple pages more consistent.
