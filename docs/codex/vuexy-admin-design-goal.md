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
