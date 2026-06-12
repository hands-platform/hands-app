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
npm.cmd run external:check:push
npm.cmd run security:secrets
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
Use `npm.cmd run fcm:push-smoke -- --env=.env` when the smoke-only values live in an env file. The script merges that file with the current shell environment and masks the raw device token in errors.
Use `npm.cmd run fcm:push-smoke -- --dry-run` to confirm the merged env, selected role/phone/platform, credential readiness, and next push-smoke actions before sending a live retry. This mode is config-only and does not contact the API or FCM.
Use `npm.cmd run fcm:push-smoke -- --preflight` to check API readiness, selected notification availability, and device readiness without sending FCM.
When the selected app session has already registered an enabled push device, set `FCM_SMOKE_USE_REGISTERED_DEVICE=true` to run live push without copying the raw device token into the shell.

## Expected Result

The script prints a JSON object with `ok: true` and IDs for the booking, chat room, review, payout batch, refund, and verification file.

The FCM token smoke prints `ok: true` after synthetic customer/provider device tokens are registered and disabled. The live FCM smoke uses a real token or an already registered enabled device from the selected role, phone, and platform, then prints `ok: true`, the notification id, and the latest delivery provider/status without printing the raw device token.
