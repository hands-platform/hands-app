# API Mapping

## Auth
| Flow | Route |
| --- | --- |
| Request OTP | POST /auth/request-otp |
| Verify OTP | POST /auth/verify-otp |
| Refresh session | POST /auth/refresh |

## Customer
| Page/Flow | Route |
| --- | --- |
| My profile | GET /customer/me, PATCH /customer/me |
| Nearby partners | GET /customer/partners/nearby |
| Partner detail | GET /customer/partners/:id |
| Create booking | POST /customer/bookings |
| Booking detail | GET /customer/bookings/:id |
| Cancel booking | POST /customer/bookings/:id/cancel |
| Select final partner | POST /customer/bookings/:id/select-provider |
| Review | POST /customer/reviews |
| Saved location | POST /customer/locations, GET /customer/locations |

## Partner
| Page/Flow | Route |
| --- | --- |
| My profile | GET /partner/me, PATCH /partner/me |
| Online/offline | POST /partner/online, POST /partner/offline |
| Location update | POST /partner/location |
| Device/session | POST /partner/device-session |
| Services | GET /partner/services, PATCH /partner/services |
| Open bookings | GET /partner/bookings/open |
| Partner bookings | GET /partner/bookings |
| Join backup | POST /partner/bookings/:id/join |
| Accept/reject | POST /partner/bookings/:id/accept, POST /partner/bookings/:id/reject |
| Start/complete | POST /partner/bookings/:id/start, POST /partner/bookings/:id/complete |
| Earnings | GET /partner/earnings, GET /partner/earnings/summary |

## Chat
| Flow | Route |
| --- | --- |
| Load messages | GET /chat/rooms/:id/messages |
| Send message | POST /chat/rooms/:id/messages |

## Admin
| Domain | Route group |
| --- | --- |
| Customers | GET /admin/customers, GET /admin/customers/:id |
| Partners | GET /admin/partners, GET /admin/partners/:id |
| Bookings | GET /admin/bookings, GET /admin/bookings/:id |
| Payments/refunds | GET /admin/payments, POST /admin/payments/:id/refund |
| Services/pricing | GET/POST/PATCH /admin/services, /admin/service-pricing |
| Tax/fee policy | GET/POST/PATCH /admin/tax-policy, /admin/platform-fee-policy |
| Operations policy | GET/PATCH /admin/operations-policy |
| Notifications | GET /admin/notifications |
| Audit | GET /admin/audit-log |

## Realtime Events
- booking.created
- booking.opened
- provider.joined
- provider.accepted
- provider.rejected
- booking.matched
- booking.expired
- provider.location.updated
- chat.message.created
- service.started
- service.completed
- payment.updated
