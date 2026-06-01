# HANDS MVP Master Progress Roadmap

Last checked: 2026-06-01

This document is the single working map for HANDS MVP progress. It exists to keep backend, admin, mobile apps, external services, and product decisions from becoming fragmented.

## Master Refactor Source

The current source of truth is `C:\Users\laboy\Downloads\HANDS_CODEX_MASTER_REFACTOR_PROMPT.md`.

Working summary:

- HANDS is address-based, profile-first, and built around Open Matching Marketplace.
- Supabase is infrastructure; NestJS remains the business authority.
- Customer final partner selection is always the source of truth.
- Distance affects sorting, alert preference, operations filters, and the admin-configurable marketplace eligibility radius. The current MVP target default is 10km, but distance never auto-selects the final partner.
- Booking confirmation and immutable booking address snapshots are mandatory.
- Partner visibility and availability are separate.
- Negative wallet balance is a settlement warning; hard blocking applies only at final acceptance/confirmation/service-start gates when policy requires it.
- Use Partner in product/admin language while keeping Provider in existing DB/API internals until a planned migration.

## Product Direction

HANDS is a Vietnam-wide address-based partner-selection marketplace.

Core principles:

- Customer app, partner app, admin dashboard, and backend stay in one monorepo.
- Admin UI uses factual operations language. Avoid ranking customers or partners as risky people.
- Use "Partner" in admin/product language. Existing backend model names may still use `Provider` until a careful migration is planned.
- Chat opens after booking match and is available to customer and partner during the active service flow.
- After service completion, mobile apps may hide the active chat, but admin keeps the full chat archive.
- First-earning tax collection is preferred. Do not force full tax information at initial signup.
- Cash booking platform fees can create negative partner wallet balance. Negative wallet is a settlement warning and blocks only configured final acceptance/confirmation/service-start gates.
- No customer/partner rating, premium membership, or gratuity system in MVP.
- Design polish and full multilingual UI come after backend/admin/mobile flow stability.

## Current Technical Status

Checked commands:

- `npm.cmd run setup:doctor`: PASS
- `npm.cmd run api:policy-coverage`: PASS. This statically verifies that API smoke coverage still includes service pricing, payout rules, withholding, negative cash-fee wallet debt, settlement, and admin traceability invariants.
- `API_BASE_URL=http://localhost:3100/api SOCKET_BASE_URL=http://localhost:3100 node infra/scripts/api-smoke.mjs`: PASS. This now verifies customer cancellation, admin no-show, and admin expiry closure metadata.
- `npm.cmd run security:secrets`: PASS
- `npm.cmd run typecheck`: PASS
- `npm.cmd run build --workspace @massage-vn/api`: PASS
- `npm.cmd run build --workspace @massage-vn/admin-web`: PASS
- `node infra/scripts/admin-web-smoke.mjs`: PASS, 54 admin pages plus dynamic detail checks. On the current dev server this can take about 130-170 seconds, so short shell timeouts may fail even when the app is healthy.
- `ADMIN_WEB_SMOKE_PATHS=/,/customers,/partners,/partner-controls,/operations-policy,/bookings,/chat-archive,/app-sessions,/setup node infra/scripts/admin-web-smoke.mjs`: PASS. This targeted operating-core check also verifies dynamic customer, partner, provider-legacy, and booking detail pages.
- `ADMIN_WEB_SMOKE_PATHS=/operations-policy node infra/scripts/admin-web-smoke.mjs`: PASS. Use this targeted mode for fast page-specific checks.
- `node infra/scripts/admin-web-smoke.mjs /operations-policy /customers /partners`: PASS. This confirms the current customer, partner, and operations policy entry points after the Partner terminology cleanup.
- `ADMIN_WEB_SMOKE_PATHS=/customers,/partners node infra/scripts/admin-web-smoke.mjs`: PASS. This confirms customer and partner list/detail pages after closure metadata was added to the operator views.
- `ADMIN_WEB_SMOKE_PATHS=/,/customers,/partners,/bookings,/chat-archive,/partner-controls node infra/scripts/admin-web-smoke.mjs`: PASS. This focused operating-core check verifies dashboard, customer, partner, booking, chat archive, partner controls, and dynamic customer/partner/booking details after the latest admin continuity changes.
- `ADMIN_WEB_SMOKE_PATHS=/bookings node infra/scripts/admin-web-smoke.mjs`: PASS. Browser verification also confirmed `/bookings` renders the monitor closure copy and a dynamic `/bookings/{id}` page renders with the new `Closure` metric and booking operating ledger.
- `ADMIN_WEB_SMOKE_PATHS=/operations-handoff node infra/scripts/admin-web-smoke.mjs`: PASS. Browser verification also confirmed `/operations-handoff` renders the shift handoff checklist without runtime errors or people-ranking wording.
- `ADMIN_WEB_SMOKE_PATHS=/notifications?review=failed node infra/scripts/admin-web-smoke.mjs`: PASS. Failed notification review links are now covered by smoke tests.
- `ADMIN_WEB_SMOKE_PATHS=/partners?sort=booking-count,/partners?sort=gross-revenue,/partners?sort=pending-payout,/partners?sort=available-payout node infra/scripts/admin-web-smoke.mjs`: PASS. Partner operations sorting by booking count, gross revenue, pending payout, and available payout is now guarded.
- `ADMIN_WEB_SMOKE_PATHS=/customers?sort=booking-count,/customers?sort=completed-count,/customers?sort=captured-spend,/customers?sort=last-seen node infra/scripts/admin-web-smoke.mjs`: PASS. Customer operations sorting by booking volume, completed work, captured spend, and app access is now guarded.
- `flutter analyze` in customer app: PASS
- `flutter test` in customer app: PASS, 10 tests
- `flutter analyze` in partner app: PASS
- `flutter test` in partner app: PASS, 58 tests
- `npm.cmd run external:check:maps`: PASS
- `npm.cmd run supabase:schema:check`: PASS, 38 required tables
- `npm.cmd run mobile:architecture:check`: PASS

Known environment note:

- Local API/Admin smoke tests require Docker PostgreSQL and Redis to be running.
- If `localhost:3100` or `localhost:3101` fails, run `docker compose up -d` and `npm.cmd run local:start`.

## Completed Foundations

Repository and environment:

- Canonical repo path: `C:\dev\massage-vn-workspace\repo`
- GitHub remote: `https://github.com/hands-platform/hands-app.git`
- Branch: `develop`
- Docker local services: PostgreSQL, Redis, MinIO
- Local commands: `local:start`, `local:stop`, `local:status`, `verify:local`
- Secret scan guard exists and currently passes.
- API policy coverage guard exists and is wired into `setup:doctor` and `verify:local`.

Backend:

- NestJS API skeleton with Prisma.
- Core modules exist for auth, users, customers, providers, services, bookings, matching, chat, payments, notifications, files, locations, earnings, provider wallet, provider onboarding, admin.
- Prisma schema includes operational tables for booking, chat, payment, review, notification, files, provider verification, provider tax, wallet, payout, policy, and audit logging.
- Admin APIs cover bookings, customers, partners/providers, payments, refunds, reviews, notifications, payouts, services, tax policy, operations policy, cash settlements, app sessions, audit log, chat archive.

Admin dashboard:

- Operations dashboard with booking counts, matching wait, completion/cancel/no-show indicators, hourly and regional demand, active app users.
- Operations dashboard now includes a "Today operator order" control strip for live customer wait, partner response, customer choice and chat handoff, cash fee settlement, finance closeout, notification delivery, and operator queue sweep.
- Booking monitor with matching stages, first-pick, marketplace participants, customer choice, handoff repair, payment, cash debt, location, chat, closeout, expired, no-show views.
- Booking detail now includes a compact operating ledger that links customer, partner, chat, payment, finance, tax, wallet, location, alerts, and audit evidence into the deeper factual sections.
- Booking detail now includes a first-screen priority briefing for the operator's next action, customer/partner state, chat archive, location, payment, finance checks, and closeout handoff.
- Booking detail now includes closeout readiness checks and an exception register for customer/address, partner choice, chat archive, payment state, finance ledger, cash settlement, location, and audit evidence.
- Booking detail now includes a service pricing snapshot for selected service duration, customer price, partner payout, HANDS fee, tax/withholding, and wallet impact.
- Booking detail exposes immutable customer address snapshots to customer and admin reads, and API smoke verifies this so later location refactors do not overwrite booking history.
- Booking detail now exposes closure evidence as the source-of-truth view: top metric, operating ledger, operating timeline, and activity CSV include closure time, actor, reason, and note.
- Booking monitor rows now surface closure evidence when a booking has `closedAt`, and terminal bookings without an explicit actor/reason are flagged for operator completion.
- Customer list and customer detail with activity, booking history, chat history, wallet/payment context, addresses, app sessions, notes, exports.
- Customer list now separates closed booking evidence by customer/admin/partner closure role and no-show count when booking closure metadata exists.
- Customer detail now includes a compact operating ledger for account, booking work, latest booking, last completed work, chat archive, wallet/payment, address, app access, devices, notifications, timeline, and operator notes.
- Customer detail now shows booking closure time, closure actor, closure reason, and no-show evidence in booking history and activity records without assigning a customer ranking.
- Customer detail now renders all filtered chat rooms for the customer, not only the first page subset, and smoke tests guard the "Admin archive for every matched booking" marker.
- Partner list and partner detail with KYC, bank, tax, services, booking records, chat records, devices, sessions, documents, wallet, payouts, controls.
- Partner list now separates closed booking evidence by customer/admin/partner closure role and no-show count in the master list and CSV export.
- Partner detail now includes a compact operating ledger for identity, KYC, documents, bank, tax, services, bookings, chat, wallet, payout, location, app devices, and admin trail evidence.
- Partner detail now shows booking closure time, closure actor, closure reason, and closure activity rows inside the same booking/chat archive.
- Partner list now supports operations sorting by booking count, completed work count, gross revenue, pending payout, available payout, last work, app activity, location freshness, wallet debt, and checklist order.
- Partner list and detail show feedback as factual review record counts instead of average feedback values, so partners are not ranked or scored in operator views.
- Customer and partner pages are intentionally factual: they show IDs, contact, joined/recent access dates, completed work, booking/payment/chat/activity records, and operator notes without customer or partner ranking.
- Partner queue wording is checklist/order based, not rating/ranking based. Operator ordering is for fixing factual blockers only.
- Admin finance/review wording avoids presenting a gratuity program. Existing legacy extra-payment fields are shown as neutral customer extra/payment evidence until the backend model is migrated.
- Services page with service groups, duration options, minimum price, price step, payout policy, fee/tax visibility.
- Tax policy page with versioned tax rules.
- Operations policy page for matching and wallet gates.
- Operations policy behavior is API-backed and smoke-tested for the first-pick response window, marketplace participation, customer final partner selection, and wallet settlement gates.
- Operations policy analysis labels use outcome-check language such as "Check outcomes" and "On track" instead of risk/health labels for people or partners.
- Operations policy page now displays secondary participation as marketplace/candidate-alert wording even when older policy records still contain legacy secondary-participation labels.
- Operations policy, setup, and reviews pages now avoid visible legacy secondary-participation/ranking language in operator-facing copy while preserving internal compatibility keys.
- Operations Handoff now includes a shift handoff checklist for live matching, active services, chat continuity, cash settlement, closeout evidence, failed alerts, partner facts, customer context, and written operator notes.
- Operations dashboard wording now presents the secondary participation lane as marketplace partner candidates instead of legacy secondary-participation terminology.
- Booking monitor now presents the secondary participation lane as marketplace/candidate wording and keeps operator signals factual, with no visible legacy secondary-participation or people-ranking language.
- Booking detail now presents secondary partner participation as marketplace/candidate-alert wording, including saved legacy notification text at display time, while keeping old `backup_*` metadata keys internally for compatibility.
- Notifications and audit-log pages now display legacy secondary-participation policy/action/alert text as marketplace terminology, including saved notification title/body and policy target labels.
- Partner Controls now uses marketplace invitation/participation/matching wording for dispatch, KYC, device, wallet, document, and session operational lanes.
- Partner list now uses marketplace wording for secondary participation and masks legacy secondary-participation strings in seeded partner, bank, and document display values without changing stored data.
- Partner detail now uses marketplace wording for secondary participation, radius checks, app reachability, and dispatch repair guidance, with legacy display strings masked at render time.
- Backend booking notifications and partner join errors now use marketplace participation wording while keeping legacy event names and metadata keys for compatibility.
- Partner and review admin screens now present review data as factual feedback/service-recovery records, not as partner or customer ranking.
- Customer and partner mobile apps now use marketplace/extra-amount wording in visible booking, waiting, wallet, and earnings copy while keeping legacy internal matching keys for compatibility.
- Chat Archive page with filters, search, sender filter, date filter, CSV export, booking/customer/partner handoff links.
- CSV exports for customer/partner/account/chat operational records.
- Setup page now shows the master progress control sequence, verified baseline, external registration handoff, and deferred integration status.
- Admin smoke tests now support targeted page checks through `ADMIN_WEB_SMOKE_PATHS`, while full smoke still verifies the full admin surface.
- Admin smoke tests now strip rendered HTML to visible text and fail when legacy secondary-participation wording or people-ranking terms are exposed in operator-facing pages.
- Admin smoke tests now guard the dashboard operator order, failed-notification review page, and customer retained chat archive visibility.
- Admin smoke tests now fail if average feedback wording appears in operator-facing admin pages.
- Admin smoke tests now guard finance and work-volume partner sort URLs so operator list ordering remains available after admin refactors.
- Admin smoke tests now guard customer work-volume, spend, and app-access sort URLs so customer operations remain record-based and searchable.

Customer mobile app:

- Flutter Clean Architecture structure exists.
- Firebase removed.
- Supabase imports are isolated outside presentation.
- Customer provider discovery, service selection, booking confirmation, location selection, map/search, chat, coupons, notifications scaffolds exist.
- MapTiler map and Geoapify search checks pass.

Partner mobile app:

- Flutter Clean Architecture structure exists.
- Firebase removed.
- Partner online/location update, direct request, marketplace request, wallet gate, service pricing, onboarding, KYC/bank/tax helpers, chat, earnings, verification scaffolds exist.
- Partner location heartbeat and wallet gate tests pass.

Supabase and external setup:

- Supabase project values are represented in local env without leaking into Git.
- Supabase generated SQL pack exists.
- Supabase schema alignment guard passes.
- MapTiler and Geoapify real checks pass.
- Firebase removal guard passes.

## Deferred External Integrations

These are intentionally not blockers for local MVP development:

- Supabase Phone Auth production SMS provider.
- OneSignal production push credentials.
- MoMo merchant credentials.
- VNPay merchant credentials.
- Production S3/R2 storage credentials.
- App Store / Play Store release accounts and final signing validation.

Rule: Do not let these block admin/backend/mobile local flow work. Keep them visible in setup docs and checks.

## Current Fragmentation Watch Items

The codebase is healthy, but the work can become fragmented in these areas:

- Admin pages are broad. Each page must have a clear operational purpose and link back to booking/customer/partner context.
- Product language is transitioning from Provider to Partner. Admin text should use Partner, but DB/API rename should be delayed until a dedicated migration.
- External services are partly configured. Local development should not rely on production credentials.
- Mobile UI has working flows, but design is intentionally temporary.
- Policies for matching, cash fee debt, tax, payout, and service pricing must stay admin-configurable, not hardcoded in apps.
- Old secondary-participation/radius wording is being removed incrementally. Internal variable/API names can remain until compatibility migrations are planned.
- Legacy `/partner-risk` and `/provider-risk` routes are compatibility redirects only. New work should link to `/partner-controls` or `/partners`.

## Recommended Build Order From Here

### Phase A: Stabilize Admin Operating Core

Goal: Admin staff can understand and control the business without needing database access.

1. Customer detail completeness
   - Ensure customer detail shows bookings, completed work count, last completed booking, payments/refunds, wallet, saved addresses, chat archive, app sessions, admin notes.
   - Avoid customer ranking. Show factual activity only.

2. Partner detail completeness
   - Keep partner list as the primary entry point.
   - Detail page should contain onboarding/KYC/bank/tax, services/pricing, booking history, chat records, wallet/cash debt, payouts, documents, sessions/devices, notes, controls.
   - Avoid separate Partner Activity as a primary concept unless it is only an internal section.

3. Booking detail as source of truth
   - Every booking should show service option, customer, selected/preferred partner, participants, matching timeline, chat archive, payment, wallet, tax, refund, location, admin notes.

4. Operations policy controls
   - Confirm admin can update the first-pick response window, Open Matching Marketplace behavior, partner alert preferences, wallet settlement gate, completion watch, cancellation/no-show review, and payout cycle.

5. Setup page as operational checklist
   - Show external integration readiness and what is deferred.
   - Keep the master progress control sequence visible so work does not fragment across admin, backend, mobile, and external services.

### Phase B: Backend Rule Consistency

Goal: Mobile apps and admin use the same policy logic.

1. Matching policy service
   - Partner first-response window: configurable, currently 10 minutes.
   - Open Matching Marketplace stays visible to eligible marketplace participants.
   - Distance is used for ranking, alert preferences, and the admin-configurable marketplace eligibility radius.
   - Current MVP target default radius is 10km, but the customer still selects the final partner.
   - Customer can select among available participants.

2. Wallet/cash debt gate
   - Cash booking fee debt creates negative wallet.
   - Negative wallet creates settlement-required state and blocks only configured final acceptance/confirmation/service-start gates.
   - Admin can see and settle fee debt.

3. Service pricing engine
   - Admin creates service name.
   - Admin creates duration options: 60, 90, 120, etc.
   - Admin sets minimum price and step, default 100,000 VND step.
   - Partner can set equal or higher price.
   - Admin sets payout rule per service duration/price.
   - Finance views show customer price, partner payout, platform fee, VAT/withholding/other costs, net company fee.
   - Regression guard: `npm.cmd run api:policy-coverage` must keep passing before service pricing or payout refactors are merged.

4. Tax and payout engine
   - Tax rules versioned by effective date.
   - First revenue triggers tax-info collection before payout.
   - Tax and withholding logs are generated per completed booking/payout.

### Phase C: Mobile E2E Flow

Goal: Customer and partner apps can run the whole local operational flow.

1. Customer
   - Choose location.
   - See nearby partners sorted by distance/availability.
   - Open partner detail.
   - Choose service and duration.
   - Book now.
   - Wait for preferred partner and marketplace participants.
   - Select the final partner.
   - Chat after match.

2. Partner
   - Go online and send current location.
   - Receive direct request.
   - See open marketplace requests.
   - Join marketplace request.
   - Accept direct or selected request.
   - Start service to unlock chat.
   - Complete service.
   - See earnings/wallet/cash debt state.

### Phase D: External Production Readiness

Goal: Replace local/dev behavior with production services.

1. Supabase Auth with production SMS provider after dev/Twilio beta validation.
2. Supabase Storage or S3/R2 bucket policy.
3. OneSignal push E2E.
4. MoMo/VNPay sandbox payment E2E.
5. Production domain, DNS, SSL, and deployment.

### Phase E: Design and Localization

Goal: Apply final Figma style and multilingual UX after flows stop shifting.

1. Apply final customer app design.
2. Apply final partner app design.
3. Admin UI polish for operators.
4. Customer languages: Vietnamese, English, Korean, Chinese, Japanese.
5. Partner app language: Vietnamese first.
6. Admin language: Korean, Vietnamese, English as needed.

## Immediate Next Work

The next safest implementation order is:

1. Make booking detail the strongest cross-linking source of truth.
   - It should show customer, selected/preferred partner, service duration/price snapshot, matching participants, chat archive, location, payment, wallet, tax, refund, cash settlement, and admin notes in one place.
2. Keep operations policy visible in admin and guarded by smoke/API tests whenever matching rules change.
3. Add any missing backend tests for service pricing, payout/tax logs, and cash wallet debt.
4. Return to mobile E2E screens only after the booking detail and policy/finance records are easy to inspect from admin.
5. Apply final design/localization after these operational flows stop shifting.

## Definition Of Done For Each Small Step

Every step should finish with:

- Code changed in a narrow scope.
- Typecheck passes.
- Relevant build passes.
- Relevant smoke/test passes.
- No secret leaks.
- Git commit pushed to `develop`.
- This roadmap updated if status, scope, or operating order changes.
