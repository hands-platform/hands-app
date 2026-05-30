# Customer Flow

## Primary Booking Flow
1. Customer opens app.
2. App checks session and phone OTP login state.
3. Customer selects or searches service location.
4. App loads service categories and duration options.
5. Customer opens a service detail.
6. Customer opens nearby partner list sorted by distance and availability.
7. Customer opens partner detail.
8. Customer checks profile, reviews, service options, and price.
9. Customer selects service duration.
10. Customer confirms booking information.
11. Customer selects payment method.
12. Payment is authorized or cash booking is recorded.
13. Booking opens matching.
14. Preferred partner gets first response window.
15. Backup partners within configured radius can join.
16. Customer sees joined partners and selects final partner.
17. Chat room is created/unlocked.
18. Partner starts service.
19. Customer tracks basic location status, not realtime route.
20. Service completes.
21. Customer writes review and optional tip.

## Fallbacks
- GPS denied: customer can search address manually.
- Geo search inaccurate: customer can move map pin.
- Payment failed: booking remains payment pending or is cancelled.
- Preferred partner slow: backup shortlist stays available.
- No partner selected before timeout: booking expires and payment is released/refunded.

## MVP Notes
- Payment webview can be placeholder until MoMo/VNPay production keys are ready.
- Directions/routing API is not required.
- Chat remains in admin archive after completion.
