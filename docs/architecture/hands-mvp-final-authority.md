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
- Customers may browse partners from any country; booking creation depends on a confirmed service address in the active HANDS service area.
- Every booking must preserve an immutable `BookingAddressSnapshot`.
- Discovery can show partners beyond the Open Matching radius, but Open Matching participation is gated by booking address distance.
- Preferred partner gets the first-pick window, currently 10 minutes.
- Eligible marketplace partners within configured radius, default 10km, can join during the matching window.
- The customer always chooses the final partner.
- There is no automatic partner assignment.
- MVP bookings are immediate/on-demand. Do not expose scheduled booking or calendar booking UX.
- Tips are not part of the MVP.
- After matching, customers do not directly cancel through a normal cancel button. Cancellation and no-show outcomes are chat-evidence based and admin judged.
- Negative partner wallet balances allow marketplace list visibility only; join, direct acceptance, customer selection, service start, and payout release are blocked until settlement.
- Partner payouts are weekly, monthly, or admin-selected batch cycles.
- Admin is an Operations Command Center, not a CRM.
- Internal code may keep `Provider` names for compatibility, but visible product copy should use `Partner`.

## Matching Model

1. Customer selects or confirms a service address.
2. Customer browses partners sorted by address distance and availability.
3. Customer selects a preferred partner profile and service option.
4. API creates a booking with `BookingAddressSnapshot`.
5. Preferred partner is notified.
6. Eligible partners within the configured Open Matching radius can see/join.
7. Preferred partner acceptance does not automatically complete matching.
8. Customer reviews joined/accepted partners and selects the final partner.
9. Chat opens when the booking is matched.

## Settlement Model

- Cash payments mean the partner receives customer money directly.
- Cash bookings create a company receivable for HANDS fee and withholding.
- That receivable can make the partner wallet negative.
- Negative wallet state is an operational settlement warning that keeps marketplace list visibility but blocks marketplace participation and downstream booking gates.
- Admin confirms repayment or offset with auditable references.

## Current Migration Notes

- Starter migrations can remain as immutable history, but active Prisma schema, API code, Supabase draft schema, admin UI, mobile UI, and smoke checks must follow the final MVP rules.
- Active MVP behavior must not expose scheduled booking or tip flows.
- Smoke tests should protect final MVP policy, not old assumptions.
