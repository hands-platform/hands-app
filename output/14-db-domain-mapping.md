# DB Domain Mapping

Internal schema names may still use `Provider` for compatibility. Visible product/admin language should use Partner.

## User/Auth

- `User`
- `CustomerProfile`
- `ProviderProfile`
- `AppSession`
- `ProviderSession`
- `ProviderDevice`

## Customer

- `CustomerProfile`
- `CustomerSelectedLocation`
- `Booking`
- `Review`
- `Coupon`
- `Refund`

## Partner

- `ProviderProfile`
- `ProviderKyc`
- `ProviderDocument`
- `ProviderBankAccount`
- `ProviderTaxProfile`
- `ProviderAgreement`
- `ProviderVerificationLog`
- `ProviderService`
- `ProviderEarning`
- `ProviderPayoutBatch`
- `ProviderWalletLedgerEntry`
- `LocationSnapshot`

## Services and Pricing

- `MassageService`
- `ServiceDurationOption`
- `ProviderService`
- `ServicePayoutRule`
- `PlatformFeePolicyVersion`
- `PlatformFeeRule`

## Booking and Matching

- `Booking`
- `BookingAddressSnapshot`
- `BookingService`
- `BookingParticipant`
- `BookingOpsTask`
- `OperationalPolicySetting`

## Payment and Settlement

- `Payment`
- `Refund`
- `ProviderEarning`
- `ProviderPayoutBatch`
- `ProviderWalletLedgerEntry`
- `ProviderPlatformFeeLog`
- `ProviderTaxLog`
- `WithholdingLog`

## Tax

- `TaxPolicyVersion`
- `TaxRule`
- `ProviderTaxProfile`
- `ProviderTaxLog`
- `WithholdingLog`

## Chat

- `ChatRoom`
- `ChatMessage`

## Notifications

- `Notification`
- `PushDevice`
- `NotificationDelivery`

## Files

- `FileAsset`
- `ProviderDocument`

## Admin Operations

- `AdminAuditLog`
- `ProviderReport`
- `ProviderSanction`
- `OperationalPolicySetting`

## Rename Note

Do not rename schema models during ordinary feature work. A full Provider-to-Partner model rename should be a dedicated migration with API, mobile, admin, seed, smoke, and history compatibility planning.
