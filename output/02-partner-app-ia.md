# Partner App Information Architecture

The Partner App helps Vietnam-based partners receive direct first-pick requests, see eligible marketplace requests, update location, chat with customers, complete services, and manage settlement readiness.

## Primary Tabs

1. Requests
   - Online/offline state
   - Direct first-pick booking requests
   - Marketplace request list for eligible bookings
   - Accept, reject, or join actions
2. Schedule
   - Today/current work status only for MVP
   - No scheduled booking creation UX
3. Earnings
   - Completed work
   - Platform fee debt
   - Weekly/monthly/admin-designated payout batches
4. Chat
   - Opens after matched/service-start flow
   - Customer conversation during active work
5. Profile
   - Basic profile
   - Verification/KYC state
   - Bank, tax, agreement, and document readiness

## Location Model

- Partner app asks for GPS permission.
- On app launch, it sends current location once.
- While open, it refreshes location every 10 minutes.
- No background tracking.
- Last stored location remains available for customer discovery and marketplace eligibility.

## Wallet Gate

- A negative partner wallet means unpaid HANDS fees exist.
- Partners can still see marketplace requests.
- Marketplace join/participation is blocked until settlement or admin offset clears the debt.
- Direct acceptance, customer final selection, service start, and payout release are also blocked by the configured debt gate.

## MVP Exclusions

- No partner ranking or trust score.
- No tip/gratuity feature.
- No route navigation or live route streaming.
- No background GPS tracking.
