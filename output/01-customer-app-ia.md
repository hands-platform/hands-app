# Customer App Information Architecture

The Customer App is the guest-facing on-demand booking surface. It should stay simple until the Admin and backend authority model are stable.

## Primary Tabs

1. Home
   - Confirm or search service address
   - Browse nearby partners sorted by booking-address distance and availability
   - Open partner detail
2. Partners
   - Full partner list
   - Filters by service type, availability, and area
   - Partner profile entry point
3. Bookings
   - Current booking status
   - Past booking records
   - Admin-decided cancellation/no-show outcomes when applicable
4. Chat
   - Opens after partner matching/service-start flow
   - Hidden from normal customer flow after service completion
   - Admin retains the archive
5. Profile
   - Phone/account state
   - Saved addresses
   - App settings

## Key Screens

- Address selection with MapTiler/MapLibre map, Geoapify search, center pin, and manual adjustment.
- Partner list with distance, availability, service summary, and factual feedback counts.
- Partner detail with profile, services, public photos, reviews/feedback, and booking entry.
- Booking information with immutable address snapshot, selected service option, payment method, and policy notices.
- Matching wait screen with first-pick partner, marketplace candidates, countdown, and customer final-select action.
- Chat screen after final partner match.

## MVP Exclusions

- No tip or gratuity flow.
- No VIP, loyalty, membership, or customer scoring.
- No scheduled/calendar booking UX.
- No automatic partner assignment.
- No route navigation or live route streaming.
