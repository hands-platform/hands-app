# HANDS Documentation Guide

This is the active documentation map for HANDS. If two files disagree, follow the authority order below.

## Authority Order

1. `HANDS_MVP_FINAL_AUTHORITY_RESET_PROMPT.md`
2. `docs/architecture/hands-mvp-final-authority.md`
3. `HANDS_CODEX_MASTER_REFACTOR_PROMPT.md`
4. `docs/architecture/master-progress-roadmap.md`
5. Current source code and smoke tests
6. `README.md`
7. Historical APK/research notes

## Read First

- `README.md` - project overview, local setup, and current MVP contract.
- `docs/architecture/hands-mvp-final-authority.md` - product rules that override old assumptions.
- `docs/architecture/master-progress-roadmap.md` - single execution board for current progress, decision backlog, validation commands, and next work.
- `docs/api/routes.md` - active API route reference.
- `docs/architecture/partner-acceptance-operations.md` - first-pick, marketplace, wallet, and closeout policy.
- `docs/architecture/notifications.md` - FCM push architecture, token registration, and Firebase scope rules.
- `docs/architecture/admin-web-integration.md` - Admin Operations Command Center integration.
- `docs/architecture/admin-vuexy-design-system.md` - active Admin UI design contract based on the Vuexy Figma kit and Next.js TypeScript template.
- `docs/architecture/mobile-api-integration.md` - Flutter app integration notes.

## Architecture Areas

- Product authority: `docs/architecture/hands-mvp-final-authority.md`
- Product intent: `docs/architecture/product-intent.md`
- Product architecture: `docs/architecture/product-architecture.md`
- Realtime matching: `docs/architecture/realtime-matching.md`
- Operations policy: `docs/architecture/partner-acceptance-operations.md`
- Payments and settlement: `docs/architecture/payments.md`, `docs/architecture/earnings.md`, `docs/finance/tax-fee-settlement-design.md`
- Notifications and push: `docs/architecture/notifications.md`
- Admin design system: `docs/architecture/admin-vuexy-design-system.md`
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

Old planning snapshots were removed because their useful content is now covered by this guide, `README.md`, `docs/api/routes.md`, and the focused architecture documents above.

## Maintenance Rules

- Prefer updating one active architecture document instead of creating another overlapping note.
- Keep old research clearly marked as historical reference.
- Delete planning snapshots when their useful content has moved into active docs.
- Do not add policy that conflicts with `hands-mvp-final-authority.md`.
- Keep visible product language as Partner even when code still uses Provider internally.
- Use `Asia/Ho_Chi_Minh` (`ICT`, `UTC+7`) as the only IANA timezone identifier for Vietnam business time in active and generated documentation.

## Naming Rule

Internal schema and code may still use `Provider` for compatibility. Product copy, Admin visible labels, and mobile visible labels should use `Partner`.

Do not rename database models casually. Any full Provider-to-Partner schema rename should be a separate planned migration.
