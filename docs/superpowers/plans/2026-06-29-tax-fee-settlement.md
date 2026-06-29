# Tax Fee Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. HANDS constraint: execute with the main agent only; do not use child agents, spawn_agent, or subagents.

**Goal:** Add a safe, auditable HANDS tax, fee, payment fee, settlement snapshot, and monthly closing foundation without breaking existing booking, wallet, payment, or payout flows.

**Architecture:** Reuse the current `ProviderEarning`, `ProviderTaxLog`, `ProviderPlatformFeeLog`, wallet ledger, tax policy, and platform fee policy structures. Add only the missing immutable settlement snapshot, payment processing fee policy, VAT/PIT breakdown, and monthly closing layer. All critical writes remain inside NestJS services and transactions.

**Tech Stack:** NestJS, Prisma, Postgres/Supabase infrastructure, Next.js Admin Web, Vitest/Jest-style tests, TypeScript.

---

## File Structure

- Create `apps/api/src/settlements/settlement-calculator.ts`: pure integer VND calculation helpers.
- Create `apps/api/src/settlements/settlement-calculator.spec.ts`: calculation tests for cash, non-cash, customer wallet, VAT split, and rounding.
- Modify `apps/api/prisma/schema.prisma`: add payment fee policy models, settlement snapshot model, monthly closing model, and enum fields after the calculation helper is covered.
- Modify `apps/api/src/earnings/earnings.service.ts`: call the settlement posting path from completed booking earnings after migration exists.
- Create `apps/api/src/settlements/settlements.service.ts`: transactional settlement posting, idempotency, snapshot/log/ledger writes.
- Create `apps/api/src/settlements/settlements.service.spec.ts`: idempotency and write-boundary tests using mocked Prisma transaction client.
- Modify `apps/api/src/admin/admin.controller.ts`: expose paged admin finance endpoints.
- Modify `apps/api/src/admin/admin.service.ts`: add summary/list actions that query snapshots with limits.
- Modify `apps/admin_web/lib/admin-api.ts`: add admin API types.
- Create Admin pages under `apps/admin_web/app/finance-tax/*` only after API contracts exist.
- Update `docs/architecture/earnings.md`: link the settlement snapshot layer once implemented.
- Update `docs/README.md`: link the active finance design document.

## Task 1: Document Active Finance Contract

**Files:**
- Create: `docs/finance/tax-fee-settlement-design.md`
- Create: `docs/superpowers/plans/2026-06-29-tax-fee-settlement.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Add the finance design document**

Write `docs/finance/tax-fee-settlement-design.md` with the authority, formulas,
payment method flows, snapshot fields, admin pages, API boundaries, idempotency
rules, and tests described in the attached product request.

- [ ] **Step 2: Add this implementation plan**

Write `docs/superpowers/plans/2026-06-29-tax-fee-settlement.md` so follow-up
work can proceed in small, verified commits.

- [ ] **Step 3: Link the active finance design document**

Add `docs/finance/tax-fee-settlement-design.md` to the Payments and settlement
line in `docs/README.md`.

- [ ] **Step 4: Verify docs-only diff**

Run:

```powershell
git diff -- docs/finance/tax-fee-settlement-design.md docs/superpowers/plans/2026-06-29-tax-fee-settlement.md docs/README.md
```

Expected: only documentation changes.

- [ ] **Step 5: Commit**

```powershell
git add docs/finance/tax-fee-settlement-design.md docs/superpowers/plans/2026-06-29-tax-fee-settlement.md docs/README.md
git commit -m "docs(finance): define tax fee settlement model"
```

## Task 2: Add Pure Settlement Calculator

**Files:**
- Create: `apps/api/src/settlements/settlement-calculator.ts`
- Create: `apps/api/src/settlements/settlement-calculator.spec.ts`

- [ ] **Step 1: Write calculation tests**

Create `apps/api/src/settlements/settlement-calculator.spec.ts`:

```ts
import { calculateBookingSettlementAmounts } from './settlement-calculator';

describe('calculateBookingSettlementAmounts', () => {
  it('splits partner withholding and platform output VAT using integer VND', () => {
    expect(
      calculateBookingSettlementAmounts({
        paymentMethod: 'CARD',
        customerPaymentAmount: 600000,
        partnerPayoutAmount: 430000,
        platformFeeGross: 128000,
        partnerVatRateBps: 500,
        partnerPitRateBps: 200,
        platformVatRateBps: 800,
        paymentFeeRateBps: 0,
        paymentFeeFixedAmount: 0,
      }),
    ).toMatchObject({
      partnerVatAmount: 30000,
      partnerPitAmount: 12000,
      partnerWithholdingTotal: 42000,
      platformFeeNetRevenue: 118519,
      companyOutputVat: 9481,
      paymentProcessingFee: 0,
      partnerWalletDelta: 388000,
    });
  });

  it('creates a negative wallet delta for cash bookings', () => {
    expect(
      calculateBookingSettlementAmounts({
        paymentMethod: 'CASH',
        customerPaymentAmount: 600000,
        partnerPayoutAmount: 430000,
        platformFeeGross: 128000,
        partnerVatRateBps: 500,
        partnerPitRateBps: 200,
        platformVatRateBps: 800,
        paymentFeeRateBps: 0,
        paymentFeeFixedAmount: 0,
      }).partnerWalletDelta,
    ).toBe(-170000);
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
npm.cmd --workspace apps/api test -- settlement-calculator
```

Expected: fail because `settlement-calculator.ts` does not exist yet. If this
workspace does not expose that exact script, run the closest existing API
focused test command and record the command in the commit notes.

- [ ] **Step 3: Implement the pure helper**

Create `apps/api/src/settlements/settlement-calculator.ts`:

```ts
export type SettlementPaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'CUSTOMER_WALLET'
  | 'MOMO'
  | 'VNPAY'
  | 'MANUAL';

export type BookingSettlementCalculationInput = {
  paymentMethod: SettlementPaymentMethod;
  customerPaymentAmount: number;
  partnerPayoutAmount: number;
  platformFeeGross: number;
  partnerVatRateBps: number;
  partnerPitRateBps: number;
  platformVatRateBps: number;
  paymentFeeRateBps: number;
  paymentFeeFixedAmount: number;
};

export function bpsAmount(baseAmount: number, rateBps: number) {
  return Math.round((baseAmount * rateBps) / 10000);
}

export function calculateBookingSettlementAmounts(input: BookingSettlementCalculationInput) {
  const partnerTaxableRevenue = input.customerPaymentAmount;
  const partnerVatAmount = bpsAmount(partnerTaxableRevenue, input.partnerVatRateBps);
  const partnerPitAmount = bpsAmount(partnerTaxableRevenue, input.partnerPitRateBps);
  const partnerWithholdingTotal = partnerVatAmount + partnerPitAmount;
  const platformFeeNetRevenue = Math.round(input.platformFeeGross / (1 + input.platformVatRateBps / 10000));
  const companyOutputVat = input.platformFeeGross - platformFeeNetRevenue;
  const paymentProcessingFee =
    bpsAmount(input.customerPaymentAmount, input.paymentFeeRateBps) + input.paymentFeeFixedAmount;
  const partnerWalletDelta =
    input.paymentMethod === 'CASH'
      ? -(input.platformFeeGross + partnerWithholdingTotal)
      : input.partnerPayoutAmount - partnerWithholdingTotal;

  return {
    partnerTaxableRevenue,
    partnerVatAmount,
    partnerPitAmount,
    partnerWithholdingTotal,
    platformFeeNetRevenue,
    companyOutputVat,
    paymentProcessingFee,
    partnerWalletDelta,
  };
}
```

- [ ] **Step 4: Run tests and confirm pass**

Run:

```powershell
npm.cmd --workspace apps/api test -- settlement-calculator
```

Expected: pass for the new helper tests.

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/settlements/settlement-calculator.ts apps/api/src/settlements/settlement-calculator.spec.ts
git commit -m "test(api): cover settlement tax fee calculations"
```

## Task 3: Add Schema Foundation

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_tax_fee_settlement_foundation/migration.sql`

- [ ] **Step 1: Add enums**

Add enums for payment fee rules, settlement status, tax close status, tax line
kind, and monthly closing status.

- [ ] **Step 2: Add payment fee policy models**

Add `PaymentFeePolicyVersion` and `PaymentFeeRule` with effective dates, status,
method, fee type, rate bps, fixed amount, payer, treatment, and audit fields.

- [ ] **Step 3: Add booking settlement snapshot model**

Add `BookingSettlementSnapshot` with a unique `bookingId`, partner/customer/payment
links, all snapshot rates and amounts, policy snapshot JSON fields, status fields,
monthly period, and reversal links.

- [ ] **Step 4: Add monthly tax closing model**

Add `MonthlyTaxClosing` with period totals, status, actor ids, timestamps, notes,
and a unique period/currency key.

- [ ] **Step 5: Validate Prisma**

Run:

```powershell
npm.cmd --workspace apps/api run prisma:validate
npm.cmd --workspace apps/api run prisma:generate
```

Expected: Prisma schema validates and client generation succeeds. If script names
differ, use the repository's existing Prisma validate/generate commands.

- [ ] **Step 6: Commit**

```powershell
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add tax fee settlement schema foundation"
```

## Task 4: Add Settlement Posting Service

**Files:**
- Create: `apps/api/src/settlements/settlements.service.ts`
- Create: `apps/api/src/settlements/settlements.service.spec.ts`
- Modify: `apps/api/src/earnings/earnings.service.ts`

- [ ] **Step 1: Write idempotency test**

Test that posting the same booking settlement twice uses the unique booking
snapshot and stable wallet `sourceKey` instead of duplicating ledger entries.

- [ ] **Step 2: Write cash and non-cash write tests**

Test that `CASH` writes a negative partner wallet delta and non-cash writes a
positive partner wallet delta net of partner withholding.

- [ ] **Step 3: Implement service**

Implement `postForCompletedBooking(bookingId: string)` with a Prisma transaction
that resolves policies, calculates amounts, upserts earning/logs/ledger/snapshot,
and writes audit metadata.

- [ ] **Step 4: Wire earnings flow**

Replace direct tax/platform fee-only posting in `EarningsService.createForCompletedBooking`
with the settlement service while preserving the existing public return shape.

- [ ] **Step 5: Run focused tests**

Run:

```powershell
npm.cmd --workspace apps/api test -- settlements earnings
```

Expected: settlement and earnings tests pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/api/src/settlements apps/api/src/earnings/earnings.service.ts
git commit -m "feat(api): post immutable booking settlement snapshots"
```

## Task 5: Add Admin APIs

**Files:**
- Modify: `apps/api/src/admin/admin.controller.ts`
- Modify: `apps/api/src/admin/admin.service.ts`
- Modify: `apps/api/src/admin/admin.controller.spec.ts`
- Modify: `apps/api/src/admin/admin.service.spec.ts`

- [ ] **Step 1: Add summary endpoints**

Add bounded summary endpoints for current month and selected period. Summaries
must aggregate from settlement snapshots, not from Admin Web calculations.

- [ ] **Step 2: Add paged list endpoints**

Add paged/cursor-capable list endpoints for partner withholding, platform VAT,
payment fees, monthly closing, and settlement audit.

- [ ] **Step 3: Add admin action endpoints**

Add admin actions for closing workflow: review, declare, mark paid, close, and
reverse. Reject direct edits once a period is declared, paid, or closed.

- [ ] **Step 4: Run admin API tests**

Run:

```powershell
npm.cmd --workspace apps/api test -- admin
```

Expected: admin controller/service tests pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/admin
git commit -m "feat(api): expose tax settlement admin endpoints"
```

## Task 6: Add Admin Web Finance Pages

**Files:**
- Modify: `apps/admin_web/lib/admin-api.ts`
- Modify: `apps/admin_web/app/admin-shell.tsx`
- Create: `apps/admin_web/app/finance-tax/*`

- [ ] **Step 1: Add API types**

Add typed response models for settlement summaries, tax line lists, payment fee
lists, monthly closings, and booking settlement audit.

- [ ] **Step 2: Add nav entries**

Add Finance nav items for Tax Overview, Partner Withholding Tax, Platform VAT,
Payment Fees, Monthly Tax Closing, and Booking Settlement Audit.

- [ ] **Step 3: Add pages**

Build pages with the current Vuexy admin section/table style. Default screens
must show current month or needs-action data and must use server pagination.

- [ ] **Step 4: Run Admin checks**

Run:

```powershell
npm.cmd --workspace apps/admin_web run typecheck
```

Expected: Admin Web typecheck passes. If this workspace uses a different script,
run the existing Admin typecheck command.

- [ ] **Step 5: Commit**

```powershell
git add apps/admin_web
git commit -m "feat(admin): add tax settlement finance pages"
```

## Task 7: Final Validation

**Files:**
- No planned source changes unless verification exposes issues.

- [ ] **Step 1: Run safe checks**

Run:

```powershell
just status
just safe-check
```

Expected: pass or report pre-existing failures with evidence.

- [ ] **Step 2: Run targeted smoke**

Run the existing booking completion and admin finance smoke command if present.
If no matching smoke exists, add a follow-up task instead of inventing an
unreviewed smoke flow.

- [ ] **Step 3: Commit follow-up fixes only if needed**

Commit only verified fixes, not broad cleanup.
