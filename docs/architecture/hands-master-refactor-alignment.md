# HANDS Master Refactor Alignment

Last updated: 2026-05-31

This document records the current product and engineering direction after the HANDS master refactor prompt. It is the short alignment guide to use before changing backend, admin, or mobile flows.

## Core Shape

HANDS is an address-based, profile-first, real-time partner-selection marketplace for Vietnam.

Supabase is infrastructure. NestJS remains the business authority for booking, matching, payment, wallet, settlement, payout, refund/wallet credit, verification, tax gates, cancellation/no-show review, and admin actions.

Use Supabase for PostgreSQL, PostGIS, Auth, Storage, RLS, SQL/RPC where useful, and lightweight realtime only where safe. Do not put service-role keys in mobile apps or browser clients.

## Product Truths

- Customers choose a service address first.
- Customers browse visible partners through distance-sorted discovery.
- Partner visibility and partner availability are separate.
- A partner with stale location can remain visible; stale location affects distance sorting, alert eligibility, and operator warnings, not automatic hiding.
- Booking confirmation is mandatory before booking creation.
- Every booking must store an immutable booking address snapshot.
- A preferred partner request opens the Open Matching Marketplace.
- Marketplace participants can join while the customer waits.
- The customer always selects the final partner.
- Chat is created after the booking is matched and remains admin-retained after service completion.

## Removed Legacy Assumptions

- No automatic final dispatch.
- No radius-only or nearby-only discovery.
- No automatic final selection based on radius.
- No scheduled/calendar booking in MVP.
- No store/station/branch model.
- No premium membership/subscription/gratuity flow.
- No customer or partner rating/risk ranking.
- No Firebase dependency.

Distance can still drive sorting, alert preferences, and operations filters. Marketplace participation can use an admin-configurable eligibility radius; the current MVP target default is 10km, but the customer still chooses the final partner and the platform does not auto-assign by distance.

## Admin Language

Use Partner in admin/product copy. Keep `Provider` in existing DB/API names until a dedicated migration.

Admin is an Operations Command Center. It should show factual records, current status, dates, times, activity, blocked gates, and next actions. Avoid judging customers or partners with numeric labels or rankings.

## Wallet And Settlement Gate

Negative wallet balance is a warning and settlement-required state.

Allowed:

- Profile visibility
- Discovery
- Marketplace browsing
- Marketplace participation
- Customer selection

Blocked only when policy requires settlement before:

- Final booking gates
- Final confirmation
- Service start
- New matched booking confirmation

## Partner Levels

- `LEVEL_1_REGISTERED`: phone auth and basic profile; can access Partner App but cannot receive paid bookings.
- `LEVEL_2_ACTIVE`: identity and bank approved; can receive, accept, complete, and participate.
- `LEVEL_3_FIRST_COMPLETED`: first completed booking or first earned revenue triggers tax/payout requirements.
- `LEVEL_4_TAX_READY`: tax profile, residential address, and agreements complete.
- `LEVEL_5_PAYOUT_ENABLED`: tax review passed, no payout blocks, eligible for payout cycles.

Authentication is not authorization. Role is not eligibility.

## Next Refactor Priorities

1. Replace visible legacy secondary-participation/radius-limited language with Open Matching Marketplace and marketplace participant language.
2. Add or verify `BookingAddressSnapshot` behavior and smoke coverage.
3. Split visibility and availability language in admin and mobile.
4. Update wallet gate copy and tests to warning plus final-acceptance gate.
5. Replace per-booking payout assumptions with scheduled payout cycles.
6. Keep support compensation as customer wallet credit first.
7. Remove gratuity/premium-membership references from active MVP docs and screens.
