# HANDS Code Health Audit

Date: 2026-06-21

Scope: documentation-only audit of the HANDS monorepo. No application code was changed. The audit used the current authority order from `docs/README.md`, `AGENTS.md`, `docs/architecture/master-progress-roadmap.md`, and `docs/architecture/hands-mvp-final-authority.md`.

## Authority Baseline

- Supabase is infrastructure. NestJS owns business rules, authorization, booking state, matching, payments, settlement, and audit decisions.
- Admin and mobile apps must not bypass NestJS for critical business writes.
- Customer discovery is address-based. Booking creation requires a confirmed service address in the active HANDS service area.
- Every booking should store an immutable `BookingAddressSnapshot`.
- First-pick Partner response window is 10 minutes.
- Partner location updates must be cost-controlled.
- Tip and franchise/shop modules are not part of MVP.
- Admin is operations/control, not a CRM.

## Executive Summary

The codebase is mostly aligned with the current MVP authority model. The strongest alignment points are: mobile apps use Supabase primarily for auth, business writes generally go through NestJS, `BookingAddressSnapshot` exists in Prisma, FCM is modeled as the official push path, and booking creation already checks selected service address and current-location distance where available.

The main health risks are not fundamental architecture breaks. They are operational scaling risks: large Admin read models, unbounded nested includes on detail pages, in-memory distance filtering for Partner discovery, insufficient provider-location socket validation, and external API cost controls around SMS and push fan-out.

## Findings

### CHA-001: Admin booking detail can over-fetch nested data

- File path: `apps/api/src/admin/admin-booking-detail-selects.ts`, `apps/api/src/admin/admin.service.ts`
- Module/page/service name: Admin booking detail API
- Issue type: excessive include/select usage, missing limit
- Severity: high
- Current behavior: booking detail select includes `chatRoom.messages` ordered by timestamp without an explicit `take`. `getBookingDetail` also attaches audit logs and other nested records.
- Why it matters: one long chat or noisy booking can make a single Admin detail page heavy.
- Risk to speed/cost/business correctness: speed risk from larger DB reads and server render payloads; cost risk from repeated large reads; correctness risk if operators wait on stale or slow detail pages.
- Recommended fix: cap booking chat messages in the base detail select, expose older chat history through a paginated child endpoint, and keep the default detail payload operationally small.
- Safe now or human approval: safe now if limited to read-model shape and UI pagination; no business logic change.
- Suggested test or smoke check: add an Admin booking detail fixture with more than the cap, verify the first page renders and older messages remain accessible through the paginated endpoint.

### CHA-002: Admin booking detail page fetches global lists unrelated to the booking

- File path: `apps/admin_web/app/bookings/[id]/page.tsx`
- Module/page/service name: Admin booking detail page
- Issue type: Admin page fetches too much data
- Severity: high
- Current behavior: the page fetches booking detail, operational policy, all notifications, and the Partner list in parallel.
- Why it matters: a booking detail page should be scoped to one booking. Global notification and Partner lists grow independently and can slow unrelated detail views.
- Risk to speed/cost/business correctness: speed and memory risk in Next.js server render; cost risk through repeated API calls; correctness risk if unrelated global data makes booking detail look stale or noisy.
- Recommended fix: replace global fetches with booking-scoped notification and Partner evidence endpoints, or lazy-load global lists only when an operator opens the related tool.
- Safe now or human approval: safe now if behavior is preserved and data is only deferred/scoped.
- Suggested test or smoke check: Playwright smoke for `/bookings/:id` confirming detail cards, Partner evidence, and notification trace still render without global list fetches.

### CHA-003: Provider discovery uses in-memory distance filtering

- File path: `apps/api/src/providers/providers.service.ts`
- Module/page/service name: Provider discovery / nearby Partners
- Issue type: PostGIS/location query risk, performance risk
- Severity: high
- Current behavior: `findNearby` queries up to 100 Provider profiles with non-null current coordinates, then computes distance and sorting in application memory.
- Why it matters: MVP growth will increase the number of Partner profiles and the frequency of discovery reads.
- Risk to speed/cost/business correctness: speed risk from scanning too many profiles; cost risk from larger DB and CPU work; correctness risk if the app silently drops eligible Partners because of fixed `take` before distance sorting.
- Recommended fix: add a DB-level bounding query or PostGIS-backed radius query, backed by an index and a query-plan smoke check.
- Safe now or human approval: requires human approval for the final query contract because marketplace visibility affects Partner exposure.
- Suggested test or smoke check: seed Partners inside/outside the current MVP radius and assert the DB query returns the same ordered set as the existing calculation.

### CHA-004: Backup provider matching also filters radius in memory

- File path: `apps/api/src/bookings/bookings.service.ts`, `apps/api/src/bookings/bookings.backup-providers.ts`
- Module/page/service name: Booking backup provider matching
- Issue type: PostGIS/location query risk, excessive candidate scan
- Severity: high
- Current behavior: eligible backup providers are found with broad Prisma filters and then distance-filtered/sorted in application memory.
- Why it matters: backup matching sits in the booking critical path.
- Risk to speed/cost/business correctness: speed risk during booking creation/matching; cost risk from scanning more Providers; correctness risk if wallet and distance filtering order excludes the wrong candidate set.
- Recommended fix: introduce a narrow location candidate query before service/wallet refinement, then keep existing policy checks as a second validation layer.
- Safe now or human approval: human approval recommended because matching behavior is protected business logic.
- Suggested test or smoke check: smoke booking creation with preferred Partner, backup Partners inside radius, outside radius, stale location, and negative wallet cases.

### CHA-005: Provider Socket.IO location updates needed server-side validation and throttling

- File path: `apps/api/src/locations/locations.gateway.ts`, `apps/api/src/redis/redis-state.service.ts`
- Module/page/service name: Provider realtime location gateway
- Issue type: realtime overuse risk, location correctness risk
- Severity: high
- Current behavior: originally, authenticated provider sockets could send `provider.location.update` and rely mainly on client-side cost control. On 2026-06-22 this was tightened: Socket.IO and REST Partner location updates now reject out-of-service-area coordinates and share the 60 minute idle / 3000m movement / 30 minute active-booking server throttle.
- Why it matters: client throttling is helpful but cannot be the only guard.
- Risk to speed/cost/business correctness: Redis/realtime traffic risk; business correctness risk if invalid or out-of-service-area coordinates affect dispatch visibility.
- Recommended fix: keep these guards as the authoritative server policy and avoid adding unbounded location history.
- Safe now or human approval: implemented as a safe guardrail; future cadence changes require human approval.
- Suggested test or smoke check: keep socket and REST tests for invalid coordinates, out-of-area coordinates, too-frequent updates, stale booking IDs, non-provider role, and valid booking-bound update.

### CHA-006: Push notification fan-out can grow with stale enabled devices

- File path: `apps/api/src/notifications/notifications.processor.ts`
- Module/page/service name: FCM notification processor
- Issue type: external API cost risk, missing limit
- Severity: medium
- Current behavior: notification processing loads enabled push devices for a user and sends to each role-matching device. There is no explicit `take` cap in the include.
- Why it matters: stale devices can accumulate for a user over time.
- Risk to speed/cost/business correctness: FCM send volume and job duration risk; delayed operations notifications if one user has many stale tokens.
- Recommended fix: cap active devices per user/role, prefer most recently seen devices, and aggressively disable tokens after known permanent send failures.
- Safe now or human approval: safe now if the cap is above expected normal device count and failures continue to be recorded.
- Suggested test or smoke check: processor test with many enabled devices verifying cap, role targeting, disabled failed token, and delivery records.

### CHA-007: SMS OTP needs per-phone and per-purpose cost controls

- File path: `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/otp-delivery.service.ts`, `apps/api/src/main.ts`
- Module/page/service name: Auth OTP / Vonage delivery
- Issue type: external API cost risk
- Severity: medium
- Current behavior: `/api/auth/` routes have IP rate limiting. OTP delivery supports Vonage, but no per-phone cooldown/audit budget was found in the service path.
- Why it matters: SMS/voice OTP can generate real external cost.
- Risk to speed/cost/business correctness: cost risk from repeated requests; user trust risk if accidental repeated calls/messages happen.
- Recommended fix: add per-phone cooldown, per-day phone cap, and Admin-visible OTP delivery audit counters.
- Safe now or human approval: requires product/ops approval for exact limits because it affects login UX.
- Suggested test or smoke check: request OTP twice within cooldown for the same number and assert the second request does not call the external provider.

### CHA-008: Negative wallet participation semantics need authority review

- File path: `apps/api/src/bookings/bookings.service.ts`, `apps/provider_app/test/provider_wallet_gate_test.dart`, `docs/architecture/partner-acceptance-operations.md`
- Module/page/service name: Matching/wallet gate
- Issue type: policy drift risk
- Severity: high
- Current behavior: the code has a marketplace join gate for negative wallet. Current authority states negative wallet should allow visibility/participation but block final acceptance/start/payout. Some older documentation implies stricter blocking.
- Why it matters: this is a core Partner fairness and settlement rule.
- Risk to speed/cost/business correctness: business correctness risk if Partners are hidden too early or allowed too far into a paid workflow.
- Recommended fix: make one authority decision, update tests and code to match, and archive contradictory wording in older docs.
- Safe now or human approval: requires human approval before behavior changes.
- Suggested test or smoke check: test negative-wallet Partner visibility, participation, final acceptance, start service, and payout states separately.

### CHA-009: Supabase SQL grants should be reviewed against the NestJS business boundary

- File path: `infra/supabase/hands-core-schema.sql`, `infra/supabase/patches/2026-05-23-postgrest-role-grants.sql`
- Module/page/service name: Supabase schema/grants
- Issue type: critical business writes may be exposed if policies drift
- Severity: high
- Current behavior: SQL grants include schema/function grants for `anon`, `authenticated`, and `service_role`, plus many RLS policies. Current app code mostly routes business writes through NestJS, but SQL exposure should be actively audited.
- Why it matters: Supabase is infrastructure, not the business-write authority.
- Risk to speed/cost/business correctness: business correctness and security risk if PostgREST can mutate protected business tables outside NestJS.
- Recommended fix: run a dedicated Supabase RLS/grant review and document which tables are intentionally exposed for mobile reads/writes.
- Safe now or human approval: human approval required before tightening grants because it can break auth/storage/client flows.
- Suggested test or smoke check: Supabase RLS advisor plus scripted anon/authenticated attempts for booking, payment, settlement, matching, and audit tables.

### CHA-010: Admin customer detail can over-fetch user devices and history

- File path: `apps/api/src/admin/admin-customer-selects.ts`
- Module/page/service name: Admin customer detail API
- Issue type: excessive include/select usage, missing limit
- Severity: medium
- Current behavior: customer detail selects all `user.pushDevices`, plus bookings/reviews/locations/notifications with relatively high limits.
- Why it matters: customer detail is an operator page, not a CRM archive.
- Risk to speed/cost/business correctness: speed risk as historical data grows; Admin memory risk.
- Recommended fix: cap push devices and expose older customer history through paginated child sections.
- Safe now or human approval: safe now for read-model pagination.
- Suggested test or smoke check: customer detail fixture with many devices/bookings; verify default page remains bounded and paginated history still works.

### CHA-011: Booking service remains a large protected core service

- File path: `apps/api/src/bookings/bookings.service.ts`
- Module/page/service name: NestJS booking service
- Issue type: maintainability risk
- Severity: medium
- Current behavior: the service is still over 2,000 lines and holds booking creation, matching, cancellation, status updates, wallet gates, and notification triggers.
- Why it matters: bookings are the main protected business workflow.
- Risk to speed/cost/business correctness: future changes become slower and riskier; small policy changes can accidentally affect unrelated booking stages.
- Recommended fix: continue extracting pure helpers/read-model builders and stage-specific command handlers, without changing behavior.
- Safe now or human approval: safe now only for mechanical extraction with existing tests; behavior changes require approval.
- Suggested test or smoke check: existing booking service specs plus smoke booking lifecycle covering create, first-pick timeout, marketplace, match, completion, cancellation.

### CHA-012: Geoapify search has good country filtering but needs request-budget verification

- File path: `apps/customer_app/lib/src/features/map/data/datasources/geoapify_geocoding_datasource.dart`
- Module/page/service name: Customer address search
- Issue type: external API cost risk
- Severity: low
- Current behavior: the datasource limits responses and caches normalized queries in memory; it filters/biases to Vietnam.
- Why it matters: map search can become expensive if every keystroke becomes a network call.
- Risk to speed/cost/business correctness: external API cost risk and mobile latency risk.
- Recommended fix: confirm UI debounce and minimum query length behavior in a smoke test; consider short TTL metrics for cache hit/miss visibility.
- Safe now or human approval: safe now for tests/metrics; UX changes require product approval.
- Suggested test or smoke check: type a multi-character query and assert request count is debounced and repeated query is cached.

### CHA-013: Payment callbacks have strong correctness guards but need volume guard monitoring

- File path: `apps/api/src/payments/payments.service.ts`
- Module/page/service name: Payment callback processing
- Issue type: external callback volume risk
- Severity: low
- Current behavior: callbacks validate method, provider reference, amount, replay/terminal state, and production secrets. Missing secrets in production are rejected.
- Why it matters: public callback endpoints can still receive noise even if business state is protected.
- Risk to speed/cost/business correctness: low business correctness risk; medium logging/storage noise risk under abuse.
- Recommended fix: keep callback attempt recording, add volume alerting, and rate-limit clearly invalid providers if needed.
- Safe now or human approval: safe now for monitoring; rate-limit policy may need ops approval.
- Suggested test or smoke check: invalid callback burst smoke should produce rejected attempts without changing payment state.

## Areas That Look Aligned

- Mobile app critical business writes were not found bypassing NestJS through direct Supabase table writes.
- Admin role sync routes call NestJS rather than directly changing business tables.
- Booking creation stores a `BookingAddressSnapshot` and validates active service address requirements.
- Push notification architecture is FCM-first and keeps sensitive content out of push payloads.
- Provider app heartbeat interval is cost-conscious at the client level.

## Primary Gaps To Close

1. Bound Admin read models before adding more dashboard screens.
2. Move Partner radius lookup toward DB-backed, indexed filtering with smoke tests.
3. Keep server-side Partner location guards covered while tuning any future cadence.
4. Clarify negative-wallet participation/final-acceptance semantics.
5. Add external API cost smokes for SMS, push fan-out, and map search.
