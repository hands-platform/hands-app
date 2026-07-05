# HANDS Admin Vuexy Design System

This document is the active design reference for applying the purchased Vuexy
dashboard UI system to HANDS Admin. It is a design implementation guide, not a
business policy document.

In HANDS Admin, Vuexy Figma, the Vuexy Next.js TypeScript template, and MUI are
treated as one Vuexy design system:

- Figma is the visual source of truth.
- The Vuexy Next.js TypeScript template is the implementation reference.
- MUI is the component API and theming layer behind the Vuexy implementation.

Do not treat these as competing systems. When a design question appears, read
them as three layers of the same standard.

## Authority

Design work must follow this order:

1. HANDS MVP authority and domain rules.
2. Existing HANDS API and business behavior.
3. Vuexy design system references, in this order:
   - Figma Dashboard UI Kit and Builder v4.
   - Vuexy Next.js TypeScript full-version implementation.
   - MUI component API and theme customization docs used by Vuexy.
4. Current HANDS Admin shared components.

Do not change booking, settlement, authorization, referral, notification, or
partner approval behavior just to match a visual template.

## Source References

Official documentation:

- Vuexy overview: `https://demos.pixinvent.com/vuexy-nextjs-admin-template/documentation/docs/guide/overview`
- Vuexy foundation: `https://demos.pixinvent.com/vuexy-nextjs-admin-template/documentation/docs/user-interface/foundation`
- MUI getting started: `https://mui.com/material-ui/getting-started/`
- MUI Component API: `https://mui.com/material-ui/api/`

Figma file:

- `GXtaFRMuqQ5A14DgdPPJAv` - Vuexy Figma Dashboard UI Kit and Builder v4.
- Local source file:
  `C:/dev/themeforest-moDpEy2l-vuexy-vuejs-html-laravel-admin-dashboard-template/vuexy-admin-v10.11.1/design-files/figma/vuexy-figma-dashboard-ui-kit-and-builder-v4/vuexy-figma-dashboard-ui-kit-and-builder-v4/vuexy-figma-dashboard-ui-kit-and-builder-v4.fig`.
- Local package metadata: `meta.json` identifies the source as
  `vuexy-figma-admin-dashboard-ui-kit`.

Confirmed Figma nodes:

- `18:236156` - Text Field.
- `126:134885` - Input atoms, including outlined, filled, and custom input
  variants.
- `198:139913` - Select.
- `126:133340` - Buttons.
- `150:138964` - Checkbox.
- `150:145874` - Radio.
- `153:137575` - Slider.
- `154:137578` - Switch.
- `309:34632` - Buttons page.
- `327:74884` - Inputs.
- `327:74885` - Navigation.
- `327:74886` - Data Display.
- `6570:49843` - Dropdown.
- `6572:50395` - Breadcrumbs.
- `6574:50653` - Layout.
- `6576:50917` - Stepper.
- `6579:45052` - Tabs.
- `6583:45995` - Accordion.
- `6583:46474` - Card.
- `6586:46832` - Progress.
- `6586:47073` - Snackbar.
- `6586:47137` - Dialog.
- `6587:47387` - Avatar.
- `6587:47476` - Badge.
- `6588:47646` - Chip.
- `6590:48756` - Tooltip.
- `6591:48829` - List.
- `6595:48177` - Alert.
- `6598:49047` - Pagination.
- `6602:51369` - Timeline.
- `7177:39065` - Toast.

Local reference screenshots:

- `docs/assets/vuexy-figma/text-field.png`
- `docs/assets/vuexy-figma/buttons.png`
- `docs/assets/vuexy-figma/inputs.png`
- `docs/assets/vuexy-figma/navigation.png`
- `docs/assets/vuexy-figma/data-display.png`

Local Vuexy template:

- `C:/dev/themeforest-moDpEy2l-vuexy-vuejs-html-laravel-admin-dashboard-template/vuexy-admin-v10.11.1/nextjs-version/typescript-version/full-version`

Local Vuexy package alignment:

- The purchased template is a Vuexy MUI Next.js Admin Template.
- The local template package uses MUI components and theme customization as its
  implementation layer.
- HANDS Admin may keep shared CSS wrappers for the current phase, but their
  visual contract must follow Vuexy/MUI component states, sizing, and density.

Useful template paths:

- `src/configs/themeConfig.ts`
- `src/data/navigation/verticalMenuData.tsx`
- `src/components/layout/vertical/VerticalMenu.tsx`
- `src/@core/components/mui/TextField.tsx`
- `src/views/pages/auth/LoginV2.tsx`
- `src/views/react-table/BasicDataTables.tsx`
- `src/views/react-table/KitchenSink.tsx`
- `src/views/apps/user/list`
- `src/views/apps/user/view`
- `src/views/apps/calendar`
- `src/views/apps/calendar/SidebarLeft.tsx`
- `src/views/apps/calendar/AddEventSidebar.tsx`
- `src/views/apps/calendar/Calendar.tsx`
- `src/views/dashboards/crm`

## Figma Component Inventory

Use this inventory before changing shared Admin UI. Inspect the listed Figma
node and the closest Vuexy template implementation, then adapt the pattern into
HANDS shared components.

| HANDS need | Vuexy reference | HANDS usage |
| --- | --- | --- |
| Page shell, side menu, navbar, footer | `6574:50653` Layout, `327:74885` Navigation | Global Admin shell and left menu. Prefer semi-dark vertical menu behavior. |
| Text, select, basic form controls | `18:236156`, `198:139913`, `327:74884` | Filters, setup forms, review edit modals, policy forms. |
| Check/radio/switch/slider controls | `150:138964`, `150:145874`, `153:137575`, `154:137578` | Binary settings, scoped policy options, numeric/range controls. |
| Buttons and icon buttons | `126:133340`, `309:34632` | Primary actions, small table actions, segmented filter controls. |
| Dropdown/action menu | `6570:49843` | Row action menus and compact page actions. Do not show an action menu if no action exists. |
| Cards and metric panels | `6583:46474` | One-subject cards, summary metrics, dashboard widgets. Avoid card nesting. |
| Tables and data display | `327:74886` plus Vuexy React Table paths | Customers, Partners, Bookings, Reviews, Referrals, Notifications. |
| Avatars and avatar groups | `6587:47387` | Customer/Partner cells, participant groups, status indicators. |
| Badges and chips | `6587:47476`, `6588:47646` | Counts, status, compact category labels. Prefer tonal chips for state. |
| Pagination | `6598:49047` | All long operational lists. Use rounded pagination instead of long scrolling. |
| Tabs | `6579:45052` | Detail sections and same-page mode switching when the content is peer-level. |
| Breadcrumbs | `6572:50395` | Optional detail-page location context. Keep compact. |
| Stepper | `6576:50917` | Partner approval, KYC progress, onboarding or multi-step setup only. |
| Accordion | `6583:45995` | Secondary detail expansion only. Do not hide primary operations. |
| Timeline | `6602:51369` | Booking lifecycle, referral lifecycle, audit-style chronological records. |
| Dialog/modal | `6586:47137` | Focused admin actions such as review edit or cancellation decision. |
| Alert/snackbar/toast | `6595:48177`, `6586:47073`, `7177:39065` | Actionable warnings and save/error feedback. Avoid decorative alerts. |
| Tooltip | `6590:48756` | Icon-only controls and dense operational abbreviations. |
| Progress | `6586:46832` | Loading or process progress where duration is meaningful. |

Do not copy Vuexy demo business logic. Copy the visual and interaction pattern,
then bind it to HANDS data and NestJS API flows.

## Atom-First Workflow

Every Admin design change must start from the smallest Vuexy atom that controls
the surface being edited. Do not style from memory.

Required order:

1. Identify the exact UI atom in Figma.
2. Inspect the matching Vuexy Next.js TypeScript implementation.
3. Check the MUI component API only for states, slots, props, or behavior that
   Vuexy already uses.
4. Map the result into an existing HANDS shared component or shared CSS token.
5. Apply page-specific CSS only for layout, column width, or domain content.

Atom examples:

| Surface being changed | Start here | Local Vuexy implementation | HANDS target |
| --- | --- | --- | --- |
| Text, number, date, datetime, textarea | `126:134885`, `18:236156` | `src/@core/components/mui/TextField.tsx` | Global form tokens, `calendar-field`, page form classes |
| Select controls | `198:139913` | `src/@core/components/mui/TextField.tsx` Select section | Global select tokens, filter controls |
| Buttons and icon buttons | `126:133340`, `309:34632` | MUI Button usage, `src/@core/components/mui/IconButton.tsx` | `.button`, `.button-primary`, icon action buttons |
| Checkboxes, radios, switches | `150:138964`, `150:145874`, `154:137578` | MUI control examples and theme colors | Toggle/switch/check shared classes |
| Tables | `327:74886` | `src/views/react-table/*`, app list examples | `AdminDataTable`, `AdminTableScroll`, rounded pagination |
| Chips, badges, avatars | `6588:47646`, `6587:47476`, `6587:47387` | `src/@core/components/mui/Chip.tsx`, `Avatar.tsx`, `Badge.tsx` | Status chips, person cells, avatar status indicators |
| Dialogs and drawers | `6586:47137` | `src/views/pages/dialog-examples/*`, calendar drawer | Focused edit/action modals |

If a Figma node is too large, first inspect metadata, then inspect the smallest
child node that corresponds to the exact atom state. If Figma MCP cannot return
context for a node, use the local Vuexy template as the implementation
reference and record the fallback in the handoff.

## Atom Tokens

These Figma/Vuexy atom values are now the baseline for HANDS Admin tokens:

- Font family: `Public Sans`.
- Input small height: `38px`.
- Input default height: `48px`.
- Input large height: `56px`.
- Small input radius: `6px`.
- Default/large input radius: `8px`.
- Small input padding: `7.25px 14px`.
- Default input padding: `10.8px 16px`.
- Label font size: `13px`, line-height `1.153`.
- Helper text font size: `13px`, line-height `1.154`.
- Input text font size: `15px`, line-height `1.4375`.
- Input hover border: `action-active`.
- Focus border: primary, with Vuexy primary shadow.
- Error border: error main.
- Success border: success main.
- Disabled background: action hover, disabled text.

The matching CSS tokens live in `apps/admin_web/app/globals.css`:

- `--admin-control-height-sm`
- `--admin-control-height-md`
- `--admin-control-height-lg`
- `--admin-input-radius-sm`
- `--admin-input-radius-md`
- `--admin-input-padding-sm`
- `--admin-input-padding-md`
- `--admin-input-font-sm`
- `--admin-input-font-md`
- `--admin-input-font-lg`
- `--admin-input-line-height`
- `--admin-input-label-size`
- `--admin-input-label-line-height`
- `--admin-input-helper-size`
- `--admin-input-helper-line-height`
- `--admin-input-hover-border`

New form, filter, modal, and table work should use these tokens before adding
new values.

## Vuexy, Figma, And MUI Relationship

Use one mental model:

- **Figma answers "what should it look like?"**
- **Vuexy template answers "how did Vuexy implement it in Next.js?"**
- **MUI Component API answers "which props, slots, classes, states, and theme
  overrides are available?"**

For HANDS Admin, this means:

- A table redesign starts from the Figma Data Display/Table reference, checks
  the Vuexy React Table implementation, then maps the result into HANDS shared
  `AdminDataTable` and pagination components.
- A form redesign starts from Figma Text Field/Select/Form Elements, checks
  Vuexy `CustomTextField` usage, then maps the result into HANDS shared form
  classes or wrappers.
- A modal/action redesign starts from Figma Dialog/Dropdown/Button references,
  checks Vuexy MUI examples, then applies the pattern without changing HANDS
  business behavior.

If HANDS later adopts MUI directly in Admin, do it through shared wrappers and a
single theme layer, not by importing raw MUI components differently on every
page.

MUI usage policy:

- Prefer a shared wrapper such as `AdminButton`, `AdminTextField`,
  `AdminSelect`, `AdminDataTable`, `AdminPagination`, and `AdminDialog`.
- Use MUI props such as `variant`, `size`, `color`, `disabled`, `loading`,
  `startIcon`, `endIcon`, `slotProps`, and `sx` only through shared conventions.
- Put global visual defaults in one theme/customization layer.
- Do not mix unrelated MUI defaults with existing HANDS classes inside the same
  surface unless the page is being migrated intentionally.
- Do not add MUI as a dependency casually. If it becomes necessary, make it a
  dedicated implementation task with dependency review, theme setup, and visual
  smoke tests.

## Admin Layout Contract

HANDS Admin is desktop-only.

- Minimum supported width: `1024px`.
- Primary design width: `1440px`.
- Wide desktop target: up to `1980px`.
- Use compact content with max width `1440px`.
- Use layout padding `24px`.
- Do not design mobile-specific admin layouts.
- Avoid nested cards. Page sections should be bands or single cards with clear
  table/filter content.

Vuexy template alignment:

- `layout: vertical`
- `contentWidth: compact`
- `compactContentWidth: 1440`
- `layoutPadding: 24`
- navbar fixed/floating style can be adapted to HANDS shell.

## Foundation

Typography:

- Use `Public Sans` for Admin.
- Keep dense dashboard text around 13px to 15px.
- Do not use viewport-scaled font sizes.
- Use hero-scale type only where a dashboard overview truly needs it.

Color:

- Primary: Vuexy purple family already represented by `--admin-primary`.
- Success, warning, info, danger, and secondary must use shared semantic tokens.
- Avoid per-page custom palettes.
- Light and dark mode must use existing `[data-theme]` variables.

Shape and elevation:

- Default card radius: 6px to 8px.
- Buttons and inputs should match Vuexy compact radii.
- Use subtle borders and shadows from shared tokens.
- Do not add decorative gradient blobs or unrelated visual ornaments.

Spacing:

- Base page gap: 24px.
- Table/card internal spacing: 16px to 24px.
- Dense table row padding should stay compact enough for operations scanning.

## Shared Component Contract

All Admin pages should prefer these shared HANDS components before adding
page-specific markup:

- `AdminDataTable`
- `AdminTableScroll`
- `AdminFilterPanel`
- `AdminTablePaginationFooter`
- `AdminRoundedPagination` inside shared table pagination only
- `AdminPersonCell`
- booking/person avatar status classes
- country/flag display classes
- shared button classes
- shared form control classes

Page-specific CSS is allowed only for layout width, column sizing, and rare
domain-specific presentation.

Shared components should explicitly map to Vuexy component families:

- Table: Vuexy Data Display + Pagination.
- Filter panel: Vuexy Text Field, Select, Buttons, Dropdown.
- Action menu: Vuexy Dropdown + Icon Button.
- Person cell: Vuexy Avatar + List typography.
- Status label: Vuexy Chip or Badge.
- Modal: Vuexy Dialog with concise actions.

## Tables

Vuexy table behavior to preserve:

- Card header or filter header above table.
- Dense row spacing.
- Uppercase or muted column headers.
- Avatar + name + secondary metadata for people columns.
- Tonal chips for status or category.
- Rounded pagination at the bottom.
- No long scrolling list when pagination is more appropriate.
- Row actions through a compact dropdown when actions exist.
- Country/language cells use flag + label.

HANDS table rules:

- Customers, Partners, Reviews, Bookings, Referrals, Notifications, Operations
  tables should converge on the Customer directory table style.
- People columns must use the same avatar/status indicator model.
- Country fields should show flag + country/language label when available.
- Actions should use a compact action menu only when actual actions exist.
- Do not show duplicate detail text in list rows if it belongs on a detail page.

Every new table or table redesign must answer:

- What is the primary entity in each row?
- Which fields are scan-first and which belong on detail?
- Does the table need actions? If not, omit the Actions column.
- What date range filter and pagination size apply?
- Which avatar/status model applies to people columns?

## Filters

Use `AdminFilterPanel` for filter surfaces.

Standard date filters:

- Today.
- Yesterday.
- 7 days.
- 1 month.
- Custom range.

Custom date controls should be inline, with the apply button beside the second
date field.

Search should only appear when it helps the current list. Do not add generic
search boxes to every page.

Avoid "clear filters" controls unless the current route accumulates several
independent filters and the control is operationally useful.

Filter controls should follow Vuexy form sizing and use button-like date
presets when the page is operational:

- Date presets should be compact buttons.
- Custom range should stay inline.
- Selects should use concise labels.
- Sorting should be explicit, not hidden in free-text search.

## Forms

Vuexy input reference:

- Outlined input is the default.
- Supported sizes: small, default, large.
- States: default, hover, focused, error, success, disabled.
- Selects follow the same outlined/filled/custom size and state model.
- Checkboxes, radios, switches, and sliders use semantic colors only when the
  choice itself carries operational meaning.

HANDS form rules:

- Labels must be concise.
- Validation copy must be actionable.
- Avoid hidden business writes from Admin forms; critical writes must go through
  NestJS API patterns.
- Sensitive values must not be printed or logged.

## Buttons

Button variants:

- Primary.
- Secondary.
- Outline.
- Text.
- Icon.
- Segmented/toggle.

Rules:

- Use icons for obvious tool actions.
- Use text buttons for destructive or confirmation actions when clarity matters.
- Keep button height close to Vuexy medium controls.
- Avoid large marketing-style buttons in operational screens.
- Keep button groups and segmented controls visually consistent with Vuexy
  Toggle/Button Group references.

## Navigation

Use Vuexy vertical menu behavior as the model:

- Menu sections for large operational groups.
- Submenus for related pages.
- Compact icons on primary menu items.
- Suffix chips only for true operational counts.
- Breadcrumbs are optional and should not duplicate the left menu.

HANDS information architecture should stay operational:

- Dashboard / overview.
- Bookings.
- Users: Customers, Partners.
- Reviews.
- Referrals.
- Notifications.
- Finance / settlements.
- Operations.
- Setup.

Do not split one workflow into many menu items when a filtered list or detail
page would reduce duplication.

## Data Display

Use these Vuexy patterns:

- Metric cards for high-level counts.
- Tonal chips for status.
- Avatar group for participant lists.
- Timeline only for chronological operational history.
- Drawer/modal for edit or focused action flows.
- Alerts only for actionable warnings.
- Progress indicators only for real loading or multi-step operational progress.
- Tooltips for icon-only actions or dense labels that would otherwise be
  ambiguous.

Avoid repeating the same operational fact in metric cards, tables, and detail
sections unless the repetition helps decision-making.

## Application Mapping

Bookings:

- List pages use table-first operations scanning.
- Detail page summarizes customer, matched partner, finance, chat, and decision
  data without duplicating full list tables.

Customers:

- Directory follows the common table style.
- Detail page is one-column and operations focused.
- Booking history sections should reuse booking table style.

Partners:

- Partners, Unapproved Partners, and Unsettled Partners use the same directory
  visual model.
- Partner detail must support approval, hold, payout, KYC, services, reviews,
  evaluations, wallet, and operational notes without becoming a CRM.

Reviews:

- Customer reviews and partner customer evaluations use the common table style.
- Customer reviews can have admin edit/moderation flows.
- Partner customer evaluations are read-only operational records.

Referrals:

- Customer and Partner referrals are separate pages.
- Only parent accounts with referral activity should be listed.

Calendar:

- Follow Vuexy calendar drawer and sidebar behavior.
- Keep event actions focused and compact.

Login:

- Follow Vuexy `LoginV2` split-auth structure: no sidebar, no navbar, no
  marketing copy over the illustration, and form controls aligned to the shared
  TextField atom.

Vietnam overview:

- Map belongs only on the Vietnam overview page.
- Realtime map markers show active signals.
- Period numbers should be shown in a separate section.

Marketing analytics:

- Use Vuexy dashboard widgets, but keep costs and attribution explicit.
- Avoid hidden external analytics assumptions.

Operations:

- Operations pages should explain policy and action queues.
- They should not duplicate every booking/customer/partner list.

## Implementation Phases

Use small commit-sized steps:

1. Lock foundation tokens and component contracts.
2. Normalize table, filter, pagination, avatar, country, and button components.
3. Apply to Customers.
4. Apply to Partners.
5. Apply to Reviews.
6. Apply to Bookings.
7. Apply to Referrals and Notifications.
8. Apply to Operations and Setup pages.
9. Apply to Calendar, Vietnam overview, and Marketing analytics.
10. Run visual smoke at `1440px` and wide desktop.

Each phase should keep business logic unchanged unless the user explicitly asks
for behavior work.

## Verification

For design-only work:

- Run relevant component tests when changed.
- Run Admin typecheck when practical.
- Use in-app browser or Playwright screenshots at `1440px`.
- Check table overflow, text clipping, dark/light theme, hover/focus states, and
  empty/loading/error states.

For shared component changes:

- Verify at least Customers, Partners, Reviews, and Bookings.

For protected business areas:

- Follow protected change workflow before editing API, Prisma, settlement,
  payment, booking state, matching, auth, notification, or wallet behavior.
