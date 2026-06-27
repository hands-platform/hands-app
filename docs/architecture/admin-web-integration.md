# Admin Web Integration

## Current State

Admin Web now calls the protected backend admin APIs from server components:

- `GET /api/admin/partners`
- `GET /api/admin/bookings`
- `GET /api/admin/payments`
- `GET /api/admin/reviews`

Dashboard metrics are derived from those API responses.

The visible Admin product is organized as an Operations Command Center. Existing routes stay stable for MVP safety, while the sidebar groups them into:

- Command
- Bookings
- Partners
- Customers
- Finance
- Policy
- Evidence and System

The sidebar also exposes a short shift flow: start shift, urgent bookings, marketplace, cash debt, and handoff.

## Auth

Preferred production configuration:

```powershell
$env:ADMIN_API_BASE_URL='https://api.example.com/api'
$env:ADMIN_ACCESS_TOKEN='<short-lived-admin-token>'
```

Local MVP configuration:

```powershell
$env:ADMIN_API_BASE_URL='http://localhost:3000/api'
$env:ADMIN_ACCESS_TOKEN='<short-lived-admin-token>'
```

`ADMIN_ACCESS_TOKEN` is required for Admin Web API access. Admin Web must not obtain an admin token through
`POST /api/auth/verify-otp`; that endpoint is reserved for CUSTOMER and PROVIDER mobile auth.
If the token is missing or expired, admin server actions should show an explicit admin session/configuration error
instead of silently rendering empty data or generic duplicate-write failures.

## Build Behavior

If the API is unavailable during build or local UI development, pages render empty states instead of failing. This keeps the admin shell deployable while Docker/API setup is still being fixed.

## Large Data Operations Contract

Admin pages must be designed for operational queues that can grow to thousands of records per day.

- Default list views should load a bounded `Today` or `Needs action` window, not the complete history.
- Historical records must be reached through explicit date range, status, user, booking, or audit filters.
- List APIs must enforce server-side pagination or cursor windows with a maximum `take` value.
- Row lists should use narrow `select` payloads. Heavy evidence such as full delivery attempts, full chat history, settlement detail, or document payloads belongs in detail views, modals, or dedicated lazy endpoints.
- Metric cards should prefer scoped summaries, cached aggregates, or purpose-built summary APIs instead of recalculating unbounded history during page render.
- Operations pages should separate active work queues from audit/search pages so operators see what needs action first and can still find older evidence when needed.

Current applied slice:

- Notifications now default to the current day, expose previous day / 7 day / 30 day / bounded all-loaded range filters, and pass the selected date window to the NestJS Admin API instead of loading all notification rows into the browser.

## Next Admin Work

- Add real admin login UI and session cookies.
- Keep adding depth inside existing command lanes before creating new top-level pages.
- Keep partner approve/reject/block/unblock actions aligned with the canonical `/admin/partners` API aliases.
- Continue pairing every manual finance, policy, and partner action with audit evidence.
- Apply the large-data contract next to bookings, audit logs, reviews, customers, partners, and finance queues in small verified slices.
