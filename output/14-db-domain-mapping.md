# DB Domain Mapping

## User/Auth
- User
- CustomerProfile
- ProviderProfile
- AppSession
- ProviderSession
- ProviderDevice

## Customer
- CustomerProfile
- CustomerSelectedLocation
- Booking
- Review
- Coupon
- Refund

## Partner
- ProviderProfile
- ProviderKyc
- ProviderDocument
- ProviderBankAccount
- ProviderTaxProfile
- ProviderAgreement
- ProviderVerificationLog
- ProviderService
- ProviderEarning
- ProviderPayoutBatch
- ProviderWalletLedgerEntry
- LocationSnapshot

## Services and Pricing
- MassageService
- ProviderService
- ServicePayoutRule
- PlatformFeePolicyVersion
- PlatformFeeRule

## Booking and Matching
- Booking
- BookingService
- BookingParticipant
- BookingOpsTask
- OperationalPolicySetting

## Payment and Settlement
- Payment
- Refund
- ProviderEarning
- ProviderPayoutBatch
- ProviderWalletLedgerEntry
- ProviderPlatformFeeLog
- ProviderTaxLog
- WithholdingLog

## Tax
- TaxPolicyVersion
- TaxRule
- ProviderTaxProfile
- ProviderTaxLog
- WithholdingLog

## Chat
- ChatRoom
- ChatMessage

## Notifications
- Notification
- PushDevice
- NotificationDelivery

## Files
- FileAsset
- ProviderDocument

## Admin Operations
- AdminAuditLog
- ProviderReport
- ProviderSanction
- OperationalPolicySetting

## Naming Note
- Existing schema still uses Provider in many model names.
- Product/admin visible wording should use Partner.
- Rename DB models only in a planned migration, not during documentation cleanup.
