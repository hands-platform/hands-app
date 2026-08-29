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
$env:ADMIN_WEB_API_TOKEN_SECRET='<separate-admin-rest-token-secret>'
$env:ADMIN_REALTIME_TOKEN_SECRET='<separate-socket-token-secret>'
$env:ADMIN_WEB_LOGIN_EMAIL='admin@example.com'
$env:ADMIN_WEB_LOGIN_PASSWORD_HASH='<scrypt-base64url-password-hash>'
$env:ADMIN_WEB_LOGIN_PASSWORD_SALT='<password-salt>'
$env:ADMIN_WEB_SESSION_COOKIE_SECRET='<admin-web-session-cookie-secret>'
$env:ADMIN_WEB_SESSION_TTL_SECONDS='7200'
$env:ADMIN_WEB_SESSION_IDLE_TIMEOUT_SECONDS='7200'
$env:ADMIN_WEB_ALLOW_DEV_LOGIN='false'
$env:ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN='false'
```

Local MVP configuration:

```powershell
$env:ADMIN_API_BASE_URL='http://localhost:3000/api'
$env:ADMIN_WEB_API_TOKEN_SECRET='<local-admin-rest-token-secret>'
$env:ADMIN_REALTIME_TOKEN_SECRET='<local-socket-token-secret>'
$env:ADMIN_WEB_LOGIN_EMAIL='admin@example.com'
$env:ADMIN_WEB_LOGIN_PASSWORD='<dev-only-password>'
$env:ADMIN_WEB_ALLOW_DEV_LOGIN='true'
$env:ADMIN_WEB_SESSION_COOKIE_SECRET='<local-session-cookie-secret>'
$env:ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN='true'
```

Admin Web API access is derived from the signed operator session. For each server-side NestJS request, Admin Web mints
a short-lived `typ=admin-web-api`, `aud=hands-api`, `scope=admin:api` token using
`ADMIN_WEB_API_TOKEN_SECRET`. The token subject is the signed-in operator identity and the API verifies that identity
against the active ADMIN user record. `ADMIN_ACCESS_TOKEN` is not used for interactive Admin Web requests and must not
be sent to the browser. Admin Web must not obtain an admin token through `POST /api/auth/verify-otp`; that endpoint is
reserved for CUSTOMER and PROVIDER mobile auth.

Admin Web page access is guarded by a signed `hands_admin_session` cookie. Login is handled by
`POST /api/admin/session/login`; logout clears that cookie through `POST /api/admin/session/logout`; and
`GET /api/admin/session/me` returns only the authenticated admin role/sub when the session is valid. The cookie is
`HttpOnly`, path-scoped to `/`, `SameSite=Lax`, and `Secure` in production. The session payload contains only admin
identity metadata (`sub`, `role`, `iat`, `exp`, `jti`, `sessionVersion`) and an HMAC signature; it must never contain
`ADMIN_ACCESS_TOKEN`, passwords, password hashes, or secrets.

Production login must use `ADMIN_WEB_LOGIN_PASSWORD_HASH`, `ADMIN_WEB_LOGIN_PASSWORD_SALT`, and
`ADMIN_WEB_SESSION_COOKIE_SECRET`. If those values are missing, login fails closed. Raw
`ADMIN_WEB_LOGIN_PASSWORD` is accepted only when `NODE_ENV !== "production"` and
`ADMIN_WEB_ALLOW_DEV_LOGIN=true`.

Production also fails closed when `ADMIN_WEB_ALLOW_DEV_LOGIN=true` is present, even if a valid password hash is
configured. This flag is for uncommitted local development only. Shared templates, staging, and production must keep it
`false`.

Interactive production login is verified against `AdminOperatorCredential` through the NestJS API. It never falls back
to the static master credential when the API rejects a login or is unavailable. For a new environment, an existing
`ADMIN` + `MASTER_ADMIN` user can be linked once with `npm run admin:bootstrap-operator`; production requires the
explicit `ADMIN_OPERATOR_BOOTSTRAP_USER_ID`. This bootstrap uses the configured password hash and salt, records an audit
entry, and does not print or persist the plaintext password.

Admin API performance budgets must use a current operator-scoped token through
`ADMIN_API_BUDGET_ACCESS_TOKEN`. The legacy `ADMIN_ACCESS_TOKEN` remains a maintenance-script fallback only and may be
rejected by session-backed Admin REST authentication.

Admin Web realtime Socket.IO connections must not expose `ADMIN_ACCESS_TOKEN` to the browser. The local
`/api/admin/realtime-token` route mints a short-lived `typ=admin-realtime`, `aud=hands-socket`,
`scope=admin:realtime` token signed with `ADMIN_REALTIME_TOKEN_SECRET`. That token is accepted only by Socket.IO
auth and is not valid for REST Admin API calls.

`ADMIN_REALTIME_TOKEN_SECRET` must be configured in production and must be separate from both `ADMIN_ACCESS_TOKEN` and
`JWT_ACCESS_SECRET`. Reusing either secret blocks token minting. `ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN=true` is also a
production fail-closed misconfiguration; it is allowed only for explicitly opted-in local development.

`ADMIN_WEB_API_TOKEN_SECRET` must also be configured in production and must be different from the realtime, JWT, and
session-cookie secrets. It signs REST-only operator tokens and is never exposed to client components or browser storage.

For local development only, missing or placeholder Admin secrets can be replaced without printing their values:

```powershell
npm.cmd run admin:secrets:rotate-local
```

The command updates the ignored root `.env` atomically. Production must use independently generated values from the
deployment secret manager; do not copy the local values.

`/api/admin/realtime-token` must also be protected before minting that short-lived token. It accepts a signed
`hands_admin_session` cookie when `ADMIN_WEB_SESSION_COOKIE_SECRET` is configured. Until the full Admin login UI
exists, production must fail closed without that cookie/session protection. Local development can keep the booking
monitor realtime loop working by setting `ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN=true`; that fallback is ignored in
production and never logs token or secret values. Origin/Referer checks are not considered authentication.

Session cookies use the `hands_admin_session` name, are `HttpOnly`, `SameSite=Lax`, `Path=/`, and have a maximum TTL of
8 hours. Production cookies are `Secure`. Login, logout, session, and realtime-token responses use
`Cache-Control: no-store` and `Pragma: no-cache`. Logout clears the cookie with `Max-Age=0`. Expired, tampered, or
non-ADMIN session payloads are rejected.

Middleware protects Admin pages and browser-facing Admin routes. `/login`, `/api/admin/session/*`,
`/api/admin/realtime-token`, public referral links under `/r/*`, and static/Next assets are the only intentional
exceptions. Unauthenticated page requests redirect to `/login`; unauthenticated browser-facing Admin API requests
return `401`.

## Admin Web Deployment Checklist

Before deploying Admin Web:

- Set `ADMIN_WEB_LOGIN_EMAIL`, `ADMIN_WEB_LOGIN_PASSWORD_HASH`, `ADMIN_WEB_LOGIN_PASSWORD_SALT`, and
  `ADMIN_WEB_SESSION_COOKIE_SECRET`.
- Set `ADMIN_WEB_API_TOKEN_SECRET` to a dedicated REST token secret that is not reused by JWT, realtime, or session
  signing.
- Set `ADMIN_REALTIME_TOKEN_SECRET` to a dedicated value that is not `ADMIN_ACCESS_TOKEN` and not `JWT_ACCESS_SECRET`.
- Keep `ADMIN_WEB_ALLOW_DEV_LOGIN=false` and `ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN=false`.
- Do not configure `ADMIN_WEB_LOGIN_PASSWORD` in production.
- Keep any legacy `ADMIN_ACCESS_TOKEN` server-side only for explicitly documented maintenance scripts. Interactive
  Admin Web REST calls use the operator-scoped token and must never return either token to the browser or store it in
  cookies, localStorage, sessionStorage, or React client state.
- Run the Admin Web security tests:
  `npm.cmd run test --workspace @massage-vn/admin-web -- app/api/admin/session/login/route.spec.ts app/api/admin/session/logout/route.spec.ts app/api/admin/session/me/route.spec.ts app/api/admin/realtime-token/route.spec.ts lib/admin-web-middleware.spec.ts`.
- `just safe-check` includes the full Admin Web test suite through `verify:admin:fast`; CI runs the same full suite.

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
