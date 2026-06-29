# Partner Wallet Accounting Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first safe foundation for Partner wallet deposit allocation and prepaid cash-booking deduction accounting.

**Architecture:** Reuse the existing `ProviderEarning` and `ProviderWalletLedgerEntry` model instead of creating a new wallet system. This first slice only adds pure policy helpers and tests, so later DB/API/UI work can depend on stable calculations without changing production accounting writes yet.

**Tech Stack:** NestJS API, TypeScript, Vitest, Prisma enum consumers.

---

## File Structure

- Modify: `C:/dev/massage-on-demand-vn/apps/api/src/earnings/earnings.policy.ts`
  - Add pure helper functions for platform fee VAT split, cash-booking due, partner bank deposit allocation, and prepaid wallet deduction.
- Modify: `C:/dev/massage-on-demand-vn/apps/api/src/earnings/earnings.policy.spec.ts`
  - Add TDD coverage for the accounting examples from the request.

## Task 1: Partner Wallet Accounting Helpers

**Files:**
- Modify: `C:/dev/massage-on-demand-vn/apps/api/src/earnings/earnings.policy.spec.ts`
- Modify: `C:/dev/massage-on-demand-vn/apps/api/src/earnings/earnings.policy.ts`

- [ ] **Step 1: Write failing tests**

Add tests that assert:
- `calculatePlatformFeeBreakdown(128000, 800)` returns gross `128000`, net revenue `118519`, output VAT `9481`.
- `calculateCashBookingPartnerDue(128000, 800, 42000)` returns total due `170000`.
- `allocatePartnerBankDeposit(-170000, 1000000)` applies `170000` to negative wallet and credits `830000` to liability.
- `applyCashBookingDeductionToPartnerWallet(830000, 170000)` uses `170000` liability and creates no receivable.
- `applyCashBookingDeductionToPartnerWallet(150000, 170000)` uses `150000` liability and creates `20000` receivable.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
npm.cmd run test --workspace @massage-vn/api -- apps/api/src/earnings/earnings.policy.spec.ts
```

Expected: FAIL because the new helper exports do not exist.

- [ ] **Step 3: Implement minimal helpers**

Add exported helper functions to `earnings.policy.ts`:
- `calculatePlatformFeeBreakdown(platformFeeGross: number, platformFeeVatRateBps: number)`
- `calculateCashBookingPartnerDue(platformFeeGross: number, platformFeeVatRateBps: number, partnerTaxPayable: number)`
- `allocatePartnerBankDeposit(currentWalletBalance: number, depositAmount: number)`
- `applyCashBookingDeductionToPartnerWallet(currentWalletBalance: number, totalDeduction: number)`

Use integer VND rounding with `Math.round(platformFeeGross / (1 + rate))`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```powershell
npm.cmd run test --workspace @massage-vn/api -- apps/api/src/earnings/earnings.policy.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Run API typecheck**

Run:

```powershell
npm.cmd run typecheck --workspace @massage-vn/api
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git diff --check
git status --short
git add docs/superpowers/plans/2026-06-29-partner-wallet-accounting-foundation.md apps/api/src/earnings/earnings.policy.ts apps/api/src/earnings/earnings.policy.spec.ts
git commit -m "feat(finance): add partner wallet accounting helpers"
git push
```

Expected: commit and push only this focused foundation.

## Plan Self-Review

- Spec coverage: This implements the calculation helper foundation only. Ledger enum/schema/API/Admin UI are intentionally left for later slices because they require migration and approval-safe accounting writes.
- Placeholder scan: No TBD/TODO placeholders.
- Type consistency: Helper names match the planned exports and tests.
