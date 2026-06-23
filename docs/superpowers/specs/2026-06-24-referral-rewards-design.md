# Referral Rewards Design

Date: 2026-06-24
Status: Draft for owner review
Scope: Later-phase referral feature, not active MVP behavior until explicitly approved for implementation

## Authority

This design follows the current HANDS authority order:

- `docs/README.md`
- `docs/architecture/hands-mvp-final-authority.md`
- `docs/architecture/master-progress-roadmap.md`

Referral remains outside the active MVP execution path until the owner approves the implementation plan. The design is still useful now because referral touches wallet rewards, booking completion, app install links, fraud checks, and Admin operations.

The business boundary is fixed:

- NestJS owns referral attribution, eligibility, reward calculation, wallet ledger writes, audit records, and Admin approval actions.
- Supabase remains infrastructure. Supabase Auth can identify a signed-up user, but it must not own referral reward rules or critical wallet writes.
- Customer app, Partner app, and Admin Web must not write critical referral rewards directly to the database.
- Visible copy uses Partner. Internal code may keep Provider names for compatibility.
- The feature must not introduce ranking, VIP, tips, franchise/shop logic, or dispatch priority.

## Goals

Customer referral:

- Each customer has a unique referral link.
- A referred customer signs up through that link.
- The referrer receives a customer wallet reward only after the referred customer completes a paid booking.
- Admin can configure the reward as a percentage of net HANDS commission after partner tax/withholding rules.
- Admin can configure maximum reward amount and maximum rewarded referral count.

Partner referral:

- Each Partner has a unique referral link for the Partner app.
- A referred Partner signs up through that link, completes Level 2 approval, and completes the first paid booking.
- The referrer receives a fixed VND reward in the Partner wallet.
- Admin can configure the fixed reward amount, maximum reward amount, and maximum rewarded referral count.

Admin:

- Customer referral pages and Partner referral pages are separate.
- Lists show only parent accounts that have at least one referral attribution or reward.
- Operators can inspect attribution, eligibility event, reward amount, wallet status, fraud flags, and audit history.

## Non-Goals

- No referral ranking, gamification, VIP tier, or dispatch priority.
- No franchise/shop referral tree.
- No automatic payout outside the wallet ledger.
- No direct database mutation from Admin or mobile clients.
- No reward before the qualifying booking/payment event is confirmed by the API.

## Approaches Considered

### Option A: Simple referral code on user rows

Store a referral code and counters directly on customer and Partner rows.

Trade-off: fast to build, but weak auditability and hard to reverse rewards. It mixes marketing attribution with wallet state and makes fraud review harder.

Decision: rejected.

### Option B: Shared referral engine with separate customer and Partner policies

Use one referral attribution and reward model with type-specific policy rules. Customer and Partner screens stay separate, but calculation and audit behavior share one engine.

Trade-off: slightly more schema and service work, but clear audit trail, idempotent reward creation, and safer wallet integration.

Decision: recommended.

### Option C: External referral SaaS

Use a third-party referral platform for tracking and rewards.

Trade-off: faster campaign tooling but extra cost, vendor lock-in, privacy review, and wallet integration complexity.

Decision: defer.

## Recommended Architecture

Use a shared referral domain inside the NestJS API.

Suggested domain objects:

- `ReferralPolicy`
  - `audience`: `CUSTOMER` or `PARTNER`
  - `enabled`
  - customer reward mode: percentage of eligible net commission
  - Partner reward mode: fixed VND amount
  - max reward amount per reward
  - max total reward amount per referrer
  - max rewarded referrals per referrer
  - optional customer max rewarded bookings per referred customer
  - hold period before wallet credit becomes available
  - created/updated audit metadata

- `ReferralCode`
  - owner role and owner id
  - code
  - active state
  - created/updated audit metadata

- `ReferralAttribution`
  - audience
  - referrer id
  - referred account id
  - referral code id
  - install or signup source
  - platform detected from link: Android, iOS, web, unknown
  - attribution status
  - fraud review status
  - created/updated audit metadata

- `ReferralReward`
  - attribution id
  - qualifying booking id
  - wallet owner role and owner id
  - calculation snapshot
  - amount and currency
  - reward status: pending, available, cancelled, reversed, held
  - wallet ledger reference after posting
  - audit metadata

The implementation can map these names to existing Provider-compatible schema naming if needed.

## Customer Referral Flow

1. Existing customer opens the referral share screen in the customer app.
2. API returns the customer referral code and share URL.
3. Friend opens the URL, for example `/r/customer/<code>`.
4. Redirect route records a low-cost click event and detects platform from the user agent.
5. Android users are sent to the Google Play customer app page. iOS users are sent to the App Store customer app page. Unknown platforms go to a neutral download landing page.
6. On signup, the app sends the referral code to the API.
7. API creates one immutable attribution between the referrer and the referred customer.
8. When the referred customer completes a paid booking, the booking/payment closeout flow asks the referral service to evaluate eligibility.
9. API calculates reward from eligible net HANDS commission after partner tax/withholding rules and policy caps.
10. API creates a pending reward and wallet ledger entry according to the hold policy.
11. After the hold period and no reversal event, the reward becomes available in the customer wallet.

Customer reward calculation:

```text
eligible_commission = platform_fee_after_partner_tax_rules
raw_reward = eligible_commission * customer_referral_percent
reward = min(raw_reward, per_reward_cap)
reward is blocked if referrer cap or count cap is already reached
```

The exact net commission formula must reuse the existing payment, fee, tax, and wallet snapshot logic instead of recalculating from Admin UI values.

## Partner Referral Flow

1. Existing Partner opens the referral share screen in the Partner app.
2. API returns the Partner referral code and share URL.
3. Referred Partner opens `/r/partner/<code>`.
4. Redirect route detects platform and sends the user to the Partner app store page.
5. On signup, the Partner app sends the referral code to the API.
6. API creates one immutable Partner referral attribution.
7. The referred Partner completes Level 2 approval.
8. After the referred Partner completes the first paid booking, the booking closeout flow evaluates referral eligibility.
9. API creates a fixed VND reward for the referring Partner, subject to policy caps.
10. Reward posts to the Partner wallet ledger as pending, then available after the configured hold period.

Partner reward calculation:

```text
reward = min(configured_partner_referral_amount_vnd, per_reward_cap)
reward is blocked if referrer cap or count cap is already reached
```

Bank account data is not part of referral eligibility. Bank data is collected when a Partner requests withdrawal or deposit handling.

## Admin Information Architecture

Recommended pages:

- `Referral Settings`
  - Customer policy card
  - Partner policy card
  - caps, hold period, enabled state, audit log

- `Customer Referrals`
  - parent customers with one or more referrals
  - totals: referred signups, eligible completed bookings, pending rewards, available rewards, held/reversed rewards
  - detail page for referred accounts and qualifying booking links

- `Partner Referrals`
  - parent Partners with one or more Partner referrals
  - totals: referred signups, Level 2 approvals, first completed bookings, pending rewards, available rewards, held/reversed rewards
  - detail page for referred Partners and qualifying booking links

Do not list every customer or Partner on referral pages. Only show parent accounts with referral activity.

## API Surface

Customer-facing:

- `GET /customer/referral-code`
- `POST /customer/referrals/claim` during signup or post-auth exchange if signup cannot pass metadata directly
- `GET /customer/referrals/summary`

Partner-facing:

- `GET /partner/referral-code`
- `POST /partner/referrals/claim`
- `GET /partner/referrals/summary`

Public redirect:

- `GET /r/customer/:code`
- `GET /r/partner/:code`

Admin:

- `GET /admin/referrals/customer-policy`
- `PATCH /admin/referrals/customer-policy`
- `GET /admin/referrals/partner-policy`
- `PATCH /admin/referrals/partner-policy`
- `GET /admin/referrals/customers`
- `GET /admin/referrals/customers/:referrerId`
- `GET /admin/referrals/partners`
- `GET /admin/referrals/partners/:referrerId`
- `POST /admin/referrals/rewards/:rewardId/hold`
- `POST /admin/referrals/rewards/:rewardId/release`
- `POST /admin/referrals/rewards/:rewardId/reverse`

Endpoint names can be adjusted to the existing Admin API route style during implementation.

## Reward Lifecycle

Recommended lifecycle:

1. `CODE_CREATED`
2. `LINK_OPENED`
3. `ATTRIBUTION_REGISTERED`
4. `REFERRED_ACCOUNT_ACTIVE`
5. `QUALIFYING_EVENT_MET`
6. `REWARD_PENDING`
7. `REWARD_AVAILABLE`
8. `REWARD_REVERSED` or `REWARD_HELD`

Idempotency requirements:

- One active attribution per referred account and audience.
- One reward per qualifying booking and attribution.
- Reward creation must be safe to retry after payment callback or booking closeout retries.
- Wallet ledger writes must include a stable source key.

## Fraud and Abuse Controls

Block or hold referral rewards when:

- Referrer and referred account are the same person.
- Same phone number, same verified identity, or same device fingerprint is detected.
- The referred account cancels, refunds, or is admin-blocked before the hold period ends.
- The qualifying booking is reversed, fraud-flagged, or manually invalidated.
- The referrer exceeds configured count or amount caps.

Flag for Admin review when:

- Multiple signups come from the same device, IP range, or payment instrument.
- Many referrals complete only minimum-value bookings.
- Referral code was claimed after signup without a valid link-click or install context.

## Cost Controls

- Link clicks are cheap internal events; do not call map, SMS, or push APIs for referral clicks.
- Store redirect must use static configured app store URLs.
- Referral push notifications should be sent only for meaningful events: attribution accepted, reward pending, reward available, reward held, reward reversed.
- Do not send SMS for referral marketing by default.
- Do not geocode referral events.

## Tests and Smoke Checks

API unit tests:

- Customer percentage reward calculation with per-reward cap.
- Customer total reward cap and count cap.
- Partner fixed VND reward calculation.
- Partner Level 2 and first completed booking eligibility.
- Self-referral block.
- Idempotent reward creation for repeated booking closeout.
- Reward reversal when booking/payment is reversed.

API smoke:

- Customer referral signup to completed booking to pending wallet reward.
- Partner referral signup to Level 2 approval to first completed booking to pending wallet reward.
- Admin policy update audit.
- Admin hold, release, and reverse actions.

Admin smoke:

- Customer referral list shows only parent customers with referral activity.
- Partner referral list shows only parent Partners with referral activity.
- Reward detail links to qualifying booking and wallet ledger.

Mobile smoke:

- Customer referral link share opens correct store by platform.
- Partner referral link share opens correct store by platform.
- Referral code is retained through install/signup when the platform supports it.
- Fallback manual claim path works when install attribution is unavailable.

## Safe Implementation Order

1. Keep this design as the referral authority note and get owner approval.
2. Write an implementation plan with schema, API, Admin, mobile, and smoke slices.
3. Add disabled-by-default referral policy models and API service scaffolding.
4. Add calculation tests before wallet writes.
5. Add Admin settings pages.
6. Add customer referral list/detail pages.
7. Add Partner referral list/detail pages.
8. Add mobile share-link screens.
9. Add redirect routes and app store URL configuration.
10. Enable only after API, Admin, wallet, and smoke checks pass.

## Decisions Fixed By This Spec

- Customer and Partner referral systems are separate in Admin and mobile UX.
- Customer referral reward is a percentage of eligible net HANDS commission.
- Partner referral reward is a fixed VND amount.
- Referral pages list only parent accounts with referral activity.
- Wallet rewards are written only by the NestJS API.
- Reward lifecycle must be auditable and idempotent.
- Bank account collection is unrelated to referral eligibility.

## Decisions To Confirm Before Implementation

- Customer reward hold period. Recommended default: 7 days after paid completion.
- Partner reward hold period. Recommended default: 7 days after first paid completion.
- Customer referral scope. Recommended default: reward only on the referred customer's first paid completed booking, with schema support for multiple rewarded bookings later.
- Exact customer and Partner app store URLs.
- Whether a neutral web landing page is needed before the app stores.
- Whether manual referral code entry is allowed after signup. Recommended default: allow only within a short window and require Admin audit if no click/install context exists.

## Spec Self-Review

- Incomplete-section scan: no empty or temporary sections remain.
- Consistency check: the design keeps NestJS as the business authority and keeps Supabase as infrastructure.
- Scope check: this is a single referral rewards feature with separate customer and Partner surfaces.
- Ambiguity check: reward modes, list scope, wallet ownership, and deferred MVP status are explicit.
