# API Mapping

NestJS is the business authority. Supabase, storage, maps, and notification providers are infrastructure adapters.

## Auth

| Flow | Route |
| --- | --- |
| Request OTP | `POST /auth/request-otp` |
| Verify OTP | `POST /auth/verify-otp` |
| Refresh session | `POST /auth/refresh` |

## Customer

| Page/Flow | Route |
| --- | --- |
| My profile | `GET /customer/me`, `PATCH /customer/me` |
| Saved locations | `GET /customer/locations`, `POST /customer/locations` |
| Address-based nearby partners | `GET /customer/partners/nearby` |
| Partner detail | `GET /customer/partners/:id` |
| Create booking with address snapshot | `POST /customer/bookings` |
| Booking detail | `GET /customer/bookings/:id` |
| Select final partner | `POST /customer/bookings/:id/select-provider` |
| Feedback record | `POST /customer/reviews` |

## Partner

| Page/Flow | Route |
| --- | --- |
| My profile | `GET /partner/me`, `PATCH /partner/me` |
| Online/offline | `POST /partner/online`, `POST /partner/offline` |
| Location update | `POST /partner/location` |
| Device/session | `POST /partner/device-session` |
| Partner services | `GET /partner/services`, `PATCH /partner/services` |
| Marketplace open requests | `GET /partner/bookings/open` |
| Partner booking records | `GET /partner/bookings` |
| Join marketplace request | `POST /partner/bookings/:id/join` |
| Accept/reject direct request | `POST /partner/bookings/:id/accept`, `POST /partner/bookings/:id/reject` |
| Arrived/start/complete | `POST /partner/bookings/:id/arrived`, `POST /partner/bookings/:id/start`, `POST /partner/bookings/:id/complete` |
| Earnings | `GET /partner/earnings`, `GET /partner/earnings/summary` |
| Onboarding | `GET /partner/onboarding`, `PATCH/POST /partner/onboarding/*` |

## Chat

| Flow | Route |
| --- | --- |
| Load messages | `GET /chat/rooms/:id/messages` |
| Send message | `POST /chat/rooms/:id/messages` |

## Admin

| Domain | Route group |
| --- | --- |
| Dashboard | `GET /admin/dashboard` |
| Customers | `GET /admin/customers`, `GET /admin/customers/:id` |
| Partners | `GET /admin/partners`, `GET /admin/partners/:id` |
| Bookings | `GET /admin/bookings`, `GET /admin/bookings/:id` |
| Marketplace ops | `GET /admin/bookings?view=marketplace` |
| Payments/refunds | `GET /admin/payments`, `POST /admin/payments/:id/refund` |
| Services/pricing | `/admin/services`, `/admin/service-pricing` |
| Tax/fee policy | `/admin/tax-policy`, `/admin/platform-fee-policy` |
| Operations policy | `GET/PATCH /admin/operations-policy` |
| Earnings/payouts | `/admin/earnings`, `/admin/payouts` |
| Notifications | `GET /admin/notifications` |
| Audit | `GET /admin/audit-log` |

## Realtime Events

- `booking.created`
- `booking.opened`
- `provider.joined`
- `provider.accepted`
- `provider.rejected`
- `booking.matched`
- `booking.expired`
- `provider.location.updated`
- `chat.message.created`
- `service.started`
- `service.completed`
- `payment.updated`

Event names can keep `provider.*` internally for compatibility. Visible UI should say Partner.
