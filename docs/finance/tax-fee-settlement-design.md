# HANDS Tax, Fee, and Settlement Design

This document defines the HANDS finance model for booking settlement, partner
withholding, platform fee VAT split, payment processing fees, and monthly tax
closing. It is an implementation contract for operator-configured rules. It is
not tax or legal advice.

## Authority

- NestJS owns settlement calculation, booking state, authorization, payment,
  wallet, payout, tax closing, and audit decisions.
- Supabase/Postgres stores data. Admin Web and mobile apps must not perform
  critical finance writes directly.
- Historical finance rows are immutable. Settings can change only future
  settlements.
- Visible product language is Partner. Existing schema and code may continue
  to use Provider for compatibility.

## Existing Structures to Reuse

The current system already contains the finance foundation:

- `ProviderEarning`: booking-level partner earning and wallet delta.
- `ProviderTaxLog`: partner withholding log.
- `ProviderPlatformFeeLog`: platform fee log.
- `WithholdingLog`: withholding rows linked to payout batches.
- `TaxPolicyVersion` and `TaxRule`: effective-dated tax rules.
- `PlatformFeePolicyVersion` and `PlatformFeeRule`: effective-dated platform fee
  rules.
- `ProviderWalletLedgerEntry`: append-friendly partner wallet audit mirror.
- `CustomerWalletLedgerEntry`: customer wallet audit mirror.
- `AdminAuditLog`: admin action evidence.

The implementation must extend this foundation instead of replacing it.

## Finance Language

Admin copy must preserve these distinctions:

- "Partner VAT/PIT is withholding tax collected and remitted on behalf of
  partners."
- "Customer payment amount is not company revenue."
- "Company revenue is platform fee net of company output VAT."
- "Payment processing fee is not tax and must be tracked separately."
- "Tax and fee rates are effective-dated and snapshotted at settlement time."
- "Historical settlements are not recalculated when settings change."
- "Closed periods require reversal entries, not direct edits."

## Core Formula

All amounts are integer VND. Percentage calculations use basis points and round
to the nearest VND:

```text
rounded_bps_amount = round(base_amount * rate_bps / 10000)
```

For a completed non-cash booking:

```text
customer_payment_amount = captured payment amount or booking service total
partner_taxable_revenue = customer_payment_amount
partner_vat_amount = round(partner_taxable_revenue * partner_vat_bps / 10000)
partner_pit_amount = round(partner_taxable_revenue * partner_pit_bps / 10000)
partner_withholding_total = partner_vat_amount + partner_pit_amount

platform_fee_gross = customer_payment_amount - partner_payout_amount - partner_withholding_total
platform_fee_net_revenue = round(platform_fee_gross / (1 + platform_vat_bps / 10000))
company_output_vat = platform_fee_gross - platform_fee_net_revenue

payment_processing_fee = configured processor fee for the payment method, tracked separately as an operating cost
```

Example:

```text
customer_payment_amount = 600000
partner_payout_amount = 388000
partner_vat_bps = 500
partner_pit_bps = 200
platform_vat_bps = 800

partner_vat_amount = 30000
partner_pit_amount = 12000
partner_withholding_total = 42000
platform_fee_gross = 170000
platform_fee_net_revenue = 157407
company_output_vat = 12593
payment_processing_fee = 0
```

The example keeps a 170000 gross platform fee and stores the partner payout
after withholding. The settlement snapshot must store the selected rules and
final amounts, not recalculate them from future policy changes.

## Payment Method Rules

### Cash

For `CASH`, the partner receives customer cash directly.

- HANDS must not credit the partner wallet with the customer payment.
- The partner wallet impact is negative for amounts the partner owes HANDS:

```text
partner_wallet_delta = -(platform_fee_gross + partner_withholding_total)
```

- Platform fee gross, company output VAT, partner VAT, and partner PIT remain
  recognized in the settlement snapshot.
- Finance clears the debt when the partner deposits money to HANDS or admin
  approves a documented offset against later positive payouts.

### Non-Cash

For card, bank transfer, MoMo, VNPay, and similar non-cash methods:

```text
partner_wallet_delta = partner_payout_amount
```

- HANDS receives customer funds.
- Partner payout is the actual wallet credit after withholding; partner withholding is tracked as a separate tax payable.
- Payment processing fee is snapshotted separately and never mixed into tax.

### Customer Wallet

For `CUSTOMER_WALLET`:

- The customer wallet liability decreases.
- No customer wallet credit is created.
- Settlement still records partner payout, partner withholding, platform fee
  gross/net/output VAT, and any configured internal processing fee.

## Required Snapshot Layer

Add a booking-level settlement snapshot rather than relying only on mutable
earning totals. Suggested model name:

```text
BookingSettlementSnapshot
```

Required fields:

- `bookingId` unique
- `customerProfileId`
- `providerProfileId`
- `paymentId`
- `paymentMethod`
- `currency`
- `customerPaymentAmount`
- `partnerPayoutAmount`
- `partnerTaxableRevenue`
- `partnerVatRateBps`
- `partnerVatAmount`
- `partnerPitRateBps`
- `partnerPitAmount`
- `partnerWithholdingTotal`
- `platformFeeGross`
- `platformVatRateBps`
- `platformFeeNetRevenue`
- `companyOutputVat`
- `paymentFeePolicyVersionId`
- `paymentFeeRateBps`
- `paymentFeeFixedAmount`
- `paymentProcessingFee`
- `paymentFeePayer`
- `taxPolicyVersionId`
- `taxRuleSnapshot`
- `platformFeePolicyVersionId`
- `platformFeeRuleSnapshot`
- `paymentFeeRuleSnapshot`
- `providerEarningId`
- `providerTaxLogIds`
- `providerPlatformFeeLogId`
- `providerWalletLedgerEntryIds`
- `customerWalletLedgerEntryIds`
- `settlementStatus`
- `taxStatus`
- `monthlyPeriod`
- `postedAt`
- `closedAt`
- `reversalOfId`
- `reversedById`
- `createdAt`
- `updatedAt`

The first implementation may keep rule snapshots in `Json` fields and use
existing `ProviderEarning`, `ProviderTaxLog`, and `ProviderPlatformFeeLog`
relations for operational detail.

## Partner Withholding Tax

Partner VAT and PIT must be tracked as partner withholding tax.

Recommended implementation:

- Extend `ProviderTaxLog` with a tax kind if the schema change is accepted:
  `PARTNER_VAT`, `PARTNER_PIT`.
- Create two tax log rows per completed booking when both rates are active.
- Keep `ProviderEarning.withholdingAmount` as the total VAT plus PIT for wallet
  compatibility.
- Link `WithholdingLog` to the specific `ProviderTaxLog` rows when payout or
  monthly closing requires withholding evidence.

If changing `ProviderTaxLog` is too risky in the first code slice, store the
two-line breakdown in the settlement snapshot and keep one combined
`ProviderTaxLog` row until the migration is approved.

## Platform Fee and Company Output VAT

`ProviderPlatformFeeLog` continues to track the selected platform fee rule and
gross platform fee. The settlement snapshot stores:

- gross platform fee
- platform VAT rate
- net company revenue
- company output VAT

This avoids rewriting existing platform fee log consumers while giving monthly
finance pages the VAT split they need.

## Payment Processing Fees

Payment processing fee is not tax.

Add effective-dated payment fee settings. Suggested models:

```text
PaymentFeePolicyVersion
PaymentFeeRule
```

Rules should support:

- method: `CASH`, `CARD`, `BANK_TRANSFER`, `CUSTOMER_WALLET`, `MOMO`, `VNPAY`,
  `MANUAL`
- fee type: `RATE`, `FIXED`, `RATE_PLUS_FIXED`
- rate bps
- fixed amount
- payer: `HANDS`, `CUSTOMER`, `PARTNER`, `SHARED`
- treatment: `OPERATING_EXPENSE`, `PASS_THROUGH`, `MANUAL_REVIEW`
- effective dates
- status

Settlement snapshots must store the policy version and rule snapshot.

## Monthly Tax Closing

Monthly closing is an admin-controlled process over settlement snapshots.

Suggested model:

```text
MonthlyTaxClosing
```

Minimum fields:

- `period`
- `currency`
- `status`: `DRAFT`, `REVIEWED`, `DECLARED`, `PAID`, `CLOSED`, `REVERSED`
- `platformFeeGrossTotal`
- `platformFeeNetRevenueTotal`
- `companyOutputVatTotal`
- `partnerVatWithheldTotal`
- `partnerPitWithheldTotal`
- `partnerWithholdingTotal`
- `paymentProcessingFeeTotal`
- `cashDebtTotal`
- `nonCashPartnerPayoutTotal`
- `settlementCount`
- `declaredAt`
- `paidAt`
- `closedAt`
- `createdById`
- `reviewedById`
- `declaredById`
- `paidById`
- `closedById`
- `notes`
- `createdAt`
- `updatedAt`

Closed periods cannot be directly edited. Corrections require reversal entries.

## Admin Pages

Add finance pages in small slices:

1. Tax & Fee Settings
   - Partner service withholding settings.
   - Platform VAT settings.
   - Payment processing fee settings.
   - Effective dates and status.

2. Tax Overview
   - Current month summary.
   - Today/needs action first.
   - Separate summary API from paged list API.

3. Partner Withholding Tax
   - VAT/PIT lines.
   - Partner filter, period filter, booking link.
   - CSV export by selected period.

4. Platform VAT
   - Gross platform fee, net company revenue, output VAT.
   - Period and booking drilldown.

5. Payment Fees
   - Fee by payment method and period.
   - Processing cost separate from tax.

6. Monthly Tax Closing
   - Draft review, declare, mark paid, close, reverse.
   - No direct mutation after close.

7. Booking Settlement Audit
   - One booking settlement snapshot at a time.
   - Linked earning, tax logs, platform fee log, payment callback evidence,
     wallet ledger entries, and admin audit logs.

## API Boundaries

All write APIs must be NestJS admin or internal service APIs:

- Create/update tax settings.
- Create/update payment fee settings.
- Post booking settlement snapshot.
- Declare monthly closing.
- Mark monthly closing paid.
- Close monthly period.
- Reverse settlement or closing.

Admin Web may call these APIs, but must not calculate or write settlement rows
directly.

## Idempotency and Transactions

Posting a booking settlement must run in one transaction:

1. Lock or fetch the completed booking and payment.
2. Resolve effective tax, platform fee, and payment fee rules by `occurredAt`.
3. Calculate integer VND amounts.
4. Upsert `ProviderEarning` by `bookingId`.
5. Upsert platform fee log.
6. Create or upsert VAT/PIT tax logs.
7. Upsert partner wallet ledger entry using stable `sourceKey`.
8. Upsert customer wallet ledger entry when payment method is customer wallet.
9. Upsert booking settlement snapshot by `bookingId`.
10. Write admin/system audit evidence.

Repeated calls for the same completed booking must not duplicate ledger rows.

## Validation and Test Coverage

Required focused tests:

- VAT/PIT calculation uses basis points and integer VND rounding.
- Platform fee VAT split calculates net revenue and output VAT.
- CASH creates negative partner wallet delta.
- Non-cash creates partner payout credit net of withholding.
- Customer wallet reduces liability without customer wallet credit.
- Effective-dated policies select the correct version.
- Historical settlement does not change after policy edit.
- Duplicate settlement post is idempotent.
- Payment fee is stored separately from tax.
- Monthly closing totals only included settlement snapshots in the period.
- Declared/paid/closed periods reject direct edits.
- Reversal creates new entries and links to the original.
- Admin setting changes write audit logs.
- Admin closeout actions write audit logs.

## Rollout Plan

1. Document the model and add calculation tests.
2. Add pure calculation helper module.
3. Add Prisma migration for payment fee settings and settlement snapshots.
4. Generate Prisma client.
5. Add NestJS settlement posting service with idempotency.
6. Wire booking completion to settlement posting.
7. Add admin summary/list APIs with server pagination.
8. Add Admin Web settings and finance pages.
9. Add CSV export and monthly closing actions.
10. Run focused API tests, typecheck, Prisma validate/generate, and smoke checks.

Do not introduce real tax-rate claims in UI. Admin settings are operator
configured and effective-dated.
