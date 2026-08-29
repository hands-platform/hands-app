# HANDS MVP Final Authority

This document records the current highest-priority MVP product authority imported from `HANDS_MVP_FINAL_AUTHORITY_RESET_PROMPT.md`.

If older docs, comments, tests, or UI copy conflict with this file, this file wins.

## Authority Order

1. `HANDS_MVP_FINAL_AUTHORITY_RESET_PROMPT.md`
2. This final HANDS MVP model
3. `HANDS_CODEX_MASTER_REFACTOR_PROMPT.md`
4. `docs/architecture/master-progress-roadmap.md`
5. Current codebase
6. Older docs
7. Inference

## Core Rules

- Supabase is infrastructure. NestJS owns business rules, authorization, booking state, matching, payments, settlement, and audit decisions.
- Mobile and Admin must not bypass NestJS for critical business writes.
- Customer discovery is address-based, not transient GPS-based.
- Customers may browse partners from any country; booking creation depends on a confirmed service address in the active HANDS service area and fresh current GPS must be within 50km of that selected service address when the app can provide it.
- Every booking must preserve an immutable `BookingAddressSnapshot`.
- Discovery can show partners beyond the Open Matching radius, but Open Matching participation is gated by booking address distance.
- Preferred partner gets first-pick priority, currently within the 10 minute response window.
- Eligible marketplace partners within configured radius, default 10km, can participate during the matching window in parallel with the first-pick request.
- Customer final selection is required unless the first-pick Partner validly accepts first under API rules.
- There is no automatic nearest-partner assignment.
- MVP bookings are immediate/on-demand. Do not expose scheduled booking or calendar booking UX.
- Tips are not part of the MVP.
- After matching, customers do not directly cancel through a normal cancel button. Cancellation and no-show outcomes are chat-evidence based and admin judged.
- Negative partner wallet balances keep marketplace visibility and participation open as a warning state; final acceptance, service start, and payout release are blocked until settlement.
- Partner payouts are weekly, monthly, or admin-selected batch cycles.
- Admin is an Operations Command Center, not a CRM.
- Internal code may keep `Provider` names for compatibility, but visible product copy should use `Partner`.
- Vietnam business time uses `Asia/Ho_Chi_Minh` (`ICT`, `UTC+7`) as its canonical IANA timezone in product behavior, API contracts, tests, operations evidence, and documentation; other region identifiers are not interchangeable even when their current UTC offset matches.

## Matching Model

1. Customer selects or confirms a service address.
2. Customer browses partners sorted by address distance and availability.
3. Customer selects a preferred partner profile and service option.
4. API creates a booking with `BookingAddressSnapshot` only if the selected service address passes the service-area gate and fresh current GPS is not 50km or more away.
5. Preferred partner is notified as the first-pick Partner.
6. Eligible partners within the configured Open Matching radius can see/join in parallel.
7. If the first-pick Partner validly accepts first under API rules, that Partner becomes matched.
8. Otherwise, customer reviews participating/accepted partners and selects the final Partner.
9. Chat opens when the booking is matched.

## Settlement Model

- Cash payments mean the partner receives customer money directly.
- Cash bookings create a company receivable for HANDS fee and withholding.
- That receivable can make the partner wallet negative.
- Negative wallet state is an operational settlement warning that keeps marketplace list visibility and participation open, while final acceptance, service start, and payout release wait for settlement.
- Admin confirms repayment or offset with auditable references.

## Current Migration Notes

- Starter migrations can remain as immutable history, but active Prisma schema, API code, Supabase draft schema, admin UI, mobile UI, and smoke checks must follow the final MVP rules.
- Active MVP behavior must not expose scheduled booking or tip flows.
- Smoke tests should protect final MVP policy, not old assumptions.
