# HANDS Documentation Guide

This guide keeps the project documentation readable as the MVP grows. If two documents disagree, follow the authority order below.

## Authority Order

1. `HANDS_MVP_FINAL_AUTHORITY_RESET_PROMPT.md`
2. `docs/architecture/hands-mvp-final-authority.md`
3. `README.md`
4. `docs/architecture/master-progress-roadmap.md`
5. Current source code and smoke tests
6. `output/*.md` product planning snapshots
7. Older research and APK analysis notes

## Read First

- `README.md` - project overview, local setup, and current MVP contract.
- `docs/architecture/hands-mvp-final-authority.md` - highest-priority product rules.
- `docs/architecture/master-progress-roadmap.md` - current progress, validations, and next work.
- `docs/api/routes.md` - API route reference.
- `docs/architecture/admin-web-integration.md` - Admin Operations Command Center integration.
- `docs/architecture/mobile-api-integration.md` - Flutter app integration notes.

## Product Planning Snapshots

The `output/` folder contains concise planning documents used to align Customer App, Partner App, Admin, API, database, and implementation phases.

These files are not higher authority than `hands-mvp-final-authority.md`. They should stay short, current, and practical.

Recommended reading order:

1. `output/01-customer-app-ia.md`
2. `output/02-partner-app-ia.md`
3. `output/03-admin-ia.md`
4. `output/04-customer-flow.md`
5. `output/05-partner-flow.md`
6. `output/06-booking-flow.md`
7. `output/13-api-mapping.md`
8. `output/14-db-domain-mapping.md`
9. `output/15-dev-implementation-plan.md`

## Architecture Areas

- Product authority: `docs/architecture/hands-mvp-final-authority.md`
- Product intent: `docs/architecture/product-intent.md`
- Product architecture: `docs/architecture/product-architecture.md`
- Realtime matching: `docs/architecture/realtime-matching.md`
- Operations policy: `docs/architecture/partner-acceptance-operations.md`
- Payments and settlement: `docs/architecture/payments.md`, `docs/architecture/earnings.md`
- Service pricing: `docs/architecture/service-pricing.md`
- Provider-to-partner onboarding: `docs/architecture/provider-onboarding.md`
- Supabase migration: `docs/architecture/supabase-migration-runbook.md`
- Low-cost maps: `docs/architecture/low-cost-location-system.md`
- External setup: `docs/architecture/operator-registration-plan.md`

## Historical Reference

APK analysis and GitHub research files are useful references, but they do not define HANDS product behavior:

- `docs/apk-analysis/*`
- `docs/research/github-reference-report.md`

Reference-app VIP, subscription, gratuity, scheduled booking, or ranking patterns are recorded only as analysis findings. They are not active HANDS MVP requirements.

## Naming Rule

Internal schema and code may still use `Provider` for compatibility. Product copy, Admin visible labels, and mobile visible labels should use `Partner`.

Do not rename database models casually. Any full Provider-to-Partner schema rename should be a separate planned migration.
