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

For a smaller OS-push-only check after Firebase Admin credentials and a real device token are available:

```powershell
$env:API_BASE_URL='http://localhost:3000/api'
$env:FCM_SMOKE_DEVICE_TOKEN='<real app FCM token>'
$env:FCM_SMOKE_EXPECT_PROVIDER='FCM'
$env:FCM_SMOKE_EXPECT_STATUS='SENT'
npm.cmd run fcm:push-smoke
```

Use `npm.cmd run fcm:push-smoke -- --env=.env` when the smoke-only values live in an env file. The script merges that file with the current shell environment and masks the raw device token in errors.

## Expected Result

The script prints a JSON object with `ok: true` and IDs for the booking, chat room, review, payout batch, refund, and verification file.

The FCM smoke prints `ok: true`, the notification id, and the latest delivery provider/status without printing the raw device token.
