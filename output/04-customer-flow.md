# Customer Flow

## MVP Flow

1. Customer opens app.
2. Customer searches or confirms service address.
3. App shows partners sorted by confirmed address distance and availability.
4. Customer opens partner detail.
5. Customer reviews profile, services, public photos, and factual feedback records.
6. Customer selects a service and duration option.
7. Customer confirms booking information and payment method.
8. API creates booking with immutable `BookingAddressSnapshot`.
9. Preferred partner receives the first-pick request.
10. Marketplace partners within the configured booking-address radius can also join during the window.
11. Customer waits on matching screen.
12. Customer sees preferred partner and marketplace candidates.
13. Customer selects the final partner.
14. Chat opens after match/service-start flow.
15. Partner completes the service.
16. Customer can leave factual feedback.

## Policy Notes

- No automatic assignment.
- No customer tip or gratuity payment.
- No scheduled booking time.
- No normal customer cancellation after direct match in MVP.
- Cancellation/no-show closure is admin-decided from chat/evidence.
