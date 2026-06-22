# HANDS Refactor Execution Plan

Date: 2026-06-21

Scope: prioritized, small commit-sized follow-up plan from the code health audit. This is a plan only; no application code was changed during the audit.

## Execution Principles

- Keep Supabase as infrastructure and NestJS as the business authority.
- Do not combine protected behavior changes with UI cleanup.
- Prefer read-model and pagination changes before deeper business refactors.
- Keep each task small enough to commit independently.
- Run scoped verification for the touched area only.

## Prioritized Commit-Sized Tasks

### 1. Bound Admin booking detail read models

- File path: `apps/api/src/admin/admin-booking-detail-selects.ts`, `apps/api/src/admin/admin.service.ts`, `apps/admin_web/app/bookings/[id]/page.tsx`
- Module/page/service name: Admin booking detail
- Issue type: missing limits, excessive include/select
- Severity: high
- Current behavior: booking detail can include unbounded chat messages and additional global lists.
- Why it matters: booking detail is a high-frequency operator screen.
- Risk to speed/cost/business correctness: speed and memory risk; low business correctness risk if only read shape changes.
- Recommended fix: cap default chat messages, add paginated chat history if needed, and remove global list fetches from the default route.
- Safe now or human approval: safe now.
- Suggested test or smoke check: `npm.cmd --workspace apps/api test -- bookings` or existing scoped Admin booking tests, plus browser smoke for one booking detail.

### 2. Bound Admin customer detail read models

- File path: `apps/api/src/admin/admin-customer-selects.ts`, `apps/admin_web/app/customers/[id]/page.tsx`
- Module/page/service name: Admin customer detail
- Issue type: missing limits
- Severity: medium
- Current behavior: push devices are not capped in the customer detail select.
- Why it matters: device history can grow and is not always needed on first render.
- Risk to speed/cost/business correctness: speed and memory risk.
- Recommended fix: cap recent devices, move full device history into a paginated section.
- Safe now or human approval: safe now.
- Suggested test or smoke check: customer detail smoke with many push devices.

### 3. Add Admin route performance budget smoke

- File path: `apps/admin_web/app/*`, `scripts/*` if a smoke runner already exists
- Module/page/service name: Admin Web smoke checks
- Issue type: test gap
- Severity: medium
- Current behavior: UI pages are visually smoke-tested ad hoc, but no route-level payload/render budget is documented.
- Why it matters: Admin Web has large server pages and large tables.
- Risk to speed/cost/business correctness: slow operations screens and dev-server memory growth.
- Recommended fix: add a scoped smoke that visits bookings, booking detail, customers, partners, reviews, and notifications and records status/render success.
- Safe now or human approval: safe now.
- Suggested test or smoke check: Playwright route smoke at 1440px and 1980px.

### 4. Keep provider location server guards covered

- File path: `apps/api/src/locations/locations.gateway.ts`, `apps/api/src/redis/redis-state.service.ts`
- Module/page/service name: Provider location realtime
- Issue type: realtime overuse and location correctness
- Severity: high
- Current behavior: REST and Socket.IO Partner location updates now share server-side validation/throttling. The remaining work is regression coverage and avoiding future cadence drift.
- Why it matters: realtime location influences matching and operator confidence.
- Risk to speed/cost/business correctness: Redis traffic and incorrect dispatch visibility.
- Recommended fix: keep policy constants centralized and extend tests whenever a new location write path is added.
- Safe now or human approval: safe for regression tests; approval required if changing allowed cadence.
- Suggested test or smoke check: socket and REST tests for invalid coordinate, out-of-area coordinate, fast repeat, wrong role, and valid booking-stage update.

### 5. Design DB-backed Partner radius query

- File path: `apps/api/src/providers/providers.service.ts`, `apps/api/src/bookings/bookings.backup-providers.ts`, `apps/api/prisma/schema.prisma`
- Module/page/service name: Provider discovery and matching
- Issue type: PostGIS/location query risk
- Severity: high
- Current behavior: radius filtering and sorting are done in application memory.
- Why it matters: discovery and matching must stay fast and fair as Partner supply grows.
- Risk to speed/cost/business correctness: slow queries, wrong top candidates, higher CPU cost.
- Recommended fix: prepare a DB query design using bounding/radius filtering and index strategy, then implement behind tests.
- Safe now or human approval: design safe now; implementation requires approval because matching exposure changes are protected.
- Suggested test or smoke check: seeded location matrix comparing old and new results.

### 6. Clarify and implement negative-wallet stage gates

- File path: `apps/api/src/bookings/bookings.service.ts`, `apps/provider_app/test/provider_wallet_gate_test.dart`, `docs/architecture/partner-acceptance-operations.md`
- Module/page/service name: Wallet/matching policy
- Issue type: policy drift risk
- Severity: high
- Current behavior: docs and code may not fully agree on visibility, participation, final acceptance, start, and payout gates.
- Why it matters: settlement correctness is protected business logic.
- Risk to speed/cost/business correctness: incorrect Partner eligibility and payout behavior.
- Recommended fix: write the stage-gate decision table first, update tests, then adjust code.
- Safe now or human approval: human approval required before behavior change.
- Suggested test or smoke check: negative-wallet tests for each stage.

### 7. Add FCM device fan-out cap and stale-token cleanup

- File path: `apps/api/src/notifications/notifications.processor.ts`, `apps/api/src/notifications/notifications.service.ts`
- Module/page/service name: FCM push
- Issue type: external API cost risk
- Severity: medium
- Current behavior: all enabled role-matching push devices can be attempted.
- Why it matters: stale tokens increase push cost and job time.
- Risk to speed/cost/business correctness: FCM send overhead and delayed notification jobs.
- Recommended fix: cap by recent devices, keep failure pruning, and expose stale-token metrics in Admin setup/notifications.
- Safe now or human approval: safe now with conservative cap.
- Suggested test or smoke check: notification processor test with many devices and permanent failure.

### 8. Add SMS OTP cost controls

- File path: `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/otp-delivery.service.ts`
- Module/page/service name: OTP / Vonage
- Issue type: external API cost risk
- Severity: medium
- Current behavior: IP route limiting exists, but per-phone cooldown/cap is not explicit.
- Why it matters: OTP provider calls create direct cost.
- Risk to speed/cost/business correctness: unnecessary SMS/voice cost and user annoyance.
- Recommended fix: define per-phone cooldown, per-day phone cap, and reason-coded response.
- Safe now or human approval: human approval required for exact UX limits.
- Suggested test or smoke check: repeated same-phone OTP requests should not call Vonage within cooldown.

### 9. Run Supabase grant/RLS boundary review

- File path: `infra/supabase/hands-core-schema.sql`, `infra/supabase/patches/2026-05-23-postgrest-role-grants.sql`, `infra/supabase/storage-schema.sql`
- Module/page/service name: Supabase security boundary
- Issue type: business write bypass risk
- Severity: high
- Current behavior: grants and policies exist for Supabase roles; app code mostly respects NestJS business writes.
- Why it matters: grants can drift independently from code.
- Risk to speed/cost/business correctness: protected business writes could become exposed if policies are wrong.
- Recommended fix: table-by-table exposure matrix and scripted anon/authenticated access checks.
- Safe now or human approval: review safe now; policy tightening requires approval.
- Suggested test or smoke check: Supabase advisor plus direct access attempts for booking/payment/settlement/audit tables.

### 10. Consolidate legacy policy compatibility helpers

- File path: `apps/admin_web/lib/operations-policy.ts`, `apps/admin_web/app/bookings/[id]/booking-policy-snapshots.ts`, `apps/customer_app/lib/src/features/booking/presentation/customer_booking_ui_helpers.dart`, `apps/provider_app/lib/src/features/provider_request_guidance_helpers.dart`
- Module/page/service name: Operations policy compatibility
- Issue type: duplicate helpers, old policy code
- Severity: low
- Current behavior: current and legacy policy keys are handled in multiple places.
- Why it matters: scattered compatibility logic increases policy drift risk.
- Risk to speed/cost/business correctness: wrong copy or wrong UI state if one helper diverges.
- Recommended fix: centralize legacy key translation and keep visible copy using current MVP terms.
- Safe now or human approval: safe now if tests remain green.
- Suggested test or smoke check: existing Admin and Flutter helper tests for matching policy copy.

### 11. Archive or label obsolete docs and SQL drafts

- File path: `infra/supabase/location-schema.sql`, `docs/apk-analysis/*`, `docs/architecture/partner-acceptance-operations.md`
- Module/page/service name: docs/infra archive
- Issue type: dead code / stale documentation
- Severity: low
- Current behavior: old drafts and historical analysis remain visible.
- Why it matters: future work can accidentally follow obsolete rules.
- Risk to speed/cost/business correctness: scope drift and wrong implementation decisions.
- Recommended fix: add clear archive labels or move to an archive index after approval.
- Safe now or human approval: documentation labeling safe; moving/removing requires approval.
- Suggested test or smoke check: docs link check and authority-order review.

## Recommended Order

1. Read-model caps for booking/customer detail.
2. Admin route performance smoke.
3. Provider location guard regression coverage.
4. FCM fan-out cap.
5. OTP cost controls after limit approval.
6. DB-backed radius query design and approval.
7. Negative-wallet stage-gate decision and implementation.
8. Supabase grant/RLS review.
9. Legacy compatibility consolidation.
10. Archive labels for obsolete docs/drafts.

## Commit Strategy

- Commit 1: Admin read caps and detail fetch scoping.
- Commit 2: Admin smoke/performance checks.
- Commit 3: Provider location guard regression tests.
- Commit 4: FCM fan-out cap and stale-token tests.
- Commit 5: OTP cooldown after approved limits.
- Commit 6: Location query design doc, then implementation only after approval.
- Commit 7: Wallet stage-gate policy update after approval.
