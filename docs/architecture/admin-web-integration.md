# Admin Web Integration

## Current State

Admin Web now calls the protected backend admin APIs from server components:

- `GET /api/admin/providers`
- `GET /api/admin/bookings`
- `GET /api/admin/payments`
- `GET /api/admin/reviews`

Dashboard metrics are derived from those API responses.

## Auth

Preferred production configuration:

```powershell
$env:ADMIN_API_BASE_URL='https://api.example.com/api'
$env:ADMIN_ACCESS_TOKEN='<short-lived-admin-token>'
```

Local MVP fallback:

```powershell
$env:ADMIN_API_BASE_URL='http://localhost:3100/api'
$env:ADMIN_DEMO_PHONE='+84900000099'
$env:ADMIN_DEMO_OTP='123456'
```

If `ADMIN_ACCESS_TOKEN` is missing, the server component obtains a local demo admin token through `POST /api/auth/verify-otp`.

## Build Behavior

If the API is unavailable during build or local UI development, pages render empty states instead of failing. This keeps the admin shell deployable while Docker/API setup is still being fixed.

## Next Admin Work

- Add real admin login UI and session cookies.
- Add partner approve/reject actions.
- Add refund action wiring.
- Add coupon CRUD.
- Add audit log writes and audit log list API.
