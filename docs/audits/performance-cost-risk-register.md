# HANDS Performance And Cost Risk Register

Date: 2026-06-21

Scope: performance, DB query, realtime, and external API cost risks found during the documentation-only audit.

## Risk Register

### PCR-001: Admin server components can hold too much data in memory

- File path: `apps/admin_web/app/bookings/[id]/page.tsx`, `apps/admin_web/app/page.tsx`, `apps/admin_web/app/partners/[id]/page.tsx`, `apps/admin_web/app/customers/[id]/page.tsx`
- Module/page/service name: Admin Web server-rendered pages
- Issue type: performance risk, large page modules
- Severity: high
- Current behavior: several Admin pages are very large, and booking detail fetches global lists along with booking-scoped data.
- Why it matters: Next.js dev and server rendering can grow memory as pages, imports, and payloads grow.
- Risk to speed/cost/business correctness: slow local development, higher memory usage, slower operator screens.
- Recommended fix: split large page files into smaller read-model and view components, keep route pages thin, and scope API fetches to the page's operational task.
- Safe now or human approval: safe now for presentational/read-model extraction; no business logic changes.
- Suggested test or smoke check: Admin route smoke for bookings, partners, customers, and reviews at 1440px and 1980px widths.

### PCR-002: Booking detail chat history lacks a default cap

- File path: `apps/api/src/admin/admin-booking-detail-selects.ts`
- Module/page/service name: Admin booking detail API
- Issue type: missing limit, excessive include/select
- Severity: high
- Current behavior: chat messages are included without an explicit `take`.
- Why it matters: chat history can grow unbounded for disputed bookings.
- Risk to speed/cost/business correctness: larger DB responses, higher memory, slower detail pages.
- Recommended fix: cap default chat messages and add a paginated chat-history API.
- Safe now or human approval: safe now.
- Suggested test or smoke check: booking with more than the cap should render latest messages and expose older history separately.

### PCR-003: Customer detail push devices are unbounded

- File path: `apps/api/src/admin/admin-customer-selects.ts`
- Module/page/service name: Admin customer detail API
- Issue type: missing limit
- Severity: medium
- Current behavior: all customer push devices are selected.
- Why it matters: devices can accumulate across reinstall/login cycles.
- Risk to speed/cost/business correctness: growing payload size and slower operator pages.
- Recommended fix: default to most recent devices and paginate device history.
- Safe now or human approval: safe now.
- Suggested test or smoke check: customer with many devices renders only bounded recent devices by default.

### PCR-004: Partner compact list relation limits are high for broad Admin pages

- File path: `apps/api/src/admin/admin-provider-profile-selects.ts`
- Module/page/service name: Admin Partner list API
- Issue type: excessive nested relation limits
- Severity: medium
- Current behavior: compact Partner list relation limits include up to 50 bookings, 50 participant records, and 30 earnings per Partner.
- Why it matters: Partner list pages can multiply relation payload size by hundreds of Partners.
- Risk to speed/cost/business correctness: Admin page speed and memory risk.
- Recommended fix: keep list rows summary-only and move relation history to Partner detail tabs.
- Safe now or human approval: safe now if list columns retain required operational summaries.
- Suggested test or smoke check: Partner list with 500 Partners should stay under an agreed response-size budget.

### PCR-005: Provider discovery performs application-side geo sorting

- File path: `apps/api/src/providers/providers.service.ts`
- Module/page/service name: Nearby Partner discovery
- Issue type: PostGIS/location query risk
- Severity: high
- Current behavior: the service fetches candidate profiles and sorts by distance in Node.
- Why it matters: discovery is frequently used and grows with supply size.
- Risk to speed/cost/business correctness: DB and Node CPU waste; possible wrong top results if the pre-distance candidate cap excludes closer Partners.
- Recommended fix: use an indexed DB bounding/radius query and keep application distance check as validation.
- Safe now or human approval: human approval needed for location query contract.
- Suggested test or smoke check: compare old/new result ordering against a seeded coordinate matrix.

### PCR-006: Backup provider lookup has the same geo scaling pattern

- File path: `apps/api/src/bookings/bookings.service.ts`, `apps/api/src/bookings/bookings.backup-providers.ts`
- Module/page/service name: Booking matching
- Issue type: PostGIS/location query risk
- Severity: high
- Current behavior: broad candidates are narrowed in application memory.
- Why it matters: matching is a critical booking path.
- Risk to speed/cost/business correctness: slow matching under supply growth; incorrect candidate cutoff under load.
- Recommended fix: DB-level radius candidate query plus existing policy validation.
- Safe now or human approval: human approval needed.
- Suggested test or smoke check: booking smoke with eligible, outside-radius, stale-location, blocked, and negative-wallet Partners.

### PCR-007: Provider realtime updates need continued server-side rate-control coverage

- File path: `apps/api/src/locations/locations.gateway.ts`, `apps/api/src/redis/redis-state.service.ts`
- Module/page/service name: Socket.IO provider location updates
- Issue type: realtime overuse risk
- Severity: high
- Current behavior: Partner current location uses a 90 minute stale TTL. On 2026-06-22, REST and Socket.IO location updates were aligned to the server policy: 60 minute idle refresh, 3000m idle movement exception, 30 minute active-booking refresh, and Vietnam service-area coordinate validation.
- Why it matters: realtime inputs are externally triggered and can be noisy.
- Risk to speed/cost/business correctness: lower after the server guard, but still important because future app changes can increase update volume.
- Recommended fix: keep server throttling as the source of truth and add any future cadence changes through policy constants plus tests.
- Safe now or human approval: current guardrails are safe; approval required for changing accepted update cadence.
- Suggested test or smoke check: socket and REST update flood tests should write only allowed updates.

### PCR-008: SMS OTP cost controls are incomplete

- File path: `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/otp-delivery.service.ts`
- Module/page/service name: Supabase Phone Auth / Vonage OTP
- Issue type: external API cost risk
- Severity: medium
- Current behavior: IP-level auth rate limiting exists, but per-phone or per-purpose cost caps were not found.
- Why it matters: phone OTP sends have real provider cost.
- Risk to speed/cost/business correctness: cost risk and possible user annoyance.
- Recommended fix: add per-phone cooldown, daily caps, and Admin-visible send outcomes.
- Safe now or human approval: human approval needed for limits.
- Suggested test or smoke check: repeated OTP requests for one phone number should be throttled before provider call.

### PCR-009: Push send job can fan out to many enabled devices

- File path: `apps/api/src/notifications/notifications.processor.ts`
- Module/page/service name: FCM processor
- Issue type: external API cost risk
- Severity: medium
- Current behavior: all enabled user push devices can be loaded and attempted.
- Why it matters: stale devices are common after reinstalls.
- Risk to speed/cost/business correctness: longer jobs and extra FCM calls.
- Recommended fix: cap devices, prefer recent tokens, prune permanent failures.
- Safe now or human approval: safe now.
- Suggested test or smoke check: processor sends to most recent role-matching tokens and disables failed tokens.

### PCR-010: Map search can become expensive without UI debounce verification

- File path: `apps/customer_app/lib/src/features/map/data/datasources/geoapify_geocoding_datasource.dart`
- Module/page/service name: Customer address geocoding
- Issue type: external API cost risk
- Severity: low
- Current behavior: datasource has query cache and Vietnam filter/bias, but the audit did not verify the UI debounce path.
- Why it matters: address search is user-typed and can call external APIs often.
- Risk to speed/cost/business correctness: external API cost and latency.
- Recommended fix: add a smoke test or widget test for debounce and cache behavior.
- Safe now or human approval: safe now.
- Suggested test or smoke check: simulated typing should produce bounded network calls.

### PCR-011: Payment callback attempts can create storage noise under abuse

- File path: `apps/api/src/payments/payments.service.ts`
- Module/page/service name: Payment callbacks
- Issue type: external callback volume risk
- Severity: low
- Current behavior: invalid callbacks are rejected and attempts are recorded.
- Why it matters: callback endpoints are public by nature.
- Risk to speed/cost/business correctness: low correctness risk; log/storage noise risk.
- Recommended fix: add callback attempt volume alerting and consider provider-specific rate limits.
- Safe now or human approval: safe now for monitoring; approval for rate-limit policy.
- Suggested test or smoke check: invalid callback burst does not mutate payment state and keeps bounded logs.

## Cost-Control Priorities

1. SMS OTP per-phone throttling.
2. FCM token pruning and fan-out cap.
3. Provider location server throttling regression coverage.
4. Map search debounce/caching verification.
5. Payment callback volume monitoring.
