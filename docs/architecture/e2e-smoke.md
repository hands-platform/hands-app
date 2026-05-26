# End-to-End Smoke Flow

`infra/scripts/api-smoke.mjs` is the local MVP confidence test. Run it after Postgres, Redis, migrations, seed data, and the API server are available.

## Coverage

- Demo OTP login for customer, provider, and admin.
- Push device token registration.
- Provider verification upload contract.
- Provider verification submission.
- Admin provider approval.
- Private verification file read-url.
- Booking creation with cash payment.
- Provider online/location update.
- Provider joins open matching job.
- Customer selects final provider.
- Chat message creation.
- Service completion.
- Customer review with tip.
- Provider earnings and summary.
- Service duration option pricing, provider custom price validation, payout-rule fee calculation, and admin finance trace.
- Admin payout batch creation.
- Admin payment refund.
- Admin refund listing.
- Customer notification listing.

## Command

```powershell
$env:API_BASE_URL='http://localhost:3100/api'
node infra/scripts/api-smoke.mjs
```

## Expected Result

The script prints a JSON object with `ok: true` and IDs for the booking, chat room, review, payout batch, refund, and verification file.
