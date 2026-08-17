# End-to-End Smoke Flow

`npm.cmd run api:smoke` is the local MVP confidence test. It runs `infra/scripts/api-smoke.mjs` after Postgres, Redis, migrations, seed data, and the API server are available.

## Coverage

- Demo OTP login for customer, provider, and admin.
- Push device token registration.
- Provider verification upload contract.
- Provider verification submission.
- Admin partner approval.
- Private verification file read-url.
- Booking creation with cash payment.
- Provider online/location update.
- Partner participates in an open marketplace booking.
- Customer selects final partner.
- Chat message creation.
- Service completion.
- Customer review without customer tip or gratuity payment coverage.
- Provider earnings and summary.
- Service duration option pricing, provider custom price validation, payout-rule fee calculation, and admin finance trace.
- Admin payout batch creation.
- Admin payment refund.
- Admin refund listing.
- Customer notification listing.

## Command

```powershell
$env:API_BASE_URL='http://localhost:3000/api'
npm.cmd run api:smoke
```

For a smaller check of the real CASH booking path, use a disposable local Postgres database/schema and
Redis instance. The smoke fails closed unless both targets are explicitly allowlisted:

```powershell
$env:DATABASE_URL='postgresql://massage:massage@127.0.0.1:5432/hands_integration_local?schema=hands_integration_local'
$env:INTEGRATION_DATABASE_ALLOWLIST='hands_integration_local:hands_integration_local'
$env:REDIS_URL='redis://127.0.0.1:6379'
$env:INTEGRATION_REDIS_ALLOWLIST='redis://127.0.0.1:6379'
npx.cmd prisma migrate deploy --schema apps/api/prisma/schema.prisma
npm.cmd run build --workspace @massage-vn/api
npm.cmd run bookings:cash-lifecycle-smoke
```

Use only an empty, disposable target matching the integration naming convention. Drop the disposable
database or schema after the run. The smoke intentionally preserves append-only finance and audit
evidence inside that disposable target instead of deleting immutable rows during cleanup.

To verify the same reconciled fixture through the authenticated Admin Web detail pages, keep the local
Admin Web and its API running, configure the normal Admin smoke login variables, and run:

```powershell
npm.cmd run bookings:cash-lifecycle-admin-smoke
```

For the smallest Customer App and Partner App contract path, use the same disposable environment and run:

```powershell
npm.cmd run mobile:paired-e2e
```

This isolated smoke creates one marketplace CASH booking and verifies the same API paths used by both Flutter apps: Customer creation, Partner open-list visibility, join and acceptance, Customer final Partner selection, two-way chat, Partner start/completion, and completed history visibility for both roles. It also checks the resulting settlement journal. It refuses production, non-allowlisted Postgres/Redis targets, and real payment-gateway environments. The disposable database or schema is the cleanup boundary.

This adds direct assertions for the Partner bank deposit, General Ledger, and Bank Reconciliation detail
routes, plus the refunded CASH booking's Settlement Audit and Reversal detail, while the fixture exists.
The Admin smoke acquires the regular operator session and does not print or persist the session cookie.
Dispose of the allowlisted database/schema after the review rather than deleting immutable finance and
audit evidence row by row.

Online payment clearing is intentionally separate because CASH must not create a gateway clearing row.
To verify MoMo and VNPay open-period refunds, plus a CARD closed-period refund that preserves the original
settlement and creates a separate reversal record, then open its Payment Clearing, Settlement Audit, and
Reversal evidence through Admin Web, run:

```powershell
npm.cmd run payments:lifecycle-admin-smoke
```

This isolated smoke uses a dedicated local API port and temporary customer, Partner, KYC, service,
booking, and accounting records. It calls the customer and Partner HTTP APIs for booking creation,
first-pick acceptance, start, and completion. It also verifies pre-match cancellation, admin no-show
review, and dual-admin refund behavior. The checks cover CASH payment release/capture/refund, Partner
wallet debt and reversal, settlement snapshots, blocked no-show payment review, and balanced settlement
and reversal journals. A final completed booking verifies Partner debt recovery through a maker-created
bank deposit request, separate finance approval, debt allocation, company bank transaction matching,
balanced deposit journal, and restored Partner wallet. The script then removes all fixtures. It refuses
to run in production or while real MoMo/VNPay gateway flags are enabled.

To verify a Partner wallet withdrawal from request through dual-admin paid closeout, immutable and
balanced General Ledger journals, company-bank outflow, and Bank Reconciliation, run:

```powershell
npm.cmd run build --workspace @massage-vn/api
npm.cmd run finance:provider-withdrawal-admin-smoke
```

The smoke accepts only an explicitly allowlisted disposable Postgres database/schema and loopback Redis
target, starts an isolated API on port `3004` by default, and uses the disposable schema as its cleanup
boundary so immutable wallet, journal, and audit evidence is never deleted row by row. The Admin variant
also checks the Payouts list, both withdrawal journals, and the matched Bank Reconciliation detail through
the authenticated Admin Web session. It never calls a real bank API.

Historical `PAID` withdrawals created before persistent withdrawal journals can be audited with the
dry-run-only default command:

```powershell
npm.cmd run finance:provider-withdrawal-journal-backfill
```

Apply only after every row is eligible and `blocked` is `0`:

```powershell
npm.cmd run finance:provider-withdrawal-journal-backfill -- --apply --actor-id=<admin-user-id>
```

The backfill refuses production and remote databases, requires an existing Admin actor, blocks CLOSED
monthly periods, validates the paid wallet debit and bank-transfer evidence, never modifies an existing
POSTED journal, and writes one Admin audit record per repaired withdrawal.

For a temporary Admin UI evidence review, run the same smoke in an interactive terminal with
`npm.cmd run bookings:cash-lifecycle-smoke -- --preview`. The first pause exposes the open CASH debt in
Cash Settlements. Press Enter to complete the deposit lifecycle; the second pause exposes direct local
Admin routes for the Partner bank deposit, its general-ledger journal, and the matched bank transaction.
Press Enter again to stop the isolated API, then dispose of the allowlisted database/schema. Do not use
preview mode in unattended automation.

For a smaller FCM-push-only check after Firebase Admin credentials and a real device token are available:

```powershell
$env:API_BASE_URL='http://localhost:3000/api'
npm.cmd run external:check:push
npm.cmd run security:secrets
npm.cmd run notifications:push-data-contract
npm.cmd run notifications:retry-audit-contract
npm.cmd run fcm:credentials-check
npm.cmd run docker:contract
npm.cmd run fcm:token-smoke
$env:FCM_SMOKE_ROLE='CUSTOMER'
$env:FCM_SMOKE_PHONE='+84900000001'
$env:FCM_SMOKE_DEVICE_TOKEN='<real app FCM token>'
$env:FCM_SMOKE_PLATFORM='android'
$env:FCM_SMOKE_EXPECT_PROVIDER='FCM'
$env:FCM_SMOKE_EXPECT_STATUS='SENT'
npm.cmd run fcm:push-smoke
```

Use `npm.cmd run fcm:token-smoke -- --dry-run` to check the token-registration smoke inputs before writing a synthetic device token.
`external:check:push` and `fcm:credentials-check` also verify that the Firebase Admin SDK JSON comes from the same Firebase project as the customer and Partner `google-services.json` files before any live FCM send is attempted.
Use `npm.cmd run fcm:push-smoke -- --env=.env` when the smoke-only values live in an env file. The script merges that file with the current shell environment and masks the raw device token in errors.
Use `npm.cmd run fcm:push-smoke -- --dry-run` to confirm the merged env, selected role/phone/platform, credential readiness, and next push-smoke actions before sending a live retry. This mode is config-only and does not contact the API or FCM.
Use `npm.cmd run fcm:push-smoke -- --preflight` to check API readiness, Firebase project alignment, selected notification availability, and device readiness without sending FCM.
When the selected app session has already registered an enabled push device, set `FCM_SMOKE_USE_REGISTERED_DEVICE=true` to run live push without copying the raw device token into the shell.
Partner-alert notifications follow the `notification.partner_alert_channel` operational policy. If that policy currently routes Partner alerts to `IN_APP_ONLY` and no explicit `FCM_SMOKE_NOTIFICATION_ID` is set, the smoke auto-selects a recent standard notification for the same role/phone when the expected provider is `FCM`; otherwise preflight reports the blocker and suggests a standard-notification id when one exists.

## Expected Result

The script prints a JSON object with `ok: true` and IDs for the booking, chat room, review, payout batch, refund, and verification file.

The FCM token smoke prints `ok: true` after synthetic customer/Partner device tokens are registered and disabled. The live FCM smoke uses a real token or an already registered enabled device from the selected role, phone, and platform, then prints `ok: true`, the notification id, and the latest delivery provider/status without printing the raw device token.
