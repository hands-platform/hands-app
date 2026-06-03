# HANDS Master Refactor Alignment

This document is a short reference to the older master refactor direction. It is superseded by `docs/architecture/hands-mvp-final-authority.md`.

## Keep

- Address-based partner discovery.
- Supabase as infrastructure and NestJS as business authority.
- Booking confirmation and immutable booking address snapshot.
- First-pick partner plus Open Matching Marketplace.
- Customer final partner selection.
- Admin factual operations language.
- Provider internal names can remain until a planned migration; visible copy should say Partner.

## Remove From Active MVP

- Automatic dispatch or automatic final partner selection.
- Radius-only customer discovery.
- Scheduled/calendar booking.
- Store, station, branch, affiliate, or franchise model.
- Premium membership, subscription, tip, or gratuity flows.
- Customer or partner scoring/ranking.
- Firebase dependency.

## Wallet Gate

Negative partner wallet means settlement is required.

Allowed:

- profile visibility
- customer discovery
- marketplace browsing

Blocked:

- marketplace join/participation
- direct acceptance
- customer final selection
- service start
- payout release

## Current Work Priority

Use `docs/architecture/master-progress-roadmap.md` for the live work order.
