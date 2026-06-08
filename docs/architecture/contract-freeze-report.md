# HANDS Contract Freeze Report

Last checked: 2026-06-08

## Confirmed Product Contract

HANDS uses **First-pick Partner Priority + Parallel Open Marketplace**.

The old absolute rule "Customer always selects final Partner" is no longer correct.
Replace it with:

> Customer final selection is required unless the first-pick Partner validly accepts first under API rules.

Authority remains unchanged:

- NestJS API owns booking, matching, wallet gate, payment, settlement, refunds, verification approval, and final Partner connection.
- Admin Web and Flutter apps are UI clients only.
- Supabase is infrastructure/database tooling only, not a business decision layer.

## Working Tree Finding

The current working tree mixes Admin-only changes with protected API changes.

Admin-only changes are present under:

- `apps/admin_web/app/bookings/**`
- `apps/admin_web/app/customers/[id]/page.tsx`
- `apps/admin_web/lib/admin-participant-ledger-copy.ts`
- `apps/admin_web/components/action-menu.tsx`
- `apps/admin_web/components/filter-bar.tsx`
- `apps/admin_web/components/money-text.tsx`
- `apps/admin_web/components/status-badge.tsx`

Protected API changes are present under:

- `apps/api/src/bookings/bookings.service.ts`
- `apps/api/src/bookings/bookings.service.spec.ts`
- `apps/api/src/earnings/earnings.service.ts`
- `apps/api/src/provider-wallet/provider-wallet.policy.ts`
- `apps/api/src/provider-wallet/provider-wallet.policy.spec.ts`

Protected areas with no current working-tree changes:

- `apps/api/src/matching`
- `apps/api/src/payments`

## Conflict Inventory

### Customer Always Selects Final Partner

These files still imply customer final selection is absolute or that first-pick acceptance does not match automatically:

- `docs/architecture/hands-mvp-final-authority.md`
  - Says customer always chooses the final partner.
  - Says preferred Partner acceptance does not automatically complete matching.
- `docs/architecture/master-progress-roadmap.md`
  - Says customer always selects final Partner and no automatic assignment.
- `docs/architecture/realtime-matching.md`
  - Says first-pick Partner can accept first, but customer still confirms final Partner.
  - Says first-pick acceptance keeps booking open until customer confirms.
- `docs/architecture/product-intent.md`
  - Says customer always selects final Partner and matched chat opens after customer selection.
- `docs/architecture/operator-registration-plan.md`
  - Says customer final Partner selection is always required.
- `docs/api/routes.md`
  - Describes marketplace participants before customer selects final Partner.
- `apps/api/src/matching/matching.policy.ts`
  - `PREFERRED_ACCEPT_CUSTOMER_CONFIRM` is the only preferred accept mode.
  - Policy description says first-pick acceptance keeps booking open until customer confirms final Partner.
  - Tradeoff says customer always chooses final Partner.
- `apps/api/src/matching/matching.service.ts`
  - `openBooking()` returns `finalSelection: 'CUSTOMER_SELECTS_PARTNER'`.
  - `selectFinalProvider()` returns `finalSelection: 'CUSTOMER_SELECTED'`.
- `apps/api/src/bookings/bookings.service.ts`
  - First-pick `ACCEPTED` branch keeps booking `OPEN_MATCHING`, clears `selectedProviderId`, emits `provider.accepted`, and tells customer to confirm or choose another Partner.
  - `selectProvider()` is the only observed path that sets `BookingStatus.MATCHED`.
- `apps/api/src/bookings/bookings.service.spec.ts`
  - Tests customer final confirmation after first-pick acceptance.
  - Tests preferred Partner cannot be selected until accepted.
- `infra/scripts/api-smoke.mjs`
  - Exercises customer final selection after preferred Partner acceptance.
- `infra/scripts/api-domain-smoke.mjs`
  - Guards "customer final partner selection must stay mandatory".
- `infra/scripts/check-api-policy-coverage.mjs`
  - Requires markers for customer final confirmation and mandatory final selection.
- `infra/scripts/admin-web-smoke.mjs`
  - Guards "Customer-selected final partner only" and customer final choice lanes.
- Admin copy and tests under:
  - `apps/admin_web/app/page.tsx`
  - `apps/admin_web/app/setup/page.tsx`
  - `apps/admin_web/app/bookings/**`
  - `apps/admin_web/app/operations-policy/**`
  - `apps/admin_web/lib/admin-navigation.ts`
  - `apps/admin_web/lib/admin-participant-ledger-copy.ts`
  - `apps/admin_web/lib/booking-*.ts`

Required replacement concept:

- "Customer final selection is required unless first-pick accepts first under API rules."
- Admin can still show customer final selection lanes, but only for bookings where first-pick did not already win the race.

### Delayed Marketplace

`AFTER_FIRST_PICK_DELAY` is currently implemented, documented, and tested.

Implemented in API:

- `apps/api/src/matching/matching.policy.ts`
  - Exports `BACKUP_OPEN_AFTER_FIRST_PICK_DELAY`.
  - Allows it in `MatchingPolicy.backupOpenMode`.
  - Shows it as an Operations Policy option.
  - Parses it in `readBackupOpenMode()`.
- `apps/api/src/bookings/bookings.policy.ts`
  - `isMarketplaceParticipationWindowOpen()` supports delayed marketplace behavior.
- `apps/api/src/bookings/bookings.service.ts`
  - `findEligibleBackupProviders()` returns no marketplace candidates when delayed mode is active and not force-opened.
  - Snapshot logic preserves delayed marketplace mode from booking metadata.
  - Join/radius path can block participation while delayed mode has not opened.

Tested in API/tests:

- `apps/api/src/bookings/bookings.policy.spec.ts`
  - Tests delayed marketplace closed before first-pick window passes.
  - Tests delayed marketplace opens after the response window.
  - Tests delayed marketplace remains closed when opening evidence is missing.
- `apps/api/src/matching/matching.policy.spec.ts`
  - Tests legacy and current policy keys accepting `AFTER_FIRST_PICK_DELAY`.
- `infra/scripts/api-smoke.mjs`
  - Sets `matching.marketplace_open_mode` to `AFTER_FIRST_PICK_DELAY`.
  - Verifies non-preferred Partner cannot see/join delayed booking before opening.
  - Verifies first-pick decline exposes delayed marketplace request.
- `infra/scripts/check-api-policy-coverage.mjs`
  - Requires delayed marketplace smoke markers.

Documented/Admin surfaced in:

- `docs/architecture/realtime-matching.md`
- `apps/admin_web/lib/operations-policy.ts`
- `apps/admin_web/lib/operations-policy.spec.ts`
- `apps/admin_web/app/operations-policy/page.tsx`
- `apps/admin_web/app/operations-policy/policy-impact-details.ts`
- `apps/admin_web/app/operations-policy/policy-enforcement-trace.ts`
- `apps/admin_web/app/bookings/[id]/booking-policy-snapshots.ts`

Recommendation for MVP:

**Disable/deprecate delayed marketplace for MVP.**

Reason:

- The confirmed product model is parallel Open Marketplace.
- Removing the policy entirely may require a broader migration for existing saved policy rows and smoke scripts.
- Keeping it as an active Admin option creates avoidable conflict and lets Operations configure a flow that violates the product contract.

Recommended shape:

- Keep `AFTER_FIRST_PICK_DELAY` parser compatibility for old rows temporarily.
- Normalize effective runtime behavior to `IMMEDIATE_WITHIN_WINDOW`.
- Mark delayed mode as deprecated/conflict in Admin and authority checks.
- Remove delayed smoke expectations and replace them with a conflict guard.
- Plan full removal only after current protected API changes are reviewed.

### First-pick Exclusive Lock Before Acceptance

No explicit "exclusive lock" copy was found as a first-class product claim.

However, delayed marketplace behavior effectively creates a temporary exclusive first-pick period by hiding/blocking marketplace visibility and participation until the first-pick window passes or first-pick rejects.

Files creating that practical effect:

- `apps/api/src/bookings/bookings.service.ts`
- `apps/api/src/bookings/bookings.policy.ts`
- `apps/api/src/bookings/bookings.policy.spec.ts`
- `infra/scripts/api-smoke.mjs`
- `apps/admin_web/app/operations-policy/**`

Required correction:

- First-pick priority is a race/priority rule, not marketplace exclusivity.
- Marketplace visibility and participation should run in parallel while first-pick is pending.

### Auto-assign Nearest Partner

No active implementation or desired copy was found that silently auto-assigns the nearest Partner.

Current code/docs mostly guard against auto-assignment. Distance is used for eligibility, ranking, and alerting.

Files with relevant no-auto-assignment guard language:

- `docs/architecture/hands-mvp-final-authority.md`
- `docs/architecture/master-progress-roadmap.md`
- `docs/architecture/product-intent.md`
- `apps/api/src/matching/matching.policy.ts`
- `apps/admin_web/lib/booking-closeout-checklist-rows.ts`
- `apps/admin_web/lib/admin-participant-ledger-copy.ts`
- `infra/scripts/api-smoke.mjs`

Required correction:

- Keep "no nearest Partner auto-assignment".
- Replace "customer always selects" with "first-pick valid acceptance can match first; otherwise customer selects."

## Frozen Status Model

### BookingStatus

Keep existing coarse `BookingStatus` enum for MVP:

- `CREATED`
- `OPEN_MATCHING`
- `MATCHED`
- `PROVIDER_ON_THE_WAY`
- `ARRIVED`
- `IN_SERVICE`
- `COMPLETED`
- `CANCELLED`
- `NO_SHOW`
- `EXPIRED`
- `REFUNDED`

Do not add DB enum values for substate in the first implementation pass.

### Matching Substate

Represent matching substate as derived API fields or metadata until the DB contract is reviewed.

Proposed substates:

- `BOOKING_CREATED`
- `FIRST_PICK_PENDING`
- `OPEN_MARKETPLACE_ACTIVE`
- `FIRST_PICK_AND_MARKETPLACE_ACTIVE`
- `PARTNER_JOINED`
- `CUSTOMER_SELECTION_REQUIRED`
- `FIRST_PICK_ACCEPTED_MATCHED`
- `CUSTOMER_SELECTED_MATCHED`
- `MATCHED`
- `CHAT_OPENED`
- `SERVICE_STARTED`
- `COMPLETED`
- `REVIEWED`

Important:

- `FIRST_PICK_PENDING` and `OPEN_MARKETPLACE_ACTIVE` are parallel, not mutually exclusive.
- `MATCHED` requires exactly one final Partner.
- Final Partner source should be explicit:
  - `FIRST_PICK_ACCEPTED_FIRST`
  - `CUSTOMER_SELECTED_PARTNER`
  - `ADMIN_REPAIR` only for audited repair, not normal matching.

### ParticipantStatus

Keep existing enum for MVP:

- `JOINED`
- `ACCEPTED`
- `REJECTED`
- `SELECTED`
- `EXPIRED`

Interpretation freeze:

- First-pick pending can be represented by a preferred Provider id plus no accepted/rejected participant row, or by a `JOINED` participant row if the API creates one.
- First-pick valid acceptance should set first-pick participant `SELECTED` or `ACCEPTED` plus booking `MATCHED`; choose one canonical write pattern before implementation.
- Marketplace participants can be `JOINED`.
- Customer-selected winner must become `SELECTED`.
- Non-winning participants remain retained as evidence.

Recommended canonical pattern:

- Winner participant status is `SELECTED`.
- Accepted but not final participant status is `ACCEPTED`.
- Joined but not accepted participant status is `JOINED`.

### PaymentStatus

Keep existing enum:

- `PENDING`
- `AUTHORIZED`
- `CAPTURED`
- `FAILED`
- `REFUNDED`
- `RELEASED`

Matching changes should not alter payment status names.

### PartnerStatus

Keep existing internal `ProviderStatus` enum while product copy says Partner:

- `OFFLINE`
- `ONLINE_AVAILABLE`
- `ONLINE_BUSY`
- `ONLINE_AVAILABLE_SOON`

Matching eligibility should continue to use `ONLINE_AVAILABLE` and `ONLINE_AVAILABLE_SOON`.

### WalletStatus

No dedicated `WalletStatus` enum exists in Prisma or `packages/shared-types`.

Freeze the API-level wallet gate fields instead:

- `walletBlocked`
- `marketplaceVisibilityBlocked`
- `marketplaceJoinBlocked`
- `directFirstPickBlocked`
- `alreadyMatchedServiceBlocked`
- `payoutReleaseBlocked`
- `walletDebtAmount`
- `walletBlockCode`
- `walletSettlementMethod`
- `walletSettlementReference`

Current working-tree protected changes move negative wallet behavior toward:

- marketplace visibility open
- marketplace participation open
- final acceptance blocked
- service start blocked
- payout release blocked

This is protected behavior and must be reviewed before expanding.

## Socket.IO Event Names

Existing event names in `packages/shared-types/src/index.ts` and API gateway:

- `booking.created`
- `booking.opened`
- `provider.joined`
- `provider.accepted`
- `provider.rejected`
- `booking.matched`
- `booking.expired`
- `provider.location.updated`
- `chat.message.created`
- `service.started`
- `service.completed`
- `payment.updated`

Gateway currently emits:

- `booking.opened`
- `provider.joined`
- `provider.accepted`
- `provider.rejected`
- `booking.matched`
- `booking.expired`
- `service.started`
- `service.completed`

Recommended additions or refinements:

- Keep existing event names for compatibility.
- Add payload field `matchSource` to `booking.matched`:
  - `FIRST_PICK_ACCEPTED_FIRST`
  - `CUSTOMER_SELECTED_PARTNER`
  - `ADMIN_REPAIR`
- Add payload field `matchingSubstate` to `booking.opened`, `provider.joined`, `provider.accepted`, and `booking.matched`.
- Consider `first_pick.requested` only if mobile needs a separate direct-request event; otherwise keep direct request as targeted `booking.opened`.

Do not rename `provider.*` events in code until a separate Provider-to-Partner internal migration is approved.

## API Response Shape

Current notable shape:

- `MatchingService.openBooking()` returns:
  - `status: 'OPEN_MATCHING'`
  - `matchingPolicy.finalSelection: 'CUSTOMER_SELECTS_PARTNER'`
  - `matchingPolicy.marketplaceOpenMode`
  - legacy `backupOpenMode`
- `MatchingService.selectFinalProvider()` returns:
  - `status: 'MATCHED'`
  - `finalSelection: 'CUSTOMER_SELECTED'`
- `clientBookingResponse()` passes most booking fields through and normalizes payment.

Required change:

- Stop returning `finalSelection: 'CUSTOMER_SELECTS_PARTNER'` as an absolute.

Recommended response additions:

```json
{
  "matching": {
    "status": "OPEN_MATCHING",
    "substates": ["FIRST_PICK_PENDING", "OPEN_MARKETPLACE_ACTIVE"],
    "preferredProviderId": "provider-id",
    "selectedProviderId": null,
    "firstPickExpiresAt": "2026-06-08T00:00:00.000Z",
    "marketplaceOpenMode": "IMMEDIATE_WITHIN_WINDOW",
    "finalPartnerRequiredBy": "FIRST_PICK_ACCEPT_OR_CUSTOMER_SELECTION",
    "matchSource": null
  }
}
```

When matched:

```json
{
  "matching": {
    "status": "MATCHED",
    "substates": ["MATCHED", "CHAT_OPENED"],
    "selectedProviderId": "provider-id",
    "matchSource": "FIRST_PICK_ACCEPTED_FIRST"
  }
}
```

Compatibility note:

- Keep old top-level fields for now.
- Add matching object first.
- Remove or rename old `finalSelection` strings only after Admin/mobile are updated.

## Transaction And Race Rules

### First-pick Accept vs Customer Final Selection

Rule:

- Both operations must attempt one conditional transactional match.
- Transaction succeeds only if booking is still `OPEN_MATCHING` and `selectedProviderId` is null.
- First successful transaction sets booking `MATCHED`, writes one `selectedProviderId`, creates/upserts chat room, marks winner participant `SELECTED`, records event/audit, and closes matching.
- Losing transaction returns conflict/idempotent already matched response.

Recommended error for loser:

- HTTP `409 Conflict`
- code: `BOOKING_ALREADY_MATCHED`
- include current `selectedProviderId` and `matchSource` if safe for caller.

### Two Partners Joining Simultaneously

Rule:

- Joining is not final matching.
- Existing unique key `bookingId_providerProfileId` prevents duplicate participant rows for the same Partner.
- Different eligible Partners can join in parallel while booking is `OPEN_MATCHING`.
- If booking becomes `MATCHED` during join, join should fail with `BOOKING_ALREADY_MATCHED` or return non-participating current state.

### First-pick Accept After Timeout

Rule:

- API must compare current time to first-pick deadline inside the transaction.
- If expired and no explicit valid grace policy exists, first-pick accept cannot auto-match.
- If booking is still open, first-pick may become an accepted/customer-selectable participant only if policy allows late acceptance.
- Otherwise record rejected/expired attempt and return `FIRST_PICK_WINDOW_EXPIRED`.

Recommended MVP:

- No silent grace period.
- After timeout, customer selection from participating Partners is required unless first-pick had already accepted before timeout.

### Customer Selection After Already Matched

Rule:

- If booking is already `MATCHED`, customer selection endpoint must not change `selectedProviderId`.
- Return `409 BOOKING_ALREADY_MATCHED` or idempotent success only when the requested Partner is already the selected Partner.
- Do not switch final Partner without explicit audited Admin repair path.

## Required Audit/Event Records

Current schema has `AdminAuditLog`, `Notification`, `BookingParticipant`, `ChatRoom`, and booking `metadata`.

Required records for matching:

- `booking.created`
  - booking id, customer id, preferred Partner id, address snapshot id, service id, payment method
- `booking.opened`
  - matching policy snapshot, marketplace open mode, first-pick deadline, eligible marketplace radius
- `first_pick.requested`
  - booking id, preferred Partner id, notification id
- `provider.joined`
  - booking id, Partner id, distance snapshot, wallet gate snapshot, provider status at join
- `provider.accepted`
  - booking id, Partner id, first-pick flag, acceptedAt, acceptance validity
- `provider.rejected`
  - booking id, Partner id, first-pick flag, rejectedAt
- `booking.matched`
  - booking id, selected Partner id, matchSource, transaction winner, previous status, next status
- `matching.race_lost`
  - attempted actor, attempted action, winning selected Partner id, reason
- `chat.opened`
  - booking id, chat room id, selected Partner id
- `wallet.gate.checked`
  - Partner id, booking id, wallet debt amount, gate result, gate stage

Recommended storage:

- Use a dedicated `BookingEvent` or `MatchingEvent` model if a migration is approved.
- Until then, write structured metadata into `AdminAuditLog` for Admin/API actions and retain participant/chat/payment records.

## Files That Must Change Later

Protected API:

- `apps/api/src/matching/matching.policy.ts`
- `apps/api/src/matching/matching.policy.spec.ts`
- `apps/api/src/matching/matching.service.ts`
- `apps/api/src/matching/matching.gateway.ts`
- `apps/api/src/bookings/bookings.policy.ts`
- `apps/api/src/bookings/bookings.policy.spec.ts`
- `apps/api/src/bookings/bookings.service.ts`
- `apps/api/src/bookings/bookings.service.spec.ts`
- `apps/api/src/bookings/bookings.response.ts`
- `apps/api/src/bookings/bookings.response.spec.ts`
- `apps/api/src/bookings/bookings.controller.ts`
- `apps/api/src/provider-wallet/provider-wallet.policy.ts`
- `apps/api/src/provider-wallet/provider-wallet.policy.spec.ts`

Contract/shared:

- `packages/shared-types/src/index.ts`
- `docs/api/routes.md`
- `docs/architecture/hands-mvp-final-authority.md`
- `docs/architecture/master-progress-roadmap.md`
- `docs/architecture/realtime-matching.md`
- `docs/architecture/product-intent.md`

Admin:

- `apps/admin_web/lib/operations-policy.ts`
- `apps/admin_web/lib/operations-policy.spec.ts`
- `apps/admin_web/app/operations-policy/page.tsx`
- `apps/admin_web/app/operations-policy/policy-enforcement-trace.ts`
- `apps/admin_web/app/operations-policy/policy-impact-details.ts`
- `apps/admin_web/app/bookings/**`
- `apps/admin_web/app/page.tsx`
- `apps/admin_web/app/setup/page.tsx`
- `apps/admin_web/lib/admin-navigation.ts`
- `apps/admin_web/lib/admin-participant-ledger-copy.ts`
- `apps/admin_web/lib/booking-*.ts`

Smoke/guards:

- `infra/scripts/api-smoke.mjs`
- `infra/scripts/api-domain-smoke.mjs`
- `infra/scripts/check-api-policy-coverage.mjs`
- `infra/scripts/check-final-authority.mjs`
- `infra/scripts/admin-web-smoke.mjs`
- `infra/scripts/check-admin-visible-copy.mjs`

Do not modify:

- `apps/customer_app`
- `apps/provider_app`

## Recommended Implementation Order

1. Contract docs and static guards
   - Update final authority docs.
   - Update authority guard markers.
   - Replace absolute "customer always selects" copy with conditional first-pick priority wording.

2. API tests first
   - Add failing tests for first-pick accept first -> `MATCHED`.
   - Add failing tests for customer selection losing race -> conflict.
   - Add failing tests for first-pick accept after timeout.
   - Add failing tests for parallel marketplace visibility/join while first-pick pending.

3. Matching policy cleanup
   - Deprecate effective delayed marketplace behavior.
   - Normalize `AFTER_FIRST_PICK_DELAY` to immediate for MVP runtime, or block it as policy conflict.

4. Transactional match implementation
   - Centralize match finalization in one API method.
   - Use transaction + conditional update.
   - Set exactly one selected Partner.
   - Mark winner participant `SELECTED`.
   - Create/upsert chat room.
   - Emit `booking.matched`.
   - Record audit/event metadata.

5. API response shape
   - Add `matching` object.
   - Keep existing top-level fields for compatibility.
   - Update shared types.

6. Admin alignment
   - Update operations policy page.
   - Update booking monitor/detail copy.
   - Update Admin smoke expectations.

7. Seed + smoke
   - Add scenario for first-pick accept first.
   - Add scenario for other Partner joins before first-pick.
   - Add scenario for customer final selection when first-pick does not win.
   - Add race/conflict smoke where practical.

## Recommended Verification Plan

Docs-only contract pass:

- `npm.cmd run authority:check`

Protected API matching pass:

- Focused tests:
  - `npm.cmd run --workspace apps/api test -- bookings.service.spec.ts bookings.policy.spec.ts matching.policy.spec.ts --runInBand`
- Scope:
  - `npm.cmd run verify:api:fast`
- Contract:
  - `npm.cmd run authority:check`

Admin copy/policy pass:

- Focused Admin tests for changed modules.
- `npm.cmd run verify:admin:fast`

Smoke pass:

- Start Docker PostgreSQL/Redis.
- Run local services.
- Run focused smoke for matching/payment/wallet.
- Avoid full `verify:local -WithServices` until the protected API behavior is stable.

Merge readiness:

- `npm.cmd run verify:local`
- With services only after DB/Redis/matching/payment integration changes are complete.
